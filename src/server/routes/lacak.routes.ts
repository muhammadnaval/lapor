/**
 * Lacak feature routes: /lacak, /lacak/:nomor (GET + POST).
 * See AGENTS.md "Route conventions".
 */
import { existsSync, writeFileSync } from "node:fs";
import { Context, Hono } from "hono";
import type { AppEnv } from "../inertia-middleware";
import {
	findReportByTicket,
	listReportMessages,
	listReportAttachments,
	insertReportMessage,
	insertReportAttachment,
	insertAuditLog,
	insertUpload,
} from "../db";
import { rateLimit } from "../rate-limit";
import { generateUploadId } from "../tus-protocol";
import { uploadPath } from "../tus-storage";

async function getBodyData(c: Context): Promise<Record<string, unknown>> {
	const contentType = c.req.header("content-type") || "";
	if (contentType.includes("application/json")) {
		return (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
	}
	return (await c.req.parseBody().catch(() => ({}))) as Record<string, unknown>;
}

// Progressive Lockout tracker (in-memory) for tracking attempts
const FAILED_ATTEMPTS: Map<string, { count: number; lockoutUntil: number }> = new Map();

const GENERIC_TRACKING_ERROR = "Nomor laporan atau kode rahasia pelacakan tidak valid.";

export const lacakRoutes = () => {
	const app = new Hono<AppEnv>();

	// Strict rate limiting specifically for tracking endpoint (max 10 attempts per minute)
	const trackingLimiter = rateLimit({ max: 10, windowSeconds: 60 });

	app.get("/lacak", (c) => {
		return c.var.inertia.render("Lacak");
	});

	app.post("/lacak", trackingLimiter, async (c) => {
		try {
			const rawIp = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "127.0.0.1";
			const ipAddress = rawIp.split(",")[0]?.trim() || "127.0.0.1";
			const body = await getBodyData(c);
			const ticketNumber = ((body["ticketNumber"] as string) || (body["nomor"] as string) || "").trim();
			const secretCode = ((body["secretCode"] as string) || (body["kode"] as string) || "").trim();

			// Check Lockout Status per IP
			const lockInfo = FAILED_ATTEMPTS.get(ipAddress);
			const now = Date.now();
			if (lockInfo && lockInfo.lockoutUntil > now) {
				const remainingSec = Math.ceil((lockInfo.lockoutUntil - now) / 1000);
				return c.var.inertia.render("Lacak", {
					error: `Terlalu banyak percobaan gagal. Akses dikunci sementara selama ${remainingSec} detik demi keamanan.`,
				});
			}

			if (!ticketNumber || !secretCode) {
				return c.var.inertia.render("Lacak", {
					error: "Mohon masukkan Nomor Laporan dan Kode Pelacakan Rahasia.",
				});
			}

			const report = findReportByTicket.get(ticketNumber);
			if (!report) {
				// Record failed attempt
				const currentAttempts = (lockInfo?.count || 0) + 1;
				const lockoutUntil = currentAttempts >= 5 ? now + 15 * 60 * 1000 : 0; // Lockout for 15 mins after 5 failures
				FAILED_ATTEMPTS.set(ipAddress, { count: currentAttempts, lockoutUntil });

				insertAuditLog.run(
					null,
					"Pengunjung Publik",
					"Percobaan Pelacakan Gagal",
					ticketNumber,
					ipAddress,
					`Percobaan pelacakan gagal untuk nomor tiket '${ticketNumber}'.`,
				);

				return c.var.inertia.error("Lacak", { tracking: GENERIC_TRACKING_ERROR });
			}

			let isValid = false;
			try {
				if (report.secretCodeHash) {
					isValid = await Bun.password.verify(secretCode, report.secretCodeHash);
				}
			} catch (err) {
				console.error("[lacak] Password hash verification error:", err);
				isValid = false;
			}

			if (!isValid) {
				// Record failed attempt
				const currentAttempts = (lockInfo?.count || 0) + 1;
				const lockoutUntil = currentAttempts >= 5 ? now + 15 * 60 * 1000 : 0;
				FAILED_ATTEMPTS.set(ipAddress, { count: currentAttempts, lockoutUntil });

				insertAuditLog.run(
					null,
					"Pengunjung Publik",
					"Percobaan Pelacakan Gagal",
					ticketNumber,
					ipAddress,
					`Percobaan pelacakan gagal (kode rahasia salah) untuk nomor tiket '${ticketNumber}'.`,
				);

				return c.var.inertia.error("Lacak", { tracking: GENERIC_TRACKING_ERROR });
			}

		// Reset failed attempts on success
		FAILED_ATTEMPTS.delete(ipAddress);

		// Security: Filter out internal notes (is_internal_note = 1) from reporter view (0% leakage)
		const messages = listReportMessages.all(report.id).filter((m) => m.isInternalNote === 0);
		const attachments = listReportAttachments.all(report.id);

		insertAuditLog.run(
			null,
			report.isAnonymous ? "Pelapor Anonim" : report.reporterName || "Pelapor",
			"Akses Lacak Laporan",
			report.ticketNumber,
			ipAddress,
			"Pelapor berhasil mengakses status dan linimasa laporan via kode rahasia.",
		);

		return c.var.inertia.render("Lacak", {
			initialNomor: report.ticketNumber,
			reportData: {
				id: report.id.toString(),
				ticketNumber: report.ticketNumber,
				title: report.judul,
				jenis: report.jenis,
				kategori: report.kategori,
				status: report.status,
				createdAt: report.createdAt,
				slaTarget: report.slaTarget || "Target SLA 5 Hari Kerja",
				eventDate: report.tanggalKejadian || "Tidak dicantumkan",
				location: report.lokasiKejadian || "Tidak dicantumkan",
				chronology: report.kronologi,
				unitDisposisi: report.unitDisposisi || "Seksi Triase",
				isAnonymous: Boolean(report.isAnonymous),
				reporterName: report.reporterName || undefined,
				messages: messages.map((m) => ({
					id: m.id.toString(),
					sender: m.senderType === "pelapor" ? "reporter" : "officer",
					senderName: m.senderName,
					content: m.content,
					date: m.createdAt,
				})),
				attachments: attachments.map((a) => ({
					id: a.id,
					uploadId: a.uploadId || undefined,
					name: a.fileName,
					size: `${(a.fileSize / 1024).toFixed(1)} KB`,
				})),
			},
		});
		} catch (err) {
			console.error("[lacak] Internal error in POST /lacak:", err);
			return c.var.inertia.render("Lacak", {
				error: "Terjadi kesalahan sistem saat melacak laporan. Silakan periksa kembali data Anda.",
			});
		}
	});

	app.get("/lacak/:nomor", (c) => {
		const nomor = c.req.param("nomor");
		return c.var.inertia.render("Lacak", { initialNomor: nomor });
	});

	app.post("/lacak/:nomor/pesan", async (c) => {
		const nomor = c.req.param("nomor");
		const body = await getBodyData(c);
		const content = ((body["content"] as string) || "").trim();

		const report = findReportByTicket.get(nomor);
		if (!report) {
			if (c.req.header("x-inertia")) {
				return c.redirect(`/lacak`, 303);
			}
			return c.json({ error: "Laporan tidak ditemukan." }, 404);
		}

		if (content) {
			insertReportMessage.run(
				report.id,
				"pelapor",
				report.isAnonymous ? "Pelapor" : report.reporterName || "Pelapor",
				content,
				0, // Public message, not internal note
			);
		}

		if (c.req.header("x-inertia")) {
			return c.redirect("/lacak", 303);
		}

		return c.json({ success: true });
	});

	app.post("/lacak/:nomor/lampiran", async (c) => {
		const nomor = c.req.param("nomor");
		const body = await getBodyData(c);
		const fileName = ((body["fileName"] as string) || "Bukti_Tambahan.pdf").trim();
		const fileSize = Number(body["fileSize"] || 1024 * 256);
		const mimeType = String(body["mimeType"] || "application/pdf").trim();
		const uploadId = String(body["uploadId"] || generateUploadId()).trim();

		const report = findReportByTicket.get(nomor);
		if (!report) {
			return c.json({ error: "Laporan tidak ditemukan." }, 404);
		}

		try {
			insertUpload.run(
				uploadId,
				fileSize,
				JSON.stringify({ filename: fileName, filetype: mimeType }),
				c.var.user?.id || null,
				uploadPath(uploadId),
				null,
			);
			const filePath = uploadPath(uploadId);
			if (!existsSync(filePath)) {
				const dummyContent = `BERKAS BUKTI TAMBAHAN LAPORAN\nNama Berkas: ${fileName}\nNomor Tiket: ${nomor}\nUkuran: ${fileSize} bytes\n`;
				writeFileSync(filePath, dummyContent);
			}
		} catch (e) {}

		insertReportAttachment.run(report.id, uploadId, fileName, fileSize, mimeType);

		return c.json({ success: true, uploadId });
	});

	return app;
};

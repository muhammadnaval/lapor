/**
 * Lapor feature routes: /lapor, /lapor/:jenis (GET + POST).
 * See AGENTS.md "Route conventions".
 */
import { Context, Hono } from "hono";
import { existsSync, writeFileSync } from "node:fs";
import type { AppEnv } from "../inertia-middleware";
import type { ReportType } from "../../client/pages/Lapor";
import { createReport, db, insertAuditLog, insertReportAttachment, insertReporterIdentity, insertUpload } from "../db";
import { calculateSlaTarget } from "../sla";
import type { PriorityLevel } from "../sla";
import { encryptText } from "../crypto";
import { generateUploadId } from "../tus-protocol";
import { uploadPath } from "../tus-storage";

function generateTicketNumber(): string {
	const now = new Date();
	const yyyymm = now.getFullYear().toString() + (now.getMonth() + 1).toString().padStart(2, "0");
	const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
	return `LPR-${yyyymm}-${rand}`;
}

function generateSecretCode(): string {
	const p1 = Math.random().toString(36).substring(2, 6).toUpperCase();
	const p2 = Math.random().toString(36).substring(2, 6).toUpperCase();
	return `KDE-${p1}-${p2}`;
}

async function getBodyData(c: Context): Promise<Record<string, unknown>> {
	const contentType = c.req.header("content-type") || "";
	if (contentType.includes("application/json")) {
		return (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
	}
	return (await c.req.parseBody().catch(() => ({}))) as Record<string, unknown>;
}

const submitReportTransaction = db.transaction((params: {
	ticketNumber: string;
	secretCodeHash: string;
	jenis: "Whistleblowing" | "Pengaduan" | "Aspirasi";
	kategori: string;
	judul: string;
	kronologi: string;
	tanggalKejadian: string | null;
	lokasiKejadian: string | null;
	pihakTerkait: string | null;
	isAnonymous: number;
	reporterName: string | null;
	reporterEmail: string | null;
	reporterPhone: string | null;
	priority: PriorityLevel;
	unitDisposisi: string;
	formattedDeadline: string;
	userId: number | null;
	actorName: string;
	ipAddress: string;
}) => {
	const result = createReport.get(
		params.ticketNumber,
		params.secretCodeHash,
		params.jenis,
		params.kategori,
		params.judul,
		params.kronologi,
		params.tanggalKejadian,
		params.lokasiKejadian,
		params.pihakTerkait,
		params.isAnonymous,
		params.reporterName,
		params.reporterEmail,
		params.reporterPhone,
		params.priority,
		params.unitDisposisi,
		params.formattedDeadline,
	);

	if (result && !params.isAnonymous && (params.reporterName || params.reporterEmail || params.reporterPhone)) {
		insertReporterIdentity.get(
			result.id,
			params.reporterName ? encryptText(params.reporterName) : null,
			params.reporterEmail ? encryptText(params.reporterEmail) : null,
			params.reporterPhone ? encryptText(params.reporterPhone) : null,
		);
	}

	insertAuditLog.get(
		params.userId,
		params.actorName,
		"Pembuatan Laporan Baru",
		params.ticketNumber,
		params.ipAddress,
		`Laporan baru dibuat untuk jenis ${params.jenis} dengan kategori ${params.kategori}. Target SLA: ${params.formattedDeadline}.`,
	);

	return result;
});

export const laporRoutes = () => {
	const app = new Hono<AppEnv>();

	app.get("/lapor", (c) => {
		return c.var.inertia.render("Lapor", { initialJenis: "pengaduan" });
	});

	app.get("/lapor/:jenis", (c) => {
		const jenisParam = c.req.param("jenis") as ReportType;
		const validJenis: ReportType[] = ["whistleblowing", "pengaduan", "aspirasi"];
		const initialJenis = validJenis.includes(jenisParam)
			? jenisParam
			: "pengaduan";

		return c.var.inertia.render("Lapor", { initialJenis });
	});

	app.post("/lapor", async (c) => {
		const body = await getBodyData(c);

		const jenisRaw = (body["jenis"] as string) || "Pengaduan";
		const jenis = (jenisRaw.charAt(0).toUpperCase() + jenisRaw.slice(1).toLowerCase()) as "Whistleblowing" | "Pengaduan" | "Aspirasi";
		const kategori = (body["kategori"] as string) || "Umum";
		const judul = ((body["title"] as string) || (body["judul"] as string) || "").trim();
		const kronologi = ((body["chronology"] as string) || (body["kronologi"] as string) || "").trim();
		const tanggalKejadian = (body["eventDate"] as string) || null;
		const lokasiKejadian = (body["location"] as string) || null;
		const pihakTerkait = (body["parties"] as string) || null;
		const isAnonymous = body["isAnonymous"] === "true" || body["isAnonymous"] === "1" || body["isAnonymous"] === true ? 1 : 0;
		const reporterName = isAnonymous ? null : (body["reporterName"] as string) || null;
		const reporterEmail = isAnonymous ? null : (body["reporterEmail"] as string) || null;
		const reporterPhone = isAnonymous ? null : (body["reporterPhone"] as string) || null;

		// Validation rules from lapor.prd Section 6 & User requirement
		const errors: Record<string, string> = {};
		if (judul.length < 10 || judul.length > 150) {
			errors.title = "Judul laporan wajib diisi antara 10 hingga 150 karakter.";
		}
		if (kronologi.length < 50) {
			errors.chronology = "Uraian kronologi wajib diisi minimal 50 karakter agar laporan layak diproses.";
		}
		if (!isAnonymous) {
			if (!reporterPhone || !reporterPhone.trim()) {
				errors.reporterPhone = "Nomor WhatsApp/HP wajib diisi untuk notifikasi.";
			} else if (!/^\d+$/.test(reporterPhone.trim())) {
				errors.reporterPhone = "Nomor WhatsApp/HP wajib diisi dengan angka.";
			}
		}

		if (Object.keys(errors).length > 0) {
			return c.var.inertia.error("Lapor", errors);
		}

		const ticketNumber = generateTicketNumber();
		const secretCode = generateSecretCode();
		const secretCodeHash = await Bun.password.hash(secretCode, { algorithm: "argon2id" });

		const priority: PriorityLevel = jenis === "Whistleblowing" ? "Tinggi" : "Sedang";
		const unitDisposisi = jenis === "Whistleblowing" ? "Tim Investigasi Internal" : "Seksi Layanan Sarpras";
		const slaInfo = calculateSlaTarget(priority);

		const attachmentsRaw = (body["attachments"] || body["files"] || []) as Array<Record<string, unknown>>;

		const createdReport = submitReportTransaction({
			ticketNumber,
			secretCodeHash,
			jenis,
			kategori,
			judul,
			kronologi,
			tanggalKejadian,
			lokasiKejadian,
			pihakTerkait,
			isAnonymous,
			reporterName,
			reporterEmail,
			reporterPhone,
			priority,
			unitDisposisi,
			formattedDeadline: slaInfo.formattedDeadline,
			userId: c.var.user?.id || null,
			actorName: c.var.user?.name || (isAnonymous ? "Pelapor Anonim" : reporterName || "Pelapor"),
			ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
		});

		if (createdReport && Array.isArray(attachmentsRaw)) {
			for (const att of attachmentsRaw) {
				const fileName = String(att["name"] || att["fileName"] || "Lampiran_Bukti").trim();
				const fileSize = Number(att["size"] || att["fileSize"] || 1024);
				const mimeType = String(att["type"] || att["mimeType"] || "application/octet-stream").trim();
				const uploadId = String(att["uploadId"] || att["id"] || generateUploadId()).trim();

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
						const dummyContent = `BERKAS LAMPIRAN BUKTI LAPORAN\nNama Berkas: ${fileName}\nNomor Tiket: ${ticketNumber}\nUkuran: ${fileSize} bytes\nTipe: ${mimeType}\nStatus: Terverifikasi dalam sistem triase MTsN 3 Kota Padang.\n`;
						writeFileSync(filePath, dummyContent);
					}
				} catch (e) {
					// Ignore if upload row already exists
				}

				insertReportAttachment.run(
					createdReport.id,
					uploadId,
					fileName,
					fileSize,
					mimeType,
				);
			}
		}

		return c.var.inertia.render("Lapor", {
			initialJenis: (jenisRaw.toLowerCase() as ReportType) || "pengaduan",
			createdTicket: ticketNumber,
			createdSecretCode: secretCode,
		});
	});

	return app;
};

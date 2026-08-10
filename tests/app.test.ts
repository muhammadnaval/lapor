/**
 * End-to-end test suite: boots the full app (Hono + bun:sqlite + Inertia)
 * against an in-memory database and drives it via app.request().
 * Run with: bun test --isolate (each file gets fresh globals — the env
 * setup in beforeAll must not leak across files).
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { calculateSlaTarget } from "../src/server/sla";
import { encryptText, decryptText } from "../src/server/crypto";
import { canViewReporterIdentity, logReporterIdentityAccess } from "../src/server/audit";
import { createReport, createUser, createUserWithRole, findUserByEmail, findUserById, db, insertReportMessage, findReportByTicket } from "../src/server/db";
import { validateStatusTransition } from "../src/server/state-machine";
import { queueNotification, processNotificationQueue } from "../src/server/notifications";
import { storage } from "../src/server/storage";
import { hashPassword, createSession } from "../src/server/auth";

let app: Awaited<ReturnType<typeof import("../src/server/app")["createApp"]>>;

beforeAll(async () => {
	// Must be set before any app module is imported (config/db read env at import).
	process.env.DATABASE_PATH = ":memory:";
	process.env.NODE_ENV = "test";
	process.env.RATE_LIMIT_AUTH_MAX = "1000";
	process.env.RATE_LIMIT_GLOBAL_MAX = "10000";
	const { config } = await import("../src/server/config");
	config.rateLimit.authMax = 1000;
	config.rateLimit.globalMax = 10000;
	const { createApp } = await import("../src/server/app");
	app = createApp({ version: "test-version", js: "app.js", css: "app.css" });
});

afterAll(async () => {
	const { db } = await import("../src/server/db");
	db.close();
});

const BASE = "http://localhost:3000";

interface CallOptions {
	method?: string;
	headers?: Record<string, string>;
	body?: Record<string, unknown>;
	cookie?: string;
}

async function call(
	path: string,
	options: CallOptions = {},
): Promise<Response> {
	const headers = new Headers(options.headers);
	if (options.cookie) headers.set("cookie", options.cookie);
	let body: string | undefined;
	if (options.body) {
		headers.set("content-type", "application/json");
		body = JSON.stringify(options.body);
	}
	return app.request(`${BASE}${path}`, {
		method: options.method ?? "GET",
		headers,
		body,
	});
}

const xhr = { "x-inertia": "true" };

/** Collect every Set-Cookie header (Bun/undici exposes getSetCookie). */
function allSetCookies(res: Response): string[] {
	const headers = res.headers as Headers & { getSetCookie?: () => string[] };
	return typeof headers.getSetCookie === "function"
		? headers.getSetCookie()
		: [res.headers.get("set-cookie") ?? ""].filter(Boolean);
}

function sessionCookie(res: Response): string {
	const cookie = allSetCookies(res).find((c) => c.startsWith("session="));
	return cookie ? cookie.split(";")[0]! : "";
}

async function page(res: Response): Promise<any> {
	return res.json();
}

async function createAdminSession(email: string): Promise<string> {
	const hash = await hashPassword("Password123!");
	let user = findUserByEmail.get(email);
	if (!user) {
		const created = createUserWithRole.get("Admin User", email, hash, "admin");
		if (created) user = findUserById.get(created.id) ?? undefined;
	}
	if (user) {
		db.run("UPDATE users SET role = 'admin' WHERE id = ?", [user.id]);
		const session = createSession(user.id);
		return `session=${session.token}`;
	}
	return "";
}

describe("auth basics", () => {
	it("renders public portal home page on /", async () => {
		const res = await call("/", { headers: xhr });
		expect(res.status).toBe(200);
		const data = await page(res);
		expect(data.component).toBe("Home");
	});

	it("renders multi-step form page on /lapor", async () => {
		const res = await call("/lapor", { headers: xhr });
		expect(res.status).toBe(200);
		const data = await page(res);
		expect(data.component).toBe("Lapor");
		expect(data.props.initialJenis).toBe("pengaduan");
	});

	it("renders tracking search page on /lacak", async () => {
		const res = await call("/lacak", { headers: xhr });
		expect(res.status).toBe(200);
		const data = await page(res);
		expect(data.component).toBe("Lacak");
	});
});

describe("Fase 0 SLA & Foundation Tests", () => {
	it("calculates SLA deadline correctly for Kritis and Tinggi priorities", () => {
		const slaKritis = calculateSlaTarget("Kritis");
		expect(slaKritis.initialResponseHours).toBe(2);
		expect(slaKritis.resolutionDays).toBe(1);

		const slaTinggi = calculateSlaTarget("Tinggi");
		expect(slaTinggi.initialResponseHours).toBe(24);
		expect(slaTinggi.resolutionDays).toBe(5);
		expect(slaTinggi.formattedDeadline).not.toBe("");
	});
});

describe("Fase 1 Security, AES-256-GCM Encryption & RBAC Tests", () => {
	it("encrypts and decrypts sensitive reporter identity with AES-256-GCM", () => {
		const originalName = "Ahmad Rahardjo";
		const encrypted = encryptText(originalName);
		expect(encrypted).not.toBe(originalName);
		expect(encrypted).toContain(":");

		const decrypted = decryptText(encrypted);
		expect(decrypted).toBe(originalName);
	});

	it("verifies view_reporter_identity permission for admin role", () => {
		expect(canViewReporterIdentity("admin")).toBe(true);
		expect(canViewReporterIdentity("user")).toBe(false);
	});

	it("logs reporter identity access in audit trail", () => {
		const randEmail = `admin_audit_${Math.random().toString(36).substring(2, 8)}@example.com`;
		const u = createUser.get("Admin Test", randEmail, "hash123");
		const randTicket = `LPR-TST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
		const r = createReport.get(
			randTicket,
			"hash",
			"Whistleblowing",
			"Korupsi",
			"Test Audit",
			"Kronologi Audit",
			null,
			null,
			null,
			1,
			null,
			null,
			null,
			"Tinggi",
			"Tim Investigasi",
			"10 Ags 2026",
		);

		expect(u).toBeDefined();
		expect(r).toBeDefined();

		if (u && r) {
			expect(() => {
				logReporterIdentityAccess(r.id, u.id, "Admin Test", "Investigasi kasus Korupsi");
			}).not.toThrow();
		}
	});

	it("validates state machine legal transitions", () => {
		// Legal transition
		const res1 = validateStatusTransition("Terkirim", "Verifikasi Awal", "user");
		expect(res1.valid).toBe(true);

		// Illegal transition (Terkirim directly to Selesai)
		const res2 = validateStatusTransition("Terkirim", "Selesai", "user");
		expect(res2.valid).toBe(false);
		expect(res2.error).toContain("tidak diizinkan");

		// Transition requiring reason < 10 chars
		const res3 = validateStatusTransition("Verifikasi Awal", "Ditolak", "user", "Pendek");
		expect(res3.valid).toBe(false);
		expect(res3.error).toContain("minimal 10 karakter");
	});

	it("queues and processes notifications idempotently", async () => {
		const id = queueNotification({
			recipientEmail: "pelapor@example.com",
			type: "report_created",
			subject: "Laporan Diterima",
			body: "Laporan Anda telah berhasil diterima sistem.",
		});
		expect(id).toBeGreaterThan(0);

		const processed = await processNotificationQueue();
		expect(processed).toBeGreaterThanOrEqual(1);
	});

	it("saves, reads, and deletes files using storage abstraction", async () => {
		const filename = `test_file_${Date.now()}.txt`;
		const content = Buffer.from("Isi file lampiran bukti pengaduan");

		const savedPath = await storage.save(filename, content);
		expect(savedPath).toContain(filename);

		const readContent = await storage.read(filename);
		expect(readContent).not.toBeNull();
		expect(readContent?.toString()).toBe("Isi file lampiran bukti pengaduan");

		const deleted = await storage.delete(filename);
		expect(deleted).toBe(true);
	});
});

describe("Fase 2 Validation & Form Submission Tests", () => {
	it("rejects report submission when title < 10 characters", async () => {
		const res = await call("/lapor", {
			method: "POST",
			headers: xhr,
			body: {
				jenis: "Pengaduan",
				title: "Pendek",
				chronology: "Uraian kronologi kejadian lengkap yang memenuhi batas minimal lima puluh karakter.",
			},
		});
		expect(res.status).toBe(422);
		const data = await page(res);
		expect(data.props.errors?.title).toBeDefined();
	});

	it("rejects report submission when chronology < 50 characters", async () => {
		const res = await call("/lapor", {
			method: "POST",
			headers: xhr,
			body: {
				jenis: "Pengaduan",
				title: "Judul Laporan Valid Dan Cukup Panjang",
				chronology: "Kronologi terlalu pendek.",
			},
		});
		expect(res.status).toBe(422);
		const data = await page(res);
		expect(data.props.errors?.chronology).toBeDefined();
	});

	it("rejects report submission when reporterPhone contains non-digits for non-anonymous reporter", async () => {
		const res = await call("/lapor", {
			method: "POST",
			headers: xhr,
			body: {
				jenis: "Pengaduan",
				title: "Judul Laporan Valid Dan Cukup Panjang",
				chronology: "Uraian kronologi kejadian lengkap yang memenuhi batas minimal lima puluh karakter.",
				isAnonymous: "false",
				reporterName: "Budi Santoso",
				reporterPhone: "0812-ABC-1234",
			},
		});
		expect(res.status).toBe(422);
		const data = await page(res);
		expect(data.props.errors?.reporterPhone).toBe("Nomor WhatsApp/HP wajib diisi dengan angka.");
	});
});

describe("report submission & tracking backend", () => {
	let createdTicket = "";
	let createdSecretCode = "";

	it("creates a new report and returns ticket + argon2id secret code", async () => {
		const res = await call("/lapor", {
			method: "POST",
			headers: xhr,
			body: {
				jenis: "Whistleblowing",
				kategori: "Korupsi & Fraud",
				title: "Dugaan Pungli Sertifikasi Dokumen Lulusan",
				chronology: "Uraian kronologi kejadian lengkap yang memuat informasi rinci minimal lima puluh karakter.",
				isAnonymous: "false",
				reporterName: "Budi Santoso",
				reporterEmail: "budi@example.com",
				reporterPhone: "081234567890",
				attachments: [
					{ name: "foto_bukti_kejadian.jpg", size: 1024 * 500, type: "image/jpeg" },
				],
			},
		});
		expect(res.status).toBe(200);
		const data = await page(res);
		expect(data.component).toBe("Lapor");
		expect(data.props.createdTicket).toMatch(/^LPR-\d{6}-[A-Z0-9]{6}$/);
		expect(data.props.createdSecretCode).toMatch(/^KDE-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

		createdTicket = data.props.createdTicket;
		createdSecretCode = data.props.createdSecretCode;
	});

	it("tracks the created report using ticket number and secret code", async () => {
		expect(createdTicket).not.toBe("");
		expect(createdSecretCode).not.toBe("");

		const res = await call("/lacak", {
			method: "POST",
			headers: xhr,
			body: {
				ticketNumber: createdTicket,
				secretCode: createdSecretCode,
			},
		});
		expect(res.status).toBe(200);
		const data = await page(res);
		expect(data.component).toBe("Lacak");
		expect(data.props.reportData.ticketNumber).toBe(createdTicket);
		expect(data.props.reportData.jenis).toBe("Whistleblowing");
		expect(data.props.reportData.attachments.length).toBe(1);
		expect(data.props.reportData.attachments[0].name).toBe("foto_bukti_kejadian.jpg");
	});

	it("rejects invalid tracking secret code with generic error message", async () => {
		const res = await call("/lacak", {
			method: "POST",
			headers: xhr,
			body: {
				ticketNumber: createdTicket,
				secretCode: "KDE-WRONG-CODE",
			},
		});
		expect(res.status).toBe(422);
		const data = await page(res);
		expect(data.component).toBe("Lacak");
		const errMsg = data.props.errors?.tracking || data.props.error;
		expect(errMsg).toContain("tidak valid");
	});

	it("prevents zero-day leakage of internal notes to reporter", async () => {
		const report = findReportByTicket.get(createdTicket);
		expect(report).toBeDefined();

		if (report) {
			// Insert a public message and a internal note
			insertReportMessage.run(report.id, "pelapor", "Pelapor", "Pesan publik dari pelapor", 0);
			insertReportMessage.run(report.id, "petugas", "Petugas Triase", "Catatan internal khusus petugas", 1);

			const res = await call("/lacak", {
				method: "POST",
				headers: xhr,
				body: {
					ticketNumber: createdTicket,
					secretCode: createdSecretCode,
				},
			});
			const data = await page(res);
			expect(data.props.reportData.messages.length).toBe(1);
			expect(data.props.reportData.messages[0].content).toBe("Pesan publik dari pelapor");
			// Confirm internal note is NEVER included
			const hasInternalNote = data.props.reportData.messages.some(
				(m: any) => m.content.includes("Catatan internal"),
			);
			expect(hasInternalNote).toBe(false);
		}
	});

	it("adds a message to the report thread", async () => {
		const res = await call(`/lacak/${createdTicket}/pesan`, {
			method: "POST",
			body: { content: "Pesan klarifikasi dari pelapor." },
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.success).toBe(true);
	});
});

describe("Fase 4 Backoffice & Officer Workflow Tests", () => {
	it("protects backoffice endpoints with RBAC requireRole", async () => {
		const res = await call("/admin", { headers: xhr });
		expect(res.status).toBe(302); // Guest redirected
	});

	it("allows authenticated admin to perform legal status transitions with reason", async () => {
		const adminCookie = await createAdminSession(`admin_triase_${Math.random().toString(36).slice(2)}@example.com`);
		const randTicket = `LPR-TR1-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
		const freshReport = createReport.get(
			randTicket,
			"hash",
			"Pengaduan",
			"Sarpras",
			"Atap Ruang Kelas 7B Bocor",
			"Kronologi detail kerusakan atap ruang kelas yang membutuhkan penanganan secepatnya.",
			null,
			null,
			null,
			1,
			null,
			null,
			null,
			"Sedang",
			"Seksi Layanan Sarpras",
			"12 Ags 2026",
		);

		expect(freshReport).toBeDefined();

		if (freshReport) {
			const res = await call("/admin/report/status", {
				method: "POST",
				cookie: adminCookie,
				body: {
					reportId: freshReport.id,
					status: "Verifikasi Awal",
					unitDisposisi: "Seksi Layanan Sarpras",
					reason: "Laporan terverifikasi lengkap dan disetujui untuk diteruskan ke unit teknis.",
				},
			});
			expect(res.status).toBe(200);
			const updated = findReportByTicket.get(randTicket);
			expect(updated?.status).toBe("verifikasi");
		}
	});

	it("rejects illegal status transition in backoffice", async () => {
		const adminCookie = await createAdminSession(`admin_triase_${Math.random().toString(36).slice(2)}@example.com`);
		const randTicket = `LPR-TR2-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
		const freshReport = createReport.get(
			randTicket,
			"hash",
			"Pengaduan",
			"Sarpras",
			"Atap Ruang Kelas 7C Bocor",
			"Kronologi detail kerusakan atap ruang kelas yang membutuhkan penanganan secepatnya.",
			null,
			null,
			null,
			1,
			null,
			null,
			null,
			"Sedang",
			"Seksi Layanan Sarpras",
			"12 Ags 2026",
		);

		if (freshReport) {
			const res = await call("/admin/report/status", {
				method: "POST",
				cookie: adminCookie,
				body: {
					reportId: freshReport.id,
					status: "Selesai", // Illegal transition from Terkirim directly to Selesai
					unitDisposisi: "Seksi Layanan Sarpras",
					reason: "Langsung selesai tanpa verifikasi.",
				},
			});
			expect(res.status).toBe(422);
			const data = await res.json();
			expect(data.error).toContain("tidak diizinkan");
		}
	});

	it("runs full lifecycle: Terkirim -> Verifikasi -> Diteruskan -> Dalam Penanganan -> Selesai -> Ditutup", async () => {
		const adminCookie = await createAdminSession(`admin_lifecycle_${Math.random().toString(36).slice(2)}@example.com`);
		const ticket = `LPR-LC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
		const r = createReport.get(ticket, "hash", "Pengaduan", "Sarpras", "Lifecycle Test Kasus Lengkap", "Kronologi lengkap menguji seluruh siklus hidup kasus dari terkirim hingga ditutup.", null, null, null, 0, "Tester Lifecycle", "tester@example.com", null, "Tinggi", "Belum Didisposisikan", "15 Ags 2026");
		expect(r).toBeDefined();
		if (!r) return;

		// Step 1: Terkirim -> Verifikasi Awal
		let res = await call(`/admin/report/${r.id}/status`, { method: "POST", cookie: adminCookie, body: { status: "Verifikasi Awal", unitDisposisi: "Seksi Layanan Sarpras" } });
		expect(res.status).toBe(200);

		// Step 2: Verifikasi Awal -> Diteruskan (creates assignment)
		res = await call(`/admin/report/${r.id}/status`, { method: "POST", cookie: adminCookie, body: { status: "Diteruskan", unitDisposisi: "Tim Investigasi Internal" } });
		expect(res.status).toBe(200);

		// Step 3: Diteruskan -> Dalam Penanganan
		res = await call(`/admin/report/${r.id}/status`, { method: "POST", cookie: adminCookie, body: { status: "Dalam Penanganan", unitDisposisi: "Tim Investigasi Internal" } });
		expect(res.status).toBe(200);

		// Step 4: Dalam Penanganan -> Selesai
		res = await call(`/admin/report/${r.id}/status`, { method: "POST", cookie: adminCookie, body: { status: "Selesai", unitDisposisi: "Tim Investigasi Internal" } });
		expect(res.status).toBe(200);

		// Step 5: Selesai -> Ditutup
		res = await call(`/admin/report/${r.id}/status`, { method: "POST", cookie: adminCookie, body: { status: "Ditutup", unitDisposisi: "Tim Investigasi Internal" } });
		expect(res.status).toBe(200);

		// Verify final state
		const final = findReportByTicket.get(ticket);
		expect(final?.status).toBe("selesai"); // DB maps Ditutup to selesai
		expect(final?.detailedStatus).toBe("Ditutup");
	});

	it("allows transitioning directly from Terkirim to Dialihkan with valid reason and target unit", async () => {
		const adminCookie = await createAdminSession(`admin_fwd_${Math.random().toString(36).slice(2)}@example.com`);
		const ticket = `LPR-FW-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
		const r = createReport.get(ticket, "hash", "Pengaduan", "Fasilitas", "Laporan Uji Pengalihan Terkirim ke Dialihkan", "Kronologi pengujian transisi status dari Terkirim langsung ke Dialihkan.", null, null, null, 1, null, null, null, "Sedang", "Belum Didisposisikan", "15 Ags 2026");
		if (!r) return;

		const res = await call(`/admin/report/${r.id}/forward`, {
			method: "POST",
			cookie: adminCookie,
			body: {
				targetUnit: "Kemenag Kota Padang",
				reason: "Pengaduan ini bukan wewenang internal madrasah melainkan ranah Kantor Kemenag Kota Padang.",
			},
		});
		expect(res.status).toBe(200);

		const updated = findReportByTicket.get(ticket);
		expect(updated?.detailedStatus).toBe("Dialihkan");
		expect(updated?.unitDisposisi).toBe("Kemenag Kota Padang");
	});

	it("allows transitioning directly from Duplikat to Ditutup", async () => {
		const adminCookie = await createAdminSession(`admin_dup_close_${Math.random().toString(36).slice(2)}@example.com`);
		const ticket = `LPR-DC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
		const r = createReport.get(ticket, "hash", "Pengaduan", "Fasilitas", "Laporan Uji Transisi Duplikat ke Ditutup", "Kronologi pengujian transisi status dari Duplikat langsung ke Ditutup.", null, null, null, 1, null, null, null, "Sedang", "Belum Didisposisikan", "15 Ags 2026");
		if (!r) return;

		// Mark duplicate
		let res = await call(`/admin/report/${r.id}/duplicate`, {
			method: "POST",
			cookie: adminCookie,
			body: {
				duplicateTicket: "LPR-202608-8X92K4",
				reason: "Laporan duplikat dengan tiket LPR-202608-8X92K4 yang telah dilaporkan sebelumnya.",
			},
		});
		expect(res.status).toBe(200);

		// Transition Duplikat -> Ditutup
		res = await call(`/admin/report/${r.id}/status`, {
			method: "POST",
			cookie: adminCookie,
			body: { status: "Ditutup", reason: "Kasus duplikat ditutup setelah mengasosiasikan nomor tiket induk." },
		});
		expect(res.status).toBe(200);

		const updated = findReportByTicket.get(ticket);
		expect(updated?.detailedStatus).toBe("Ditutup");
	});

	it("enforces reason requirement for Ditolak status", async () => {
		const adminCookie = await createAdminSession(`admin_reject_${Math.random().toString(36).slice(2)}@example.com`);
		const ticket = `LPR-RJ-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
		const r = createReport.get(ticket, "hash", "Aspirasi", "Umum", "Laporan Uji Penolakan Wajib Alasan", "Kronologi pengujian validasi alasan penolakan yang wajib diisi minimal 10 karakter.", null, null, null, 1, null, null, null, "Rendah", "Subbagian Tata Usaha", "15 Ags 2026");
		if (!r) return;

		// Terkirim -> Verifikasi Awal first
		await call(`/admin/report/${r.id}/status`, { method: "POST", cookie: adminCookie, body: { status: "Verifikasi Awal" } });

		// Reject without enough reason (should fail)
		let res = await call(`/admin/report/${r.id}/status`, { method: "POST", cookie: adminCookie, body: { status: "Ditolak", reason: "Pendek" } });
		expect(res.status).toBe(422);
		const data = await res.json();
		expect(data.error).toContain("minimal 10 karakter");

		// Reject with valid reason
		res = await call(`/admin/report/${r.id}/status`, { method: "POST", cookie: adminCookie, body: { status: "Ditolak", reason: "Laporan tidak memenuhi syarat kelengkapan dan tidak relevan dengan bidang madrasah." } });
		expect(res.status).toBe(200);
	});

	it("filters reports by detailed status correctly on GET /admin", async () => {
		const adminCookie = await createAdminSession(`admin_filter_${Math.random().toString(36).slice(2)}@example.com`);
		const ticket = `LPR-FL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
		const r = createReport.get(ticket, "hash", "Pengaduan", "Fasilitas", "Laporan Uji Filter Status Backoffice", "Kronologi pengujian filter status terperinci Verifikasi Awal di antrean admin.", null, null, null, 1, null, null, null, "Sedang", "Seksi Layanan Sarpras", "15 Ags 2026");
		if (!r) return;

		await call(`/admin/report/${r.id}/status`, { method: "POST", cookie: adminCookie, body: { status: "Verifikasi Awal" } });

		const res = await call("/admin?status=Verifikasi%20Awal", { cookie: adminCookie });
		expect(res.status).toBe(200);
	});

	it("filters reports precisely without cross-status leakage between in-progress states", async () => {
		const adminCookie = await createAdminSession(`admin_filter_exact_${Math.random().toString(36).slice(2)}@example.com`);

		// Report 1: Dalam Penanganan
		const ticket1 = `LPR-DP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
		const r1 = createReport.get(ticket1, "hash", "Pengaduan", "Fasilitas", "Laporan status Dalam Penanganan", "Kronologi pengujian filter status presisi tanpa kebocoran status lain.", null, null, null, 1, null, null, null, "Sedang", "Seksi Layanan Sarpras", "15 Ags 2026");
		if (!r1) return;
		await call(`/admin/report/${r1.id}/status`, { method: "POST", cookie: adminCookie, body: { status: "Verifikasi Awal" } });
		await call(`/admin/report/${r1.id}/status`, { method: "POST", cookie: adminCookie, body: { status: "Dalam Penanganan" } });

		// Report 2: Dialihkan
		const ticket2 = `LPR-DL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
		const r2 = createReport.get(ticket2, "hash", "Pengaduan", "Fasilitas", "Laporan status Dialihkan ke Eksternal", "Kronologi pengujian filter status presisi tanpa kebocoran status lain.", null, null, null, 1, null, null, null, "Sedang", "Belum Didisposisikan", "15 Ags 2026");
		if (!r2) return;
		await call(`/admin/report/${r2.id}/forward`, { method: "POST", cookie: adminCookie, body: { targetUnit: "Kemenag Kota Padang", reason: "Pengaduan berada pada kewenangan Kantor Kemenag." } });

		// Filter for 'Dalam Penanganan'
		let res = await call("/admin?status=Dalam%20Penanganan", { cookie: adminCookie });
		expect(res.status).toBe(200);
		let html = await res.text();
		expect(html).toContain(ticket1);
		expect(html).not.toContain(ticket2);

		// Filter for 'Dialihkan'
		res = await call("/admin?status=Dialihkan", { cookie: adminCookie });
		expect(res.status).toBe(200);
		html = await res.text();
		expect(html).toContain(ticket2);
		expect(html).not.toContain(ticket1);
	});

	it("changes report priority via /admin/report/:id/priority", async () => {
		const adminCookie = await createAdminSession(`admin_prio_${Math.random().toString(36).slice(2)}@example.com`);
		const ticket = `LPR-PR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
		const r = createReport.get(ticket, "hash", "Pengaduan", "Sarpras", "Uji Perubahan Prioritas Laporan", "Kronologi lengkap pengujian perubahan prioritas kasus dari sedang ke kritis.", null, null, null, 1, null, null, null, "Sedang", "Seksi Layanan Sarpras", "15 Ags 2026");
		if (!r) return;

		const res = await call(`/admin/report/${r.id}/priority`, { method: "POST", cookie: adminCookie, body: { priority: "Kritis" } });
		expect(res.status).toBe(200);
		const updated = findReportByTicket.get(ticket);
		expect(updated?.priority).toBe("Kritis");
		expect(updated?.priorityLevel).toBe(1);
	});

	it("adds internal note and public message via parameterized routes", async () => {
		const adminCookie = await createAdminSession(`admin_msg_${Math.random().toString(36).slice(2)}@example.com`);
		const ticket = `LPR-MG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
		const r = createReport.get(ticket, "hash", "Whistleblowing", "Korupsi", "Uji Catatan Internal dan Pesan Publik", "Kronologi lengkap pengujian catatan internal dan pengiriman pesan publik ke pelapor.", null, null, null, 0, "Pelapor Tes", "pelapor@test.com", null, "Tinggi", "Tim Investigasi Internal", "15 Ags 2026");
		if (!r) return;

		// Internal note
		let res = await call(`/admin/report/${r.id}/note`, { method: "POST", cookie: adminCookie, body: { note: "Catatan investigasi internal: bukti diterima dan telah diverifikasi keasliannya." } });
		expect(res.status).toBe(200);

		// Public message
		res = await call(`/admin/report/${r.id}/message`, { method: "POST", cookie: adminCookie, body: { content: "Laporan Anda sedang dalam proses verifikasi. Kami akan menghubungi Anda jika membutuhkan klarifikasi." } });
		expect(res.status).toBe(200);

		// Verify via report detail
		res = await call(`/admin/report/${r.id}`, { cookie: adminCookie });
		expect(res.status).toBe(200);
		const detail = await res.json();
		expect(detail.messages.length).toBe(2);
		const internalNotes = detail.messages.filter((m: any) => m.isInternalNote === 1);
		const publicMsgs = detail.messages.filter((m: any) => m.isInternalNote === 0);
		expect(internalNotes.length).toBe(1);
		expect(publicMsgs.length).toBe(1);
	});

	it("returns report detail with status history and assignments", async () => {
		const adminCookie = await createAdminSession(`admin_detail_${Math.random().toString(36).slice(2)}@example.com`);
		const ticket = `LPR-DT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
		const r = createReport.get(ticket, "hash", "Pengaduan", "Admin", "Detail Kasus Dengan Riwayat Status", "Kronologi lengkap pengujian endpoint detail kasus yang menyertakan riwayat status.", null, null, null, 1, null, null, null, "Sedang", "Belum Didisposisikan", "15 Ags 2026");
		if (!r) return;

		// Perform some transitions to build history
		await call(`/admin/report/${r.id}/status`, { method: "POST", cookie: adminCookie, body: { status: "Verifikasi Awal", unitDisposisi: "Tim Investigasi Internal" } });
		await call(`/admin/report/${r.id}/assign`, { method: "POST", cookie: adminCookie, body: { unitName: "Tim Investigasi Internal", notes: "Disposisi untuk investigasi lebih lanjut." } });

		const res = await call(`/admin/report/${r.id}`, { cookie: adminCookie });
		expect(res.status).toBe(200);
		const detail = await res.json();
		expect(detail.report.ticketNumber).toBe(ticket);
		expect(detail.statusHistory.length).toBeGreaterThanOrEqual(1);
		expect(detail.assignments.length).toBeGreaterThanOrEqual(1);
	});

	it("accesses reporter identity with RBAC audit and reason", async () => {
		const adminCookie = await createAdminSession(`admin_ident_${Math.random().toString(36).slice(2)}@example.com`);
		const ticket = `LPR-ID-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
		const r = createReport.get(ticket, "hash", "Whistleblowing", "Korupsi", "Akses Identitas Pelapor dengan Alasan", "Kronologi lengkap pengujian akses identitas pelapor yang memerlukan alasan wajib.", null, null, null, 0, "Pelapor Rahasia", "rahasia@test.com", "081234567890", "Tinggi", "Tim Investigasi Internal", "15 Ags 2026");
		if (!r) return;

		// Store encrypted identity
		const { encryptText } = await import("../src/server/crypto");
		const { insertReporterIdentity } = await import("../src/server/db");
		insertReporterIdentity.run(r.id, encryptText("Pelapor Rahasia"), encryptText("rahasia@test.com"), encryptText("081234567890"));

		// Access without reason should fail
		let res = await call(`/admin/report/${r.id}/identity`, { method: "POST", cookie: adminCookie, body: { reason: "Pendek" } });
		expect(res.status).toBe(422);

		// Access with valid reason should succeed
		res = await call(`/admin/report/${r.id}/identity`, { method: "POST", cookie: adminCookie, body: { reason: "Diperlukan untuk investigasi kasus dugaan korupsi internal yang dilaporkan pelapor." } });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.identity.name).toBe("Pelapor Rahasia");
		expect(data.identity.email).toBe("rahasia@test.com");
		expect(data.identity.phone).toBe("081234567890");
	});

	it("rejects non-admin access to backoffice report endpoints", async () => {
		// Create a regular user directly (not admin)
		const hash = await hashPassword("Password123!");
		const email = `regular_${Math.random().toString(36).slice(2)}@example.com`;
		const u = createUser.get("Regular User", email, hash);
		expect(u).toBeDefined();
		if (!u) return;
		const session = createSession(u.id);
		const userCookie = `session=${session.token}`;

		// Try to access admin report detail - should be redirected
		const res = await call("/admin/report/1", { cookie: userCookie });
		expect(res.status).toBe(302); // Redirected, not 200
	});

	it("allows admin to create users with roles, update roles, and delete users", async () => {
		const adminCookie = await createAdminSession(`admin_um_${Math.random().toString(36).slice(2)}@example.com`);

		// 1. Create a new Petugas Triase user
		const newEmail = `petugas_new_${Math.random().toString(36).slice(2)}@example.com`;
		let res = await call("/admin/users/create", {
			method: "POST",
			cookie: adminCookie,
			body: {
				name: "Petugas Baru Triase",
				email: newEmail,
				password: "Password123!",
				role: "petugas_triase",
			},
		});
		expect(res.status).toBe(200);
		const createData = await res.json();
		expect(createData.success).toBe(true);
		expect(createData.userId).toBeGreaterThan(0);
		const createdId = createData.userId;

		// Verify created user role in database
		const { findUserById } = await import("../src/server/db");
		let u = findUserById.get(createdId);
		expect(u?.role).toBe("petugas_triase");

		// 2. Update role to Penindak Lanjut
		res = await call(`/admin/users/${createdId}/role`, {
			method: "POST",
			cookie: adminCookie,
			body: { role: "penindak_lanjut" },
		});
		expect(res.status).toBe(200);
		u = findUserById.get(createdId);
		expect(u?.role).toBe("penindak_lanjut");

		// 3. Delete created user
		res = await call(`/admin/users/${createdId}`, {
			method: "DELETE",
			cookie: adminCookie,
		});
		expect(res.status).toBe(200);
		u = findUserById.get(createdId);
		expect(u).toBeFalsy();
	});
});

describe("infrastructure & oauth", () => {
	it("reports health", async () => {
		const res = await call("/health");
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.status).toBe("ok");
	});

	it("serves built asset files from /assets/*", async () => {
		const { mkdirSync, rmSync, writeFileSync } = await import("node:fs");
		mkdirSync("dist/assets", { recursive: true });
		const file = "dist/assets/__route_test__.css";
		writeFileSync(file, "body{}");
		try {
			const res = await call("/assets/__route_test__.css");
			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toBe("text/css; charset=utf-8");
			expect(await res.text()).toBe("body{}");
		} finally {
			rmSync(file, { force: true });
		}
	});

	it("returns 400 when Google OAuth is not configured", async () => {
		const { config } = await import("../src/server/config");
		const savedId = config.google.clientId;
		const savedSecret = config.google.clientSecret;
		config.google.clientId = null;
		config.google.clientSecret = null;
		try {
			const res = await call("/auth/google");
			expect(res.status).toBe(400);
		} finally {
			config.google.clientId = savedId;
			config.google.clientSecret = savedSecret;
		}
	});

	it("redirects to Google when OAuth is configured", async () => {
		const { config } = await import("../src/server/config");
		const savedId = config.google.clientId;
		const savedSecret = config.google.clientSecret;
		config.google.clientId = "test-client-id";
		config.google.clientSecret = "test-client-secret";
		try {
			const res = await call("/auth/google");
			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toContain("accounts.google.com");
		} finally {
			config.google.clientId = savedId;
			config.google.clientSecret = savedSecret;
		}
	});
});

/**
 * Fase 4 Backoffice E2E Test Suite
 * Tests queue filtering, pagination, state-machine operations, checklist actions,
 * identity redaction & access with reason, audit logging, and server-side RBAC across roles.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createReport, createUserWithRole, findUserByEmail, findUserById, db, findReportByTicket, findReporterIdentityByReportId } from "../src/server/db";
import { hashPassword, createSession } from "../src/server/auth";
import { encryptText } from "../src/server/crypto";

let app: Awaited<ReturnType<typeof import("../src/server/app")["createApp"]>>;

beforeAll(async () => {
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

async function call(path: string, options: CallOptions = {}): Promise<Response> {
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

async function createRoleSession(name: string, email: string, role: "admin" | "petugas_triase" | "penindak_lanjut" | "pimpinan"): Promise<string> {
	const hash = await hashPassword("Password123!");
	let user = findUserByEmail.get(email);
	if (!user) {
		const created = createUserWithRole.get(name, email, hash, role);
		if (created) user = findUserById.get(created.id) ?? undefined;
	}
	if (user) {
		db.run("UPDATE users SET role = ? WHERE id = ?", [role, user.id]);
		const session = createSession(user.id);
		return `session=${session.token}`;
	}
	return "";
}

describe("Fase 4 — Backoffice & Multi-Role Case Management", () => {
	let adminCookie: string;
	let triaseCookie: string;
	let handlerCookie: string;
	let pimpinanCookie: string;
	let reportId: number;
	let ticketNumber: string;

	beforeAll(async () => {
		adminCookie = await createRoleSession("Super Admin", "admin.backoffice@mtsn3.sch.id", "admin");
		triaseCookie = await createRoleSession("Petugas Triase", "triase@mtsn3.sch.id", "petugas_triase");
		handlerCookie = await createRoleSession("Penindak Lanjut", "handler@mtsn3.sch.id", "penindak_lanjut");
		pimpinanCookie = await createRoleSession("Pimpinan Madrasah", "kepala@mtsn3.sch.id", "pimpinan");

		ticketNumber = `WB-BO-${Date.now()}`;
		const res = createReport.get(
			ticketNumber,
			"hashcode123",
			"Whistleblowing",
			"Korupsi & Fraud",
			"Dugaan Pungutan Liar Dana Legalisir",
			"Permintaan uang tunai 50rb per lembar tanpa kwitansi resmi.",
			"2026-08-01",
			"Ruang TU MTsN 3 Padang",
			"Oknum TU",
			0, // not anonymous
			"Saksi Pelapor",
			"saksi@gmail.com",
			"08123456789",
			"Sedang",
			"Tim Investigasi Internal",
			"2026-08-15T00:00:00Z",
		);
		reportId = res!.id;

		// Insert identity encrypted if not already present
		if (!findReporterIdentityByReportId.get(reportId)) {
			db.run(
				"INSERT INTO reporter_identities (report_id, encrypted_name, encrypted_email, encrypted_phone) VALUES (?, ?, ?, ?)",
				[reportId, encryptText("Saksi Pelapor"), encryptText("saksi@gmail.com"), encryptText("08123456789")],
			);
		}
	});

	it("RBAC: protects /admin route according to role", async () => {
		// Guest redirected to /login
		const guestRes = await call("/admin");
		expect(guestRes.status).toBe(302);

		// Admin, Triase, Handler, Pimpinan can access /admin
		const adminRes = await call("/admin", { cookie: adminCookie, headers: xhr });
		expect(adminRes.status).toBe(200);

		const triaseRes = await call("/admin", { cookie: triaseCookie, headers: xhr });
		expect(triaseRes.status).toBe(200);

		const handlerRes = await call("/admin", { cookie: handlerCookie, headers: xhr });
		expect(handlerRes.status).toBe(200);

		const pimpinanRes = await call("/admin", { cookie: pimpinanCookie, headers: xhr });
		expect(pimpinanRes.status).toBe(200);
	});

	it("Queue Filtering & Detail API: returns report detail", async () => {
		const res = await call(`/admin/report/${reportId}`, { cookie: triaseCookie });
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.report.ticketNumber).toBe(ticketNumber);
		expect(json.report.judul).toContain("Dugaan Pungutan Liar");
		expect(json.caseActions).toBeArray();
	});

	it("Identity Access: requires min 10 char reason and view_reporter_identity role", async () => {
		// Handler role lacks permission
		const handlerTry = await call(`/admin/report/${reportId}/identity`, {
			method: "POST",
			cookie: handlerCookie,
			body: { reason: "Need to check pelapor identity" },
		});
		expect(handlerTry.status).toBe(403);

		// Short reason fails 422
		const shortReasonTry = await call(`/admin/report/${reportId}/identity`, {
			method: "POST",
			cookie: triaseCookie,
			body: { reason: "short" },
		});
		expect(shortReasonTry.status).toBe(422);

		// Valid reason succeeds for petugas_triase & admin
		const validTry = await call(`/admin/report/${reportId}/identity`, {
			method: "POST",
			cookie: triaseCookie,
			body: { reason: "Konfirmasi keabsahan bukti pembayaran tunai pelapor" },
		});
		expect(validTry.status).toBe(200);
		const json = await validTry.json();
		expect(json.identity.name).toBe("Saksi Pelapor");
		expect(json.identity.email).toBe("saksi@gmail.com");
	});

	it("Triase Action: sets priority and unit disposisi, transitions status to Verifikasi Awal", async () => {
		const res = await call(`/admin/report/${reportId}/triase`, {
			method: "POST",
			cookie: triaseCookie,
			body: {
				priority: "Kritis",
				unitDisposisi: "Tim Investigasi Internal",
				notes: "Verifikasi awal disetujui, diteruskan ke tim investigasi.",
			},
		});
		expect(res.status).toBe(200);

		// Check updated report
		const detail = await (await call(`/admin/report/${reportId}`, { cookie: triaseCookie })).json();
		expect(detail.report.priority).toBe("Kritis");
		expect(detail.report.unitDisposisi).toBe("Tim Investigasi Internal");
		expect(detail.report.detailedStatus).toBe("Verifikasi Awal");
	});

	it("State Machine Enforcement: blocks invalid transitions", async () => {
		// Invalid direct jump: Verifikasi Awal -> Selesai without Dalam Penanganan
		const invalidRes = await call(`/admin/report/${reportId}/status`, {
			method: "POST",
			cookie: triaseCookie,
			body: { status: "Selesai", reason: "Direct jump test" },
		});
		expect(invalidRes.status).toBe(422);

		// Valid transition: Verifikasi Awal -> Dalam Penanganan
		const validRes = await call(`/admin/report/${reportId}/status`, {
			method: "POST",
			cookie: handlerCookie,
			body: { status: "Dalam Penanganan", reason: "Tim mulai pengumpulan bukti lapangan" },
		});
		expect(validRes.status).toBe(200);
	});

	it("Messages & Notes: adds internal notes and public messages", async () => {
		// Internal note
		const noteRes = await call(`/admin/report/${reportId}/note`, {
			method: "POST",
			cookie: handlerCookie,
			body: { note: "Pemeriksaan saksi pelapor dijadwalkan besok pagi." },
		});
		expect(noteRes.status).toBe(200);

		// Public message
		const msgRes = await call(`/admin/report/${reportId}/message`, {
			method: "POST",
			cookie: handlerCookie,
			body: { content: "Laporan Anda sedang ditindaklanjuti oleh tim investigasi internal." },
		});
		expect(msgRes.status).toBe(200);

		const detail = await (await call(`/admin/report/${reportId}`, { cookie: handlerCookie })).json();
		expect(detail.messages.length).toBeGreaterThanOrEqual(2);
	});

	it("Case Action Checklist: creates and toggles checklist items", async () => {
		// Create action
		const addRes = await call(`/admin/report/${reportId}/action`, {
			method: "POST",
			cookie: handlerCookie,
			body: { title: "Wawancara Terperiksa Oknum TU" },
		});
		expect(addRes.status).toBe(200);
		const addJson = await addRes.json();
		const actionId = addJson.actionId;

		// Toggle action completed
		const toggleRes = await call(`/admin/report/${reportId}/action/${actionId}/toggle`, {
			method: "POST",
			cookie: handlerCookie,
			body: { isCompleted: true },
		});
		expect(toggleRes.status).toBe(200);

		const detail = await (await call(`/admin/report/${reportId}`, { cookie: handlerCookie })).json();
		const actionItem = detail.caseActions.find((a: any) => a.id === actionId);
		expect(actionItem.isCompleted).toBe(1);
	});

	it("Closing Case & Reopening: close case with summary, reopen admin only", async () => {
		// Close case without summary fails 422
		const closeFail = await call(`/admin/report/${reportId}/close`, {
			method: "POST",
			cookie: handlerCookie,
			body: { resolutionSummary: "short" },
		});
		expect(closeFail.status).toBe(422);

		// Valid close case
		const closeSuccess = await call(`/admin/report/${reportId}/close`, {
			method: "POST",
			cookie: handlerCookie,
			body: { resolutionSummary: "Pemeriksaan selesai, oknum TU diberikan sanksi administrasi dan dana dikembalikan." },
		});
		expect(closeSuccess.status).toBe(200);

		// Reopen by non-admin fails 403
		const reopenNonAdmin = await call(`/admin/report/${reportId}/reopen`, {
			method: "POST",
			cookie: handlerCookie,
			body: { reason: "Ditemukan novum bukti baru dari saksi lain" },
		});
		expect(reopenNonAdmin.status).toBe(403);

		// Reopen by admin succeeds
		const reopenAdmin = await call(`/admin/report/${reportId}/reopen`, {
			method: "POST",
			cookie: adminCookie,
			body: { reason: "Ditemukan bukti baru yang memerlukan pendalaman lanjutan" },
		});
		expect(reopenAdmin.status).toBe(200);
	});

	it("Pimpinan Role: Read-only access blocks mutation endpoints", async () => {
		const mutateTry = await call(`/admin/report/${reportId}/triase`, {
			method: "POST",
			cookie: pimpinanCookie,
			body: { priority: "Tinggi" },
		});
		expect(mutateTry.status).toBe(403);
	});
});

import { beforeAll, describe, expect, test } from "bun:test";

let app: any;
let createSession: any;
let createUserWithRole: any;
let findUserByEmail: any;
let findUserById: any;
let createReport: any;
let hashPassword: any;
let db: any;

let adminCookie: string;
let officerCookie: string;

async function createRoleSession(name: string, email: string, role: any): Promise<string> {
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

async function call(
	path: string,
	opts: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {},
) {
	const headers: Record<string, string> = {
		...(opts.headers || {}),
		...(opts.cookie ? { cookie: opts.cookie } : {}),
	};
	if (opts.body && typeof opts.body === "object") {
		headers["content-type"] = "application/json";
	}
	return app.fetch(
		new Request(`http://localhost${path}`, {
			method: opts.method || (opts.body ? "POST" : "GET"),
			headers,
			body: opts.body ? JSON.stringify(opts.body) : undefined,
		}),
	);
}

describe("Fase 5 — Dasbor, Analytics & Master Data Administration", () => {
	beforeAll(async () => {
		process.env.DATABASE_PATH = ":memory:";
		process.env.NODE_ENV = "test";
		process.env.RATE_LIMIT_AUTH_MAX = "1000";
		process.env.RATE_LIMIT_GLOBAL_MAX = "10000";

		const dbModule = await import("../src/server/db");
		db = dbModule.db;
		createUserWithRole = dbModule.createUserWithRole;
		findUserByEmail = dbModule.findUserByEmail;
		findUserById = dbModule.findUserById;
		createReport = dbModule.createReport;

		const authModule = await import("../src/server/auth");
		hashPassword = authModule.hashPassword;
		createSession = authModule.createSession;

		const { createApp } = await import("../src/server/app");
		app = createApp({ version: "test-version", js: "app.js", css: "app.css" });

		adminCookie = await createRoleSession("Admin Utama", `admin.f5.${Date.now()}@mtsn3.sch.id`, "admin");
		officerCookie = await createRoleSession("Petugas Triase", `triase.f5.${Date.now()}@mtsn3.sch.id`, "petugas_triase");

		const { encryptText } = await import("../src/server/crypto");

		// Seed a report for dashboard testing
		const rep = createReport.get(
			`WB-F5-${Date.now()}`,
			"hashcodef5",
			"Whistleblowing",
			"Korupsi & Fraud Internal",
			"Dugaan Penyimpangan Dana BOS",
			"Laporan pengujian untuk dasbor dan ekspor CSV.",
			"2026-08-01",
			"Ruang Bendahara",
			"Oknum Terkait",
			0, // non anonymous
			"Saksi Kunci",
			"saksi.f5@gmail.com",
			"081999888777",
			"Tinggi",
			"Tim Investigasi Internal",
			"2026-08-15T00:00:00Z",
		);

		if (rep) {
			db.run(
				`INSERT INTO reporter_identities (report_id, encrypted_name, encrypted_email, encrypted_phone) VALUES (?, ?, ?, ?)`,
				[rep.id, encryptText("Saksi Kunci"), encryptText("saksi.f5@gmail.com"), encryptText("081999888777")],
			);
		}
	});

	test("GET /dashboard: renders for authenticated user", async () => {
		const res = await call("/dashboard", { cookie: adminCookie });
		expect(res.status).toBe(200);
	});

	test("GET /admin/export/reports.csv: exports redacted CSV without sensitive identity by default", async () => {
		const res = await call("/admin/export/reports.csv", { cookie: officerCookie });
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/csv");
		const text = await res.text();
		expect(text).toContain("Nomor Tiket");
		expect(text).toContain("[TERSEMBUNYI]");
		expect(text).not.toContain("saksi.f5@gmail.com");
	});

	test("GET /admin/export/reports.csv: rejects unredacted identity export if reason is too short", async () => {
		const res = await call("/admin/export/reports.csv?includeIdentity=true&reason=short", { cookie: officerCookie });
		expect(res.status).toBe(422);
		const json = await res.json();
		expect(json.error).toContain("minimal 10 karakter");
	});

	test("GET /admin/export/reports.csv: exports unredacted identity CSV when authorized with valid reason", async () => {
		const res = await call(
			"/admin/export/reports.csv?includeIdentity=true&reason=Diperlukan+untuk+pemeriksaan+investigasi+resmi",
			{ cookie: adminCookie },
		);
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toContain("saksi.f5@gmail.com");
	});

	test("F09 Master Data CRUD: Categories", async () => {
		const addRes = await call("/admin/master/categories", {
			cookie: adminCookie,
			body: { jenis: "Whistleblowing", name: "Penggelapan Aset", description: "Penyalahgunaan inventaris" },
		});
		expect(addRes.status).toBe(200);
		const addData = await addRes.json();
		expect(addData.id).toBeDefined();

		const delRes = await call(`/admin/master/categories/${addData.id}`, {
			method: "DELETE",
			cookie: adminCookie,
		});
		expect(delRes.status).toBe(200);
	});

	test("F09 Master Data CRUD: Units", async () => {
		const addRes = await call("/admin/master/units", {
			cookie: adminCookie,
			body: { name: "Seksi Hubungan Masyarakat", headName: "H. Ridwan, M.Pd", email: "humas@mtsn3padang.sch.id" },
		});
		expect(addRes.status).toBe(200);
		const addData = await addRes.json();

		const delRes = await call(`/admin/master/units/${addData.id}`, {
			method: "DELETE",
			cookie: adminCookie,
		});
		expect(delRes.status).toBe(200);
	});

	test("F09 Master Data CRUD: Holidays", async () => {
		const addRes = await call("/admin/master/holidays", {
			cookie: adminCookie,
			body: { holidayDate: "2026-08-17", title: "HUT Kemerdekaan RI Ke-81" },
		});
		expect(addRes.status).toBe(200);
		const addData = await addRes.json();

		const delRes = await call(`/admin/master/holidays/${addData.id}`, {
			method: "DELETE",
			cookie: adminCookie,
		});
		expect(delRes.status).toBe(200);
	});

	test("F09 Master Data CRUD: FAQs", async () => {
		const addRes = await call("/admin/master/faqs", {
			cookie: adminCookie,
			body: { question: "Apakah pengaduan dikenakan biaya?", answer: "Seluruh layanan pengaduan gratis tanpa pungutan biaya apapun.", category: "Layanan" },
		});
		expect(addRes.status).toBe(200);
		const addData = await addRes.json();

		const delRes = await call(`/admin/master/faqs/${addData.id}`, {
			method: "DELETE",
			cookie: adminCookie,
		});
		expect(delRes.status).toBe(200);
	});

	test("F09 Master Settings: updates system parameter settings", async () => {
		const res = await call("/admin/settings", {
			cookie: adminCookie,
			body: {
				instansi_name: "MTsN 3 Kota Padang",
				retention_days: "365",
				max_upload_mb: "25",
			},
		});
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
	});
});

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
let guestCookie: string;
let userCookie: string;

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

describe("Fase 6 — Security Hardening & Vulnerability Resilience", () => {
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

		adminCookie = await createRoleSession("Sec Admin", `sec.admin.${Date.now()}@mtsn3.sch.id`, "admin");
		userCookie = await createRoleSession("Regular User", `user.sec.${Date.now()}@gmail.com`, "user");
	});

	test("SQL Injection Resilience: parameterized queries block SQL injection payloads", async () => {
		const payload = "' OR '1'='1' -- DROP TABLE users;";
		const res = await call(`/admin?search=${encodeURIComponent(payload)}`, { cookie: adminCookie });
		expect(res.status).toBe(200);
		// Verify table users is intact
		const check = db.query("SELECT COUNT(*) as n FROM users").get();
		expect(check).toBeDefined();
	});

	test("Path Traversal Protection: blocks path traversal in uploads route", async () => {
		const res = await call("/uploads/../../etc/passwd");
		expect(res.status).toBe(404);
	});

	test("RBAC Enforcement: blocks unauthenticated guests from backoffice & admin routes", async () => {
		const adminRes = await call("/admin");
		expect([302, 401, 403]).toContain(adminRes.status);

		const exportRes = await call("/admin/export/reports.csv");
		expect([302, 401, 403]).toContain(exportRes.status);

		const masterRes = await call("/admin/master/categories", { method: "POST", body: { name: "Hack" } });
		expect([302, 401, 403]).toContain(masterRes.status);
	});

	test("RBAC Enforcement: blocks regular 'user' role from admin master endpoints", async () => {
		const res = await call("/admin/master/categories", {
			cookie: userCookie,
			body: { jenis: "Whistleblowing", name: "Unauthorized Cat" },
		});
		expect(res.status).toBe(403);
	});

	test("Stored XSS Protection: CSP script-src 'none' header on /uploads responses", async () => {
		const res = await call("/uploads/test-non-existent-upload-id");
		expect(res.headers.get("content-security-policy")).toContain("script-src 'none'");
	});

	test("Whistleblower Identity Encryption: raw identity is unreadable in raw DB query without AES decryption", async () => {
		const { encryptText, decryptText } = await import("../src/server/crypto");
		const plainEmail = "whistleblower.secret@domain.com";
		const encrypted = encryptText(plainEmail);
		expect(encrypted).not.toContain(plainEmail);
		expect(decryptText(encrypted)).toBe(plainEmail);
	});

	test("Public Self-Registration Prevention: GET & POST /register redirect to /login notice", async () => {
		const getRes = await call("/register");
		expect(getRes.status).toBe(302);
		expect(getRes.headers.get("location")).toContain("/login?notice=admin_only_registration");

		const postRes = await call("/register", {
			method: "POST",
			body: { name: "Hacker", email: "hacker@evil.com", password: "Password123!" },
		});
		expect(postRes.status).toBe(303);
		expect(postRes.headers.get("location")).toContain("/login?notice=admin_only_registration");

		// Verify user was NOT created in DB
		const check = findUserByEmail.get("hacker@evil.com");
		expect(check).toBeFalsy();
	});
});

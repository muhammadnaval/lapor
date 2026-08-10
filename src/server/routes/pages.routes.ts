/**
 * Page routes: the Inertia app-shell pages (/, /dashboard, /admin).
 * Feature pages get their own `<feature>.routes.ts` -- see AGENTS.md
 * "Route conventions".
 */
import type { Context } from "hono";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../auth";
import {
	countUsers,
	listUsers,
	listUsersFiltered,
	recentUsers,
	toPublicUser,
	findUserByEmail,
	findUserById,
	createUserWithRole,
	updateUserRole,
	deleteUser,
	listAllReports,
	updateReportStatusAndUnit,
	updateReportDetailedStatus,
	updateReportPriority,
	insertReportMessage,
	listReportMessages,
	insertAuditLog,
	setSystemSetting,
	listAllSystemSettings,
	listRecentAuditLogs,
	listAuditLogsFiltered,
	findReportById,
	countReports,
	listStatusHistory,
	listAssignments,
	insertAssignment,
	listReportAttachments,
	findReporterIdentityByReportId,
	listCaseActions,
	insertCaseAction,
	toggleCaseAction,
	deleteCaseAction,
	listCategories,
	insertCategory,
	deleteCategory,
	listUnits,
	insertUnit,
	deleteUnit,
	listHolidays,
	insertHoliday,
	deleteHoliday,
	listFaqs,
	listActiveFaqs,
	insertFaq,
	deleteFaq,
	listContacts,
	insertContact,
	deleteContact,
	getDashboardAggregateMetrics,
	getSlaPerformanceMetrics,
	getCategoryBreakdownStats,
	getUnitBreakdownStats,
	getReportsForExport,
	db,
} from "../db";
import type { AppEnv } from "../inertia-middleware";
import type { DashboardStats, Paginated, Role, User } from "../../shared/types";
import { isReportAnonymous } from "../../shared/types";
import { validateStatusTransition, recordStatusTransition, toDbStatus, normalizeStatus } from "../state-machine";
import { getDynamicPeriodOptions } from "../../shared/date";
import { canViewReporterIdentity, logReporterIdentityAccess, logAuditEvent } from "../audit";
import { decryptText } from "../crypto";

function getSystemSettingsMap(): Record<string, string> {
	const defaults: Record<string, string> = {
		kopInstansiUtama: "KEMENTERIAN AGAMA REPUBLIK INDONESIA",
		kopInstansiDaerah: "KANTOR KEMENTERIAN AGAMA KOTA PADANG",
		kopNamaMadrasah: "MADRASAH TSANAWIYAH NEGERI 3 KOTA PADANG",
		kopAlamatLengkap: "Jl. Gunung Juaro, Surau Gadang, Kec. Nanggalo, Kota Padang, Sumatera Barat 25146",
		sigLeftTitle: "Mengetahui/Menyetujui,",
		sigLeftJabatan: "Kepala MTsN 3 Kota Padang",
		sigLeftNama: "Nurhidayati, S.T., M.Pd.",
		sigLeftNip: "NIP. 197508122005012004",
		sigRightKota: "Padang",
		sigRightJabatan: "Petugas Penanggung Jawab / Triase",
	};
	try {
		const rows = listAllSystemSettings.all();
		for (const r of rows) {
			if (r.value) defaults[r.key] = r.value;
		}
	} catch {
		// Fall back to defaults
	}
	return defaults;
}

async function getBodyData(c: Context): Promise<Record<string, unknown>> {
	const contentType = c.req.header("content-type") || "";
	if (contentType.includes("application/json")) {
		return (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
	}
	return (await c.req.parseBody().catch(() => ({}))) as Record<string, unknown>;
}

function dashboardStats(): DashboardStats {
	return {
		userCount: countUsers.get()?.n ?? 0,
		recentUsers: recentUsers.all(5).map(toPublicUser),
	};
}

// Runtime paginated/filtered report listing (db.ts only has static prepared
// statements; dynamic WHERE clauses are built here from query params).
function listReportsFiltered(opts: {
	page: number;
	perPage: number;
	search?: string;
	status?: string;
	jenis?: string;
	priority?: string;
}) {
	const conditions: string[] = [];
	const params: (string | number)[] = [];

	if (opts.search) {
		conditions.push("(ticket_number LIKE ? OR judul LIKE ? OR reporter_name LIKE ?)");
		const like = `%${opts.search}%`;
		params.push(like, like, like);
	}
	if (opts.status && opts.status !== "semua") {
		const s = opts.status.trim();
		const sLower = s.toLowerCase();
		if (sLower === "terkirim") {
			conditions.push("(detailed_status = 'Terkirim' OR status = 'terkirim')");
		} else if (sLower === "verifikasi awal") {
			conditions.push("detailed_status = 'Verifikasi Awal'");
		} else if (sLower === "verifikasi") {
			conditions.push("(status = 'verifikasi' OR detailed_status IN ('Verifikasi Awal', 'Perlu Informasi'))");
		} else if (sLower === "perlu informasi") {
			conditions.push("detailed_status = 'Perlu Informasi'");
		} else if (sLower === "diteruskan") {
			conditions.push("detailed_status = 'Diteruskan'");
		} else if (sLower === "dalam penanganan") {
			conditions.push("detailed_status = 'Dalam Penanganan'");
		} else if (sLower === "proses") {
			conditions.push("(status = 'proses' OR detailed_status IN ('Dalam Penanganan', 'Diteruskan', 'Dialihkan', 'Dibuka Kembali'))");
		} else if (sLower === "selesai") {
			conditions.push("detailed_status = 'Selesai'");
		} else if (sLower === "ditutup") {
			conditions.push("detailed_status = 'Ditutup'");
		} else if (sLower === "ditolak") {
			conditions.push("detailed_status = 'Ditolak'");
		} else if (sLower === "dialihkan") {
			conditions.push("detailed_status = 'Dialihkan'");
		} else if (sLower === "duplikat") {
			conditions.push("detailed_status = 'Duplikat'");
		} else if (sLower === "dibuka kembali") {
			conditions.push("detailed_status = 'Dibuka Kembali'");
		} else {
			conditions.push("(detailed_status = ? OR status = ?)");
			params.push(s, sLower);
		}
	}
	if (opts.jenis && opts.jenis !== "semua") {
		conditions.push("LOWER(jenis) = LOWER(?)");
		params.push(opts.jenis);
	}
	if (opts.priority && opts.priority !== "semua") {
		conditions.push("priority = ?");
		params.push(opts.priority);
	}

	const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

	const countSql = `SELECT COUNT(*) AS n FROM reports ${where}`;
	const total = (db.query(countSql).get(...params) as { n: number } | null)?.n ?? 0;

	const offset = (opts.page - 1) * opts.perPage;
	const dataSql = `SELECT
		id, ticket_number AS ticketNumber, secret_code_hash AS secretCodeHash,
		jenis, kategori, judul, kronologi, tanggal_kejadian AS tanggalKejadian,
		lokasi_kejadian AS lokasiKejadian, pihak_terkait AS pihakTerkait,
		is_anonymous AS isAnonymous, reporter_name AS reporterName,
		reporter_email AS reporterEmail, reporter_phone AS reporterPhone,
		status, detailed_status AS detailedStatus,
		priority, priority_level AS priorityLevel,
		unit_disposisi AS unitDisposisi, sla_target AS slaTarget,
		created_at AS createdAt, updated_at AS updatedAt
	FROM reports ${where}
	ORDER BY priority_level ASC, id DESC
	LIMIT ? OFFSET ?`;

	const dataParams = [...params, opts.perPage, offset];
	const data = db.query(dataSql).all(...dataParams);

	return {
		data,
		meta: {
			currentPage: opts.page,
			perPage: opts.perPage,
			lastPage: Math.max(1, Math.ceil(total / opts.perPage)),
			total,
		},
	};
}

function priorityToLevel(p: string): number {
	if (p === "Kritis") return 1;
	if (p === "Tinggi") return 2;
	if (p === "Sedang") return 3;
	if (p === "Rendah") return 4;
	return 3;
}

export const pageRoutes = () => {
	const app = new Hono<AppEnv>();

	app.get("/", (c) => {
		const aggregateMetrics = getDashboardAggregateMetrics();
		const slaMetrics = getSlaPerformanceMetrics();
		const categoryBreakdown = getCategoryBreakdownStats();
		const unitBreakdown = getUnitBreakdownStats();

		return c.var.inertia.render("Home", {
			aggregateMetrics,
			slaMetrics,
			categoryBreakdown,
			unitBreakdown,
		});
	});

	app.get("/dashboard", requireAuth, (c) => {
		const periodKey = c.req.query("period") || "bulan-ini";
		const periodOptions = getDynamicPeriodOptions();
		const selectedPeriod = periodOptions.find((p) => p.key === periodKey) || periodOptions[0];

		const aggregateMetrics = getDashboardAggregateMetrics(selectedPeriod?.dateFrom, selectedPeriod?.dateTo);
		const slaMetrics = getSlaPerformanceMetrics(selectedPeriod?.dateFrom, selectedPeriod?.dateTo);
		const categoryBreakdown = getCategoryBreakdownStats(selectedPeriod?.dateFrom, selectedPeriod?.dateTo);
		const unitBreakdown = getUnitBreakdownStats(selectedPeriod?.dateFrom, selectedPeriod?.dateTo);
		const categories = listCategories.all();
		const units = listUnits.all();
		const faqs = listActiveFaqs.all();

		return c.var.inertia.render("Dashboard", {
			stats: dashboardStats(),
			aggregateMetrics,
			slaMetrics,
			categoryBreakdown,
			unitBreakdown,
			categories,
			units,
			faqs,
			periodOptions,
			selectedPeriodKey: selectedPeriod ? selectedPeriod.key : "bulan-ini",
			selectedPeriodLabel: selectedPeriod ? selectedPeriod.label : "Bulan Ini",
			systemSettings: getSystemSettingsMap(),
		});
	});

	// -----------------------------------------------------------------------
	// Admin: Report Queue with pagination, search, filter & Master Settings
	// -----------------------------------------------------------------------
	app.get("/admin", requireRole("admin", "petugas_triase", "penindak_lanjut", "pimpinan"), (c) => {
		const page = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
		const perPage = Math.min(
			100,
			Math.max(1, Number(c.req.query("perPage") ?? 20) || 20),
		);
		const search = c.req.query("search") || "";
		const statusQ = c.req.query("status") || "semua";
		const jenisQ = c.req.query("jenis") || "semua";
		const priorityQ = c.req.query("priority") || "semua";

		const userSearch = c.req.query("userSearch") || "";
		const userRoleQ = c.req.query("userRole") || "semua";
		const userPage = Math.max(1, Number(c.req.query("userPage") ?? 1) || 1);
		const userPerPage = Math.min(
			100,
			Math.max(1, Number(c.req.query("userPerPage") ?? 10) || 10),
		);

		const users = listUsersFiltered({
			page: userPage,
			perPage: userPerPage,
			search: userSearch || undefined,
			role: userRoleQ,
		});

		const dbReports = listReportsFiltered({
			page,
			perPage,
			search: search || undefined,
			status: statusQ,
			jenis: jenisQ,
			priority: priorityQ,
		});

		const auditSearch = c.req.query("auditSearch") || "";
		const auditPage = Math.max(1, Number(c.req.query("auditPage") ?? 1) || 1);
		const auditPerPage = Math.min(
			100,
			Math.max(1, Number(c.req.query("auditPerPage") ?? 15) || 15),
		);

		const auditLogs = listAuditLogsFiltered({
			page: auditPage,
			perPage: auditPerPage,
			search: auditSearch || undefined,
		});

		const categories = listCategories.all();
		const units = listUnits.all();
		const holidays = listHolidays.all();
		const faqs = listFaqs.all();
		const contacts = listContacts.all();

		return c.var.inertia.render("Admin", {
			users,
			dbReports,
			auditLogs,
			categories,
			units,
			holidays,
			faqs,
			contacts,
			systemSettings: getSystemSettingsMap(),
			userFilters: { search: userSearch, role: userRoleQ },
			auditFilters: { search: auditSearch },
			filters: { search, status: statusQ, jenis: jenisQ, priority: priorityQ },
		});
	});

	// -----------------------------------------------------------------------
	// Admin: Authorized CSV Export (Redacts sensitive whistleblower data by default)
	// -----------------------------------------------------------------------
	app.get("/admin/export/reports.csv", requireRole("admin", "petugas_triase", "penindak_lanjut", "pimpinan"), async (c) => {
		const search = c.req.query("search") || undefined;
		const status = c.req.query("status") || undefined;
		const jenis = c.req.query("jenis") || undefined;
		const priority = c.req.query("priority") || undefined;
		const dateFrom = c.req.query("dateFrom") || undefined;
		const dateTo = c.req.query("dateTo") || undefined;
		const reason = (c.req.query("reason") || "").trim();
		const includeIdentity = c.req.query("includeIdentity") === "true";

		let canViewIdent = false;
		if (includeIdentity) {
			if (reason.length < 10) {
				return c.json({ error: "Alasan minimal 10 karakter wajib disertakan untuk ekspor identitas pelapor." }, 422);
			}
			if (!c.var.user || !canViewReporterIdentity(c.var.user.role)) {
				return c.json({ error: "Anda tidak memiliki izin untuk meng-ekspor identitas pelapor." }, 403);
			}
			canViewIdent = true;

			logAuditEvent({
				userId: c.var.user.id,
				actorName: c.var.user.name,
				action: "Ekspor Berkas CSV (Identitas Unredacted)",
				target: "Export Reports CSV",
				ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
				detail: `Ekspor CSV dengan data identitas pelapor. Alasan: ${reason}`,
			});
		} else {
			logAuditEvent({
				userId: c.var.user?.id,
				actorName: c.var.user?.name || "Petugas",
				action: "Ekspor Berkas CSV (Agregat Non-Sensitif)",
				target: "Export Reports CSV",
				ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
				detail: `Ekspor CSV data laporan non-sensitif (identitas tersamarkan).`,
			});
		}

		const reports = getReportsForExport({
			search,
			status,
			jenis,
			priority,
			dateFrom,
			dateTo,
			includeIdentity: canViewIdent,
		});

		const headers = [
			"Nomor Tiket",
			"Jenis Laporan",
			"Kategori",
			"Judul Laporan",
			"Status Kasus",
			"Prioritas",
			"Unit Disposisi",
			"Sifat Pelapor",
			"Nama Pelapor",
			"Email Pelapor",
			"Tanggal Dibuat",
			"Target SLA",
		];

		const csvRows = [headers.map((h) => `"${h}"`).join(",")];

		for (const r of reports) {
			const row = [
				`"${r.ticketNumber}"`,
				`"${r.jenis}"`,
				`"${r.kategori}"`,
				`"${r.judul.replace(/"/g, '""')}"`,
				`"${r.status}"`,
				`"${r.priority}"`,
				`"${r.unitDisposisi}"`,
				`"${r.isAnonymous ? "Anonim" : "Teridentifikasi"}"`,
				`"${r.reporterName}"`,
				`"${r.reporterEmail}"`,
				`"${r.createdAt}"`,
				`"${r.slaTarget}"`,
			];
			csvRows.push(row.join(","));
		}

		const csvContent = "\uFEFF" + csvRows.join("\n");
		return c.body(csvContent, 200, {
			"content-type": "text/csv; charset=utf-8",
			"content-disposition": `attachment; filename="Rekapitulasi_Laporan_${new Date().toISOString().slice(0, 10)}.csv"`,
		});
	});

	// -----------------------------------------------------------------------
	// Admin: Report Detail (JSON API for drawer/modal)
	// -----------------------------------------------------------------------
	app.get("/admin/report/:id", requireRole("admin", "petugas_triase", "penindak_lanjut", "pimpinan"), (c) => {
		const reportId = Number(c.req.param("id"));
		const report = findReportById.get(reportId);
		if (!report) return c.json({ error: "Laporan tidak ditemukan." }, 404);

		const messages = listReportMessages.all(reportId);
		const statusHistory = listStatusHistory.all(reportId);
		const attachments = listReportAttachments.all(reportId);
		const assignments = listAssignments.all(reportId);
		const caseActions = listCaseActions.all(reportId);

		return c.json({
			report,
			messages,
			statusHistory,
			attachments,
			assignments,
			caseActions,
		});
	});

	// -----------------------------------------------------------------------
	// Admin: View reporter identity (RBAC + audit + reason required)
	// -----------------------------------------------------------------------
	app.post("/admin/report/:id/identity", requireRole("admin", "petugas_triase"), async (c) => {
		const reportId = Number(c.req.param("id"));
		const body = await getBodyData(c);
		const reason = ((body["reason"] as string) || "").trim();

		if (reason.length < 10) {
			return c.json({ error: "Alasan wajib diisi minimal 10 karakter untuk mengakses identitas pelapor." }, 422);
		}

		const user = c.var.user;
		if (!user || !canViewReporterIdentity(user.role)) {
			return c.json({ error: `Peran '${user?.role || "guest"}' tidak memiliki izin untuk mengakses identitas pelapor.` }, 403);
		}

		const report = findReportById.get(reportId);
		if (!report) return c.json({ error: "Laporan tidak ditemukan." }, 404);

		if (isReportAnonymous(report.isAnonymous)) {
			return c.json({ error: "Laporan ini dikirim secara ANONIM. Identitas pelapor tidak disimpan sistem demi perlindungan whistleblower." }, 400);
		}

		const identity = findReporterIdentityByReportId.get(reportId);
		if (!identity) {
			return c.json({ error: "Identitas pelapor tidak ditemukan di basis data." }, 404);
		}

		// Audit the access
		logReporterIdentityAccess(
			reportId,
			user.id,
			user.name,
			reason,
			c.req.header("x-forwarded-for") || "127.0.0.1",
		);

		return c.json({
			identity: {
				name: identity.encryptedName ? decryptText(identity.encryptedName) : null,
				email: identity.encryptedEmail ? decryptText(identity.encryptedEmail) : null,
				phone: identity.encryptedPhone ? decryptText(identity.encryptedPhone) : null,
			},
		});
	});

	// -----------------------------------------------------------------------
	// Admin: Triase report (initial verification, set priority, assign unit)
	// -----------------------------------------------------------------------
	app.post("/admin/report/:id/triase", requireRole("admin", "petugas_triase"), async (c) => {
		const reportId = Number(c.req.param("id"));
		const body = await getBodyData(c);
		const priority = (body["priority"] as string) || "";
		const unitName = ((body["unitDisposisi"] as string) || "").trim();
		const notes = ((body["notes"] as string) || "").trim();

		const report = findReportById.get(reportId);
		if (!report) return c.json({ error: "Laporan tidak ditemukan." }, 404);

		const currentStatus = report.detailedStatus || report.status;
		let nextStatus = currentStatus;
		if (normalizeStatus(currentStatus) === "Terkirim") {
			nextStatus = "Verifikasi Awal";
			recordStatusTransition(
				reportId,
				currentStatus,
				nextStatus,
				c.var.user?.id || null,
				c.var.user?.name || "Petugas Triase",
				notes || "Laporan diverifikasi oleh Petugas Triase.",
				c.req.header("x-forwarded-for") || "127.0.0.1",
			);
		}

		if (priority && ["Kritis", "Tinggi", "Sedang", "Rendah"].includes(priority)) {
			updateReportPriority.run(priority, priorityToLevel(priority), reportId);
		}

		if (unitName) {
			updateReportStatusAndUnit.run(toDbStatus(nextStatus), unitName, reportId);
			insertAssignment.run(reportId, c.var.user?.id || null, unitName, null, notes || null);
		}

		logAuditEvent({
			userId: c.var.user?.id,
			actorName: c.var.user?.name || "Petugas Triase",
			action: "Triase Laporan",
			target: `Report #${reportId}`,
			ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
			detail: `Laporan berhasil ditriase. Prioritas: ${priority || report.priority}, Unit: ${unitName || report.unitDisposisi}.`,
		});

		return c.json({ success: true, status: nextStatus });
	});

	// -----------------------------------------------------------------------
	// Admin: Change report status (state machine enforced)
	// -----------------------------------------------------------------------
	app.post("/admin/report/:id/status", requireRole("admin", "petugas_triase", "penindak_lanjut"), async (c) => {
		const reportId = Number(c.req.param("id"));
		const body = await getBodyData(c);
		const newStatus = (body["status"] as string) || "";
		const newUnit = (body["unitDisposisi"] as string) || "";
		const reason = ((body["reason"] as string) || "").trim();

		const report = findReportById.get(reportId);
		if (!report) return c.json({ error: "Laporan tidak ditemukan." }, 404);

		const transitionCheck = validateStatusTransition(
			report.detailedStatus || report.status,
			newStatus,
			c.var.user?.role || "user",
			reason,
		);
		if (!transitionCheck.valid) {
			return c.json({ error: transitionCheck.error }, 422);
		}

		const normalized = normalizeStatus(newStatus);
		const dbStatus = toDbStatus(newStatus);

		recordStatusTransition(
			reportId,
			report.detailedStatus || report.status,
			newStatus,
			c.var.user?.id || null,
			c.var.user?.name || "Petugas Backoffice",
			reason || null,
			c.req.header("x-forwarded-for") || "127.0.0.1",
		);

		if (newUnit) {
			updateReportStatusAndUnit.run(dbStatus, newUnit, reportId);
		}

		// For Diteruskan, create assignment record
		if (normalized === "Diteruskan" && newUnit) {
			insertAssignment.run(reportId, c.var.user?.id || null, newUnit, null, reason || null);
		}

		return c.json({ success: true });
	});

	// Backward compat: old route
	app.post("/admin/report/status", requireRole("admin", "petugas_triase", "penindak_lanjut"), async (c) => {
		const body = await getBodyData(c);
		const reportId = Number(body["reportId"]);
		const newStatus = ((body["status"] as string) || "proses");
		const newUnit = ((body["unitDisposisi"] as string) || "Tim Investigasi Internal");
		const reason = ((body["reason"] as string) || "").trim();

		if (reportId) {
			const report = findReportById.get(reportId);
			if (report) {
				const transitionCheck = validateStatusTransition(
					report.detailedStatus || report.status,
					newStatus,
					c.var.user?.role || "user",
					reason,
				);
				if (!transitionCheck.valid) {
					return c.json({ error: transitionCheck.error }, 422);
				}

				recordStatusTransition(
					reportId,
					report.detailedStatus || report.status,
					newStatus,
					c.var.user?.id || null,
					c.var.user?.name || "Petugas Backoffice",
					reason || null,
					c.req.header("x-forwarded-for") || "127.0.0.1",
				);

				updateReportStatusAndUnit.run(toDbStatus(newStatus), newUnit, reportId);
			}
		}

		return c.json({ success: true });
	});

	// -----------------------------------------------------------------------
	// Admin: Forward / Redirect report to another unit or external agency
	// -----------------------------------------------------------------------
	app.post("/admin/report/:id/forward", requireRole("admin", "petugas_triase"), async (c) => {
		const reportId = Number(c.req.param("id"));
		const body = await getBodyData(c);
		const targetUnit = ((body["unitDisposisi"] || body["targetUnit"] || "") as string).trim();
		const reason = ((body["reason"] as string) || "").trim();

		if (!targetUnit) return c.json({ error: "Unit tujuan pengalihan wajib diisi." }, 422);
		if (reason.length < 10) return c.json({ error: "Alasan pengalihan wajib diisi minimal 10 karakter." }, 422);

		const report = findReportById.get(reportId);
		if (!report) return c.json({ error: "Laporan tidak ditemukan." }, 404);

		const transitionCheck = validateStatusTransition(
			report.detailedStatus || report.status,
			"Dialihkan",
			c.var.user?.role || "user",
			reason,
		);
		if (!transitionCheck.valid) return c.json({ error: transitionCheck.error }, 422);

		recordStatusTransition(
			reportId,
			report.detailedStatus || report.status,
			"Dialihkan",
			c.var.user?.id || null,
			c.var.user?.name || "Petugas Triase",
			`Dialihkan ke ${targetUnit}. Alasan: ${reason}`,
			c.req.header("x-forwarded-for") || "127.0.0.1",
		);

		updateReportStatusAndUnit.run(toDbStatus("Dialihkan"), targetUnit, reportId);
		insertAssignment.run(reportId, c.var.user?.id || null, targetUnit, null, reason);

		return c.json({ success: true });
	});

	// -----------------------------------------------------------------------
	// Admin: Reject report with reason
	// -----------------------------------------------------------------------
	app.post("/admin/report/:id/reject", requireRole("admin", "petugas_triase"), async (c) => {
		const reportId = Number(c.req.param("id"));
		const body = await getBodyData(c);
		const reason = ((body["reason"] as string) || "").trim();

		if (reason.length < 10) return c.json({ error: "Alasan penolakan wajib diisi minimal 10 karakter." }, 422);

		const report = findReportById.get(reportId);
		if (!report) return c.json({ error: "Laporan tidak ditemukan." }, 404);

		const transitionCheck = validateStatusTransition(
			report.detailedStatus || report.status,
			"Ditolak",
			c.var.user?.role || "user",
			reason,
		);
		if (!transitionCheck.valid) return c.json({ error: transitionCheck.error }, 422);

		recordStatusTransition(
			reportId,
			report.detailedStatus || report.status,
			"Ditolak",
			c.var.user?.id || null,
			c.var.user?.name || "Petugas Triase",
			reason,
			c.req.header("x-forwarded-for") || "127.0.0.1",
		);

		return c.json({ success: true });
	});

	// -----------------------------------------------------------------------
	// Admin: Mark report as duplicate
	// -----------------------------------------------------------------------
	app.post("/admin/report/:id/duplicate", requireRole("admin", "petugas_triase"), async (c) => {
		const reportId = Number(c.req.param("id"));
		const body = await getBodyData(c);
		const duplicateTicket = ((body["duplicateTicket"] as string) || "").trim();
		const reason = ((body["reason"] as string) || "").trim();

		if (!duplicateTicket) return c.json({ error: "Nomor tiket acuan duplikat wajib diisi." }, 422);
		if (reason.length < 10) return c.json({ error: "Alasan penandaan duplikat wajib diisi minimal 10 karakter." }, 422);

		const report = findReportById.get(reportId);
		if (!report) return c.json({ error: "Laporan tidak ditemukan." }, 404);

		const transitionCheck = validateStatusTransition(
			report.detailedStatus || report.status,
			"Duplikat",
			c.var.user?.role || "user",
			reason,
		);
		if (!transitionCheck.valid) return c.json({ error: transitionCheck.error }, 422);

		recordStatusTransition(
			reportId,
			report.detailedStatus || report.status,
			"Duplikat",
			c.var.user?.id || null,
			c.var.user?.name || "Petugas Triase",
			`Duplikat dari tiket #${duplicateTicket}. Alasan: ${reason}`,
			c.req.header("x-forwarded-for") || "127.0.0.1",
		);

		return c.json({ success: true });
	});

	// -----------------------------------------------------------------------
	// Admin: Close report with resolution summary
	// -----------------------------------------------------------------------
	app.post("/admin/report/:id/close", requireRole("admin", "petugas_triase", "penindak_lanjut"), async (c) => {
		const reportId = Number(c.req.param("id"));
		const body = await getBodyData(c);
		const resolutionSummary = ((body["resolutionSummary"] as string) || (body["reason"] as string) || "").trim();

		if (resolutionSummary.length < 10) {
			return c.json({ error: "Ringkasan hasil penanganan wajib diisi minimal 10 karakter untuk penutupan kasus." }, 422);
		}

		const report = findReportById.get(reportId);
		if (!report) return c.json({ error: "Laporan tidak ditemukan." }, 404);

		const transitionCheck = validateStatusTransition(
			report.detailedStatus || report.status,
			"Ditutup",
			c.var.user?.role || "user",
			resolutionSummary,
		);
		if (!transitionCheck.valid) return c.json({ error: transitionCheck.error }, 422);

		recordStatusTransition(
			reportId,
			report.detailedStatus || report.status,
			"Ditutup",
			c.var.user?.id || null,
			c.var.user?.name || "Penindak Lanjut",
			resolutionSummary,
			c.req.header("x-forwarded-for") || "127.0.0.1",
		);

		// Record internal note with resolution summary
		insertReportMessage.run(
			reportId,
			"petugas",
			c.var.user?.name || "Penindak Lanjut",
			`[Ringkasan Penutupan Kasus] ${resolutionSummary}`,
			1,
		);

		return c.json({ success: true });
	});

	// -----------------------------------------------------------------------
	// Admin: Reopen closed report (Admin only)
	// -----------------------------------------------------------------------
	app.post("/admin/report/:id/reopen", requireRole("admin"), async (c) => {
		const reportId = Number(c.req.param("id"));
		const body = await getBodyData(c);
		const reason = ((body["reason"] as string) || "").trim();

		if (reason.length < 10) return c.json({ error: "Alasan pembukaan kembali kasus wajib diisi minimal 10 karakter." }, 422);

		const report = findReportById.get(reportId);
		if (!report) return c.json({ error: "Laporan tidak ditemukan." }, 404);

		const transitionCheck = validateStatusTransition(
			report.detailedStatus || report.status,
			"Dibuka Kembali",
			c.var.user?.role || "admin",
			reason,
		);
		if (!transitionCheck.valid) return c.json({ error: transitionCheck.error }, 422);

		recordStatusTransition(
			reportId,
			report.detailedStatus || report.status,
			"Dibuka Kembali",
			c.var.user?.id || null,
			c.var.user?.name || "Admin",
			reason,
			c.req.header("x-forwarded-for") || "127.0.0.1",
		);

		return c.json({ success: true });
	});

	// -----------------------------------------------------------------------
	// Admin: Change report priority
	// -----------------------------------------------------------------------
	app.post("/admin/report/:id/priority", requireRole("admin", "petugas_triase"), async (c) => {
		const reportId = Number(c.req.param("id"));
		const body = await getBodyData(c);
		const newPriority = (body["priority"] as string) || "";

		if (!["Kritis", "Tinggi", "Sedang", "Rendah"].includes(newPriority)) {
			return c.json({ error: "Nilai prioritas tidak valid." }, 422);
		}

		const report = findReportById.get(reportId);
		if (!report) return c.json({ error: "Laporan tidak ditemukan." }, 404);

		updateReportPriority.run(newPriority, priorityToLevel(newPriority), reportId);

		logAuditEvent({
			userId: c.var.user?.id,
			actorName: c.var.user?.name || "Petugas Triase",
			action: "Perubahan Prioritas Laporan",
			target: `Report #${reportId}`,
			ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
			detail: `Prioritas diubah dari '${report.priority}' menjadi '${newPriority}'.`,
		});

		return c.json({ success: true });
	});

	// -----------------------------------------------------------------------
	// Admin: Assign report to unit/user
	// -----------------------------------------------------------------------
	app.post("/admin/report/:id/assign", requireRole("admin", "petugas_triase"), async (c) => {
		const reportId = Number(c.req.param("id"));
		const body = await getBodyData(c);
		const unitName = ((body["unitName"] as string) || "").trim();
		const deadline = ((body["deadline"] as string) || "").trim() || null;
		const notes = ((body["notes"] as string) || "").trim() || null;

		if (!unitName) return c.json({ error: "Nama unit disposisi wajib diisi." }, 422);

		const report = findReportById.get(reportId);
		if (!report) return c.json({ error: "Laporan tidak ditemukan." }, 404);

		insertAssignment.run(reportId, c.var.user?.id || null, unitName, deadline, notes);

		// Also update unit_disposisi on the report
		updateReportStatusAndUnit.run(report.status, unitName, reportId);

		logAuditEvent({
			userId: c.var.user?.id,
			actorName: c.var.user?.name || "Petugas Triase",
			action: "Penugasan Unit Disposisi",
			target: `Report #${reportId}`,
			ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
			detail: `Didisposisikan ke unit '${unitName}'.`,
		});

		return c.json({ success: true });
	});

	// -----------------------------------------------------------------------
	// Admin: Add internal note
	// -----------------------------------------------------------------------
	app.post("/admin/report/:id/note", requireRole("admin", "petugas_triase", "penindak_lanjut"), async (c) => {
		const reportId = Number(c.req.param("id"));
		const body = await getBodyData(c);
		const note = ((body["note"] as string) || "").trim();

		if (!note) return c.json({ error: "Catatan internal tidak boleh kosong." }, 422);

		insertReportMessage.run(
			reportId,
			"petugas",
			c.var.user?.name || "Petugas Backoffice",
			note,
			1, // isInternalNote = true
		);

		logAuditEvent({
			userId: c.var.user?.id,
			actorName: c.var.user?.name || "Petugas Backoffice",
			action: "Tambah Catatan Internal",
			target: `Report #${reportId}`,
			ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
			detail: `Catatan internal ditambahkan (${note.length} karakter).`,
		});

		return c.json({ success: true });
	});

	// Backward compat: old route
	app.post("/admin/report/note", requireRole("admin", "petugas_triase", "penindak_lanjut"), async (c) => {
		const body = await getBodyData(c);
		const reportId = Number(body["reportId"]);
		const note = ((body["note"] as string) || "").trim();

		if (reportId && note) {
			insertReportMessage.run(
				reportId,
				"petugas",
				c.var.user?.name || "Petugas Backoffice",
				note,
				1,
			);
		}

		return c.json({ success: true });
	});

	// -----------------------------------------------------------------------
	// Admin: Add public message to reporter
	// -----------------------------------------------------------------------
	app.post("/admin/report/:id/message", requireRole("admin", "petugas_triase", "penindak_lanjut"), async (c) => {
		const reportId = Number(c.req.param("id"));
		const body = await getBodyData(c);
		const msg = ((body["content"] as string) || "").trim();

		if (!msg) return c.json({ error: "Pesan tidak boleh kosong." }, 422);

		insertReportMessage.run(
			reportId,
			"petugas",
			c.var.user?.name || "Petugas Backoffice",
			msg,
			0, // isInternalNote = false
		);

		logAuditEvent({
			userId: c.var.user?.id,
			actorName: c.var.user?.name || "Petugas Backoffice",
			action: "Kirim Pesan ke Pelapor",
			target: `Report #${reportId}`,
			ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
			detail: `Pesan resmi dikirim ke pelapor (${msg.length} karakter).`,
		});

		return c.json({ success: true });
	});

	// Backward compat: old route
	app.post("/admin/report/public-msg", requireRole("admin", "petugas_triase", "penindak_lanjut"), async (c) => {
		const body = await getBodyData(c);
		const reportId = Number(body["reportId"]);
		const msg = ((body["content"] as string) || "").trim();

		if (reportId && msg) {
			insertReportMessage.run(
				reportId,
				"petugas",
				c.var.user?.name || "Petugas Backoffice",
				msg,
				0,
			);
		}

		return c.json({ success: true });
	});

	// -----------------------------------------------------------------------
	// Admin: Case Actions (Checklist Items)
	// -----------------------------------------------------------------------
	app.post("/admin/report/:id/action", requireRole("admin", "penindak_lanjut"), async (c) => {
		const reportId = Number(c.req.param("id"));
		const body = await getBodyData(c);
		const title = ((body["title"] as string) || "").trim();

		if (!title) return c.json({ error: "Judul tindakan tidak boleh kosong." }, 422);

		const report = findReportById.get(reportId);
		if (!report) return c.json({ error: "Laporan tidak ditemukan." }, 404);

		const res = insertCaseAction.get(reportId, title);

		logAuditEvent({
			userId: c.var.user?.id,
			actorName: c.var.user?.name || "Penindak Lanjut",
			action: "Tambah Checklist Tindakan",
			target: `Report #${reportId}`,
			ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
			detail: `Tindakan '${title}' ditambahkan ke checklist kasus.`,
		});

		return c.json({ success: true, actionId: res?.id });
	});

	app.post("/admin/report/:id/action/:actionId/toggle", requireRole("admin", "penindak_lanjut"), async (c) => {
		const reportId = Number(c.req.param("id"));
		const actionId = Number(c.req.param("actionId"));
		const body = await getBodyData(c);
		const isCompleted = body["isCompleted"] ? 1 : 0;

		const completedAt = isCompleted ? new Date().toISOString() : null;
		const completedBy = isCompleted ? c.var.user?.id || null : null;

		toggleCaseAction.run(isCompleted, completedBy, completedAt, actionId);

		logAuditEvent({
			userId: c.var.user?.id,
			actorName: c.var.user?.name || "Penindak Lanjut",
			action: "Update Checklist Tindakan",
			target: `Report #${reportId}`,
			ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
			detail: `Tindakan #${actionId} diubah status penyelesaiannya menjadi: ${isCompleted ? "Selesai" : "Belum Selesai"}.`,
		});

		return c.json({ success: true });
	});

	// -----------------------------------------------------------------------
	// Admin: Master Data Management (F09)
	// -----------------------------------------------------------------------
	app.post("/admin/master/categories", requireRole("admin"), async (c) => {
		const body = await getBodyData(c);
		const jenis = ((body["jenis"] as string) || "Pengaduan").trim();
		const name = ((body["name"] as string) || "").trim();
		const description = ((body["description"] as string) || "").trim();

		if (!name) return c.json({ error: "Nama kategori wajib diisi." }, 422);

		const code = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30);
		const res = insertCategory.get(code, jenis, name, description || null);
		logAuditEvent({
			userId: c.var.user?.id,
			actorName: c.var.user?.name || "Admin",
			action: "Tambah Master Kategori",
			target: `Category #${res?.id}`,
			ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
			detail: `Kategori '${name}' (${jenis}) ditambahkan.`,
		});
		return c.json({ success: true, id: res?.id });
	});

	app.delete("/admin/master/categories/:id", requireRole("admin"), (c) => {
		const id = Number(c.req.param("id"));
		deleteCategory.run(id);
		logAuditEvent({
			userId: c.var.user?.id,
			actorName: c.var.user?.name || "Admin",
			action: "Hapus Master Kategori",
			target: `Category #${id}`,
			ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
			detail: `Master Kategori #${id} dihapus.`,
		});
		return c.json({ success: true });
	});

	app.post("/admin/master/units", requireRole("admin"), async (c) => {
		const body = await getBodyData(c);
		const name = ((body["name"] as string) || "").trim();
		const headName = ((body["headName"] as string) || "").trim();
		const email = ((body["email"] as string) || "").trim();

		if (!name || !headName || !email) return c.json({ error: "Nama unit, penanggung jawab, dan email wajib diisi." }, 422);

		const res = insertUnit.get(name, headName, email);
		logAuditEvent({
			userId: c.var.user?.id,
			actorName: c.var.user?.name || "Admin",
			action: "Tambah Master Unit Kerja",
			target: `Unit #${res?.id}`,
			ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
			detail: `Unit '${name}' (Kepala: ${headName}) ditambahkan.`,
		});
		return c.json({ success: true, id: res?.id });
	});

	app.delete("/admin/master/units/:id", requireRole("admin"), (c) => {
		const id = Number(c.req.param("id"));
		deleteUnit.run(id);
		logAuditEvent({
			userId: c.var.user?.id,
			actorName: c.var.user?.name || "Admin",
			action: "Hapus Master Unit Kerja",
			target: `Unit #${id}`,
			ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
			detail: `Master Unit #${id} dihapus.`,
		});
		return c.json({ success: true });
	});

	app.post("/admin/master/holidays", requireRole("admin"), async (c) => {
		const body = await getBodyData(c);
		const holidayDate = ((body["holidayDate"] as string) || "").trim();
		const title = ((body["title"] as string) || "").trim();

		if (!holidayDate || !title) return c.json({ error: "Tanggal dan keterangan hari libur wajib diisi." }, 422);

		const res = insertHoliday.get(holidayDate, title);
		logAuditEvent({
			userId: c.var.user?.id,
			actorName: c.var.user?.name || "Admin",
			action: "Tambah Hari Libur Nasional",
			target: `Holiday #${res?.id}`,
			ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
			detail: `Hari libur '${title}' (${holidayDate}) ditambahkan.`,
		});
		return c.json({ success: true, id: res?.id });
	});

	app.delete("/admin/master/holidays/:id", requireRole("admin"), (c) => {
		const id = Number(c.req.param("id"));
		deleteHoliday.run(id);
		logAuditEvent({
			userId: c.var.user?.id,
			actorName: c.var.user?.name || "Admin",
			action: "Hapus Hari Libur",
			target: `Holiday #${id}`,
			ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
			detail: `Hari Libur #${id} dihapus.`,
		});
		return c.json({ success: true });
	});

	app.post("/admin/master/faqs", requireRole("admin"), async (c) => {
		const body = await getBodyData(c);
		const question = ((body["question"] as string) || "").trim();
		const answer = ((body["answer"] as string) || "").trim();
		const category = ((body["category"] as string) || "Umum").trim();

		if (!question || !answer) return c.json({ error: "Pertanyaan dan jawaban FAQ wajib diisi." }, 422);

		const res = insertFaq.get(question, answer, category);
		logAuditEvent({
			userId: c.var.user?.id,
			actorName: c.var.user?.name || "Admin",
			action: "Tambah FAQ Publik",
			target: `FAQ #${res?.id}`,
			ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
			detail: `FAQ '${question}' ditambahkan.`,
		});
		return c.json({ success: true, id: res?.id });
	});

	app.delete("/admin/master/faqs/:id", requireRole("admin"), (c) => {
		const id = Number(c.req.param("id"));
		deleteFaq.run(id);
		logAuditEvent({
			userId: c.var.user?.id,
			actorName: c.var.user?.name || "Admin",
			action: "Hapus FAQ Publik",
			target: `FAQ #${id}`,
			ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
			detail: `FAQ #${id} dihapus.`,
		});
		return c.json({ success: true });
	});

	app.post("/admin/master/contacts", requireRole("admin"), async (c) => {
		const body = await getBodyData(c);
		const name = ((body["name"] as string) || "").trim();
		const type = ((body["type"] as string) || "telepon").trim();
		const value = ((body["value"] as string) || "").trim();

		if (!name || !value) return c.json({ error: "Nama kontak dan nilainya wajib diisi." }, 422);

		const res = insertContact.get(name, type, value);
		logAuditEvent({
			userId: c.var.user?.id,
			actorName: c.var.user?.name || "Admin",
			action: "Tambah Kontak Instansi",
			target: `Contact #${res?.id}`,
			ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
			detail: `Kontak '${name}' (${type}: ${value}) ditambahkan.`,
		});
		return c.json({ success: true, id: res?.id });
	});

	app.delete("/admin/master/contacts/:id", requireRole("admin"), (c) => {
		const id = Number(c.req.param("id"));
		deleteContact.run(id);
		logAuditEvent({
			userId: c.var.user?.id,
			actorName: c.var.user?.name || "Admin",
			action: "Hapus Kontak Instansi",
			target: `Contact #${id}`,
			ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
			detail: `Kontak #${id} dihapus.`,
		});
		return c.json({ success: true });
	});

	// -----------------------------------------------------------------------
	// Admin: System settings
	// -----------------------------------------------------------------------
	app.post("/admin/settings", requireRole("admin"), async (c) => {
		const body = await getBodyData(c);
		for (const [key, val] of Object.entries(body)) {
			if (typeof val === "string") {
				setSystemSetting.run(key, val);
			}
		}
		insertAuditLog.run(
			c.var.user?.id || null,
			c.var.user?.name || "Admin",
			"Pembaruan Pengaturan Instansi",
			"Master Settings",
			c.req.header("x-forwarded-for") || "127.0.0.1",
			"Pengaturan identitas instansi / SLA master berhasil diperbarui.",
		);
		return c.json({ success: true });
	});

	// -----------------------------------------------------------------------
	// Admin: User & Role Management (F09 / Admin Management)
	// -----------------------------------------------------------------------
	app.post("/admin/users/create", requireRole("admin"), async (c) => {
		const body = await getBodyData(c);
		const name = ((body["name"] as string) || "").trim();
		const email = ((body["email"] as string) || "").trim().toLowerCase();
		const password = (body["password"] as string) || "";
		const role = ((body["role"] as string) || "user") as Role;

		const validRoles: Role[] = ["user", "admin", "petugas_triase", "penindak_lanjut", "pimpinan"];
		if (!validRoles.includes(role)) {
			return c.json({ error: "Peran pengguna tidak valid." }, 422);
		}

		if (!name || name.length < 2) {
			return c.json({ error: "Nama pengguna wajib diisi minimal 2 karakter." }, 422);
		}

		if (!email || !email.includes("@")) {
			return c.json({ error: "Alamat email tidak valid." }, 422);
		}

		if (!password || password.length < 6) {
			return c.json({ error: "Kata sandi wajib diisi minimal 6 karakter." }, 422);
		}

		const existing = findUserByEmail.get(email);
		if (existing) {
			return c.json({ error: "Alamat email sudah terdaftar di sistem." }, 422);
		}

		const passwordHash = await Bun.password.hash(password, { algorithm: "argon2id" });
		const res = createUserWithRole.get(name, email, passwordHash, role);

		logAuditEvent({
			userId: c.var.user?.id,
			actorName: c.var.user?.name || "Admin",
			action: "Tambah Pengguna / Petugas Baru",
			target: `User #${res?.id}`,
			ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
			detail: `Pengguna '${name}' (${email}) dibuat dengan peran '${role}'.`,
		});

		return c.json({ success: true, userId: res?.id });
	});

	app.post("/admin/users/:id/role", requireRole("admin"), async (c) => {
		const targetUserId = Number(c.req.param("id"));
		const body = await getBodyData(c);
		const role = ((body["role"] as string) || "").trim() as Role;

		const validRoles: Role[] = ["user", "admin", "petugas_triase", "penindak_lanjut", "pimpinan"];
		if (!validRoles.includes(role)) {
			return c.json({ error: "Peran pengguna tidak valid." }, 422);
		}

		const user = findUserById.get(targetUserId);
		if (!user) {
			return c.json({ error: "Pengguna tidak ditemukan." }, 404);
		}

		if (c.var.user?.id === targetUserId && role !== "admin") {
			return c.json({ error: "Anda tidak dapat menurunkan peran admin milik Anda sendiri." }, 422);
		}

		updateUserRole.run(role, targetUserId);

		logAuditEvent({
			userId: c.var.user?.id,
			actorName: c.var.user?.name || "Admin",
			action: "Ubah Peran / Hak Akses Pengguna",
			target: `User #${targetUserId}`,
			ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
			detail: `Peran '${user.name}' (${user.email}) diubah dari '${user.role}' menjadi '${role}'.`,
		});

		return c.json({ success: true });
	});

	app.delete("/admin/users/:id", requireRole("admin"), async (c) => {
		const targetUserId = Number(c.req.param("id"));

		const user = findUserById.get(targetUserId);
		if (!user) {
			return c.json({ error: "Pengguna tidak ditemukan." }, 404);
		}

		if (c.var.user?.id === targetUserId) {
			return c.json({ error: "Anda tidak dapat menghapus akun Anda sendiri." }, 422);
		}

		deleteUser.run(targetUserId);

		logAuditEvent({
			userId: c.var.user?.id,
			actorName: c.var.user?.name || "Admin",
			action: "Hapus Akun Pengguna",
			target: `User #${targetUserId}`,
			ipAddress: c.req.header("x-forwarded-for") || "127.0.0.1",
			detail: `Pengguna '${user.name}' (${user.email}) telah dihapus dari sistem.`,
		});

		return c.json({ success: true });
	});

	return app;
};

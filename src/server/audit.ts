/**
 * Centralized Audit Log & Security Access Service.
 * Specified in lapor.prd Section 5 & Fase 1.
 */
import { insertAuditLog, db } from "./db";
import type { Role } from "../shared/types";

export interface LogAuditOptions {
	userId?: number | null;
	actorName: string;
	action: string;
	target?: string | null;
	ipAddress?: string;
	detail?: string | null;
}

export function logAuditEvent({
	userId = null,
	actorName,
	action,
	target = null,
	ipAddress = "127.0.0.1",
	detail = null,
}: LogAuditOptions): void {
	insertAuditLog.run(userId, actorName, action, target, ipAddress, detail);
}

const insertAccessLog = db.query<
	null,
	[number, number, string, string, string, string]
>(
	`INSERT INTO report_access_logs (report_id, user_id, actor_name, permission, reason, ip_address) VALUES (?, ?, ?, ?, ?, ?)`,
);

export function canViewReporterIdentity(userRole: Role): boolean {
	// Only admin and triase officer roles have permission 'view_reporter_identity'
	return userRole === "admin" || userRole === "petugas_triase";
}

export function logReporterIdentityAccess(
	reportId: number,
	userId: number,
	actorName: string,
	reason: string,
	ipAddress: string = "127.0.0.1",
): void {
	insertAccessLog.run(reportId, userId, actorName, "view_reporter_identity", reason, ipAddress);
	logAuditEvent({
		userId,
		actorName,
		action: "Akses Identitas Pelapor (RBAC)",
		target: `Report #${reportId}`,
		ipAddress,
		detail: `Izin khusus 'view_reporter_identity' digunakan dengan alasan: ${reason}`,
	});
}

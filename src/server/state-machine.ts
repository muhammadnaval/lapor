/**
 * State machine validator & transition recorder for report statuses.
 * Specified in lapor.prd & Implementation Plan.
 */
import { db, insertAuditLog, updateReportDetailedStatus } from "./db";
import type { Role } from "../shared/types";

export type ReportStatus =
	| "Terkirim"
	| "Verifikasi Awal"
	| "Perlu Informasi"
	| "Ditolak"
	| "Diteruskan"
	| "Dalam Penanganan"
	| "Selesai"
	| "Ditutup"
	| "Dibuka Kembali"
	| "Dialihkan"
	| "Duplikat";

export interface TransitionCheckResult {
	valid: boolean;
	error?: string;
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
	Terkirim: ["Verifikasi Awal", "Ditolak", "Duplikat", "Ditutup", "Dialihkan"],
	"Verifikasi Awal": ["Perlu Informasi", "Diteruskan", "Dalam Penanganan", "Ditolak", "Duplikat", "Ditutup", "Dialihkan"],
	"Perlu Informasi": ["Verifikasi Awal", "Dalam Penanganan", "Ditolak", "Ditutup", "Dialihkan"],
	Diteruskan: ["Dalam Penanganan", "Dialihkan", "Ditutup"],
	"Dalam Penanganan": ["Selesai", "Ditutup", "Dialihkan", "Perlu Informasi"],
	Selesai: ["Ditutup", "Dibuka Kembali"],
	Ditutup: ["Dibuka Kembali"],
	"Dibuka Kembali": ["Dalam Penanganan", "Verifikasi Awal"],
	Dialihkan: ["Dalam Penanganan", "Verifikasi Awal", "Ditutup"],
	Ditolak: ["Ditutup", "Dibuka Kembali"],
	Duplikat: ["Ditutup", "Dibuka Kembali"],
};

export function normalizeStatus(s: string): string {
	const lower = (s || "").toLowerCase().trim();
	if (lower === "terkirim") return "Terkirim";
	if (lower === "verifikasi" || lower === "verifikasi awal") return "Verifikasi Awal";
	if (lower === "perlu informasi") return "Perlu Informasi";
	if (lower === "ditolak") return "Ditolak";
	if (lower === "diteruskan") return "Diteruskan";
	if (lower === "proses" || lower === "dalam penanganan") return "Dalam Penanganan";
	if (lower === "selesai") return "Selesai";
	if (lower === "ditutup") return "Ditutup";
	if (lower === "dibuka kembali") return "Dibuka Kembali";
	if (lower === "dialihkan") return "Dialihkan";
	if (lower === "duplikat") return "Duplikat";
	return s;
}

export function toDbStatus(s: string): string {
	const norm = normalizeStatus(s);
	if (norm === "Terkirim") return "terkirim";
	if (norm === "Verifikasi Awal" || norm === "Perlu Informasi") return "verifikasi";
	if (norm === "Diteruskan" || norm === "Dalam Penanganan" || norm === "Dialihkan" || norm === "Dibuka Kembali") return "proses";
	if (norm === "Selesai" || norm === "Ditutup") return "selesai";
	if (norm === "Ditolak" || norm === "Duplikat") return "ditolak";
	return norm.toLowerCase();
}

export function validateStatusTransition(
	rawFromStatus: string,
	rawToStatus: string,
	userRole: Role,
	reason?: string,
): TransitionCheckResult {
	const fromStatus = normalizeStatus(rawFromStatus);
	const toStatus = normalizeStatus(rawToStatus);

	if (fromStatus === toStatus) {
		return { valid: true };
	}

	const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
	if (!allowed.includes(toStatus)) {
		return {
			valid: false,
			error: `Transisi status dari '${fromStatus}' ke '${toStatus}' tidak diizinkan oleh sistem.`,
		};
	}

	// Reason enforcement for sensitive transitions
	if (["Ditolak", "Dialihkan", "Dibuka Kembali"].includes(toStatus)) {
		if (!reason || reason.trim().length < 10) {
			return {
				valid: false,
				error: `Alasan wajib diisi minimal 10 karakter untuk perubahan status ke '${toStatus}'.`,
			};
		}
	}

	// Role permission check
	if (toStatus === "Dibuka Kembali" && userRole !== "admin") {
		return {
			valid: false,
			error: "Hanya Admin yang berhak membuka kembali kasus yang telah ditutup.",
		};
	}

	return { valid: true };
}

const insertStatusHistory = db.query<
	null,
	[number, string, string, number | null, string, string | null]
>(
	`INSERT INTO status_history (report_id, from_status, to_status, actor_user_id, actor_name, reason) VALUES (?, ?, ?, ?, ?, ?)`,
);

const updateReportStatusQuery = db.query<null, [string, number]>(
	`UPDATE reports SET status = ?, updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE id = ?`,
);

export const recordStatusTransition = db.transaction(
	(
		reportId: number,
		rawFromStatus: string,
		rawToStatus: string,
		actorUserId: number | null,
		actorName: string,
		reason: string | null = null,
		ipAddress: string = "127.0.0.1",
	) => {
		const fromStatus = normalizeStatus(rawFromStatus);
		const toStatus = normalizeStatus(rawToStatus);
		const dbStatus = toDbStatus(toStatus);

		updateReportStatusQuery.run(dbStatus, reportId);
		updateReportDetailedStatus.run(toStatus, reportId);
		insertStatusHistory.run(
			reportId,
			fromStatus,
			toStatus,
			actorUserId,
			actorName,
			reason,
		);
		insertAuditLog.run(
			actorUserId,
			actorName,
			"Perubahan Status Laporan",
			`Report #${reportId}`,
			ipAddress,
			`Status diubah dari '${fromStatus}' menjadi '${toStatus}'. Alasan: ${reason || "Tidak ada catatan."}`,
		);
	},
);

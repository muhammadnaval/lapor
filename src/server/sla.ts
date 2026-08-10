/**
 * SLA Deadlines & Escalation Matrix Helper (Asia/Jakarta timezone).
 * Specified in lapor.prd Section 6, 7 & 10.
 */

export type PriorityLevel = "Kritis" | "Tinggi" | "Sedang" | "Rendah";

export interface SlaTarget {
	priority: PriorityLevel;
	initialResponseHours: number;
	resolutionDays: number;
	deadlineIso: string;
	formattedDeadline: string;
}

export const SLA_MATRIX: Record<PriorityLevel, { initialResponseHours: number; resolutionDays: number }> = {
	Kritis: { initialResponseHours: 2, resolutionDays: 1 },
	Tinggi: { initialResponseHours: 24, resolutionDays: 5 },
	Sedang: { initialResponseHours: 48, resolutionDays: 10 },
	Rendah: { initialResponseHours: 72, resolutionDays: 15 },
};

/**
 * Calculate SLA deadline string in Asia/Jakarta timezone.
 */
export function calculateSlaTarget(priority: PriorityLevel, fromDate: Date = new Date()): SlaTarget {
	const config = SLA_MATRIX[priority] || SLA_MATRIX.Sedang;

	// Calculate target date by adding working days (excluding Saturday & Sunday)
	let addedDays = 0;
	const deadline = new Date(fromDate.getTime());

	while (addedDays < config.resolutionDays) {
		deadline.setDate(deadline.getDate() + 1);
		const dayOfWeek = deadline.getDay();
		// Skip weekends (Sunday=0, Saturday=6)
		if (dayOfWeek !== 0 && dayOfWeek !== 6) {
			addedDays++;
		}
	}

	const options: Intl.DateTimeFormatOptions = {
		timeZone: "Asia/Jakarta",
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	};

	const formattedDeadline = new Intl.DateTimeFormat("id-ID", options).format(deadline);

	return {
		priority,
		initialResponseHours: config.initialResponseHours,
		resolutionDays: config.resolutionDays,
		deadlineIso: deadline.toISOString(),
		formattedDeadline,
	};
}

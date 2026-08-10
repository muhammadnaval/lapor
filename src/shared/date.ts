/**
 * Formats an ISO timestamp string or Date object into DD-MM-YYYY HH:MM format.
 * Example: "2026-08-08T14:03:21.046Z" -> "08-08-2026 21:03"
 */
export function formatDateTime(isoStr?: string | Date | null): string {
	if (!isoStr) return "-";
	const d = typeof isoStr === "string" ? new Date(isoStr) : isoStr;
	if (isNaN(d.getTime())) return String(isoStr);

	const pad = (n: number) => String(n).padStart(2, "0");
	const day = pad(d.getDate());
	const month = pad(d.getMonth() + 1);
	const year = d.getFullYear();
	const hours = pad(d.getHours());
	const minutes = pad(d.getMinutes());

	return `${day}-${month}-${year} ${hours}:${minutes}`;
}

/**
 * Formats an ISO timestamp string or Date object into DD-MM-YYYY format.
 * Example: "2026-08-08T14:03:21.046Z" -> "08-08-2026"
 */
export function formatDate(isoStr?: string | Date | null): string {
	if (!isoStr) return "-";
	const d = typeof isoStr === "string" ? new Date(isoStr) : isoStr;
	if (isNaN(d.getTime())) return String(isoStr);

	const pad = (n: number) => String(n).padStart(2, "0");
	const day = pad(d.getDate());
	const month = pad(d.getMonth() + 1);
	const year = d.getFullYear();

	return `${day}-${month}-${year}`;
}

const INDONESIAN_MONTHS = [
	"Januari", "Februari", "Maret", "April", "Mei", "Juni",
	"Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/**
 * Formats an ISO timestamp string or Date object into DD Bulan YYYY format for PDF print outputs.
 * Example: "2026-08-08T14:03:21.046Z" -> "08 Agustus 2026"
 */
export function formatDateIndonesian(isoStr?: string | Date | null): string {
	if (!isoStr) return "-";
	const d = typeof isoStr === "string" ? new Date(isoStr) : isoStr;
	if (isNaN(d.getTime())) return String(isoStr);

	const pad = (n: number) => String(n).padStart(2, "0");
	const day = pad(d.getDate());
	const month = INDONESIAN_MONTHS[d.getMonth()] || "";
	const year = d.getFullYear();

	return `${day} ${month} ${year}`;
}

/**
 * Formats an ISO timestamp string or Date object into DD Bulan YYYY HH:MM format for PDF print outputs.
 * Example: "2026-08-08T14:03:21.046Z" -> "08 Agustus 2026 21:03"
 */
export function formatDateTimeIndonesian(isoStr?: string | Date | null): string {
	if (!isoStr) return "-";
	const d = typeof isoStr === "string" ? new Date(isoStr) : isoStr;
	if (isNaN(d.getTime())) return String(isoStr);

	const pad = (n: number) => String(n).padStart(2, "0");
	const day = pad(d.getDate());
	const month = INDONESIAN_MONTHS[d.getMonth()] || "";
	const year = d.getFullYear();
	const hours = pad(d.getHours());
	const minutes = pad(d.getMinutes());

	return `${day} ${month} ${year} ${hours}:${minutes}`;
}

export interface PeriodOption {
	key: string;
	label: string;
	dateFrom?: string;
	dateTo?: string;
}

export function getDynamicPeriodOptions(now: Date = new Date()): PeriodOption[] {
	const year = now.getFullYear();
	const month = now.getMonth();

	const monthNames = [
		"Januari", "Februari", "Maret", "April", "Mei", "Juni",
		"Juli", "Agustus", "September", "Oktober", "November", "Desember",
	];
	const currentMonthName = monthNames[month] || "Agustus";

	// 1. Bulan Ini
	const firstDayMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0));
	const lastDayMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
	const monthLabel = `Bulan ${currentMonthName} ${year}`;

	// 2. Triwulan Ini
	const quarterIndex = Math.floor(month / 3);
	const romanQuarters = ["I", "II", "III", "IV"];
	const quarterRoman = romanQuarters[quarterIndex] || "I";
	const quarterStartMonth = quarterIndex * 3;
	const firstDayQuarter = new Date(Date.UTC(year, quarterStartMonth, 1, 0, 0, 0));
	const lastDayQuarter = new Date(Date.UTC(year, quarterStartMonth + 3, 0, 23, 59, 59, 999));
	const quarterLabel = `Triwulan ${quarterRoman} ${year}`;

	// 3. Tahun Ajaran Ini (TA starts July 1)
	let taStartYear = year;
	let taEndYear = year + 1;
	if (month < 6) {
		taStartYear = year - 1;
		taEndYear = year;
	}
	const firstDayTA = new Date(Date.UTC(taStartYear, 6, 1, 0, 0, 0));
	const lastDayTA = new Date(Date.UTC(taEndYear, 5, 30, 23, 59, 59, 999));
	const taLabel = `Tahun Ajaran ${taStartYear}/${taEndYear}`;

	// 4. 30 Hari Terakhir
	const d30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

	return [
		{
			key: "bulan-ini",
			label: monthLabel,
			dateFrom: firstDayMonth.toISOString(),
			dateTo: lastDayMonth.toISOString(),
		},
		{
			key: "triwulan-ini",
			label: quarterLabel,
			dateFrom: firstDayQuarter.toISOString(),
			dateTo: lastDayQuarter.toISOString(),
		},
		{
			key: "ta-ini",
			label: taLabel,
			dateFrom: firstDayTA.toISOString(),
			dateTo: lastDayTA.toISOString(),
		},
		{
			key: "30-hari",
			label: "30 Hari Terakhir",
			dateFrom: d30Ago.toISOString(),
			dateTo: now.toISOString(),
		},
		{
			key: "semua",
			label: "Semua Waktu",
		},
	];
}

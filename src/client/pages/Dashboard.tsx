import { Head, Link, router, usePage } from "@inertiajs/react";
import { useState } from "react";
import { createPortal } from "react-dom";
import Layout from "../components/Layout";
import type { DashboardStats } from "../../shared/types";
import "./Dashboard.css";
import { formatDate, formatDateIndonesian, getDynamicPeriodOptions, type PeriodOption } from "../../shared/date";

interface AggregateMetrics {
	total: number;
	terkirim: number;
	verifikasi: number;
	proses: number;
	selesai: number;
	ditolak: number;
	backlog: number;
}

interface SlaMetrics {
	slaComplianceRate: string;
	avgResponseTimeHours: string;
	avgResolutionTimeDays: string;
	totalReports: number;
	onTrack: number;
}

interface CategoryBreakdown {
	jenis: string;
	kategori: string;
	count: number;
	selesai: number;
}

interface UnitBreakdown {
	unitDisposisi: string;
	total: number;
	proses: number;
	selesai: number;
}

interface DashboardProps {
	stats?: DashboardStats;
	aggregateMetrics?: AggregateMetrics;
	slaMetrics?: SlaMetrics;
	categoryBreakdown?: CategoryBreakdown[];
	unitBreakdown?: UnitBreakdown[];
	periodOptions?: PeriodOption[];
	selectedPeriodKey?: string;
	selectedPeriodLabel?: string;
	systemSettings?: Record<string, string>;
}

export default function Dashboard({
	stats,
	aggregateMetrics = { total: 0, terkirim: 0, verifikasi: 0, proses: 0, selesai: 0, ditolak: 0, backlog: 0 },
	slaMetrics = { slaComplianceRate: "100.0%", avgResponseTimeHours: "1.8 Jam", avgResolutionTimeDays: "3.4 Hari", totalReports: 0, onTrack: 0 },
	categoryBreakdown = [],
	unitBreakdown = [],
	periodOptions = getDynamicPeriodOptions(),
	selectedPeriodKey = "bulan-ini",
	selectedPeriodLabel,
	systemSettings = {},
}: DashboardProps) {
	const { props } = usePage();
	const user = props.auth.user;

	const kopInstansiUtama = systemSettings?.kopInstansiUtama || "KEMENTERIAN AGAMA REPUBLIK INDONESIA";
	const kopInstansiDaerah = systemSettings?.kopInstansiDaerah || "KANTOR KEMENTERIAN AGAMA KOTA PADANG";
	const kopNamaMadrasah = systemSettings?.kopNamaMadrasah || "MADRASAH TSANAWIYAH NEGERI 3 KOTA PADANG";
	const kopAlamatLengkap = systemSettings?.kopAlamatLengkap || "Jl. Gunung Juaro, Surau Gadang, Kec. Nanggalo, Kota Padang, Sumatera Barat 25146";
	const sigLeftTitle = systemSettings?.sigLeftTitle || "Mengetahui/Menyetujui,";
	const sigLeftJabatan = systemSettings?.sigLeftJabatan || "Kepala MTsN 3 Kota Padang";
	const sigLeftNama = systemSettings?.sigLeftNama || "Nurhidayati, S.T., M.Pd.";
	const sigLeftNip = systemSettings?.sigLeftNip || "NIP. 197508122005012004";
	const sigRightKota = systemSettings?.sigRightKota || "Padang";
	const sigRightJabatan = systemSettings?.sigRightJabatan || "Petugas Administrator / Analis Sistem";

	const [periodFilter, setPeriodFilter] = useState<string>(selectedPeriodKey);
	const activePeriodLabel = selectedPeriodLabel || periodOptions.find((p) => p.key === periodFilter)?.label || "Bulan Ini";

	const handlePeriodChange = (newKey: string) => {
		setPeriodFilter(newKey);
		router.get("/dashboard", { period: newKey }, { preserveState: true, preserveScroll: true });
	};
	const [unredactedExportReason, setUnredactedExportReason] = useState<string>("");
	const [showUnredactedExportModal, setShowUnredactedExportModal] = useState<boolean>(false);
	const [exportError, setExportError] = useState<string>("");

	if (!user) return null; // guarded server-side by requireAuth

	// Export CSV Handler
	const handleExportCSV = (includeIdentity: boolean = false) => {
		if (includeIdentity && unredactedExportReason.trim().length < 10) {
			setExportError("Alasan wajib diisi minimal 10 karakter untuk meng-ekspor data identitas.");
			return;
		}

		let url = `/admin/export/reports.csv?includeIdentity=${includeIdentity ? "true" : "false"}`;
		if (includeIdentity) {
			url += `&reason=${encodeURIComponent(unredactedExportReason.trim())}`;
		}

		window.open(url, "_blank");
		setShowUnredactedExportModal(false);
		setUnredactedExportReason("");
		setExportError("");
	};

	return (
		<Layout>
			<Head title="Dasbor Statistik & Pelaporan Agregat" />

			<div className="dashboard-wrapper">
				<div className="dashboard-header">
					<div>
						<h1 className="dashboard-title">Dasbor Pelaporan & Indikator Kinerja</h1>
						<p className="dashboard-sub">
							Selamat datang, <strong>{user.name}</strong> ({user.role.toUpperCase().replace("_", " ")}). Pantau statistik agregat, tren backlog, indikator SLA, dan rekapitulasi pelaporan MTsN 3 Kota Padang.
						</p>
					</div>

					<div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
						<span className="sla-badge">✓ Kepatuhan SLA: {slaMetrics.slaComplianceRate}</span>
						<Link href="/admin" className="btn btn-primary">
							📑 Ruang Triase Laporan
						</Link>
					</div>
				</div>

				{/* Export & Filter Control Bar */}
				<div className="export-bar">
					<div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
						<label htmlFor="periodSelect" style={{ fontWeight: 700, fontSize: "0.88rem" }}>
							Filter Periode:
						</label>
						<select
							id="periodSelect"
							className="form-select"
							value={periodFilter}
							onChange={(e) => handlePeriodChange(e.target.value)}
							style={{ maxWidth: "260px" }}
						>
							{periodOptions.map((opt) => (
								<option key={opt.key} value={opt.key}>
									{opt.label}
								</option>
							))}
						</select>
					</div>

					<div className="export-actions">
						<button type="button" className="btn btn-ghost" onClick={() => handleExportCSV(false)}>
							📄 Ekspor Rekapitulasi CSV (Anonim)
						</button>
						{(user.role === "admin" || user.role === "petugas_triase") && (
							<button type="button" className="btn btn-ghost" style={{ color: "var(--primary)" }} onClick={() => setShowUnredactedExportModal(true)}>
								🔓 Ekspor Terotorisasi (Dengan Alasan)
							</button>
						)}
						<button type="button" className="btn btn-ghost" onClick={() => window.print()}>
							🖨️ Cetak Laporan Agregat (PDF)
						</button>
					</div>
				</div>

				{/* Key Performance Indicators (KPIs / SLA Metrics) */}
				<div className="sla-metrics-grid">
					<div className="metric-card">
						<span className="metric-card-title">Rata-rata Waktu Respons Awal</span>
						<span className="metric-card-val">{slaMetrics.avgResponseTimeHours}</span>
						<span className="metric-card-sub">Target Standar SLA: &le; 24 Jam Kerja</span>
					</div>

					<div className="metric-card">
						<span className="metric-card-title">Rata-rata Durasi Penyelesaian</span>
						<span className="metric-card-val">{slaMetrics.avgResolutionTimeDays}</span>
						<span className="metric-card-sub">Target Standar SLA: &le; 5 Hari Kerja</span>
					</div>

					<div className="metric-card">
						<span className="metric-card-title">Tingkat Kepatuhan SLA Total</span>
						<span className="metric-card-val" style={{ color: "#16a34a" }}>
							{slaMetrics.slaComplianceRate}
						</span>
						<span className="metric-card-sub">{slaMetrics.onTrack} dari {slaMetrics.totalReports} Laporan Sesuai SLA</span>
					</div>
				</div>

				{/* Stat Cards Grid */}
				<div className="stats-grid">
					<div className="triage-stat-card">
						<div className="stat-head">
							<span className="stat-title">TOTAL LAPORAN MASUK</span>
							<div className="stat-icon">📊</div>
						</div>
						<div className="stat-num">{aggregateMetrics.total}</div>
						<span className="stat-trend">Terdaftar di sistem</span>
					</div>

					<div className="triage-stat-card">
						<div className="stat-head">
							<span className="stat-title">BACKLOG AKTIF</span>
							<div className="stat-icon">⏳</div>
						</div>
						<div className="stat-num" style={{ color: "#d97706" }}>
							{aggregateMetrics.backlog}
						</div>
						<span className="stat-trend" style={{ color: "#d97706" }}>
							Dalam antrean & proses
						</span>
					</div>

					<div className="triage-stat-card">
						<div className="stat-head">
							<span className="stat-title">DALAM PENANGANAN</span>
							<div className="stat-icon">⚖️</div>
						</div>
						<div className="stat-num" style={{ color: "var(--primary)" }}>
							{aggregateMetrics.proses}
						</div>
						<span className="stat-trend">Sedang ditindaklanjuti</span>
					</div>

					<div className="triage-stat-card">
						<div className="stat-head">
							<span className="stat-title">SELESAI DITANGANI</span>
							<div className="stat-icon">✅</div>
						</div>
						<div className="stat-num" style={{ color: "#16a34a" }}>
							{aggregateMetrics.selesai}
						</div>
						<span className="stat-trend" style={{ color: "#16a34a" }}>
							Kasus terselesaikan
						</span>
					</div>
				</div>

				{/* --- CHART 1: Stacked Multi-Segment Status Distribution Chart --- */}
				<div className="panel-card chart-panel-card">
					<div className="panel-card-head">
						<div>
							<h2 className="panel-card-title">📊 Visual Distribusi Status Laporan</h2>
							<span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Proporsi Tahapan Triase & Penanganan Kasus</span>
						</div>
						<div className="chart-total-badge">
							Total: <strong>{aggregateMetrics.total}</strong> Laporan
						</div>
					</div>

					{/* Stacked Progress Bar */}
					{aggregateMetrics.total > 0 ? (
						<>
							<div className="stacked-bar-container">
								<div
									className="stacked-segment segment-terkirim"
									style={{ width: `${(aggregateMetrics.terkirim / aggregateMetrics.total) * 100}%` }}
									title={`Terkirim: ${aggregateMetrics.terkirim} (${((aggregateMetrics.terkirim / aggregateMetrics.total) * 100).toFixed(1)}%)`}
								/>
								<div
									className="stacked-segment segment-verifikasi"
									style={{ width: `${(aggregateMetrics.verifikasi / aggregateMetrics.total) * 100}%` }}
									title={`Verifikasi: ${aggregateMetrics.verifikasi} (${((aggregateMetrics.verifikasi / aggregateMetrics.total) * 100).toFixed(1)}%)`}
								/>
								<div
									className="stacked-segment segment-proses"
									style={{ width: `${(aggregateMetrics.proses / aggregateMetrics.total) * 100}%` }}
									title={`Dalam Penanganan: ${aggregateMetrics.proses} (${((aggregateMetrics.proses / aggregateMetrics.total) * 100).toFixed(1)}%)`}
								/>
								<div
									className="stacked-segment segment-selesai"
									style={{ width: `${(aggregateMetrics.selesai / aggregateMetrics.total) * 100}%` }}
									title={`Selesai: ${aggregateMetrics.selesai} (${((aggregateMetrics.selesai / aggregateMetrics.total) * 100).toFixed(1)}%)`}
								/>
								<div
									className="stacked-segment segment-ditolak"
									style={{ width: `${(aggregateMetrics.ditolak / aggregateMetrics.total) * 100}%` }}
									title={`Ditolak: ${aggregateMetrics.ditolak} (${((aggregateMetrics.ditolak / aggregateMetrics.total) * 100).toFixed(1)}%)`}
								/>
							</div>

							{/* Status Legend Grid */}
							<div className="chart-legend-grid">
								<div className="legend-item">
									<div className="legend-color-dot dot-terkirim" />
									<div className="legend-info">
										<span className="legend-label">Terkirim</span>
										<span className="legend-val">{aggregateMetrics.terkirim} ({((aggregateMetrics.terkirim / aggregateMetrics.total) * 100).toFixed(0)}%)</span>
									</div>
								</div>
								<div className="legend-item">
									<div className="legend-color-dot dot-verifikasi" />
									<div className="legend-info">
										<span className="legend-label">Verifikasi Awal</span>
										<span className="legend-val">{aggregateMetrics.verifikasi} ({((aggregateMetrics.verifikasi / aggregateMetrics.total) * 100).toFixed(0)}%)</span>
									</div>
								</div>
								<div className="legend-item">
									<div className="legend-color-dot dot-proses" />
									<div className="legend-info">
										<span className="legend-label">Dalam Penanganan</span>
										<span className="legend-val">{aggregateMetrics.proses} ({((aggregateMetrics.proses / aggregateMetrics.total) * 100).toFixed(0)}%)</span>
									</div>
								</div>
								<div className="legend-item">
									<div className="legend-color-dot dot-selesai" />
									<div className="legend-info">
										<span className="legend-label">Selesai Ditangani</span>
										<span className="legend-val">{aggregateMetrics.selesai} ({((aggregateMetrics.selesai / aggregateMetrics.total) * 100).toFixed(0)}%)</span>
									</div>
								</div>
								<div className="legend-item">
									<div className="legend-color-dot dot-ditolak" />
									<div className="legend-info">
										<span className="legend-label">Ditolak / Tidak Valid</span>
										<span className="legend-val">{aggregateMetrics.ditolak} ({((aggregateMetrics.ditolak / aggregateMetrics.total) * 100).toFixed(0)}%)</span>
									</div>
								</div>
							</div>
						</>
					) : (
						<div style={{ textAlign: "center", padding: "1.5rem", color: "var(--muted)", fontStyle: "italic" }}>
							Belum ada data distribusi status laporan.
						</div>
					)}
				</div>

				{/* --- CHART 2 & 3 GRID: Category Horizontal Bar Chart & SLA Compliance Gauge --- */}
				<div className="chart-two-column-grid">
					{/* CHART 2: Visual Horizontal Bar per Kategori */}
					<div className="panel-card">
						<div className="panel-card-head">
							<h2 className="panel-card-title">📈 Visual Rekap Kategori & Jenis Laporan</h2>
							<span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Beban Laporan per Kategori</span>
						</div>

						<div className="horizontal-bar-list">
							{categoryBreakdown.slice(0, 5).map((cat, idx) => {
								const maxCount = Math.max(...categoryBreakdown.map((c) => c.count), 1);
								const pct = Math.min(100, Math.round((cat.count / maxCount) * 100));
								const completionPct = cat.count > 0 ? Math.round((cat.selesai / cat.count) * 100) : 0;

								return (
									<div key={idx} className="horizontal-bar-item">
										<div className="bar-header-row">
											<span className="bar-title">{cat.kategori} ({cat.jenis})</span>
											<span className="bar-count-badge">{cat.count} Laporan ({completionPct}% Selesai)</span>
										</div>
										<div className="bar-track">
											<div className="bar-fill" style={{ width: `${pct}%` }} />
										</div>
									</div>
								);
							})}

							{categoryBreakdown.length === 0 && (
								<div style={{ textAlign: "center", padding: "1.5rem", color: "var(--muted)", fontStyle: "italic" }}>
									Belum ada data rekapitulasi kategori.
								</div>
							)}
						</div>
					</div>

					{/* CHART 3: Visual Gauge Kepatuhan SLA */}
					<div className="panel-card">
						<div className="panel-card-head">
							<h2 className="panel-card-title">🎯 Meter Kepatuhan Target SLA</h2>
							<span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Rata-rata Waktu Operasional</span>
						</div>

						<div className="sla-gauge-wrapper">
							<div className="sla-gauge-circle">
								<svg viewBox="0 0 100 100" className="gauge-svg">
									<circle cx="50" cy="50" r="42" className="gauge-bg" />
									<circle
										cx="50"
										cy="50"
										r="42"
										className="gauge-progress"
										style={{
											strokeDasharray: "264",
											strokeDashoffset: `${264 - (264 * Math.min(100, Number.parseFloat(slaMetrics.slaComplianceRate || "100"))) / 100}`,
										}}
									/>
								</svg>
								<div className="gauge-inner-content">
									<span className="gauge-value">{slaMetrics.slaComplianceRate}</span>
									<span className="gauge-label">Kepatuhan SLA</span>
								</div>
							</div>

							<div className="sla-gauge-stats">
								<div className="gauge-stat-box">
									<span className="stat-box-label">Waktu Respons</span>
									<span className="stat-box-val">{slaMetrics.avgResponseTimeHours}</span>
								</div>
								<div className="gauge-stat-box">
									<span className="stat-box-label">Durasi Selesai</span>
									<span className="stat-box-val">{slaMetrics.avgResolutionTimeDays}</span>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Tabel Rekapitulasi Statistik Agregat per Kategori */}
				<div className="panel-card">
					<div className="panel-card-head">
						<h2 className="panel-card-title">Tabel Rekapitulasi Statistik Agregat</h2>
						<span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Per Kategori & Jenis Laporan</span>
					</div>

					<div style={{ overflowX: "auto" }}>
						<table className="rekap-table">
							<thead>
								<tr>
									<th>Jenis Laporan</th>
									<th>Kategori Laporan</th>
									<th>Total Masuk</th>
									<th>Selesai Ditangani</th>
									<th>Persentase Selesai</th>
								</tr>
							</thead>
							<tbody>
								{categoryBreakdown.map((row, idx) => (
									<tr key={idx}>
										<td style={{ fontWeight: 700 }}>{row.jenis}</td>
										<td style={{ color: "var(--primary)", fontWeight: 600 }}>{row.kategori}</td>
										<td style={{ fontWeight: 700 }}>{row.count}</td>
										<td style={{ color: "#16a34a", fontWeight: 700 }}>{row.selesai}</td>
										<td>
											<span style={{ fontWeight: 700 }}>
												{row.count > 0 ? `${((row.selesai / row.count) * 100).toFixed(0)}%` : "0%"}
											</span>
										</td>
									</tr>
								))}

								{categoryBreakdown.length === 0 && (
									<tr>
										<td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
											Belum ada data statistik kategori.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>

					<div className="export-warning-note">
						ℹ️ <strong>Jaminan Perlindungan Data Whistleblower:</strong> Dasbor dan ekspor rekapitulasi agregat di atas hanya menyajikan angka statistik non-sensitif tanpa pernah menyertakan identitas atau kronologi rahasia pelapor.
					</div>
				</div>

				{/* Unit Performance Breakdown & Quick Actions */}
				<div className="breakdown-grid">
					<div className="panel-card">
						<div className="panel-card-head">
							<h2 className="panel-card-title">Kinerja Disposisi Unit Kerja</h2>
							<span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Beban Kasus per Unit</span>
						</div>

						<div style={{ overflowX: "auto" }}>
							<table className="rekap-table">
								<thead>
									<tr>
										<th>Unit Kerja Disposisi</th>
										<th>Total Kasus</th>
										<th>Proses</th>
										<th>Selesai</th>
									</tr>
								</thead>
								<tbody>
									{unitBreakdown.map((u, idx) => (
										<tr key={idx}>
											<td style={{ fontWeight: 700 }}>{u.unitDisposisi}</td>
											<td style={{ fontWeight: 700 }}>{u.total}</td>
											<td style={{ color: "#d97706" }}>{u.proses}</td>
											<td style={{ color: "#16a34a", fontWeight: 700 }}>{u.selesai}</td>
										</tr>
									))}

									{unitBreakdown.length === 0 && (
										<tr>
											<td colSpan={4} style={{ textAlign: "center", padding: "1.5rem", color: "var(--muted)" }}>
												Belum ada data disposisi unit.
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
					</div>

					<div className="panel-card">
						<div className="panel-card-head">
							<h2 className="panel-card-title">🚀 Navigasi Aksi Cepat</h2>
						</div>

						<div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
							<Link
								href="/admin?tab=triage"
								className="btn btn-ghost"
								style={{ justifyContent: "flex-start", gap: "0.75rem", padding: "0.75rem 1rem", textAlign: "left" }}
							>
								<span style={{ fontSize: "1.2rem" }}>📋</span>
								<div>
									<div style={{ fontWeight: 700, color: "var(--text)" }}>Antrean Triase Laporan</div>
									<div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
										{aggregateMetrics.backlog} kasus butuh tindakan triase
									</div>
								</div>
							</Link>

							<Link
								href="/admin?tab=officers"
								className="btn btn-ghost"
								style={{ justifyContent: "flex-start", gap: "0.75rem", padding: "0.75rem 1rem", textAlign: "left" }}
							>
								<span style={{ fontSize: "1.2rem" }}>👥</span>
								<div>
									<div style={{ fontWeight: 700, color: "var(--text)" }}>Daftar Pengguna & Hak Akses</div>
									<div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
										Kelola akun petugas, admin, & peran
									</div>
								</div>
							</Link>

							<Link
								href="/admin?tab=audit"
								className="btn btn-ghost"
								style={{ justifyContent: "flex-start", gap: "0.75rem", padding: "0.75rem 1rem", textAlign: "left" }}
							>
								<span style={{ fontSize: "1.2rem" }}>📜</span>
								<div>
									<div style={{ fontWeight: 700, color: "var(--text)" }}>Audit Log & Keamanan</div>
									<div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
										Pencatatan aktivitas & pembukaan identitas
									</div>
								</div>
							</Link>

							{user.role === "admin" && (
								<Link
									href="/admin?tab=settings"
									className="btn btn-ghost"
									style={{ justifyContent: "flex-start", gap: "0.75rem", padding: "0.75rem 1rem", textAlign: "left" }}
								>
									<span style={{ fontSize: "1.2rem" }}>⚙️</span>
									<div>
										<div style={{ fontWeight: 700, color: "var(--text)" }}>Master Data, SLA & Kop Surat</div>
										<div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
											Konfigurasi instansi & lembar pengesahan
										</div>
									</div>
								</Link>
							)}
						</div>
					</div>
				</div>

				{/* Modal Authorized Unredacted CSV Export */}
				{showUnredactedExportModal && (
					<div className="modal-center-overlay" onClick={() => setShowUnredactedExportModal(false)}>
						<div className="modal-box" onClick={(e) => e.stopPropagation()}>
							<h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0 0 1rem" }}>
								🔓 Ekspor Terotorisasi CSV (Unredacted)
							</h2>
							<p style={{ fontSize: "0.88rem", color: "var(--muted)", marginBottom: "1rem" }}>
								Sesuai kebijakan perlindungan whistleblower, pengunduhan berkas yang memuat identitas pelapor wajib mencantumkan alasan resmi yang akan dicatat dalam audit log.
							</p>

							{exportError && (
								<div className="notice notice-error" style={{ marginBottom: "1rem" }}>
									{exportError}
								</div>
							)}

							<form onSubmit={(e) => { e.preventDefault(); handleExportCSV(true); }} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
								<div className="form-group">
									<label className="form-label" htmlFor="expReason">
										Alasan Ekspor Berkas Identitas (Min 10 Karakter)
									</label>
									<textarea
										id="expReason"
										className="form-textarea"
										placeholder="Diperlukan untuk berkas berita acara pemeriksaan investigasi internal..."
										value={unredactedExportReason}
										onChange={(e) => setUnredactedExportReason(e.target.value)}
										rows={3}
										required
									/>
								</div>

								<div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
									<button type="button" className="btn btn-ghost" onClick={() => setShowUnredactedExportModal(false)}>
										Batal
									</button>
									<button type="submit" className="btn btn-primary">
										Unduh CSV Unredacted
									</button>
								</div>
							</form>
						</div>
					</div>
				)}

				{/* DEDICATED PRINTABLE AGGREGATE REPORT DOCUMENT (Rendered directly in document.body via Portal) */}
				{typeof document !== "undefined" && createPortal(
					<div id="print-dashboard-section">
						{/* Kop Surat Official Header */}
						<div className="print-kop-header">
							<h3 style={{ margin: 0, fontSize: "11pt", fontWeight: "bold", textTransform: "uppercase" }}>
								{kopInstansiUtama}
							</h3>
							<h4 style={{ margin: "2px 0", fontSize: "10pt", fontWeight: "bold" }}>
								{kopInstansiDaerah}
							</h4>
							<h2 style={{ margin: "4px 0", fontSize: "14pt", fontWeight: "900", color: "#1e3a8a" }}>
								{kopNamaMadrasah}
							</h2>
							<p style={{ margin: 0, fontSize: "8.5pt", color: "#475569" }}>
								{kopAlamatLengkap}
							</p>
						</div>

						<div className="print-double-line" />

						{/* Document Title */}
						<div style={{ textAlign: "center", marginBottom: "15px" }}>
							<h2 style={{ margin: "0 0 4px 0", fontSize: "13pt", fontWeight: "bold", textTransform: "uppercase" }}>
								LAPORAN REKAPITULASI STATISTIK AGREGAT & KINERJA SLA
							</h2>
							<p style={{ margin: 0, fontSize: "9.5pt", color: "#475569" }}>
								Periode Pelaporan: <strong style={{ color: "#000" }}>{activePeriodLabel}</strong> | Dicetak pada: <strong style={{ color: "#000" }}>{formatDateIndonesian(new Date())}</strong>
							</p>
						</div>

						{/* I. Ringkasan Eksekutif & Indikator Kinerja Utama (SLA) */}
						<div className="print-section-title">I. INDIKATOR KINERJA UTAMA & KEPATUHAN SLA</div>
						<table className="print-table-grid">
							<tbody>
								<tr>
									<td style={{ width: "25%", fontWeight: "bold", background: "#f8fafc" }}>Rata-rata Waktu Respons Awal</td>
									<td style={{ width: "25%", fontWeight: "bold" }}>{slaMetrics.avgResponseTimeHours} (Target &le; 24 Jam)</td>
									<td style={{ width: "25%", fontWeight: "bold", background: "#f8fafc" }}>Rata-rata Durasi Penyelesaian</td>
									<td style={{ width: "25%", fontWeight: "bold" }}>{slaMetrics.avgResolutionTimeDays} (Target &le; 5 Hari)</td>
								</tr>
								<tr>
									<td style={{ fontWeight: "bold", background: "#f8fafc" }}>Tingkat Kepatuhan SLA Total</td>
									<td style={{ fontWeight: "bold", color: "#16a34a" }}>{slaMetrics.slaComplianceRate}</td>
									<td style={{ fontWeight: "bold", background: "#f8fafc" }}>Total Laporan Sesuai Target</td>
									<td style={{ fontWeight: "bold" }}>{slaMetrics.onTrack} dari {slaMetrics.totalReports} Laporan</td>
								</tr>
							</tbody>
						</table>

						{/* II. Ringkasan Volume & Status Kasus */}
						<div className="print-section-title">II. REKAPITULASI VOLUME LAPORAN & STATUS PENANGANAN</div>
						<table className="print-table-grid">
							<thead>
								<tr>
									<th style={{ width: "20%" }}>Total Masuk</th>
									<th style={{ width: "20%" }}>Backlog Aktif</th>
									<th style={{ width: "20%" }}>Dalam Penanganan</th>
									<th style={{ width: "20%" }}>Selesai Ditangani</th>
									<th style={{ width: "20%" }}>Ditolak / Lainnya</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td style={{ fontWeight: "bold" }}>{aggregateMetrics.total} Laporan</td>
									<td style={{ fontWeight: "bold", color: "#d97706" }}>{aggregateMetrics.backlog} Laporan</td>
									<td style={{ fontWeight: "bold", color: "#1e3a8a" }}>{aggregateMetrics.proses} Laporan</td>
									<td style={{ fontWeight: "bold", color: "#16a34a" }}>{aggregateMetrics.selesai} Laporan</td>
									<td style={{ fontWeight: "bold" }}>{aggregateMetrics.ditolak} Laporan</td>
								</tr>
							</tbody>
						</table>

						{/* III. Breakdown Rekapitulasi per Kategori Laporan */}
						<div className="print-section-title">III. REKAPITULASI STATISTIK PER KATEGORI & JENIS LAPORAN</div>
						<table className="print-table-grid">
							<thead>
								<tr>
									<th style={{ width: "25%" }}>Jenis Laporan</th>
									<th style={{ width: "35%" }}>Kategori Laporan</th>
									<th style={{ width: "15%" }}>Total Masuk</th>
									<th style={{ width: "15%" }}>Selesai Ditangani</th>
									<th style={{ width: "10%" }}>Persentase</th>
								</tr>
							</thead>
							<tbody>
								{categoryBreakdown.map((row, idx) => (
									<tr key={idx}>
										<td style={{ fontWeight: "bold" }}>{row.jenis}</td>
										<td>{row.kategori}</td>
										<td style={{ fontWeight: "bold" }}>{row.count}</td>
										<td style={{ color: "#16a34a", fontWeight: "bold" }}>{row.selesai}</td>
										<td style={{ fontWeight: "bold" }}>
											{row.count > 0 ? `${((row.selesai / row.count) * 100).toFixed(0)}%` : "0%"}
										</td>
									</tr>
								))}
								{categoryBreakdown.length === 0 && (
									<tr>
										<td colSpan={5} style={{ textAlign: "center", fontStyle: "italic", padding: "12px" }}>
											Belum ada data statistik kategori.
										</td>
									</tr>
								)}
							</tbody>
						</table>

						{/* IV. Breakdown Kinerja Disposisi Unit Kerja */}
						<div className="print-section-title">IV. KINERJA DISPOSISI DAN BEBAN KASUS PER UNIT KERJA</div>
						<table className="print-table-grid">
							<thead>
								<tr>
									<th style={{ width: "40%" }}>Unit Kerja Disposisi</th>
									<th style={{ width: "20%" }}>Total Kasus</th>
									<th style={{ width: "20%" }}>Proses Penanganan</th>
									<th style={{ width: "20%" }}>Kasus Selesai</th>
								</tr>
							</thead>
							<tbody>
								{unitBreakdown.map((u, idx) => (
									<tr key={idx}>
										<td style={{ fontWeight: "bold" }}>{u.unitDisposisi}</td>
										<td style={{ fontWeight: "bold" }}>{u.total}</td>
										<td style={{ color: "#d97706" }}>{u.proses}</td>
										<td style={{ color: "#16a34a", fontWeight: "bold" }}>{u.selesai}</td>
									</tr>
								))}
								{unitBreakdown.length === 0 && (
									<tr>
										<td colSpan={4} style={{ textAlign: "center", fontStyle: "italic", padding: "12px" }}>
											Belum ada data disposisi unit.
										</td>
									</tr>
								)}
							</tbody>
						</table>

						{/* V. Catatan & Lembar Pengesahan */}
						<div className="print-sig-container">
							<div className="print-sig-col">
								<p style={{ margin: 0 }}>{sigLeftTitle}</p>
								<p style={{ margin: "2px 0 0", fontWeight: "bold" }}>{sigLeftJabatan}</p>
								<div className="print-sig-gap" />
								<p style={{ margin: 0, fontWeight: "bold", textDecoration: "underline" }}>{sigLeftNama}</p>
								<p style={{ margin: 0, fontSize: "8.5pt", color: "#475569" }}>{sigLeftNip}</p>
							</div>

							<div className="print-sig-col">
								<p style={{ margin: 0 }}>{sigRightKota}, {formatDateIndonesian(new Date())}</p>
								<p style={{ margin: "2px 0 0", fontWeight: "bold" }}>{sigRightJabatan}</p>
								<div className="print-sig-gap" />
								<p style={{ margin: 0, fontWeight: "bold", textDecoration: "underline" }}>{user.name}</p>
								<p style={{ margin: 0, fontSize: "8.5pt", color: "#475569" }}>
									Peran: {user.role ? user.role.toUpperCase().replace("_", " ") : "ADMINISTRATOR"}
								</p>
							</div>
						</div>
					</div>,
					document.body,
				)}
			</div>
		</Layout>
	);
}

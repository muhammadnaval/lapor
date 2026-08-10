import { Head, Link } from "@inertiajs/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./Home.css";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
	if (typeof document !== "undefined") {
		const attr = document.documentElement.getAttribute("data-theme");
		if (attr === "light" || attr === "dark") return attr;
	}
	if (
		typeof matchMedia !== "undefined" &&
		matchMedia("(prefers-color-scheme: dark)").matches
	) {
		return "dark";
	}
	return "light";
}

const FAQ_ITEMS = [
	{
		q: "Apakah identitas saya benar-benar aman jika memilih pelaporan Anonim?",
		a: "Ya, 100% aman. Pada pilihan pelaporan Anonim, sistem tidak meminta maupun menyimpan data nama, email, nomor HP, atau data pribadi Anda. Data IP perangkat juga tidak diasosiasikan dengan tiket laporan.",
	},
	{
		q: "Bagaimana cara saya memantau perkembangan laporan jika tanpa akun?",
		a: "Setelah pengiriman laporan berhasil, sistem akan memberikan Nomor Laporan unik dan Kode Pelacakan Rahasia (sekali tampil). Anda cukup menyimpan kode tersebut dan memasukkannya di menu 'Lacak Status' kapan saja.",
	},
	{
		q: "Berapa lama laporan saya akan diproses oleh tim madrasah?",
		a: "Laporan Kritis (ancaman/keselamatan) direspons dalam <=2 jam kerja. Laporan Prioritas Tinggi (fraud/perundungan) direspons <=1 hari kerja (target penanganan <=5 hari). Laporan Sedang/Rendah direspons <=2-3 hari kerja.",
	},
	{
		q: "Siapa saja yang dapat membaca isi laporan yang saya kirimkan?",
		a: "Laporan Anda diawasi dan diverifikasi awal oleh Tim Triase Resmi MTsN 3 Kota Padang yang terikat pakta integritas dan kerahasiaan. Untuk kasus Whistleblowing, identitas pelapor hanya dapat dibuka atas otorisasi khusus yang tercatat penuh di log audit.",
	},
	{
		q: "Apa yang harus saya lakukan jika Kode Pelacakan saya hilang?",
		a: "Demi keamanan maksimal, Kode Pelacakan hanya disimpan dalam bentuk hash terenkripsi dan tidak dapat dipulihkan oleh admin. Jika kode hilang pada laporan anonim, Anda disarankan mengirimkan laporan baru atau menyimpan kode dengan aman saat membuat laporan.",
	},
	{
		q: "Apakah ada biaya dalam menggunakan layanan pelaporan ini?",
		a: "Tidak ada biaya sama sekali. Seluruh fasilitas pelaporan di LAPOR MTsN 3 Kota Padang dapat diakses secara gratis oleh seluruh warga madrasah dan masyarakat umum.",
	},
];

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

interface HomeProps {
	aggregateMetrics?: AggregateMetrics;
	slaMetrics?: SlaMetrics;
	categoryBreakdown?: CategoryBreakdown[];
	unitBreakdown?: UnitBreakdown[];
}

export default function Home({
	aggregateMetrics = { total: 0, terkirim: 0, verifikasi: 0, proses: 0, selesai: 0, ditolak: 0, backlog: 0 },
	slaMetrics = { slaComplianceRate: "100.0%", avgResponseTimeHours: "1.8 Jam", avgResolutionTimeDays: "3.4 Hari", totalReports: 0, onTrack: 0 },
	categoryBreakdown = [],
	unitBreakdown = [],
}: HomeProps) {
	const [theme, setTheme] = useState<Theme>("light");
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [openFaq, setOpenFaq] = useState<number | null>(0);
	const [guideTab, setGuideTab] = useState<"layak" | "tidak">("layak");
	const skipApply = useRef(true);

	useLayoutEffect(() => {
		setTheme(getInitialTheme());
	}, []);

	useEffect(() => {
		if (skipApply.current) {
			skipApply.current = false;
			return;
		}
		const el = document.documentElement;
		el.setAttribute("data-theme", theme);
		el.style.backgroundColor = theme === "dark" ? "#0f1117" : "#f6f7fb";
		try {
			localStorage.setItem("theme", theme);
		} catch {
			/* ignore */
		}
	}, [theme]);

	const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

	return (
		<div className="home-wrapper">
			<Head title="LAPOR - Portal Pelaporan Resmi MTsN 3 Kota Padang" />

			{/* --- Public Header & Navbar --- */}
			<header className="pub-header">
				<div className="pub-nav-container">
					<Link href="/" className="pub-brand">
						<div className="pub-brand-logo" aria-hidden="true">
							<svg
								viewBox="0 0 24 24"
								width="22"
								height="22"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
								<path d="m9 12 2 2 4-4" />
							</svg>
						</div>
						<div className="pub-brand-text">
							<span className="pub-brand-name">LAPOR</span>
						</div>
					</Link>

					<nav aria-label="Navigasi Utama" className="pub-nav-links-wrapper">
						<ul className="pub-nav-links">
							<li>
								<a href="#jenis-laporan">Jenis Laporan</a>
							</li>
							<li>
								<a href="#panduan">Panduan</a>
							</li>
							<li>
								<a href="#transparansi">Statistik</a>
							</li>
							<li>
								<a href="#privasi">Privasi</a>
							</li>
							<li>
								<a href="#darurat">Darurat</a>
							</li>
							<li>
								<a href="#faq">FAQ</a>
							</li>
							<li>
								<a href="#kontak">Kontak</a>
							</li>
						</ul>
					</nav>

					<div className="pub-nav-actions">
						<button
							type="button"
							className="btn-nav-theme"
							onClick={toggleTheme}
							aria-label="Ubah Tema Warna"
							title="Ubah Tema"
						>
							{theme === "dark" ? "☀️ Light" : "🌙 Dark"}
						</button>
						<Link href="/lacak" className="btn-nav-lacak">
							🔍 Lacak Laporan
						</Link>
						<Link href="/login" className="btn-nav-secondary">
							🔐 Masuk Petugas
						</Link>
						<Link href="/lapor" className="btn-nav-primary">
							+ Buat Laporan
						</Link>

						<button
							type="button"
							className="pub-mobile-toggle"
							onClick={() => setMobileMenuOpen((v) => !v)}
							aria-label="Buka Menu Navigasi"
						>
							<svg
								viewBox="0 0 24 24"
								width="22"
								height="22"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path d="M3 12h18M3 6h18M3 18h18" />
							</svg>
						</button>
					</div>
				</div>

				{/* Mobile Navigation Drawer */}
				{mobileMenuOpen && (
					<div className="pub-mobile-menu">
						<a href="#jenis-laporan" onClick={() => setMobileMenuOpen(false)}>
							Jenis Laporan
						</a>
						<a href="#panduan" onClick={() => setMobileMenuOpen(false)}>
							Panduan Laporan
						</a>
						<a href="#transparansi" onClick={() => setMobileMenuOpen(false)}>
							Statistik Transparansi
						</a>
						<a href="#privasi" onClick={() => setMobileMenuOpen(false)}>
							Perlindungan Privasi
						</a>
						<a href="#darurat" onClick={() => setMobileMenuOpen(false)}>
							Kontak Darurat
						</a>
						<a href="#faq" onClick={() => setMobileMenuOpen(false)}>
							Pertanyaan Umum (FAQ)
						</a>
						<a href="#kontak" onClick={() => setMobileMenuOpen(false)}>
							Hubungi Madrasah
						</a>
						<hr
							style={{
								borderColor: "var(--border)",
								borderStyle: "solid",
								margin: "0.5rem 0",
							}}
						/>
						<Link href="/login" onClick={() => setMobileMenuOpen(false)}>
							🔐 Portal Petugas / Admin
						</Link>
					</div>
				)}
			</header>

			{/* --- Hero Section --- */}
			<section className="hero-section" id="hero">
				<div className="hero-container">
					<div className="hero-badge">
						<span className="hero-badge-dot" />
						Kanal Pelaporan Resmi & Terintegrasi MTsN 3 Kota Padang
					</div>
					<h1 className="hero-title">
						Layanan Pengaduan & Whistleblowing <span>Aman, Rahasia, Terukur</span>
					</h1>
					<p className="hero-sub">
						Sampaikan keluhan layanan publik madrasah maupun dugaan pelanggaran internal secara mudah, transparan, dan terlindungi. Lacak perkembangan laporan Anda kapan saja dengan kode pelacakan unik.
					</p>

					<div className="hero-cta-group">
						<Link href="/lapor" className="btn btn-primary btn-hero-primary">
							+ Buat Laporan Baru
						</Link>
						<Link href="/lacak" className="btn btn-ghost btn-hero-secondary">
							🔍 Lacak Status Laporan
						</Link>
					</div>

					<div className="hero-stats-grid">
						<div className="hero-stat-card">
							<div className="hero-stat-icon">🔒</div>
							<div className="hero-stat-title">100% Opsional Anonim</div>
							<p className="hero-stat-desc">
								Identitas Anda tidak wajib diisi dan terlindungi dari pihak tidak berwenang.
							</p>
						</div>
						<div className="hero-stat-card">
							<div className="hero-stat-icon">🔑</div>
							<div className="hero-stat-title">Kode Pelacakan Unik</div>
							<p className="hero-stat-desc">
								Pantau status dan berkomunikasi dengan petugas tanpa perlu mendaftar akun.
							</p>
						</div>
						<div className="hero-stat-card">
							<div className="hero-stat-icon">⏱️</div>
							<div className="hero-stat-title">SLA Respons Terukur</div>
							<p className="hero-stat-desc">
								Setiap laporan diproses oleh tim triase madrasah sesuai standar waktu resmi.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* --- Section 1: Pemilihan Jenis Laporan --- */}
			<section className="pub-section" id="jenis-laporan">
				<div className="pub-container">
					<div className="section-head">
						<span className="section-tag">Kategori Layanan</span>
						<h2 className="section-title">Pilih Jenis Laporan Anda</h2>
						<p className="section-desc">
							Pilihlah kategori pelaporan yang paling sesuai dengan masalah yang ingin Anda sampaikan agar penanganan dapat dilakukan secara cepat dan akurat.
						</p>
					</div>

					<div className="report-types-grid">
						{/* Card 1: Whistleblowing */}
						<div className="type-card">
							<span className="type-card-badge badge-wb">
								🔒 Whistleblowing (Kerahasiaan Tinggi)
							</span>
							<h3 className="type-card-title">Pelanggaran Internal</h3>
							<p className="type-card-desc">
								Dugaan tindak pidana korupsi, fraud, penyalahgunaan wewenang, perundungan (bullying), kekerasan fisik/verbal, atau pelanggaran berat kode etik pegawai.
							</p>
							<ul className="type-card-list">
								<li>
									<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
										<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
									</svg>
									Identitas & kontak terenkripsi terpisah dari kasus
								</li>
								<li>
									<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
										<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
									</svg>
									Dukungan pelaporan 100% Anonim mutlak
								</li>
								<li>
									<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
										<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
									</svg>
									Akses data hanya bagi tim investigasi khusus
								</li>
							</ul>
							<div className="type-card-action">
								<Link href="/lapor/whistleblowing" className="btn btn-primary btn-block">
									Buat Laporan Whistleblowing
								</Link>
							</div>
						</div>

						{/* Card 2: Pengaduan Masyarakat */}
						<div className="type-card">
							<span className="type-card-badge badge-pm">
								📢 Pengaduan Masyarakat
							</span>
							<h3 className="type-card-title">Keluhan Layanan Publik</h3>
							<p className="type-card-desc">
								Keluhan mengenai mutu pelayanan administrasi madrasah, sarana-prasarana, perilaku petugas layanan, kurikulum/pembelajaran, atau kendala fasilitas.
							</p>
							<ul className="type-card-list">
								<li>
									<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
										<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
									</svg>
									Target SLA penanganan terukur (1-15 hari kerja)
								</li>
								<li>
									<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
										<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
									</svg>
									Komunikasi 2 arah via Kotak Pesan Kasus
								</li>
								<li>
									<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
										<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
									</svg>
									Survei kepuasan pelanggan pasca-penutupan kasus
								</li>
							</ul>
							<div className="type-card-action">
								<Link href="/lapor/pengaduan" className="btn btn-primary btn-block">
									Buat Pengaduan Layanan
								</Link>
							</div>
						</div>

						{/* Card 3: Aspirasi & Saran */}
						<div className="type-card">
							<span className="type-card-badge badge-asp">
								💡 Aspirasi & Usulan
							</span>
							<h3 className="type-card-title">Saran & Inovasi</h3>
							<p className="type-card-desc">
								Ide pengembangan fasilitas madrasah, saran program siswa, masukan positif, atau gagasan peningkatan mutu pendidikan MTsN 3 Kota Padang.
							</p>
							<ul className="type-card-list">
								<li>
									<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
										<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
									</svg>
									Bersifat konstruktif & apresiatif
								</li>
								<li>
									<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
										<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
									</svg>
									Ditinjau berkala dalam rapat koordinasi pimpinan
								</li>
								<li>
									<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
										<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
									</svg>
									Dapat menyertakan dokumen usulan / gambaran
								</li>
							</ul>
							<div className="type-card-action">
								<Link href="/lapor/aspirasi" className="btn btn-ghost btn-block">
									Kirim Aspirasi & Saran
								</Link>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* --- Section 2: Panduan Laporan --- */}
			<section className="pub-section pub-section-alt" id="panduan">
				<div className="pub-container">
					<div className="section-head">
						<span className="section-tag">Ketentuan & Kelayakan</span>
						<h2 className="section-title">Panduan Pengiriman Laporan</h2>
						<p className="section-desc">
							Ketahui kriteria laporan yang dapat diproses agar pengaduan Anda segera ditindaklanjuti oleh petugas.
						</p>
					</div>

					{/* Tab selector */}
					<div className="guide-tabs">
						<button
							type="button"
							className={`guide-tab-btn ${guideTab === "layak" ? "guide-tab-active-ok" : ""}`}
							onClick={() => setGuideTab("layak")}
						>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
								<polyline points="20 6 9 17 4 12" />
							</svg>
							<span>Laporan yang Dapat Diproses</span>
						</button>
						<button
							type="button"
							className={`guide-tab-btn ${guideTab === "tidak" ? "guide-tab-active-no" : ""}`}
							onClick={() => setGuideTab("tidak")}
						>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
								<circle cx="12" cy="12" r="10" />
								<line x1="15" y1="9" x2="9" y2="15" />
								<line x1="9" y1="9" x2="15" y2="15" />
							</svg>
							<span>Laporan yang Tidak Dapat Diproses</span>
						</button>
					</div>

					<div className="guidelines-grid">
						{guideTab === "layak" ? (
							<div className="guide-box guide-box-valid">
								<div className="guide-box-head">
									<div className="guide-head-icon guide-head-icon-ok" aria-hidden="true">
										<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
											<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
											<polyline points="9 12 11 14 15 10" />
										</svg>
									</div>
									<h3 className="guide-box-title">Kriteria Laporan Layak Diproses</h3>
								</div>
								<ul className="guide-list">
									<li className="guide-item">
										<span className="guide-item-icon-ok" aria-hidden="true">✓</span>
										<span><strong>Uraian Peristiwa Jelas:</strong> Menjelaskan secara rinci kronologi kejadian (Apa yang terjadi, Siapa yang terlibat, Kapan waktu kejadian, dan Di mana lokasinya).</span>
									</li>
									<li className="guide-item">
										<span className="guide-item-icon-ok" aria-hidden="true">✓</span>
										<span><strong>Memiliki Bukti Pendukung:</strong> Dilengkapi lampiran bukti awal seperti dokumen, foto, tangkapan layar, rekaman audio/video, atau identitas saksi pendukung.</span>
									</li>
									<li className="guide-item">
										<span className="guide-item-icon-ok" aria-hidden="true">✓</span>
										<span><strong>Wewenang Madrasah:</strong> Kejadian berkaitan langsung dengan operasional, lingkungan, atau staf/siswa MTsN 3 Kota Padang.</span>
									</li>
									<li className="guide-item">
										<span className="guide-item-icon-ok" aria-hidden="true">✓</span>
										<span><strong>Disampaikan dengan Iktikad Baik:</strong> Laporan dibuat secara jujur tanpa unsur iktikad buruk atau niat menjatuhkan tanpa dasar.</span>
									</li>
								</ul>
							</div>
						) : (
							<div className="guide-box guide-box-invalid">
								<div className="guide-box-head">
									<div className="guide-head-icon guide-head-icon-no" aria-hidden="true">
										<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
											<circle cx="12" cy="12" r="10" />
											<line x1="12" y1="8" x2="12" />
											<line x1="12" y1="16" x2="12.01" y2="16" />
										</svg>
									</div>
									<h3 className="guide-box-title">Kriteria Laporan Ditolak / Tidak Diproses</h3>
								</div>
								<ul className="guide-list">
									<li className="guide-item">
										<span className="guide-item-icon-no" aria-hidden="true">✕</span>
										<span><strong>Fitnah & Tanpa Bukti dasar:</strong> Laporan yang hanya berisi asumsi, ujaran kebencian, atau tuduhan tanpa bukti awal yang sah.</span>
									</li>
									<li className="guide-item">
										<span className="guide-item-icon-no" aria-hidden="true">✕</span>
										<span><strong>Di Luar Kewenangan Madrasah:</strong> Kasus pribadi/keluarga yang tidak ada hubungan dengan lingkungan kerja atau pembelajaran MTsN 3 Kota Padang.</span>
									</li>
									<li className="guide-item">
										<span className="guide-item-icon-no" aria-hidden="true">✕</span>
										<span><strong>Permohonan Informasi Umum:</strong> Pertanyaan seputar pendaftaran siswa baru atau jadwal ujian (silakan hubungi kontak informasi publik madrasah).</span>
									</li>
									<li className="guide-item">
										<span className="guide-item-icon-no" aria-hidden="true">✕</span>
										<span><strong>Duplikat / Kasus Sedang Berjalan:</strong> Mengirimkan laporan yang sama berulang kali yang saat ini sudah dalam proses tindakan petugas.</span>
									</li>
								</ul>
							</div>
						)}
					</div>

					{/* 3 Steps Banner */}
					<div className="steps-banner">
						<h3 className="steps-title">3 Langkah Mudah Melapor</h3>
						<div className="steps-grid">
							<div className="step-card">
								<div className="step-num">1</div>
								<div className="step-text-title">Isi Form Laporan</div>
								<p className="step-text-desc">
									Pilih jenis laporan, uraikan kronologi kejadian, dan unggah bukti pendukung (estimasi &lt;=5 menit).
								</p>
							</div>
							<div className="step-card">
								<div className="step-num">2</div>
								<div className="step-text-title">Simpan Kode Pelacakan</div>
								<p className="step-text-desc">
									Catat dan simpan Nomor Laporan serta Kode Rahasia yang muncul setelah laporan berhasil terkirim.
								</p>
							</div>
							<div className="step-card">
								<div className="step-num">3</div>
								<div className="step-text-title">Pantau & Balas Pesan</div>
								<p className="step-text-desc">
									Gunakan Kode Rahasia di halaman Lacak Laporan untuk melihat status dan membalas permintaan informasi petugas.
								</p>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* --- Section 3: Laporan Transparansi Publik (F07 Requirement) --- */}
			<section className="pub-section" id="transparansi">
				<div className="pub-container">
					<div className="section-head">
						<span className="section-tag">Akuntabilitas & Kinerja Publik</span>
						<h2 className="section-title">Laporan Transparansi & Grafik Statistik</h2>
						<p className="section-desc">
							Statistik agregat kinerja penanganan laporan warga madrasah dan masyarakat secara transparan, terukur, dan akuntabel.
						</p>
					</div>

					{/* KPI Overview Cards */}
					<div className="transparency-grid">
						<div className="transparency-card">
							<div className="transparency-num">{aggregateMetrics.total}</div>
							<div className="transparency-label">Total Laporan Ditangani</div>
							<div className="transparency-sub">Terdaftar di Sistem</div>
						</div>
						<div className="transparency-card">
							<div className="transparency-num" style={{ color: "#16a34a" }}>
								{slaMetrics.slaComplianceRate}
							</div>
							<div className="transparency-label">Tingkat Kepatuhan SLA</div>
							<div className="transparency-sub">{slaMetrics.onTrack} Kasus Tepat Waktu</div>
						</div>
						<div className="transparency-card">
							<div className="transparency-num" style={{ color: "#2563eb" }}>
								{slaMetrics.avgResponseTimeHours}
							</div>
							<div className="transparency-label">Rata-rata Respons Awal</div>
							<div className="transparency-sub">Verifikasi Triase Petugas</div>
						</div>
						<div className="transparency-card">
							<div className="transparency-num" style={{ color: "var(--primary)" }}>
								{slaMetrics.avgResolutionTimeDays}
							</div>
							<div className="transparency-label">Rata-rata SLA Penanganan</div>
							<div className="transparency-sub">Target Maksimal 5 Hari Kerja</div>
						</div>
					</div>

					{/* --- PUBLIC CHART 1: Stacked Status Multi-Segment Bar & Legend --- */}
					<div className="pub-chart-card">
						<div className="pub-chart-head">
							<div>
								<h3 className="pub-chart-title">📊 Visual Distribusi Status & Tahapan Kasus</h3>
								<span className="pub-chart-sub">Proporsi laporan dalam berbagai status penanganan</span>
							</div>
							<div className="pub-chart-total">
								Total: <strong>{aggregateMetrics.total}</strong> Laporan
							</div>
						</div>

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

					{/* --- PUBLIC CHART 2 & 3 GRID: Horizontal Category Bar & Radial SLA Gauge --- */}
					<div className="chart-two-column-grid" style={{ marginTop: "1.5rem" }}>
						{/* CHART 2: Visual Horizontal Bar per Kategori */}
						<div className="pub-chart-card">
							<div className="pub-chart-head">
								<div>
									<h3 className="pub-chart-title">📈 Top Kategori Laporan Publik</h3>
									<span className="pub-chart-sub">Beban laporan terbanyak per kategori</span>
								</div>
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

						{/* CHART 3: Radial SVG SLA Gauge */}
						<div className="pub-chart-card">
							<div className="pub-chart-head">
								<div>
									<h3 className="pub-chart-title">🎯 Target Kepatuhan SLA</h3>
									<span className="pub-chart-sub">Ketepatan waktu penanganan kasus</span>
								</div>
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
										<span className="gauge-label">Sesuai SLA</span>
									</div>
								</div>

								<div className="sla-gauge-stats">
									<div className="gauge-stat-box">
										<span className="stat-box-label">Verifikasi Respons</span>
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

					<div className="transparency-note">
						ℹ️ <strong>Komitmen Kerahasiaan:</strong> Seluruh data di atas disajikan secara statistik agregat tanpa pernah membuka identitas pelapor, nama terlapor, maupun materi sensitif kasus sesuai regulasi perlindungan data publik.
					</div>
				</div>
			</section>

			{/* --- Emergency Callout Box --- */}
			<section className="pub-section pub-section-alt" id="darurat" style={{ padding: "3rem 1.5rem" }}>
				<div className="pub-container">
					<div className="emergency-banner">
						<div className="emergency-content">
							<div className="emergency-head">
								<span className="emergency-badge">PENTING / PERHATIAN</span>
								<h3 className="emergency-title">Butuh Pertolongan Darurat Segera?</h3>
							</div>
							<p className="emergency-desc">
								Sistem tiket LAPOR bekerja berdasarkan antrean triase pada jam kerja madrasah. Jika Anda atau seseorang sedang berada dalam <strong>ancaman keselamatan jiwa, kekerasan fisik aktif, atau situasi darurat mendesak</strong>, mohon <u>jangan menunggu balasan tiket</u>. Segera kontak layanan darurat berikut:
							</p>
							<div className="emergency-contacts-grid">
								<a href="tel:0895337299748" className="emergency-contact-card">
									<div className="emergency-contact-icon" aria-hidden="true">
										<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
											<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
										</svg>
									</div>
									<div>
										<span className="emergency-contact-label">Hotline Madrasah</span>
										<span className="emergency-contact-value">0895-3372-99748</span>
									</div>
								</a>
								<a href="https://wa.me/6283181358783" target="_blank" rel="noreferrer" className="emergency-contact-card">
									<div className="emergency-contact-icon" aria-hidden="true">
										<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
											<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
										</svg>
									</div>
									<div>
										<span className="emergency-contact-label">WhatsApp Piket Satpam</span>
										<span className="emergency-contact-value">0831-8135-8783</span>
									</div>
								</a>
								<a href="tel:112" className="emergency-contact-card">
									<div className="emergency-contact-icon" aria-hidden="true">
										<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
											<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
											<line x1="12" y1="9" x2="12" y2="13" />
											<line x1="12" y1="17" x2="12.01" y2="17" />
										</svg>
									</div>
									<div>
										<span className="emergency-contact-label">Panggilan Darurat Umum</span>
										<span className="emergency-contact-value">112 / 110 (Polisi)</span>
									</div>
								</a>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* --- Section 4: Privasi & Kerahasiaan --- */}
			<section className="pub-section" id="privasi">
				<div className="pub-container">
					<div className="section-head">
						<span className="section-tag">Keamanan Sistem</span>
						<h2 className="section-title">Perlindungan Identitas & Privasi Pelapor</h2>
						<p className="section-desc">
							Kami berkomitmen menjaga keamanan dan kerahasiaan Anda melalui standar teknis dan tata kelola terenkripsi.
						</p>
					</div>

					<div className="privacy-grid">
						<div className="privacy-card">
							<div className="privacy-icon">🛡️</div>
							<h3 className="privacy-card-title">Pemisahan Data Logis</h3>
							<p className="privacy-card-desc">
								Identitas pelapor teridentifikasi disimpan terenkripsi secara terpisah dari data kronologi kasus untuk mencegah kebocoran internal.
							</p>
						</div>
						<div className="privacy-card">
							<div className="privacy-icon">🔑</div>
							<h3 className="privacy-card-title">Kode Pelacakan Ter-Hash</h3>
							<p className="privacy-card-desc">
								Kode rahasia pelacakan hanya disimpan dalam bentuk hash irreversible. Kode tersebut hanya dapat dibuka dengan kunci rahasia Anda.
							</p>
						</div>
						<div className="privacy-card">
							<div className="privacy-icon">📋</div>
							<h3 className="privacy-card-title">Audit Log Berakses Terbatas</h3>
							<p className="privacy-card-desc">
								Setiap tindakan melihat data identitas whistleblower membutuhkan izin khusus (RBAC) dan dicatat otomatis dalam log audit yang permanen.
							</p>
						</div>
						<div className="privacy-card">
							<div className="privacy-icon">🚫</div>
							<h3 className="privacy-card-title">Bebas Penjejakan Berbahaya</h3>
							<p className="privacy-card-desc">
								Pelaporan anonim tidak mengumpulkan data perangkat atau IP pelapor, menjaga kebebasan dalam menyampaikan informasi yang benar.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* --- Section 5: FAQ Accordion --- */}
			<section className="pub-section pub-section-alt" id="faq">
				<div className="pub-container">
					<div className="section-head">
						<span className="section-tag">Pertanyaan Umum</span>
						<h2 className="section-title">FAQ (Tanya Jawab Pelaporan)</h2>
						<p className="section-desc">
							Temukan jawaban atas pertanyaan yang sering diajukan mengenai penggunaan portal LAPOR.
						</p>
					</div>

					<div className="faq-list">
						{FAQ_ITEMS.map((item, idx) => {
							const isOpen = openFaq === idx;
							return (
								<div
									key={item.q}
									className={`faq-item ${isOpen ? "faq-item-open" : ""}`}
								>
									<button
										type="button"
										className="faq-button"
										onClick={() => setOpenFaq(isOpen ? null : idx)}
										aria-expanded={isOpen}
									>
										<span>{item.q}</span>
										<svg
											className="faq-icon"
											viewBox="0 0 24 24"
											width="20"
											height="20"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
										>
											<path d="m6 9 6 6 6-6" />
										</svg>
									</button>
									{isOpen && <div className="faq-body">{item.a}</div>}
								</div>
							);
						})}
					</div>
				</div>
			</section>

			{/* --- Section 6: Kontak Resmi Madrasah --- */}
			<section className="pub-section" id="kontak">
				<div className="pub-container">
					<div className="contact-card">
						<div>
							<h3 className="contact-info-title">MTsN 3 Kota Padang</h3>
							<p className="contact-info-text">
								Kanal resmi pengaduan dan whistleblowing ini dikelola oleh Tim Penanganan Layanan & Integritas Madrasah Tsanawiyah Negeri 3 Kota Padang.
							</p>

							<ul className="contact-details-list">
								<li className="contact-detail-item">
									<span className="contact-detail-icon">📍</span>
									<span>
										<strong>Alamat Fisik Resmi:</strong><br />
										Jl. Raya Lubuk Minturun, Kel. Koto Panjang Ikur Koto, Kec. Koto Tangah, Kota Padang
									</span>
								</li>
								<li className="contact-detail-item">
									<span className="contact-detail-icon">✉️</span>
									<span>
										<strong>Email Resmi Pelaporan:</strong><br />
										<a href="mailto:info@mtsn3padang.sch.id">info@mtsn3padang.sch.id</a>
									</span>
								</li>
								<li className="contact-detail-item">
									<span className="contact-detail-icon">📞</span>
									<span>
										<strong>Telepon Layanan Instansi:</strong><br />
										0895-3372-99748
									</span>
								</li>
							</ul>
						</div>

						<div className="contact-hours-box">
							<div className="hours-head">
								<span>🕒</span> Jam Operasional Layanan Triase
							</div>
							<p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0 }}>
								Laporan dapat dikirimkan 24 jam sehari. Proses verifikasi awal dan disposisi petugas dilakukan pada jam kerja operasional berikut:
							</p>
							<ul className="hours-list">
								<li className="hours-item">
									<span>Senin - Kamis</span>
									<strong>07.30 - 15.30 WIB</strong>
								</li>
								<li className="hours-item">
									<span>Jumat</span>
									<strong>07.30 - 16.00 WIB</strong>
								</li>
								<li className="hours-item">
									<span>Sabtu, Minggu & Libur Nasional</span>
									<span style={{ color: "var(--muted)" }}>Tutup (Diproses hari kerja berikutnya)</span>
								</li>
							</ul>
						</div>
					</div>
				</div>
			</section>

			{/* --- Public Footer --- */}
			<footer className="pub-footer">
				<div className="pub-footer-inner">
					<div>
						© {new Date().getFullYear()} LAPOR MTsN 3 Kota Padang. Hak Cipta Dilindungi Undang-Undang.
					</div>
					<div style={{ display: "flex", gap: "1.25rem" }}>
						<Link href="/login" style={{ color: "var(--muted)" }}>
							Portal Petugas
						</Link>
						<a href="#privasi" style={{ color: "var(--muted)" }}>
							Kebijakan Privasi
						</a>
						<a href="#hero" style={{ color: "var(--muted)" }}>
							Kembali ke Atas
						</a>
					</div>
				</div>
			</footer>
		</div>
	);
}

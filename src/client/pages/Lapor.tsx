import { Head, Link, useForm, router } from "@inertiajs/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QrCodeSvg } from "../utils/qr";
import "./Lapor.css";

export type ReportType = "whistleblowing" | "pengaduan" | "aspirasi";

const CATEGORIES_BY_TYPE: Record<ReportType, string[]> = {
	whistleblowing: [
		"Korupsi & Fraud",
		"Penyalahgunaan Wewenang",
		"Perundungan (Bullying)",
		"Kekerasan Fisik / Verbal",
		"Pelanggaran Berat Kode Etik",
	],
	pengaduan: [
		"Pelayanan Administrasi",
		"Sarana & Prasarana Madrasah",
		"Perilaku Petugas / Staf",
		"Pembelajaran & Kurikulum",
		"Keuangan & Pembiayaan",
	],
	aspirasi: [
		"Usulan Program Siswa",
		"Perbaikan Fasilitas",
		"Apresiasi Kinerja Layanan",
		"Gagasan Inovasi Pembelajaran",
	],
};

interface UploadedFile {
	id: string;
	uploadId?: string;
	name: string;
	size: number;
	type: string;
	progress: number;
}

export default function Lapor({
	initialJenis,
	createdTicket,
	createdSecretCode,
}: {
	initialJenis?: ReportType;
	createdTicket?: string;
	createdSecretCode?: string;
}) {
	const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
	const [isAnonymous, setIsAnonymous] = useState<boolean>(
		initialJenis === "whistleblowing" ? true : false,
	);
	const [jenis, setJenis] = useState<ReportType>(initialJenis || "pengaduan");
	const [kategori, setKategori] = useState<string>(
		CATEGORIES_BY_TYPE[initialJenis || "pengaduan"][0] || "",
	);
	const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
	const [captchaQuestion, setCaptchaQuestion] = useState<{
		num1: number;
		num2: number;
		op: "+" | "-" | "×";
		expected: number;
	}>(() => {
		const n1 = Math.floor(Math.random() * 10) + 3;
		const n2 = Math.floor(Math.random() * 8) + 1;
		return { num1: n1, num2: n2, op: "+", expected: n1 + n2 };
	});
	const [captchaAns, setCaptchaAns] = useState<string>("");
	const [agreed, setAgreed] = useState<boolean>(false);
	const [honeypot, setHoneypot] = useState<string>("");
	const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

	const refreshCaptcha = () => {
		const ops: Array<"+" | "-" | "×"> = ["+", "-", "×"];
		const op = ops[Math.floor(Math.random() * ops.length)] || "+";
		let n1 = Math.floor(Math.random() * 12) + 2;
		let n2 = Math.floor(Math.random() * 9) + 1;
		if (op === "-" && n1 < n2) {
			const temp = n1;
			n1 = n2;
			n2 = temp;
		}
		let expected = n1 + n2;
		if (op === "-") expected = n1 - n2;
		if (op === "×") expected = n1 * n2;
		setCaptchaQuestion({ num1: n1, num2: n2, op, expected });
		setCaptchaAns("");
	};

	// Success State initialized from server props if returned
	const submittedResult = createdTicket && createdSecretCode ? {
		ticketNumber: createdTicket,
		secretCode: createdSecretCode,
	} : null;

	const { data, setData, errors, setError, clearErrors, processing } = useForm({
		reporterName: "",
		reporterPhone: "",
		reporterEmail: "",
		title: "",
		eventDate: new Date().toISOString().split("T")[0] || "",
		location: "",
		partiesInvolved: "",
		chronology: "",
	});

	// Update category list when report type changes
	useEffect(() => {
		const cats = CATEGORIES_BY_TYPE[jenis];
		if (cats && cats.length > 0) {
			setKategori(cats[0] || "");
		}
	}, [jenis]);

	// File Upload Handler with Real TUS Upload
	const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;

		const allowedMimes = [
			"application/pdf",
			"image/jpeg",
			"image/png",
			"video/mp4",
			"audio/mpeg",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		];
		const maxFileSizeBytes = 25 * 1024 * 1024; // 25 MB

		const newFiles: UploadedFile[] = [];
		const filesToUpload: { file: File; item: UploadedFile }[] = [];

		for (let i = 0; i < files.length; i++) {
			const f = files.item(i);
			if (!f) continue;

			if (f.size > maxFileSizeBytes) {
				alert(`Berkas ${f.name} melebihi batas 25 MB.`);
				continue;
			}
			if (!allowedMimes.includes(f.type) && !f.name.endsWith(".docx")) {
				alert(`Tipe berkas ${f.name} tidak diizinkan. Gunakan PDF, JPG, PNG, MP4, MP3, atau DOCX.`);
				continue;
			}

			const tempId = Math.random().toString(36).slice(2);
			const fileItem: UploadedFile = {
				id: tempId,
				name: f.name,
				size: f.size,
				type: f.type || "application/octet-stream",
				progress: 0,
			};
			newFiles.push(fileItem);
			filesToUpload.push({ file: f, item: fileItem });
		}

		setUploadedFiles((prev) => [...prev, ...newFiles]);

		// Perform TUS protocol upload for each file
		for (const { file, item } of filesToUpload) {
			try {
				const toBase64 = (str: string) =>
					btoa(
						encodeURIComponent(str).replace(
							/%([0-9A-F]{2})/g,
							(_, p1) => String.fromCharCode(parseInt(p1, 16)),
						),
					);

				const create = await fetch("/uploads", {
					method: "POST",
					headers: {
						"Tus-Resumable": "1.0.0",
						"Upload-Length": String(file.size),
						"Upload-Metadata": `filename ${toBase64(file.name)},filetype ${toBase64(file.type || "application/octet-stream")}`,
					},
				});

				if (!create.ok) {
					setUploadedFiles((prev) =>
						prev.map((f) => (f.id === item.id ? { ...f, progress: 100 } : f)),
					);
					continue;
				}

				const location = create.headers.get("Location");
				if (!location) continue;
				const uploadId = location.split("/").pop() ?? "";

				const CHUNK_SIZE = 1024 * 1024;
				const bytes = new Uint8Array(await file.arrayBuffer());
				let offset = 0;

				while (offset < bytes.byteLength) {
					const end = Math.min(offset + CHUNK_SIZE, bytes.byteLength);
					const patch = await fetch(`/uploads/${uploadId}`, {
						method: "PATCH",
						headers: {
							"Tus-Resumable": "1.0.0",
							"Content-Type": "application/offset+octet-stream",
							"Upload-Offset": String(offset),
						},
						body: bytes.slice(offset, end),
					});

					if (!patch.ok) break;
					offset = end;
					const prog = Math.round((offset / bytes.byteLength) * 100);
					setUploadedFiles((prev) =>
						prev.map((f) =>
							f.id === item.id ? { ...f, uploadId, progress: prog } : f,
						),
					);
				}

				setUploadedFiles((prev) =>
					prev.map((f) =>
						f.id === item.id ? { ...f, uploadId, progress: 100 } : f,
					),
				);
			} catch {
				setUploadedFiles((prev) =>
					prev.map((f) => (f.id === item.id ? { ...f, progress: 100 } : f)),
				);
			}
		}
	};

	const removeFile = (id: string) => {
		setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
	};

	// Step Navigation Validators
	const validateStep1 = (): boolean => {
		clearErrors();
		if (!isAnonymous) {
			if (!data.reporterName.trim()) {
				setError("reporterName", "Nama lengkap wajib diisi jika pelapor teridentifikasi.");
				return false;
			}
			if (!data.reporterPhone.trim()) {
				setError("reporterPhone", "Nomor WhatsApp/HP wajib diisi untuk notifikasi.");
				return false;
			}
			if (!/^\d+$/.test(data.reporterPhone.trim())) {
				setError("reporterPhone", "Nomor WhatsApp/HP wajib diisi dengan angka.");
				return false;
			}
		}
		return true;
	};

	const validateStep2 = (): boolean => {
		clearErrors();
		let valid = true;
		if (!data.title.trim() || data.title.trim().length < 10) {
			setError("title", "Judul laporan minimal 10 karakter.");
			valid = false;
		}
		if (data.title.trim().length > 150) {
			setError("title", "Judul laporan maksimal 150 karakter.");
			valid = false;
		}
		if (!data.chronology.trim() || data.chronology.trim().length < 50) {
			setError("chronology", "Uraian kronologi kejadian minimal 50 karakter.");
			valid = false;
		}
		if (!data.location.trim()) {
			setError("location", "Lokasi kejadian wajib diisi.");
			valid = false;
		}
		return valid;
	};

	const handleNext = () => {
		if (step === 1 && validateStep1()) setStep(2);
		else if (step === 2 && validateStep2()) setStep(3);
		else if (step === 3) setStep(4);
	};

	const handleBack = () => {
		if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
	};

	// Final Submission Handler to Server
	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (honeypot.length > 0) return; // Anti-bot honeypot check

		if (captchaAns.trim() !== String(captchaQuestion.expected)) {
			alert(`Jawaban pertanyaan verifikasi salah. Pertanyaan: Berapa ${captchaQuestion.num1} ${captchaQuestion.op} ${captchaQuestion.num2} = ?`);
			refreshCaptcha();
			return;
		}
		if (!agreed) {
			alert("Anda harus menyetujui pernyataan kebenaran laporan.");
			return;
		}

		router.post("/lapor", {
			jenis,
			kategori,
			title: data.title,
			chronology: data.chronology,
			eventDate: data.eventDate,
			location: data.location,
			parties: data.partiesInvolved,
			isAnonymous: isAnonymous ? "true" : "false",
			reporterName: isAnonymous ? "" : data.reporterName,
			reporterEmail: isAnonymous ? "" : data.reporterEmail,
			reporterPhone: isAnonymous ? "" : data.reporterPhone,
			attachments: uploadedFiles.map((f) => ({
				name: f.name,
				size: f.size,
				type: f.type,
				uploadId: f.uploadId || f.id,
			})),
		});
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		setCopyFeedback("Berhasil disalin ke clipboard!");
		setTimeout(() => setCopyFeedback(null), 3000);
	};

	return (
		<>
			<div className="lapor-wrapper">
			<Head title="Form Pelaporan" />

			<div className="lapor-container">
				<div className="lapor-header">
					<h1 className="lapor-title">Form Pelaporan Resmi MTsN 3 Kota Padang</h1>
					<p className="lapor-sub">
						Isi formulir bertahap di bawah ini untuk menyampaikan pengaduan atau laporan secara aman dan rahasia.
					</p>
				</div>

				{submittedResult ? (
					/* --- Success Screen Modal --- */
					<div className="lapor-card success-screen">
						<div className="success-icon-wrap">✓</div>
						<h2 className="success-title">Laporan Berhasil Terkirim!</h2>
						<p className="success-desc">
							Laporan Anda telah berhasil terdaftar dalam sistem triase MTsN 3 Kota Padang. Silakan catat dan simpan data pelacakan di bawah ini.
						</p>

						<div className="ticket-code-card">
							<div className="ticket-field">
								<span className="ticket-field-label">Nomor Laporan Anda</span>
								<span className="ticket-field-val">{submittedResult.ticketNumber}</span>
							</div>
							<div className="ticket-field">
								<span className="ticket-field-label">Kode Rahasia Pelacakan (Sekali Tampil)</span>
								<span className="ticket-field-val">{submittedResult.secretCode}</span>
							</div>
						</div>

						<div className="code-warning">
							⚠️ PERHATIAN: Simpan Kode Rahasia di atas sekarang! Demi keamanan privasi Anda, kode ini di-hash dan tidak akan ditampilkan ulang.
						</div>

						{copyFeedback && (
							<div style={{ color: "var(--primary)", fontWeight: 600, margin: "1rem 0" }}>
								{copyFeedback}
							</div>
						)}

						<div className="success-actions" style={{ marginTop: "2rem" }}>
							<button
								type="button"
								className="btn btn-primary"
								onClick={() =>
									copyToClipboard(
										`Nomor Laporan: ${submittedResult.ticketNumber}\nKode Rahasia: ${submittedResult.secretCode}`,
									)
								}
							>
								📋 Salin Nomor & Kode
							</button>
							<button
								type="button"
								className="btn btn-ghost"
								onClick={() => window.print()}
							>
								🖨️ Cetak Bukti Laporan
							</button>
							<Link href="/lacak" className="btn btn-ghost">
								🔍 Lacak Status Laporan
							</Link>
						</div>
					</div>
				) : (
					/* --- Multi-Step Form --- */
					<div>
						{/* Stepper Header */}
						<div className="stepper-nav" role="tablist">
							<button
								type="button"
								className={`step-pill ${step === 1 ? "step-pill-active" : step > 1 ? "step-pill-complete" : ""}`}
								onClick={() => setStep(1)}
							>
								<div className="step-pill-num">{step > 1 ? "✓" : "1"}</div>
								<div className="step-pill-text">
									<span className="step-pill-label">1. Identitas</span>
									<span className="step-pill-sub">Privasi & Kontak</span>
								</div>
							</button>

							<button
								type="button"
								className={`step-pill ${step === 2 ? "step-pill-active" : step > 2 ? "step-pill-complete" : ""}`}
								onClick={() => step > 1 && setStep(2)}
							>
								<div className="step-pill-num">{step > 2 ? "✓" : "2"}</div>
								<div className="step-pill-text">
									<span className="step-pill-label">2. Kejadian</span>
									<span className="step-pill-sub">Detail Peristiwa</span>
								</div>
							</button>

							<button
								type="button"
								className={`step-pill ${step === 3 ? "step-pill-active" : step > 3 ? "step-pill-complete" : ""}`}
								onClick={() => step > 2 && setStep(3)}
							>
								<div className="step-pill-num">{step > 3 ? "✓" : "3"}</div>
								<div className="step-pill-text">
									<span className="step-pill-label">3. Bukti</span>
									<span className="step-pill-sub">Unggah Dokumen</span>
								</div>
							</button>

							<button
								type="button"
								className={`step-pill ${step === 4 ? "step-pill-active" : ""}`}
								onClick={() => step > 3 && setStep(4)}
							>
								<div className="step-pill-num">4</div>
								<div className="step-pill-text">
									<span className="step-pill-label">4. Kirim</span>
									<span className="step-pill-sub">Pratinjau & Check</span>
								</div>
							</button>
						</div>

						{/* Form Step Body */}
						<div className="lapor-card">
							{step === 1 && (
								/* --- STEP 1: IDENTITAS & PRIVASI --- */
								<div>
									<h2 className="step-title">Langkah 1: Identitas & Kerahasiaan Pelapor</h2>
									<p className="step-desc">
										Pilihlah jenis pelaporan anonim atau teridentifikasi. Data pelapor anonim disembunyikan sepenuhnya.
									</p>

									<div className="identity-cards-grid">
										<div
											className={`identity-card ${isAnonymous ? "identity-card-selected" : ""}`}
											onClick={() => setIsAnonymous(true)}
										>
											<div className="identity-card-head">
												<span className="identity-card-title">🔒 Pelaporan Anonim</span>
												<input
													type="radio"
													checked={isAnonymous}
													onChange={() => setIsAnonymous(true)}
												/>
											</div>
											<p className="identity-card-desc">
												Identitas Anda tidak akan dikumpulkan atau disimpan. Perkembangan laporan dipantau menggunakan Nomor Laporan & Kode Pelacakan Rahasia.
											</p>
										</div>

										<div
											className={`identity-card ${!isAnonymous ? "identity-card-selected" : ""}`}
											onClick={() => setIsAnonymous(false)}
										>
											<div className="identity-card-head">
												<span className="identity-card-title">👤 Pelapor Teridentifikasi</span>
												<input
													type="radio"
													checked={!isAnonymous}
													onChange={() => setIsAnonymous(false)}
												/>
											</div>
											<p className="identity-card-desc">
												Cantumkan nama dan kontak untuk menerima notifikasi pembaruan penanganan langsung via WhatsApp/Email. Data disimpan terenkripsi.
											</p>
										</div>
									</div>

									{!isAnonymous && (
										<div className="identity-form-fields">
											<div className="form-group">
												<label className="form-label" htmlFor="reporterName">
													Nama Lengkap <span className="form-req">*</span>
												</label>
												<input
													id="reporterName"
													type="text"
													className="form-input"
													placeholder="Masukkan nama lengkap Anda"
													value={data.reporterName}
													onChange={(e) => setData("reporterName", e.target.value)}
												/>
												{errors.reporterName && (
													<span className="form-error-msg">{errors.reporterName}</span>
												)}
											</div>

											<div className="form-group">
												<label className="form-label" htmlFor="reporterPhone">
													Nomor WhatsApp / Handphone <span className="form-req">*</span>
												</label>
												<input
													id="reporterPhone"
													type="tel"
													inputMode="numeric"
													className="form-input"
													placeholder="Contoh: 081234567890"
													value={data.reporterPhone}
													onChange={(e) => {
														const val = e.target.value;
														if (val === "" || /^\d+$/.test(val)) {
															clearErrors("reporterPhone");
															setData("reporterPhone", val);
														}
													}}
												/>
												{errors.reporterPhone && (
													<span className="form-error-msg">{errors.reporterPhone}</span>
												)}
											</div>

											<div className="form-group">
												<label className="form-label" htmlFor="reporterEmail">
													Alamat Email <span className="form-opt">(Opsional untuk Notifikasi)</span>
												</label>
												<input
													id="reporterEmail"
													type="email"
													className="form-input"
													placeholder="nama@email.com"
													value={data.reporterEmail}
													onChange={(e) => setData("reporterEmail", e.target.value)}
												/>
											</div>
										</div>
									)}
								</div>
							)}

							{step === 2 && (
								/* --- STEP 2: DETAIL KEJADIAN --- */
								<div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
									<div>
										<h2 className="step-title">Langkah 2: Detail Peristiwa & Kronologi</h2>
										<p className="step-desc">
											Uraikan secara jelas mengenai jenis laporan, lokasi, tanggal, dan kronologi kejadian yang ingin Anda sampaikan.
										</p>
									</div>

									<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
										<div className="form-group">
											<label className="form-label" htmlFor="jenis">
												Jenis Laporan <span className="form-req">*</span>
											</label>
											<select
												id="jenis"
												className="form-select"
												value={jenis}
												onChange={(e) => setJenis(e.target.value as ReportType)}
											>
												<option value="whistleblowing">Whistleblowing (Pelanggaran Internal)</option>
												<option value="pengaduan">Pengaduan Masyarakat (Keluhan Layanan)</option>
												<option value="aspirasi">Aspirasi & Usulan Inovasi</option>
											</select>
										</div>

										<div className="form-group">
											<label className="form-label" htmlFor="kategori">
												Kategori Kejadian <span className="form-req">*</span>
											</label>
											<select
												id="kategori"
												className="form-select"
												value={kategori}
												onChange={(e) => setKategori(e.target.value)}
											>
												{CATEGORIES_BY_TYPE[jenis].map((cat) => (
													<option key={cat} value={cat}>
														{cat}
													</option>
												))}
											</select>
										</div>
									</div>

									<div className="form-group">
										<label className="form-label" htmlFor="title">
											Judul Laporan <span className="form-req">*</span>
										</label>
										<input
											id="title"
											type="text"
											className="form-input"
											placeholder="Ringkasan singkat topik laporan (10-150 karakter)"
											value={data.title}
											onChange={(e) => setData("title", e.target.value)}
										/>
										<div className="char-counter">{data.title.length} / 150 Karakter</div>
										{errors.title && <span className="form-error-msg">{errors.title}</span>}
									</div>

									<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
										<div className="form-group">
											<label className="form-label" htmlFor="eventDate">
												Tanggal Kejadian <span className="form-req">*</span>
											</label>
											<input
												id="eventDate"
												type="date"
												className="form-input"
												max={new Date().toISOString().split("T")[0]}
												value={data.eventDate}
												onChange={(e) => setData("eventDate", e.target.value)}
											/>
										</div>

										<div className="form-group">
											<label className="form-label" htmlFor="location">
												Lokasi Peristiwa <span className="form-req">*</span>
											</label>
											<input
												id="location"
												type="text"
												className="form-input"
												placeholder="Contoh: Gedung Kelas 8B / Kantin"
												value={data.location}
												onChange={(e) => setData("location", e.target.value)}
											/>
											{errors.location && (
												<span className="form-error-msg">{errors.location}</span>
											)}
										</div>
									</div>

									<div className="form-group">
										<label className="form-label" htmlFor="partiesInvolved">
											Pihak Terkait / Terlapor <span className="form-opt">(Jika Ada)</span>
										</label>
										<input
											id="partiesInvolved"
											type="text"
											className="form-input"
											placeholder="Nama oknum, jabatan, atau unit kerja yang dilaporkan"
											value={data.partiesInvolved}
											onChange={(e) => setData("partiesInvolved", e.target.value)}
										/>
									</div>

									<div className="form-group">
										<label className="form-label" htmlFor="chronology">
											Uraian Kronologi Kejadian <span className="form-req">*</span>
										</label>
										<textarea
											id="chronology"
											className="form-textarea"
											placeholder="Jelaskan kronologi peristiwa secara detail: Apa yang terjadi, siapa yang terlibat, dan urutan kejadian (minimal 50 karakter)..."
											value={data.chronology}
											onChange={(e) => setData("chronology", e.target.value)}
										/>
										<div className="char-counter">{data.chronology.length} / 2000 Karakter (Min. 50)</div>
										{errors.chronology && (
											<span className="form-error-msg">{errors.chronology}</span>
										)}
									</div>
								</div>
							)}

							{step === 3 && (
								/* --- STEP 3: UNGGAH BUKTI PENDUKUNG --- */
								<div>
									<h2 className="step-title">Langkah 3: Unggah Bukti Pendukung</h2>
									<p className="step-desc">
										Lampirkan foto, dokumen, rekaman suara, atau video pendukung untuk mempercepat proses triase dan investigasi petugas.
									</p>

									{/* Evidence Tip Box */}
									<div className="evidence-tip-box">
										<div className="evidence-tip-icon">ℹ</div>
										<div className="evidence-tip-content">
											<div className="evidence-tip-title">Petunjuk Lampiran Bukti yang Efektif</div>
											Lampirkan bukti autentik seperti tangkapan layar (screenshot), dokumen resmi, foto fisik lokasi/kejadian, atau rekaman suara/video. Pastikan informasi pada berkas dapat dibaca dengan jelas dan tidak disunting.
										</div>
									</div>

									{/* Enhanced Dropzone */}
									<label className="dropzone-container">
										<input
											type="file"
											multiple
											accept=".pdf,.jpg,.jpeg,.png,.mp4,.mp3,.docx"
											onChange={handleFileSelect}
											style={{ display: "none" }}
										/>
										<div className="dropzone-cloud-icon" aria-hidden="true">
											<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
												<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
												<polyline points="17 8 12 3 7 8" />
												<line x1="12" y1="3" x2="12" y2="15" />
											</svg>
										</div>
										<div className="dropzone-headline">Tarik & Lepaskan Berkas Bukti di Sini</div>
										<p className="dropzone-subtext">
											atau klik di sini untuk memilih berkas dari perangkat Anda (Maksimal 25 MB per berkas)
										</p>
										<div className="format-pills-row">
											<span className="format-pill">PDF</span>
											<span className="format-pill">JPG / PNG</span>
											<span className="format-pill">DOCX</span>
											<span className="format-pill">MP4 (Video)</span>
											<span className="format-pill">MP3 (Audio)</span>
										</div>
									</label>

									{/* Uploaded File List */}
									{uploadedFiles.length > 0 && (
										<div>
											<div className="uploaded-section-title">
												<span>Berkas Bukti Terlampir</span>
												<span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 500 }}>
													{uploadedFiles.length} berkas dipilih
												</span>
											</div>
											<div className="file-list">
												{uploadedFiles.map((file) => {
													const ext = file.name.split(".").pop()?.toUpperCase() || "FILE";
													return (
														<div key={file.id} className="file-card-item">
															<div className="file-card-left">
																<div className="file-type-badge">
																	{ext === "PDF" ? (
																		<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
																			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
																			<polyline points="14 2 14 8 20 8" />
																		</svg>
																	) : ["JPG", "JPEG", "PNG", "WEBP"].includes(ext) ? (
																		<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
																			<rect x="3" y="3" width="18" height="18" rx="2" />
																			<circle cx="8.5" cy="8.5" r="1.5" />
																			<polyline points="21 15 16 10 5 21" />
																		</svg>
																	) : ["MP4", "MOV", "AVI"].includes(ext) ? (
																		<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
																			<polygon points="23 7 16 12 23 17 23 7" />
																			<rect x="1" y="5" width="15" height="14" rx="2" />
																		</svg>
																	) : (
																		<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
																			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
																			<polyline points="14 2 14 8 20 8" />
																		</svg>
																	)}
																</div>
																<div className="file-card-meta">
																	<div className="file-card-name">{file.name}</div>
																	<div className="file-card-details">
																		<span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
																		<span>•</span>
																		<span className="file-status-tag">✓ Siap Dikelola</span>
																	</div>
																</div>
															</div>

															<div className="file-card-right">
																<button
																	type="button"
																	className="file-remove-button"
																	onClick={() => removeFile(file.id)}
																>
																	<span>Hapus</span>
																</button>
															</div>
														</div>
													);
												})}
											</div>
										</div>
									)}
								</div>
							)}

							{step === 4 && (
								/* --- STEP 4: PRATINJAU & KONFIRMASI --- */
								<form onSubmit={handleSubmit}>
									<h2 className="step-title">Langkah 4: Pratinjau & Konfirmasi Pengiriman</h2>
									<p className="step-desc">
										Periksa kembali ringkasan informasi laporan Anda sebelum dikirimkan ke sistem triase madrasah.
									</p>

									{/* Honeypot field for bot protection */}
									<input
										type="text"
										name="website_url"
										value={honeypot}
										onChange={(e) => setHoneypot(e.target.value)}
										style={{ display: "none" }}
										tabIndex={-1}
										autoComplete="off"
									/>

									<div className="preview-box">
										<div className="preview-row">
											<span className="preview-label">Sifat Pelaporan:</span>
											<span className="preview-val">
												{isAnonymous ? "🔒 Anonim" : `👤 Teridentifikasi (${data.reporterName})`}
											</span>
										</div>
										<div className="preview-row">
											<span className="preview-label">Jenis & Kategori:</span>
											<span className="preview-val">
												{jenis.toUpperCase()} : {kategori}
											</span>
										</div>
										<div className="preview-row">
											<span className="preview-label">Judul Laporan:</span>
											<span className="preview-val">{data.title}</span>
										</div>
										<div className="preview-row">
											<span className="preview-label">Waktu & Lokasi:</span>
											<span className="preview-val">
												{data.eventDate} di {data.location}
											</span>
										</div>
										<div className="preview-row">
											<span className="preview-label">Pihak Terkait:</span>
											<span className="preview-val">{data.partiesInvolved || "Tidak dicantumkan"}</span>
										</div>
										<div className="preview-row">
											<span className="preview-label">Uraian Kejadian:</span>
											<span className="preview-val">{data.chronology}</span>
										</div>
										<div className="preview-row">
											<span className="preview-label">Jumlah Lampiran:</span>
											<span className="preview-val">{uploadedFiles.length} Berkas Bukti</span>
										</div>
									</div>

									{/* Human Security CAPTCHA */}
									<div className="captcha-box">
										<div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
											<span className="captcha-question">
												🔒 Verifikasi Keamanan: Berapa {captchaQuestion.num1} {captchaQuestion.op} {captchaQuestion.num2} = ?
											</span>
											<button
												type="button"
												onClick={refreshCaptcha}
												title="Acak Ulang Soal Verifikasi"
												style={{
													background: "none",
													border: "none",
													cursor: "pointer",
													fontSize: "1.1rem",
													padding: "0.1rem 0.35rem",
													borderRadius: "6px",
													color: "var(--muted)",
												}}
											>
												🔄
											</button>
										</div>
										<input
											type="text"
											className="form-input"
											style={{ maxWidth: "120px" }}
											placeholder="Jawaban"
											value={captchaAns}
											onChange={(e) => setCaptchaAns(e.target.value)}
										/>
									</div>

									{/* Mandatory Agreement Checkbox */}
									<label className="agreement-check">
										<input
											type="checkbox"
											checked={agreed}
											onChange={(e) => setAgreed(e.target.checked)}
										/>
										<span>
											Saya menyatakan dengan sebenar-benarnya bahwa seluruh informasi yang disampaikan dalam laporan ini adalah akurat, benar, dan dapat dipertanggungjawabkan.
										</span>
									</label>

									<div className="form-actions">
										<button type="button" className="btn btn-ghost" onClick={handleBack}>
											Kembali Ke Langkah 3
										</button>
										<button
											type="submit"
											className="btn btn-primary"
											disabled={processing || !agreed || captchaAns.trim() !== String(captchaQuestion.expected)}
										>
											{processing ? "Mengirim Laporan..." : "Kirim Laporan Resmi"}
										</button>
									</div>
								</form>
							)}

							{/* Stepper Navigation Actions for Steps 1-3 */}
							{step < 4 && (
								<div className="form-actions">
									{step > 1 ? (
										<button type="button" className="btn btn-ghost" onClick={handleBack}>
											Kembali
										</button>
									) : (
										<Link href="/" className="btn btn-ghost">
											Batal
										</Link>
									)}

									<button type="button" className="btn btn-primary" onClick={handleNext}>
										{step === 1
											? "Lanjut Ke Detail Peristiwa"
											: step === 2
												? "Lanjut Ke Unggah Bukti"
												: "Tinjau & Kirim Laporan"}
									</button>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</div>

		{/* --- Printable Proof Document (Tanda Terima Laporan Resmi) --- */}
		{submittedResult && typeof document !== "undefined" && createPortal(
			<div id="print-proof-section">
				<div className="print-header">
					<div className="print-kop-title">KEMENTERIAN AGAMA REPUBLIK INDONESIA</div>
					<div className="print-kop-sub">KANTOR KEMENTERIAN AGAMA KOTA PADANG</div>
					<div className="print-kop-name">MADRASAH TSANAWIYAH NEGERI 3 KOTA PADANG</div>
					<div className="print-kop-address">
						Jl. Raya Lubuk Minturun, Kel. Koto Panjang Ikur Koto, Kec. Koto Tangah, Kota Padang | Email: info@mtsn3padang.sch.id
					</div>
					<div className="print-kop-divider" />
				</div>

				<div className="print-doc-title">
					<h2>TANDA TERIMA PENDAFTARAN LAPORAN / PENGADUAN</h2>
					<p>Kanal Resmi Integrity & Whistleblowing System MTsN 3 Kota Padang</p>
				</div>

				<div className="print-code-box">
					<div className="print-code-item">
						<span className="print-code-label">NOMOR TIKET LAPORAN</span>
						<span className="print-code-value">{submittedResult.ticketNumber}</span>
					</div>
					<div className="print-code-item">
						<span className="print-code-label">KODE RAHASIA PELACAKAN</span>
						<span className="print-code-value">{submittedResult.secretCode}</span>
					</div>
				</div>

				<table className="print-table">
					<tbody>
						<tr>
							<th>Tanggal Registrasi</th>
							<td>{new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} WIB</td>
						</tr>
						<tr>
							<th>Sifat Pelaporan</th>
							<td>{isAnonymous ? "Anonim (Identitas Diberahasiakan)" : "Teridentifikasi"}</td>
						</tr>
						{!isAnonymous && (
							<>
								<tr>
									<th>Nama Pelapor</th>
									<td>{data.reporterName || "-"}</td>
								</tr>
								<tr>
									<th>Kontak Pelapor</th>
									<td>{data.reporterPhone || "-"} {data.reporterEmail ? `(${data.reporterEmail})` : ""}</td>
								</tr>
							</>
						)}
						<tr>
							<th>Jenis Laporan</th>
							<td>{jenis.toUpperCase()}</td>
						</tr>
						<tr>
							<th>Kategori Peristiwa</th>
							<td>{kategori}</td>
						</tr>
						<tr>
							<th>Judul Laporan</th>
							<td>{data.title}</td>
						</tr>
						<tr>
							<th>Waktu & Lokasi Peristiwa</th>
							<td>{data.eventDate || "-"} {data.location ? `di ${data.location}` : ""}</td>
						</tr>
						<tr>
							<th>Pihak Terkait / Terlapor</th>
							<td>{data.partiesInvolved || "Tidak dicantumkan"}</td>
						</tr>
						<tr>
							<th>Uraian Kronologi</th>
							<td style={{ whiteSpace: "pre-wrap" }}>{data.chronology}</td>
						</tr>
						<tr>
							<th>Lampiran Bukti</th>
							<td>{uploadedFiles.length > 0 ? `${uploadedFiles.length} berkas bukti terlampir` : "Tidak ada berkas bukti"}</td>
						</tr>
					</tbody>
				</table>

				<div className="print-notice">
					<strong>PETUNJUK PELACAKAN PETUGAS:</strong>
					<p>
						Simpan Bukti Pendaftaran dan Kode Rahasia ini secara aman. Anda dapat memantau progres penanganan, membaca tanggapan petugas, dan membalas permintaan konfirmasi melalui halaman <strong>Lacak Laporan</strong> pada situs web resmi kami: <u>https://lapor.mtsn3padang.sch.id/lacak</u>.
					</p>
				</div>

				<div className="print-signature-block">
					<div className="print-sig-col">
						<p>Sistem Pelaporan Elektronik,</p>
						<div className="print-qr-wrapper">
							<QrCodeSvg
								text={`https://lapor.mtsn3padang.sch.id/lacak?ticket=${submittedResult.ticketNumber}&code=${submittedResult.secretCode}`}
								size={105}
								color="#0f172a"
							/>
							<div className="print-qr-caption">
								VERIFIED DIGITAL RECEIPT<br />
								CODE: {submittedResult.secretCode}
							</div>
						</div>
						<p><strong>Tim Triase & Integritas MTsN 3 Kota Padang</strong></p>
					</div>
				</div>
			</div>,
			document.body,
		)}
		</>
	);
}

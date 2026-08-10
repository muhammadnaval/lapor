import { Head, Link, router } from "@inertiajs/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatDateTime } from "../../shared/date";
import { QrCodeSvg } from "../utils/qr";
import "./Lacak.css";

interface MessageItem {
	id: string;
	sender: "officer" | "reporter";
	senderName: string;
	content: string;
	createdAt: string;
}

interface ReportDataPayload {
	id: string;
	ticketNumber: string;
	title: string;
	jenis: string;
	kategori: string;
	status: string;
	createdAt: string;
	slaTarget: string;
	eventDate: string;
	location: string;
	chronology: string;
	unitDisposisi: string;
	isAnonymous: boolean;
	reporterName?: string;
	messages: Array<{
		id?: string;
		sender: "officer" | "reporter";
		senderName: string;
		content: string;
		date: string;
	}>;
	attachments: Array<{
		name: string;
		size: string;
		uploadId?: string;
		id?: number | string;
	}>;
}

const buildTimeline = (status: string, createdAt: string, unitDisposisi: string) => {
	const formattedDate = formatDateTime(createdAt);
	const order = ["terkirim", "verifikasi", "proses", "selesai"];
	const currentIdx = Math.max(0, order.indexOf((status || "terkirim").toLowerCase()));

	const getState = (stepKey: string) => {
		const targetIdx = order.indexOf(stepKey);
		if (currentIdx === targetIdx) return "current";
		if (currentIdx > targetIdx) return "past";
		return "future";
	};

	return [
		{
			label: "Laporan Terkirim",
			date: formattedDate,
			desc: "Laporan berhasil terdaftar dalam sistem dan siap dilakukan verifikasi awal.",
			state: getState("terkirim"),
		},
		{
			label: "Verifikasi Awal",
			date: getState("verifikasi") !== "future" ? formattedDate : "Menunggu Verifikasi",
			desc: "Tim Triase memverifikasi kelengkapan bukti dan menetapkan prioritas.",
			state: getState("verifikasi"),
		},
		{
			label: "Dalam Penanganan",
			date: getState("proses") !== "future" ? formattedDate : "Menunggu Disposisi",
			desc: `Kasus didisposisikan kepada ${unitDisposisi || "Tim Petugas"} untuk penanganan.`,
			state: getState("proses"),
		},
		{
			label: "Penyelesaian & Penutupan",
			date: getState("selesai") === "past" ? formattedDate : "Dalam Proses",
			desc: "Keputusan hasil penanganan dan penyusunan rekomendasi perbaikan.",
			state: getState("selesai"),
		},
	];
};

export default function Lacak({
	initialNomor,
	reportData,
	error,
	errors,
}: {
	initialNomor?: string;
	reportData?: ReportDataPayload | null;
	error?: string | null;
	errors?: Record<string, string>;
}) {
	const [ticketInput, setTicketInput] = useState<string>(initialNomor || "");
	const [secretInput, setSecretInput] = useState<string>("");
	const [showSecret, setShowSecret] = useState<boolean>(false);
	const [searchError, setSearchError] = useState<string | null>(null);

	const activeReport = reportData || null;

	const [replyContent, setReplyContent] = useState<string>("");
	const [messagesList, setMessagesList] = useState<MessageItem[]>([]);
	const [attachmentsList, setAttachmentsList] = useState<
		Array<{
			name: string;
			size: string;
			uploadId?: string;
			id?: number | string;
		}>
	>([]);
	const [uploadingFile, setUploadingFile] = useState<boolean>(false);

	useEffect(() => {
		if (reportData?.messages) {
			setMessagesList(
				reportData.messages.map((m, idx) => ({
					id: m.id || `m_${idx}`,
					sender: m.sender,
					senderName: m.senderName,
					content: m.content,
					createdAt: m.date,
				})),
			);
		}
		if (reportData?.attachments) {
			setAttachmentsList(reportData.attachments);
		}
	}, [reportData]);

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		setSearchError(null);

		if (!ticketInput.trim()) {
			setSearchError("Masukkan Nomor Laporan Anda.");
			return;
		}
		if (!secretInput.trim()) {
			setSearchError("Masukkan Kode Rahasia Pelacakan yang Anda terima saat melapor.");
			return;
		}

		router.post(
			"/lacak",
			{
				ticketNumber: ticketInput.trim(),
				secretCode: secretInput.trim(),
			},
			{
				onError: (errs) => {
					if (errs.tracking) {
						setSearchError(errs.tracking);
					}
				},
			},
		);
	};

	const handleSendMessage = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!replyContent.trim() || !activeReport) return;

		const content = replyContent.trim();

		try {
			const res = await fetch(`/lacak/${activeReport.ticketNumber}/pesan`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content }),
			});
			if (!res.ok) throw new Error("Gagal mengirimkan pesan balasan.");

			setMessagesList((prev) => [
				...prev,
				{
					id: Math.random().toString(36).slice(2),
					sender: "reporter",
					senderName: activeReport.isAnonymous
						? "Pelapor (Anonim)"
						: activeReport.reporterName || "Pelapor",
					content,
					createdAt: new Date().toISOString(),
				},
			]);
			setReplyContent("");
		} catch (err: any) {
			alert(`⚠️ Gagal mengirim pesan: ${err?.message || err}`);
		}
	};

	const handleAdditionalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0 || !activeReport) return;
		const file = files[0];
		if (!file) return;

		setUploadingFile(true);

		try {
			// 1. Initiate TUS Upload
			const res = await fetch("/uploads", {
				method: "POST",
				headers: {
					"Tus-Resumable": "1.0.0",
					"Upload-Length": String(file.size),
					"Upload-Metadata": `filename ${btoa(file.name)},filetype ${btoa(file.type || "application/octet-stream")}`,
				},
			});
			if (!res.ok) throw new Error("Gagal menginisialisasi server pengunggahan.");

			const location = res.headers.get("Location") || "";
			const uploadId = location.split("/").pop() || "";
			if (!uploadId) throw new Error("ID unggahan tidak dapat diterbitkan.");

			// 2. Transmit binary bytes chunk to /uploads/:uploadId
			const buffer = await file.arrayBuffer();
			const patchRes = await fetch(`/uploads/${uploadId}`, {
				method: "PATCH",
				headers: {
					"Tus-Resumable": "1.0.0",
					"Content-Type": "application/offset+octet-stream",
					"Upload-Offset": "0",
				},
				body: buffer,
			});
			if (!patchRes.ok) throw new Error("Gagal mengirimkan byte berkas ke server.");

			// 3. Link attachment to case via POST /lacak/:nomor/lampiran
			const attachRes = await fetch(`/lacak/${activeReport.ticketNumber}/lampiran`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					uploadId,
					fileName: file.name,
					fileSize: file.size,
					mimeType: file.type || "application/octet-stream",
				}),
			});

			if (!attachRes.ok) throw new Error("Gagal mendaftarkan lampiran pada laporan.");

			const newAttachment = {
				name: file.name,
				size: `${(file.size / 1024).toFixed(1)} KB`,
				uploadId,
			};
			setAttachmentsList((prev) => [...prev, newAttachment]);
			alert(`✓ Berkas "${file.name}" berhasil diunggah dan terlampir pada laporan!`);
		} catch (err: any) {
			alert(`⚠️ Gagal mengunggah bukti tambahan: ${err?.message || err}`);
		} finally {
			setUploadingFile(false);
			e.target.value = "";
		}
	};

	const displayError = error || errors?.tracking || searchError;
	const timeline = activeReport
		? buildTimeline(activeReport.status, activeReport.createdAt, activeReport.unitDisposisi)
		: [];

	return (
		<div className="lacak-wrapper">
			<Head title="Lacak Status Laporan" />

			<div className="lacak-container">
				{!activeReport ? (
					/* --- Search View --- */
					<div className="lacak-search-card">
						<div className="lacak-search-head">
							<div className="lacak-search-icon">🔍</div>
							<h1 className="lacak-search-title">Lacak Status Laporan</h1>
							<p className="lacak-search-sub">
								Masukkan Nomor Laporan dan Kode Rahasia Pelacakan Anda untuk melihat perkembangan tindak lanjut dan berkomunikasi dengan petugas.
							</p>
						</div>

						<div className="security-notice-card">
							<span style={{ fontSize: "1.2rem" }}>🔒</span>
							<div>
								<strong>Akses Rahasia Terlindungi:</strong> Pencarian laporan membutuhkan kombinasi Nomor Laporan dan Kode Rahasia yang diterbitkan saat pengiriman. Percobaan gagal dibatasi untuk mencegah pencarian tidak berwenang.
							</div>
						</div>

						{displayError && (
							<div
								style={{
									background: "#fef2f2",
									border: "1px solid #fecaca",
									color: "#991b1b",
									padding: "0.85rem 1rem",
									borderRadius: "8px",
									marginBottom: "1.5rem",
									fontSize: "0.9rem",
									fontWeight: 500,
								}}
							>
								{displayError}
							</div>
						)}

						<form onSubmit={handleSearch} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
							<div className="form-group">
								<label className="form-label" htmlFor="ticketNum">
									Nomor Laporan <span className="form-req">*</span>
								</label>
								<input
									id="ticketNum"
									type="text"
									className="form-input"
									placeholder="Contoh: LPR-202608-IH7OMJ"
									value={ticketInput}
									onChange={(e) => setTicketInput(e.target.value)}
								/>
							</div>

							<div className="form-group">
								<label className="form-label" htmlFor="secretCode">
									Kode Rahasia Pelacakan <span className="form-req">*</span>
								</label>
								<div style={{ position: "relative" }}>
									<input
										id="secretCode"
										type={showSecret ? "text" : "password"}
										className="form-input"
										placeholder="Contoh: KDE-EFQM-35H9"
										value={secretInput}
										onChange={(e) => setSecretInput(e.target.value)}
										style={{ paddingRight: "4rem" }}
									/>
									<button
										type="button"
										onClick={() => setShowSecret((v) => !v)}
										style={{
											position: "absolute",
											right: "0.75rem",
											top: "50%",
											transform: "translateY(-50%)",
											background: "transparent",
											border: "none",
											color: "var(--muted)",
											fontSize: "0.8rem",
											fontWeight: 600,
											cursor: "pointer",
										}}
									>
										{showSecret ? "Sembunyikan" : "Tampilkan"}
									</button>
								</div>
							</div>

							<button type="submit" className="btn btn-primary btn-block" style={{ marginTop: "0.5rem" }}>
								🔍 Lacak Status Laporan
							</button>

							<div style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.88rem" }}>
								Belum membuat laporan?{" "}
								<Link href="/lapor" style={{ color: "var(--primary)", fontWeight: 600 }}>
									Buat Laporan Baru Di Sini
								</Link>
							</div>
						</form>
					</div>
				) : (
					/* --- Detail View --- */
					<div>
						<div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
							<button
								type="button"
								className="btn btn-ghost"
								onClick={() => {
									router.get("/lacak");
								}}
							>
								← Cari Laporan Lain
							</button>

							<button
								type="button"
								className="btn btn-ghost"
								onClick={() => window.print()}
							>
								🖨️ Cetak Bukti Laporan
							</button>
						</div>

						{/* Header Card */}
						<div className="lacak-detail-head">
							<div className="detail-top-bar">
								<div>
									<span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600, display: "block" }}>
										NOMOR LAPORAN
									</span>
									<span className="ticket-number-badge">{activeReport.ticketNumber}</span>
								</div>

								<div className={`status-badge status-${activeReport.status}`}>
									● {activeReport.status === "proses" ? "Dalam Penanganan" : activeReport.status.toUpperCase()}
								</div>
							</div>

							<div className="detail-meta-grid">
								<div className="meta-item">
									<span className="meta-item-label">Sifat Pelaporan</span>
									<span className="meta-item-val">
										{activeReport.isAnonymous ? "🔒 Anonim" : "👤 Teridentifikasi"}
									</span>
								</div>

								<div className="meta-item">
									<span className="meta-item-label">Jenis & Kategori</span>
									<span className="meta-item-val">
										{activeReport.jenis} ({activeReport.kategori})
									</span>
								</div>

								<div className="meta-item">
									<span className="meta-item-label">Tanggal Masuk</span>
									<span className="meta-item-val">{formatDateTime(activeReport.createdAt)}</span>
								</div>

								<div className="meta-item">
									<span className="meta-item-label">Target SLA Penanganan</span>
									<span className="meta-item-val" style={{ color: "var(--primary)" }}>
										{activeReport.slaTarget}
									</span>
								</div>
							</div>
						</div>

						{/* Linimasa Status (Timeline) */}
						<div className="timeline-card">
							<h2 className="timeline-title">Linimasa Perkembangan Kasus</h2>
							<div className="timeline-list">
								{timeline.map((item, idx) => (
									<div
										key={item.label}
										className={`timeline-item ${
											item.state === "current"
												? "timeline-item-active"
												: item.state === "past"
													? "timeline-item-past"
													: ""
										}`}
									>
										<div className="timeline-dot">{item.state === "past" ? "✓" : idx + 1}</div>
										<div className="timeline-item-title">{item.label}</div>
										<div className="timeline-item-date">{item.date}</div>
										<div className="timeline-item-desc">{item.desc}</div>
									</div>
								))}
							</div>
						</div>

						{/* Detail Ringkasan Laporan */}
						<div className="report-summary-card">
							<h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 1.25rem" }}>
								Detail Informasi Laporan
							</h2>

							<div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.92rem" }}>
								<div>
									<span style={{ fontWeight: 600, color: "var(--muted)", display: "block" }}>
										Judul Laporan:
									</span>
									<span style={{ fontWeight: 700, fontSize: "1.05rem" }}>{activeReport.title}</span>
								</div>

								<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
									<div>
										<span style={{ fontWeight: 600, color: "var(--muted)", display: "block" }}>
											Tanggal Kejadian:
										</span>
										<span>{activeReport.eventDate}</span>
									</div>
									<div>
										<span style={{ fontWeight: 600, color: "var(--muted)", display: "block" }}>
											Lokasi Peristiwa:
										</span>
										<span>{activeReport.location}</span>
									</div>
								</div>

								<div>
									<span style={{ fontWeight: 600, color: "var(--muted)", display: "block" }}>
										Uraian Peristiwa:
									</span>
									<div
										style={{
											background: "var(--bg)",
											padding: "1rem",
											borderRadius: "8px",
											marginTop: "0.35rem",
											lineHeight: 1.6,
										}}
									>
										{activeReport.chronology}
									</div>
								</div>

								<div>
									<span style={{ fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "0.5rem" }}>
										Berkas Bukti Terlampir ({attachmentsList.length}):
									</span>
									<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
										{attachmentsList.length === 0 ? (
											<span style={{ fontSize: "0.86rem", color: "var(--muted)", fontStyle: "italic" }}>
												Belum ada berkas bukti terlampir.
											</span>
										) : (
											attachmentsList.map((file, idx) => (
												<div
													key={file.name + idx}
													style={{
														display: "flex",
														alignItems: "center",
														justifyContent: "space-between",
														background: "var(--bg)",
														padding: "0.65rem 0.85rem",
														borderRadius: "8px",
														border: "1px solid var(--border)",
													}}
												>
													<span style={{ fontWeight: 600, fontSize: "0.88rem" }}>📎 {file.name}</span>
													<div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
														<span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{file.size}</span>
														<a
															href={`/uploads/${file.uploadId || file.id || 'attachment'}`}
															target="_blank"
															rel="noreferrer"
															className="btn btn-ghost"
															style={{ fontSize: "0.78rem", padding: "0.25rem 0.5rem" }}
														>
															⬇️ Unduh
														</a>
													</div>
												</div>
											))
										)}
									</div>
								</div>
							</div>
						</div>

						{/* Kotak Pesan Kasus (Two-Way Messaging) */}
						<div className="messages-card">
							<h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 1.25rem" }}>
								Kotak Pesan Kasus (Komunikasi Petugas & Pelapor)
							</h2>

							<div className="messages-thread">
								{messagesList.map((msg) => (
									<div
										key={msg.id}
										className={`message-bubble ${
											msg.sender === "officer" ? "message-officer" : "message-reporter"
										}`}
									>
										<span className="message-sender-name">{msg.senderName}</span>
										<div>{msg.content}</div>
										<span className="message-time">{formatDateTime(msg.createdAt)}</span>
									</div>
								))}
							</div>

							<form onSubmit={handleSendMessage} className="message-input-form">
								<div className="form-group">
									<label className="form-label" htmlFor="replyText">
										Kirim Balasan / Tanggapan Kepada Petugas
									</label>
									<textarea
										id="replyText"
										className="form-textarea"
										placeholder="Tulis pesan balasan atau informasi tambahan di sini..."
										value={replyContent}
										onChange={(e) => setReplyContent(e.target.value)}
										style={{ minHeight: "90px" }}
									/>
								</div>

								<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
									<label
										className="btn btn-ghost"
										style={{ fontSize: "0.86rem", cursor: uploadingFile ? "not-allowed" : "pointer" }}
									>
										<input
											type="file"
											onChange={handleAdditionalUpload}
											disabled={uploadingFile}
											style={{ display: "none" }}
										/>
										{uploadingFile ? "⏳ Mengunggah Berkas..." : "📎 Unggah Bukti Tambahan"}
									</label>

									<button type="submit" className="btn btn-primary">
										Kirim Pesan Balasan
									</button>
								</div>
							</form>
						</div>
					</div>
				)}
			</div>

			{/* Printable Proof Section Portal */}
			{activeReport && typeof document !== "undefined" && createPortal(
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
							<span className="print-code-value">{activeReport.ticketNumber}</span>
						</div>
					</div>

					<table className="print-table">
						<tbody>
							<tr>
								<th>Tanggal Registrasi</th>
								<td>{formatDateTime(activeReport.createdAt)}</td>
							</tr>
							<tr>
								<th>Sifat Pelaporan</th>
								<td>{activeReport.isAnonymous ? "Anonim (Identitas Diberahasiakan)" : "Teridentifikasi"}</td>
							</tr>
							{!activeReport.isAnonymous && activeReport.reporterName && (
								<tr>
									<th>Nama Pelapor</th>
									<td>{activeReport.reporterName}</td>
								</tr>
							)}
							<tr>
								<th>Jenis Laporan</th>
								<td>{activeReport.jenis.toUpperCase()}</td>
							</tr>
							<tr>
								<th>Kategori Peristiwa</th>
								<td>{activeReport.kategori}</td>
							</tr>
							<tr>
								<th>Judul Laporan</th>
								<td>{activeReport.title}</td>
							</tr>
							<tr>
								<th>Waktu & Lokasi Peristiwa</th>
								<td>{activeReport.eventDate || "-"} {activeReport.location ? `di ${activeReport.location}` : ""}</td>
							</tr>
							<tr>
								<th>Uraian Kronologi</th>
								<td style={{ whiteSpace: "pre-wrap" }}>{activeReport.chronology}</td>
							</tr>
							<tr>
								<th>Lampiran Bukti</th>
								<td>{attachmentsList.length > 0 ? `${attachmentsList.length} berkas bukti terlampir` : "Tidak ada berkas bukti"}</td>
							</tr>
						</tbody>
					</table>

					<div className="print-notice">
						<strong>PETUNJUK PELACAKAN PETUGAS:</strong>
						<p>
							Simpan Bukti Pendaftaran dan Nomor Tiket ini secara aman. Anda dapat memantau progres penanganan dan membaca tanggapan petugas melalui halaman <strong>Lacak Laporan</strong> pada situs web resmi kami: <u>https://lapor.mtsn3padang.sch.id/lacak</u>.
						</p>
					</div>

					<div className="print-signature-block">
						<div className="print-sig-col">
							<p>Sistem Pelaporan Elektronik,</p>
							<div className="print-qr-wrapper">
								<QrCodeSvg
									text={`https://lapor.mtsn3padang.sch.id/lacak?ticket=${activeReport.ticketNumber}`}
									size={105}
									color="#0f172a"
								/>
								<div className="print-qr-caption">
									VERIFIED DIGITAL RECEIPT<br />
									TICKET: {activeReport.ticketNumber}
								</div>
							</div>
							<p><strong>Tim Triase & Integritas MTsN 3 Kota Padang</strong></p>
						</div>
					</div>
				</div>,
				document.body,
			)}
		</div>
	);
}

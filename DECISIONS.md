# DECISIONS.md — Catatan Keputusan Arsitektur & Produk

> **LAPOR MTsN 3 Kota Padang**

---

## 1. Keputusan Jenis Laporan Ke-3 (Open Decision)

- **Keputusan**: Ditetapkan sebagai **`Aspirasi & Saran Konstruktif`**.
- **Rasional**: Mendukung fungsi pengawasan partisipatif masyarakat/wali murid terhadap mutu pendidikan dan layanan madrasah di luar aduan kasus atau dugaan korupsi.
- **Konfigurasi SLA**: Prioritas default *Rendah*, tenggat waktu respons awal *72 jam kerja*, penyelesaian *15 hari kerja*, unit disposisi default *Subbagian Tata Usaha*.

---

## 2. Keputusan Penyimpanan Identitas Pelapor (Whistleblower Protection)

- **Keputusan**: Identitas pelapor non-anonim dipisahkan ke tabel `reporter_identities` dan dienkripsi dengan AES-256-GCM.
- **Rasional**: Mencegah kebocoran data identitas pelapor melalui *data breach* atau dump SQL mentah.

---

## 3. Keputusan Database Engine & ORM

- **Keputusan**: Menggunakan `bun:sqlite` bawaan Bun tanpa ORM.
- **Rasional**: Memberikan performa maksimal (>90K write/s), keterbacaan query tinggi, dan konsistensi migrasi teratur.

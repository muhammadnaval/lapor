# SECURITY.md — Kebijakan Keamanan & Hardening

> **LAPOR MTsN 3 Kota Padang**

---

## 1. Kebijakan Kepatuhan Keamanan

Sistem **LAPOR MTsN 3 Kota Padang** dirancang mematuhi prinsip *Security by Design* dan *Privacy by Default*:

1. **Perlindungan Whistleblower**:
   - Mode anonim tidak mengumpulkan nama, email, atau nomor telepon.
   - Identitas pelapor non-anonim diisolasi pada tabel `reporter_identities` dan dienkripsi dengan **AES-256-GCM**.
   - Hak akses `view_reporter_identity` dibatasi hanya untuk peran Admin / Investigasi dan wajib mencantumkan alasan yang dicatat di `report_access_logs`.

2. **Otentikasi & Keamanan Sesi**:
   - Kata sandi akun dan kode pelacakan disimpan menggunakan **Argon2id**.
   - Cookie sesi dikonfigurasi dengan flag `HttpOnly`, `SameSite=Lax/Strict`, dan `Secure` pada mode produksi.
   - Rotasi sesi dilakukan pada setiap login/logout untuk mencegah *Session Fixation*.

3. **Pencegahan Vektor Serangan Utama**:
   - **SQL Injection**: 100% query menggunakan parameter *prepared statement* SQLite.
   - **XSS (Cross-Site Scripting)**: Virtual DOM React menyaring sintaks HTML. Berkas unggahan dilindungi oleh Content Security Policy `script-src 'none'`.
   - **CSRF**: Pengecekan origin header otomatis pada request mutasi (POST/PUT/DELETE/PATCH).
   - **Brute Force**: In-memory rate-limiter fixed-window membatasi request per IP pada endpoint sensitif (`/lapor`, `/lacak`, `/login`).

---

## 2. Redaksi Data Sensitif

Data pribadi pelapor, kata sandi, dan token sesi ter-redaksi secara ketat:
- Dilarang muncul di URL query string.
- Dilarang dicatat di server console / file log.
- Dilarang disertakan pada props Inertia publik.

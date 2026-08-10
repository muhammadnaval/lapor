# ARCHITECTURE.md — LAPOR MTsN 3 Kota Padang

> **Sistem Pengaduan dan Whistleblowing Resmi MTsN 3 Kota Padang**  
> **Arsitektur**: Dulak (Bun + Hono 4.x + `bun:sqlite` WAL zero-ORM + Inertia v3 React 19 + TypeBox)

---

## 1. Ikhtisar Sistem

**LAPOR MTsN 3 Kota Padang** dirancang sebagai portal publik pengaduan masyarakat dan *whistleblowing system* terintegrasi. Sistem mengedepankan isolasi data identitas pelapor, verifikasi pelacakan ber-entropi tinggi, dan manajemen penanganan kasus berbasis SLA jam kerja `Asia/Jakarta`.

```
                +-------------------------------------------------+
                |   Peramban Web / Client (React 19 + Inertia v3) |
                +-------------------------------------------------+
                                         |
                                         | HTTP / JSON / Tus Protocol
                                         v
+----------------------------------------------------------------------------------+
|                              Server Application (Bun + Hono 4.x)                 |
|                                                                                  |
|  +---------------------+   +-----------------------+   +----------------------+  |
|  | Request Logger &    |   | Security & CSRF       |   | Rate Limiter         |  |
|  | Correlation ID      |   | Origin Check          |   | Fixed-Window         |  |
|  +---------------------+   +-----------------------+   +----------------------+  |
|                                                                                  |
|  +---------------------+   +-----------------------+   +----------------------+  |
|  | State Machine       |   | AES-256-GCM Crypto    |   | SLA Engine           |  |
|  | Status Validator    |   | Identity Vault        |   | Asia/Jakarta         |  |
|  +---------------------+   +-----------------------+   +----------------------+  |
+----------------------------------------------------------------------------------+
                                         |
                                         | Synchronous Prepared Statements (Zero-ORM)
                                         v
+----------------------------------------------------------------------------------+
|                            SQLite Database (bun:sqlite)                          |
|  - WAL Journaling Mode                                                           |
|  - Synchronous = NORMAL                                                          |
|  - Busy Timeout = 5000ms                                                         |
|  - Foreign Key Constraints ON                                                    |
+----------------------------------------------------------------------------------+
```

---

## 2. Struktur Modul Utama

- **`src/server/db.ts`**: Layer `bun:sqlite` terpusat. Mengelola koneksi, eksekusi migrasi otomatis pada startup, dan seluruh *prepared statement* terkompilasi.
- **`src/server/crypto.ts`**: Modul enkripsi simetris AES-256-GCM berbasis `scryptSync` untuk mengisolasi identitas pelapor non-anonim.
- **`src/server/state-machine.ts`**: Pengatur siklus hidup status laporan (`Terkirim` → `Verifikasi Awal` → `Dalam Penanganan` → `Selesai` / `Ditutup`).
- **`src/server/sla.ts`**: Engine kalkulasi tenggat waktu penyelesaian berdasarkan prioritas dan jam kerja zona waktu `Asia/Jakarta`.
- **`src/server/audit.ts`**: Layanan pencatatan audit trail append-only dan pembukaan perizinan `view_reporter_identity`.
- **`src/server/notifications.ts`**: Queue antrean dan pengiriman notifikasi email idempotent.
- **`src/server/routes/*.routes.ts`**: Pengorganisasian endpoint modular per URL namespace (`auth`, `lapor`, `lacak`, `pages`, `uploads`, `profile`).

---

## 3. Alur Data Utama

### Pembuatan Laporan Baru (`POST /lapor`)
1. Client mengirim payload laporan via Inertia XHR / multipart.
2. Server memvalidasi input dengan TypeBox (`ReportCreateSchema`).
3. Meng-generate nomor tiket `LPR-YYYYMM-XXXXXX` dan kode rahasia `KDE-XXXX-XXXX`.
4. Kode rahasia di-hash dengan **Argon2id**.
5. Jika pelapor teridentifikasi, data nama/email/telepon dienkripsi dengan **AES-256-GCM** dan disimpan ke tabel terpisah `reporter_identities`.
6. Transaksi SQLite menyimpan record `reports`, `reporter_identities`, dan `audit_logs`.
7. Mengembalikan nomor tiket dan kode rahasia sekali tampil ke pelapor.

### Pelacakan Laporan (`POST /lacak`)
1. Pelapor menginput nomor tiket dan kode rahasia.
2. Server mencari laporan dan memverifikasi kode rahasia dengan `Bun.password.verify(code, hash)`.
3. Mengembalikan data linimasa status publik dan obrolan dua arah. Catatan internal (`is_internal_note = 1`) **0% ditampilkan**.

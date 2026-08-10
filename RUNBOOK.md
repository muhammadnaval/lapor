# RUNBOOK.md — Panduan Operasional, Observabilitas & Penanganan Insiden

> **Sistem Informasi Layanan Pengaduan & Whistleblowing (LAPOR) MTsN 3 Kota Padang**

---

## 1. Daftar Variabel Lingkungan (Environment Variables)

| Variabel | Wajib | Contoh / Default | Deskripsi |
| :--- | :---: | :--- | :--- |
| `PORT` | ❌ | `4000` | Port HTTP tempat Bun.serve mendengarkan koneksi. |
| `NODE_ENV` | ❌ | `production` | Mode eksekusi (`development` \| `production` \| `test`). |
| `APP_URL` | ✅ | `http://localhost:4000` | URL publik instansi (digunakan untuk callback OAuth & pranala email). |
| `DATABASE_PATH` | ❌ | `./data/app.sqlite` | Jalur berkas basis data SQLite utama. |
| `SESSION_SECRET` | ✅ | `lapor_secret_key_v1_random` | Kunci rahasia enkripsi AES-256-GCM identitas pelapor & token sesi. |
| `SSR` | ❌ | `true` | Mengaktifkan Server-Side Rendering (Inertia React 19). |
| `RATE_LIMIT_GLOBAL_MAX` | ❌ | `2000` | Batas maksimum request per IP per 60 detik (DDoS baseline). |
| `RATE_LIMIT_AUTH_MAX` | ❌ | `30` | Batas maksimum login/register per IP per 60 detik. |

---

## 2. Perintah Operasional Rutin

```bash
# 1. Validasi Tipe TypeScript
bun run typecheck

# 2. Eksekusi Suite Pengujian Terisolasi (Must 100% Pass)
bun test --isolate

# 3. Kompilasi Aset Produksi
bun run build

# 4. Uji Beban & Konkurrensi (Load Test)
bun scripts/load-test.ts

# 5. Eksekusi Backup SQLite & Restore Drill
bun scripts/restore.ts
```

---

## 3. Titik Pantau Observabilitas & Kesehatan System (Health Checks)

- **Probe Liveness & Readiness**: `GET /health`
  - Respon normal (`200 OK`):
    ```json
    {
      "status": "ok",
      "uptime": 124.5,
      "timestamp": "2026-08-08T18:46:43.000Z",
      "database": "connected",
      "memory": {
        "rssMb": "64.2",
        "heapTotalMb": "32.1",
        "heapUsedMb": "24.5"
      }
    }
    ```
  - Respon terganggu (`503 Service Unavailable`): Apabila koneksi basis data SQLite gagal atau terputus.

---

## 4. Penanganan Insiden (Troubleshooting & Incident Response)

### A. Penguncian Basis Data (`SQLITE_BUSY`)
- **Gejala**: Log aplikasi mencatat `SQLITE_BUSY: database is locked`.
- **Penyebab**: Transaksi penulisan bersamaan yang intensif melebihi batas waktu tunggu.
- **Tindakan**:
  1. Pastikan mode WAL (*Write-Ahead Logging*) aktif (`PRAGMA journal_mode = WAL;`).
  2. Verifikasi batas waktu tunggu `busy_timeout` diatur minimal 5000ms.

### B. Dugaan Kebocoran Akses Identitas Whistleblower
- **Gejala**: Adanya laporan akses tak dikenal pada berkas ekspor identitas.
- **Tindakan**:
  1. Buka halaman `/admin` &rarr; Tab **Audit Log & Keamanan**.
  2. Filter aktivitas `Ekspor Berkas CSV (Identitas Unredacted)` atau `Buka Identitas`.
  3. Periksa `actorName`, `ipAddress`, dan `detail` alasan yang dicatat.
  4. Apabila ditemukan pelanggaran, bekukan akun petugas terkait via database (`UPDATE users SET role = 'user' WHERE id = ?`).

### C. Kegagalan Pengunggahan Berkas Lampiran (Tus Protocol Error)
- **Gejala**: Klien menerima HTTP 409 (Conflict Offset) atau HTTP 413 (Payload Too Large).
- **Tindakan**:
  1. Periksa batas kapasitas direktori `./data/uploads`.
  2. Jalankan pembersihan potongan berkas parsial yang kedaluwarsa.

---

## 5. Prosedur Tanggap Darurat Bencana (Disaster Recovery & Restore Drill)

Apabila terjadi kerusakan server atau kegagalan perangkat keras:
1. Ambil berkas cadangan terbaru dari `./data/backups/lapor_backup_*.sqlite`.
2. Lakukan restore drill menggunakan perintah:
   ```bash
   bun scripts/restore.ts
   ```
3. Verifikasi pesan keberhasilan `✅ RESTORE DRILL PASSED: 100% DATA INTEGRITY MATCH!`.

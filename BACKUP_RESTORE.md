# BACKUP_RESTORE.md — Prosedur Backup & Restore Drill

> **LAPOR MTsN 3 Kota Padang**

---

## 1. Strategi Backup SQLite WAL & Lampiran Berkas

Sistem SQLite beroperasi dalam mode WAL (*Write-Ahead Logging*). Untuk membuat cadangan data yang konsisten tanpa menghentikan aplikasi:

### 1. Script Backup Otomatis (`scripts/backup.sh`)

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="./data/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_BACKUP="${BACKUP_DIR}/lapor_db_${TIMESTAMP}.sqlite"
UPLOADS_BACKUP="${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz"

mkdir -p "${BACKUP_DIR}"

echo "[1/3] Membuat cadangan basis data SQLite..."
sqlite3 ./data/app.sqlite ".backup '${DB_BACKUP}'"

echo "[2/3] Memeriksa integritas berkas cadangan..."
sqlite3 "${DB_BACKUP}" "PRAGMA integrity_check;"

echo "[3/3] Membuat cadangan berkas lampiran..."
tar -czf "${UPLOADS_BACKUP}" -C ./data uploads

echo "Proses backup selesai: ${DB_BACKUP} & ${UPLOADS_BACKUP}"
```

---

## 2. Prosedur Restore Drill (Verifikasi Pemulihan Data)

Langkah-langkah untuk melakukan simulasi pemulihan (*restore drill*):

1. **Hentikan Layanan Sementara**:
   ```bash
   docker-compose down
   ```

2. **Pulihkan Database dan Berkas Lampiran**:
   ```bash
   cp ./data/backups/lapor_db_YYYYMMDD_HHMMSS.sqlite ./data/app.sqlite
   tar -xzf ./data/backups/uploads_YYYYMMDD_HHMMSS.tar.gz -C ./data
   ```

3. **Jalankan Verifikasi Uji Coba (Test Suite Check)**:
   ```bash
   DATABASE_PATH=./data/app.sqlite bun test --isolate
   ```

4. **Jalankan Kembali Layanan**:
   ```bash
   docker-compose up -d
   ```

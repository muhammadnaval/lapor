#!/bin/bash
set -euo pipefail

BACKUP_DIR="./data/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_BACKUP="${BACKUP_DIR}/lapor_db_${TIMESTAMP}.sqlite"
UPLOADS_BACKUP="${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz"

mkdir -p "${BACKUP_DIR}"

echo "[1/3] Membuat cadangan basis data SQLite WAL..."
sqlite3 ./data/app.sqlite ".backup '${DB_BACKUP}'"

echo "[2/3] Memeriksa integritas berkas cadangan..."
sqlite3 "${DB_BACKUP}" "PRAGMA integrity_check;"

echo "[3/3] Membuat cadangan berkas lampiran uploads..."
if [ -d "./data/uploads" ]; then
  tar -czf "${UPLOADS_BACKUP}" -C ./data uploads
fi

echo "Proses backup selesai: ${DB_BACKUP}"

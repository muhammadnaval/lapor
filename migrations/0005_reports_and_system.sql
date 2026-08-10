-- 0005_reports_and_system.sql — Lapor domain tables for reports, messages, attachments, audit logs, and settings.

CREATE TABLE IF NOT EXISTS reports (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_number    TEXT    NOT NULL UNIQUE,
  secret_code_hash TEXT    NOT NULL,
  jenis            TEXT    NOT NULL CHECK (jenis IN ('Whistleblowing', 'Pengaduan', 'Aspirasi')),
  kategori         TEXT    NOT NULL,
  judul            TEXT    NOT NULL,
  kronologi        TEXT    NOT NULL,
  tanggal_kejadian TEXT,
  lokasi_kejadian  TEXT,
  pihak_terkait    TEXT,
  is_anonymous     INTEGER NOT NULL DEFAULT 1 CHECK (is_anonymous IN (0, 1)),
  reporter_name    TEXT,
  reporter_email   TEXT,
  reporter_phone   TEXT,
  status           TEXT    NOT NULL DEFAULT 'terkirim' CHECK (status IN ('terkirim', 'verifikasi', 'proses', 'selesai', 'ditolak')),
  priority         TEXT    NOT NULL DEFAULT 'Sedang' CHECK (priority IN ('Kritis', 'Tinggi', 'Sedang', 'Rendah')),
  unit_disposisi   TEXT    NOT NULL DEFAULT 'Belum Didisposisikan',
  sla_target       TEXT,
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_reports_ticket ON reports(ticket_number);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_jenis ON reports(jenis);

CREATE TABLE IF NOT EXISTS report_attachments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id   INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  upload_id   TEXT REFERENCES uploads(id) ON DELETE SET NULL,
  file_name   TEXT    NOT NULL,
  file_size   INTEGER NOT NULL,
  mime_type   TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_attachments_report ON report_attachments(report_id);

CREATE TABLE IF NOT EXISTS report_messages (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id        INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  sender_type      TEXT    NOT NULL CHECK (sender_type IN ('pelapor', 'petugas')),
  sender_name      TEXT    NOT NULL,
  content          TEXT    NOT NULL,
  is_internal_note INTEGER NOT NULL DEFAULT 0 CHECK (is_internal_note IN (0, 1)),
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_report ON report_messages(report_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_name TEXT    NOT NULL,
  action     TEXT    NOT NULL,
  target     TEXT,
  ip_address TEXT    NOT NULL DEFAULT '127.0.0.1',
  detail     TEXT,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS system_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

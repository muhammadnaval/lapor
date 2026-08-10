-- 0006_reporter_identities_and_rbac.sql — Separate reporter identity storage and permission access log table.

CREATE TABLE IF NOT EXISTS reporter_identities (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id       INTEGER NOT NULL UNIQUE REFERENCES reports(id) ON DELETE CASCADE,
  encrypted_name  TEXT,
  encrypted_email TEXT,
  encrypted_phone TEXT,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_identities_report ON reporter_identities(report_id);

CREATE TABLE IF NOT EXISTS report_access_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id    INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_name   TEXT    NOT NULL,
  permission   TEXT    NOT NULL DEFAULT 'view_reporter_identity',
  reason       TEXT    NOT NULL,
  ip_address   TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_access_logs_report ON report_access_logs(report_id);

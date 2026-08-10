-- 0007_rbac_and_workflow_expansion.sql — Expanded RBAC, State Machine, Assignments, SLA, & Notifications

CREATE TABLE IF NOT EXISTS roles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  description TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS permissions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  description TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS report_types (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  code             TEXT    NOT NULL UNIQUE,
  name             TEXT    NOT NULL,
  default_priority TEXT    NOT NULL DEFAULT 'Sedang',
  default_unit     TEXT    NOT NULL DEFAULT 'Seksi Layanan Sarpras',
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  report_type_id INTEGER REFERENCES report_types(id) ON DELETE SET NULL,
  code           TEXT    NOT NULL,
  name           TEXT    NOT NULL,
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS assignments (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id           INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  assigned_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  unit_name           TEXT    NOT NULL,
  deadline_at         TEXT,
  notes               TEXT,
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_assignments_report ON assignments(report_id);

CREATE TABLE IF NOT EXISTS status_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id     INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  from_status   TEXT,
  to_status     TEXT    NOT NULL,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_name    TEXT    NOT NULL,
  reason        TEXT,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_status_history_report ON status_history(report_id);

CREATE TABLE IF NOT EXISTS sla_policies (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  report_type     TEXT    NOT NULL,
  priority        TEXT    NOT NULL,
  response_hours  INTEGER NOT NULL,
  resolution_days INTEGER NOT NULL,
  UNIQUE(report_type, priority)
);

CREATE TABLE IF NOT EXISTS holidays (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  holiday_date TEXT    NOT NULL UNIQUE,
  description  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id       INTEGER REFERENCES reports(id) ON DELETE CASCADE,
  recipient_email TEXT    NOT NULL,
  type            TEXT    NOT NULL,
  subject         TEXT    NOT NULL,
  body            TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'pending',
  retry_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Seed initial report types including open decision 3rd type
INSERT OR IGNORE INTO report_types (code, name, default_priority, default_unit, is_active) VALUES
  ('whistleblowing', 'Whistleblowing System', 'Tinggi', 'Tim Investigasi Internal', 1),
  ('pengaduan', 'Pengaduan Masyarakat', 'Sedang', 'Seksi Layanan Sarpras', 1),
  ('aspirasi', 'Aspirasi & Saran Konstruktif', 'Rendah', 'Subbagian Tata Usaha', 1);

-- Seed initial SLA policies
INSERT OR IGNORE INTO sla_policies (report_type, priority, response_hours, resolution_days) VALUES
  ('Whistleblowing', 'Kritis', 2, 1),
  ('Whistleblowing', 'Tinggi', 24, 5),
  ('Pengaduan', 'Sedang', 48, 10),
  ('Aspirasi', 'Rendah', 72, 15);

-- 0009_case_actions.sql — Checklist items & case actions for report handling

CREATE TABLE IF NOT EXISTS case_actions (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id            INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  title                TEXT    NOT NULL,
  is_completed         INTEGER NOT NULL DEFAULT 0,
  completed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  completed_at         TEXT,
  created_at           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_case_actions_report ON case_actions(report_id);

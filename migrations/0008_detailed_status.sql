-- 0008_detailed_status.sql -- Add detailed_status column for full state machine names

ALTER TABLE reports ADD COLUMN detailed_status TEXT NOT NULL DEFAULT 'Terkirim';

-- Populate existing rows based on current status values
UPDATE reports SET detailed_status = CASE
  WHEN status = 'terkirim' THEN 'Terkirim'
  WHEN status = 'verifikasi' THEN 'Verifikasi Awal'
  WHEN status = 'proses' THEN 'Dalam Penanganan'
  WHEN status = 'selesai' THEN 'Selesai'
  WHEN status = 'ditolak' THEN 'Ditolak'
  ELSE 'Terkirim'
END;

-- Add priority_level column for sort ordering (1=Kritis, 2=Tinggi, 3=Sedang, 4=Rendah)
ALTER TABLE reports ADD COLUMN priority_level INTEGER NOT NULL DEFAULT 3;

UPDATE reports SET priority_level = CASE
  WHEN priority = 'Kritis' THEN 1
  WHEN priority = 'Tinggi' THEN 2
  WHEN priority = 'Sedang' THEN 3
  WHEN priority = 'Rendah' THEN 4
  ELSE 3
END;

CREATE INDEX IF NOT EXISTS idx_reports_detailed_status ON reports(detailed_status);
CREATE INDEX IF NOT EXISTS idx_reports_priority_level ON reports(priority_level);

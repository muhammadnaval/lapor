-- 0010_master_settings_and_dashboard.sql — Master Data Tables for F05 Dashboard & F09 System Settings

-- Alter existing categories table from migration 0007
ALTER TABLE categories ADD COLUMN jenis TEXT NOT NULL DEFAULT 'Pengaduan';
ALTER TABLE categories ADD COLUMN description TEXT;

CREATE TABLE IF NOT EXISTS units (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  head_name   TEXT    NOT NULL,
  email       TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS faqs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question    TEXT    NOT NULL,
  answer      TEXT    NOT NULL,
  category    TEXT    NOT NULL DEFAULT 'Umum',
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS contacts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  type        TEXT    NOT NULL, -- 'telepon' | 'whatsapp' | 'email' | 'alamat'
  value       TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Seed default units if empty
INSERT OR IGNORE INTO units (id, name, head_name, email) VALUES
  (1, 'Tim Investigasi Internal', 'H. Musthafa, M.Ag', 'investigasi@mtsn3padang.sch.id'),
  (2, 'Seksi Layanan Sarpras', 'Drs. Hendra Utama', 'sarpras@mtsn3padang.sch.id'),
  (3, 'Seksi Kesiswaan & Kurikulum', 'Dra. Nurhayati', 'kesiswaan@mtsn3padang.sch.id'),
  (4, 'Subbagian Tata Usaha', 'Yuliana, S.E', 'tu@mtsn3padang.sch.id'),
  (5, 'Kepala Madrasah', 'Dr. H. Nur Yasin, M.Pd', 'kepala@mtsn3padang.sch.id');

-- Seed default FAQs if empty
INSERT OR IGNORE INTO faqs (id, question, answer, category) VALUES
  (1, 'Apakah identitas pelapor whistleblowing dijamin rahasia?', 'Ya, seluruh data pelapor disandi dengan enkripsi standar AES-256-GCM dan disamarkan secara default.', 'Keamanan'),
  (2, 'Bagaimana cara memantau perkembangan laporan saya?', 'Gunakan Nomor Tiket Laporan dan Kode Pelacakan Rahasia pada menu Lacak Laporan.', 'Pelacakan'),
  (3, 'Berapa lama estimasi penanganan pengaduan?', 'Penanganan dilakukan sesuai SLA instansi (3-7 hari kerja tergantung jenis laporan).', 'SLA');

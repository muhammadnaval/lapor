# DEPLOYMENT.md — Prosedur Deployment & Rollback Produksi

> **LAPOR MTsN 3 Kota Padang**  
> **URL Produksi**: `https://lapor.mtsn3padang.sch.id`

---

## 1. Persiapan Lingkungan Produksi & Inisialisasi Akun Admin

### Langkah A: Deployment Langsung via Node/Bun Server (Direct Server)
```bash
# 1. Clone repository dari GitHub
git clone https://github.com/muhammadnaval/lapor.git
cd lapor

# 2. Install dependensi & build aset client
bun install
bun run build

# 3. Jalankan seeding Akun Super Admin Utama (Fresh Database Setup)
bun run db:seed admin@mtsn3padang.sch.id AdminPadang2026! admin "Super Admin MTsN 3 Kota Padang"

# 4. Jalankan aplikasi dalam mode produksi
bun run start
```

### Langkah B: Deployment via Docker Container
```bash
# 1. Build Image Docker Produksi
docker build -t lapor-mtsn3padang:latest .

# 2. Jalankan Container dengan Persistent Volume
docker run -d \
  --name lapor-app \
  -p 4000:4000 \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  --restart unless-stopped \
  lapor-mtsn3padang:latest

# 3. Buat Akun Super Admin Utama di dalam container (Khusus Setup Baru)
docker exec -it lapor-app bun run db:seed admin@mtsn3padang.sch.id AdminPadang2026! admin "Super Admin MTsN 3 Kota Padang"
```

---

## 2. Health & Readiness Probe

- **Health Endpoint**: `GET http://localhost:4000/health`
- **Respons Sukses**:
  ```json
  { "status": "ok", "uptime": 123.45 }
  ```

---

## 3. Prosedur Rollback Zero Data Loss

Jika terjadi kegagalan versi baru di lingkungan produksi:
```bash
# 1. Hentikan container bermasalah
docker stop lapor-app

# 2. Jalankan versi sebelumnya yang stabil
docker run -d \
  --name lapor-app \
  -p 4000:4000 \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  lapor-mtsn3padang:v1.0.0
```
*Persistent volume `./data` mempertahankan basis data SQLite dan berkas lampiran secara utuh tanpa kehilangan data.*

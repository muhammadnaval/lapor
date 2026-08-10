# DEPLOYMENT.md — Prosedur Deployment & Rollback Produksi

> **LAPOR MTsN 3 Kota Padang**  
> **URL Produksi**: `https://lapor.mtsn3padang.sch.id`

---

## 1. Persiapan Lingkungan Produksi (Docker Build)

Aplikasi dipaketkan menggunakan Docker Engine multi-stage minimalis:

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

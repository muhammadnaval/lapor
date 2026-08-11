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

# 4. Jalankan aplikasi dalam mode produksi (Pilih salah satu metode):

# Opsi 4.1: Via PM2 Process Manager (Rekomendasi Utama)
npm install -g pm2
pm2 start "bun run start" --name lapor-app
pm2 save
pm2 startup

# Opsi 4.2: Via Bun langsung
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

## 4. Konfigurasi Reverse Proxy Nginx Resmi (SSL Termination)

Jika menggunakan Nginx sebagai Reverse Proxy di depan aplikasi, pastikan Nginx meneruskan header SSL/HTTPS (`X-Forwarded-Proto` & `X-Forwarded-Host`) agar koneksi Inertia XHR & CSP berjalan 100% sempurna:

```nginx
server {
    listen 80;
    server_name lapor.mtsn3padang.sch.id;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name lapor.mtsn3padang.sch.id;

    # SSL Certificates (Let's Encrypt / Certbot)
    ssl_certificate /etc/letsencrypt/live/lapor.mtsn3padang.sch.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lapor.mtsn3padang.sch.id/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}
```

---

## 5. Konfigurasi SafeLine WAF (Chaitin SafeLine) sebagai Reverse Proxy & Firewall

Jika Anda menggunakan **SafeLine WAF** sebagai Reverse Proxy & Firewall di depan aplikasi:

### 1. Konfigurasi Situs (Site Management)
- **Domain**: `lapor.mtsn3padang.sch.id`
- **Port Layanan**: `443` (SSL / HTTPS)
- **Upstream Server**: `http://127.0.0.1:4000` (atau IP Container Backend)

### 2. Pengaturan Header Pass-Through (Set Header WAF)
Di Dasbor SafeLine WAF -> **Site Settings** -> **Custom Request Headers**:
- Aktifkan **"Host Pass-through"** (`Host: $host`)
- Tambahkan Header Forwarding:
  - `X-Forwarded-Proto: https`
  - `X-Forwarded-Host: lapor.mtsn3padang.sch.id`
  - `X-Real-IP: $remote_addr`

### 3. Pengaturan Metode HTTP & Protokol Unggahan TUS (`/uploads*`)
- Di Dasbor SafeLine WAF -> **WAF Rules / Protocol Policy**:
  - Pastikan HTTP Methods **`PATCH`**, **`HEAD`**, **`OPTIONS`**, **`POST`**, **`DELETE`** diizinkan.
  - Untuk jalur `/uploads*`, set **Max Body Size** ke **50MB** agar unggahan berkas bukti terlampir via protokol TUS tidak terblokir oleh filter payload WAF.

### 4. Pengaturan `.env` Aplikasi Backend
Pastikan pada berkas `.env` aplikasi backend di server:
```ini
APP_URL=https://lapor.mtsn3padang.sch.id
```

---

## 6. Konfigurasi Caddy Web Server sebagai Reverse Proxy (Caddyfile)

Jika Anda menggunakan **Caddy Server** sebagai Reverse Proxy:

```caddyfile
lapor.mtsn3padang.sch.id {
    reverse_proxy 127.0.0.1:4000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto https
        header_up X-Forwarded-Host {host}
    }
}
```

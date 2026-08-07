# MENALA AIST Playwright Runner

Runner browser terpisah untuk FASE 3 Poin D FULL. Service ini **bukan** bagian dari build static RIFIM OS/Vercel utama.

## Arsitektur

`Finance UI -> /api/internal/aist-runner -> runner /run -> AIST`

Internal API akan dibuat pada PR berikutnya. Setelah runner mengembalikan sukses, internal API yang melakukan callback `raos_saldo_mark_paid` memakai session user Finance. Runner ini sendiri tidak memiliki service-role Supabase dan tidak menandai request lunas.

Bookmarklet `automation/aist-bookmarklet/aist-fill-v2.source.js` tetap tersedia sebagai fallback dan tidak diubah.

## Security

- Credential AIST hanya dari env `AIST_USERNAME` + `AIST_PASSWORD`.
- Endpoint `/run` membutuhkan `x-runner-secret` yang cocok dengan `AIST_RUNNER_SHARED_SECRET`.
- Tidak ada credential/session AIST yang disimpan di repo.
- Tidak memakai persistent Playwright `storageState`; browser/context baru dibuat untuk setiap run dan selalu ditutup.
- Screenshot error bersifat opt-in dan harus diarahkan ke lokasi private, bukan folder web/public.

## Setup lokal / runner host

```bash
cd automation/playwright-aist
npm install
npm run install-browser
```

Salin `.env.example` ke environment manager/secret vault host. Jangan commit `.env`.

Jalankan:

```bash
npm start
```

Health check:

```bash
curl http://127.0.0.1:8787/health
```

## Validasi selector AIST

Runner menggunakan locator berbasis label/role/text agar tidak tergantung class CSS AIST. Bila UI AIST berubah, gunakan recorder resmi Playwright hanya untuk mendapatkan locator baru:

```bash
npm run codegen
```

Login dilakukan manual pada jendela recorder tersebut. Jangan copy password ke source code. Setelah locator tervalidasi, update `runner.js` tanpa menyimpan credential.

## Payload /run

```json
{
  "request_id": "uuid-request-saldo",
  "driver_login": "172749767",
  "nominal": 95000
}
```

Header:

```text
x-runner-secret: <AIST_RUNNER_SHARED_SECRET>
```

Response sukses menyertakan `request_id`, `driver_login`, `nominal`, `started_at`, `completed_at`.

## Catatan deployment

Service butuh browser Chromium dan lebih cocok dijalankan pada Windows runner/VPS/container terpisah daripada dibundel ke static RIFIM OS. Internal Vercel API hanya menjadi authenticated broker sehingga package Chromium tidak membebani deployment portal.

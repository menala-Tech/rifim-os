# GAS Deployment — RIFIM OS

> Panduan deploy dan setup Google Apps Script untuk RIFIM OS.

---

## Identitas GAS Project

| Item | Nilai |
|------|-------|
| Script ID | `1IK8-2anrxahce1X1MG7Bi3aGe6e-_4e3obanTRprT6brYSdla9rEYOxp` |
| GAS Editor URL | https://script.google.com/u/0/home/projects/1IK8-2anrxahce1X1MG7Bi3aGe6e-_4e3obanTRprT6brYSdla9rEYOxp/edit |
| Web App URL | `https://script.google.com/macros/s/AKfycbzzK75gxawaylaUZpoC1zp_hq5ktznlN7scIl24HkdEgR2l3cVmpUSLck0potcMZZtw/exec` |
| Tipe | Standalone (tidak terikat spreadsheet) |
| Database | `SpreadsheetApp.openById(SPREADSHEET_ID)` via `configLoader.js` |

---

## Cara Push Kode ke GAS

**WAJIB via GitHub Actions — jangan jalankan clasp lokal.**

Jaringan lokal memblokir Google OAuth (ETIMEDOUT), sehingga clasp lokal tidak bisa jalan.

### Alur Deploy (2026-09-01 update: redeploy sekarang otomatis)

```
Edit file di automation/apps-script/*.js
        ↓
git commit + git push (main)
        ↓
deploy-gas.yml:
  1. Stamp deployMeta.js dengan GITHUB_SHA + timestamp
  2. clasp push --force
  3. clasp update-deployment (redeploy Web App yang sama)
        ↓
gas-deploy-verify.yml (dijalankan otomatis setelah deploy + tiap 09:00 WIB):
  POST finance_ping → cocokkan .version dengan main HEAD
  → fail build kalau HTML/stale >24h → alarm harian bahkan tanpa push baru
```

URL Web App **tidak berubah** — hanya kode + deployment version yang diperbarui.

---

## Aturan Redeploy

| Jenis Perubahan | clasp push | Redeploy GAS |
|-----------------|------------|--------------|
| Edit file `automation/apps-script/*.js` | Otomatis via GitHub Actions | Otomatis via `clasp update-deployment` |
| Tambah file GAS baru | Otomatis via GitHub Actions | Otomatis |
| Edit frontend HTML saja | Tidak perlu | Tidak perlu |
| Jalankan `setup*()` manual dari GAS Editor | Tidak perlu | Tidak perlu |

**Fallback manual** (kalau `gas-deploy-verify.yml` gagal — mis. clasp OAuth token expired):

```
Deploy → Manage deployments → Edit (ikon pensil) → Version: New version → Save
```

Jangan buat Deployment ID baru — `deploy-gas.yml` dan `hris-contracts.js` pin ke ID lama.

---

## Healthcheck: `finance_ping`

Endpoint publik (tidak butuh session) yang return:

```json
{ "success": true, "version": "<git-sha>", "deployed_at": "<iso-utc>", "server_time": "<iso-utc>" }
```

Sumber `version` + `deployed_at`: constant di `automation/apps-script/deployMeta.js`, yang **di-overwrite otomatis oleh `deploy-gas.yml` sebelum `clasp push`**. Jangan edit manual — akan tertimpa.

Aman diekspos publik karena tidak mengandung PII, config, atau data row-level.

### Cara Redeploy di GAS Editor

```
Deploy → Manage deployments → Edit (ikon pensil) → Version: New version → Save
```

URL Web App tidak berubah — hanya kode yang diperbarui.

---

## One-Time Setup Functions

Jalankan fungsi berikut **sekali** di GAS Editor setelah pertama kali setup atau deploy baru.
Tidak bisa dipanggil dari frontend.

### Urutan Setup Awal

| Urutan | Fungsi | Keterangan |
|--------|--------|------------|
| 1 | `setupHrisConfig()` | Simpan Supabase URL + Service Role Key ke PropertiesService |
| 2 | `setupDatabase()` | Buat 6 sheet database |
| 3 | `setupEmployeesSheet()` | Buat sheet `employees` (sync target dari Supabase) |
| 4 | `setupActivityLogSheet()` | Buat sheet `activity_log` |
| 5 | `setupBackupTrigger()` | Daftarkan trigger harian jam 02.00 WIB |
| 6 | `createAllTemplates()` | Buat 6 template Google Doc umum (tanpa logo) |
| 7 | `createRifimTemplates()` | Buat template PT. RIFIM (logo + TTD + stempel) |
| 8 | `createMenalaTemplates()` | Buat template PT. Menala MIG (logo + TTD + stempel) |
| 9 | `createLailanTemplates()` | Buat template CV. Lailan (logo + TTD + stempel) |
| 10 | `syncHrisEmployeesToSheet()` | Populate sheet `employees` dari data HRIS |

> Setelah `setupHrisConfig()`: buka PropertiesService manual, ganti `PASTE_SERVICE_ROLE_KEY_HERE` dengan Service Role Key dari Supabase Dashboard → Settings → API.

### Fungsi Verifikasi

| Fungsi | Keterangan |
|--------|------------|
| `verifyHrisConfig()` | Cek Supabase URL + key di PropertiesService |
| `checkBackupStatus()` | Cek jumlah dan nama backup terbaru |

---

## Catatan Keamanan

- `SUPABASE_SERVICE_KEY` **TIDAK BOLEH** di-commit ke git
- File `hrisLayer.js` di repo selalu berisi placeholder `'PASTE_SERVICE_ROLE_KEY_HERE'`
- Key hanya disimpan di GAS PropertiesService milik pemilik project

---

## Status Setup (Juli 2026)

Semua fungsi setup sudah dijalankan:

- [x] `setupHrisConfig()` — Supabase key tersimpan
- [x] `setupDatabase()` — 6 sheet tersedia
- [x] `setupBackupTrigger()` — backup harian aktif
- [x] `createAllTemplates()` — template umum di Drive
- [x] `createRifimTemplates()` — template RIFIM di Drive
- [x] `createMenalaTemplates()` — template MIG di Drive
- [x] `createLailanTemplates()` — template Lailan di Drive
- [x] `syncHrisEmployeesToSheet()` — sheet employees ter-populate

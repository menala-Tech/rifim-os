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

### Alur Deploy

```
Edit file di automation/apps-script/*.js
        ↓
git commit + git push
        ↓
GitHub Actions: clasp push otomatis
        ↓
(Jika edit logika GAS) Redeploy di GAS Editor
```

---

## Aturan Redeploy

| Jenis Perubahan | clasp push | Redeploy GAS |
|-----------------|------------|--------------|
| Edit file `automation/apps-script/*.js` | Otomatis via GitHub Actions | **Wajib** |
| Tambah file GAS baru | Otomatis via GitHub Actions | **Wajib** |
| Edit frontend HTML saja | Tidak perlu | Tidak perlu |
| Jalankan `setup*()` manual dari GAS Editor | Tidak perlu | Tidak perlu |

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

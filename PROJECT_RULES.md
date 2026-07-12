# PROJECT RULES

> Aturan ini wajib diikuti oleh seluruh developer dan AI yang berkontribusi pada RIFIM OS.

Version: 1.0
Status: Active

---

## Architecture Rules

| # | Rule |
|---|------|
| 01 | Semua modul harus reusable |
| 02 | Tidak boleh ada duplicate code |
| 03 | Semua dokumen menggunakan Document Engine |
| 04 | Semua nomor dokumen menggunakan Numbering Engine |
| 05 | Semua template menggunakan Placeholder Engine |
| 06 | Semua file harus terdokumentasi |
| 07 | Tidak boleh hardcode nilai apapun |
| 08 | Semua perubahan harus update CHANGELOG.md |
| 09 | Semua AI wajib membaca docs sebelum coding |
| 10 | Semua keputusan arsitektur harus mengikuti Blueprint |

---

## Folder Rules

| # | Rule |
|---|------|
| 11 | Ikuti struktur folder di `FOLDER_STRUCTURE.md` |
| 12 | Folder baru hanya boleh dibuat dengan alasan jelas |
| 13 | Folder baru wajib diupdate di `FOLDER_STRUCTURE.md` |
| 14 | Gunakan `lowercase-kebab-case` untuk nama folder |
| 15 | Jangan simpan source code di folder `docs/` |

---

## Naming Convention

| Type | Convention | Example |
|------|-----------|---------|
| Folder | lowercase-kebab-case | `smart-office` |
| File JS | camelCase | `documentEngine.js` |
| File Markdown | PascalCase | `README.md` |
| Function | camelCase | `generateDocument()` |
| Variable | camelCase | `documentNumber` |
| Constant | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| Placeholder | UPPER_SNAKE `{{}}` | `{{DOCUMENT_NUMBER}}` |

---

## Commit Convention

Format: `type(scope): description`

| Type | Usage |
|------|-------|
| `feat` | Fitur baru |
| `fix` | Bug fix |
| `docs` | Dokumentasi |
| `refactor` | Refactor tanpa perubahan fungsional |
| `test` | Testing |
| `chore` | Setup, config, maintenance |

---

## Database Rules

| # | Rule |
|---|------|
| 16 | Phase 1 menggunakan Google Sheets |
| 17 | Phase 2 menggunakan Supabase |
| 18 | Desain schema harus siap migrasi ke Supabase |
| 19 | Jangan hardcode Spreadsheet ID |
| 20 | Jangan duplikasi schema |

---

## Security Rules

| # | Rule |
|---|------|
| 21 | Jangan commit API Keys / Secrets |
| 22 | Gunakan config file untuk credentials |
| 23 | Jangan expose data internal ke public endpoint |

---

## Logo & Branding Rules

> Setiap kali user meminta logo perusahaan, Claude WAJIB menggunakan file dari:
> **`C:\Users\ADMIN\Documents\RIFIM\rifim-os\branding\logo\`**
> (atau path GitHub: `branding/logo/` di repo `menala-Tech/rifim-os`)

### Mapping Logo Perusahaan

| Perintah / Entitas | File Logo | Path Lokal |
|--------------------|-----------|------------|
| **PT. Menala Internasional Gemilang** | `logo-menala.png` | `branding/logo/logo-menala.png` |
| **PT. RIFIM Internasional Gemilang** | `logo-rifim.png` | `branding/logo/logo-rifim.png` |
| **CV. LailanKalilan Indonesia** | `logo-lailan.png` | `branding/logo/logo-lailan.png` |
| **Maxim** | `logo-maxim.png` | `branding/logo/logo-maxim.png` |
| **Semua Perusahaan / Rifim Group** | `logo-rifim-group.jpg` | `branding/logo/logo-rifim-group.jpg` |
| **Icon App / PWA** | `icon-192.png` | `branding/icon/icon-192.png` |

### Mapping Stempel Perusahaan

| Entitas | File Stempel | Path Lokal |
|---------|-------------|------------|
| PT. Menala Internasional Gemilang | `stempel-menala.png` | `branding/logo/stempel-menala.png` |
| PT. RIFIM Internasional Gemilang | `stempel-rifim.png` | `branding/logo/stempel-rifim.png` |
| CV. LailanKalilan Indonesia | `stempel-lailan.png` | `branding/logo/stempel-lailan.png` |

### Aturan Penggunaan Logo

| # | Rule |
|---|------|
| 24 | Gunakan logo dari `branding/logo/` — jangan upload ulang atau hardcode base64 |
| 25 | Referensi logo di HTML/GAS menggunakan path relatif dari root proyek |
| 26 | Jangan ganti atau rename file logo tanpa update tabel mapping ini |
| 27 | Jika ada logo baru, tambahkan ke `branding/logo/` dan update tabel di atas |

---

## GAS Branding Engine Rules

| # | Rule |
|---|------|
| 28 | Sisipkan logo ke sheet via `insertLogoKeSheet()` dari `brandingEngine.js` — jangan pakai `DriveApp.getFileById().getBlob()` langsung (batas 2MB/1M pixel) |
| 29 | Ambil blob logo via Drive thumbnail URL `sz=w400` + `UrlFetchApp.fetch()` dengan OAuth token |
| 30 | Drive File ID logo disimpan di GAS `PropertiesService` — jangan commit ke git |
| 31 | Jalankan `setupBrandingLogosDefault()` dari GAS Editor setelah deploy untuk daftarkan semua logo |
| 32 | Header sheet standar menggunakan `buatHeaderSheet(sheet, brandKey, judulDokumen, maxCol)` |

---

## Sinkronisasi Data Rules

| # | Rule |
|---|------|
| 33 | SSoT data staff: Supabase `employees` → sync ke sheet `Database Staff` via `syncStaffKeDatabaseStaff()` |
| 34 | SSoT data driver: Supabase `drivers` → sync ke sheet `Database Driver Airport` + `Database Driver External` via `syncDriversDariSupabase()` |
| 35 | Input staff baru: melalui sheet `Input Staff` → `prosesInputStaff()` → Supabase → auto-sync |
| 36 | Input driver baru: melalui sheet `Input Driver Airport/External` → `prosesInputDriver()` → Supabase → auto-sync |
| 37 | Jangan edit sheet `Database Staff` / `Database Driver` secara manual — akan ditimpa saat sync |
| 38 | Auto-sync terjadwal: setiap 6 jam via trigger GAS (`setupStaffSyncTrigger`, `setupDriverSyncTrigger`) |
| 39 | Data PII (nama, HP, gaji, email, PIN staff/driver) — jangan commit ke GitHub dalam format apapun |

---

## Setup Awal GAS (Setelah Deploy)

> Cara menjalankan: buka GAS Editor → pilih **file** di panel kiri → pilih **nama fungsi** di dropdown toolbar → klik **Run**.

Urutan setup yang harus dijalankan **sekali** dari GAS Editor setelah deploy ke GAS:

| # | Fungsi | File | Keterangan |
|---|--------|------|------------|
| 1 | `setupBrandingLogosDefault()` | `brandingEngine.js` | Daftarkan Drive File ID semua logo |
| 2 | `testInsertLogo()` | `brandingEngine.js` | Verifikasi logo terpasang (hapus sheet TEST_LOGO setelah selesai) |
| 3 | `setupLaporanCabangSheet()` | `raosLaporanEngine.js` | Terapkan header logo ke sheet Laporan Cabang |
| 4 | `setupDatabaseStaffSheet()` | `hrisSyncLayer.js` | Buat sheet Database Staff |
| 5 | `setupInputStaffSheet()` | `hrisSyncLayer.js` | Buat sheet Input Staff |
| 6 | `setupDriverSheets()` | `raosDriverLayer.js` | Buat sheet Input Driver Airport + External |
| 7 | `setupStaffSyncTrigger()` | `hrisSyncLayer.js` | Trigger auto-sync staff setiap 6 jam |
| 8 | `setupDriverSyncTrigger()` | `raosDriverLayer.js` | Trigger auto-sync driver setiap 6 jam |
| 9 | `setupRaosSheets()` | `setupRaosSheets.js` | Buat semua sheet RAOS (Form Input Saldo PWA, Input Potongan 1/2, dll) |
| 10 | `setupStaffAppSheets()` | `staffAppApi.js` | Buat sheet Absensi Staff + Antrian Bandara + kolom Validasi J-L (Staff PWA) |
| 10b | `setupStaffBebasAbsensi()` | `staffAppApi.js` | Daftar ID staff bebas absensi & geofence (edit daftar di fungsi dulu) |
| 11 | `setupMonitoringSheets()` | `raosMonitoringEngine.js` | Buat sheet MONITORING_SALDO + MONITORING_POTONGAN |
| 12 | `setupMonitoringTriggers()` | `raosMonitoringEngine.js` | Pasang trigger monitoring tiap 5 menit |

### Property Wajib untuk Staff PWA (PropertiesService)

| Property | Format | Keterangan |
|----------|--------|------------|
| `GEOFENCE_CABANG` | JSON `{"ID Rifim Airport Batam": {"lat": 1.1229, "lng": 104.1139, "radius": 1000}, ...}` | Isi via `setupGeofenceCabang()` di `staffAppApi.js`. Cabang null = absensi jalan tapi status "TIDAK DICEK" |
| `ABSENSI_FOTO_FOLDER_ID` | Drive Folder ID | Auto-dibuat saat absensi pertama; bisa diisi manual |
| `SALDO_NOMINAL_OPTIONS` | JSON array `[45000,95000]` atau object `{"DEFAULT":[...],"ID Rifim Airport Pekanbaru":[...]}` | Opsional. Preset nominal per cabang. Default: 45rb/95rb; Balikpapan & Pekanbaru + 145rb/195rb |
| `STAFF_BEBAS_ABSENSI` | JSON array `["RIF0001"]` | ID staff yang bebas absensi & geofence total (admin/owner). Isi via `setupStaffBebasAbsensi()` |
| `STAFF_PIN_<ID>` | string PIN | Auto-dibuat saat staff Ganti PIN mandiri. Override PIN sheet — sync-safe. Hapus property = kembali ke PIN sheet |

> **Reminder Redeploy:** setiap perubahan file `automation/apps-script/*.js` di GitHub → clasp push otomatis, tapi **Web App wajib redeploy manual**: Deploy → Manage deployments → ✏️ → Version: New version → Deploy.

---

*Pelanggaran terhadap aturan ini harus didiskusikan sebelum implementasi.*

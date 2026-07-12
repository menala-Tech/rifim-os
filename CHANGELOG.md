# CHANGELOG

> Semua perubahan signifikan pada proyek ini dicatat di sini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/).

---

## [Unreleased]

### Changed — Staff PWA v2: tema terang + UX PWA lama (Sprint 3A)
- Tampilan diganti tema terang (putih + merah RIFIM) mengikuti PWA isi-saldo lama
- 8 fungsi diadopsi dari PWA isi-saldo lama:
  - Nominal preset grid (bukan ketik bebas) — opsi dari server, override via property `SALDO_NOMINAL_OPTIONS`
  - Auto-lookup nama driver saat ID diketik (debounce 500ms + cache 24 jam) — Kirim baru aktif setelah nama terkonfirmasi
  - Wajib Absen Masuk (foto via kamera live belakang) sebelum akses menu
  - Geofence blocking — Isi Saldo & Absen Masuk terkunci kalau di luar area cabang
  - Cek duplikat — konfirmasi kalau ID sama sudah diisi hari ini
  - Anti double-entry — operasi tulis tanpa retry + timeout 30s; koneksi putus → arahkan cek riwayat
  - Ganti PIN mandiri
  - Retry 3x hanya untuk operasi baca (atasi limit kuota GAS Gmail biasa)
- Aturan bisnis dari Main.gs + Absensi.gs lama diadopsi:
  - GPS gagal TIDAK memblokir (fix bug Number('')=0 → koordinat Teluk Guinea)
  - Nominal per cabang: default [45000,95000]; Balikpapan & Pekanbaru + [145000,195000]
  - Geofence dicek ulang server-side di titik submit saldo
  - Idempotency 5 menit — submission identik → skip tulis (anti double-entry server)
  - Absen PULANG wajib sudah MASUK; absen MASUK di luar area diblokir server
  - Staff bebas absensi & geofence via property `STAFF_BEBAS_ABSENSI` (setupStaffBebasAbsensi())
- Login page: matikan autofill browser (autocomplete off + readonly-sampai-fokus)
- `staffAppApi.js` endpoint baru: `staffLookupDriver`, `staffGantiPin`, `staffCekStatus`
- PIN override tersimpan di PropertiesService `STAFF_PIN_<ID>` — sync-safe (tidak
  tertimpa sync Supabase → Database Staff tiap 6 jam)

### Added — Staff PWA v1 (Sprint 3A)
- `apps/pwa/staff-app/` — PWA baru untuk staff lapangan (login ID Staff + PIN)
  - Live: https://rifim-staff.vercel.app (Vercel project `rifim-staff`)
  - Input top-up saldo driver → sheet `Form Input Saldo PWA` (auto-lookup nama driver)
  - Riwayat pengisian bulan berjalan + total nominal
  - Antrian bandara: tambah driver, panggil, jemput, selesai (WAITING→CALLED→PICKED→DONE)
  - Absensi MASUK/PULANG: GPS geofence + foto selfie (kompres canvas 640px → Drive)
  - [Koordinator] Monitoring saldo cabang harian + validasi/tolak per entry
- `automation/apps-script/staffAppApi.js` — backend API Staff PWA
  - `staffLogin` — auth dari sheet Database Staff (ID + PIN + status AKTIF)
  - `staffSaldoSubmit/Riwayat/Monitor/Validasi` — alur saldo dengan validation layer Koordinator
  - `staffAbsensi/Status` — geofence Haversine 300m, koordinat cabang di PropertiesService `GEOFENCE_CABANG`
  - `queueList/Add/Update` — antrian bandara (pengganti RADMS yang tidak bisa diakses)
  - `setupStaffAppSheets()` — buat sheet Absensi Staff + Antrian Bandara + kolom Validasi J-L
- `automation/apps-script/webApp.js` — routing `routeStaffApp()` di doPost

### Context — RADMS Lama
- RADMS (radms-driver / radms-dashboard) tidak pernah dipakai production dan akun lama
  (GitHub + Vercel + Google) sudah tidak bisa diakses → di-rebuild ke Staff PWA (antrian)
  dan Driver PWA (menyusul). Tidak ada data yang perlu diselamatkan.

### In Progress — HRIS Sprint 2
- [x] Export rekap karyawan CSV (filter sesuai tampilan aktif)
- [x] Filter absensi per departemen + kolom nama karyawan di tabel absensi
- [ ] Test PKWT generation end-to-end dari kontrak baru
- [ ] Setup trigger notifCheckExpiringContracts()

### Planned — Sprint 3+
- Modul Finance (cash flow, saldo driver, budget)
- Modul CRM (airport, vendor, partner, client)
- Modul AI Assistant (document generator, SOP, business analysis)
- Executive Dashboard (KPI, revenue, finance, operasional)
- PWA integration: Database AIST + Database Potongan → Monitor Saldo / Order / Koordinator PWA

---

## [0.4.0] — 2026-07-12

### Added — GAS: Branding Engine
- `brandingEngine.js` — sisipkan logo perusahaan ke Google Sheet sebagai over-grid image (tampil di layar & PDF export)
- `_getLogoBlob()` — ambil blob logo via Drive thumbnail URL (`sz=w400`) untuk hindari batas 2MB / 1M pixel GAS
- `insertLogoKeSheet()` — insert logo ke sheet dengan auto-hapus logo lama di anchor yang sama
- `buatHeaderSheet()` — header sheet 3-baris standar RIFIM OS (logo kiri + nama perusahaan + judul dokumen)
- `setupBrandingLogos()` / `setupBrandingLogosDefault()` — simpan Drive File ID logo ke PropertiesService
- `testInsertLogo()` — test semua 6 logo ke sheet TEST_LOGO
- Drive File ID tersimpan di PropertiesService (tidak di-commit ke git): RIFIM, MENALA, LAILAN, MAXIM, RIFIM_GROUP, ICON

### Added — GAS: Driver Layer RAOS
- `raosDriverLayer.js` — layer lengkap data driver untuk RAOS
- `raosGetDrivers()` / `raosAddDriver()` / `raosUpdateDriver()` — CRUD driver di Supabase tabel `drivers`
- `syncDriversDariSupabase()` — pull semua driver dari Supabase, split ke sheet `Database Driver Airport` dan `Database Driver External`
- `prosesInputDriverAirport()` / `prosesInputDriverExternal()` — proses sheet Input Driver → Supabase → mark OK/ERROR → auto-sync
- `setupDriverSheets()` — buat sheet `Input Driver Airport` + `Input Driver External` dengan dropdown cabang/zone/tipe/status
- `setupDriverSyncTrigger()` — trigger otomatis `syncDriversDariSupabase` setiap 6 jam

### Added — GAS: Staff Sync HRIS
- `hrisSyncLayer.js` diperluas dengan fungsi sync staff operasional:
- `syncStaffKeDatabaseStaff()` — sync Supabase `employees` → sheet `Database Staff` (cache operasional RAOS/Finance/Payroll)
- `setupDatabaseStaffSheet()` — buat sheet `Database Staff` dengan header + format standar
- `setupInputStaffSheet()` — buat sheet `Input Staff` (form input admin) dengan dropdown jabatan/cabang/perusahaan/tipe/status
- `prosesInputStaff()` — proses baris input → Supabase → auto-sync ke `employees` sheet + `Database Staff`
- `setupStaffSyncTrigger()` — trigger otomatis `syncStaffKeDatabaseStaff` setiap 6 jam

### Added — GAS: Laporan Engine Update
- `raosLaporanEngine.js` — header laporan cabang diperbarui dengan logo RIFIM (row offset disesuaikan: data mulai baris 8)
- `setupLaporanCabangSheet()` — buat area logo A1:A2, nama perusahaan B1:E1, subtitle B2:E2, filter baris 4-5, header baris 7

### Added — GAS: Menu Engine Update
- `raosMenuEngine.js` — tambah sub-menu `👤 HRIS — Staff` dan `🚗 RAOS — Driver` di menu utama `🚛 RIFIM OS`
- Menu HRIS: Proses Input Staff, Sync Staff, Setup Sheet Input Staff, Setup Database Staff, Setup Trigger
- Menu Driver: Proses Input Airport/External, Sync Driver, Setup Sheet, Setup Trigger

### Added — GAS: OAuth Scopes
- `appsscript.json` — tambah `oauthScopes` untuk Drive, Drive.file, external_request, gmail, scriptapp

### Added — Branding Assets
- `branding/logo/logo-rifim.png` — logo PT. RIFIM Internasional Gemilang
- `branding/logo/logo-menala.png` — logo PT. Menala Internasional Gemilang
- `branding/logo/logo-lailan.png` — logo CV. LailanKalilan Indonesia
- `branding/logo/logo-maxim.png` — logo Maxim
- `branding/logo/logo-rifim-group.jpg` — logo Rifim Group
- `branding/logo/stempel-rifim.png` / `stempel-menala.png` / `stempel-lailan.png`

### Added — PWA Apps
- `apps/pwa/monitor-koordinator/` — Monitor Koordinator PWA (dipindah dari root)
- `apps/pwa/monitor-order/` — Monitor Order PWA (dipindah dari root)
- `apps/pwa/monitor-saldo/` — Monitor Saldo PWA (dipindah dari root)

### Changed — CLAUDE.md
- Tambah seksi "Working Directory (WAJIB)" — semua file HANYA di folder lokal proyek
- Tambah seksi "Logo Perusahaan (WAJIB)" — mapping logo + aturan auto-ambil dari folder lokal

### Changed — PROJECT_RULES.md
- Tambah seksi "Logo & Branding Rules" — mapping logo + stempel + aturan penggunaan (rule 24-27)

### Fixed
- Blob terlalu besar di GAS: ganti `DriveApp.getFileById().getBlob()` → thumbnail URL Drive `sz=w400` + `UrlFetchApp.fetch()`
- Submodule Git di folder PWA: hapus embedded `.git`, re-add sebagai file biasa
- OAuth scope Drive: tambah `oauthScopes` di `appsscript.json` (penyebab error `getFileById on DriveApp`)

### Architecture — Arsitektur Sinkronisasi Data
Tiga alur sinkronisasi yang sudah diimplementasikan:

```
1. Code Flow       : Local → GitHub → (CI) → Google Apps Script
2. Master Data     : Supabase ←→ Google Sheets (Database Staff / Database Driver)
3. Transactional   : Input Sheet → Supabase → Database Sheet → PDF / WA
```

SSoT (Single Source of Truth):
- Staff    : Supabase `employees` → sync ke `Database Staff` sheet
- Driver   : Supabase `drivers`   → sync ke `Database Driver Airport` + `Database Driver External`
- Operasional (Potongan, AIST) : Google Sheets sebagai transaksi harian

---

## [0.3.0] — 2026-07-10

### Added — Smart Office
- Dashboard 20 jenis dokumen perusahaan
- Arsip dokumen dengan filter dan pencarian
- Generate dokumen via GAS (Surat Tugas, PKWT, dll)
- Auto-fill karyawan: pilih Nama → otomatis isi ID, Jabatan, Departemen, Gaji, Tgl Bergabung dari HRIS
- PKWT: field ID Karyawan (menggantikan NIK/KTP)
- Penanda Tangan: Jabatan jadi dropdown (Direktur Utama, Manager Administrasi, Manager Operasional, Manager Keuangan, Koordinator) → Nama otomatis terisi dari data HRIS

### Added — HRIS
- Login per modul dengan session 8 jam
- Tambah, edit, resign karyawan
- Auto-generate ID karyawan
- Upload foto KTP & foto 2x3
- Dropdown jabatan tetap (tidak bisa diketik bebas)
- Format gaji Rp otomatis
- Sync otomatis ke sheet `employees` setiap add/edit/resign

### Added — Portal
- Logo RIFIM dan background gedung
- Session 8 jam (`localStorage.rifim_auth`)
- Tombol kembali dari modul ke portal

### Added — GAS Engine Layer
- `configLoader.js` — konfigurasi terpusat (Spreadsheet ID, config)
- `databaseLayer.js` — abstraksi akses Google Sheets
- `setupDatabase.js` — inisialisasi 6 sheet database
- `documentEngine.js` — generate semua jenis dokumen
- `numberingEngine.js` — auto-generate nomor dokumen
- `placeholderEngine.js` — replace placeholder di template
- `driveManager.js` — kelola Google Drive (simpan, backup)
- `documentTypes.js` — definisi 20 jenis dokumen
- `authEngine.js` — authentication & role management
- `webApp.js` — Web App entry point & routing
- `hrisLayer.js` — CRUD karyawan + Supabase integration
- `hrisSyncLayer.js` — sync HRIS → Spreadsheet + activity log
- `notificationEngine.js` — email & notifikasi (belum aktif)
- `backupEngine.js` — backup harian otomatis (simpan 7 copy terakhir)

### Added — Database (Google Sheets)
- Spreadsheet "Document Rifim OS" dengan 6 sheet: `documents`, `numbering_sequences`, `company_config`, `doc_types`, `employees`, `activity_log`

### Added — Activity Log
- Mencatat semua aksi: LOGIN, LOGOUT, TAMBAH, EDIT, RESIGN, BUAT DOKUMEN dari semua modul

### Added — Supabase (HRIS)
- Project `vlievtojpmrbsmzlqswl` — tabel: `employees`, `employee_contracts`, `attendance`, `leave_requests`, `leave_balances`, `payroll`

---

## [0.2.0] — 2026-07-09

### Added — Infrastructure & Deployment
- Google Apps Script project terhubung ke GitHub via clasp
- GitHub Actions: auto `clasp push` setiap commit ke `automation/apps-script/`
- Vercel deployment untuk frontend (portal, modul)
- Struktur folder lengkap sesuai blueprint (77 folder)
- Session architecture: Portal `localStorage.rifim_auth`, modul `sessionStorage` masing-masing

---

## [0.1.0] — 2026-07-09

### Added
- Inisialisasi Enterprise Repository structure
- README.md — gambaran umum proyek
- CLAUDE.md — operating manual untuk Claude Code
- PROJECT_RULES.md — aturan proyek
- CHANGELOG.md — catatan perubahan
- .gitignore — konfigurasi git ignore
- Seluruh struktur folder sesuai blueprint (77 folder)
- README placeholder untuk setiap folder utama

### Notes
- Sprint 0: Enterprise Foundation
- Belum ada business logic atau Apps Script
- Fase ini hanya foundation & dokumentasi

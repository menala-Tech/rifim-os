# CHANGELOG

> Semua perubahan signifikan pada proyek ini dicatat di sini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/).

---

## [Unreleased]

### Planned
- Template dokumen: Kwitansi, SP1/SP2/SP3, Proposal, MoU
- QR Code pada dokumen
- Email notifikasi
- Modul RAOS (driver, staff, pickup point, KPI)
- Modul Finance (cash flow, saldo driver, budget)
- Modul CRM (airport, vendor, partner, client)
- Modul AI Assistant (document generator, SOP, business analysis)
- Executive Dashboard (KPI, revenue, finance, operasional)

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

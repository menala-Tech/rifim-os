# RIFIM OS — Project Status

> Dokumen ini mencatat status aktual proyek. Update setiap akhir sprint.
>
> Last updated: 2026-07-10 (Sprint 2 HRIS + RAOS Analysis)

---

## Current Phase

**Sprint 2 — HRIS Enhancement + RAOS Module Planning**

Status: 🔄 In Progress

---

## Sprint 0 — Selesai (Juli 2026)

### Portal
- [x] Logo RIFIM dan background gedung
- [x] Session 8 jam (`localStorage.rifim_auth`)
- [x] Tombol kembali dari modul ke portal
- [x] Session architecture: Portal `localStorage`, modul `sessionStorage` masing-masing

### Smart Office
- [x] Dashboard 20 jenis dokumen
- [x] Arsip dokumen
- [x] Generate dokumen via GAS (semua 20 jenis)
- [x] Template lengkap: Surat, Invoice, Kwitansi, PKWT, SP1/SP2/SP3, Proposal, MoU, Berita Acara, dan lainnya
- [x] Auto-fill karyawan: pilih Nama → isi ID, Jabatan, Departemen, Gaji, Tgl Bergabung dari HRIS
- [x] Penanda Tangan: dropdown jabatan → Nama otomatis dari HRIS

### HRIS
- [x] Login per modul
- [x] Tambah / edit / resign karyawan
- [x] Auto-generate ID karyawan
- [x] Upload foto KTP & foto 2x3
- [x] Dropdown jabatan tetap
- [x] Format gaji Rp otomatis
- [x] Sync otomatis ke sheet `employees` setiap add/edit/resign

### GAS Engine Layer
- [x] `configLoader.js` — konfigurasi terpusat
- [x] `databaseLayer.js` — abstraksi akses Google Sheets
- [x] `setupDatabase.js` — inisialisasi 6 sheet
- [x] `documentEngine.js` — generate semua jenis dokumen
- [x] `numberingEngine.js` — auto-generate nomor dokumen
- [x] `placeholderEngine.js` — replace placeholder di template
- [x] `driveManager.js` — kelola Google Drive
- [x] `documentTypes.js` — definisi 20 jenis dokumen
- [x] `authEngine.js` — authentication & role
- [x] `webApp.js` — Web App entry point & routing
- [x] `hrisLayer.js` — CRUD karyawan + Supabase
- [x] `hrisSyncLayer.js` — sync HRIS → Spreadsheet + activity log
- [x] `notificationEngine.js` — email notifikasi (belum diaktifkan)
- [x] `backupEngine.js` — backup harian otomatis
- [x] `setupTemplates.js` — buat 6 Google Doc template per perusahaan

### Database & Infrastructure
- [x] Google Sheets "Document Rifim OS" — 6 sheet aktif
- [x] Supabase project `vlievtojpmrbsmzlqswl` — tabel HRIS lengkap
- [x] GitHub Actions: auto `clasp push` setiap commit
- [x] Vercel deployment frontend
- [x] Backup otomatis harian (simpan 7 copy terakhir)
- [x] Activity log: LOGIN, LOGOUT, TAMBAH, EDIT, RESIGN, BUAT DOKUMEN
- [x] Sheet `employees` ter-populate dari HRIS
- [x] Google Doc Templates dibuat di Drive untuk 3 perusahaan (RIFIM, MIG, Lailan)

---

## Sprint 2 — HRIS Enhancement (Sedang Dikerjakan)

### Selesai
- [x] Export rekap karyawan CSV (tombol di tab Karyawan, ikuti filter aktif, UTF-8 BOM)
- [x] Filter absensi per departemen (dropdown di tab Absensi)
- [x] Tabel absensi tampilkan kolom Nama + Departemen
- [x] Search absensi by nama (input `ID / Nama Karyawan…`)

### Selesai (Lanjutan)
- [x] `waEngine.js` — WA Engine umum (Fonnte) untuk semua modul: send ke nomor, send ke grup, batch send, template HRIS/Finance/RAOS/Smart Office
- [x] `notificationEngine.js` — update: WA terintegrasi di semua notifikasi (dokumen baru, kontrak berakhir, slip gaji, cuti, payroll siap, Finance harian/bulanan, saldo driver rendah)
- [x] `configLoader.js` — update: RIFIM_BRANCHES, CABANG_BEBAS_DENDA, dokumentasi setup Fonnte

### Belum Selesai
- [ ] Jalankan `setupWaEngine('4QpkJarRsMd848m8Snye', '120363428871368682@g.us')` dari GAS Editor (sekali)
- [ ] Test PKWT generation end-to-end dari modal "Kontrak Baru"
- [ ] Setup GAS time trigger `notifCheckExpiringContracts()` (tiap hari)
- [ ] Setup GAS trigger `setupTriggerPayrollSiap()` (hari ke-28 jam 08:00)

---

## RAOS — Analisis Sistem Operasional (In Progress)

> Analisis 7 batch sistem existing sebelum membangun modul RAOS

| Batch | Sistem | Status |
|-------|--------|--------|
| 1 | Pengisian Saldo Driver (isi-saldo.vercel.app) | ✅ Dianalisa |
| 2 | Database Driver External (manual input, source DB_Driver) | ✅ Dianalisa |
| 3 | Database Driver Airport (6+ kota, struktur sama) | ✅ Dianalisa |
| 4 | Potongan Order + CONFIG_FEE_KANTOR (formula per kota) | ✅ Dianalisa |
| 5 | Potongan Daily (fee harian per cabang) | ✅ Dianalisa |
| 6 | Iuran Rifim Batam (Rp100.000/bulan, split 50/25/25) | ✅ Dianalisa |
| 7 | RADMS — Real-time Airport Driver Management System | ✅ Dianalisa |

RADMS (Batch 7) sudah production:
- `radms-driver.vercel.app` — Driver App (NIK + Nama)
- `radms-dashboard.vercel.app` — Staff Dashboard (email+pass)
- GAS: Driver.gs, Queue.gs, Auth.gs, KPI.gs, Attendance.gs, Report.gs, Notification.gs
- Scale: 7 Cabang, 300+ Driver, 500+ Penjemputan/Hari
- RAOS di RIFIM OS = integrasi + unified dashboard, bukan rebuild

---

## Pending

### Sprint 2 (lanjutan)
- [ ] Test PKWT generation end-to-end
- [ ] Setup GAS trigger `notifCheckExpiringContracts()`

### Modul Baru (Sprint 3+)
- [ ] **RAOS** — integrasi RADMS + dashboard unified di RIFIM OS
- [ ] **Finance** — cash flow, fee kantor, saldo driver, budget, laporan
- [ ] **CRM** — airport, vendor, partner, client
- [ ] **AI Assistant** — document generator, SOP, business analysis
- [ ] **Executive Dashboard** — KPI, revenue, finance, operasional

---

## Infrastruktur

| Item | Detail |
|------|--------|
| Repo | `github.com/menala-Tech/rifim-os` |
| Hosting | Vercel |
| GAS Web App | `https://script.google.com/macros/s/AKfycbx9_RVyi_58XIeSH-fvrg7CpsUJUpOP5Mim0Q5IDiBiQI7d--WboYhgt7MF6JQl32dW/exec` |
| Spreadsheet ID | `1jHeA-w1bM32S3-AU-ENN2UjiaCb4iLzRhaf4G7y4ozM` |
| Supabase | `vlievtojpmrbsmzlqswl.supabase.co` |
| Deploy GAS | GitHub Actions → clasp push (lokal ETIMEDOUT) |

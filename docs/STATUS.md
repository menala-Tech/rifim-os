# RIFIM OS — Project Status

> Dokumen ini mencatat status aktual proyek. Update setiap akhir sprint.
>
> Last updated: 2026-07-10 (Sprint 2 progress)

---

## Current Phase

**Sprint 0 — Blueprint & Enterprise Foundation**

Status: ✅ Selesai

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

## Pending

### HRIS — Sprint 2 (sedang dikerjakan)
- [x] Export rekap karyawan CSV (tombol di tab Karyawan)
- [x] Filter absensi per departemen + tampilkan nama karyawan di tabel
- [ ] Integrate PKWT generation dengan employee data (modal sudah ada, perlu test end-to-end)
- [ ] Filter absensi per cabang (planned Sprint 3)
- [ ] Setup GAS trigger untuk `notifCheckExpiringContracts()`

### Smart Office
- [x] QR Code pada dokumen — `qrEngine.js` + embed di PDF
- [x] Email notifikasi — `notificationEngine.js` diintegrasikan ke `webApp.js`

### Modul Baru (Sprint 3+)
- [ ] **RAOS** — driver, staff, pickup point, KPI
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

# RIFIM OS — Project Status

> Dokumen ini mencatat status aktual proyek. Update setiap akhir sprint.
>
> Last updated: 2026-07-13 (Sprint 3A RAOS selesai + 4 Dokumen Arsitektur dianalisa)

---

## Protokol Analisa Batch (WAJIB DIIKUTI)

> Berlaku mulai sesi ini. Setiap batch sistem existing yang dikirim user harus melalui alur ini sebelum ada kode yang ditulis.

```
User kirim Batch
      ↓
Claude baca SEMUA script lokal + link (tidak boleh parsial)
      ↓
Analisa mendalam: fungsi, data, alur, integrasi antar modul
      ↓
Simpan ke docs/STATUS.md + CLAUDE.md (lokal + push GitHub)
      ↓
Berikan mapping ke modul RIFIM OS:
Smart Office → HRIS → RAOS → Finance → CRM → Dashboard Direktur
      ↓
Berikan saran urutan Build terbaik
      ↓
Tunggu batch berikutnya — JANGAN mulai coding sebelum semua batch selesai
```

### Status Analisa Batch

| Batch | Sistem | Script Dibaca | Status |
|-------|--------|--------------|--------|
| 1 | Isi Saldo + Absensi + Target Staff | ✅ Semua (Main, Matching, MonitoringSaldo, Absensi, DBDriverSync, LaporanCabang, Reliability) | ✅ Analisa Mendalam |
| 2 | Database Driver External | ✅ Spreadsheet dibaca langsung | ✅ Analisa Mendalam |
| 3 | Database Driver Airport | ✅ Spreadsheet dibaca langsung (6 sheet, 50+ driver/cabang) | ✅ Analisa Mendalam |
| 4 | Potongan Order (Input Dock 1/2/3 + CONFIG_FEE_KANTOR + DB_Driver Kinerja + LOG SISTEM) | ✅ Excel dibaca langsung — semua 17 sheet (CONFIG, DOCK, REKAP, LOG, MONITORING, branch sheets) | ✅ Analisa Mendalam |
| 5 | Potongan Daily | ✅ Excel dibaca langsung (XML parsing) — 3 sheet: Jambi Luar+Airport, Manado, Pekanbaru | ✅ Analisa Mendalam |
| 6 | Iuran Rifim Batam | ✅ Excel dibaca langsung — 156 row, status DISPENSASI/NON AKTIF/NEW/parsial, split 50/25/25 | ✅ Analisa Mendalam |
| 7 | RADMS (Airport Queue System) | ⚠️ Nama file saja | ⏳ Belum mendalam |
| 8 | Database Staff | ✅ Excel dibaca (9 sheet) — SSoT 30 staff, KPI 5 pilar harian, grade A+-E, MASTER TARGET per cabang | ✅ Analisa Mendalam |
| 9 | Perhitungan Gaji Staff (user: Batch 7) | ✅ GAS script + Spreadsheet aktual dibaca — 6 sheet, 28 staff, Rp75.418.000/bulan, cutover absensi 1 Jul 2026 | ✅ Analisa Mendalam |
| 10 | Pendapatan FEE External | ✅ Excel dibaca — revenue Rp3.973.500/bulan dari fee manajemen akun driver (ASK, saldo, akun baru, surcharge) | ✅ Analisa Mendalam |
| 11 | Finance Pemasukan & Pengeluaran | ✅ Excel dibaca (17 sheet) — ~997 transaksi, cash flow per cabang, tagihan AP/BIB/Primkop Rp172.9jt, LIA form manual, GAS triggers, BUG duplikat ASK entries | ✅ Analisa Mendalam |
| 12 | Form Jawaban ASK PT Syafiq | ✅ Excel dibaca (2 sheet) — 12 driver Batam, model komisi 100% ke 5 orang (Ferry/Lia/Pak Bos/Gusril/Nyonya), Rp5.65jt batch, auto-feed ke FINANCE | ✅ Analisa Mendalam |

### Mapping Batch → Modul RIFIM OS (Sementara)

| Batch | Smart Office | HRIS | RAOS | Finance | CRM | Dashboard |
|-------|-------------|------|------|---------|-----|-----------|
| 1 — Isi Saldo | — | Absensi, KPI | Monitoring saldo, SLA alert | Nominal per cabang | — | Target staff |
| 2 — DB Driver External | — | — | Master driver (type=external, zone=non_airport), CRUD admin, lookup ID Maxim | Laporan driver per cabang | — | Jumlah driver aktif |
| 3 — DB Driver Airport | — | — | Master driver (type=konvensional/ask, zone=airport), 6 cabang, 2 tipe driver | Laporan driver per bandara | — | Jumlah driver airport |
| 4 — Potongan Order | — | — | feeEngine (per cabang), driverBalance (debit saldo airport), DB_Kinerja (order/hari), laporan Management Bandara | CONFIG_FEE_KANTOR, fee perusahaan | — | Kinerja cabang real-time |
| 9 — Payroll (Batch 7) | — | Payroll, Absensi (dari Pengisian Saldo sejak 1 Jul), Kasbon | Performa ops | Gaji Rp75.4jt/bln, Lembur, Bonus, Rekap Cabang | — | Total pengeluaran 28 staff |
| 11 — Finance | — | — | — | Pemasukan/Pengeluaran, PDF, rekap | — | Revenue, margin |

---

## Batch Arsitektur — Analisis Selesai (2026-07-13)

> 4 dokumen arsitektur + gambar dari user telah dianalisa mendalam sebelum Sprint 3B dimulai.

| Dokumen | Fokus | Temuan Kunci |
|---------|-------|--------------|
| V2 — Arsitektur Sistem | Layer teknis, RCP Model | 8 roles, RIFIM Core Platform (12 services), integrasi eksternal |
| V3 — UI/UX Mockup | Layout visual sistem | RIFIM Chat di header, queue format A001, AI sebagai kontak |
| V4 — Arsitektur Definitif | RCP 4-level + 9 cabang | +Makassar (CGK) +HO, Analytics sebagai Platform Service, 4 dashboard |
| Framework — Documentation | 8-level doc structure | RIFIM Enterprise Handbook (SSOT), Level 6 AI Knowledge Base |

### Keputusan Arsitektur dari Batch Ini

| Area | Keputusan |
|------|-----------|
| **Cabang** | 9 lokasi: 7 existing + Makassar (Sultan Hasanuddin) + Soekarno-Hatta (CGK) + Head Office |
| **Auth** | RCP 4-level: Role → Cabang → Permission → Data Scope → HAK AKSES AKTIF |
| **Login flow** | Verifikasi Akun → Ambil Role → Ambil Cabang → Ambil Permission → Bangun Menu |
| **Dashboard** | 4 varian: Direktur / Koordinator / Staff / Driver |
| **Analytics** | Platform Service (bukan modul), bagian dari RIFIM Core Platform |
| **AI Assistant** | Muncul sebagai kontak di RIFIM Chat (bukan halaman terpisah) |
| **RAOS Queue** | Format tiket: A001 Andi / A002 Budi (nomor urut + nama, per cabang per hari) |
| **Dokumentasi** | 8-level structure: Executive → Architecture → Business Module → User Guide → SOP → AI Knowledge → Dev → Ops |

### Implikasi untuk Kode Existing

| File | Perlu Update |
|------|-------------|
| `modules/raos/index.html` | Tambah 2 cabang (Makassar, CGK), queue auto-numbering A001 format |
| `automation/apps-script/authEngine.js` | Return 4-level RCP: role + cabang + permission[] + data_scope |
| `automation/apps-script/staffAppApi.js` | Bangun Menu berdasarkan Permission (bukan hanya role) |
| `docs/` | Buat struktur 8-level per Framework doc |

---

## Current Phase

**Sprint 3A — RAOS Module + Finance UI + Dashboard** 

Status: 🟡 In Progress (RAOS selesai, Finance + Dashboard berikutnya)

### Infrastruktur Data (Selesai)

| Tabel Supabase | Baris | Status |
|----------------|-------|--------|
| `drivers` | 422 | ✅ Airport (konvensional+ASK) + External |
| `employees` | 30 | ✅ RIF0001–RIF0030, semua cabang |
| `employee_contracts` | 0 | Belum diisi |
| `attendance` | 0 | Belum diisi |
| `payroll` | 0 | Belum diisi |

⚠️ `drivers` belum enable RLS — perlu policy sebelum aktifkan.

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
| 1 | Pengisian Saldo Driver (isi-saldo.vercel.app) | ✅ Excel + GAS semua dibaca — 13 sheet, dual verification flow, SLA 5 menit, TARGET_STAFF KPI, 7 cabang |
| 2 | Database Driver External (manual input, source DB_Driver) | ✅ Dianalisa |
| 3 | Database Driver Airport (6+ kota, struktur sama) | ✅ Dianalisa |
| 4 | Potongan Order + CONFIG_FEE_KANTOR (formula per kota) | ✅ Dianalisa |
| 5 | Potongan Daily — 3 sheet: Jambi (Rp5.000 kondisional), Manado (Rp10.000 semua driver), PKU (multi-tier) | ✅ Dianalisa mendalam |
| 6 | Iuran Rifim Batam — 156 driver, status DISPENSASI/NON AKTIF/NEW, total Juni Rp10.353.000, split 50/25/25 | ✅ Dianalisa mendalam |
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

### Sprint 3A — Modul Baru
- [x] **RAOS UI** — 5-tab (Dashboard, Antrian, Driver, Saldo, Kinerja) — PR #3 merged
- [x] `routeRaosDriverLayer()` — routing raosGetDriverList/raosAddDriver/raosUpdateDriver
- [ ] RAOS UI patch: queue auto-numbering A001, tambah cabang Makassar + CGK
- [ ] **Finance UI** — cash flow viewer, tagihan tracker, rekap harian/bulanan
- [ ] **Executive Dashboard** — agregasi KPI, revenue, operasional (4 varian: Direktur/Koordinator/Staff/Driver)
- [ ] **RLS drivers** — enable Row Level Security + policy untuk GAS service key

### Sprint 3B — RCP Auth + Chat (Backlog)
- [ ] **Auth RCP upgrade** — authEngine return 4-level (role + cabang + permission[] + data_scope)
- [ ] **Menu Builder** — bangun menu dinamis berdasarkan permission (bukan hardcoded)
- [ ] **RIFIM Chat** — Supabase Realtime, kontak list, grup, broadcast, AI sebagai kontak
- [ ] **AI Module** — Claude API (claude-sonnet-5), knowledge base, analisis data, prediksi antrian

### Sprint 4 (Backlog)
- [ ] **Analytics Platform** — Trend Omzet, Peak Hour, Performa Cabang/Driver/Staff
- [ ] **GPS Monitoring** — Driver tracking (OpenStreetMap), geofence bandara
- [ ] **Dashboard Driver** — Check-in, antrian sendiri, riwayat order, profil
- [ ] **Dashboard Staff** — Absensi, shift, laporan harian sendiri
- [ ] **Knowledge Center** — SOP, FAQ, Tutorial (Level 5 Framework)
- [ ] **AI Knowledge Base** — KNOWLEDGE_BASE.md, VECTOR_INDEX.md (Level 6 Framework)

### Sprint 5 (Backlog)
- [ ] **Payment Gateway** — Midtrans / Xendit integrasi
- [ ] **2FA & Security** — Session management, audit trail
- [ ] **Documentation** — 8-level structure per Framework doc (Level 1-8)
- [ ] **Makassar + CGK cabang** — onboarding operasional

### Sinkronisasi Antar Modul (Kesimpulan 12 Batch)
- Finance = aggregator 4 sumber otomatis: Potongan Order + Saldo Fee + ASK Syafiq + FEE External
- Pengisian Saldo = multi-role: saldo driver + absensi staff (sejak 1 Jul 2026) + pemasukan Finance
- Database Staff = SSoT → consumer: Gaji (payroll.gs) + KPI (KPIAutoScore.gs) + HRIS (Supabase ✅)
- RADMS = sistem mandiri production → perlu integrasi queue ke RIFIM OS Dashboard
- Tagihan partner total: Rp172.9jt (AP Jambi/Manado, BIB Batam, Primkop/Puskopau BPN & PKU)

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

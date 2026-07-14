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
| Business Rule Book | Aturan bisnis konkret | 10 business rules, escalation matrix, 30-min auto-logout, approval chain |

### RIFIM CHAT — Peluang, Kendala & Strategi (Dokumentasi_Peluang_Strategi_RIFIM_Chat.md)

**Roadmap Resmi 5 Tahap:**
| Tahap | Fase | Durasi | Fokus | Status RIFIM OS |
|-------|------|--------|-------|-----------------|
| 1 | Foundation | 0-2 bln | Setup Infra, RCP, User Mgmt, Chat Core, Notifikasi | ✅ Sebagian (tanpa Chat Core) |
| 2 | Operational Core | 3-4 bln | Smart Queue, Absensi, Isi Saldo, Dashboard Ops, Laporan | ✅ Sebagian (RAOS UI done) |
| 3 | HRIS & Finance | 5-7 bln | HRIS, Payroll, Finance & Cashflow, Approval Workflow | 🔄 HRIS done, Finance in progress |
| 4 | Smart Office | 8-9 bln | Surat, Memo, SOP, Arsip, Approval Advance | ✅ Done (GAS Engine) |
| 5 | AI & Analytics | 10-12 bln | AI Assistant, Analytics, Prediksi, Auto Report | ⬜ Belum |

**7 Kendala & Solusi (untuk implementasi):**
| Kendala | Solusi yang Harus Diimplementasikan |
|---------|-------------------------------------|
| Koneksi tidak stabil | Offline queue + auto-sync saat koneksi kembali |
| Notifikasi terlambat | FCM primary + fallback WA/SMS (Fonnte sudah ada) |
| Smart Queue sensitif | Geofencing + validasi lokasi + audit log |
| Disiplin penggunaan | Reminder otomatis + dashboard tugas pending |
| Integrasi antar modul | RIFIM Core Platform (bukan point-to-point) |

**Teknologi tambahan yang muncul:**
- **Redis** — Cache & Session (belum ada, pertimbangkan Sprint 4+)
- **RAG** — Retrieval Augmented Generation untuk AI (Knowledge Base + Vector Index)
- **CDN** — untuk static assets
- **WAF** — Web Application Firewall

**Performance Success Indicators (KPI Sistem):**
- Waktu Proses ↓50% · Kesalahan Input ↓80% · Kepatuhan ↑95% · Kepuasan ↑90% · Visibilitas 100% Real-time

---

### RIFIM CHAT — Struktur Room & Integrasi Notifikasi (Dokumentasi_Struktur_Room_Integrasi_RIFIM_OS.md)

**7 Cabang + Kode Resmi (DEFINITIF):**
| Kode | Cabang | Bandara |
|------|--------|---------|
| BTH | Batam | Hang Nadim |
| JBI | Jambi | Sultan Thaha |
| PKU | Pekanbaru | Sultan Syarif Kasim II |
| BPN | Balikpapan | Sultan Aji Muhammad S. |
| MDC | Manado | Sam Ratulangi |
| MKS | Makassar | Sultan Hasanuddin |
| CGK | Jakarta | Soekarno-Hatta |

**6 Room Scope (dimensi siapa yang menerima):**
1. Seluruh Staff Semua Cabang — global scope
2. Khusus Koordinator — semua koordinator 7 cabang
3. Khusus Admin Pusat — head office only
4. Khusus Manajemen Pusat — top management
5. Khusus Staff per Cabang — per-branch staff
6. Khusus Driver per Cabang — per-branch drivers

**Notification Matrix — Driver tidak dapat:**
Smart Card, Approval, KPI & Target, AI Insight, System Info, Reward & Apresiasi

**Smart Card format (actionable notification):**
`[Judul] [Konten ringkas] [Tombol aksi]` → contoh: "Lihat Detail" / "Lihat Dashboard" / "Review"

**Notification Flow:**
`Event/Trigger → Notification Engine → Routing by Room (Scope & Role) → Smart Card → User`

**Bottom Nav (versi terbaru):**
`Chats (99+) | Kontak | AI Assistant | Notifikasi | Profil`

---

### RIFIM CHAT ROOM — 10 Channel (Dokumentasi_Jenis_Ruang_Chat_RIFIM_OS.md)

**Bottom Nav definitif (update dari doc sebelumnya):**
`Home | Chat | AI Assistant | Kontak | Profil`

**Home Dashboard Koordinator — 4 stats:**
Driver Online (128 ↑12%) · Order Selesai (532 ↑8%) · Pendapatan (Rp 8.450.000 ↑10%) · Rating (4.8 ↑0.2)

**10 Chat Rooms (pre-defined channels, bukan user-created):**
| # | Room | Tipe | Sumber Event Otomatis |
|---|------|------|----------------------|
| 1 | Operasional | operational | Briefing harian, koordinasi, laporan |
| 2 | Driver | module_feed | Info order, edukasi driver |
| 3 | Absensi | module_feed | Check-in/out HRIS, reminder shift |
| 4 | Finance | module_feed | Isi saldo, invoice, laporan keuangan |
| 5 | Smart Office | module_feed | Surat/memo/SOP baru, dokumen |
| 6 | Approval | module_feed | Invoice/cuti/reimbursement pending |
| 7 | Smart Queue | module_feed | Driver masuk antrian, panggilan, selesai |
| 8 | Pengumuman | broadcast | Pengumuman resmi kantor pusat |
| 9 | AI Insight | ai | Insight harian, rekomendasi, prediksi |
| 10 | System | system | Maintenance, update aplikasi, keamanan |

**Arsitektur Chat = Event Bus:**
Setiap modul (RAOS, Finance, HRIS, Smart Office) otomatis push event ke room terkait.
Pengguna tidak perlu pindah aplikasi — semua aktivitas teragregasi di chat room.

**Supabase schema yang dibutuhkan:**
```sql
chat_rooms (id, name, icon, description, type, cabang, created_at)
chat_messages (id uuid, room_id, sender_id, sender_name, content, type, metadata jsonb, cabang, created_at)
chat_room_members (room_id, user_id, role, last_read_at)
```

---

### RIFIM CHAT UI/UX (Dokumentasi_Prompt_UI_UX_RIFIM.md)

**RIFIM CHAT — Dark Theme (berbeda dari modul lain):**
| Token | Hex | Keterangan |
|-------|-----|-----------|
| Background | `#121212` | Hitam gelap |
| Primary Accent | `#FFC700` | Kuning utama |
| Krem/Card | `#FFF6E0` | Card briefing & pengumuman |
| Success | `#22C55E` | Status online |
| Warning | `#F59E0B` | Oranye |
| Info | `#3B82F6` | Biru |
| Purple | `#8B5CF6` | Ungu akses |
| Error/Badge | `#EF4444` | Merah badge |
| Text/Icon | `#E5E7EB` | Abu-abu |

**Font:** Poppins (SemiBold judul, Regular subjudul, Bold angka statistik) · 14-18px body · 22-28px big stats

**Home Dashboard Layout (7 sections):**
1. Header: Avatar + Nama + Role + Cabang (Status: Online) + Search/Chat/Bell icon
2. Banner: Foto airport sunset + Logo RIFIM+Maxim
3. Card Briefing: background krem, tombol kuning "Lihat Detail"
4. Ringkasan Hari Ini: 4 stat cards dark — Driver Datang / Smart Queue / Isi Saldo / Approval + angka perubahan
5. Menu Cepat: 2 baris icon (Absensi, Smart Queue, Driver, Isi Saldo, Approval, Pengumuman, AI Insight, Dokumen, Finance, Lainnya)
6. Pengumuman Terbaru: card krem + tombol kuning "Baca Selengkapnya"
7. Bottom Nav: Beranda (aktif=kuning) | Chat | AI Insight | Notifikasi (badge merah) | Akun

**Logo RIFIM (branding spec):**
- Frame "Ri" kotak merah metalik 3D · "FIM" merah metalik 3D · Panah dinamis melengkung ke kanan atas
- "maxim" di bawah: m=kuning, a=merah, xim=putih/silver
- Warna: `#D71920` (merah) · `#FFC700` (kuning) · `#F2F2F2` (putih) · `#BFBFBF` (abu)
- Background: airport sunset cinematic

---

### Design System (Dokumentasi_Design_System_RIFIM_OS.md)

**Color Tokens (Global):**
| Token | Hex |
|-------|-----|
| PRIMARY | `#1E88E5` |
| SECONDARY | `#FFC107` |
| SUCCESS | `#43A047` |
| WARNING | `#FB8C00` |
| ERROR | `#E53935` |
| INFO | `#00ACC1` |
| Dark-900 | `#111827` |
| Dark-700 | `#374151` |
| Dark-500 | `#6B7280` |
| Light-200 | `#D1D5DB` |
| Light-100 | `#F3F4F6` |

**Typography:**
- H1: 32px Bold · H2: 24px Bold · H3: 20px SemiBold
- Body1: 14px Regular · Body2: 12px Regular · Caption: 11px Medium

**Queue Format:** `A-023` (A- prefix + 3-digit zero-padded, per cabang per hari)

**Dashboard per Role:**
- Direktur: Total Pendapatan + Total Driver + trend graph
- Koordinator: Pendapatan Bulan Ini + Driver Aktif + Order Hari Ini
- Staff: Task counters (Isi Saldo / Konfirmasi Order / Absensi / Pembinaan Driver)
- Driver: Greeting + Saldo + Isi Saldo button

**Finance Layout (blueprint untuk modules/finance/index.html):**
- Saldo Card: hijau, nominal besar, tombol Isi Saldo
- Ringkasan: Pendapatan Bulan Ini (+% vs bulan lalu), Invoice (count Belum Lunas), Pengeluaran, Laba Bersih

**Animation:** Transition Fade 200ms · Queue Update Slide/Fade · Success Scale/Fade · Error Shake/Fade

**Platform:** Web App + PWA + Android + iOS · Light Mode + Dark Mode

---

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

### Business Rules → Implementation Checklist

| Rule | Aturan | Modul | Status |
|------|--------|-------|--------|
| BR-01 | Koordinator hanya lihat data cabangnya (filter by cabang di setiap query) | HRIS, RAOS, Finance | ⬜ Belum |
| BR-02 | Staff tidak bisa hapus data Absensi | HRIS | ⬜ Belum |
| BR-03 | Driver keluar geofence → otomatis keluar antrian | RAOS | ⬜ Belum (Sprint 4) |
| BR-04 | Isi Saldo > batas harian → reject + notif Koordinator | Finance | ⬜ Belum |
| BR-05 | Nomor HP wajib unik di semua modul | Semua | ⬜ Belum |
| BR-06 | Saldo tidak boleh negatif → tolak transaksi | Finance | ⬜ Belum |
| BR-07 | Order > 15 menit tanpa update → notif Driver + Koordinator | RAOS | ⬜ Belum |
| BR-08 | Login gagal > 5x → kunci 15 menit + notif Admin | Semua | ⬜ Belum |
| BR-09 | Perangkat baru → OTP/email verifikasi | Semua | ⬜ Belum |
| BR-10 | Approval Invoice: Staff → Koordinator → Finance | Finance | ⬜ Belum |
| SEC-01 | Auto-logout 30 menit tidak aktif | Frontend semua modul | ⬜ Belum |
| SEC-02 | Password minimal 8 karakter, kombinasi huruf+angka+simbol | Auth | ⬜ Belum |

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

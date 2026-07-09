# Phase 2 Blueprint — HRIS

> RIFIM OS — Human Resource Information System
>
> Status: 🚧 In Progress
>
> Tanggal Mulai: 2026-07-10

---

## Tujuan

Membangun modul HRIS (Human Resource Information System) untuk mengelola seluruh data kepegawaian RIFIM Group:
- PT. RIFIM Internasional Gemilang
- PT. Menala Internasional Gemilang (MIG)
- CV. Lailan Kalilan Indonesia (LAILAN)

---

## Scope

| Fitur | Deskripsi | Sprint |
|-------|-----------|--------|
| Master Data Karyawan | CRUD karyawan semua perusahaan | Sprint 1-2 |
| Manajemen Kontrak | PKWT/SP via Document Engine | Sprint 2-3 |
| Absensi | Check-in/out manual + rekap | Sprint 3 |
| Cuti | Pengajuan + approval + saldo | Sprint 3-4 |
| Payroll | Slip gaji + finalisasi | Sprint 4-5 |

---

## Engines Dibangun di Phase 2

### Auth Engine (`authEngine.js`) ✅
- `authVerifyUser(email)` → verifikasi + ambil role dari Supabase
- `authHasPermission(email, permission)` → RBAC check
- `authUpsertUser(userData)` → tambah/update user
- Role: ADMIN > DIREKTUR > KOORDINATOR > STAFF > DRIVER
- Fallback ke company_config jika Supabase tidak tersedia

### Notification Engine (`notificationEngine.js`) ✅
- `notifSendEmail(to, subject, htmlBody)` → via GmailApp
- `notifCheckExpiringContracts()` → kontrak hampir habis (trigger harian)
- `notifLeaveStatusChanged(employee, leave)` → cuti disetujui/ditolak
- `notifPayslipReady(employee, payroll)` → slip gaji tersedia

---

## Database — Supabase PostgreSQL

**Project**: `vlievtojpmrbsmzlqswl` | Region: ap-southeast-2

| Tabel | Deskripsi |
|-------|-----------|
| `users` | Auth & role management |
| `employees` | Master data karyawan |
| `employee_contracts` | Riwayat kontrak |
| `attendance` | Absensi harian |
| `leave_requests` | Pengajuan cuti |
| `leave_balances` | Saldo cuti per tahun |
| `payroll` | Data slip gaji |

Migration: `phase2_hris_schema` — Applied 2026-07-10 ✅

---

## Arsitektur

```
Vercel (modules/hris/index.html)
          │
          │ POST/GET (fetch)
          ▼
Google Apps Script (webApp.js)
          │
          ├─ authEngine.js      → verifikasi user + role
          ├─ notificationEngine.js → email notifications
          ├─ hrisLayer.js       → CRUD via Supabase REST API
          │         │
          │         ▼
          │   Supabase PostgreSQL
          │   (7 tabel HRIS)
          │
          └─ documentEngine.js  → generate PKWT/SP/PHK (reuse Phase 1)
```

---

## Files

```
automation/apps-script/
├── authEngine.js         ← Phase 2 Engine ✅
├── notificationEngine.js ← Phase 2 Engine ✅
└── hrisLayer.js          ← HRIS Data Layer ✅

modules/hris/
└── index.html            ← HRIS Dashboard ✅

docs/02-Roadmap/
└── Phase2.md             ← Dokumen ini
```

---

## Setup Supabase (Satu Kali)

1. Buka Apps Script editor
2. Buka `hrisLayer.js`
3. Edit fungsi `setupHrisConfig()`:
   ```javascript
   'SUPABASE_SERVICE_KEY': 'PASTE_SERVICE_ROLE_KEY_HERE'
   ```
   Isi dengan Service Role Key dari:
   Supabase Dashboard → Settings → API → `service_role` key
4. Jalankan `setupHrisConfig()`
5. Jalankan `clasp push` untuk deploy ke GAS

---

## Sprint Plan

### Sprint 1 — Foundation ✅ DONE
- [x] Supabase schema (7 tabel)
- [x] Auth Engine
- [x] Notification Engine
- [x] HRIS Data Layer (hrisLayer.js)
- [x] HRIS Dashboard (index.html)
- [x] GAS endpoints (doGet HRIS + doPost HRIS)
- [x] vercel.json route /hris
- [x] Phase2.md

### Sprint 2 — Polish & Contract Integration
- [ ] Test semua HRIS endpoints dari dashboard
- [ ] Integrate PKWT generation dengan employee data
- [ ] Export rekap karyawan (CSV)
- [ ] Filter absensi per departemen

### Sprint 3 — Notifications & Triggers
- [ ] Setup GAS time trigger untuk notifCheckExpiringContracts()
- [ ] WhatsApp integration (via WhatsApp Business API)
- [ ] Dashboard stats total absensi/cuti bulan ini

### Sprint 4 — Payroll Enhancement
- [ ] Generate slip gaji via Document Engine (create new doc type)
- [ ] Bulk payroll untuk semua karyawan sekaligus
- [ ] Export rekap payroll ke Google Sheets

---

## Setelah Phase 2 Selesai → Phase 3: RAOS

RAOS (Rideshare & Armada Operations System):
- Manajemen kendaraan
- Monitoring driver
- Trip management
- Customer tracking

---

## Definition of Done Phase 2

- [ ] Semua 7 tabel Supabase berjalan dengan data nyata
- [ ] Auth Engine berjalan (login + role)
- [ ] HRIS dashboard dapat diakses di rifim-os.vercel.app/hris
- [ ] CRUD karyawan berfungsi
- [ ] Kontrak terhubung ke Document Engine
- [ ] Absensi & cuti berjalan
- [ ] Payroll dasar berfungsi
- [ ] Notifikasi email berfungsi

---
name: rifim-os-staff-driver-flow
description: Alur update data STAFF (karyawan konter/cabang) dan DRIVER (RAOS) ke HRIS, Finance, RAOS PWA — mapping SSoT sheet → Supabase → downstream PWA. Staff SSoT di sheet DATABASE STAFF tab MASTER DATA STAFF (1fcraq3, sync 10 min auto ke `employees`), Driver SSoT di RAOS Master tab Input Driver Airport/External (1eYS, manual tombol "Proses Input Driver" ke `raos_drivers`). Downstream: HRIS baca `employees`, Finance baca `user_profiles` (bukan employees!), RAOS baca `raos_staff_master`/`raos_drivers`. Gunakan skill ini setiap user tanya "cara update staff/driver", "kenapa staff baru tidak muncul di Finance", "driver edit sheet tapi tidak muncul di PWA", atau menyentuh file `hrisMasterStaffSync.js` / `raosDriverLayer.js`.
---

# Staff & Driver Data Flow — SSoT → PWA

## 👥 STAFF (karyawan cabang/konter)

**SSoT sheet:** [`DATABASE STAFF` → tab `MASTER DATA STAFF`](https://docs.google.com/spreadsheets/d/1fcraq3QHqIaD-13Ebzt6stT9aA6j_loTXeAtpNX12kw/edit)
Spreadsheet ID: `1fcraq3QHqIaD-13Ebzt6stT9aA6j_loTXeAtpNX12kw`
Tab: `MASTER DATA STAFF`

**Kolom yang di-edit:**
| Kol | Nama | Contoh | Catatan |
|---|---|---|---|
| A | Email | `staff@gmail.com` | Auth key |
| B | Nama | `Dian Fuzianti` | full_name |
| C | Gaji Staff | `Rp 2.000.000` | salary_base |
| D | ID CABANG | `ID Rifim Airport Soeta` | Wajib match `branches.slug` exact case |
| E | ID Staff | `MIG-SOETA0010` | employee_id, unique |
| F | Jabatan | `STAFF KONTER` | position |
| G | No WA | `62 857-7186-5772` | phone (normalized ke 62xxx) |
| H | Pin | `123456` | Login PWA |
| **L** | **Status Aktif** | `TRUE` / `FALSE` | **Canonical lifecycle flag** |
| N | Sync Status | auto-fill | Jangan edit manual (conflict guard) |

**Sync engine:** `automation/apps-script/hrisMasterStaffSync.js` — fungsi `syncEmployeesFromMasterStaff()`, trigger 10 menit ke Supabase table `employees`.

**Aturan:**
- **Add baru**: isi row → 10 min → muncul di HRIS PWA. Kolom `company_code / department / join_date / employment_type` di-set default `RIFIM / '' / today / 'PKWT'` — admin ubah via UI `/hris` kalau bukan RIFIM (MIG/LAILAN).
- **Update existing**: edit sheet → 10 min auto-refresh nama/gaji/cabang/jabatan/HP/PIN. Kolom admin-managed (`company_code`, `department`, `join_date`, `employment_type`) **JANGAN** ubah di sheet.
- **Nonaktifin**: set kolom L → `FALSE`. Sync auto-set status NONAKTIF (soft delete, FK aman).
- **Hapus dari sheet**: sync detect missing row → auto-set NONAKTIF (bukan hard delete).

**Downstream tabel:**
- **HRIS PWA** (`/hris`) → baca `employees` (canonical HR data)
- **Finance PWA** (`/finance` Target Staff) → baca `user_profiles` — **BUKAN** `employees`!
- **RAOS PWA** → baca `raos_staff_master` (khusus Soeta) atau `raos_soeta_staff_sheet_mirror` (auto-mirror)

**Gotcha #1 — Staff baru tidak muncul di Finance:**
Root cause biasanya `user_profiles` belum ada. `user_profiles` ≠ `employees` — di-sync terpisah oleh auth trigger. Solusi:
- Cek `select * from user_profiles where full_name ilike '%NAMA%'`
- Kalau kosong → staff belum di-auth ke Supabase. Perlu create via admin di Supabase Auth, atau minta staff login pertama kali via PWA (trigger auto-create profile).

---

## 🚗 DRIVER (RAOS driver airport/external)

**SSoT sheet:** RAOS Master `1eYS…` → 2 tab:
- `Input Driver Airport` — driver airport (T1/T2/T3/BTH/JBI/PKU/BPN/MDC/MKS)
- `Input Driver External` — driver luar airport (non-airport)

Spreadsheet ID: `1eYS2mM3Sy-BNAVGfp8BUHtsZuLiGDetnJeGw-AWk__8`

**Kolom Input Driver:**
- Nama, HP, Kendaraan, No Polisi, Cabang (match `branches.slug`), Aktif (TRUE/FALSE)

**Engine:** `automation/apps-script/raosDriverLayer.js`
- Sheet → tombol **"Proses Input Driver"** (menu Extensions custom) → Supabase `raos_drivers` → `syncDriversDariSupabase()` auto refresh sheet display

**Alur update:**
1. Buka sheet RAOS Master → tab `Input Driver Airport` atau `Input Driver External`
2. Isi row baru atau edit existing
3. **WAJIB klik tombol "Proses Input Driver" di menu Extensions** — validasi + upsert ke Supabase
4. `syncDriversDariSupabase()` auto-refresh sheet display setelah upsert sukses

**PENTING — bukan auto-timer:** Driver sync **manual trigger only**, beda dari staff (yg auto 10 min). Kalau lupa klik tombol → PWA tetap tampil data lama.

**Downstream tabel:**
- **Finance PWA** (`/finance` DB Driver) → baca `raos_drivers` + `raos_driver_staff_assignment`
- **RAOS PWA** (repo `raos-menala`) → baca `raos_drivers` full, driver dashboard, assignment

**Gotcha #2 — Driver edit tapi tidak muncul di PWA:**
Root cause hampir selalu: tombol "Proses Input Driver" belum di-klik. Cek `select * from raos_drivers where updated_at > now() - interval '10 min'` — kalau kosong, sync belum jalan.

---

## 🔄 Diagram alur

```
STAFF:
  Sheet MASTER DATA STAFF ──(10min auto)──► Supabase employees ──► HRIS PWA
                                                 │
                                                 └──(auth trigger)──► user_profiles ──► Finance / RAOS PWA

DRIVER:
  Sheet Input Driver Airport/External ──(manual tombol)──► Supabase raos_drivers ──► Finance / RAOS PWA
```

---

## Common issues — quick diagnosis

| Symptom | Root cause | Fix |
|---|---|---|
| Staff baru add sheet, HRIS PWA belum muncul (>10 min) | Trigger `syncEmployeesFromMasterStaff` mati atau error | Cek `system_log` filter `hrisMasterStaff` action; re-install trigger via `installHrisMasterStaffSyncTrigger()` |
| Staff sudah di HRIS tapi tidak di Finance Target Staff | `user_profiles` belum ada (auth flow) | Manual create di Supabase Auth atau minta staff login pertama |
| Driver edit sheet, Finance DB Driver tetap lama | Tombol "Proses Input Driver" belum di-klik | Klik tombol di menu Extensions sheet RAOS Master |
| Staff status FALSE tapi masih AKTIF di PWA | Kolom N (Sync Status) CONFLICT | Investigate duplicate `employee_id` atau `email`; sync writer akan force NONAKTIF pada conflict row |
| Cabang salah di sheet → row unmapped | Kolom D staff / cabang driver tidak match `branches.slug` exact | Case-sensitive check: `ID Rifim Airport Batam` bukan `Batam` atau `id rifim airport batam` |

## Reference file

- Staff sync: [`automation/apps-script/hrisMasterStaffSync.js`](automation/apps-script/hrisMasterStaffSync.js)
- Driver sync: [`automation/apps-script/raosDriverLayer.js`](automation/apps-script/raosDriverLayer.js)
- Finance target staff endpoint (baca user_profiles): [`automation/apps-script/crmApi.js`](automation/apps-script/crmApi.js) fungsi `_finKpiTargetStaffList_`

## Related skills

- [[rifim-os-external-resources]] — Spreadsheet ID + Drive folder lokasi kanonik
- [[rifim-os-gas-rules]] — trigger install pattern, ScriptLock, system_log logging
- [[rifim-os-integration-rules]] — SSoT data contract lintas modul

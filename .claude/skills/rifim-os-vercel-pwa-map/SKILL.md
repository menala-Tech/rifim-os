---
name: rifim-os-vercel-pwa-map
description: Status migrasi & mapping endpoint Vercel PWA untuk RIFIM OS ecosystem — Monitor Saldo, Monitor Koordinator (@RIFIM OS Main GAS "V55"), Isi Saldo Staff & Admin (@Pengisian Saldo GAS), duplikasi config WA group per cabang antara 2 project GAS, 3 trigger saldo/potongan yang dinonaktifkan (cekSLASaldo, cekSLASaldoPWA, cekSLAPotongan) supaya tidak WA duplikat, konsekuensi 2 project GAS punya fungsi nama sama tapi logika beda. Gunakan skill ini setiap kali menyentuh Monitor Saldo/Koordinator, Isi Saldo, atau debug WA duplikat/notif tidak sampai — bahkan kalau user hanya sebut "PWA", "Vercel", "isi saldo", "monitor cabang", "WA grup cabang".
---

# Vercel PWA Endpoint Map — RIFIM OS Ecosystem

## Mapping Aktif (per 20 Juli 2026)

| PWA | Vercel URL | GAS Endpoint | Project GAS |
|---|---|---|---|
| **Isi Saldo Staff** | `isisaldo.vercel.app/?cabang=…&staff=…` | `AKfycbzq…omm` @52 | Pengisian Saldo |
| **Admin Isi Saldo** | `isisaldo.vercel.app/admin` | `AKfycbzq…omm` @52 (sama) | Pengisian Saldo |
| **Monitor Saldo** | `rifim-monitor-saldo.vercel.app` | `AKfycbzzK75…ZZtw` @52 "V55" | RIFIM OS (Main) |
| **Monitor Koordinator** | `rifim-monitor-koordinator.vercel.app` | `AKfycbzzK75…ZZtw` @52 "V55" (sama) | RIFIM OS (Main) |

## Kenapa Monitor Migrasi (Sesi 20 Juli)

Sebelumnya Monitor Saldo & Koordinator point ke RIFIM OS `AKfycbzzK75…ZZtw`, tapi endpoint hanya balikin default `{"success":true,"app":"RIFIM OS…","status":"running"}` — bukan data monitoring. Karena RIFIM OS masih pengembangan dan data saldo aktual ada di spreadsheet Pengisian Saldo, kedua PWA dimigrasikan ke endpoint Pengisian Saldo `AKfycbzq…omm` @52 (backend `doGetJSONSaldo` + `doGetJSONKoordinator` di `Main.gs`). Verified: data cabang muncul.

## Trigger yang Dinonaktifkan (RIFIM OS Main)

3 trigger dinonaktifkan supaya tidak WA duplikat ke grup cabang yang sama:

- `cekSLASaldo`
- `cekSLASaldoPWA`
- `cekSLAPotongan`

**Setup ulang** (`setupPotonganTriggers` dll) HANYA setelah RIFIM OS live dengan token & grup Fonnte terpisah. Fungsi backend (`refreshMonitoringSaldo`, `cekSLASaldo`, `saldoEngine.js` dll) TETAP ADA di kode — tinggal pasang trigger ulang saat siap live.

## Konsekuensi Penting

1. Perubahan pada `Pengisian Saldo` (`Matching.gs`, `MonitoringSaldo.gs` dll) **TIDAK berlaku** untuk Monitor Saldo/Koordinator. Sebaliknya juga.
2. **2 project GAS punya fungsi dengan nama sama tapi logika berbeda:** `refreshMonitoringSaldo`, `cekSLASaldo`. Selalu pastikan folder/scriptId yang benar sebelum edit.
3. Sheet sumber data saldo berbeda:
   - **Pengisian Saldo** → `Jawaban Formulir 1` (PWA staff submit)
   - **RIFIM OS** → `Form Input Saldo PWA` (via `staffSaldoSubmit`) + `Form Input Saldo AIST` (admin paste dari Maxim) — **belum aktif**, akan kosong sampai PWA staff RIFIM OS di-release
4. Konfigurasi WA group per cabang **di-duplicate manual:** `SAL_WA_GROUP_PER_CABANG` (Pengisian Saldo/`MonitoringSaldo.gs`) ↔ `_MON_WA_SALDO_GRUP` (RIFIM OS/`raosMonitoringEngine.js`). **Kalau salah satu diedit, yang lain harus di-sync manual.**

## RAOS PWA (Terpisah dari Ecosystem Ini)

RAOS PWA (`raos-menala.vercel.app`) pakai Supabase langsung, bukan GAS. Beda ekosistem. Kolaborasi via Supabase shared + broadcast `raos-saldo-new` + bookmarklet AIST v2.

## Referensi

- **Push clasp ke project tertentu:** skill `rifim-os-gas-rules`
- **Redeploy checklist URL /exec tetap:** skill `rifim-os-gas-rules`

# Audit Opsi D — Duplikasi Data & Config

**Tanggal**: 2026-08-05
**Scope**: Rifim-OS + RAOS Supabase (`vlievtojpmrbsmzlqswl`) + 2 GAS project (RIFIM OS Main + Pengisian Saldo)
**Branch**: `claude/rifim-raos-data-sync-x4k4r5`
**Status**: **Discovery only — ZERO DB changes made**

---

## Executive Summary

Audit menyeluruh 3 kategori duplikasi:

| # | Kategori | Status | Rekomendasi utama |
|---|---|---|---|
| A | Kolom cache nama di Supabase | ✅ Bersih | Tidak ada aksi drop; 1 finding minor (dead reference `driver_branch_name`) |
| B | Tabel V1 vs V2 (KPI + Payroll) | ⚠️ Dual-write chaos | Migrasi PWA `/kpi` reader ke V2, migrasi GAS writer ke V2, rename V1 |
| C | Config duplikat lintas GAS project | ⚠️ Manual mirror rentan drift | Konsolidasi ke `system_config` Supabase |

**Kabar baik**: tidak ada temuan kritis yang harus drop urgent. Pattern SSoT+cache (Supabase → sheet cache) sudah bersih. Yang perlu diberesin:

1. **Dual system KPI** — GAS RAOS cron isi V1, Rifim-OS Finance UI isi V2, keduanya tidak saling baca. PWA `/kpi` tampil V1, payroll pakai V2. Kalau angka beda → KPI staff di PWA tidak match bonus yang dibayar.
2. **WA group config** di-copy manual antar 2 GAS project — rentan drift saat cabang baru.

---

## Discovery A — Kolom Cache Nama

### Metode
Query `information_schema.columns` untuk pattern `*_name`, `*_email`, `*_phone`, `*_snapshot`, `*_cache` di semua tabel `public` selain master (`user_profiles`, `raos_drivers`, `branches`, `pickup_points`, `shifts`, `chat_rooms`, `system_config`).

### Hasil

| Tabel | Kolom | Verdict |
|---|---|---|
| `crm_contacts.name` | Primary label kontak | ✅ Bukan cache — nama kontak itu sendiri |
| `employees.full_name` | Master HRIS | 🚫 MILIK PROYEK LAIN — jangan sentuh |
| `raos_geofence_points.name` | Label titik geofence | ✅ Bukan cache — nama geofence sendiri |
| **`raos_saldo_requests.driver_name`** | Nama driver saat submit | ⚠️ **INTENTIONAL SNAPSHOT** — jangan drop |
| `users.full_name` | Master proyek lain | 🚫 MILIK PROYEK LAIN — jangan sentuh |

### Verdict `raos_saldo_requests.driver_name`

**BUKAN cache untuk didrop. Ini historical snapshot yang disengaja.**

Bukti dari [raos-menala/apps/pwa/src/lib/saldoRequest.ts:161-175](../../raos-menala/apps/pwa/src/lib/saldoRequest.ts#L161):

```js
const content = JSON.stringify({
  ...
  // Driver snapshot untuk render card tanpa join tambahan di client
  driver_login_id: driverLoginId,
  driver_name: driverName,
  driver_branch_name: driverBranchName ?? null,
})
```

Alasan snapshot legit:
1. Driver bisa saja tidak match ke `raos_drivers` (staff ketik nama manual)
2. Kalau driver rename setelah request, histori pengajuan tetap tampil nama saat submission (audit integrity)
3. Render bubble di chat tanpa perlu JOIN tambahan (perf mobile)

**Data sample DB** (1 row saat ini):
```
total=1, with_driver_id=1, with_driver_name=1, both=1, name_only=0, id_only=0
```
Keduanya filled — konsisten dengan pola snapshot.

Consumer di [raos-menala/apps/pwa/src](../../raos-menala/apps/pwa/src):
- `lib/saldoRequest.ts` — WRITE (submit)
- `lib/driverQueue.ts` — pass ke chat message content JSON (bukan DB column)
- `components/SaldoRequestCard.tsx` — READ dari `raos_saldo_requests`
- `components/DriverQueueCard.tsx` — READ dari chat message content JSON
- `app/riwayat/page.tsx` — READ dari `raos_saldo_requests`
- `app/antrian-driver/page.tsx` — READ dari RPC result

### 🐛 Bonus finding A: `driver_branch_name` (dead reference)

Kode di [saldoRequest.ts:174](../../raos-menala/apps/pwa/src/lib/saldoRequest.ts#L174) dan [SaldoRequestCard.tsx:20](../../raos-menala/apps/pwa/src/components/SaldoRequestCard.tsx#L20) reference kolom `driver_branch_name`, tapi kolom itu **TIDAK ADA** di schema `raos_saldo_requests`. Dead reference — silent-null.

Rekomendasi (Sesi 2 opsional, prioritas rendah):
- Opsi 1: Hapus kode reference `driver_branch_name` kalau tidak dipakai UI
- Opsi 2: Tambah kolom `driver_branch_name text` ke schema kalau memang mau ditampilkan cabang driver di card

---

## Discovery B — V1 vs V2 KPI + Payroll

### Landscape tabel

| Tabel | Owner writer | Row count | Last write | Status |
|---|---|---|---|---|
| `kpi_targets` (V1) | RAOS GAS `04_kpi.gs` + `15_kpi_engine.gs` | 29 | 2026-08-02 | ⚠️ **Masih aktif** |
| `raos_kpi_targets_branch` (V2) | Rifim-OS `crmApi.js` | 9 | 2026-08-04 | Aktif |
| `raos_kpi_targets_staff` (V2) | Rifim-OS `crmApi.js` | 0 | never | Kosong (UI tersedia, belum diisi) |
| `raos_payroll` (V2) | Rifim-OS RPC `raos_compute_payroll_month` | 28 | (sesuai compute) | Aktif |
| `payroll` (HRIS) | Proyek lain | ? | ? | 🚫 MILIK PROYEK LAIN — jangan sentuh |

### Consumer map

**V1 `kpi_targets`:**
| Layer | File | Operation |
|---|---|---|
| GAS writer | `raos-menala/gas/04_kpi.gs:69` | `callSupabase('kpi_targets?on_conflict=staff_id,month,year', 'POST', ...)` |
| GAS writer | `raos-menala/gas/15_kpi_engine.gs:288` | Same as above |
| PWA reader | `raos-menala/apps/pwa/src/app/kpi/page.tsx:41` | `.from('kpi_targets').select(...)` |
| SQL schema | `raos-menala/sql/001_schema.sql:139` | `CREATE TABLE IF NOT EXISTS kpi_targets` |
| RLS | `raos-menala/sql/002_rls.sql:12,116-124` | 3 policies |
| Docs | `README.md`, `STATUS.md`, `RULE_PROJECT.md`, `CLAUDE.md`, `SESSION_PROMPT.md` | Reference only |

**V2 `raos_kpi_targets_branch` + `raos_kpi_targets_staff` + `raos_payroll`:**
| Layer | File | Operation |
|---|---|---|
| GAS writer | (none) | Belum ada GAS writer V2 |
| Rifim-OS writer | `automation/apps-script/crmApi.js` endpoints `finance_kpi_target_*`, `finance_payroll_*` | via UI Finance |
| UI reader | `modules/finance/index.html` — tab Target Cabang, Target Staff | HTML+JS fetch |
| UI reader | `modules/hris/index.html` — autofill Bonus RAOS | via `hris_payroll_bonus_list` endpoint |
| PWA RAOS reader | (none) | Tidak ada |

### Masalah kritis: Dual-write chaos

- **GAS RAOS cron 22:00** isi V1 setiap malam pakai formula lama (`target_scan`, `target_gmv`)
- **Rifim-OS Finance UI** isi V2 saat admin edit target manual (`target_cabang`, `target_staff_default`)
- **Keduanya tidak saling baca.** PWA RAOS `/kpi` tampil data V1, sementara payroll Finance pakai V2

**Konsekuensi:** kalau angka target di V1 dan V2 berbeda (kemungkinan besar iya karena schema berbeda dan tidak ada sync), KPI staff yang tampil di PWA tidak match dengan bonus yang mereka terima di payroll. Konfusi operasional.

### Migration plan (Sesi 3)

**Tahap B1** — Migrate PWA `/kpi` reader V1 → V2:
- Bikin RPC baru `get_kpi_staff_full(p_month date)` yang gabungkan `raos_kpi_targets_branch` + `raos_kpi_targets_staff` + view `raos_target_tercapai_bulan` + `raos_payroll`
- Update `raos-menala/apps/pwa/src/app/kpi/page.tsx` pakai RPC
- Verify visual regression di dev

**Tahap B2** — Migrate GAS writer V1 → V2:
- Update `gas/04_kpi.gs` + `gas/15_kpi_engine.gs`:
  - `callSupabase('kpi_targets?...')` → `callSupabase('raos_kpi_targets_branch?...')` untuk target per-cabang
  - Post-write: panggil RPC `raos_compute_payroll_month` supaya realisasi otomatis update
- Test manual di GAS editor sebelum push

**Tahap B3** — Data migration V1 → V2:
- Untuk 29 row `kpi_targets` existing, buat script INSERT ke `raos_kpi_targets_branch` (kalau relevan) atau discard kalau schema V1 tidak translatable
- Verify tidak ada data loss

**Tahap B4** — Rename V1 (cool-down):
```sql
ALTER TABLE kpi_targets RENAME TO kpi_targets_deprecated_20260805;
```
Monitor 3 minggu di `system_logs`. Drop candidate **2026-08-26**.

### Risk register B

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| PWA `/kpi` break saat V1 rename | Medium | High | Migrate reader dulu, verify sebelum rename |
| GAS cron 22:00 error saat V1 rename | Medium | Medium | Fix writer sebelum rename |
| Data historis V1 hilang | Low | Medium | Migrasi data V1 → V2 sebelum rename |
| Schema V1 tidak translate ke V2 | Medium | Low | Discard V1 historis + start fresh dari V2 kalau field mapping tidak jelas |

---

## Discovery C — Config Duplikat Lintas GAS Project

### Yang di-copy manual

**`_MON_WA_SALDO_GRUP`** di [rifim-os/automation/apps-script/raosMonitoringEngine.js:70-78](../automation/apps-script/raosMonitoringEngine.js):

```js
var _MON_WA_SALDO_GRUP = {
  'ID Rifim Airport Batam':      '120363416803569567@g.us',
  'ID Rifim Batam':              '120363428603841015@g.us',
  'ID Rifim Airport Jambi':      '120363426397739283@g.us',
  'ID Rifim Jambi Luar':         '120363428541236760@g.us',
  'ID Rifim Airport Balikpapan': '120363421746844167@g.us',
  'ID Rifim Airport Manado':     '120363423659965572@g.us',
  'ID Rifim Airport Pekanbaru':  '120363402974243112@g.us',
};

var _MON_WA_POT_GRUP = {
  'ID Rifim Airport Batam':      '120363162218897223@g.us',
  'ID Rifim Airport Jambi':      '120363142722288524@g.us',
  'ID Rifim Airport Balikpapan': '120363420259437087@g.us',
  'ID Rifim Airport Manado':     '120363423102090113@g.us',
  'ID Rifim Airport Pekanbaru':  '120363347628262640@g.us',
};
```

**Mirror**: `SAL_WA_GROUP_PER_CABANG` di GAS project Pengisian Saldo (`MonitoringSaldo.gs`) — tidak di-clone ke sesi ini karena repo terpisah. Referensi di [rifim-os/CLAUDE.md:433](../CLAUDE.md).

### Konsekuensi drift

Kalau tambah cabang baru (mis. Palembang):
1. Harus edit di `_MON_WA_SALDO_GRUP` (Rifim-OS)
2. Harus edit di `SAL_WA_GROUP_PER_CABANG` (Pengisian Saldo)
3. Kalau salah satu terlewat → notif WA nyasar ke grup salah / tidak terkirim

### Rekomendasi konsolidasi (Sesi 3)

**Pattern: `system_config` Supabase = satu-satunya source.**

`system_config` sudah ada di Supabase (`vlievtojpmrbsmzlqswl.public.system_config`) tapi belum menampung WA group config. Isinya sekarang cuma 13 entri (bobot KPI, timezone, fee, dst).

**Migration draft:**
```sql
INSERT INTO system_config (key, value, description) VALUES
  ('wa_saldo_group_per_branch', jsonb_build_object(
    'ID Rifim Airport Batam',      '120363416803569567@g.us',
    'ID Rifim Batam',              '120363428603841015@g.us',
    'ID Rifim Airport Jambi',      '120363426397739283@g.us',
    'ID Rifim Jambi Luar',         '120363428541236760@g.us',
    'ID Rifim Airport Balikpapan', '120363421746844167@g.us',
    'ID Rifim Airport Manado',     '120363423659965572@g.us',
    'ID Rifim Airport Pekanbaru',  '120363402974243112@g.us'
  ), 'WA group ID per cabang untuk notif saldo — dipakai raosMonitoringEngine (rifim-os) + MonitoringSaldo (Pengisian Saldo)'),

  ('wa_potongan_group_per_branch', jsonb_build_object(
    'ID Rifim Airport Batam',      '120363162218897223@g.us',
    'ID Rifim Airport Jambi',      '120363142722288524@g.us',
    'ID Rifim Airport Balikpapan', '120363420259437087@g.us',
    'ID Rifim Airport Manado',     '120363423102090113@g.us',
    'ID Rifim Airport Pekanbaru',  '120363347628262640@g.us'
  ), 'WA group admin per cabang untuk notif potongan');
```

**GAS helper baru** (`gasUtils.js`):
```js
function _getWaSaldoGroupPerBranch() {
  var props = PropertiesService.getScriptProperties();
  var cached = props.getProperty('_wa_saldo_cache');
  var cachedAt = Number(props.getProperty('_wa_saldo_cache_at') || 0);
  var TTL = 60 * 60 * 1000; // 1 jam
  if (cached && Date.now() - cachedAt < TTL) return JSON.parse(cached);

  var url = SUPABASE_URL + '/rest/v1/system_config?key=eq.wa_saldo_group_per_branch&select=value';
  var res = UrlFetchApp.fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY },
    muteHttpExceptions: true,
  });
  var arr = JSON.parse(res.getContentText());
  var val = arr[0] ? arr[0].value : {};
  props.setProperty('_wa_saldo_cache', JSON.stringify(val));
  props.setProperty('_wa_saldo_cache_at', String(Date.now()));
  return val;
}
```

Refactor `raosMonitoringEngine.js` line 70-87 + counterpart di `MonitoringSaldo.gs` (Pengisian Saldo) untuk pakai helper ini.

**Benefit:**
- 1 tempat edit (via SQL atau UI Rifim-OS module Sistem)
- Version history via `updated_at`
- Cache 1 jam di Script Property → minimal impact perf
- Kalau salah, rollback via SQL UPDATE

**Trade-off:**
- Extra network call ke Supabase (mitigasi: cache)
- Butuh refactor 2 GAS project + redeploy Web App manual
- Cache invalidation manual (kalau butuh urgent update)

### Bonus finding C: FONNTE_TOKEN + WA_GROUP_ID sudah bagus

Tidak di-hardcode di kode. Sudah pakai `PropertiesService.getScriptProperties()` di [waEngine.js:29-42](../automation/apps-script/waEngine.js). Ini pattern yang bagus dan konsisten untuk contoh migrasi WA group per cabang.

---

## Bonus Findings (di luar 3 kategori utama)

### 1. `SPREADSHEET_ID` hardcoded (acceptable)
Di [rifim-os/automation/apps-script/configLoader.js:8](../automation/apps-script/configLoader.js). Literal hardcoded, tapi terpusat di 1 file dan dipakai via helper `_getDB()`.

**Rating**: acceptable, tidak urgent. Ideally pindah ke Script Property untuk konsistensi dengan pattern GAS RAOS (yang pakai `PropertiesService`).

### 2. Migration `raos_070*` tidak ada di git
Sesi 2026-08-04 sore apply migration langsung ke DB (`raos_070a` sampai `raos_070d`), tapi file `.sql` **tidak commit** ke `raos-menala/sql/`. Folder cuma sampai `raos_069_user_profiles_source_expand.sql`.

**Debt**: buat 4 file SQL retrospektif untuk audit trail. Bisa di-pull via Supabase MCP `list_migrations` + regenerate.

### 3. `raos_kpi_targets_staff` = 0 rows
UI di Rifim-OS Finance sudah ada (tab Target Staff), tapi belum dipakai (override target per staff tidak pernah diisi). Mungkin fitur baru yang belum di-onboard user, atau memang tidak diperlukan.

**Rekomendasi**: klarifikasi dengan user apakah tabel ini masih dipakai. Kalau tidak, drop candidate.

### 4. Duplikasi label cabang di config
`_MON_WA_SALDO_GRUP` pakai key `'ID Rifim Airport Batam'` (string panjang). CLAUDE.md rifim-os sebut kode cabang harus UPPERCASE 3 huruf (`BTH`, `JBI`, dst). Tidak konsisten dengan RAOS yang pakai slug `'batam'`/`'jambi'`.

**Rekomendasi**: saat konsolidasi Discovery C, standarkan pakai `branch_id` UUID atau `slug` sebagai key JSONB. Bukan nama panjang.

---

## Execution Plan Sesi 2 & 3

### Sesi 2 (prioritas B): Migrate reader + writer V1→V2

1. **RPC baru** `get_kpi_staff_full(p_month date)` — join branch target + staff override + realisasi view + payroll
2. **Update PWA** `apps/pwa/src/app/kpi/page.tsx` — pakai RPC baru, drop `.from('kpi_targets')`
3. **Update GAS** `04_kpi.gs` + `15_kpi_engine.gs` — writer target ke V2, panggil RPC compute payroll post-write
4. **Deploy** — Vercel PWA auto-deploy, GAS clasp push + manual redeploy Web App
5. **Verify** — cek `/kpi` visual regression, cek GAS cron 22:00 tidak error, cek `raos_payroll` ter-update

### Sesi 3 (prioritas B+C): Rename V1 + konsolidasi WA group

**B (rename):**
1. Data migration `kpi_targets` → `raos_kpi_targets_branch` (kalau field mapping jelas) atau discard
2. `ALTER TABLE kpi_targets RENAME TO kpi_targets_deprecated_20260805;`
3. Update `sql/001_schema.sql` + `sql/002_rls.sql` reflect rename
4. Monitor `system_logs` 3 minggu, drop 2026-08-26

**C (konsolidasi WA group):**
1. Migration: INSERT 2 entri baru ke `system_config` (wa_saldo_group_per_branch + wa_potongan_group_per_branch)
2. Tambah helper `_getWaSaldoGroupPerBranch()` + `_getWaPotonganGroupPerBranch()` di `gasUtils.js`
3. Refactor `raosMonitoringEngine.js` line 70-87 pakai helper
4. Pull `MonitoringSaldo.gs` dari GAS project Pengisian Saldo (via `clasp pull` ke temp folder), refactor sama, push back
5. Test 1 cabang (mis. Batam) dulu — kirim WA test → verify masuk grup yang benar
6. Deploy semua cabang setelah verified

---

## Risk Register

| Item | Likelihood | Impact | Mitigation |
|---|---|---|---|
| PWA `/kpi` break saat V1 rename | Medium | High | Migrate reader dulu, verify sebelum rename |
| GAS cron 22:00 error saat V1 rename | Medium | Medium | Fix writer sebelum rename |
| WA notif nyasar saat migrate C | Low | High | Test 1 cabang dulu, rollout bertahap |
| Cache stale (WA group updated tidak propagate) | Low | Medium | Property cache TTL 1 jam + tombol "Refresh Config" di admin |
| Pengisian Saldo GAS project tidak accessible dari sesi Claude | High | Medium | User pull manual + paste ke Claude, atau clone repo dulu |

---

## Rollback Plan

**Kalau Sesi 2/3 break:**

1. Revert commit di branch `claude/rifim-raos-data-sync-x4k4r5` via `git revert HEAD`
2. Force-push
3. Kalau schema sudah berubah (rename V1):
   ```sql
   ALTER TABLE kpi_targets_deprecated_20260805 RENAME TO kpi_targets;
   ```
4. GAS Web App redeploy versi sebelumnya via GAS Editor → Kelola deployment → history
5. Kalau `system_config` sudah di-insert entri WA group tapi refactor GAS belum siap: entri tetap ada tapi GAS masih baca dari `_MON_WA_SALDO_GRUP` hardcoded lama — no impact, safe to keep

---

## Yang Perlu Kamu Approve Sebelum Sesi 2

Jawab 5 poin ini di sesi berikutnya:

1. **A** — Confirm **DO NOT DROP** `raos_saldo_requests.driver_name` (snapshot legit) ✅/❌
2. **B strategy** — Confirm **migrate PWA + GAS ke V2, rename V1 setelah 3 minggu** ✅/❌
3. **B data** — Migrasi 29 row `kpi_targets` V1 ke V2 (data preservation) vs discard V1 + start fresh V2? Pilihan: `migrate` / `discard`
4. **C strategy** — Confirm **konsolidasi WA group config ke `system_config` Supabase dengan cache 1 jam** ✅/❌
5. **Timeline** — Sesi 2 = migrate reader + writer, Sesi 3 = rename V1 + Discovery C. ✅/❌ atau ubah?

Kalau ada objek, sebutkan mana yang tidak setuju + alasannya. Kalau semua ✅, sesi berikutnya langsung eksekusi Sesi 2.

---

**Report generated by**: Claude Opus 4.7 (session `01HsT5obETqd5wxZMq7Dj5Vt`)
**Discovery method**: Supabase MCP + local grep + code inspection
**Zero DB changes made in this session** (Discovery only)

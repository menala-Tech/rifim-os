# Spreadsheet Column-Diff Audit — 2026-09-01

Read-only audit via Google Drive MCP (account `rifim`) against the two live spreadsheets used by Finance + Isi Saldo:

- **RIFIM OS DB** — `1jHeA-w1bM32S3-AU-ENN2UjiaCb4iLzRhaf4G7y4ozM`
- **RAOS DB** — `1eYS2mM3Sy-BNAVGfp8BUHtsZuLiGDetnJeGw-AWk__8`

No writes. No row content beyond header + 1-2 sample rows.

---

## Sheet mapping table

| Sheet (spreadsheet) | Read by | Expected columns (code) | Actual header (live) | Verdict |
|---|---|---|---|---|
| `Form Isi Saldo` (RAOS) | `raos-menala/gas/16_saldo_sync.gs` `SALDO_COLS_HEADERS` | 15 cols: No Request, Tanggal, Nama Staff, Cabang, Nominal, ID Login Driver, Nama Driver, Status Validasi, Sudah Diisi, Waktu Diisi, Diisi Oleh, Alasan Tolak, Alert Terkirim, Alert Terakhir, Request ID | ✅ exact 15 cols, same order | **OK** |
| `Saldo Driver` (RIFIM OS) | not directly read by any `_fin*` helper — populated by RAOS rekap sync | (implicit) Login ID, Nama Driver, Cabang, Total Nominal Bulan Ini, Jumlah Pengisian, Updated At | 6 cols, matches | **OK** |
| `Rekap Saldo Cabang` (RIFIM OS) | (implicit) rekap engine | Tanggal, Cabang, Total Nominal, Jumlah Pengisian, Target Harian, % Target, Status, Updated At | 8 cols, matches | **OK** |
| `Rekap Fee Harian` (RIFIM OS) | `_finRekapHarian_` via `_finRead_('Rekap Fee Harian')` | (implicit shape) Tanggal, Cabang, Jumlah Order, Total Fee Kantor, Total Hak Driver, Total Revenue, Updated At | 7 cols, matches | **OK** |
| `Form Input Saldo AIST` (RIFIM OS) | AIST worker + rekap | Tanggal, SUM, Credit Account, Login ID, Nominal Tagihan, Nama Driver, Cabang, STATUS | 8 cols | **OK** |
| `system_log` (RIFIM OS) | `_gasLog()` in `gasUtils.js` — `_SYS_LOG_HDR` = 6 cols | timestamp_utc, source, action, level, message, payload_json | 6 cols in header; row 3 (standard write) aligned correctly | **OK** (see finding #3 for the one-off row-2 misalignment) |
| **`LIA` (RIFIM OS)** | **`_finLedgerList_` @ crmApi.js:774 — `_finRead_('LIA')`** | tab must exist | **DOES NOT EXIST** in live spreadsheet | 🔴 **BROKEN** |
| **`Tagihan` (RIFIM OS)** | **`_finTagihanList_` @ crmApi.js:848 — `_finRead_('Tagihan')`** | tab must exist | **DOES NOT EXIST** in live spreadsheet | 🔴 **BROKEN** |

Live tab list (RIFIM OS): `documents, RAOS_SCAN_ORDER, TEST_LOGO, doc_approval_rules, doc_audit_mirror, doc_pending_approvals, CRM_AUDIT_LOG, CONFIG_FEE_KANTOR, Rekap Fee Harian, Rekap Fee Bulanan, DB Driver Kinerja, Saldo Driver, Rekap Saldo Cabang, system_log, employees, Database Driver External, Database Driver Airport, Input Driver External, Input Driver Airport, Input Staff, Database Staff, LAPORAN_CABANG, MONITORING_SALDO, MONITORING_POTONGAN, Form Input Saldo AIST, Database AIST, Input Potongan 1, Input Potongan 2, Database Potongan, activity_log, companies, numbering_sequences, company_config, document_types, PANDUAN ADMIN`

Live tab list (RAOS): `ABSENSI, Antrian Driver, LOG ACTIVITY, LOG SISTEM, MASTER TARGET, Form Isi Saldo, DASHBOARD STAFF, RAOS_KPI_MANUAL, SISTEM CONFIG, PANDUAN ADMIN`

---

## Findings

### 🔴 FINDING #1 — `_finLedgerList_` reads non-existent tab `'LIA'`

**File:** [automation/apps-script/crmApi.js:774](../automation/apps-script/crmApi.js:774)
```js
var data = _finRead_('LIA');
```
**Impact:** Every call to `finance_list` (Finance Dashboard main table) throws `Tab "LIA" tidak ada di Finance sheet`. `crmHandlePost` catches and returns `{success:false, code:'CRM_API_ERROR', message:'Tab "LIA" tidak ada'}` — this is JSON, not HTML, so it is a **DIFFERENT symptom** from the "GAS balas HTML" complaint but affects the same tab.

**Root cause:** Either (a) tab was cleared/renamed by `PRE_LAUNCH_CLEANUP` on 2026-08-30 (see finding #4), or (b) the tab was never created for this deploy. Live tab list shows nothing beginning with "L" that plausibly maps — closest candidate is `LAPORAN_CABANG` but its shape is unknown; `_finLedgerList_` expects `Timestamp, Email, Pemasukan, Pengeluaran, Cabang, Keterangan, Bukti Foto, Nama Staff`.

**Recommended fix:** Confirm intended sheet name with owner. Options: (a) create tab `LIA` and seed headers, (b) rename existing tab, (c) change code to point to the actual current tab (mis. `LAPORAN_CABANG` if that is the merge). Do not merge either — needs owner call.

### 🔴 FINDING #2 — `_finTagihanList_` reads non-existent tab `'Tagihan'`

**File:** [automation/apps-script/crmApi.js:848](../automation/apps-script/crmApi.js:848)
```js
var data = _finRead_('Tagihan');
```
**Impact:** Tab `Tagihan` in Finance Dashboard breaks the same way. Expected cols: `No Tagihan / No.Tagihan, Instansi, Tanggal Bayar / Tgl Bayar, Jumlah, Bulan, ...`. Live spreadsheet has NO tab called Tagihan.

**Recommended fix:** Same as #1 — confirm with owner then either create the tab, rename, or repoint the code.

### 🟡 FINDING #3 — `PRE_LAUNCH_CLEANUP` wrote system_log row with column skip

**Evidence:** `system_log` row 2 (2026-08-30 10:47:40) has 5 field values against 6-col header — the `level` column is blank/skipped. Row 3 (from `_gasLog()` in `gasUtils.js` via standard `doPost` error handler) is aligned correctly at 6 cols.

**Impact:** Low. Only affects one-off cleanup script's own log entry — downstream log filter (`_finLogList_` filter on `status ERROR|WARN|INFO`) will show that one row as `status=undefined`. Not a systemic misalignment.

**Recommended fix:** Whoever owns `PRE_LAUNCH_CLEANUP` script should route through `_gasLog(source, action, level, message, payload)` instead of ad-hoc `sh.appendRow([...])`. P2 cleanup.

### 🟡 FINDING #4 — Mass tab cleanup on 2026-08-30 emptied 21 tabs

**Evidence:** `system_log` row 2 payload lists 21 tabs cleared including every Finance dashboard data source: `Rekap Fee Harian` (1 row), `Rekap Fee Bulanan` (1), `Saldo Driver` (1), `Rekap Saldo Cabang` (1), `LAPORAN_CABANG` (6), `MONITORING_SALDO` (14), `MONITORING_POTONGAN` (11), `Form Input Saldo AIST` (1), `activity_log` (235), and more.

**Impact:** Finance Dashboard reads will succeed with valid JSON but return empty result sets until fresh data lands. This is NOT the source of the "GAS balas HTML" symptom (which is transport/config, not data-empty), but it does mean the dashboard will look mostly blank even after HTML issue is fixed. Expected if pre-launch was intentional; unexpected if not.

**Recommended fix:** Confirm with owner whether `PRE_LAUNCH_CLEANUP` was intentional. If yes, no code change needed — data just needs to flow again. If no, `LAPORAN_CABANG` (6 rows lost) + `MONITORING_SALDO` (14 rows) + `MONITORING_POTONGAN` (11 rows) + `activity_log` (235 rows) are the largest losses; check if backup exists.

### ⚪ FINDING #5 — Parse-error entry in system_log (informational)

**Evidence:** `system_log` row 3: `doPost / parse / ERROR / Expected property name or '}' in JSON at position 1 / {"raw":"{action:menala_environment}"}`

Someone POSTed a body with unquoted JSON keys (`{action:menala_environment}` instead of `{"action":"menala_environment"}`). Not our audit scope but worth logging: the parse error message + raw offending body are being captured correctly by the doPost error handler — good.

---

## What was verified vs not

| Item | Verified this pass? |
|---|---|
| RAOS `Form Isi Saldo` header order | ✅ |
| RIFIM finance sheet headers | ✅ (Rekap Fee Harian, Saldo Driver, Rekap Saldo Cabang, Form Input Saldo AIST, system_log) |
| RIFIM tab existence for `_finLedgerList_` / `_finTagihanList_` | ✅ — both **missing** |
| Duplicate `request_id` / `No Request` in `Form Isi Saldo` | ❌ (would need full-row read; single-row sample only) |
| Rows with `status=lunas` but `Waktu Diisi` blank | ❌ (would need full-row read) |
| Trigger functions (`saldoProcessAIST`, `saldoDailyRekap`, `feeGenerateRekap`) exist in deployed GAS | ❌ (needs GAS Editor access, not covered by Drive MCP) |
| Timezone/date parsing correctness | ❌ (needs specific row samples) |
| Formula/config mismatch | ❌ (would need cell-formula read) |

---

## Owner decisions needed before Phase 2 implementation

1. **Confirm intended source tab for Finance Dashboard main table** — is `LIA` a tab that got renamed, or was it never seeded? What should `_finLedgerList_` read from now?
2. **Confirm intended source tab for Tagihan** — same question, but for `_finTagihanList_`.
3. **Confirm `PRE_LAUNCH_CLEANUP` on 2026-08-30 was intentional** — otherwise trigger restore-from-backup path.
4. **Ownership of `PRE_LAUNCH_CLEANUP` script** — so its log-write path can be normalised through `_gasLog()`.

Once decided, produce Phase 2 patch:
- Point `_finLedgerList_` and `_finTagihanList_` at real live tab names (or create the tabs).
- Add a startup assertion in `_finRead_` that lists missing tabs from a known-required set at deploy time and pipes them to `system_log` at level=WARN, so this class of "tab missing" issue surfaces in the CI verify job (`finance_ping` follow-up).

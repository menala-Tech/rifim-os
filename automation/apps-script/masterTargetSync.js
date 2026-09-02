/**
 * MASTER TARGET → raos_kpi_targets_branch SYNC (2026-09-02)
 *
 * Owner decision (audit sinkronisasi 2026-09-02): sheet `MASTER TARGET` di
 * RAOS Master Spreadsheet (1eYS...) adalah SSoT untuk target KPI bulanan
 * per-cabang. Owner edit di sheet (Excel-like), Finance dashboard baca dari
 * Supabase table `raos_kpi_targets_branch`. Sebelum ini tidak ada sync --
 * dua sumber bisa drift, Finance render "Rp 0" saat sheet punya nilai.
 *
 * Sheet schema (RAOS 1eYS... tab "MASTER TARGET"):
 *   A: Cabang               (e.g. "ID Rifim Airport Batam" -- matches branches.slug)
 *   B: Target Order (Scan)  (e.g. "18.000 scan", "5.000 scan", or empty)
 *   C: Target Saldo (Rp)    (e.g. "Rp110.000.000", "Rp 40.000.000", or empty)
 *   D: Bulan Aktif          (e.g. "2026-09"; empty rows are skipped)
 *
 * Sync rules:
 *   - Row skipped if `Cabang` blank OR `Bulan Aktif` blank
 *   - Cabang lookup: branches.slug = Cabang (exact match, case-sensitive
 *     because slug is the canonical join key everywhere else)
 *   - Mode inference: if Target Order has value -> mode='order'
 *                     elif Target Saldo has value -> mode='saldo'
 *                     else skip (both empty means row is unset)
 *   - Value parsing:
 *       "18.000 scan"       -> 18000
 *       "Rp110.000.000"     -> 110000000
 *       "Rp 40.000.000"     -> 40000000
 *   - Bulan Aktif "2026-09" -> effective_month = "2026-09-01" (first-of-month
 *     canonical, matches _finKpiTargetBranchUpsert_ elsewhere)
 *   - Upsert on (branch_id, effective_month) -- one target row per month
 *
 * Trigger: install via `installMasterTargetSyncTrigger()` -- runs every 5 min
 * so admin edits propagate quickly. Wrapped in _gasWithLock so overlapping
 * runs coalesce. Logs summary to system_log for audit.
 *
 * Read-only from sheet side; only writes to Supabase.
 */

var _MT_SHEET_ID = '1eYS2mM3Sy-BNAVGfp8BUHtsZuLiGDetnJeGw-AWk__8';
var _MT_TAB_NAME = 'MASTER TARGET';

function syncMasterTargetToSupabase() {
  return _gasWithLock(function () {
    var runSummary = { scanned: 0, upserted: 0, skipped_blank: 0, skipped_unmapped: 0, errors: [] };

    // 1. Read sheet
    var ss = SpreadsheetApp.openById(_MT_SHEET_ID);
    var sh = ss.getSheetByName(_MT_TAB_NAME);
    if (!sh) throw new Error('Tab "' + _MT_TAB_NAME + '" not found in RAOS Master Spreadsheet');
    var last = sh.getLastRow();
    if (last < 2) return _mtDone_(runSummary, 'empty_sheet');
    var rows = sh.getRange(2, 1, last - 1, 4).getValues();
    runSummary.scanned = rows.length;

    // 2. Lookup branches once (name -> id, slug -> id)
    var branches = _crmSbFetch_('GET', '/rest/v1/branches?select=id,name,slug');
    if (!Array.isArray(branches)) throw new Error('branches lookup failed');
    var slugMap = {};
    branches.forEach(function (b) { if (b.slug) slugMap[b.slug] = b.id; });

    // 3. Build upsert payload rows
    var toUpsert = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var cabang = String(r[0] || '').trim();
      var rawOrder = String(r[1] || '').trim();
      var rawSaldo = String(r[2] || '').trim();
      var bulan = String(r[3] || '').trim();

      if (!cabang || !bulan) { runSummary.skipped_blank++; continue; }

      var branchId = slugMap[cabang];
      if (!branchId) { runSummary.skipped_unmapped++;
        runSummary.errors.push({ row: i + 2, cabang: cabang, reason: 'no_branch_match' });
        continue;
      }

      var mode, targetCabang;
      if (rawOrder) {
        mode = 'order';
        targetCabang = _mtParseNumber_(rawOrder);
      } else if (rawSaldo) {
        mode = 'saldo';
        targetCabang = _mtParseNumber_(rawSaldo);
      } else {
        runSummary.skipped_blank++; continue;
      }

      var monthISO = _mtNormalizeMonth_(bulan);
      if (!monthISO) {
        runSummary.errors.push({ row: i + 2, cabang: cabang, reason: 'bad_month_format', value: bulan });
        continue;
      }

      toUpsert.push({
        branch_id: branchId,
        effective_month: monthISO,
        target_cabang: targetCabang,
        target_staff_default: null,
        mode: mode,
      });
    }

    // 4. Upsert one-by-one (Supabase REST upsert requires unique constraint
    //    on (branch_id, effective_month) -- rely on Prefer: resolution=merge)
    for (var j = 0; j < toUpsert.length; j++) {
      try {
        _mtUpsertOne_(toUpsert[j]);
        runSummary.upserted++;
      } catch (e) {
        runSummary.errors.push({ row: 'upsert', payload: toUpsert[j], reason: String(e && e.message || e) });
      }
    }

    return _mtDone_(runSummary, 'ok');
  }, 10000);
}

function _mtDone_(summary, note) {
  try {
    _gasLog('masterTargetSync', 'run', 'INFO',
      note + ': scanned=' + summary.scanned + ' upserted=' + summary.upserted
      + ' skipped_blank=' + summary.skipped_blank + ' skipped_unmapped=' + summary.skipped_unmapped
      + ' errors=' + summary.errors.length,
      summary);
  } catch (_) { /* log best-effort */ }
  return Object.assign({ success: true, note: note }, summary);
}

// Parse "Rp110.000.000" | "Rp 40.000.000" | "18.000 scan" | "5000" -> integer.
// Strategy: strip Rp/scan/spaces/dots, coerce to int. Comma decimal not
// expected in these headers; treat comma same as dot just in case.
function _mtParseNumber_(raw) {
  var s = String(raw).replace(/rp|scan|\s|\./gi, '').replace(/,/g, '');
  var n = Number(s);
  return isFinite(n) ? n : 0;
}

// "2026-09" -> "2026-09-01". Accepts also "2026-09-01" pass-through.
// Returns null on garbage.
function _mtNormalizeMonth_(raw) {
  var s = String(raw).trim();
  var m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!m) return null;
  var mo = parseInt(m[2], 10);
  if (mo < 1 || mo > 12) return null;
  return m[1] + '-' + m[2] + '-01';
}

// One row upsert with Prefer: resolution=merge-duplicates on the unique
// composite index (branch_id, effective_month). Uses _crmSbFetch_-style
// service_role auth (no user JWT needed -- trigger context).
function _mtUpsertOne_(row) {
  var cfg = _getSupabaseConfig();
  var res = UrlFetchApp.fetch(cfg.url + '/rest/v1/raos_kpi_targets_branch?on_conflict=branch_id,effective_month', {
    method: 'POST',
    headers: {
      'apikey': cfg.key,
      'Authorization': 'Bearer ' + cfg.key,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    payload: JSON.stringify(row),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  if (code >= 400) throw new Error('upsert HTTP ' + code + ': ' + res.getContentText().substring(0, 200));
}

/**
 * Install the time-based trigger. Idempotent -- clears any existing trigger
 * for syncMasterTargetToSupabase before creating a new one, so re-running is
 * safe. Run once from the GAS Editor after deploy.
 */
function installMasterTargetSyncTrigger() {
  var existing = ScriptApp.getProjectTriggers();
  existing.forEach(function (t) {
    if (t.getHandlerFunction() === 'syncMasterTargetToSupabase') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncMasterTargetToSupabase')
    .timeBased()
    .everyMinutes(5)
    .create();
  return { success: true, message: 'syncMasterTargetToSupabase trigger installed (every 5 minutes)' };
}

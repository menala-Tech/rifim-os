/**
 * MASTER TARGET → raos_kpi_targets_branch SYNC (v2 2026-09-04)
 *
 * SSoT migration (owner decision 2026-09-04): pindah dari RAOS Master
 * spreadsheet (1eYS…, 4-kolom OLD schema) ke DATABASE STAFF spreadsheet
 * (1fcraq3…, 6-kolom NEW schema Target Cabang + Target Staff + Bonus Tier 1
 * + Bonus Tier 2 + Bulan Aktif). Soeta belum ada di sheet baru → fallback
 * baca dari RAOS Master hanya untuk row Soeta (target scan cabang saja, tanpa
 * tier bonus). Dua-pass sync dalam satu ScriptLock.
 *
 * PRIMARY sheet schema (DATABASE STAFF 1fcraq3, tab "MASTER TARGET"):
 *   A: Cabang         ("ID Rifim Airport Batam" — matches branches.slug)
 *   B: Target Cabang  ("Rp110.000.000" | "5000 order" | "18000 scan")
 *   C: Target Staff   ("Rp15.714.286"  | "300 order"  | "455 scan")
 *   D: Bonus Tier 1   ("Rp 1.500.000") — bonus per-staff kalau target_staff tercapai
 *   E: Bonus Tier 2   ("Rp 500.000")   — bonus tambahan kalau target_cabang tercapai
 *   F: Bulan Aktif    ("2026-09" | Date-typed cell)
 *
 * FALLBACK sheet schema (RAOS Master 1eYS, tab "MASTER TARGET" OLD 4-kolom):
 *   A: Cabang, B: Target Order (Scan), C: Target Saldo, D: Bulan Aktif
 *   Hanya row "ID Rifim Airport Soeta" yang di-sync dari sini (branches lain
 *   di-skip supaya tidak override nilai baru dari PRIMARY sheet).
 *
 * Sync rules:
 *   - PRIMARY: skip row kalau Cabang blank, Cabang='Admin', atau Bulan Aktif blank
 *   - PRIMARY: parse per-cell unit (Rp → saldo, "order" → order, "scan" → scan);
 *              mode_cabang = unit Target Cabang, mode_staff = unit Target Staff
 *   - FALLBACK: hanya row Soeta di-upsert; bonus_tier_1/2 = 0 (tidak ada kolom di sheet lama)
 *   - Upsert on (branch_id, effective_month) — Prefer resolution=merge-duplicates
 *   - Kolom `mode` legacy di-mirror dari mode_cabang untuk backcompat
 *
 * Trigger: `installMasterTargetSyncTrigger()` — every 5 min. Wrapped in
 * _gasWithLock. Logs summary ke system_log.
 *
 * Read-only dari sheet, hanya write ke Supabase.
 */

var _MT_PRIMARY_SHEET_ID  = '1fcraq3QHqIaD-13Ebzt6stT9aA6j_loTXeAtpNX12kw'; // DATABASE STAFF
var _MT_FALLBACK_SHEET_ID = '1eYS2mM3Sy-BNAVGfp8BUHtsZuLiGDetnJeGw-AWk__8'; // RAOS Master
var _MT_TAB_NAME          = 'MASTER TARGET';
var _MT_FALLBACK_ONLY_SLUGS = { 'ID Rifim Airport Soeta': true }; // whitelist row Soeta

function syncMasterTargetToSupabase() {
  return _gasWithLock(function () {
    var runSummary = {
      scanned_primary: 0, scanned_fallback: 0,
      upserted: 0, skipped_blank: 0, skipped_unmapped: 0,
      skipped_admin: 0, skipped_fallback_not_soeta: 0,
      errors: [],
    };

    // Lookup branches once (slug -> id)
    var branches = _crmSbFetch_('GET', '/rest/v1/branches?select=id,name,slug');
    if (!Array.isArray(branches)) throw new Error('branches lookup failed');
    var slugMap = {};
    branches.forEach(function (b) { if (b.slug) slugMap[b.slug] = b.id; });

    // Track cabang yang sudah dihandle PRIMARY supaya FALLBACK tidak override
    var handledSlugs = {};

    // ===== PASS 1: PRIMARY (DATABASE STAFF 1fcraq3 NEW schema) =====
    var ss1 = SpreadsheetApp.openById(_MT_PRIMARY_SHEET_ID);
    var sh1 = ss1.getSheetByName(_MT_TAB_NAME);
    if (!sh1) throw new Error('Tab "' + _MT_TAB_NAME + '" not found in PRIMARY sheet');
    var last1 = sh1.getLastRow();
    if (last1 >= 2) {
      var rows1 = sh1.getRange(2, 1, last1 - 1, 6).getValues();
      runSummary.scanned_primary = rows1.length;

      for (var i = 0; i < rows1.length; i++) {
        var r = rows1[i];
        var cabang = String(r[0] || '').trim();
        var rawCabang = String(r[1] || '').trim();
        var rawStaff  = String(r[2] || '').trim();
        var rawTier1  = String(r[3] || '').trim();
        var rawTier2  = String(r[4] || '').trim();
        var bulan     = r[5];

        if (!cabang) { runSummary.skipped_blank++; continue; }
        if (cabang.toLowerCase() === 'admin') { runSummary.skipped_admin++; continue; }
        if (bulan === '' || bulan == null) { runSummary.skipped_blank++; continue; }

        var branchId = slugMap[cabang];
        if (!branchId) {
          runSummary.skipped_unmapped++;
          runSummary.errors.push({ pass: 'primary', row: i + 2, cabang: cabang, reason: 'no_branch_match' });
          continue;
        }

        var monthISO = _mtNormalizeMonth_(bulan);
        if (!monthISO) {
          runSummary.errors.push({ pass: 'primary', row: i + 2, cabang: cabang, reason: 'bad_month_format', value: String(bulan) });
          continue;
        }

        var parsedCabang = _mtParseValueWithUnit_(rawCabang);
        var parsedStaff  = _mtParseValueWithUnit_(rawStaff);
        // Kalau Target Cabang blank tapi row lain terisi, tetap tulis (target=0)
        // supaya row ke-track — tapi kalau semuanya blank kecuali cabang+bulan, skip.
        if (!rawCabang && !rawStaff && !rawTier1 && !rawTier2) {
          runSummary.skipped_blank++; continue;
        }

        var payload = {
          branch_id: branchId,
          effective_month: monthISO,
          target_cabang: parsedCabang.value,
          target_staff: rawStaff ? parsedStaff.value : null,
          bonus_tier_1: _mtParseRupiah_(rawTier1),
          bonus_tier_2: _mtParseRupiah_(rawTier2),
          mode_cabang: parsedCabang.mode || 'saldo',
          mode_staff: rawStaff ? (parsedStaff.mode || 'saldo') : null,
          mode: parsedCabang.mode || 'saldo', // legacy mirror
          target_staff_default: rawStaff ? parsedStaff.value : null, // legacy mirror
        };

        try {
          _mtUpsertOne_(payload);
          runSummary.upserted++;
          handledSlugs[cabang] = true;
        } catch (e) {
          runSummary.errors.push({ pass: 'primary', row: 'upsert', payload: payload, reason: String(e && e.message || e) });
        }
      }
    }

    // ===== PASS 2: FALLBACK (RAOS Master 1eYS OLD schema, hanya Soeta) =====
    var ss2 = SpreadsheetApp.openById(_MT_FALLBACK_SHEET_ID);
    var sh2 = ss2.getSheetByName(_MT_TAB_NAME);
    if (sh2) {
      var last2 = sh2.getLastRow();
      if (last2 >= 2) {
        var rows2 = sh2.getRange(2, 1, last2 - 1, 4).getValues();
        runSummary.scanned_fallback = rows2.length;

        for (var k = 0; k < rows2.length; k++) {
          var r2 = rows2[k];
          var cabang2 = String(r2[0] || '').trim();
          var rawOrder = String(r2[1] || '').trim();
          var rawSaldo = String(r2[2] || '').trim();
          var bulan2 = r2[3];

          if (!cabang2 || bulan2 === '' || bulan2 == null) { runSummary.skipped_blank++; continue; }
          // FALLBACK whitelist: hanya row Soeta yang di-sync
          if (!_MT_FALLBACK_ONLY_SLUGS[cabang2]) { runSummary.skipped_fallback_not_soeta++; continue; }
          // Kalau PRIMARY sudah handle Soeta (owner tambah row Soeta di 1fcraq3 nanti), skip fallback
          if (handledSlugs[cabang2]) { runSummary.skipped_fallback_not_soeta++; continue; }

          var branchId2 = slugMap[cabang2];
          if (!branchId2) {
            runSummary.skipped_unmapped++;
            runSummary.errors.push({ pass: 'fallback', row: k + 2, cabang: cabang2, reason: 'no_branch_match' });
            continue;
          }

          var monthISO2 = _mtNormalizeMonth_(bulan2);
          if (!monthISO2) {
            runSummary.errors.push({ pass: 'fallback', row: k + 2, cabang: cabang2, reason: 'bad_month_format', value: String(bulan2) });
            continue;
          }

          var modeFb, valueFb;
          if (rawOrder) { modeFb = 'order'; valueFb = _mtParseNumber_(rawOrder); }
          else if (rawSaldo) { modeFb = 'saldo'; valueFb = _mtParseNumber_(rawSaldo); }
          else { runSummary.skipped_blank++; continue; }

          var payloadFb = {
            branch_id: branchId2,
            effective_month: monthISO2,
            target_cabang: valueFb,
            target_staff: null,
            bonus_tier_1: 0,
            bonus_tier_2: 0,
            mode_cabang: modeFb,
            mode_staff: null,
            mode: modeFb,
            target_staff_default: null,
          };

          try {
            _mtUpsertOne_(payloadFb);
            runSummary.upserted++;
          } catch (e) {
            runSummary.errors.push({ pass: 'fallback', row: 'upsert', payload: payloadFb, reason: String(e && e.message || e) });
          }
        }
      }
    }

    return _mtDone_(runSummary, 'ok');
  }, 10000);
}

function _mtDone_(summary, note) {
  try {
    _gasLog('masterTargetSync', 'run', 'INFO',
      note + ': primary=' + summary.scanned_primary + ' fallback=' + summary.scanned_fallback
      + ' upserted=' + summary.upserted + ' blank=' + summary.skipped_blank
      + ' unmapped=' + summary.skipped_unmapped + ' admin=' + summary.skipped_admin
      + ' fb_skipped=' + summary.skipped_fallback_not_soeta + ' errors=' + summary.errors.length,
      summary);
  } catch (_) { /* log best-effort */ }
  return Object.assign({ success: true, note: note }, summary);
}

// Parse "Rp110.000.000" | "Rp 40.000.000" | "18.000 scan" | "5000" | Number -> integer.
// BUG FIX 2026-09-04: sheet cell yang isinya formula (mis. Batam C3 =
// B3/7 = 110000000/7 = 15714285.714285714) di-return getValues() sebagai
// Number, bukan string. String(number) menghasilkan "15714285.714285714"
// yang kalau di-strip semua dot jadi "15714285714285714" (15Q, digit
// shift oleh decimal). Fix: detect typeof number FIRST → Math.round
// langsung; string parsing hanya untuk display literal "Rp10.000.000".
function _mtParseNumber_(raw) {
  if (typeof raw === 'number' && isFinite(raw)) return Math.round(raw);
  var s = String(raw || '').replace(/rp|scan|order|\s/gi, '').trim();
  if (!s) return 0;
  // Format Indonesia: dot = thousand sep, comma = decimal.
  // Strip dot (thousand), lalu treat comma sebagai decimal separator.
  s = s.replace(/\./g, '').replace(/,/g, '.');
  var n = Number(s);
  return isFinite(n) ? Math.round(n) : 0;
}

// Parse a cell value and infer unit mode. Returns { value: int, mode: 'saldo'|'order'|'scan'|null }.
// "Rp110.000.000" -> {110000000, 'saldo'}, "5000 order" -> {5000, 'order'},
// "455 scan" -> {455, 'scan'}, "" -> {0, null}.
function _mtParseValueWithUnit_(raw) {
  var s = String(raw || '').trim();
  if (!s) return { value: 0, mode: null };
  var mode = null;
  if (/rp/i.test(s)) mode = 'saldo';
  else if (/scan/i.test(s)) mode = 'scan';
  else if (/order/i.test(s)) mode = 'order';
  else mode = 'saldo'; // default: numeric tanpa unit dianggap Rp
  return { value: _mtParseNumber_(s), mode: mode };
}

// Parse Rupiah only ("Rp 1.500.000" -> 1500000). Kolom bonus_tier_* selalu Rp.
function _mtParseRupiah_(raw) {
  return _mtParseNumber_(raw);
}

// "2026-09" -> "2026-09-01". Accepts pass-through "2026-09-01" plus Date objects.
// (GAS auto-parses "2026-09" cells into Date when cell format is Date; getMonth
// resolves in Jakarta wall-clock karena appsscript.json timeZone=Asia/Jakarta.)
function _mtNormalizeMonth_(raw) {
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    var yy = raw.getFullYear();
    var mm = raw.getMonth() + 1;
    return yy + '-' + String(mm).padStart(2, '0') + '-01';
  }
  var s = String(raw).trim();
  var m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!m) return null;
  var mo = parseInt(m[2], 10);
  if (mo < 1 || mo > 12) return null;
  return m[1] + '-' + m[2] + '-01';
}

// Upsert satu row dengan Prefer resolution=merge-duplicates pada unique index
// (branch_id, effective_month). Service-role auth via _getSupabaseConfig.
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
 * Install trigger every 5 min. Idempotent — clears existing sebelum create.
 * Run once dari GAS Editor setelah deploy.
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

/**
 * preLaunchCleanup.js — Pre-Launch Cleanup Rifim-OS + create RAOS_SCAN_ORDER tab
 *
 * Launch date: 1 Sep 2026.
 *
 * SAFETY:
 *   - Full-file backup Drive: "RIFIM OS Spreadsheet — FULL BACKUP 20260829
 *     pre-launch" (id 1pZCQ57tU99Xa-zDfVeZbFk9Pg0B5bldnRT47APeVxY0).
 *   - Idempotent. Header row 1 dipertahankan.
 *   - Konfirmasi UI sebelum eksekusi.
 *
 * TABS YANG DI-CLEAR (21):
 *   documents, doc_approval_rules, doc_audit_mirror, doc_pending_approvals,
 *   CRM_AUDIT_LOG, Rekap Fee Harian, Rekap Fee Bulanan, DB Driver Kinerja,
 *   Saldo Driver, Rekap Saldo Cabang, system_log, Input Driver External,
 *   Input Driver Airport, Input Staff, LAPORAN_CABANG, MONITORING_SALDO,
 *   MONITORING_POTONGAN, Form Input Saldo AIST, Input Potongan 1,
 *   Input Potongan 2, activity_log.
 *
 * TABS YANG DIPERTAHANKAN (12):
 *   employees, Database Driver External, Database Driver Airport, Database Staff,
 *   Database AIST, Database Potongan, CONFIG_FEE_KANTOR, companies,
 *   numbering_sequences, company_config, document_types, PANDUAN ADMIN.
 *
 * TAB BARU (1):
 *   RAOS_SCAN_ORDER — 12 kolom, sync 7-hari rolling dari Supabase scan_orders
 *   (lihat raosScanOrderSync.js untuk sync function).
 */

var PRELAUNCH_CLEAR_TABS_RIFIM = [
  'documents',
  'doc_approval_rules',
  'doc_audit_mirror',
  'doc_pending_approvals',
  'CRM_AUDIT_LOG',
  'Rekap Fee Harian',
  'Rekap Fee Bulanan',
  'DB Driver Kinerja',
  'Saldo Driver',
  'Rekap Saldo Cabang',
  'system_log',
  'Input Driver External',
  'Input Driver Airport',
  'Input Staff',
  'LAPORAN_CABANG',
  'MONITORING_SALDO',
  'MONITORING_POTONGAN',
  'Form Input Saldo AIST',
  'Input Potongan 1',
  'Input Potongan 2',
  'activity_log',
];

var PRELAUNCH_KEEP_TABS_RIFIM = [
  'employees',
  'Database Driver External',
  'Database Driver Airport',
  'Database Staff',
  'Database AIST',
  'Database Potongan',
  'CONFIG_FEE_KANTOR',
  'companies',
  'numbering_sequences',
  'company_config',
  'document_types',
  'PANDUAN ADMIN',
];

var RAOS_SCAN_ORDER_TAB = 'RAOS_SCAN_ORDER';
var RAOS_SCAN_ORDER_HEADER = [
  'Scan ID',        // scan_orders.scan_id
  'Scanned At',     // scan_orders.scanned_at (WIB)
  'Staff',          // employees.name (via staff_id join)
  'Driver ID',      // scan_orders.driver_id
  'Driver Nama',    // drivers.name (via driver_id join)
  'Pickup Point',   // pickup_points.name (T1/T2/T3)
  'Status',         // valid / pending / rejected
  'Koordinator',    // employees.name (via koordinator_id join)
  'Validated At',   // scan_orders.validated_at
  'Admin Checked',  // TRUE/FALSE
  'GMV',            // scan_orders.gmv
  'Incentive',      // scan_orders.incentive
];

function preLaunchCleanupRIFIM_MENU() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert(
    '🚀 Pre-Launch Cleanup Rifim-OS',
    'Akan clear data (row 2 dst) di ' + PRELAUNCH_CLEAR_TABS_RIFIM.length +
      ' tab.\n\nHeader (row 1) DIPERTAHANKAN.\n' +
      'Tab yang TIDAK disentuh (12): ' + PRELAUNCH_KEEP_TABS_RIFIM.join(', ') +
      '.\n\nJuga akan buat tab baru "' + RAOS_SCAN_ORDER_TAB + '" jika belum ada.\n\n' +
      'Full backup: "RIFIM OS Spreadsheet — FULL BACKUP 20260829 pre-launch".\n\n' +
      'Lanjutkan?',
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) {
    ui.alert('Dibatalkan.');
    return;
  }
  var report = preLaunchCleanupRIFIM_();
  var createReport = ensureRaosScanOrderTab_();
  ui.alert(
    '✅ Selesai',
    'Clear:\n' + report.map(function (r) { return '  ' + r.tab + ': ' + r.rowsCleared + ' rows' + (r.error ? ' [' + r.error + ']' : '') }).join('\n') +
      '\n\n' + createReport,
    ui.ButtonSet.OK
  );
}

function preLaunchCleanupRIFIM_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var results = [];
  PRELAUNCH_CLEAR_TABS_RIFIM.forEach(function (tabName) {
    try {
      var sh = ss.getSheetByName(tabName);
      if (!sh) {
        results.push({ tab: tabName, rowsCleared: 0, error: 'sheet not found' });
        return;
      }
      var lastRow = sh.getLastRow();
      var lastCol = Math.max(sh.getLastColumn(), 1);
      if (lastRow <= 1) {
        results.push({ tab: tabName, rowsCleared: 0 });
        return;
      }
      sh.getRange(2, 1, lastRow - 1, lastCol).clearContent();
      results.push({ tab: tabName, rowsCleared: lastRow - 1 });
      Utilities.sleep(200);
    } catch (err) {
      results.push({ tab: tabName, rowsCleared: 0, error: String(err) });
    }
  });
  try {
    var logSh = ss.getSheetByName('system_log');
    if (logSh) {
      logSh.appendRow([
        new Date(), 'PRE_LAUNCH_CLEANUP', 'RIFIM_OS',
        'Cleared ' + results.length + ' tabs', JSON.stringify(results),
      ]);
    }
  } catch (_) {}
  return results;
}

/**
 * Buat tab RAOS_SCAN_ORDER kalau belum ada, dengan header + freeze row 1.
 * Idempotent — kalau sudah ada, cek header dan reset kalau berbeda.
 */
function ensureRaosScanOrderTab_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(RAOS_SCAN_ORDER_TAB);
  if (!sh) {
    sh = ss.insertSheet(RAOS_SCAN_ORDER_TAB);
  }
  var currentHeader = sh.getRange(1, 1, 1, RAOS_SCAN_ORDER_HEADER.length).getValues()[0];
  var headerMatches = currentHeader.every(function (v, i) { return v === RAOS_SCAN_ORDER_HEADER[i] });
  if (!headerMatches) {
    sh.getRange(1, 1, 1, RAOS_SCAN_ORDER_HEADER.length).setValues([RAOS_SCAN_ORDER_HEADER]);
    sh.getRange(1, 1, 1, RAOS_SCAN_ORDER_HEADER.length)
      .setBackground('#46BDC6')  // teal — system-generated (align dg setupRaosSheets)
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return 'Tab "' + RAOS_SCAN_ORDER_TAB + '" siap. Sync: menu → jalankan syncRaosScanOrders() atau setup trigger 15 menit.';
}

/**
 * raosScanOrderSync.js — Sync scan orders RAOS Soeta ke Rifim-OS spreadsheet
 *
 * TUJUAN:
 *   Admin/koord Isi Saldo di modul Isi Saldo Rifim-OS bisa lihat scan order
 *   Soeta (yang jadi basis GMV) langsung di spreadsheet, tanpa buka PWA RAOS.
 *
 * SUMBER DATA:
 *   Supabase public.scan_orders (WAJIB akses via SERVICE_KEY karena RLS ketat).
 *
 * WINDOW:
 *   Rolling 7 hari terakhir (hari ini + 6 hari mundur). Konfigurable via
 *   Script Property `RAOS_SCAN_SYNC_DAYS` (default 7).
 *
 * TAB TARGET:
 *   RAOS_SCAN_ORDER (dibuat oleh preLaunchCleanup.js — ensureRaosScanOrderTab_)
 *
 * TRIGGER:
 *   Cron 15 menit — setupRaosScanOrderTrigger()
 *
 * MENU ITEM (raosMenuEngine.js perlu ditambah):
 *   ui.createMenu('📊 Isi Saldo')
 *     .addItem('🔄 Sync RAOS Scan Order (7-hari rolling)', 'syncRaosScanOrders_MENU')
 *     .addItem('⏰ Setup Trigger Sync RAOS Scan (15 menit)', 'setupRaosScanOrderTrigger')
 */

var RAOS_SCAN_TAB = 'RAOS_SCAN_ORDER';
var RAOS_SCAN_DEFAULT_DAYS = 7;

function syncRaosScanOrders_MENU() {
  var ui = SpreadsheetApp.getUi();
  try {
    var res = syncRaosScanOrders();
    ui.alert('✅ Sync RAOS Scan Order',
      'Rows: ' + res.rows + '\nWindow: ' + res.days + ' hari\n' +
      'From: ' + res.since + '\nDurasi: ' + res.durationMs + 'ms',
      ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('❌ Error', String(e), ui.ButtonSet.OK);
  }
}

function syncRaosScanOrders() {
  var start = Date.now();
  var props = PropertiesService.getScriptProperties();
  var days = Number(props.getProperty('RAOS_SCAN_SYNC_DAYS') || RAOS_SCAN_DEFAULT_DAYS);
  var sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
  var sinceIso = new Date(sinceMs).toISOString();

  // PostgREST embed 4 relasi: staff (user_profiles), driver (drivers),
  // pickup (pickup_points), koord (user_profiles). Assumes FK constraints
  // exist di Supabase — kalau embed gagal, fallback ke query terpisah (TODO).
  var select = [
    'scan_id', 'scanned_at', 'driver_id', 'status', 'validated_at',
    'admin_checked', 'gmv', 'incentive',
    'staff:user_profiles!staff_id(full_name)',
    'driver:raos_drivers!driver_id(name)',
    'pickup:pickup_points!pickup_point_id(name)',
    'koord:user_profiles!koordinator_id(full_name)',
  ].join(',');

  var url = _sbUrl('scan_orders', [
    'scanned_at=gte.' + encodeURIComponent(sinceIso),
    'select=' + encodeURIComponent(select),
    'order=scanned_at.desc',
    'limit=5000',
  ]);
  var rows = _sbGet(url) || [];

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(RAOS_SCAN_TAB);
  if (!sh) {
    // safety: buat tab kalau belum ada (pinjam header dari preLaunchCleanup.js)
    if (typeof ensureRaosScanOrderTab_ === 'function') {
      ensureRaosScanOrderTab_();
      sh = ss.getSheetByName(RAOS_SCAN_TAB);
    } else {
      throw new Error('Tab ' + RAOS_SCAN_TAB + ' belum ada. Jalankan preLaunchCleanupRIFIM_MENU dulu.');
    }
  }

  // Clear data lama (rolling window = full replace)
  var lastRow = sh.getLastRow();
  if (lastRow > 1) {
    sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).clearContent();
  }

  if (rows.length === 0) {
    return { rows: 0, days: days, since: sinceIso, durationMs: Date.now() - start };
  }

  var tz = 'Asia/Jakarta';
  var values = rows.map(function (r) {
    return [
      r.scan_id || '',
      r.scanned_at ? Utilities.formatDate(new Date(r.scanned_at), tz, 'yyyy-MM-dd HH:mm:ss') : '',
      r.staff ? r.staff.full_name : '',
      r.driver_id || '',
      r.driver ? r.driver.name : '',
      r.pickup ? r.pickup.name : '',
      r.status || '',
      r.koord ? r.koord.full_name : '',
      r.validated_at ? Utilities.formatDate(new Date(r.validated_at), tz, 'yyyy-MM-dd HH:mm:ss') : '',
      r.admin_checked === true ? 'TRUE' : (r.admin_checked === false ? 'FALSE' : ''),
      Number(r.gmv) || 0,
      Number(r.incentive) || 0,
    ];
  });
  sh.getRange(2, 1, values.length, values[0].length).setValues(values);
  // Format kolom nominal
  sh.getRange(2, 11, values.length, 2).setNumberFormat('"Rp"#,##0');

  return { rows: values.length, days: days, since: sinceIso, durationMs: Date.now() - start };
}

/**
 * Pasang cron trigger tiap 15 menit. Idempotent — hapus trigger lama dulu.
 */
function setupRaosScanOrderTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (t) {
    if (t.getHandlerFunction() === 'syncRaosScanOrders') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncRaosScanOrders').timeBased().everyMinutes(15).create();
  try {
    SpreadsheetApp.getUi().alert('✅ Trigger dipasang',
      'syncRaosScanOrders jalan tiap 15 menit.', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (_) {}
}

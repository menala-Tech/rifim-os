/**
 * RIFIM OS — RAOS Driver Layer
 *
 * Alur data:
 *   Input Driver Sheet → (tombol) → Supabase drivers → syncDriversDariSupabase()
 *                                                     → Database Driver Airport
 *                                                     → Database Driver External
 *
 * Setup awal (sekali dari GAS Editor):
 *   1. setupDriverSheets()         — buat sheet Input Driver Airport + External
 *   2. setupDriverSyncTrigger()    — auto-sync tiap 6 jam
 */

// ── Konstanta Sheet ───────────────────────────────────────────────────────
var _DRV_AIRPORT_SHEET  = 'Database Driver Airport';
var _DRV_EXTERNAL_SHEET = 'Database Driver External';
var _DRV_INPUT_AIRPORT  = 'Input Driver Airport';
var _DRV_INPUT_EXTERNAL = 'Input Driver External';
var _DRV_DATA_START_ROW = 3;

// Spreadsheet ID terpisah untuk Database Driver (bukan sheet di dalam RAOS_SS_ID)
// Airport : https://docs.google.com/spreadsheets/d/1FEZxyHPx_GCQKw92hLSf6QxxkXgZn5R1sRswOYM_Tlc
// External: https://docs.google.com/spreadsheets/d/1suoDC-RsWOgTHiLq4max6iIsWe39Ou-RMddRXl5DVJc
var _DRV_AIRPORT_SS_ID  = '1FEZxyHPx_GCQKw92hLSf6QxxkXgZn5R1sRswOYM_Tlc';
var _DRV_EXTERNAL_SS_ID = '1suoDC-RsWOgTHiLq4max6iIsWe39Ou-RMddRXl5DVJc';

// Kolom Database Driver (1-based) — A=No, B=Login ID, C=Nama, D=ID Cabang
var _DRV_COL = {
  NO        : 1, // A
  LOGIN_ID  : 2, // B — id_maxim di Supabase
  NAMA      : 3, // C — nama_driver
  ID_CABANG : 4, // D — cabang
  ZONE      : 5, // E — zone (airport/external)
  TIPE      : 6, // F — driver_type (konvensional/online)
  STATUS    : 7, // G — aktif/nonaktif
};

// Kolom Input Driver (form input admin)
var _DRV_INPUT_COL = {
  LOGIN_ID  : 1, // A — wajib
  NAMA      : 2, // B — wajib
  ID_CABANG : 3, // C — dropdown
  ZONE      : 4, // D — airport/external
  TIPE      : 5, // E — konvensional/online
  STATUS    : 6, // F — AKTIF/NONAKTIF
  AKSI      : 7, // G — hasil: OK / ERROR / sudah ada
};

// ══════════════════════════════════════════════════════════════════════════════
// 1. SUPABASE — CRUD Driver
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Ambil semua driver dari Supabase.
 * @param {{ zone?, cabang?, status?, limit? }} opts
 */
function raosGetDrivers(opts) {
  opts = opts || {};
  var params = ['order=nama_driver.asc', 'limit=' + (opts.limit || 2000)];
  if (opts.zone)   params.push('zone=eq.'   + encodeURIComponent(opts.zone));
  if (opts.cabang) params.push('cabang=eq.' + encodeURIComponent(opts.cabang));
  if (opts.status) params.push('status=eq.' + encodeURIComponent(opts.status));
  return _sbGet(_sbUrl('drivers', params));
}

/**
 * Tambah driver baru ke Supabase.
 * @param {{ id_maxim, nama_driver, cabang, zone, driver_type, status? }} data
 * @returns {{ ok, error? }}
 */
function raosAddDriver(data) {
  if (!data.id_maxim || !data.nama_driver || !data.cabang) {
    return { ok: false, error: 'Login ID, Nama, dan Cabang wajib diisi.' };
  }
  data.status = data.status || 'AKTIF';
  try {
    _sbPost('drivers', data);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Update driver di Supabase berdasarkan id_maxim.
 * @param {string} loginId
 * @param {object} updates
 */
function raosUpdateDriver(loginId, updates) {
  try {
    _sbPatch('drivers', 'id_maxim=eq.' + encodeURIComponent(loginId), updates);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. SYNC — Supabase → Google Sheets
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Sinkronisasi seluruh driver dari Supabase ke 2 sheet:
 *   - Database Driver Airport  (zone = 'airport')
 *   - Database Driver External (zone = 'external')
 *
 * Dipanggil manual via menu atau otomatis tiap 6 jam.
 */
function syncDriversDariSupabase() {
  var allDrivers = raosGetDrivers({ limit: 3000 });
  if (!allDrivers) {
    SpreadsheetApp.getUi().alert('❌ Gagal ambil data driver dari Supabase.');
    return;
  }

  var airport  = allDrivers.filter(function(d) { return (d.zone || '').toLowerCase() === 'airport'; });
  var external = allDrivers.filter(function(d) { return (d.zone || '').toLowerCase() !== 'airport'; });

  _tulisDriverKeSheet(_DRV_AIRPORT_SHEET,  airport);
  _tulisDriverKeSheet(_DRV_EXTERNAL_SHEET, external);

  var msg = '✅ Sync Driver selesai!\n\n' +
            '🛫 Airport  : ' + airport.length  + ' driver\n' +
            '🚗 External : ' + external.length + ' driver\n' +
            'Total       : ' + allDrivers.length + ' driver';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch(e) {}
}

/**
 * Tulis data driver ke spreadsheet Database Driver (file terpisah).
 * Airport  → _DRV_AIRPORT_SS_ID  (spreadsheet sendiri)
 * External → _DRV_EXTERNAL_SS_ID (spreadsheet sendiri)
 * @private
 */
function _tulisDriverKeSheet(sheetName, drivers) {
  var ssId  = (sheetName === _DRV_AIRPORT_SHEET) ? _DRV_AIRPORT_SS_ID : _DRV_EXTERNAL_SS_ID;
  var ss    = SpreadsheetApp.openById(ssId);
  // Coba cari sheet dengan nama yang sama; fallback ke sheet pertama
  var sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];
  if (!sheet) {
    Logger.log('⚠️ Sheet tidak ditemukan di spreadsheet: ' + sheetName);
    return;
  }

  // Hapus data lama (baris 3 dst)
  var lastRow = sheet.getLastRow();
  if (lastRow >= _DRV_DATA_START_ROW) {
    sheet.getRange(_DRV_DATA_START_ROW, 1,
                   lastRow - _DRV_DATA_START_ROW + 1, 7).clearContent();
  }

  if (!drivers || drivers.length === 0) return;

  var rows = drivers.map(function(d, i) {
    return [
      i + 1,
      d.id_maxim    || '',
      d.nama_driver || '',
      d.cabang      || '',
      d.zone        || '',
      d.driver_type || '',
      d.status      || 'AKTIF',
    ];
  });

  sheet.getRange(_DRV_DATA_START_ROW, 1, rows.length, 7).setValues(rows);
  Logger.log('✅ ' + sheetName + ': ' + rows.length + ' driver ditulis.');
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. INPUT — Proses sheet Input Driver → Supabase → Sync
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Proses sheet "Input Driver Airport" atau "Input Driver External":
 * baca baris data, tambah ke Supabase, catat hasil di kolom G.
 * Setelah selesai, otomatis sync ke Database Driver.
 *
 * @param {string} inputSheetName - 'Input Driver Airport' | 'Input Driver External'
 */
function prosesInputDriver(inputSheetName) {
  var ss    = SpreadsheetApp.openById(RAOS_SS_ID);
  var sheet = ss.getSheetByName(inputSheetName);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Sheet "' + inputSheetName + '" tidak ditemukan.');
    return;
  }

  var zone     = (inputSheetName.indexOf('Airport') !== -1) ? 'airport' : 'external';
  var lastRow  = sheet.getLastRow();
  var sukses   = 0, skip = 0, gagal = 0;

  for (var r = _DRV_DATA_START_ROW; r <= lastRow; r++) {
    var loginId = sheet.getRange(r, _DRV_INPUT_COL.LOGIN_ID).getValue().toString().trim();
    if (!loginId) continue;

    var aksiSel = sheet.getRange(r, _DRV_INPUT_COL.AKSI);
    var aksiVal = aksiSel.getValue().toString().trim().toUpperCase();
    if (aksiVal === 'OK') { skip++; continue; } // sudah diproses

    var nama     = sheet.getRange(r, _DRV_INPUT_COL.NAMA).getValue().toString().trim();
    var cabang   = sheet.getRange(r, _DRV_INPUT_COL.ID_CABANG).getValue().toString().trim();
    var tipe     = sheet.getRange(r, _DRV_INPUT_COL.TIPE).getValue().toString().trim() || 'konvensional';
    var statusDrv = sheet.getRange(r, _DRV_INPUT_COL.STATUS).getValue().toString().trim() || 'AKTIF';

    var result = raosAddDriver({
      id_maxim    : loginId,
      nama_driver : nama,
      cabang      : cabang,
      zone        : zone,
      driver_type : tipe,
      status      : statusDrv,
    });

    if (result.ok) {
      aksiSel.setValue('OK').setBackground('#D9EAD3');
      sukses++;
    } else {
      aksiSel.setValue('ERROR: ' + result.error).setBackground('#FCE5CD');
      gagal++;
    }
  }

  // Auto-sync ke Database Driver setelah input
  if (sukses > 0) syncDriversDariSupabase();

  SpreadsheetApp.getUi().alert(
    '✅ Proses Input Driver selesai!\n\n' +
    'Berhasil : ' + sukses + '\n' +
    'Dilewati : ' + skip   + ' (sudah OK)\n' +
    'Gagal    : ' + gagal
  );
}

function prosesInputDriverAirport()  { prosesInputDriver(_DRV_INPUT_AIRPORT); }
function prosesInputDriverExternal() { prosesInputDriver(_DRV_INPUT_EXTERNAL); }

// ══════════════════════════════════════════════════════════════════════════════
// 4. SETUP — Buat sheet Input Driver
// ══════════════════════════════════════════════════════════════════════════════

function setupDriverSheets() {
  _setupInputDriverSheet(_DRV_INPUT_AIRPORT,  'airport');
  _setupInputDriverSheet(_DRV_INPUT_EXTERNAL, 'external');
  SpreadsheetApp.getUi().alert('✅ Sheet Input Driver Airport + External siap!');
}

/**
 * Setup header di spreadsheet Database Driver Airport & External (file terpisah).
 * Jalankan SEKALI jika spreadsheet belum punya header standar.
 * Data yang sudah ada (baris 3+) TIDAK dihapus.
 */
function setupDatabaseDriverSheets() {
  var headers = ['No', 'Login ID (ID Maxim)', 'Nama Driver', 'ID Cabang', 'Zone', 'Tipe Driver', 'Status'];

  [[_DRV_AIRPORT_SS_ID, _DRV_AIRPORT_SHEET], [_DRV_EXTERNAL_SS_ID, _DRV_EXTERNAL_SHEET]]
    .forEach(function(item) {
      var ssId = item[0], label = item[1];
      var ss    = SpreadsheetApp.openById(ssId);
      var sheet = ss.getSheetByName(label) || ss.getSheets()[0];
      // Baris 1: header (hanya jika belum ada / kosong)
      var existing = sheet.getRange(1, 1).getValue().toString().trim();
      if (!existing) {
        sheet.getRange(1, 1, 1, headers.length)
          .setValues([headers])
          .setBackground('#1155CC').setFontColor('#FFFFFF')
          .setFontWeight('bold').setHorizontalAlignment('center');
        sheet.getRange('A2').setValue(
          'SSoT driver — sync dari Supabase drivers. Jangan edit manual.'
        ).setFontStyle('italic').setFontColor('#666666');
        sheet.getRange(2, 1, 1, headers.length).merge();
        sheet.setFrozenRows(2);
        Logger.log('✅ Header ' + label + ' dibuat.');
      } else {
        Logger.log('ℹ️ Header ' + label + ' sudah ada, dilewati.');
      }
    });
  try { SpreadsheetApp.getUi().alert('✅ Header Database Driver Airport + External siap.'); } catch(e) {}
}

function _setupInputDriverSheet(sheetName, zone) {
  var ss    = SpreadsheetApp.openById(RAOS_SS_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  else { sheet.clearContents(); sheet.clearFormats(); }

  var warna = (zone === 'airport') ? '#1155CC' : '#38761D';

  // Header baris 1
  sheet.getRange('A1:G1')
    .setValues([['Login ID (ID Maxim)', 'Nama Driver', 'ID Cabang', 'Zone', 'Tipe Driver', 'Status', 'Hasil']])
    .setBackground(warna).setFontColor('#FFFFFF').setFontWeight('bold')
    .setHorizontalAlignment('center');

  // Baris 2: catatan
  sheet.getRange('A2').setValue(
    'Isi Login ID + Nama + Cabang → klik menu RAOS → Driver → Proses Input Driver ' +
    (zone === 'airport' ? 'Airport' : 'External')
  ).setFontStyle('italic').setFontColor('#666666');
  sheet.getRange('A2:G2').merge();

  // Lebar kolom
  sheet.setColumnWidth(1, 150); // Login ID
  sheet.setColumnWidth(2, 200); // Nama
  sheet.setColumnWidth(3, 230); // ID Cabang
  sheet.setColumnWidth(4, 100); // Zone
  sheet.setColumnWidth(5, 130); // Tipe
  sheet.setColumnWidth(6, 100); // Status
  sheet.setColumnWidth(7, 180); // Hasil

  // Dropdown ID Cabang
  var cabangRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(RIFIM_BRANCHES, true)
    .setAllowInvalid(false).build();
  sheet.getRange(_DRV_DATA_START_ROW, _DRV_INPUT_COL.ID_CABANG, 500, 1)
    .setDataValidation(cabangRule);

  // Dropdown Zone
  var zoneRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['airport', 'external'], true).setAllowInvalid(false).build();
  sheet.getRange(_DRV_DATA_START_ROW, _DRV_INPUT_COL.ZONE, 500, 1)
    .setDataValidation(zoneRule).setValue(zone);

  // Dropdown Tipe Driver
  var tipeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['konvensional', 'online', 'hybrid'], true)
    .setAllowInvalid(false).build();
  sheet.getRange(_DRV_DATA_START_ROW, _DRV_INPUT_COL.TIPE, 500, 1)
    .setDataValidation(tipeRule);

  // Dropdown Status
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['AKTIF', 'NONAKTIF', 'SUSPEND'], true)
    .setAllowInvalid(false).build();
  sheet.getRange(_DRV_DATA_START_ROW, _DRV_INPUT_COL.STATUS, 500, 1)
    .setDataValidation(statusRule);

  sheet.setFrozenRows(2);
  Logger.log('✅ ' + sheetName + ' siap.');
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. TRIGGER — Auto sync tiap 6 jam
// ══════════════════════════════════════════════════════════════════════════════

function setupDriverSyncTrigger() {
  // Hapus trigger lama
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'syncDriversDariSupabase') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncDriversDariSupabase')
    .timeBased().everyHours(6).create();
  Logger.log('✅ Trigger syncDriversDariSupabase setiap 6 jam terpasang.');
  try {
    SpreadsheetApp.getUi().alert('✅ Auto-sync Driver tiap 6 jam aktif.');
  } catch(e) {}
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. HELPER Supabase internal
// ══════════════════════════════════════════════════════════════════════════════

function _sbUrl(table, params) {
  var base = (PropertiesService.getScriptProperties().getProperty('SUPABASE_URL')
              || SUPABASE_URL) + '/rest/v1/' + table;
  return params && params.length ? base + '?' + params.join('&') : base;
}

function _sbHeaders(extra) {
  var key = PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_KEY') || '';
  var h   = { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' };
  if (extra) Object.keys(extra).forEach(function(k) { h[k] = extra[k]; });
  return h;
}

function _sbGet(url) {
  var resp = UrlFetchApp.fetch(url, { headers: _sbHeaders(), muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) throw new Error('Supabase GET gagal: ' + resp.getContentText());
  return JSON.parse(resp.getContentText());
}

function _sbPost(table, data) {
  var resp = UrlFetchApp.fetch(_sbUrl(table), {
    method: 'POST',
    headers: _sbHeaders({ 'Prefer': 'return=minimal' }),
    payload: JSON.stringify(data),
    muteHttpExceptions: true,
  });
  var code = resp.getResponseCode();
  if (code !== 201 && code !== 200) throw new Error('Supabase POST gagal (' + code + '): ' + resp.getContentText());
}

function _sbPatch(table, filter, data) {
  var url  = _sbUrl(table) + '?' + filter;
  var resp = UrlFetchApp.fetch(url, {
    method: 'PATCH',
    headers: _sbHeaders({ 'Prefer': 'return=minimal' }),
    payload: JSON.stringify(data),
    muteHttpExceptions: true,
  });
  var code = resp.getResponseCode();
  if (code !== 200 && code !== 204) throw new Error('Supabase PATCH gagal (' + code + '): ' + resp.getContentText());
}

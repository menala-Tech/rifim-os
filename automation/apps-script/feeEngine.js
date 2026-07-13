/**
 * RIFIM OS — Fee Engine
 *
 * Layer agregasi fee kantor: rekap harian + bulanan dari Database Potongan,
 * kinerja per driver, dan config fee per cabang.
 *
 * Kalkulasi per-order sudah ditangani raosPotonganEngine.js (onEdit + pindahDataKeDatabasePotongan).
 * Fee Engine adalah layer AGGREGATION di atasnya.
 *
 * Setup awal (jalankan SEKALI dari GAS Editor, URUTAN WAJIB):
 *   1. setupFeeSheets()      — buat 4 sheet (CONFIG_FEE_KANTOR, Rekap Fee Harian,
 *                              Rekap Fee Bulanan, DB Driver Kinerja)
 *   2. feeSeedConfigKantor() — isi CONFIG_FEE_KANTOR dari config aktual (Batch 4)
 *   3. setupFeeRekapTrigger()— trigger harian 01:00 WIB
 *
 * Endpoint (webApp.js → routeFeeEngine):
 *   feeGetRekapHarian   — rekap fee per cabang per tanggal (RAOS UI)
 *   feeGetRekapBulanan  — rekap fee per cabang per bulan (Finance UI)
 *   feeGetKinerjaDriver — kinerja order per driver (RAOS UI)
 *
 * Rule 40-47 (gasUtils.js): _gasNow, _gasUuid, _gasWithLock, _gasValidate, _gasLogError
 */

// ── Sheet names ────────────────────────────────────────────────────────────
var _FE_CONFIG_SHEET   = 'CONFIG_FEE_KANTOR';
var _FE_HARIAN_SHEET   = 'Rekap Fee Harian';
var _FE_BULANAN_SHEET  = 'Rekap Fee Bulanan';
var _FE_KINERJA_SHEET  = 'DB Driver Kinerja';
var _FE_DATA_START     = 3;  // row 1=header, row 2=note

// ── Kolom Database Potongan (dari raosPotonganEngine.js) (1-based) ────────
var _FE_DB_COL = {
  ID:1, TANGGAL:2, ID_CABANG:3, LOGIN_ID:4, NAMA_DRIVER:5,
  PRICE:6, KODE_ORDER:7, TIPE_WAKTU:8, OFFLINE:9,
  POTONGAN_KANTOR:10, HAK_DRIVER:11, SURCHARGE_OFFLINE:12,
  TOTAL_POTONGAN:13, STATUS:14, CREATED_AT:15,
};

// ── Kolom Rekap Fee Harian (1-based) ──────────────────────────────────────
var _FH_C = { TANGGAL:1, CABANG:2, JUMLAH_ORDER:3, TOTAL_FEE:4,
              TOTAL_HAK_DRIVER:5, TOTAL_REVENUE:6, UPDATED_AT:7 };

// ── Kolom Rekap Fee Bulanan (1-based) ─────────────────────────────────────
var _FB_C = { BULAN:1, TAHUN:2, CABANG:3, JUMLAH_ORDER:4, TOTAL_FEE:5,
              TOTAL_HAK_DRIVER:6, TOTAL_REVENUE:7, UPDATED_AT:8 };

// ── Kolom DB Driver Kinerja (1-based) ─────────────────────────────────────
var _FK_C = { TANGGAL:1, CABANG:2, LOGIN_ID:3, NAMA_DRIVER:4,
              JUMLAH_ORDER:5, TOTAL_FEE:6, TOTAL_HAK_DRIVER:7, UPDATED_AT:8 };

// ══════════════════════════════════════════════════════════════════════════
// SETUP
// ══════════════════════════════════════════════════════════════════════════

function setupFeeSheets() {
  var ss = SpreadsheetApp.openById(RAOS_SS_ID);
  _feSetupConfig(ss);
  _feSetupRekap(ss, _FE_HARIAN_SHEET,
    ['Tanggal', 'Cabang', 'Jumlah Order', 'Total Fee Kantor', 'Total Hak Driver', 'Total Revenue', 'Updated At'],
    ['#46BDC6','#46BDC6','#34A853','#4285F4','#4285F4','#4285F4','#46BDC6'],
    'ℹ️  Rekap fee kantor per cabang per hari. Diperbarui otomatis 01:00 WIB oleh feeGenerateRekap().'
  );
  _feSetupRekap(ss, _FE_BULANAN_SHEET,
    ['Bulan', 'Tahun', 'Cabang', 'Jumlah Order', 'Total Fee Kantor', 'Total Hak Driver', 'Total Revenue', 'Updated At'],
    ['#46BDC6','#46BDC6','#46BDC6','#34A853','#4285F4','#4285F4','#4285F4','#46BDC6'],
    'ℹ️  Rekap fee kantor per cabang per bulan. Diperbarui otomatis 01:00 WIB oleh feeGenerateRekap().'
  );
  _feSetupRekap(ss, _FE_KINERJA_SHEET,
    ['Tanggal', 'Cabang', 'Login ID', 'Nama Driver', 'Jumlah Order', 'Total Fee', 'Total Hak Driver', 'Updated At'],
    ['#46BDC6','#46BDC6','#46BDC6','#46BDC6','#34A853','#4285F4','#4285F4','#46BDC6'],
    'ℹ️  Kinerja per driver per hari. Diperbarui otomatis 01:00 WIB oleh feeUpdateKinerjaDriver().'
  );
  Logger.log('✅ Setup Fee Engine selesai. Selanjutnya: feeSeedConfigKantor() → setupFeeRekapTrigger()');
}

function _feSetupConfig(ss) {
  if (ss.getSheetByName(_FE_CONFIG_SHEET)) { Logger.log('⚠️  Skip: ' + _FE_CONFIG_SHEET); return; }
  var sh = ss.insertSheet(_FE_CONFIG_SHEET);
  var headers = ['Cabang', 'Tipe Fee', 'Threshold (Rp)', 'Fee Default/Siang (Rp)', 'Fee Malam (Rp)',
                 'Fee Dini (Rp)', 'Surcharge Offline (%)', 'Keterangan'];
  headers.forEach(function(h, i) {
    sh.getRange(1, i + 1).setValue(h)
      .setBackground('#FBBC04').setFontColor('#000000')
      .setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center');
    sh.setColumnWidth(i + 1, 200);
  });
  sh.getRange(2, 1, 1, headers.length).merge()
    .setValue('ℹ️  Referensi config fee per cabang dari Batch 4. JANGAN edit — perubahan fee harus update raosPotonganEngine.js juga.')
    .setFontStyle('italic').setFontColor('#888888').setFontSize(10);
  sh.setRowHeight(1, 36);
  sh.setFrozenRows(1);
  Logger.log('✅ Sheet dibuat: ' + _FE_CONFIG_SHEET + ' — jalankan feeSeedConfigKantor() untuk isi data');
}

function _feSetupRekap(ss, sheetName, headers, colors, note) {
  if (ss.getSheetByName(sheetName)) { Logger.log('⚠️  Skip: ' + sheetName); return; }
  var sh = ss.insertSheet(sheetName);
  headers.forEach(function(h, i) {
    sh.getRange(1, i + 1).setValue(h)
      .setBackground(colors[i]).setFontColor('#FFFFFF')
      .setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center');
    sh.setColumnWidth(i + 1, 190);
  });
  sh.getRange(2, 1, 1, headers.length).merge()
    .setValue(note).setFontStyle('italic').setFontColor('#888888').setFontSize(10);
  sh.setRowHeight(1, 36);
  sh.setFrozenRows(1);
  Logger.log('✅ Sheet dibuat: ' + sheetName);
}

/**
 * Isi CONFIG_FEE_KANTOR dari config aktual Batch 4 (referensi — tidak mengubah kalkulasi).
 * Jalankan SEKALI setelah setupFeeSheets().
 */
function feeSeedConfigKantor() {
  var ss = SpreadsheetApp.openById(RAOS_SS_ID);
  var sh = ss.getSheetByName(_FE_CONFIG_SHEET);
  if (!sh) { Logger.log('Jalankan setupFeeSheets() dulu.'); return; }

  var data = [
    // Cabang | Tipe | Threshold | Fee Siang | Fee Malam | Fee Dini | Surcharge% | Keterangan
    ['ID Rifim Airport Balikpapan', 'FLAT',      0,     25000, 25000, 25000, 0,
     'Flat Rp25.000/order. Tidak ada offline surcharge.'],
    ['ID Rifim Airport Batam',      'THRESHOLD', 70000, 30000, 25000, 20000, 12,
     '≥70rb: Siang=30rb, Malam=25rb, Dini=20rb. <70rb: Siang=25rb. Offline +12% dari price.'],
    ['ID Rifim Airport Manado',     'FLAT',      0,     25000, 25000, 25000, 12,
     'Flat Rp25.000/order. Offline +12% dari price.'],
    ['ID Rifim Airport Pekanbaru',  'KODE',      0,     35000, 0,     20000, 0,
     'Kode 1=35rb. Kode 2=35rb+(pembanding-price)×12%. Kode 3=20rb.'],
    ['ID Rifim Airport Jambi',      'THRESHOLD', 70000, 35000, 0,     25000, 12,
     '<70rb=25rb. ≥70rb kode P=35rb, kode lain=25rb. Offline +12% dari price.'],
  ];

  sh.getRange(_FE_DATA_START, 1, data.length, data[0].length).setValues(data);

  var bands = ['#FFF8F0','#FFF0F0','#F0FFF0','#F0F0FF','#FFFFF0'];
  data.forEach(function(_, i) {
    sh.getRange(_FE_DATA_START + i, 1, 1, data[0].length).setBackground(bands[i % bands.length]);
  });

  Logger.log('✅ CONFIG_FEE_KANTOR diisi: ' + data.length + ' cabang airport.');
}

function setupFeeRekapTrigger() {
  ['feeGenerateRekap', 'feeUpdateKinerjaDriver'].forEach(function(fn) {
    ScriptApp.getProjectTriggers().forEach(function(t) {
      if (t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t);
    });
  });
  ScriptApp.newTrigger('feeGenerateRekap')
    .timeBased().everyDays(1).atHour(1).inTimezone('Asia/Jakarta').create();
  ScriptApp.newTrigger('feeUpdateKinerjaDriver')
    .timeBased().everyDays(1).atHour(1).inTimezone('Asia/Jakarta').create();
  Logger.log('✅ Trigger Fee Engine: feeGenerateRekap + feeUpdateKinerjaDriver jam 01:00 WIB');
}

// ══════════════════════════════════════════════════════════════════════════
// REKAP — aggregasi dari Database Potongan
// ══════════════════════════════════════════════════════════════════════════

/**
 * Generate rekap fee harian dan bulanan dari Database Potongan.
 * Dipanggil oleh trigger harian 01:00 WIB.
 * Mode: kemarin (default) atau full rebuild (params.mode = 'full').
 */
function feeGenerateRekap(params) {
  try {
    var ss      = SpreadsheetApp.openById(RAOS_SS_ID);
    var shDB    = ss.getSheetByName('Database Potongan');
    var shH     = ss.getSheetByName(_FE_HARIAN_SHEET);
    var shB     = ss.getSheetByName(_FE_BULANAN_SHEET);
    if (!shDB || !shH || !shB) {
      _gasLogError('feeGenerateRekap', 'setup', new Error('Sheet tidak ditemukan'), {});
      return;
    }

    var last = shDB.getLastRow();
    if (last < _FE_DATA_START) { Logger.log('Database Potongan kosong.'); return; }

    var data = shDB.getRange(_FE_DATA_START, 1, last - _FE_DATA_START + 1,
                             Object.keys(_FE_DB_COL).length).getValues();

    // Filter: default hanya kemarin, full = semua
    var isFullMode = params && params.mode === 'full';
    var yesterday  = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    var filterTgl  = isFullMode ? null : Utilities.formatDate(yesterday, 'Asia/Jakarta', 'yyyy-MM-dd');

    // Aggregate per cabang per hari
    var byHari = {};   // key: "yyyy-MM-dd|cabang"
    var byBulan = {};  // key: "MM|yyyy|cabang"

    data.forEach(function(row) {
      var tgl       = _feFormatTgl(row[_FE_DB_COL.TANGGAL - 1]);
      if (filterTgl && tgl !== filterTgl) return;
      var cabang    = String(row[_FE_DB_COL.ID_CABANG - 1] || '');
      var fee       = Number(row[_FE_DB_COL.POTONGAN_KANTOR - 1]) || 0;
      var hak       = Number(row[_FE_DB_COL.HAK_DRIVER - 1]) || 0;
      var price     = Number(row[_FE_DB_COL.PRICE - 1]) || 0;

      var kH = tgl + '|' + cabang;
      if (!byHari[kH]) byHari[kH] = { tgl: tgl, cabang: cabang, count: 0, fee: 0, hak: 0, rev: 0 };
      byHari[kH].count++;
      byHari[kH].fee  += fee;
      byHari[kH].hak  += hak;
      byHari[kH].rev  += price;

      var bulanNum = tgl.substring(5, 7);
      var tahun    = tgl.substring(0, 4);
      var kB = bulanNum + '|' + tahun + '|' + cabang;
      if (!byBulan[kB]) byBulan[kB] = { bulan: bulanNum, tahun: tahun, cabang: cabang, count: 0, fee: 0, hak: 0, rev: 0 };
      byBulan[kB].count++;
      byBulan[kB].fee  += fee;
      byBulan[kB].hak  += hak;
      byBulan[kB].rev  += price;
    });

    var tsISO      = _gasNow();
    var toH        = Object.values(byHari).map(function(d) {
      return [d.tgl, d.cabang, d.count, d.fee, d.hak, d.rev, tsISO];
    });
    var toB        = Object.values(byBulan).map(function(d) {
      return [d.bulan, d.tahun, d.cabang, d.count, d.fee, d.hak, d.rev, tsISO];
    });

    _gasWithLock(function() {
      if (toH.length > 0) {
        // Full mode: bersihkan dulu; harian mode: langsung append (idempoten per tanggal)
        if (isFullMode) { _feClearData(shH); }
        var lastH = shH.getLastRow();
        shH.getRange(lastH + 1, 1, toH.length, 7).setValues(toH);
      }
      if (toB.length > 0) {
        if (isFullMode) { _feClearData(shB); }
        var lastB = shB.getLastRow();
        shB.getRange(lastB + 1, 1, toB.length, 8).setValues(toB);
      }
    });

    Logger.log('feeGenerateRekap: ' + toH.length + ' harian, ' + toB.length + ' bulanan diperbarui.');
  } catch (err) {
    _gasLogError('feeGenerateRekap', 'main', err, params || {});
  }
}

/**
 * Update DB Driver Kinerja: kinerja per driver per hari dari Database Potongan.
 * Dipanggil oleh trigger harian 01:00 WIB.
 */
function feeUpdateKinerjaDriver(params) {
  try {
    var ss    = SpreadsheetApp.openById(RAOS_SS_ID);
    var shDB  = ss.getSheetByName('Database Potongan');
    var shK   = ss.getSheetByName(_FE_KINERJA_SHEET);
    if (!shDB || !shK) { _gasLogError('feeUpdateKinerjaDriver', 'setup', new Error('Sheet tidak ditemukan'), {}); return; }

    var last = shDB.getLastRow();
    if (last < _FE_DATA_START) return;
    var data = shDB.getRange(_FE_DATA_START, 1, last - _FE_DATA_START + 1,
                             Object.keys(_FE_DB_COL).length).getValues();

    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    var filterTgl = params && params.mode === 'full'
      ? null
      : Utilities.formatDate(yesterday, 'Asia/Jakarta', 'yyyy-MM-dd');

    // Aggregate per driver per hari
    var byDriver = {};  // key: "tgl|loginId"

    data.forEach(function(row) {
      var tgl     = _feFormatTgl(row[_FE_DB_COL.TANGGAL - 1]);
      if (filterTgl && tgl !== filterTgl) return;
      var loginId = String(row[_FE_DB_COL.LOGIN_ID - 1] || '').trim();
      var nama    = String(row[_FE_DB_COL.NAMA_DRIVER - 1] || '');
      var cabang  = String(row[_FE_DB_COL.ID_CABANG - 1] || '');
      var fee     = Number(row[_FE_DB_COL.POTONGAN_KANTOR - 1]) || 0;
      var hak     = Number(row[_FE_DB_COL.HAK_DRIVER - 1]) || 0;

      var k = tgl + '|' + loginId;
      if (!byDriver[k]) byDriver[k] = { tgl: tgl, cabang: cabang, loginId: loginId, nama: nama, count: 0, fee: 0, hak: 0 };
      byDriver[k].count++;
      byDriver[k].fee  += fee;
      byDriver[k].hak  += hak;
    });

    var tsISO = _gasNow();
    var toK   = Object.values(byDriver).map(function(d) {
      return [d.tgl, d.cabang, d.loginId, d.nama, d.count, d.fee, d.hak, tsISO];
    });

    if (toK.length > 0) {
      _gasWithLock(function() {
        if (params && params.mode === 'full') _feClearData(shK);
        var lastK = shK.getLastRow();
        shK.getRange(lastK + 1, 1, toK.length, 8).setValues(toK);
      });
    }
    Logger.log('feeUpdateKinerjaDriver: ' + toK.length + ' baris kinerja diperbarui.');
  } catch (err) {
    _gasLogError('feeUpdateKinerjaDriver', 'main', err, params || {});
  }
}

/** Hapus data (baris 3+) di sheet rekap, pertahankan header & note. */
function _feClearData(sh) {
  var last = sh.getLastRow();
  if (last >= _FE_DATA_START) sh.deleteRows(_FE_DATA_START, last - _FE_DATA_START + 1);
}

/** Format tanggal ke 'yyyy-MM-dd' WIB dari Date object atau ISO string. */
function _feFormatTgl(val) {
  if (val instanceof Date && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, 'Asia/Jakarta', 'yyyy-MM-dd');
  }
  return String(val || '').substring(0, 10);
}

// ══════════════════════════════════════════════════════════════════════════
// ENDPOINTS — webApp
// ══════════════════════════════════════════════════════════════════════════

function feeGetRekapHarian(params) {
  try {
    var ss   = SpreadsheetApp.openById(RAOS_SS_ID);
    var sh   = ss.getSheetByName(_FE_HARIAN_SHEET);
    if (!sh) return { ok: false, error: 'Rekap Fee Harian belum disetup.' };

    var last = sh.getLastRow();
    if (last < _FE_DATA_START) return { ok: true, data: [] };

    var data   = sh.getRange(_FE_DATA_START, 1, last - _FE_DATA_START + 1, 7).getValues();
    var filter = params && params.tanggal ? String(params.tanggal) : null;
    var result = [];

    data.forEach(function(row) {
      var tgl = _feFormatTgl(row[0]);
      if (filter && tgl !== filter) return;
      result.push({
        tanggal:        tgl,
        cabang:         row[_FH_C.CABANG - 1],
        jumlahOrder:    Number(row[_FH_C.JUMLAH_ORDER - 1]) || 0,
        totalFee:       Number(row[_FH_C.TOTAL_FEE - 1]) || 0,
        totalHakDriver: Number(row[_FH_C.TOTAL_HAK_DRIVER - 1]) || 0,
        totalRevenue:   Number(row[_FH_C.TOTAL_REVENUE - 1]) || 0,
      });
    });
    return { ok: true, data: result };
  } catch (err) {
    _gasLogError('feeGetRekapHarian', 'get', err, params || {});
    return { ok: false, error: err.message };
  }
}

function feeGetRekapBulanan(params) {
  try {
    var ss   = SpreadsheetApp.openById(RAOS_SS_ID);
    var sh   = ss.getSheetByName(_FE_BULANAN_SHEET);
    if (!sh) return { ok: false, error: 'Rekap Fee Bulanan belum disetup.' };

    var last = sh.getLastRow();
    if (last < _FE_DATA_START) return { ok: true, data: [] };

    var data   = sh.getRange(_FE_DATA_START, 1, last - _FE_DATA_START + 1, 8).getValues();
    var result = [];
    var fBln   = params && params.bulan ? String(params.bulan) : null;
    var fThn   = params && params.tahun ? String(params.tahun) : null;

    data.forEach(function(row) {
      if (fBln && String(row[0]) !== fBln) return;
      if (fThn && String(row[1]) !== fThn) return;
      result.push({
        bulan:          row[_FB_C.BULAN - 1],
        tahun:          row[_FB_C.TAHUN - 1],
        cabang:         row[_FB_C.CABANG - 1],
        jumlahOrder:    Number(row[_FB_C.JUMLAH_ORDER - 1]) || 0,
        totalFee:       Number(row[_FB_C.TOTAL_FEE - 1]) || 0,
        totalHakDriver: Number(row[_FB_C.TOTAL_HAK_DRIVER - 1]) || 0,
        totalRevenue:   Number(row[_FB_C.TOTAL_REVENUE - 1]) || 0,
      });
    });
    return { ok: true, data: result };
  } catch (err) {
    _gasLogError('feeGetRekapBulanan', 'get', err, params || {});
    return { ok: false, error: err.message };
  }
}

function feeGetKinerjaDriver(params) {
  try {
    _gasValidate(params, { loginId: { type: 'string', required: true } });
    var ss      = SpreadsheetApp.openById(RAOS_SS_ID);
    var sh      = ss.getSheetByName(_FE_KINERJA_SHEET);
    if (!sh) return { ok: false, error: 'DB Driver Kinerja belum disetup.' };

    var last    = sh.getLastRow();
    if (last < _FE_DATA_START) return { ok: true, data: [] };

    var data    = sh.getRange(_FE_DATA_START, 1, last - _FE_DATA_START + 1, 8).getValues();
    var loginId = String(params.loginId).trim();
    var result  = [];

    data.forEach(function(row) {
      if (String(row[_FK_C.LOGIN_ID - 1] || '').trim() !== loginId) return;
      result.push({
        tanggal:        _feFormatTgl(row[_FK_C.TANGGAL - 1]),
        cabang:         row[_FK_C.CABANG - 1],
        loginId:        loginId,
        namaDriver:     row[_FK_C.NAMA_DRIVER - 1],
        jumlahOrder:    Number(row[_FK_C.JUMLAH_ORDER - 1]) || 0,
        totalFee:       Number(row[_FK_C.TOTAL_FEE - 1]) || 0,
        totalHakDriver: Number(row[_FK_C.TOTAL_HAK_DRIVER - 1]) || 0,
      });
    });
    return { ok: true, data: result };
  } catch (err) {
    _gasLogError('feeGetKinerjaDriver', 'get', err, params || {});
    return { ok: false, error: err.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ROUTER
// ══════════════════════════════════════════════════════════════════════════

/**
 * Route action Fee Engine → fungsi handler.
 * Return null jika action bukan milik Fee Engine.
 */
function routeFeeEngine(action, params) {
  switch (action) {
    case 'feeGetRekapHarian':   return feeGetRekapHarian(params);
    case 'feeGetRekapBulanan':  return feeGetRekapBulanan(params);
    case 'feeGetKinerjaDriver': return feeGetKinerjaDriver(params);
    default: return null;
  }
}

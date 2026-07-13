/**
 * RIFIM OS — Saldo Engine
 *
 * Verifikasi saldo driver: match Form Input Saldo PWA (staff) vs Form Input Saldo AIST (Maxim)
 * → Database AIST → Saldo Driver (running balance bulan ini).
 *
 * Setup awal (jalankan SEKALI dari GAS Editor, URUTAN WAJIB):
 *   1. setupSaldoSheets()    — buat sheet Saldo Driver + Rekap Saldo Cabang
 *   2. setupSaldoTriggers()  — onEdit AIST auto-fill + trigger rekap harian 00:00 WIB
 *
 * Workflow harian:
 *   Admin paste Tanggal/SUM/Credit Account ke Form Input Saldo AIST (A-C)
 *   → Isi Login ID (D) → onEditSaldoAIST() auto-fill Nama Driver + Cabang (E-F)
 *   → Menu "RIFIM OS → Proses AIST Hari Ini" → saldoProcessAIST()
 *     → match vs Form Input Saldo PWA → Database AIST → Saldo Driver
 *   → 00:00 WIB → saldoDailyRekap() → Rekap Saldo Cabang
 *
 * Endpoint (webApp.js → routeSaldoEngine):
 *   saldoGetDriverBalance  — saldo bulan ini per Login ID (Driver PWA)
 *   saldoGetRekapCabang    — rekap per cabang (RAOS UI)
 *
 * Rule 40-47 (gasUtils.js): _gasNow, _gasUuid, _gasWithLock, _gasValidate, _gasLogError
 */

// ── Sheet names ────────────────────────────────────────────────────────────
var _SD_SHEET      = 'Saldo Driver';
var _SR_SHEET      = 'Rekap Saldo Cabang';
var _SD_AIST_F     = 'Form Input Saldo AIST';
var _SD_AIST_DB    = 'Database AIST';
var _SD_PWA_F      = 'Form Input Saldo PWA';
var _SD_DATA_START = 3;  // row 1=header, row 2=note keterangan

// ── Kolom Form Input Saldo AIST (1-based) ─────────────────────────────────
// A=Tanggal B=SUM C=Credit Account D=Login ID (kuning, paste/isi manual)
// E=Nominal Tagihan F=Nama Driver G=Cabang H=STATUS (hijau/teal, auto)
var _FA_C = { TANGGAL:1, SUM:2, CREDIT_ACCOUNT:3, LOGIN_ID:4,
              NOMINAL_TAGIHAN:5, NAMA_DRIVER:6, CABANG:7, STATUS:8 };

// ── Kolom Database AIST (1-based) ─────────────────────────────────────────
// 10 kolom: ID Tanggal LoginID CreditAccount NamaDriver Cabang NominalTagihan SumAIST StatusMatch CreatedAt
// Jika sheet masih kosong dan perlu tambah kolom SUM AIST: resetSingleRaosSheet('Database AIST')
var _DA_C = { ID:1, TANGGAL:2, LOGIN_ID:3, CREDIT_ACCOUNT:4, NAMA_DRIVER:5,
              CABANG:6, NOMINAL_TAGIHAN:7, SUM_AIST:8, STATUS_MATCH:9, CREATED_AT:10 };

// ── Kolom Form Input Saldo PWA (dari staffAppApi.js) (1-based) ────────────
var _FP_C = { TIMESTAMP:1, CABANG:2, NAMA_STAFF:3, NOMINAL:4, LOGIN_ID:5, NAMA_DRIVER:6 };

// ── Kolom Saldo Driver (1-based) ──────────────────────────────────────────
var _SD_C = { LOGIN_ID:1, NAMA_DRIVER:2, CABANG:3, NOMINAL:4, COUNT:5, UPDATED_AT:6 };

// ── Kolom Rekap Saldo Cabang (1-based) ────────────────────────────────────
var _SR_C = { TANGGAL:1, CABANG:2, TOTAL_NOMINAL:3, TOTAL_PENGISIAN:4,
              TARGET:5, PERSEN:6, STATUS:7, UPDATED_AT:8 };

// ── Target saldo harian per cabang (dari Batch 8 MASTER TARGET, ÷ 26 hari) ──
var _SD_TARGET = {
  'ID Rifim Airport Batam':      Math.round(110000000 / 26),
  'ID Rifim Batam':              Math.round(70000000  / 26),
  'ID Rifim Airport Jambi':      Math.round(36000000  / 26),
  'ID Rifim Jambi Luar':         Math.round(16000000  / 26),
  'ID Rifim Airport Balikpapan': Math.round(90000000  / 26),
  'ID Rifim Airport Manado':     Math.round(40000000  / 26),
  'ID Rifim Airport Pekanbaru':  Math.round(100000000 / 26),
};

// ══════════════════════════════════════════════════════════════════════════
// SETUP
// ══════════════════════════════════════════════════════════════════════════

/**
 * Patch SEKALI: tambah kolom "SUM AIST" di posisi 8 pada sheet Database AIST.
 * Jalankan dari GAS Editor jika sheet Database AIST sudah ada tapi belum punya kolom SUM AIST.
 * Aman dijalankan berulang (idempoten — cek header dulu sebelum insert).
 */
function patchDatabaseAISTAddSumColumn() {
  var ss = SpreadsheetApp.openById(RAOS_SS_ID);
  var sh = ss.getSheetByName(_SD_AIST_DB);
  if (!sh) { Logger.log('Sheet Database AIST tidak ditemukan.'); return; }

  var lastCol   = sh.getLastColumn();
  var headers   = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var colNames  = headers.map(function(h) { return String(h).trim(); });

  // Sudah ada → skip
  if (colNames.indexOf('SUM AIST') !== -1) {
    Logger.log('✅ Kolom SUM AIST sudah ada di kolom ' + (colNames.indexOf('SUM AIST') + 1) + '. Tidak perlu patch.');
    return;
  }

  // Cek apakah Nominal Tagihan ada di col 7 (sebagai anchor posisi insert)
  var ntIdx = colNames.indexOf('Nominal Tagihan');
  var insertAt = (ntIdx !== -1) ? (ntIdx + 2) : 8; // insert setelah Nominal Tagihan

  sh.insertColumnBefore(insertAt);
  var hCell = sh.getRange(1, insertAt);
  hCell.setValue('SUM AIST')
       .setBackground('#FBBC04')  // kuning — data dari AIST (bukan kalkulasi)
       .setFontColor('#000000')
       .setFontWeight('bold')
       .setFontSize(11)
       .setHorizontalAlignment('center');
  sh.setColumnWidth(insertAt, 160);

  // Pastikan note row 2 masih merged
  try {
    sh.getRange(2, 1, 1, sh.getLastColumn()).merge()
      .setValue('ℹ️  Hasil proses Form Input Saldo AIST. Status: MATCH/SELISIH/HANYA_AIST. Jangan edit manual.')
      .setFontStyle('italic').setFontColor('#888888').setFontSize(10);
  } catch (e) { /* ignore merge error jika sudah ada data */ }

  Logger.log('✅ Patch selesai: kolom SUM AIST ditambah di posisi ' + insertAt + '. Total kolom: ' + sh.getLastColumn());
}

function setupSaldoSheets() {
  var ss = SpreadsheetApp.openById(RAOS_SS_ID);
  _sdSetupSaldoDriver(ss);
  _sdSetupRekapCabang(ss);
  Logger.log('✅ Setup Saldo Engine selesai. Selanjutnya: setupSaldoTriggers()');
}

function _sdSetupSaldoDriver(ss) {
  if (ss.getSheetByName(_SD_SHEET)) { Logger.log('⚠️  Skip: ' + _SD_SHEET); return; }
  var sh = ss.insertSheet(_SD_SHEET);
  var headers = ['Login ID', 'Nama Driver', 'Cabang',
                 'Total Nominal Bulan Ini', 'Jumlah Pengisian', 'Updated At'];
  var colors  = ['#46BDC6','#46BDC6','#46BDC6','#34A853','#34A853','#46BDC6'];
  headers.forEach(function(h, i) {
    sh.getRange(1, i + 1).setValue(h)
      .setBackground(colors[i]).setFontColor('#FFFFFF')
      .setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center');
    sh.setColumnWidth(i + 1, 190);
  });
  sh.getRange(2, 1, 1, headers.length).merge()
    .setValue('ℹ️  Running balance saldo driver bulan berjalan. Diperbarui otomatis oleh saldoProcessAIST(). Jangan edit manual.')
    .setFontStyle('italic').setFontColor('#888888').setFontSize(10);
  sh.setRowHeight(1, 36);
  sh.setFrozenRows(1);
  Logger.log('✅ Sheet dibuat: ' + _SD_SHEET);
}

function _sdSetupRekapCabang(ss) {
  if (ss.getSheetByName(_SR_SHEET)) { Logger.log('⚠️  Skip: ' + _SR_SHEET); return; }
  var sh = ss.insertSheet(_SR_SHEET);
  var headers = ['Tanggal', 'Cabang', 'Total Nominal', 'Jumlah Pengisian',
                 'Target Harian', '% Target', 'Status', 'Updated At'];
  var colors  = ['#46BDC6','#46BDC6','#34A853','#34A853','#4285F4','#4285F4','#EA4335','#46BDC6'];
  headers.forEach(function(h, i) {
    sh.getRange(1, i + 1).setValue(h)
      .setBackground(colors[i]).setFontColor('#FFFFFF')
      .setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center');
    sh.setColumnWidth(i + 1, 190);
  });
  sh.getRange(2, 1, 1, headers.length).merge()
    .setValue('ℹ️  Rekap harian saldo per cabang. Diperbarui otomatis 00:00 WIB oleh saldoDailyRekap().')
    .setFontStyle('italic').setFontColor('#888888').setFontSize(10);
  sh.setRowHeight(1, 36);
  sh.setFrozenRows(1);
  Logger.log('✅ Sheet dibuat: ' + _SR_SHEET);
}

function setupSaldoTriggers() {
  ['onEditSaldoAIST', 'saldoDailyRekap'].forEach(function(fn) {
    ScriptApp.getProjectTriggers().forEach(function(t) {
      if (t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t);
    });
  });
  ScriptApp.newTrigger('onEditSaldoAIST')
    .forSpreadsheet(SpreadsheetApp.openById(RAOS_SS_ID))
    .onEdit().create();
  ScriptApp.newTrigger('saldoDailyRekap')
    .timeBased().everyDays(1).atHour(0).inTimezone('Asia/Jakarta').create();
  Logger.log('✅ Trigger Saldo Engine: onEditSaldoAIST + saldoDailyRekap jam 00:00 WIB');
}

// ══════════════════════════════════════════════════════════════════════════
// ON-EDIT — auto-fill Form Input Saldo AIST saat Login ID diisi
// ══════════════════════════════════════════════════════════════════════════

function onEditSaldoAIST(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== _SD_AIST_F) return;

  var row = e.range.getRow();
  if (row < _SD_DATA_START) return;

  var startCol = e.range.getColumn();
  var endCol   = startCol + e.range.getNumColumns() - 1;
  if (startCol > _FA_C.LOGIN_ID || endCol < _FA_C.LOGIN_ID) return;

  var loginId = sheet.getRange(row, _FA_C.LOGIN_ID).getValue();
  if (!loginId || String(loginId).trim() === '') {
    sheet.getRange(row, _FA_C.NOMINAL_TAGIHAN).clearContent();
    sheet.getRange(row, _FA_C.NAMA_DRIVER).clearContent();
    sheet.getRange(row, _FA_C.CABANG).clearContent();
    return;
  }

  var driver = _cariDriverByLoginId(String(loginId).trim());
  if (driver) {
    // Nominal Tagihan (E) dikosongkan — akan diisi oleh saldoProcessAIST() saat matching
    sheet.getRange(row, _FA_C.NOMINAL_TAGIHAN).clearContent();
    sheet.getRange(row, _FA_C.NAMA_DRIVER).setValue(driver.nama);
    sheet.getRange(row, _FA_C.CABANG).setValue(driver.idCabang);
  } else {
    sheet.getRange(row, _FA_C.NOMINAL_TAGIHAN).clearContent();
    sheet.getRange(row, _FA_C.NAMA_DRIVER).setValue('TIDAK DITEMUKAN');
    sheet.getRange(row, _FA_C.CABANG).setValue('TIDAK DITEMUKAN');
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PROSES AIST — match PWA vs AIST, tulis Database AIST, update Saldo Driver
// ══════════════════════════════════════════════════════════════════════════

/**
 * Proses baris di Form Input Saldo AIST yang belum diverifikasi.
 * Match: Login ID sama + tanggal sama (WIB).
 * Status: MATCH (nominal sama) | SELISIH (nominal beda) | HANYA_AIST (tidak ada PWA entry).
 *
 * Jalankan dari menu GAS atau tombol di sheet setelah admin selesai input AIST.
 */
function saldoProcessAIST() {
  try {
    var ss       = SpreadsheetApp.openById(RAOS_SS_ID);
    var shAIST   = ss.getSheetByName(_SD_AIST_F);
    var shDbAIST = ss.getSheetByName(_SD_AIST_DB);
    var shPWA    = ss.getSheetByName(_SD_PWA_F);
    var shSD     = ss.getSheetByName(_SD_SHEET);

    if (!shAIST || !shDbAIST || !shPWA || !shSD) {
      _gasLogError('saldoProcessAIST', 'setup', new Error('Sheet tidak ditemukan — jalankan setupSaldoSheets() dulu'), {});
      return;
    }

    var lastAIST = shAIST.getLastRow();
    var lastPWA  = shPWA.getLastRow();
    if (lastAIST < _SD_DATA_START) { Logger.log('Form Input Saldo AIST kosong.'); return; }

    // ── BACA (di luar lock) ──────────────────────────────────────────
    var dataAIST = shAIST.getRange(_SD_DATA_START, 1, lastAIST - _SD_DATA_START + 1,
                                   Object.keys(_FA_C).length).getValues();
    var dataPWA  = lastPWA >= _SD_DATA_START
      ? shPWA.getRange(_SD_DATA_START, 1, lastPWA - _SD_DATA_START + 1, 6).getValues()
      : [];

    // ── PROSES MATCHING (di luar lock, CPU-only) ─────────────────────
    var toAppendDB    = [];
    var statusUpdates = [];          // [{rowNum, status}]
    var balanceMap    = {};          // {loginId: {nama, cabang, total, count}}
    var tsISO         = _gasNow();

    for (var i = 0; i < dataAIST.length; i++) {
      var rowData    = dataAIST[i];
      var currStatus = String(rowData[_FA_C.STATUS - 1] || '').trim();
      if (currStatus === 'MATCH' || currStatus === 'SELISIH' || currStatus === 'HANYA_AIST') continue;

      var tanggal       = rowData[_FA_C.TANGGAL - 1];
      var sumAIST       = Number(rowData[_FA_C.SUM - 1]) || 0;
      var creditAccount = rowData[_FA_C.CREDIT_ACCOUNT - 1];
      var loginId       = String(rowData[_FA_C.LOGIN_ID - 1] || '').trim();
      var namaDriver    = rowData[_FA_C.NAMA_DRIVER - 1];   // col F (6), auto-fill by onEditSaldoAIST
      var cabang        = rowData[_FA_C.CABANG - 1];        // col G (7)

      if (!loginId || !sumAIST) continue;

      var tglAIST = _sdFormatTgl(tanggal);
      var pwaMatch = _sdFindPwaMatch(dataPWA, loginId, tglAIST);

      var statusMatch = 'HANYA_AIST';
      var nominalPWA  = 0;
      if (pwaMatch !== null) {
        nominalPWA  = pwaMatch.nominal;
        statusMatch = (nominalPWA === sumAIST) ? 'MATCH' : 'SELISIH';
      }

      toAppendDB.push([
        _gasUuid(),     // A: ID
        tanggal,        // B: Tanggal
        loginId,        // C: Login ID
        creditAccount,  // D: Credit Account
        namaDriver,     // E: Nama Driver (dari col F Form Input AIST — sudah di-auto-fill onEdit)
        cabang,         // F: Cabang (dari col G Form Input AIST)
        nominalPWA,     // G: Nominal Tagihan (nominal yg diinput staff di PWA; 0 jika HANYA_AIST)
        sumAIST,        // H: SUM AIST (jumlah yang tercatat di Maxim AIST — col B Form Input AIST)
        statusMatch,    // I: Status Match (MATCH/SELISIH/HANYA_AIST)
        tsISO,          // J: Created At (ISO UTC — Rule 40a)
      ]);

      statusUpdates.push({ rowNum: _SD_DATA_START + i, nominalPWA: nominalPWA, status: statusMatch });

      // Update balance untuk MATCH dan SELISIH (transaksi terjadi — pakai SUM dari AIST)
      if (statusMatch === 'MATCH' || statusMatch === 'SELISIH') {
        if (!balanceMap[loginId]) {
          balanceMap[loginId] = { nama: String(namaDriver || ''), cabang: String(cabang || ''), total: 0, count: 0 };
        }
        balanceMap[loginId].total += sumAIST;
        balanceMap[loginId].count += 1;
      }
    }

    if (toAppendDB.length === 0) { Logger.log('Tidak ada baris baru untuk diproses.'); return; }

    // ── TULIS — satu lock untuk semua write (Rule 41c) ───────────────
    _gasWithLock(function() {
      // 1. Append ke Database AIST
      var lastDB = shDbAIST.getLastRow();
      shDbAIST.getRange(lastDB + 1, 1, toAppendDB.length, toAppendDB[0].length)
              .setValues(toAppendDB);

      // 2. Update Nominal Tagihan (E) + STATUS (H) di Form Input Saldo AIST
      statusUpdates.forEach(function(u) {
        if (u.nominalPWA) shAIST.getRange(u.rowNum, _FA_C.NOMINAL_TAGIHAN).setValue(u.nominalPWA);
        shAIST.getRange(u.rowNum, _FA_C.STATUS).setValue(u.status);
      });

      // 3. Update Saldo Driver running balance
      Object.keys(balanceMap).forEach(function(lid) {
        var b = balanceMap[lid];
        _sdWriteBalance(shSD, lid, b.nama, b.cabang, b.total, b.count, tsISO);
      });
    });

    Logger.log('saldoProcessAIST: ' + toAppendDB.length + ' baris diproses ('
      + Object.keys(balanceMap).length + ' driver balance diupdate).');
  } catch (err) {
    _gasLogError('saldoProcessAIST', 'main', err, {});
  }
}

/**
 * Cari entry PWA yang cocok: Login ID sama + tanggal sama (WIB).
 * @returns {{nominal: number}|null}
 */
function _sdFindPwaMatch(dataPWA, loginId, tglAIST) {
  for (var j = 0; j < dataPWA.length; j++) {
    var pwaLoginId = String(dataPWA[j][_FP_C.LOGIN_ID - 1] || '').trim();
    if (pwaLoginId !== loginId) continue;
    var pwaTgl = _sdFormatTgl(dataPWA[j][_FP_C.TIMESTAMP - 1]);
    if (pwaTgl !== tglAIST) continue;
    return { nominal: Number(dataPWA[j][_FP_C.NOMINAL - 1]) || 0 };
  }
  return null;
}

/** Format tanggal ke 'yyyy-MM-dd' WIB dari Date object atau string ISO. */
function _sdFormatTgl(val) {
  if (val instanceof Date && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, 'Asia/Jakarta', 'yyyy-MM-dd');
  }
  return String(val || '').substring(0, 10);
}

/**
 * Update running balance di sheet Saldo Driver.
 * Cari baris dengan Login ID yang sama → update; tidak ada → append.
 * Dipanggil di dalam _gasWithLock — JANGAN panggil _gasWithLock di dalam.
 */
function _sdWriteBalance(sh, loginId, namaDriver, cabang, deltaNominal, deltaCount, tsISO) {
  var last = sh.getLastRow();
  if (last >= _SD_DATA_START) {
    var data = sh.getRange(_SD_DATA_START, 1, last - _SD_DATA_START + 1, 6).getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(loginId).trim()) {
        var rowNum = _SD_DATA_START + i;
        sh.getRange(rowNum, _SD_C.NOMINAL).setValue(Number(data[i][_SD_C.NOMINAL - 1]) + deltaNominal);
        sh.getRange(rowNum, _SD_C.COUNT).setValue(Number(data[i][_SD_C.COUNT - 1]) + deltaCount);
        sh.getRange(rowNum, _SD_C.UPDATED_AT).setValue(tsISO);
        return;
      }
    }
  }
  sh.appendRow([loginId, namaDriver, cabang, deltaNominal, deltaCount, tsISO]);
}

// ══════════════════════════════════════════════════════════════════════════
// ENDPOINTS — webApp
// ══════════════════════════════════════════════════════════════════════════

/**
 * Get saldo driver bulan ini by Login ID.
 * Dipakai oleh Driver PWA untuk tampilkan saldo.
 */
function saldoGetDriverBalance(params) {
  try {
    _gasValidate(params, { loginId: { type: 'string', required: true } });
    var loginId = String(params.loginId).trim();
    var ss      = SpreadsheetApp.openById(RAOS_SS_ID);
    var sh      = ss.getSheetByName(_SD_SHEET);
    if (!sh) return { ok: false, error: 'Saldo Driver belum disetup.' };

    var last = sh.getLastRow();
    if (last < _SD_DATA_START) return { ok: true, loginId: loginId, nominal: 0, count: 0 };

    var data = sh.getRange(_SD_DATA_START, 1, last - _SD_DATA_START + 1, 6).getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === loginId) {
        return {
          ok:        true,
          loginId:   loginId,
          nama:      data[i][_SD_C.NAMA_DRIVER - 1],
          cabang:    data[i][_SD_C.CABANG - 1],
          nominal:   Number(data[i][_SD_C.NOMINAL - 1]) || 0,
          count:     Number(data[i][_SD_C.COUNT - 1]) || 0,
          updatedAt: data[i][_SD_C.UPDATED_AT - 1],
        };
      }
    }
    return { ok: true, loginId: loginId, nominal: 0, count: 0, updatedAt: null };
  } catch (err) {
    _gasLogError('saldoGetDriverBalance', 'get', err, params);
    return { ok: false, error: err.message };
  }
}

/**
 * Get rekap saldo per cabang (opsional: filter tanggal).
 * Dipakai oleh RAOS UI.
 */
function saldoGetRekapCabang(params) {
  try {
    var ss   = SpreadsheetApp.openById(RAOS_SS_ID);
    var sh   = ss.getSheetByName(_SR_SHEET);
    if (!sh) return { ok: false, error: 'Rekap Saldo Cabang belum disetup.' };

    var last = sh.getLastRow();
    if (last < _SD_DATA_START) return { ok: true, data: [] };

    var data   = sh.getRange(_SD_DATA_START, 1, last - _SD_DATA_START + 1, 8).getValues();
    var filter = params && params.tanggal ? String(params.tanggal) : null;
    var result = [];

    data.forEach(function(row) {
      var tgl = _sdFormatTgl(row[0]);
      if (filter && tgl !== filter) return;
      result.push({
        tanggal:        tgl,
        cabang:         row[_SR_C.CABANG - 1],
        totalNominal:   Number(row[_SR_C.TOTAL_NOMINAL - 1]) || 0,
        totalPengisian: Number(row[_SR_C.TOTAL_PENGISIAN - 1]) || 0,
        target:         Number(row[_SR_C.TARGET - 1]) || 0,
        persen:         row[_SR_C.PERSEN - 1],
        status:         row[_SR_C.STATUS - 1],
      });
    });

    return { ok: true, data: result };
  } catch (err) {
    _gasLogError('saldoGetRekapCabang', 'get', err, params || {});
    return { ok: false, error: err.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════
// DAILY REKAP — trigger 00:00 WIB
// ══════════════════════════════════════════════════════════════════════════

/**
 * Generate rekap saldo per cabang untuk hari kemarin → Rekap Saldo Cabang.
 * Dipanggil oleh trigger harian 00:00 WIB.
 */
function saldoDailyRekap() {
  try {
    var ss      = SpreadsheetApp.openById(RAOS_SS_ID);
    var shDB    = ss.getSheetByName(_SD_AIST_DB);
    var shRekap = ss.getSheetByName(_SR_SHEET);
    if (!shDB || !shRekap) return;

    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    var tglStr = Utilities.formatDate(yesterday, 'Asia/Jakarta', 'yyyy-MM-dd');

    var last = shDB.getLastRow();
    if (last < _SD_DATA_START) return;

    var data = shDB.getRange(_SD_DATA_START, 1, last - _SD_DATA_START + 1, 10).getValues();
    var byCabang = {};

    data.forEach(function(row) {
      if (_sdFormatTgl(row[_DA_C.TANGGAL - 1]) !== tglStr) return;
      var cabang  = String(row[_DA_C.CABANG - 1] || '');
      var sumAIST = Number(row[_DA_C.SUM_AIST - 1]) || 0;
      if (!byCabang[cabang]) byCabang[cabang] = { total: 0, count: 0 };
      byCabang[cabang].total += sumAIST;
      byCabang[cabang].count++;
    });

    var tsISO    = _gasNow();
    var toAppend = [];
    Object.keys(byCabang).forEach(function(cabang) {
      var d      = byCabang[cabang];
      var target = _SD_TARGET[cabang] || 0;
      var persen = target > 0 ? Math.round(d.total / target * 100) : 0;
      var status = persen >= 100 ? 'TERCAPAI' : (persen >= 80 ? 'MENDEKATI' : 'DI BAWAH TARGET');
      toAppend.push([tglStr, cabang, d.total, d.count, target, persen + '%', status, tsISO]);
    });

    if (toAppend.length > 0) {
      _gasWithLock(function() {
        var lastR = shRekap.getLastRow();
        shRekap.getRange(lastR + 1, 1, toAppend.length, 8).setValues(toAppend);
      });
      Logger.log('saldoDailyRekap: ' + toAppend.length + ' cabang direkap (' + tglStr + ')');
    }
  } catch (err) {
    _gasLogError('saldoDailyRekap', 'daily', err, {});
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ROUTER
// ══════════════════════════════════════════════════════════════════════════

/**
 * Route action Saldo Engine → fungsi handler.
 * Return null jika action bukan milik Saldo Engine.
 */
function routeSaldoEngine(action, params) {
  switch (action) {
    case 'saldoGetDriverBalance': return saldoGetDriverBalance(params);
    case 'saldoGetRekapCabang':  return saldoGetRekapCabang(params);
    default: return null;
  }
}

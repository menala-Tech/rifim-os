/**
 * RIFIM OS — RAOS Potongan Order Engine
 * Port dari file Batch 4 (Potongan Order) ke RIFIM OS
 *
 * FORMULA kolom I/J/K diambil VERBATIM dari Formula.txt (versi DOCK 2/3 — paling akurat):
 *   I = Potongan Kantor: IFS per cabang + offline surcharge 12%
 *   J = Hak Driver: Price - Potongan Kantor
 *   K = Status: "DONE"
 *
 * GAS menangani:
 *   - Auto-fill kolom A (Id Cabang) dan H (Nama Driver) dari Login ID
 *   - pindahkan data Input Potongan 1/2 → Database Potongan
 *
 * SETUP AWAL (jalankan SEKALI di GAS Editor):
 *   1. setupFormulasInputPotongan()  — inject ARRAYFORMULA ke kolom I, J, K
 *   2. setupTriggerPotonganOnEdit()  — pasang onEdit trigger
 *   3. Buat tombol di sheet → assign ke pindahDataKeDatabasePotongan()
 */

// Header: row 1, Note: row 2 → data mulai baris 3 (beda dari Batch yang mulai baris 2)
var _PT_DATA_START_ROW = 3;

// Kolom (1-based)
var _PT_COL = {
  ID_CABANG       : 1,  // A
  PRICE           : 2,  // B
  LOGIN_ID        : 3,  // C
  WAKTU_ORDER     : 4,  // D
  OFFLINE         : 5,  // E
  KODE_OPSIONAL   : 6,  // F
  PEMBANDING_PKU  : 7,  // G
  NAMA_DRIVER     : 8,  // H
  POTONGAN_KANTOR : 9,  // I  ← ARRAYFORMULA
  HAK_DRIVER      : 10, // J  ← ARRAYFORMULA
  STATUS          : 11, // K  ← ARRAYFORMULA
};

// Kolom Database Potongan (1-based)
var _DB_COL = {
  ID              : 1,  // A
  TANGGAL         : 2,  // B
  ID_CABANG       : 3,  // C
  LOGIN_ID        : 4,  // D
  NAMA_DRIVER     : 5,  // E
  PRICE           : 6,  // F
  KODE_ORDER      : 7,  // G
  TIPE_WAKTU      : 8,  // H
  OFFLINE         : 9,  // I
  POTONGAN_KANTOR : 10, // J
  HAK_DRIVER      : 11, // K
  SURCHARGE_OFFLINE: 12,// L
  TOTAL_POTONGAN  : 13, // M
  STATUS          : 14, // N
  CREATED_AT      : 15, // O
};

var _PT_SHEET_NAMES  = ['Input Potongan 1', 'Input Potongan 2'];
var _DB_POTONGAN_NAME = 'Database Potongan';

// ══════════════════════════════════════════════════════════════════
// 1. SETUP FORMULA — jalankan SEKALI
// ══════════════════════════════════════════════════════════════════

/**
 * Inject ARRAYFORMULA ke kolom I (Potongan Kantor), J (Hak Driver), K (Status).
 * Formula diambil verbatim dari Formula.txt versi INPUT DOCK 2/3.
 * Data mulai baris 3 (bukan 2) karena baris 2 adalah note.
 */
function setupFormulasInputPotongan() {
  var ss = SpreadsheetApp.openById(RAOS_SS_ID);

  _PT_SHEET_NAMES.forEach(function(sName) {
    var sheet = ss.getSheetByName(sName);
    if (!sheet) { Logger.log('⚠️  Sheet tidak ditemukan: ' + sName); return; }

    // ── Formula Potongan Kantor (I3) ─────────────────────────────
    // Port dari Formula.txt INPUT DOCK 2/3 — start row 3 (bukan 2)
    var formulaI = '=ARRAYFORMULA(IF(B' + _PT_DATA_START_ROW + ':B="","",IFS(' +
      'A' + _PT_DATA_START_ROW + ':A="ID Rifim Airport Balikpapan",25000,' +

      // Batam Airport: siang 07:00-18:30 + offline surcharge
      'A' + _PT_DATA_START_ROW + ':A="ID Rifim Airport Batam",' +
        'IF((MOD(D' + _PT_DATA_START_ROW + ':D,1)>=TIME(7,0,0))*(MOD(D' + _PT_DATA_START_ROW + ':D,1)<TIME(18,30,0)),' +
          'IF(B' + _PT_DATA_START_ROW + ':B>=70000,30000,25000),' +
          'IF(MOD(D' + _PT_DATA_START_ROW + ':D,1)>=TIME(18,30,0),25000,20000)' +
        ')' +
        '+IF(E' + _PT_DATA_START_ROW + ':E=TRUE,ROUND(B' + _PT_DATA_START_ROW + ':B*12%),0),' +

      // Manado: flat 25rb + offline
      'A' + _PT_DATA_START_ROW + ':A="ID Rifim Airport Manado",' +
        '25000+IF(E' + _PT_DATA_START_ROW + ':E=TRUE,ROUND(B' + _PT_DATA_START_ROW + ':B*12%),0),' +

      // Pekanbaru: kode 1/2/3 (tidak ada offline surcharge)
      'A' + _PT_DATA_START_ROW + ':A="ID Rifim Airport Pekanbaru",' +
        'IF(F' + _PT_DATA_START_ROW + ':F=1,35000,' +
          'IF(F' + _PT_DATA_START_ROW + ':F=3,20000,' +
            'IF(F' + _PT_DATA_START_ROW + ':F=2,35000+ROUND((G' + _PT_DATA_START_ROW + ':G-B' + _PT_DATA_START_ROW + ':B)*12%),0)' +
          ')' +
        '),' +

      // Jambi Airport: threshold 70rb + kode P/C + offline
      'A' + _PT_DATA_START_ROW + ':A="ID Rifim Airport Jambi",' +
        'IF(B' + _PT_DATA_START_ROW + ':B<70000,25000,' +
          'IF(LOWER(F' + _PT_DATA_START_ROW + ':F)="p",35000,25000)' +
        ')' +
        '+IF(E' + _PT_DATA_START_ROW + ':E=TRUE,ROUND(B' + _PT_DATA_START_ROW + ':B*12%),0),' +

      // Default (External / Makassar / tidak dikenal): 0
      'TRUE,0' +
    ')))';

    // ── Formula Hak Driver (J3) ──────────────────────────────────
    var formulaJ = '=ARRAYFORMULA(IF(B' + _PT_DATA_START_ROW + ':B="",' +
      '"",B' + _PT_DATA_START_ROW + ':B-I' + _PT_DATA_START_ROW + ':I))';

    // ── Formula Status (K3) ──────────────────────────────────────
    var formulaK = '=ARRAYFORMULA(IF(B' + _PT_DATA_START_ROW + ':B="","","DONE"))';

    // Inject ke cell header kolom (baris _PT_DATA_START_ROW = awal data)
    sheet.getRange(_PT_DATA_START_ROW, _PT_COL.POTONGAN_KANTOR).setFormula(formulaI);
    sheet.getRange(_PT_DATA_START_ROW, _PT_COL.HAK_DRIVER).setFormula(formulaJ);
    sheet.getRange(_PT_DATA_START_ROW, _PT_COL.STATUS).setFormula(formulaK);

    Logger.log('✅ ARRAYFORMULA diterapkan ke ' + sName + ' (I3, J3, K3)');
  });

  Logger.log('');
  Logger.log('Formula siap. Kolom I/J/K akan auto-hitung saat admin paste data di B/C/D/E/F/G.');
}

// ══════════════════════════════════════════════════════════════════
// 2. ON-EDIT TRIGGER — auto-fill Id Cabang & Nama Driver
// ══════════════════════════════════════════════════════════════════

/**
 * OnEdit handler — auto-fill A (Id Cabang) dan H (Nama Driver) dari C (Login ID).
 * Install via setupTriggerPotonganOnEdit().
 */
function onEditInputPotongan(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (_PT_SHEET_NAMES.indexOf(sheet.getName()) === -1) return;
  var row = e.range.getRow();
  var col = e.range.getColumn();
  if (row < _PT_DATA_START_ROW) return;
  // Hanya trigger saat Login ID (C) diubah
  if (col !== _PT_COL.LOGIN_ID) return;

  var loginId = sheet.getRange(row, _PT_COL.LOGIN_ID).getValue();
  if (!loginId) {
    sheet.getRange(row, _PT_COL.ID_CABANG).clearContent();
    sheet.getRange(row, _PT_COL.NAMA_DRIVER).clearContent();
    return;
  }

  var driver = _cariDriverByLoginId(loginId.toString().trim());
  if (driver) {
    sheet.getRange(row, _PT_COL.ID_CABANG).setValue(driver.idCabang);
    sheet.getRange(row, _PT_COL.NAMA_DRIVER).setValue(driver.nama);
  } else {
    sheet.getRange(row, _PT_COL.ID_CABANG).setValue('TIDAK DITEMUKAN');
    sheet.getRange(row, _PT_COL.NAMA_DRIVER).setValue('TIDAK DITEMUKAN');
  }
}

/**
 * Cari driver dari Login ID (ID Maxim) di sheet Database Driver Airport & External.
 * @returns {{ nama, idCabang } | null}
 */
function _cariDriverByLoginId(loginId) {
  var ss = SpreadsheetApp.openById(RAOS_SS_ID);

  // 1. Database Driver Airport (data mulai baris 3, kolom B=ID Driver, C=Nama, D=Cabang)
  var sheetA = ss.getSheetByName('Database Driver Airport');
  if (sheetA && sheetA.getLastRow() >= 3) {
    var rowsA = sheetA.getLastRow() - 2;
    var dataA = sheetA.getRange(3, 1, rowsA, 4).getValues();
    for (var i = 0; i < dataA.length; i++) {
      if (dataA[i][1].toString().trim() === loginId) {
        return { nama: dataA[i][2], idCabang: dataA[i][3] };
      }
    }
  }

  // 2. Database Driver External (kolom B=ID Driver, C=Nama Driver, D=Id Cabang)
  var sheetE = ss.getSheetByName('Database Driver External');
  if (sheetE && sheetE.getLastRow() >= 3) {
    var rowsE = sheetE.getLastRow() - 2;
    var dataE = sheetE.getRange(3, 1, rowsE, 4).getValues();
    for (var j = 0; j < dataE.length; j++) {
      if (dataE[j][1].toString().trim() === loginId) {
        return { nama: dataE[j][2], idCabang: dataE[j][3] };
      }
    }
  }

  return null;
}

// ══════════════════════════════════════════════════════════════════
// 3. PINDAH DATA — Input Potongan 1/2 → Database Potongan
// ══════════════════════════════════════════════════════════════════

/**
 * Port dari kode.gs pindahData() — Batch 4 Potongan Order.
 * Pindah baris dari sheet aktif (Input Potongan 1 atau 2) ke Database Potongan.
 *
 * Perbedaan dari original Batch:
 *   - Sumber: Input Potongan 1/2, data mulai row 3 (bukan row 2)
 *   - Tujuan: sheet "Database Potongan" (bukan "MASTER DATA ALL")
 *   - Kolom tambahan di Database: Tipe Waktu, Surcharge Offline, Total Potongan, Created At
 *   - Cooldown: 60 detik (sama dengan original)
 *
 * Assign fungsi ini ke tombol "Pindahkan ke Database" di sheet Input Potongan 1 & 2.
 */
function pindahDataKeDatabasePotongan() {
  // ── Cooldown 60 detik (cegah double-klik) ─────────────────────
  var cache      = CacheService.getScriptCache();
  var cacheKey   = 'cooldown_pindahPotongan';
  if (cache.get(cacheKey) != null) {
    SpreadsheetApp.getUi().alert(
      'Mohon tunggu sekitar 60 detik sebelum memindahkan data kembali\nuntuk mencegah double input.');
    return;
  }
  cache.put(cacheKey, 'true', 60);

  var ss         = SpreadsheetApp.getActiveSpreadsheet();
  var sheetInput = ss.getActiveSheet();
  var sheetName  = sheetInput.getName();

  // ── Validasi sheet aktif ───────────────────────────────────────
  if (_PT_SHEET_NAMES.indexOf(sheetName) === -1) {
    SpreadsheetApp.getUi().alert(
      'Harap jalankan tombol ini dari sheet "Input Potongan 1" atau "Input Potongan 2".');
    cache.remove(cacheKey);
    return;
  }

  var sheetDB = ss.getSheetByName(_DB_POTONGAN_NAME);
  if (!sheetDB) {
    SpreadsheetApp.getUi().alert('Sheet "' + _DB_POTONGAN_NAME + '" tidak ditemukan. Jalankan setupRaosSheets() dulu.');
    cache.remove(cacheKey);
    return;
  }

  // ── Ambil data dan formula dari baris 3 ke bawah ──────────────
  var lastRow   = sheetInput.getLastRow();
  if (lastRow < _PT_DATA_START_ROW) {
    SpreadsheetApp.getUi().alert('Data kosong.');
    cache.remove(cacheKey);
    return;
  }

  var numRows    = lastRow - _PT_DATA_START_ROW + 1;
  var rangeInput = sheetInput.getRange(_PT_DATA_START_ROW, 1, numRows, 11); // A:K
  var data       = rangeInput.getValues();
  var formulas   = rangeInput.getFormulas();

  // ── Bangun baris untuk Database Potongan ──────────────────────
  var toAppend  = [];
  var timestamp = new Date();
  var lastIdRow = sheetDB.getLastRow();

  // Hitung ID terakhir di Database Potongan untuk generate ID baru
  var lastIdNum = 0;
  if (lastIdRow >= 3) {
    var lastIdVal = sheetDB.getRange(lastIdRow, _DB_COL.ID).getValue().toString();
    var match = lastIdVal.match(/(\d+)$/);
    if (match) lastIdNum = parseInt(match[1]);
  }

  for (var i = 0; i < data.length; i++) {
    var row = data[i];

    // Patokan: Id Cabang (kolom A) tidak kosong
    var idCabang = row[_PT_COL.ID_CABANG - 1]; // A
    if (!idCabang || idCabang === '') continue;

    var price          = row[_PT_COL.PRICE - 1];           // B
    var loginId        = row[_PT_COL.LOGIN_ID - 1];        // C
    var waktuOrder     = row[_PT_COL.WAKTU_ORDER - 1];     // D
    var offline        = row[_PT_COL.OFFLINE - 1];         // E (boolean)
    var kodeOpsional   = row[_PT_COL.KODE_OPSIONAL - 1];  // F
    var namaDriver     = row[_PT_COL.NAMA_DRIVER - 1];     // H
    var potonganKantor = row[_PT_COL.POTONGAN_KANTOR - 1]; // I
    var hakDriver      = row[_PT_COL.HAK_DRIVER - 1];      // J

    var surchargeOffline = (offline === true) ? Math.round(Number(price) * 0.12) : 0;
    var tipeWaktu        = _tipeWaktu(waktuOrder);

    lastIdNum++;
    var newId = 'POT-' + ('0000' + lastIdNum).slice(-4);

    toAppend.push([
      newId,             // A: ID
      waktuOrder,        // B: Tanggal (Waktu Order dari AIST)
      idCabang,          // C: Id Cabang
      loginId,           // D: Login ID
      namaDriver,        // E: Nama Driver
      price,             // F: Price
      kodeOpsional,      // G: Kode Order (Kode Opsional dari Input Potongan)
      tipeWaktu,         // H: Tipe Waktu (SIANG/MALAM/DINI)
      offline,           // I: Offline
      potonganKantor,    // J: Potongan Kantor
      hakDriver,         // K: Hak Driver
      surchargeOffline,  // L: Surcharge Offline (price × 12% jika offline)
      potonganKantor,    // M: Total Potongan (sudah termasuk surcharge)
      'DONE',            // N: Status
      timestamp,         // O: Created At
    ]);
  }

  if (toAppend.length === 0) {
    SpreadsheetApp.getUi().alert(
      'Data kosong. Pastikan kolom Id Cabang terisi sebelum memindahkan data.');
    cache.remove(cacheKey);
    return;
  }

  // ── Append ke Database Potongan ───────────────────────────────
  var dbLastRow = sheetDB.getLastRow();
  sheetDB.getRange(
    dbLastRow + 1, 1, toAppend.length, toAppend[0].length
  ).setValues(toAppend);

  // ── Bersihkan Input Potongan (hanya sel manual, bukan formula) ─
  // Port dari kode.gs: hanya hapus sel yang tidak punya rumus
  for (var r = 0; r < data.length; r++) {
    if (!data[r][_PT_COL.ID_CABANG - 1]) continue; // Baris kosong, skip

    for (var c = 0; c < data[r].length; c++) {
      var colNum  = c + 1;
      var formula = formulas[r][c];

      // Kolom yang auto-filled GAS (A, H) atau ARRAYFORMULA (I, J, K): skip
      if (formula !== '') continue;

      var cell = sheetInput.getRange(r + _PT_DATA_START_ROW, colNum);

      // Checkbox (Offline?) → reset ke FALSE
      if (typeof data[r][c] === 'boolean') {
        cell.setValue(false);
      } else {
        cell.clearContent();
      }
    }

    // Kolom A (Id Cabang) dan H (Nama Driver) diisi GAS bukan formula
    // → harus dibersihkan manual
    sheetInput.getRange(r + _PT_DATA_START_ROW, _PT_COL.ID_CABANG).clearContent();
    sheetInput.getRange(r + _PT_DATA_START_ROW, _PT_COL.NAMA_DRIVER).clearContent();
  }

  SpreadsheetApp.getUi().alert(
    '✅ Berhasil memindahkan ' + toAppend.length + ' baris ke "' + _DB_POTONGAN_NAME + '"!');
}

// ══════════════════════════════════════════════════════════════════
// 4. HAPUS DATA BULAN SEBELUMNYA — Database Potongan
// ══════════════════════════════════════════════════════════════════

/**
 * Port dari kode.gs hapusDataBulanSebelumnya().
 * Hapus baris di Database Potongan yang Waktu Order-nya bulan lalu.
 * Biasanya dijalankan awal bulan untuk arsip.
 */
function hapusPotonganBulanSebelumnya() {
  var ss    = SpreadsheetApp.openById(RAOS_SS_ID);
  var sheet = ss.getSheetByName(_DB_POTONGAN_NAME);
  if (!sheet) { Logger.log('Sheet tidak ditemukan: ' + _DB_POTONGAN_NAME); return; }

  var data         = sheet.getDataRange().getValues();
  var dateNow      = new Date();
  var currentMonth = dateNow.getMonth();
  var currentYear  = dateNow.getFullYear();
  var prevMonth    = currentMonth - 1;
  var prevYear     = currentYear;
  if (prevMonth < 0) { prevMonth = 11; prevYear--; }

  var rowsDeleted = 0;
  for (var i = data.length - 1; i >= 2; i--) { // Skip header (row 1) dan note (row 2)
    var waktu   = data[i][_DB_COL.TANGGAL - 1]; // Kolom B
    var rowDate = null;
    if (waktu instanceof Date) {
      rowDate = waktu;
    } else if (typeof waktu === 'string' && waktu.trim() !== '') {
      rowDate = new Date(waktu);
    }
    if (rowDate && !isNaN(rowDate.getTime())) {
      if (rowDate.getMonth() === prevMonth && rowDate.getFullYear() === prevYear) {
        sheet.deleteRow(i + 1);
        rowsDeleted++;
      }
    }
  }
  Logger.log('✅ Selesai: ' + rowsDeleted + ' baris bulan lalu dihapus dari ' + _DB_POTONGAN_NAME);
}

// ══════════════════════════════════════════════════════════════════
// 5. HELPER — Tipe Waktu
// ══════════════════════════════════════════════════════════════════

/**
 * Hitung tipe waktu dari waktu order (sama dengan TIME() di spreadsheet).
 * SIANG : 07:00 – 18:29
 * MALAM : 18:30 – 23:59
 * DINI  : 00:00 – 06:59
 */
function _tipeWaktu(waktuVal) {
  var jam = -1, menit = 0;

  if (waktuVal instanceof Date) {
    jam   = waktuVal.getHours();
    menit = waktuVal.getMinutes();
  } else if (typeof waktuVal === 'number') {
    // Google Sheets serial date: fractional part = time-of-day
    var frac   = waktuVal % 1;
    var totalS = Math.round(frac * 86400);
    jam   = Math.floor(totalS / 3600);
    menit = Math.floor((totalS % 3600) / 60);
  } else if (typeof waktuVal === 'string' && waktuVal) {
    var hm = waktuVal.match(/(\d{1,2}):(\d{2})/);
    if (hm) { jam = parseInt(hm[1]); menit = parseInt(hm[2]); }
  }

  if (jam < 0) return 'SIANG'; // default jika tidak bisa parse
  var total = jam * 60 + menit;
  if (total < 7 * 60)          return 'DINI';
  if (total < 18 * 60 + 30)   return 'SIANG';
  return 'MALAM';
}

// ══════════════════════════════════════════════════════════════════
// 6. TRIGGER SETUP & TEST
// ══════════════════════════════════════════════════════════════════

/**
 * Pasang onEdit trigger untuk auto-fill Id Cabang & Nama Driver.
 * Jalankan SEKALI di GAS Editor.
 */
function setupTriggerPotonganOnEdit() {
  var ss       = SpreadsheetApp.openById(RAOS_SS_ID);
  var triggers = ScriptApp.getUserTriggers(ss);

  // Hapus trigger lama jika ada
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === 'onEditInputPotongan') {
      ScriptApp.deleteTrigger(t);
      Logger.log('🗑️  Trigger lama dihapus: onEditInputPotongan');
    }
  });

  ScriptApp.newTrigger('onEditInputPotongan')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  Logger.log('✅ Trigger onEditInputPotongan terpasang.');
  Logger.log('   Aktif di: ' + _PT_SHEET_NAMES.join(', '));
  Logger.log('   Fungsi: Auto-fill Id Cabang & Nama Driver saat Login ID diinput.');
}

/**
 * Test kalkulasi tipe waktu — verifikasi logika TIME() spreadsheet.
 */
function testTipeWaktu() {
  var cases = [
    ['06:59', 'DINI'],
    ['07:00', 'SIANG'],
    ['18:29', 'SIANG'],
    ['18:30', 'MALAM'],
    ['23:59', 'MALAM'],
    ['00:00', 'DINI'],
  ];
  cases.forEach(function(c) {
    var result = _tipeWaktu(c[0]);
    Logger.log((result === c[1] ? '✅' : '❌') + ' ' + c[0] + ' → ' + result + ' (expected: ' + c[1] + ')');
  });
}

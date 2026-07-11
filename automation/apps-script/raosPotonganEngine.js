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
// 1. SETUP — jalankan SEKALI
// ══════════════════════════════════════════════════════════════════

/**
 * Setup Input Potongan 1 & 2:
 *   - Hapus ARRAYFORMULA lama di I/J/K (sekarang dihitung langsung oleh GAS script)
 *   - Pasang checkbox validation di kolom E (Offline?)
 *   - Recalculate I/J/K untuk data yang sudah ada di sheet
 *
 * Jalankan SEKALI dari menu Setup atau GAS Editor.
 */
function setupFormulasInputPotongan() {
  var ss = SpreadsheetApp.openById(RAOS_SS_ID);

  _PT_SHEET_NAMES.forEach(function(sName) {
    var sheet = ss.getSheetByName(sName);
    if (!sheet) { Logger.log('⚠️  Sheet tidak ditemukan: ' + sName); return; }

    var lastRow = Math.max(sheet.getLastRow(), _PT_DATA_START_ROW);

    // 1. Bersihkan ARRAYFORMULA lama di I3, J3, K3
    sheet.getRange(_PT_DATA_START_ROW, _PT_COL.POTONGAN_KANTOR).clearContent();
    sheet.getRange(_PT_DATA_START_ROW, _PT_COL.HAK_DRIVER).clearContent();
    sheet.getRange(_PT_DATA_START_ROW, _PT_COL.STATUS).clearContent();

    // 2. Pasang checkbox validation ke kolom E (Offline?) — baris 3 sampai 1000
    var checkRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
    sheet.getRange(_PT_DATA_START_ROW, _PT_COL.OFFLINE, 1000, 1).setDataValidation(checkRule);

    // 3. Recalculate I/J/K untuk data yang sudah ada
    if (lastRow >= _PT_DATA_START_ROW) {
      var numRows = lastRow - _PT_DATA_START_ROW + 1;
      var data    = sheet.getRange(_PT_DATA_START_ROW, 1, numRows, _PT_COL.NAMA_DRIVER).getValues();
      for (var i = 0; i < data.length; i++) {
        var idCabang = data[i][_PT_COL.ID_CABANG - 1];
        var price    = data[i][_PT_COL.PRICE - 1];
        if (!idCabang || !price) continue;
        _updatePotonganRow(sheet, _PT_DATA_START_ROW + i);
      }
    }

    Logger.log('✅ Setup selesai: ' + sName);
    Logger.log('   - Kolom E (Offline?): checkbox terpasang (baris 3–1002)');
    Logger.log('   - Kolom I/J/K: kalkulasi via GAS script (bukan ARRAYFORMULA)');
  });

  Logger.log('');
  Logger.log('Potongan Kantor (I) + Hak Driver (J) dihitung otomatis oleh onEditInputPotongan()');
  Logger.log('saat admin paste B/C/D atau centang/hapus centang Offline (E).');
}

// ══════════════════════════════════════════════════════════════════
// 1b. KALKULASI POTONGAN KANTOR — sesuai Batch 4 config per cabang
// ══════════════════════════════════════════════════════════════════

/**
 * Hitung Potongan Kantor sesuai aturan per cabang (port dari Batch 4 / Formula.txt).
 *
 * Aturan:
 *   Balikpapan : flat 25.000
 *   Batam      : SIANG (07:00–18:29) → 30rb jika price≥70rb, else 25rb
 *                MALAM (18:30–23:59) → 25rb
 *                DINI  (00:00–06:59) → 20rb
 *                + offline surcharge ROUND(price × 12%) jika offline
 *   Manado     : flat 25.000 + offline surcharge jika offline
 *   Pekanbaru  : kode 1 → 35rb | kode 3 → 20rb
 *                kode 2 → 35rb + ROUND((pembanding - price) × 12%)
 *   Jambi      : price < 70rb → 25rb
 *                price ≥ 70rb + kode "p" → 35rb | kode lain → 25rb
 *                + offline surcharge jika offline
 *   Lainnya    : 0 (External / non-airport)
 *
 * @param {string} idCabang
 * @param {number} price
 * @param {Date}   waktuOrder   — harus Date object (sudah dikonversi dari AIST string)
 * @param {boolean} offline
 * @param {*}      kodeOpsional — number (Pekanbaru) atau string "p" (Jambi)
 * @param {number} pembandingPKU — khusus Pekanbaru kode 2
 * @returns {number} Potongan Kantor (sudah termasuk surcharge jika offline)
 */
function _hitungPotonganKantor(idCabang, price, waktuOrder, offline, kodeOpsional, pembandingPKU) {
  price = Number(price) || 0;
  if (!price) return 0;

  idCabang = String(idCabang || '').trim();
  var potongan = 0;

  if (idCabang === 'ID Rifim Airport Balikpapan') {
    potongan = 25000;

  } else if (idCabang === 'ID Rifim Airport Batam') {
    var jam = -1, menit = 0;
    if (waktuOrder instanceof Date && !isNaN(waktuOrder.getTime())) {
      jam   = waktuOrder.getHours();
      menit = waktuOrder.getMinutes();
    }
    var totalMenit = jam * 60 + menit;
    if (jam < 0 || (totalMenit >= 7 * 60 && totalMenit < 18 * 60 + 30)) {
      // SIANG (default jika jam tidak diketahui)
      potongan = (price >= 70000) ? 30000 : 25000;
    } else if (totalMenit >= 18 * 60 + 30) {
      // MALAM
      potongan = 25000;
    } else {
      // DINI (00:00–06:59)
      potongan = 20000;
    }
    if (offline === true) potongan += Math.round(price * 0.12);

  } else if (idCabang === 'ID Rifim Airport Manado') {
    potongan = 25000;
    if (offline === true) potongan += Math.round(price * 0.12);

  } else if (idCabang === 'ID Rifim Airport Pekanbaru') {
    var kode = Number(kodeOpsional);
    if      (kode === 1) potongan = 35000;
    else if (kode === 3) potongan = 20000;
    else if (kode === 2) potongan = 35000 + Math.round((Number(pembandingPKU) - price) * 0.12);
    else                 potongan = 0;

  } else if (idCabang === 'ID Rifim Airport Jambi') {
    potongan = (price < 70000) ? 25000
             : (String(kodeOpsional).toLowerCase() === 'p' ? 35000 : 25000);
    if (offline === true) potongan += Math.round(price * 0.12);
  }
  // ID Rifim Batam / ID Rifim Jambi Luar (External) → 0

  return potongan;
}

/**
 * Baca nilai baris tertentu di Input Potongan, hitung I/J/K, dan tulis balik ke sheet.
 * Dipanggil dari onEditInputPotongan() dan setupFormulasInputPotongan().
 */
function _updatePotonganRow(sheet, row) {
  var idCabang      = sheet.getRange(row, _PT_COL.ID_CABANG).getValue();
  var price         = sheet.getRange(row, _PT_COL.PRICE).getValue();
  var waktuOrder    = sheet.getRange(row, _PT_COL.WAKTU_ORDER).getValue();
  var offline       = sheet.getRange(row, _PT_COL.OFFLINE).getValue();
  var kodeOpsional  = sheet.getRange(row, _PT_COL.KODE_OPSIONAL).getValue();
  var pembandingPKU = sheet.getRange(row, _PT_COL.PEMBANDING_PKU).getValue();

  if (!price || !idCabang || idCabang === 'TIDAK DITEMUKAN') return;

  var potonganKantor = _hitungPotonganKantor(
    idCabang, price, waktuOrder, offline, kodeOpsional, pembandingPKU
  );
  var hakDriver = Number(price) - potonganKantor;

  sheet.getRange(row, _PT_COL.POTONGAN_KANTOR).setValue(potonganKantor);
  sheet.getRange(row, _PT_COL.HAK_DRIVER).setValue(hakDriver);
  sheet.getRange(row, _PT_COL.STATUS).setValue('DONE');
}

// ══════════════════════════════════════════════════════════════════
// 2. ON-EDIT TRIGGER — auto-fill Id Cabang & Nama Driver
// ══════════════════════════════════════════════════════════════════

/**
 * OnEdit handler — dipanggil oleh trigger tiap kali ada edit di spreadsheet.
 *
 * Skenario yang di-handle:
 *   A) Admin paste B/C/D (atau hanya C) → range mencakup col C (Login ID)
 *      - Auto-fill A (Id Cabang) + H (Nama Driver) dari Login ID
 *      - Auto-konversi D (Waktu Order) dari string AIST "dd.MM.yyyy HH:mm" ke Date object
 *      - Hitung I (Potongan Kantor) + J (Hak Driver) + K (Status) via _hitungPotonganKantor()
 *
 *   B) Admin centang/hapus centang E (Offline?) — col 5 saja
 *      - Recalculate I/J/K saja (A dan H sudah terisi sebelumnya)
 *
 * Mendukung paste multi-baris (B3:D10). Install via setupTriggerPotonganOnEdit().
 */
function onEditInputPotongan(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (_PT_SHEET_NAMES.indexOf(sheet.getName()) === -1) return;

  var startRow = e.range.getRow();
  var startCol = e.range.getColumn();
  var endCol   = startCol + e.range.getNumColumns() - 1;
  var endRow   = startRow + e.range.getNumRows() - 1;

  // Skenario A: paste/edit mencakup col C (Login ID) — start ≤ C ≤ end
  var termasukLoginId = (startCol <= _PT_COL.LOGIN_ID && endCol >= _PT_COL.LOGIN_ID);
  // Skenario B: toggle col E (Offline?) saja
  var isOfflineToggle = (startCol === _PT_COL.OFFLINE && endCol === _PT_COL.OFFLINE);

  if (!termasukLoginId && !isOfflineToggle) return;

  var firstDataRow = Math.max(startRow, _PT_DATA_START_ROW);
  if (firstDataRow > endRow) return;

  for (var row = firstDataRow; row <= endRow; row++) {

    if (termasukLoginId) {
      var loginId = sheet.getRange(row, _PT_COL.LOGIN_ID).getValue();
      if (!loginId || loginId.toString().trim() === '') {
        sheet.getRange(row, _PT_COL.ID_CABANG).clearContent();
        sheet.getRange(row, _PT_COL.NAMA_DRIVER).clearContent();
        sheet.getRange(row, _PT_COL.POTONGAN_KANTOR).clearContent();
        sheet.getRange(row, _PT_COL.HAK_DRIVER).clearContent();
        sheet.getRange(row, _PT_COL.STATUS).clearContent();
        continue;
      }

      // Fill A (Id Cabang) + H (Nama Driver) dari lookup Database Driver
      var driver = _cariDriverByLoginId(loginId.toString().trim());
      if (driver) {
        sheet.getRange(row, _PT_COL.ID_CABANG).setValue(driver.idCabang);
        sheet.getRange(row, _PT_COL.NAMA_DRIVER).setValue(driver.nama);
      } else {
        sheet.getRange(row, _PT_COL.ID_CABANG).setValue('TIDAK DITEMUKAN');
        sheet.getRange(row, _PT_COL.NAMA_DRIVER).setValue('TIDAK DITEMUKAN');
      }

      // Konversi D (Waktu Order) dari string AIST "11.07.2026 18:40" → Date object
      // Agar _hitungPotonganKantor() bisa baca jam untuk Batam SIANG/MALAM/DINI
      var dCell = sheet.getRange(row, _PT_COL.WAKTU_ORDER);
      var dRaw  = dCell.getValue();
      if (typeof dRaw === 'string' && dRaw.trim()) {
        var dParsed = _parseAISTDate(dRaw);
        if (dParsed instanceof Date && !isNaN(dParsed.getTime())) {
          dCell.setValue(dParsed);
        }
      }
    }

    // Hitung Potongan Kantor, Hak Driver, Status (skenario A dan B)
    _updatePotonganRow(sheet, row);
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
 * Wrapper public — dipanggil dari MENU (bukan tombol di sheet).
 * Eksplisit pilih Input Potongan 1.
 */
function pindahDataInputPotongan1() {
  _pindahDataPotonganByName('Input Potongan 1');
}

/**
 * Wrapper public — dipanggil dari MENU (bukan tombol di sheet).
 * Eksplisit pilih Input Potongan 2.
 */
function pindahDataInputPotongan2() {
  _pindahDataPotonganByName('Input Potongan 2');
}

/**
 * Port dari kode.gs pindahData() — Batch 4 Potongan Order.
 * Dipanggil dari tombol di sheet (pakai active sheet) atau dari menu via wrapper di atas.
 * Untuk tombol di sheet: assign ke pindahDataKeDatabasePotongan().
 */
function pindahDataKeDatabasePotongan() {
  var ss        = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = ss.getActiveSheet().getName();
  if (_PT_SHEET_NAMES.indexOf(sheetName) === -1) {
    SpreadsheetApp.getUi().alert(
      'Harap jalankan dari sheet "Input Potongan 1" atau "Input Potongan 2".');
    return;
  }
  _pindahDataPotonganByName(sheetName);
}

/**
 * Core logic pindah data potongan.
 * @param {string} sheetName - 'Input Potongan 1' atau 'Input Potongan 2'
 */
function _pindahDataPotonganByName(sheetName) {
  // ── Guard cooldown (cek dulu, SET setelah berhasil) ───────────
  var cache    = CacheService.getScriptCache();
  var cacheKey = 'cooldown_pindahPotongan_' + sheetName.replace(/\s/g, '_');
  if (cache.get(cacheKey) != null) {
    SpreadsheetApp.getUi().alert(
      'Mohon tunggu sekitar 60 detik sebelum memindahkan data kembali\nuntuk mencegah double input.');
    return;
  }

  var ss         = SpreadsheetApp.openById(RAOS_SS_ID);
  var sheetInput = ss.getSheetByName(sheetName);
  if (!sheetInput) {
    SpreadsheetApp.getUi().alert('Sheet "' + sheetName + '" tidak ditemukan.');
    return;
  }

  var sheetDB = ss.getSheetByName(_DB_POTONGAN_NAME);
  if (!sheetDB) {
    SpreadsheetApp.getUi().alert('Sheet "' + _DB_POTONGAN_NAME + '" tidak ditemukan. Jalankan setupRaosSheets() dulu.');
    return;
  }

  // ── Ambil data dan formula dari baris 3 ke bawah ──────────────
  var lastRow   = sheetInput.getLastRow();
  if (lastRow < _PT_DATA_START_ROW) {
    SpreadsheetApp.getUi().alert('Data kosong.');
    return;
  }

  var numRows    = lastRow - _PT_DATA_START_ROW + 1;
  var rangeInput = sheetInput.getRange(_PT_DATA_START_ROW, 1, numRows, 11); // A:K
  var data       = rangeInput.getValues();
  var formulas   = rangeInput.getFormulas();

  // ── Bangun baris untuk Database Potongan ──────────────────────
  var toAppend   = [];
  var tsStr      = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
  var adminEmail = Session.getActiveUser().getEmail();
  var lastIdRow  = sheetDB.getLastRow();

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
    // WAKTU_ORDER dari AIST: "11.07.2026 18:40" (string dd.MM.yyyy HH:mm tanpa detik)
    var waktuOrderRaw  = row[_PT_COL.WAKTU_ORDER - 1];    // D
    var waktuOrder     = _parseAISTDate(waktuOrderRaw);    // → Date object jika bisa
    var offline        = row[_PT_COL.OFFLINE - 1];         // E (boolean checkbox)
    var kodeOpsional   = row[_PT_COL.KODE_OPSIONAL - 1];  // F
    var pembandingPKU  = row[_PT_COL.PEMBANDING_PKU - 1]; // G
    var namaDriver     = row[_PT_COL.NAMA_DRIVER - 1];     // H
    var potonganKantor = row[_PT_COL.POTONGAN_KANTOR - 1]; // I (diisi oleh onEditInputPotongan)
    var hakDriver      = row[_PT_COL.HAK_DRIVER - 1];      // J (diisi oleh onEditInputPotongan)

    // Fallback: hitung ulang jika onEdit belum sempat mengisi I/J
    if (!potonganKantor || potonganKantor === '') {
      potonganKantor = _hitungPotonganKantor(idCabang, price, waktuOrder, offline, kodeOpsional, pembandingPKU);
      hakDriver = Number(price) - potonganKantor;
    }

    var surchargeOffline = (offline === true) ? Math.round(Number(price) * 0.12) : 0;
    var tipeWaktu        = _tipeWaktu(waktuOrder); // _tipeWaktu() handle Date, number, dan string

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
      tsStr,             // O: Created At
    ]);
  }

  if (toAppend.length === 0) {
    SpreadsheetApp.getUi().alert(
      'Data kosong. Pastikan kolom Id Cabang terisi sebelum memindahkan data.');
    return;
  }

  // ── Append ke Database Potongan ───────────────────────────────
  var dbLastRow = sheetDB.getLastRow();
  sheetDB.getRange(
    dbLastRow + 1, 1, toAppend.length, toAppend[0].length
  ).setValues(toAppend);

  // ── Cooldown SETELAH berhasil — pola Ops sistem final.gs ──────
  cache.put(cacheKey, 'true', 60);

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
    '✅ BERHASIL!\n\nBaris: ' + toAppend.length +
    '\nSheet: ' + sheetName +
    '\nWaktu: ' + tsStr +
    '\nAdmin: ' + adminEmail);
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
    var parsed  = _parseAISTDate(waktu);
    var rowDate = (parsed instanceof Date && !isNaN(parsed.getTime())) ? parsed : null;
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
// 5. HELPER — Date Parser & Tipe Waktu
// ══════════════════════════════════════════════════════════════════

/**
 * Parse format tanggal dari AIST ke Date object.
 * Handle semua format yang muncul di paste AIST:
 *   "11.07.2026 18:40"       → dd.MM.yyyy HH:mm  (Input Potongan col D, tanpa detik)
 *   "11.07.2026 21:40:26"    → dd.MM.yyyy HH:mm:ss (Form Input Saldo AIST col A, dengan detik)
 *   "07/11/2026 18:40:00"    → MM/dd/yyyy (varian US, kalau ada)
 * Jika raw sudah Date atau tidak bisa diparse → kembalikan raw.
 * Dipanggil dari raosPotonganEngine.js dan raosMenuEngine.js (shared GAS scope).
 */
function _parseAISTDate(raw) {
  if (!raw) return raw;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? raw : raw;
  var s = String(raw).trim();
  // dd.MM.yyyy HH:mm:ss atau dd.MM.yyyy HH:mm (separator titik)
  var m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0));
  // dd/MM/yyyy HH:mm:ss atau dd/MM/yyyy HH:mm (separator slash, format GAS)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0));
  // dd-MM-yyyy HH:mm:ss atau dd-MM-yyyy HH:mm (separator strip)
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0));
  return raw; // kembalikan original jika tidak ada yang match
}

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

/**
 * RIFIM OS — Custom Menu Google Sheets
 *
 * Dua menu di toolbar:
 *   🚛 RIFIM OS  → operasi data (Potongan, Saldo AIST, Setup)
 *   📄 PDF & WA  → generate laporan, export PDF, kirim WA/Email
 *
 * onOpen() dipanggil otomatis oleh GAS saat spreadsheet dibuka.
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();

  // ─────────────────────────────────────────────────────────────
  // Menu 1: RIFIM OS (operasi data)
  // ─────────────────────────────────────────────────────────────
  ui.createMenu('🚛 RIFIM OS')

    // ─ HRIS Staff ────────────────────────────────────────────────
    .addSubMenu(
      ui.createMenu('👤 HRIS — Staff')
        .addItem('Proses Input Staff → Supabase',    'prosesInputStaff')
        .addSeparator()
        .addItem('Sync Staff dari Supabase → Sheet', 'syncStaffKeDatabaseStaff')
        .addSeparator()
        .addItem('Setup Sheet Input Staff',          'setupInputStaffSheet')
        .addItem('Setup Sheet Database Staff',       'setupDatabaseStaffSheet')
        .addItem('Setup Trigger Auto-Sync Staff',    'setupStaffSyncTrigger')
    )

    // ─ RAOS Driver ───────────────────────────────────────────────
    .addSubMenu(
      ui.createMenu('🚗 RAOS — Driver')
        .addItem('Proses Input Driver Airport',      'prosesInputDriverAirport')
        .addItem('Proses Input Driver External',     'prosesInputDriverExternal')
        .addSeparator()
        .addItem('Sync Driver dari Supabase → Sheet','syncDriversDariSupabase')
        .addSeparator()
        .addItem('⬆️ Import Driver (File → Supabase)','importDriversDariSheetKeSupabase')
        .addSeparator()
        .addItem('Setup Sheet Input Driver',         'setupDriverSheets')
        .addItem('Setup Trigger Auto-Sync Driver',   'setupDriverSyncTrigger')
    )

    .addSeparator()

    // ─ Potongan Order ────────────────────────────────────────────
    .addSubMenu(
      ui.createMenu('📦 Potongan Order')
        .addItem('Pindahkan dari Input Potongan 1 → Database', 'pindahDataInputPotongan1')
        .addItem('Pindahkan dari Input Potongan 2 → Database', 'pindahDataInputPotongan2')
        .addSeparator()
        .addItem('Hapus Data Potongan Bulan Sebelumnya',       'hapusPotonganBulanSebelumnya')
    )

    // ─ Saldo AIST ────────────────────────────────────────────────
    // Item "Ambil Data AIST", "Cek Status", "Reset Lock" hanya aktif
    // saat ops_AIST_RIFIM_OS.gs ditambahkan sementara ke project GAS.
    // Tanpa script itu → GAS menampilkan error "function not found" (normal).
    .addSubMenu(
      ui.createMenu('💳 Saldo AIST')
        .addItem('🤖 Ambil Data AIST',                'ambilDataAIST')    // temp: ops_AIST_RIFIM_OS.gs
        .addItem('📋 Cek Status (siapa sudah ambil?)', 'cekStatusLock')    // temp: ops_AIST_RIFIM_OS.gs
        .addItem('🔓 Reset Lock AIST',                'resetLockAIST')    // temp: ops_AIST_RIFIM_OS.gs
        .addSeparator()
        .addItem('Pindahkan Transaksi AIST → Database AIST', 'pindahTransaksiAISTKeDatabase')
        .addSeparator()
        .addItem('Hapus Transaksi AIST Bulan Sebelumnya',    'hapusTransaksiAISTBulanSebelumnya')
    )

    .addSeparator()

    // ─ Setup (admin) ─────────────────────────────────────────────
    .addSubMenu(
      ui.createMenu('⚙️ Setup')
        .addItem('Setup Semua RAOS Sheets',         'setupRaosSheets')
        .addItem('Verify RAOS Sheets',              'verifyRaosSheets')
        .addSeparator()
        .addItem('Setup Formula Input Potongan',    'setupFormulasInputPotongan')
        .addItem('Setup Trigger OnEdit Potongan',   'setupTriggerPotonganOnEdit')
        .addSeparator()
        .addItem('Setup Sheet Laporan Cabang',      'setupLaporanCabangSheet')
        .addItem('Setup Folder PDF Drive',          'setupLaporanFolder')
        .addSeparator()
        .addItem('Setup Sheet Monitoring',          'setupMonitoringSheets')
        .addItem('Setup Trigger Monitoring',        'setupMonitoringTriggers')
        .addItem('Setup Trigger OnEdit Saldo AIST', 'setupTriggerSaldoAISTOnEdit')
        .addSeparator()
        .addItem('Test Tipe Waktu',                 'testTipeWaktu')
        .addSeparator()
        .addItem('🖼️ Setup Logo Perusahaan',        'setupBrandingLogosUI')
        .addItem('🖼️ Test Insert Logo ke Sheet',    'testInsertLogo')
    )

    .addToUi();

  // ─────────────────────────────────────────────────────────────
  // Menu 3: Monitoring (dashboard real-time)
  // ─────────────────────────────────────────────────────────────
  ui.createMenu('📊 Monitoring')
    .addSubMenu(
      ui.createMenu('💳 Monitoring Saldo')
        .addItem('Refresh Dashboard Saldo',         'refreshMonitoringSaldo')
        .addItem('Cek SLA Saldo (Kirim WA)',        'cekSLASaldo')
        .addSeparator()
        .addItem('Test WA Saldo (semua grup)',      'testMonitoringSaldoWA')
    )
    .addSubMenu(
      ui.createMenu('📦 Monitoring Potongan')
        .addItem('Refresh Dashboard Potongan',      'refreshMonitoringPotongan')
        .addItem('Cek SLA Potongan (Kirim WA)',     'cekSLAPotongan')
        .addSeparator()
        .addItem('Test WA Potongan (semua grup)',   'testMonitoringPotonganWA')
    )
    .addToUi();

  // ─────────────────────────────────────────────────────────────
  // Menu 2: PDF & WA (laporan dan distribusi)
  // ─────────────────────────────────────────────────────────────
  ui.createMenu('📄 PDF & WA')
    .addItem('Generate Laporan Cabang',   'generateLaporanCabang')
    .addSeparator()
    .addItem('PDF → Simpan Drive',        'pdfSimpanKeDrive')
    .addItem('PDF → Kirim WA Grup',       'pdfKirimKeWAGrup')
    .addItem('PDF → Kirim Email',         'pdfKirimViaEmail')
    .addToUi();
}

// ══════════════════════════════════════════════════════════════════
// SETUP LOGO VIA UI (panggil dari menu)
// ══════════════════════════════════════════════════════════════════

/**
 * Dialog panduan setup logo — minta admin input Drive File ID satu per satu.
 * Dipanggil dari menu Setup → Setup Logo Perusahaan.
 */
function setupBrandingLogosUI() {
  var ui = SpreadsheetApp.getUi();

  ui.alert(
    '🖼️ Setup Logo Perusahaan',
    'Cara mendapatkan Drive File ID logo:\n\n' +
    '1. Upload file logo ke Google Drive\n' +
    '2. Klik kanan file → "Bagikan" → copy link\n' +
    '3. Ambil ID dari URL:\n' +
    '   drive.google.com/file/d/[FILE_ID]/view\n\n' +
    'Setelah dapat File ID, jalankan fungsi ini\n' +
    'dari GAS Editor:\n\n' +
    'setupBrandingLogos({\n' +
    '  rifim      : "ID_LOGO_RIFIM",\n' +
    '  menala     : "ID_LOGO_MENALA",\n' +
    '  lailan     : "ID_LOGO_LAILAN",\n' +
    '  maxim      : "ID_LOGO_MAXIM",\n' +
    '  rifimGroup : "ID_LOGO_GROUP",\n' +
    '  icon       : "ID_ICON",\n' +
    '})',
    ui.ButtonSet.OK
  );
}

// ══════════════════════════════════════════════════════════════════
// PINDAH TRANSAKSI AIST → DATABASE AIST
// ══════════════════════════════════════════════════════════════════

var _AIST_FORM_NAME = 'Form Input Saldo AIST';
var _AIST_DB_NAME   = 'Database AIST';

// Kolom Form Input Saldo AIST (1-based)
var _AIST_FORM_COL = {
  TANGGAL         : 1,  // A — paste dari AIST
  SUM             : 2,  // B — paste dari AIST (nominal AIST)
  CREDIT_ACCOUNT  : 3,  // C — paste dari AIST
  LOGIN_ID        : 4,  // D — paste dari AIST
  NOMINAL_TAGIHAN : 5,  // E — auto dari DB (nominal PWA)
  NAMA_DRIVER     : 6,  // F — auto dari DB Driver
  CABANG          : 7,  // G — auto dari DB Driver
  STATUS          : 8,  // H — auto status
};

// Kolom Database AIST (1-based)
var _AIST_DB_COL = {
  ID              : 1,  // A
  TANGGAL         : 2,  // B
  LOGIN_ID        : 3,  // C
  CREDIT_ACCOUNT  : 4,  // D
  NAMA_DRIVER     : 5,  // E
  CABANG          : 6,  // F
  NOMINAL_AIST    : 7,  // G — SUM dari AIST (yang tertulis di Credit Account)
  STATUS_MATCH    : 8,  // H — TRANSFERRED / MATCH / SELISIH dll
  CREATED_AT      : 9,  // I
};

var _AIST_DATA_START_ROW = 3; // baris 1=header, 2=note, 3+=data

/**
 * Pindahkan transaksi dari "Form Input Saldo AIST" ke "Database AIST".
 * Patokan baris valid: kolom A (Tanggal) tidak kosong — mengikuti pola Ops sistem final.gs.
 * Cooldown di-set SETELAH berhasil (bukan sebelum proses).
 */
function pindahTransaksiAISTKeDatabase() {
  // ── Guard cooldown (cek dulu, SET setelah berhasil) ───────────
  var cache    = CacheService.getScriptCache();
  var cacheKey = 'cooldown_pindahAIST';
  if (cache.get(cacheKey) != null) {
    SpreadsheetApp.getUi().alert(
      'Mohon tunggu sekitar 60 detik sebelum memindahkan transaksi kembali\nuntuk mencegah double input.');
    return;
  }

  var ss        = SpreadsheetApp.openById(RAOS_SS_ID);
  var sheetForm = ss.getSheetByName(_AIST_FORM_NAME);
  var sheetDB   = ss.getSheetByName(_AIST_DB_NAME);

  if (!sheetForm) {
    SpreadsheetApp.getUi().alert('Sheet "' + _AIST_FORM_NAME + '" tidak ditemukan.');
    return;
  }
  if (!sheetDB) {
    SpreadsheetApp.getUi().alert('Sheet "' + _AIST_DB_NAME + '" tidak ditemukan. Jalankan setupRaosSheets() dulu.');
    return;
  }

  var lastRow = sheetForm.getLastRow();
  if (lastRow < _AIST_DATA_START_ROW) {
    SpreadsheetApp.getUi().alert('Tidak ada data di "' + _AIST_FORM_NAME + '".');
    return;
  }

  // ── Ambil semua data form ──────────────────────────────────────
  var numRows = lastRow - _AIST_DATA_START_ROW + 1;
  var data    = sheetForm.getRange(_AIST_DATA_START_ROW, 1, numRows, 8).getValues();

  // ── Hitung ID terakhir di Database AIST ───────────────────────
  var lastIdNum = 0;
  var dbLastRow = sheetDB.getLastRow();
  if (dbLastRow >= _AIST_DATA_START_ROW) {
    var lastIdVal = sheetDB.getRange(dbLastRow, _AIST_DB_COL.ID).getValue().toString();
    var idMatch   = lastIdVal.match(/(\d+)$/);
    if (idMatch) lastIdNum = parseInt(idMatch[1]);
  }

  var toAppend   = [];
  var tsISO      = _gasNow(); // FIX #15 — ISO UTC untuk Created At (col I), bukan 'dd/MM/yyyy HH:mm:ss'
  var tsDisplay  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'); // hanya untuk alert dialog
  var adminEmail = Session.getActiveUser().getEmail();
  var rowsToClear = [];

  for (var i = 0; i < data.length; i++) {
    // Patokan: Tanggal (kolom A) tidak kosong — pola Ops sistem final.gs
    var tanggalRaw = data[i][_AIST_FORM_COL.TANGGAL - 1]; // A
    if (!tanggalRaw || tanggalRaw.toString().trim() === '') continue;
    // Tanggal AIST: "11.07.2026 21:40:26" (string dd.MM.yyyy HH:mm:ss) → Date object
    var tanggal = _parseAISTDate(tanggalRaw);

    // SUM bisa berupa number (dari ops_AIST_RIFIM_OS.gs) atau string "45 000" (manual paste)
    var sumRaw        = data[i][_AIST_FORM_COL.SUM - 1];
    var sum           = (typeof sumRaw === 'number')
                          ? sumRaw
                          : Number(String(sumRaw).replace(/\s+/g, '').replace(/[^0-9.-]/g, '')) || sumRaw;
    var creditAccount = data[i][_AIST_FORM_COL.CREDIT_ACCOUNT - 1]; // C
    var loginId       = data[i][_AIST_FORM_COL.LOGIN_ID - 1];       // D
    var namaDriver    = data[i][_AIST_FORM_COL.NAMA_DRIVER - 1];    // F (auto)
    var cabang        = data[i][_AIST_FORM_COL.CABANG - 1];         // G (auto)
    var status        = data[i][_AIST_FORM_COL.STATUS - 1];         // H (auto)

    lastIdNum++;
    var newId = 'AIST-' + ('0000' + lastIdNum).slice(-4);

    toAppend.push([
      newId,                             // A: ID
      tanggal,                           // B: Tanggal
      loginId ? loginId.toString().trim() : '', // C: Login ID
      creditAccount,                     // D: Credit Account
      namaDriver,                        // E: Nama Driver
      cabang,                            // F: Cabang
      sum,                               // G: Nominal AIST (SUM dari AIST)
      status || 'TRANSFERRED',           // H: Status Match
      tsISO,                             // I: Created At — ISO UTC (FIX #15)
    ]);

    rowsToClear.push(i);
  }

  if (toAppend.length === 0) {
    SpreadsheetApp.getUi().alert('Data kosong. Pastikan kolom Tanggal (A) terisi.');
    return;
  }

  // ── Append ke Database AIST (FIX #16 — ScriptLock anti concurrent admin click) ──
  _gasWithLock(function() {
    sheetDB.getRange(dbLastRow + 1, 1, toAppend.length, toAppend[0].length).setValues(toAppend);
  });

  // ── Cooldown SETELAH berhasil — pola Ops sistem final.gs ──────
  cache.put(cacheKey, 'true', 60);

  // ── Bersihkan kolom manual di form (A, B, C, D) ──────────────
  // Kolom E-H adalah auto-fill (formula/GAS) — ikut kosong saat A-D dikosongkan
  var manualCols = [
    _AIST_FORM_COL.TANGGAL,
    _AIST_FORM_COL.SUM,
    _AIST_FORM_COL.CREDIT_ACCOUNT,
    _AIST_FORM_COL.LOGIN_ID,
  ];

  rowsToClear.forEach(function(i) {
    var actualRow = i + _AIST_DATA_START_ROW;
    manualCols.forEach(function(col) {
      sheetForm.getRange(actualRow, col).clearContent();
    });
  });

  SpreadsheetApp.getUi().alert(
    '✅ BERHASIL!\n\nBaris: ' + toAppend.length +
    '\nWaktu: ' + tsDisplay +
    '\nAdmin: ' + adminEmail);
}

/**
 * Hapus transaksi AIST di Database AIST yang tanggalnya bulan lalu.
 */
function hapusTransaksiAISTBulanSebelumnya() {
  var ss    = SpreadsheetApp.openById(RAOS_SS_ID);
  var sheet = ss.getSheetByName(_AIST_DB_NAME);
  if (!sheet) { SpreadsheetApp.getUi().alert('Sheet "' + _AIST_DB_NAME + '" tidak ditemukan.'); return; }

  var data         = sheet.getDataRange().getValues();
  var now          = new Date();
  var prevMonth    = now.getMonth() - 1;
  var prevYear     = now.getFullYear();
  if (prevMonth < 0) { prevMonth = 11; prevYear--; }

  var rowsDeleted = 0;
  for (var i = data.length - 1; i >= 2; i--) {
    var tgl     = data[i][_AIST_DB_COL.TANGGAL - 1];
    var parsed  = _parseAISTDate(tgl);
    var rowDate = (parsed instanceof Date && !isNaN(parsed.getTime())) ? parsed : null;
    if (rowDate && !isNaN(rowDate.getTime())) {
      if (rowDate.getMonth() === prevMonth && rowDate.getFullYear() === prevYear) {
        sheet.deleteRow(i + 1);
        rowsDeleted++;
      }
    }
  }
  SpreadsheetApp.getUi().alert('Selesai: ' + rowsDeleted + ' baris bulan lalu dihapus dari ' + _AIST_DB_NAME + '.');
}

// ══════════════════════════════════════════════════════════════════
// FORM INPUT SALDO AIST — AUTO-FILL saat Login ID (col D) diisi
// ══════════════════════════════════════════════════════════════════

/**
 * OnEdit handler untuk "Form Input Saldo AIST".
 * Ketika admin mengisi kolom D (Login ID), auto-fill:
 *   F (Nama Driver)     — lookup dari Database Driver Airport/External
 *   G (Cabang)          — lookup dari Database Driver
 *   E (Nominal Tagihan) — lookup dari Form Input Saldo PWA (request driver belum diproses)
 *
 * Install via setupTriggerSaldoAISTOnEdit().
 */
function onEditFormInputSaldoAIST(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== _AIST_FORM_NAME) return;

  var startRow = e.range.getRow();
  var startCol = e.range.getColumn();
  var endCol   = startCol + e.range.getNumColumns() - 1;
  var endRow   = startRow + e.range.getNumRows() - 1;

  // Trigger hanya jika editan mencakup col D (Login ID)
  if (startCol > _AIST_FORM_COL.LOGIN_ID || endCol < _AIST_FORM_COL.LOGIN_ID) return;

  var firstDataRow = Math.max(startRow, _AIST_DATA_START_ROW);
  if (firstDataRow > endRow) return;

  var ss = SpreadsheetApp.openById(RAOS_SS_ID);

  for (var row = firstDataRow; row <= endRow; row++) {
    var loginId = sheet.getRange(row, _AIST_FORM_COL.LOGIN_ID).getValue();
    if (!loginId || String(loginId).trim() === '') {
      sheet.getRange(row, _AIST_FORM_COL.NAMA_DRIVER).clearContent();
      sheet.getRange(row, _AIST_FORM_COL.CABANG).clearContent();
      sheet.getRange(row, _AIST_FORM_COL.NOMINAL_TAGIHAN).clearContent();
      continue;
    }

    var loginIdStr = String(loginId).trim();

    // Auto-fill F (Nama Driver) + G (Cabang) dari Database Driver
    var driver = _cariDriverByLoginId(loginIdStr);
    if (driver) {
      sheet.getRange(row, _AIST_FORM_COL.NAMA_DRIVER).setValue(driver.nama);
      sheet.getRange(row, _AIST_FORM_COL.CABANG).setValue(driver.idCabang);
    }

    // Auto-fill E (Nominal Tagihan) dari Form Input Saldo PWA (request belum diproses)
    var nominalPWA = _cariNominalPWAByLoginId(ss, loginIdStr);
    if (nominalPWA !== null) {
      sheet.getRange(row, _AIST_FORM_COL.NOMINAL_TAGIHAN).setValue(nominalPWA);
    }
  }
}

/**
 * Cari nominal tagihan dari Form Input Saldo PWA berdasarkan Login ID driver.
 * Ambil baris pertama yang Login ID-nya cocok dan belum dicentang "Sudah Diisi" (col G).
 *
 * @param {Spreadsheet} ss
 * @param {string}      loginId
 * @returns {number|null}
 */
function _cariNominalPWAByLoginId(ss, loginId) {
  var shPWA = ss.getSheetByName('Form Input Saldo PWA');
  if (!shPWA || shPWA.getLastRow() < 3) return null;

  // A=Timestamp(0), B=Cabang(1), C=NamaStaff(2), D=Nominal(3), E=IDLoginDriver(4),
  // F=NamaDriver(5), G=SudahDiisi(6)
  var data = shPWA.getRange(3, 1, shPWA.getLastRow() - 2, 7).getValues();
  for (var i = 0; i < data.length; i++) {
    var rowLoginId  = String(data[i][4]).trim();
    var sudahDiisi  = data[i][6];
    if (rowLoginId === loginId && sudahDiisi !== true) {
      return Number(data[i][3]) || null;
    }
  }
  return null;
}

/**
 * Pasang onEdit trigger untuk auto-fill Form Input Saldo AIST.
 * Jalankan SEKALI dari GAS Editor atau menu Setup.
 */
function setupTriggerSaldoAISTOnEdit() {
  var ss       = SpreadsheetApp.openById(RAOS_SS_ID);
  var triggers = ScriptApp.getUserTriggers(ss);

  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === 'onEditFormInputSaldoAIST') {
      ScriptApp.deleteTrigger(t);
      Logger.log('🗑️  Trigger lama dihapus: onEditFormInputSaldoAIST');
    }
  });

  ScriptApp.newTrigger('onEditFormInputSaldoAIST')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  Logger.log('✅ Trigger onEditFormInputSaldoAIST terpasang.');
  Logger.log('   Aktif di: ' + _AIST_FORM_NAME);
  Logger.log('   Fungsi: Auto-fill col E (Nominal), F (Nama Driver), G (Cabang) saat Login ID (D) diisi.');
  SpreadsheetApp.getUi().alert(
    '✅ Trigger OnEdit Saldo AIST terpasang!\n\n' +
    'Saat admin isi kolom D (Login ID) di "Form Input Saldo AIST",\n' +
    'otomatis terisi:\n' +
    '  E (Nominal Tagihan) — dari PWA request driver\n' +
    '  F (Nama Driver)     — dari Database Driver\n' +
    '  G (Cabang)          — dari Database Driver');
}

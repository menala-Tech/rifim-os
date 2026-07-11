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

    // ─ Potongan Order ────────────────────────────────────────────
    .addSubMenu(
      ui.createMenu('📦 Potongan Order')
        .addItem('Pindahkan dari Input Potongan 1 → Database', 'pindahDataInputPotongan1')
        .addItem('Pindahkan dari Input Potongan 2 → Database', 'pindahDataInputPotongan2')
        .addSeparator()
        .addItem('Hapus Data Potongan Bulan Sebelumnya',       'hapusPotonganBulanSebelumnya')
    )

    // ─ Saldo AIST ────────────────────────────────────────────────
    .addSubMenu(
      ui.createMenu('💳 Saldo AIST')
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
        .addItem('Test Tipe Waktu',                 'testTipeWaktu')
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
  var tsStr      = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
  var adminEmail = Session.getActiveUser().getEmail();
  var rowsToClear = [];

  for (var i = 0; i < data.length; i++) {
    // Patokan: Tanggal (kolom A) tidak kosong — pola Ops sistem final.gs
    var tanggal = data[i][_AIST_FORM_COL.TANGGAL - 1]; // A
    if (!tanggal || tanggal.toString().trim() === '') continue;

    var sum           = data[i][_AIST_FORM_COL.SUM - 1];            // B (nominal AIST)
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
      tsStr,                             // I: Created At
    ]);

    rowsToClear.push(i);
  }

  if (toAppend.length === 0) {
    SpreadsheetApp.getUi().alert('Data kosong. Pastikan kolom Tanggal (A) terisi.');
    return;
  }

  // ── Append ke Database AIST ───────────────────────────────────
  sheetDB.getRange(dbLastRow + 1, 1, toAppend.length, toAppend[0].length).setValues(toAppend);

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
    '\nWaktu: ' + tsStr +
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
    var rowDate = (tgl instanceof Date) ? tgl : (tgl ? new Date(tgl) : null);
    if (rowDate && !isNaN(rowDate.getTime())) {
      if (rowDate.getMonth() === prevMonth && rowDate.getFullYear() === prevYear) {
        sheet.deleteRow(i + 1);
        rowsDeleted++;
      }
    }
  }
  SpreadsheetApp.getUi().alert('Selesai: ' + rowsDeleted + ' baris bulan lalu dihapus dari ' + _AIST_DB_NAME + '.');
}

/**
 * RIFIM OS — Laporan Cabang Engine
 *
 * Generate "INVOICE TAGIHAN INTERN CABANG" per-cabang dari Database AIST,
 * export ke PDF, simpan ke Drive subfolder, kirim WA Grup, kirim Email.
 *
 * Setup wajib (sekali jalan dari GAS Editor / menu Setup):
 *   1. setupLaporanFolder()      → buat subfolder Drive, simpan ID ke PropertiesService
 *   2. setupLaporanCabangSheet() → buat sheet template LAPORAN_CABANG
 *
 * Untuk WA: set Script Properties di GAS Editor → Project Settings:
 *   WA_API_URL  = endpoint provider WA (mis. https://api.fonnte.com/send)
 *   WA_API_KEY  = token/key dari provider
 *   WA_GROUP_ID = nomor/ID grup WA tujuan
 */

// ── Constants ──────────────────────────────────────────────────────────────
var _LAPORAN_SHEET_NAME     = 'LAPORAN_CABANG';
var _LAPORAN_FOLDER_KEY     = 'laporan_pdf_folder_id';       // PropertiesService key
var _LAPORAN_MAIN_FOLDER    = '19taBn0YXxjXTb-SxqFXGhwOPShZ4VlIt';
var _LAPORAN_SUBFOLDER_NAME = 'LAPORAN CABANG PDF';

var _LAPORAN_HEADER_ROW = 6;   // baris header kolom
var _LAPORAN_DATA_ROW   = 7;   // baris awal data

// ══════════════════════════════════════════════════════════════════════════════
// 1. SETUP
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Buat subfolder "LAPORAN CABANG PDF" di Drive folder RIFIM OS.
 * Simpan folder ID ke PropertiesService agar pdfSimpanKeDrive() tahu lokasinya.
 * Jalankan SEKALI dari menu Setup atau GAS Editor.
 */
function setupLaporanFolder() {
  var mainFolder = DriveApp.getFolderById(_LAPORAN_MAIN_FOLDER);
  var iter       = mainFolder.getFoldersByName(_LAPORAN_SUBFOLDER_NAME);
  var pdfFolder  = iter.hasNext() ? iter.next() : mainFolder.createFolder(_LAPORAN_SUBFOLDER_NAME);

  PropertiesService.getScriptProperties().setProperty(_LAPORAN_FOLDER_KEY, pdfFolder.getId());
  Logger.log('📁 Folder PDF RIFIM OS: ' + pdfFolder.getUrl());
  Logger.log('ID tersimpan: ' + pdfFolder.getId());
  SpreadsheetApp.getUi().alert(
    '✅ Folder PDF siap!\n\n📁 ' + _LAPORAN_SUBFOLDER_NAME +
    '\n🔗 ' + pdfFolder.getUrl());
}

/**
 * Buat sheet LAPORAN_CABANG dengan template "INVOICE TAGIHAN INTERN CABANG".
 * Jalankan dari menu Setup setelah setupRaosSheets().
 */
function setupLaporanCabangSheet() {
  var ss    = SpreadsheetApp.openById(RAOS_SS_ID);
  var sheet = ss.getSheetByName(_LAPORAN_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(_LAPORAN_SHEET_NAME);
  } else {
    sheet.clear();
    var merges = sheet.getMergedRanges();
    merges.forEach(function(m) { m.breakApart(); });
  }

  // ── Lebar kolom ──────────────────────────────────────────────────────────
  sheet.setColumnWidth(1, 50);   // A: No
  sheet.setColumnWidth(2, 145);  // B: Login ID
  sheet.setColumnWidth(3, 175);  // C: Nominal Tagihan
  sheet.setColumnWidth(4, 235);  // D: Nama Driver
  sheet.setColumnWidth(5, 175);  // E: Total Tagihan

  // ── Row 1-2: Title (merged, dark navy) ───────────────────────────────────
  sheet.getRange('A1:D2').merge()
    .setValue('INVOICE TAGIHAN INTERN CABANG')
    .setFontSize(16).setFontWeight('bold')
    .setFontColor('#FFFFFF').setBackground('#0D2A5E')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 38);
  sheet.setRowHeight(2, 38);

  // ── Row 3: Dropdown Id Cabang ─────────────────────────────────────────────
  sheet.getRange('A3').setValue('Cabang:')
    .setFontWeight('bold').setVerticalAlignment('middle');
  sheet.getRange('B3:C3').merge()
    .setBackground('#FFE599')
    .setHorizontalAlignment('left').setVerticalAlignment('middle');

  var _cabangList = [
    'ID Rifim Airport Batam',
    'ID Rifim Batam',
    'ID Rifim Airport Jambi',
    'ID Rifim Jambi Luar',
    'ID Rifim Airport Balikpapan',
    'ID Rifim Airport Manado',
    'ID Rifim Airport Pekanbaru',
  ];
  var dropdownRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(_cabangList, true)
    .setAllowInvalid(false)
    .setHelpText('Pilih Id Cabang dari daftar')
    .build();
  sheet.getRange('B3').setDataValidation(dropdownRule);
  sheet.setRowHeight(3, 30);

  // ── Row 4: Tanggal (date picker muncul otomatis) ──────────────────────────
  sheet.getRange('A4').setValue('Tanggal:')
    .setFontWeight('bold').setVerticalAlignment('middle');
  sheet.getRange('B4')
    .setValue(new Date())
    .setNumberFormat('dd/MM/yyyy')
    .setFontColor('#EA4335').setFontWeight('bold').setVerticalAlignment('middle');
  var dateRule = SpreadsheetApp.newDataValidation()
    .requireDate()
    .setAllowInvalid(false)
    .setHelpText('Pilih tanggal laporan')
    .build();
  sheet.getRange('B4').setDataValidation(dateRule);
  sheet.setRowHeight(4, 28);

  // ── Row 5: spacer ─────────────────────────────────────────────────────────
  sheet.setRowHeight(5, 10);

  // ── Row 6: Header kolom (dark navy, white bold) ───────────────────────────
  sheet.getRange(6, 1, 1, 5)
    .setValues([['No', 'Login ID', 'Nominal Tagihan (Net)', 'NAMA DRIVER', 'TOTAL TAGIHAN']])
    .setBackground('#0D2A5E').setFontColor('#FFFFFF').setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(6, 36);

  sheet.setFrozenRows(6);

  Logger.log('✅ Sheet ' + _LAPORAN_SHEET_NAME + ' berhasil di-setup.');
  SpreadsheetApp.getUi().alert(
    '✅ Sheet "' + _LAPORAN_SHEET_NAME + '" siap!\n\n' +
    'Langkah selanjutnya:\n' +
    '1. Isi nama Cabang di sel B3\n' +
    '2. Klik PDF & WA → Generate Laporan Cabang');
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. GENERATE LAPORAN
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Populate LAPORAN_CABANG dari Database AIST berdasarkan Cabang yang diisi di B3.
 * Baris E7 menampilkan TOTAL TAGIHAN, baris E lainnya dikosongkan.
 */
function generateLaporanCabang() {
  var ss    = SpreadsheetApp.openById(RAOS_SS_ID);
  var sheet = ss.getSheetByName(_LAPORAN_SHEET_NAME);

  if (!sheet) {
    SpreadsheetApp.getUi().alert(
      'Sheet "' + _LAPORAN_SHEET_NAME + '" belum ada.\n' +
      'Jalankan Setup → Setup Sheet Laporan Cabang terlebih dahulu.');
    return;
  }

  var cabang = sheet.getRange('B3').getValue().toString().trim();
  if (!cabang) {
    SpreadsheetApp.getUi().alert(
      'Pilih Cabang di sel B3 (klik → pilih dari dropdown).\n\nContoh: ID Rifim Airport Pekanbaru');
    return;
  }

  // Baca tanggal filter dari B4
  var tglRaw = sheet.getRange('B4').getValue();
  var filterDate = (tglRaw instanceof Date && !isNaN(tglRaw.getTime()))
                     ? tglRaw : new Date();
  var filterY = filterDate.getFullYear();
  var filterM = filterDate.getMonth();
  var filterD = filterDate.getDate();

  // Ambil Database AIST
  var sheetDB = ss.getSheetByName(_AIST_DB_NAME);
  if (!sheetDB || sheetDB.getLastRow() < 3) {
    SpreadsheetApp.getUi().alert('Database AIST kosong atau belum ada data.');
    return;
  }

  var numDbRows = sheetDB.getLastRow() - 2;
  var dbData    = sheetDB.getRange(3, 1, numDbRows, 9).getValues();
  // DB AIST cols (0-based): 0=ID, 1=Tanggal, 2=Login ID, 3=Credit Acc,
  //                          4=Nama Driver, 5=Cabang, 6=Nominal AIST, 7=Status, 8=Created At

  var filtered = dbData.filter(function(row) {
    if (!row[5] || row[5].toString().trim() !== cabang) return false;
    // Filter by tanggal (B4)
    var tgl = _parseAISTDate(row[1]);
    if (!(tgl instanceof Date) || isNaN(tgl.getTime())) return false;
    return tgl.getFullYear() === filterY && tgl.getMonth() === filterM && tgl.getDate() === filterD;
  });

  var tglStr = Utilities.formatDate(filterDate, Session.getScriptTimeZone(), 'dd/MM/yyyy');

  if (filtered.length === 0) {
    SpreadsheetApp.getUi().alert(
      'Tidak ada data untuk:\nCabang: "' + cabang + '"\nTanggal: ' + tglStr + '\n\n' +
      'Coba ubah tanggal di B4 atau pastikan data sudah dipindahkan ke Database AIST.');
    return;
  }

  // Bersihkan area data lama
  var lastRow = sheet.getLastRow();
  if (lastRow >= _LAPORAN_DATA_ROW) {
    sheet.getRange(_LAPORAN_DATA_ROW, 1, lastRow - _LAPORAN_DATA_ROW + 1, 5).clear();
  }

  // B4 sudah diisi user, tidak perlu overwrite

  // Bangun baris data
  var totalTagihan = 0;
  var rows         = [];

  for (var i = 0; i < filtered.length; i++) {
    var r       = filtered[i];
    // Nominal bisa number (dari DB) atau string "45 000" (jika manual paste)
    var nominalRaw = r[6];
    var nominal    = (typeof nominalRaw === 'number')
                       ? nominalRaw
                       : Number(String(nominalRaw).replace(/\s+/g, '').replace(/[^0-9.-]/g, '')) || 0;
    totalTagihan += nominal;
    rows.push([i + 1, r[2], nominal, r[4], '']); // No, Login ID, Nominal, Nama Driver, Total(kosong)
  }

  // Total Tagihan hanya tampil di baris pertama (kolom E)
  rows[0][4] = 'Rp ' + totalTagihan.toLocaleString('id-ID');

  // Tulis data ke sheet
  sheet.getRange(_LAPORAN_DATA_ROW, 1, rows.length, 5).setValues(rows);

  // Format nominal sebagai angka
  sheet.getRange(_LAPORAN_DATA_ROW, 3, rows.length, 1).setNumberFormat('#,##0');

  // Warna baris bergantian + alignment
  for (var j = 0; j < rows.length; j++) {
    var bg = (j % 2 === 0) ? '#FFFFFF' : '#F5F5F5';
    sheet.getRange(_LAPORAN_DATA_ROW + j, 1, 1, 5)
      .setBackground(bg).setVerticalAlignment('middle');
  }
  sheet.getRange(_LAPORAN_DATA_ROW, 1, rows.length, 2).setHorizontalAlignment('center'); // No, Login ID
  sheet.getRange(_LAPORAN_DATA_ROW, 3, rows.length, 1).setHorizontalAlignment('right');  // Nominal

  // Bold + merah untuk Total Tagihan di E baris pertama
  sheet.getRange(_LAPORAN_DATA_ROW, 5)
    .setFontWeight('bold').setFontColor('#EA4335').setHorizontalAlignment('center');

  SpreadsheetApp.getUi().alert(
    '✅ Laporan berhasil dibuat!\n\n' +
    'Cabang  : ' + cabang + '\n' +
    'Tanggal : ' + tglStr + '\n' +
    'Driver  : ' + rows.length + ' orang\n' +
    'Total   : Rp ' + totalTagihan.toLocaleString('id-ID') + '\n\n' +
    'Selanjutnya: PDF & WA → Simpan Drive / Kirim WA / Kirim Email');
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. PDF EXPORT (internal)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Export sheet LAPORAN_CABANG sebagai PDF blob.
 * @private
 * @returns {Blob}
 */
function _getLaporanBlob() {
  var ss    = SpreadsheetApp.openById(RAOS_SS_ID);
  var sheet = ss.getSheetByName(_LAPORAN_SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + _LAPORAN_SHEET_NAME + '" tidak ditemukan.');

  var cabang  = sheet.getRange('B3').getValue().toString().trim();
  if (!cabang) throw new Error('Sel B3 (Cabang) kosong. Generate laporan terlebih dahulu.');

  var lastRow = Math.max(sheet.getLastRow(), _LAPORAN_HEADER_ROW);
  var tanggal = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');

  var exportUrl =
    'https://docs.google.com/spreadsheets/d/' + RAOS_SS_ID +
    '/export?format=pdf' +
    '&gid=' + sheet.getSheetId() +
    '&portrait=true' +
    '&fitw=true' +
    '&top_margin=0.50&bottom_margin=0.50&left_margin=0.50&right_margin=0.50' +
    '&sheetnames=false&printtitle=false&pagenumbers=false' +
    '&gridlines=false' +
    '&fzr=false' +
    '&r1=0&c1=0' +
    '&r2=' + lastRow + '&c2=5';

  var token = ScriptApp.getOAuthToken();
  var resp  = UrlFetchApp.fetch(exportUrl, {
    headers: { 'Authorization': 'Bearer ' + token },
    muteHttpExceptions: true,
  });

  if (resp.getResponseCode() !== 200) {
    throw new Error('Export PDF gagal. HTTP ' + resp.getResponseCode());
  }

  var filename = 'TAGIHAN_' + cabang.replace(/[^a-zA-Z0-9]/g, '_') + '_' + tanggal + '.pdf';
  return resp.getBlob().setName(filename);
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. PDF → SIMPAN DRIVE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Export LAPORAN_CABANG sebagai PDF dan simpan ke subfolder Drive "LAPORAN CABANG PDF".
 */
function pdfSimpanKeDrive() {
  try {
    var folderId = PropertiesService.getScriptProperties().getProperty(_LAPORAN_FOLDER_KEY);
    if (!folderId) {
      SpreadsheetApp.getUi().alert(
        'Folder PDF belum di-setup.\nJalankan Setup → Setup Folder PDF Drive terlebih dahulu.');
      return;
    }

    var blob   = _getLaporanBlob();
    var folder = DriveApp.getFolderById(folderId);
    var file   = folder.createFile(blob);

    SpreadsheetApp.getUi().alert(
      '✅ PDF tersimpan!\n\n📄 ' + file.getName() + '\n\n🔗 ' + file.getUrl());
  } catch (err) {
    SpreadsheetApp.getUi().alert('❌ Gagal simpan PDF:\n' + err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. PDF → KIRIM EMAIL
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Export PDF dan kirim via Gmail ke alamat email yang diinput admin.
 */
function pdfKirimViaEmail() {
  var ss     = SpreadsheetApp.openById(RAOS_SS_ID);
  var sheet  = ss.getSheetByName(_LAPORAN_SHEET_NAME);
  var cabang = sheet ? sheet.getRange('B3').getValue().toString().trim() : '';

  if (!cabang) {
    SpreadsheetApp.getUi().alert(
      'Generate laporan terlebih dahulu:\nIsi B3 (Cabang) lalu klik "Generate Laporan Cabang".');
    return;
  }

  var ui   = SpreadsheetApp.getUi();
  var resp = ui.prompt('Kirim Laporan via Email',
    'Masukkan alamat email tujuan:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;

  var emailTo = resp.getResponseText().trim();
  if (!emailTo) { ui.alert('Email tidak boleh kosong.'); return; }

  try {
    var blob = _getLaporanBlob();
    GmailApp.sendEmail(
      emailTo,
      'Invoice Tagihan Intern Cabang — ' + cabang,
      'Terlampir Invoice Tagihan Intern Cabang ' + cabang + '.\n\nDikirim otomatis dari RIFIM OS.',
      { attachments: [blob], name: 'RIFIM OS' }
    );
    ui.alert('✅ Email terkirim ke: ' + emailTo + '\n📄 ' + blob.getName());
  } catch (err) {
    ui.alert('❌ Gagal kirim email:\n' + err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. PDF → KIRIM WA GRUP
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Upload PDF ke Drive (public link) lalu kirim ke WA Grup via waEngine.js.
 *
 * Prasyarat: jalankan setupWaEngine(token, groupId) sekali dari GAS Editor.
 * Token & group ID tersimpan di PropertiesService (FONNTE_TOKEN, WA_GROUP_ID).
 */
function pdfKirimKeWAGrup() {
  var ss     = SpreadsheetApp.openById(RAOS_SS_ID);
  var sheet  = ss.getSheetByName(_LAPORAN_SHEET_NAME);
  var cabang = sheet ? sheet.getRange('B3').getValue().toString().trim() : '';

  if (!cabang) {
    SpreadsheetApp.getUi().alert(
      'Generate laporan terlebih dahulu:\nIsi B3 (Cabang) lalu klik "Generate Laporan Cabang".');
    return;
  }

  try {
    // Upload PDF ke Drive → buat link publik agar bisa dibuka dari WA
    var blob     = _getLaporanBlob();
    var folderId = PropertiesService.getScriptProperties().getProperty(_LAPORAN_FOLDER_KEY);
    var folder   = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
    var file     = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileUrl  = file.getUrl();

    var tanggal = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
    var message =
      '📋 *INVOICE TAGIHAN INTERN CABANG*\n' +
      '🏢 Cabang: *' + cabang + '*\n' +
      '📅 ' + tanggal + '\n\n' +
      '🔗 ' + fileUrl;

    // Kirim via waEngine.js — routing ke FONNTE_TOKEN + WA_GROUP_ID
    waSendToGroup(message);

    SpreadsheetApp.getUi().alert(
      '✅ Pesan WA terkirim ke grup!\n\n' +
      '📄 ' + file.getName() + '\n🔗 ' + fileUrl);

  } catch (err) {
    // Error dari waSendToGroup() sudah include pesan "FONNTE_TOKEN belum di-setup"
    SpreadsheetApp.getUi().alert(
      '❌ Gagal kirim WA:\n' + err.message +
      (err.message.indexOf('FONNTE_TOKEN') !== -1
        ? '\n\nJalankan dari GAS Editor:\nsetupWaEngine("TOKEN", "GROUPID")'
        : ''));
  }
}

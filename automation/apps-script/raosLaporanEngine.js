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

var _LAPORAN_HEADER_ROW = 7;   // baris header kolom
var _LAPORAN_DATA_ROW   = 8;   // baris awal data
var _LAPORAN_CABANG_ROW = 4;   // baris filter cabang (B4)
var _LAPORAN_TGL_ROW    = 5;   // baris filter tanggal (B5)

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
    sheet.getImages().forEach(function(i) { i.remove(); });
    sheet.clear();
    sheet.getMergedRanges().forEach(function(m) { try { m.breakApart(); } catch(e) {} });
  }

  // ── Lebar kolom ──────────────────────────────────────────────────────────
  sheet.setColumnWidth(1, 110);  // A: area logo
  sheet.setColumnWidth(2, 130);  // B: Login ID
  sheet.setColumnWidth(3, 160);  // C: Nominal Tagihan
  sheet.setColumnWidth(4, 220);  // D: Nama Driver
  sheet.setColumnWidth(5, 155);  // E: Total Tagihan

  // ── Row 1-2: Header dengan logo ───────────────────────────────────────────
  // A1:A2 merge → area logo (warna latar, gambar di-overlay)
  sheet.getRange('A1:A2').merge()
    .setBackground('#0D2A5E');
  sheet.setRowHeight(1, 55);
  sheet.setRowHeight(2, 38);

  // B1:E1 → nama perusahaan
  sheet.getRange('B1:E1').merge()
    .setValue('PT. RIFIM INTERNASIONAL GEMILANG')
    .setBackground('#0D2A5E').setFontColor('#FFFFFF')
    .setFontSize(13).setFontWeight('bold').setFontFamily('Arial')
    .setHorizontalAlignment('left').setVerticalAlignment('middle')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  sheet.getRange('B1').setFontWeight('bold');

  // B2:E2 → judul dokumen + cabang-cabang
  sheet.getRange('B2:E2').merge()
    .setValue('INVOICE TAGIHAN INTERN CABANG   |   Batam · Jambi · Balikpapan · Manado · Pekanbaru')
    .setBackground('#0D2A5E').setFontColor('#FFE599')
    .setFontSize(9).setFontWeight('bold').setFontFamily('Arial')
    .setHorizontalAlignment('left').setVerticalAlignment('middle')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);

  // Sisipkan logo RIFIM di A1 (100×85px, offset 5,5)
  insertLogoKeSheet(sheet, BRAND_KEY.RIFIM, 1, 1, 100, 85, 5, 5);

  // ── Row 3: spacer ─────────────────────────────────────────────────────────
  sheet.setRowHeight(3, 8);
  sheet.getRange('A3:E3').setBackground('#FFFFFF');

  // ── Row 4: Dropdown Id Cabang ─────────────────────────────────────────────
  sheet.getRange('A4').setValue('Cabang :')
    .setFontWeight('bold').setFontSize(10).setVerticalAlignment('middle')
    .setHorizontalAlignment('right');
  sheet.getRange('B4:D4').merge()
    .setBackground('#FFF2CC').setBorder(true, true, true, true, false, false,
      '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID)
    .setHorizontalAlignment('left').setVerticalAlignment('middle').setFontSize(10);
  sheet.setRowHeight(4, 28);

  var _cabangList = [
    'ID Rifim Airport Batam',
    'ID Rifim Batam',
    'ID Rifim Airport Jambi',
    'ID Rifim Jambi Luar',
    'ID Rifim Airport Balikpapan',
    'ID Rifim Airport Manado',
    'ID Rifim Airport Pekanbaru',
  ];
  sheet.getRange('B4').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(_cabangList, true)
      .setAllowInvalid(false)
      .setHelpText('Pilih Id Cabang dari daftar')
      .build()
  );

  // ── Row 5: Tanggal ────────────────────────────────────────────────────────
  sheet.getRange('A5').setValue('Tanggal :')
    .setFontWeight('bold').setFontSize(10).setVerticalAlignment('middle')
    .setHorizontalAlignment('right');
  sheet.getRange('B5')
    .setValue(new Date())
    .setNumberFormat('dd/MM/yyyy')
    .setFontColor('#C0392B').setFontWeight('bold').setFontSize(10)
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false, '#CCCCCC', SpreadsheetApp.BorderStyle.SOLID)
    .setBackground('#FFF2CC');
  sheet.getRange('B5').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireDate().setAllowInvalid(false)
      .setHelpText('Pilih tanggal laporan').build()
  );
  sheet.setRowHeight(5, 28);

  // ── Row 6: spacer ─────────────────────────────────────────────────────────
  sheet.setRowHeight(6, 8);

  // ── Row 7: Header kolom tabel ─────────────────────────────────────────────
  sheet.getRange(7, 1, 1, 5)
    .setValues([['No', 'Login ID', 'Nominal Tagihan (Net)', 'NAMA DRIVER', 'TOTAL TAGIHAN']])
    .setBackground('#0D2A5E').setFontColor('#FFFFFF').setFontWeight('bold')
    .setFontSize(10).setFontFamily('Arial')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, false,
      '#1A4080', SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(7, 34);

  sheet.setFrozenRows(7);

  // Update konstanta baris (row 7 = header, row 8 = data mulai)
  Logger.log('✅ Sheet ' + _LAPORAN_SHEET_NAME + ' berhasil di-setup dengan logo.');
  SpreadsheetApp.getUi().alert(
    '✅ Sheet "' + _LAPORAN_SHEET_NAME + '" siap dengan logo!\n\n' +
    'Langkah selanjutnya:\n' +
    '1. Pilih Cabang di sel B4\n' +
    '2. Pilih Tanggal di sel B5\n' +
    '3. Klik PDF & WA → Generate Laporan Cabang');
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

  var cabang = sheet.getRange('B' + _LAPORAN_CABANG_ROW).getValue().toString().trim();
  if (!cabang) {
    SpreadsheetApp.getUi().alert(
      'Pilih Cabang di sel B4 (klik → pilih dari dropdown).\n\nContoh: ID Rifim Airport Pekanbaru');
    return;
  }

  // Baca tanggal filter dari B5
  var tglRaw = sheet.getRange('B' + _LAPORAN_TGL_ROW).getValue();
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
  var cabang = sheet ? sheet.getRange('B' + _LAPORAN_CABANG_ROW).getValue().toString().trim() : '';

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
  var cabang = sheet ? sheet.getRange('B' + _LAPORAN_CABANG_ROW).getValue().toString().trim() : '';

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

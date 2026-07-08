/**
 * RIFIM OS — Google Sheets Database Setup
 * Jalankan fungsi setupRIFIMDatabase() SATU KALI untuk membuat
 * semua sheet, header, format, dan data awal.
 *
 * Cara pakai:
 * 1. Buka Google Sheets baru
 * 2. Extensions → Apps Script
 * 3. Paste seluruh file ini
 * 4. Pilih fungsi setupRIFIMDatabase → Run
 */

// ─────────────────────────────────────────────
// MAIN SETUP FUNCTION
// ─────────────────────────────────────────────

function setupRIFIMDatabase() {
  var ss = _getDB();
  ss.setName('RIFIM OS — Smart Office Database');

  Logger.log('=== RIFIM OS Database Setup Dimulai ===');

  _setupDocumentsSheet(ss);
  _setupNumberingSheet(ss);
  _setupCompanyConfigSheet(ss);
  _setupDocTypesSheet(ss);

  // Hapus sheet default "Sheet1" jika masih ada
  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet) ss.deleteSheet(defaultSheet);

  // Pindah ke sheet pertama
  ss.setActiveSheet(ss.getSheetByName('documents'));

  Logger.log('=== Setup Selesai! ===');
  Logger.log('✅ RIFIM OS Database berhasil dibuat!');
  Logger.log('Sheet: documents, numbering_sequences, company_config, doc_types');
}


// ─────────────────────────────────────────────
// SHEET 1: documents
// ─────────────────────────────────────────────

function _setupDocumentsSheet(ss) {
  var sheet = ss.getSheetByName('documents') || ss.insertSheet('documents');
  sheet.clear();

  var headers = [
    'id',
    'document_number',
    'document_type',
    'document_code',
    'document_date',
    'recipient_name',
    'recipient_address',
    'subject',
    'attachment',
    'body_summary',
    'status',
    'gdoc_url',
    'pdf_url',
    'qr_url',
    'created_by',
    'created_at',
    'updated_at',
  ];

  // Header row
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setBackground('#C40000');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);

  // Column widths
  var widths = [180, 210, 120, 90, 110, 200, 200, 280, 180, 300, 80, 300, 300, 200, 140, 160, 160];
  widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });

  // Status dropdown validation
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['DRAFT', 'FINAL', 'SENT', 'ARCHIVED'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 11, 1000, 1).setDataValidation(statusRule);

  // Freeze header + alternating row colors
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setHorizontalAlignment('center');

  // Sample data row
  var sampleDate = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  sheet.appendRow([
    'DOC-2026-001',
    '001/RIFIM/SURAT/VII/2026',
    'Surat Resmi',
    'SURAT',
    sampleDate,
    'PT. Teknologi Perdana Indonesia',
    'Di Tempat',
    'Penawaran Kerjasama Strategic Marketing',
    '1 (Satu) Berkas Proposal',
    'Kami bermaksud mengajukan penawaran kerjasama...',
    'FINAL',
    'https://docs.google.com/...',
    'https://drive.google.com/...',
    '',
    'Bobby Rahman M.B',
    sampleDate,
    sampleDate,
  ]);
  sheet.getRange(2, 1, 1, headers.length).setBackground('#FFF8F8');

  Logger.log('✅ Sheet documents selesai');
}


// ─────────────────────────────────────────────
// SHEET 2: numbering_sequences
// ─────────────────────────────────────────────

function _setupNumberingSheet(ss) {
  var sheet = ss.getSheetByName('numbering_sequences') || ss.insertSheet('numbering_sequences');
  sheet.clear();

  var headers = ['document_code', 'year', 'month', 'month_roman', 'last_sequence'];
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setBackground('#C40000');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);

  sheet.setColumnWidth(1, 140);
  sheet.setColumnWidth(2, 80);
  sheet.setColumnWidth(3, 80);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 130);
  sheet.setFrozenRows(1);

  // Init sequences untuk semua 20 jenis dokumen
  var MONTHS_ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  var now   = new Date();
  var year  = now.getFullYear();
  var month = now.getMonth() + 1;
  var roman = MONTHS_ROMAN[now.getMonth()];

  var codes = [
    'SURAT','ST','SIZ','SKT',          // Korespondensi
    'INV','KWT',                        // Keuangan
    'PROP','CP','MOU','PKS',            // Kerjasama
    'SP1','SP2','SP3','PKWT',           // HR/SDM
    'SPG','SMT','PHK','PI',
    'BA','FCO',                         // Operasional
  ];

  var rows = codes.map(function(code) {
    return [code, year, month, roman, 0];
  });

  sheet.getRange(2, 1, rows.length, 5).setValues(rows);

  // Format last_sequence as number
  sheet.getRange(2, 5, rows.length, 1)
    .setNumberFormat('000')
    .setHorizontalAlignment('center');

  Logger.log('✅ Sheet numbering_sequences selesai (' + codes.length + ' kode dokumen)');
}


// ─────────────────────────────────────────────
// SHEET 3: company_config
// ─────────────────────────────────────────────

function _setupCompanyConfigSheet(ss) {
  var sheet = ss.getSheetByName('company_config') || ss.insertSheet('company_config');
  sheet.clear();

  var headers = ['key', 'value', 'description'];
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setBackground('#C40000');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);

  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 360);
  sheet.setColumnWidth(3, 280);
  sheet.setFrozenRows(1);

  var config = [
    // Identitas Perusahaan
    ['company_name',        'PT. RIFIM INTERNASIONAL GEMILANG',          'Nama lengkap perusahaan'],
    ['company_short',       'RIFIM',                                      'Nama singkat untuk nomor dokumen'],
    ['company_tagline',     'Membangun Hari Ini, Menginspirasi Masa Depan','Tagline perusahaan'],
    ['company_role',        'Vendor Operasional Maxim',                   'Peran / bidang usaha'],
    // Kontak
    ['company_address',     'Fanindo Blok S No. 20, Tanjung Uncang, Batu Aji, Kota Batam', 'Alamat lengkap'],
    ['company_city',        'Batam',                                      'Kota'],
    ['company_phone',       '+62 821 7010 2349',                          'Nomor telepon'],
    ['company_email',       'rifiminternasionalgemilang@gmail.com',       'Email resmi'],
    ['company_website',     'www.rifimgroup.com',                         'Website'],
    // Direktur
    ['director_name',       'BOBBY RAHMAN M.B',                          'Nama direktur utama'],
    ['director_title',      'Direktur Utama',                             'Jabatan direktur'],
    // Legal
    ['company_npwp',        '-',                                          'Nomor NPWP'],
    ['company_nib',         '-',                                          'Nomor Induk Berusaha'],
    ['company_siup',        '-',                                          'Nomor SIUP'],
    // Google Drive
    ['drive_root_folder_id','19taBn0YXxjXTb-SxqFXGhwOPShZ4VlIt',       'ID folder root RIFIM OS di Google Drive'],
    ['drive_dokumen_folder_id','',                                        'ID folder Dokumen (set oleh setupDriveFolders)'],
    ['gdoc_template_surat', '',                                           'ID template Google Doc — Surat Resmi'],
    ['gdoc_template_inv',   '',                                           'ID template Google Doc — Invoice'],
    ['gdoc_template_pkwt',  '',                                           'ID template Google Doc — PKWT'],
    ['gdoc_template_sp',    '',                                           'ID template Google Doc — Surat Peringatan'],
    ['gdoc_template_mou',   '',                                           'ID template Google Doc — MoU'],
    // System
    ['timezone',            'Asia/Jakarta',                               'Timezone sistem'],
    ['date_locale',         'id-ID',                                      'Locale tanggal (Indonesia)'],
    ['pdf_export_enabled',  'true',                                       'Aktifkan export PDF otomatis'],
    ['email_notify_enabled','false',                                      'Kirim email notifikasi setelah generate'],
    ['qr_enabled',          'false',                                      'Generate QR Code (aktifkan setelah setup)'],
    ['version',             '1.0.0',                                      'Versi RIFIM OS'],
  ];

  sheet.getRange(2, 1, config.length, 3).setValues(config);

  // Styling
  sheet.getRange(2, 1, config.length, 1).setFontWeight('bold').setBackground('#F8F0F0');
  sheet.getRange(2, 2, config.length, 1).setBackground('#FFFCFC');

  // Group sections with color bands
  var sections = [[2,4,'#FFF0F0'],[5,9,'#FFF8F0'],[10,11,'#F0FFF0'],[12,14,'#F0F0FF'],[15,20,'#F0F8FF'],[21,26,'#FFFFF0']];
  sections.forEach(function(s) {
    sheet.getRange(s[0], 1, s[1]-s[0]+1, 3).setBackground(s[2]);
  });

  Logger.log('✅ Sheet company_config selesai (' + config.length + ' entri)');
}


// ─────────────────────────────────────────────
// SHEET 4: doc_types (referensi)
// ─────────────────────────────────────────────

function _setupDocTypesSheet(ss) {
  var sheet = ss.getSheetByName('doc_types') || ss.insertSheet('doc_types');
  sheet.clear();

  var headers = ['code', 'label', 'category', 'folder_name', 'template_gdoc_id', 'is_active'];
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setBackground('#C40000');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');

  [120,200,140,160,300,80].forEach(function(w,i){ sheet.setColumnWidth(i+1, w); });
  sheet.setFrozenRows(1);

  var types = [
    ['SURAT', 'Surat Resmi',             'Korespondensi', 'Surat',        '', 'TRUE'],
    ['ST',    'Surat Tugas',             'Korespondensi', 'Surat',        '', 'TRUE'],
    ['SIZ',   'Surat Izin',             'Korespondensi', 'Surat',        '', 'TRUE'],
    ['SKT',   'Surat Keterangan',        'Korespondensi', 'Surat',        '', 'TRUE'],
    ['BA',    'Berita Acara',            'Korespondensi', 'Berita Acara', '', 'TRUE'],
    ['INV',   'Invoice',                 'Keuangan',      'Invoice',      '', 'TRUE'],
    ['KWT',   'Kwitansi',               'Keuangan',      'Kwitansi',     '', 'TRUE'],
    ['PROP',  'Proposal',               'Kerjasama',     'Proposal',     '', 'TRUE'],
    ['CP',    'Company Profile',         'Kerjasama',     'Proposal',     '', 'TRUE'],
    ['MOU',   'MoU',                     'Kerjasama',     'MOU',          '', 'TRUE'],
    ['PKS',   'Perjanjian Kerjasama',    'Kerjasama',     'Kontrak',      '', 'TRUE'],
    ['SP1',   'Surat Peringatan 1',      'HR / SDM',      'SP',           '', 'TRUE'],
    ['SP2',   'Surat Peringatan 2',      'HR / SDM',      'SP',           '', 'TRUE'],
    ['SP3',   'Surat Peringatan 3',      'HR / SDM',      'SP',           '', 'TRUE'],
    ['PKWT',  'Kontrak PKWT',           'HR / SDM',      'Kontrak',      '', 'TRUE'],
    ['SPG',   'Surat Pengangkatan',      'HR / SDM',      'Kontrak',      '', 'TRUE'],
    ['SMT',   'Surat Mutasi',           'HR / SDM',      'Kontrak',      '', 'TRUE'],
    ['PHK',   'Surat PHK',             'HR / SDM',      'SP',           '', 'TRUE'],
    ['PI',    'Pakta Integritas',        'HR / SDM',      'Kontrak',      '', 'TRUE'],
    ['FCO',   'Form Checklist Op.',     'Operasional',   'Berita Acara', '', 'TRUE'],
  ];

  sheet.getRange(2, 1, types.length, 6).setValues(types);

  // Active validation
  var boolRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['TRUE','FALSE'], true).build();
  sheet.getRange(2, 6, types.length, 1).setDataValidation(boolRule);

  // Color by category
  var catColors = {'Korespondensi':'#FFF8F0','Keuangan':'#F0FFF4','Kerjasama':'#F0F4FF','HR / SDM':'#FFF0F0','Operasional':'#F8FFF0'};
  types.forEach(function(row, i) {
    var color = catColors[row[2]] || '#FFFFFF';
    sheet.getRange(i+2, 1, 1, 6).setBackground(color);
  });

  Logger.log('✅ Sheet doc_types selesai (20 jenis dokumen)');
}


// ─────────────────────────────────────────────
// UTILITY: Reset sequence bulan baru
// ─────────────────────────────────────────────

function resetMonthlySequences() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var sheet  = ss.getSheetByName('numbering_sequences');
  var MONTHS = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  var now    = new Date();
  var year   = now.getFullYear();
  var month  = now.getMonth() + 1;
  var roman  = MONTHS[now.getMonth()];
  var data   = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    sheet.getRange(i+1, 2).setValue(year);
    sheet.getRange(i+1, 3).setValue(month);
    sheet.getRange(i+1, 4).setValue(roman);
    sheet.getRange(i+1, 5).setValue(0);
  }

  Logger.log('Sequences direset untuk ' + roman + '/' + year);
}


// ─────────────────────────────────────────────
// UTILITY: Lihat info spreadsheet ini
// ─────────────────────────────────────────────

function getSpreadsheetInfo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('Spreadsheet ID : ' + ss.getId());
  Logger.log('URL            : ' + ss.getUrl());
  Logger.log('Sheets         : ' + ss.getSheets().map(function(s){ return s.getName(); }).join(', '));
}

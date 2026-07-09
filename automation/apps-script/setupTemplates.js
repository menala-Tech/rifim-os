/**
 * RIFIM OS — Setup Google Doc Templates
 * Jalankan setupAllTemplates() SEKALI untuk membuat semua 6 template
 * Google Doc dan menyimpan ID-nya ke sheet company_config secara otomatis.
 *
 * Template yang dibuat:
 *   gdoc_template_surat → Surat, Surat Tugas, Surat Izin, Surat Keterangan,
 *                          Berita Acara, Form Checklist, Proposal, Company Profile
 *   gdoc_template_inv   → Invoice
 *   gdoc_template_kwt   → Kwitansi
 *   gdoc_template_sp    → SP1, SP2, SP3, PHK
 *   gdoc_template_pkwt  → PKWT, Pengangkatan, Mutasi, Pakta Integritas
 *   gdoc_template_mou   → MOU, Perjanjian Kerjasama
 */

/**
 * Jalankan fungsi ini SATU KALI dari Apps Script Editor:
 * Pilih createAllTemplates → klik Run
 */
function createAllTemplates() {
  var config = getCompanyConfig();

  // Cari / buat folder Templates di Drive
  var tplFolder;
  var rootId = config['drive_root_folder_id'];
  if (rootId) {
    try {
      tplFolder = _getOrCreateFolder(DriveApp.getFolderById(rootId), 'Templates');
    } catch(_) {
      tplFolder = _getRootTemplateFolder();
    }
  } else {
    tplFolder = _getRootTemplateFolder();
  }

  Logger.log('📁 Templates folder: ' + tplFolder.getId());
  Logger.log('=== Membuat Google Doc Templates ===');

  // Buat 6 template
  var ids = {};
  ids['gdoc_template_surat'] = _makeSuratTemplate(config, tplFolder);
  ids['gdoc_template_inv']   = _makeInvoiceTemplate(config, tplFolder);
  ids['gdoc_template_kwt']   = _makeKwitansiTemplate(config, tplFolder);
  ids['gdoc_template_sp']    = _makeSPTemplate(config, tplFolder);
  ids['gdoc_template_pkwt']  = _makePKWTTemplate(config, tplFolder);
  ids['gdoc_template_mou']   = _makeMOUTemplate(config, tplFolder);

  // Simpan ke company_config (backward compat)
  _saveTemplateIds(ids);

  // ✨ Isi kolom template_gdoc_id di sheet document_types
  _fillDocumentTypesSheet(ids);

  Logger.log('=== Semua template selesai ===');
  Object.keys(ids).forEach(function(k) { Logger.log(k + ' → ' + ids[k]); });

  resetConfigCache();
  Logger.log('✅ Selesai! Cek sheet document_types kolom E (template_gdoc_id).');
}

// Alias lama agar tidak break jika ada yang sudah save fungsi ini
function setupAllTemplates() { createAllTemplates(); }

/**
 * Buat / cari folder "RIFIM OS — Templates" di root Drive
 */
function _getRootTemplateFolder() {
  var name = 'RIFIM OS — Templates';
  var iter = DriveApp.getFoldersByName(name);
  return iter.hasNext() ? iter.next() : DriveApp.createFolder(name);
}

/**
 * Isi kolom template_gdoc_id (kolom E, index 5) di sheet document_types
 */
function _fillDocumentTypesSheet(ids) {
  var CODE_TO_ID = {
    SURAT: ids['gdoc_template_surat'], ST: ids['gdoc_template_surat'],
    SIZ:   ids['gdoc_template_surat'], SKT: ids['gdoc_template_surat'],
    BA:    ids['gdoc_template_surat'], FCO: ids['gdoc_template_surat'],
    PROP:  ids['gdoc_template_surat'], CP:  ids['gdoc_template_surat'],
    INV:   ids['gdoc_template_inv'],
    KWT:   ids['gdoc_template_kwt'],
    SP1:   ids['gdoc_template_sp'],  SP2: ids['gdoc_template_sp'],
    SP3:   ids['gdoc_template_sp'],  PHK: ids['gdoc_template_sp'],
    PKWT:  ids['gdoc_template_pkwt'], SPG: ids['gdoc_template_pkwt'],
    SMT:   ids['gdoc_template_pkwt'], PI:  ids['gdoc_template_pkwt'],
    MOU:   ids['gdoc_template_mou'], PKS: ids['gdoc_template_mou'],
  };

  var sheet = _getDB().getSheetByName('document_types');
  if (!sheet) { Logger.log('⚠️ Sheet document_types tidak ditemukan.'); return; }

  var data = sheet.getDataRange().getValues();
  // Header row: code(0) label(1) category(2) folder_name(3) template_gdoc_id(4) is_active(5)
  for (var i = 1; i < data.length; i++) {
    var code = String(data[i][0] || '').trim();
    if (!code) continue;
    var id = CODE_TO_ID[code];
    if (id) {
      sheet.getRange(i + 1, 5).setValue(id); // kolom E
      Logger.log('  document_types[' + code + '] → ' + id);
    }
  }
  Logger.log('✅ document_types.template_gdoc_id diisi.');
}


// ═══════════════════════════════════════════════════════
// HELPER: Header perusahaan + styling
// ═══════════════════════════════════════════════════════

function _makeDocBody(doc, config) {
  var body = doc.getBody();
  body.clear();
  body.setMarginTop(50).setMarginBottom(72).setMarginLeft(80).setMarginRight(72);

  // Gunakan {{PLACEHOLDER}} agar nama & alamat diganti saat generate per perusahaan
  var p1 = body.appendParagraph('{{COMPANY_NAME}}');
  p1.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  p1.editAsText().setFontFamily('Arial').setFontSize(14).setBold(true).setForegroundColor('#C40000');

  var p2 = body.appendParagraph('{{COMPANY_ADDRESS}}');
  p2.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  p2.editAsText().setFontFamily('Arial').setFontSize(9).setBold(false).setForegroundColor('#444444');

  var p3 = body.appendParagraph('Telp: {{COMPANY_PHONE}}   |   Email: {{COMPANY_EMAIL}}');
  p3.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  p3.editAsText().setFontFamily('Arial').setFontSize(9).setForegroundColor('#444444');

  body.appendHorizontalRule();
  return body;
}

function _line(body, text, size, bold, color, align) {
  var p = body.appendParagraph(String(text || ''));
  if (align) p.setAlignment(align);
  p.editAsText()
    .setFontFamily('Arial')
    .setFontSize(size  || 11)
    .setBold(bold      || false)
    .setForegroundColor(color || '#1A1A1A');
  return p;
}

function _sp(body) { body.appendParagraph(''); }

function _finalizeDoc(doc, folder) {
  doc.saveAndClose();
  DriveApp.getFileById(doc.getId()).moveTo(folder);
  Logger.log('✅ ' + doc.getName() + ' → ' + doc.getId());
  return doc.getId();
}


// ═══════════════════════════════════════════════════════
// TEMPLATE 1: SURAT
// Digunakan oleh: SURAT, ST, SIZ, SKT, BA, FCO, PROP, CP
// ═══════════════════════════════════════════════════════

function _makeSuratTemplate(config, folder) {
  var doc  = DocumentApp.create('[TEMPLATE] Surat — RIFIM OS');
  var body = _makeDocBody(doc, config);

  _sp(body);

  // Judul dokumen (berubah per jenis: Surat Tugas, Surat Izin, dsb)
  var titleP = _line(body, '{{DOCUMENT_TITLE}}', 13, true, '#C40000',
                     DocumentApp.HorizontalAlignment.CENTER);

  _sp(body);

  _line(body, 'Nomor\t\t: {{DOCUMENT_NUMBER}}', 11);
  _line(body, 'Lampiran\t: {{ATTACHMENT}}', 11);
  _line(body, 'Perihal\t\t: {{SUBJECT}}', 11);

  _sp(body);

  _line(body, '{{CITY}}, {{DOCUMENT_DATE}}', 11, false, '#1A1A1A',
        DocumentApp.HorizontalAlignment.RIGHT);

  _sp(body);

  _line(body, 'Kepada Yth.', 11);
  _line(body, '{{RECIPIENT_NAME}}', 11, true);
  _line(body, '{{RECIPIENT_ADDRESS}}', 11);

  _sp(body);
  _line(body, 'Dengan hormat,', 11);
  _sp(body);

  _line(body, '{{BODY}}', 11);

  _sp(body);
  _line(body, 'Demikian surat ini kami sampaikan. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.', 11);
  _sp(body);

  _line(body, 'Hormat kami,', 11);
  _line(body, '{{COMPANY_NAME}}', 11, true);
  _sp(body); _sp(body); _sp(body);

  _line(body, '{{DIRECTOR_NAME}}', 11, true);
  _line(body, '{{DIRECTOR_TITLE}}', 11);

  return _finalizeDoc(doc, folder);
}


// ═══════════════════════════════════════════════════════
// TEMPLATE 2: INVOICE
// Digunakan oleh: INV
// ═══════════════════════════════════════════════════════

function _makeInvoiceTemplate(config, folder) {
  var doc  = DocumentApp.create('[TEMPLATE] Invoice — RIFIM OS');
  var body = _makeDocBody(doc, config);

  _sp(body);
  _line(body, 'I N V O I C E', 16, true, '#C40000',
        DocumentApp.HorizontalAlignment.CENTER);
  _sp(body);

  _line(body, 'Nomor Invoice\t\t: {{DOCUMENT_NUMBER}}', 11);
  _line(body, 'Tanggal Invoice\t: {{DOCUMENT_DATE}}', 11);
  _line(body, 'Jatuh Tempo\t\t: {{DUE_DATE}}', 11);
  _line(body, 'Status Pembayaran\t: {{STATUS}}', 11, true);

  _sp(body);
  _line(body, 'DITAGIHKAN KEPADA:', 11, true, '#C40000');
  _line(body, '{{CLIENT_NAME}}', 11, true);
  _line(body, '{{CLIENT_ADDRESS}}', 11);
  _line(body, 'Telp: {{CLIENT_PHONE}}', 11);

  _sp(body);
  body.appendHorizontalRule();
  _line(body, 'RINCIAN LAYANAN / ITEM', 11, true, '#C40000');
  body.appendHorizontalRule();
  _sp(body);

  _line(body, '{{ITEMS}}', 11);

  _sp(body);
  body.appendHorizontalRule();
  _line(body, 'Subtotal\t\t\t\t: {{SUBTOTAL}}', 11);
  _line(body, 'PPN {{TAX_PERCENT}}%\t\t\t: {{TAX_AMOUNT}}', 11);
  _line(body, 'GRAND TOTAL\t\t\t: {{GRAND_TOTAL}}', 12, true, '#C40000');
  body.appendHorizontalRule();

  _sp(body);
  _line(body, 'INFORMASI PEMBAYARAN', 11, true);
  _line(body, 'Bank\t\t\t: {{BANK_NAME}}', 11);
  _line(body, 'No. Rekening\t: {{BANK_ACCOUNT}}', 11);
  _line(body, 'Atas Nama\t: {{BANK_HOLDER}}', 11);
  _line(body, 'Syarat\t\t: {{PAYMENT_TERMS}}', 11);

  _sp(body);
  _line(body, 'Catatan: {{NOTES}}', 10, false, '#666666');

  _sp(body); _sp(body);
  _line(body, 'Hormat kami,', 11);
  _line(body, '{{COMPANY_NAME}}', 11, true);
  _sp(body); _sp(body); _sp(body);

  _line(body, '{{DIRECTOR_NAME}}', 11, true);
  _line(body, '{{DIRECTOR_TITLE}}', 11);

  return _finalizeDoc(doc, folder);
}


// ═══════════════════════════════════════════════════════
// TEMPLATE 3: KWITANSI
// Digunakan oleh: KWT
// ═══════════════════════════════════════════════════════

function _makeKwitansiTemplate(config, folder) {
  var doc  = DocumentApp.create('[TEMPLATE] Kwitansi — RIFIM OS');
  var body = _makeDocBody(doc, config);

  _sp(body);
  _line(body, 'K W I T A N S I', 16, true, '#C40000',
        DocumentApp.HorizontalAlignment.CENTER);
  _line(body, 'Nomor: {{DOCUMENT_NUMBER}}', 11, false, '#1A1A1A',
        DocumentApp.HorizontalAlignment.CENTER);

  _sp(body); body.appendHorizontalRule(); _sp(body);

  _line(body, 'Telah diterima dari\t\t: {{PAYER_NAME}}', 11, true);
  _line(body, 'Tanggal Pembayaran\t: {{PAYMENT_DATE}}', 11);
  _sp(body);
  _line(body, 'Keterangan\t: {{PAYMENT_PURPOSE}}', 11);
  _line(body, 'Rincian\t\t:\n{{PAYMENT_DETAIL}}', 11);
  _sp(body);

  body.appendHorizontalRule();
  _line(body, 'JUMLAH\t: {{AMOUNT}}', 13, true, '#C40000');
  _line(body, 'Terbilang\t: {{AMOUNT_TEXT}}', 11);
  body.appendHorizontalRule();

  _sp(body);
  _line(body, '{{CITY}}, {{DOCUMENT_DATE}}', 11, false, '#1A1A1A',
        DocumentApp.HorizontalAlignment.RIGHT);
  _sp(body);
  _line(body, 'Yang menerima,', 11);
  _line(body, '{{COMPANY_NAME}}', 11, true);
  _sp(body); _sp(body); _sp(body);

  _line(body, '{{DIRECTOR_NAME}}', 11, true);
  _line(body, '{{DIRECTOR_TITLE}}', 11);

  return _finalizeDoc(doc, folder);
}


// ═══════════════════════════════════════════════════════
// TEMPLATE 4: SURAT PERINGATAN
// Digunakan oleh: SP1, SP2, SP3, PHK
// ═══════════════════════════════════════════════════════

function _makeSPTemplate(config, folder) {
  var doc  = DocumentApp.create('[TEMPLATE] Surat Peringatan — RIFIM OS');
  var body = _makeDocBody(doc, config);

  _sp(body);
  _line(body, '{{DOCUMENT_TITLE}}', 13, true, '#C40000',
        DocumentApp.HorizontalAlignment.CENTER);
  _line(body, 'Nomor: {{DOCUMENT_NUMBER}}', 11, false, '#1A1A1A',
        DocumentApp.HorizontalAlignment.CENTER);

  _sp(body);
  _line(body, 'Yang bertanda tangan di bawah ini, Pimpinan {{COMPANY_NAME}}, menerangkan bahwa:', 11);
  _line(body, 'dengan ini memberikan teguran/peringatan resmi kepada karyawan:', 11);

  _sp(body);
  _line(body, 'Nama Karyawan\t: {{EMPLOYEE_NAME}}', 11, true);
  _line(body, 'ID Karyawan\t\t: {{EMPLOYEE_ID}}', 11);
  _line(body, 'Jabatan\t\t\t: {{EMPLOYEE_POSITION}}', 11);
  _line(body, 'Departemen\t\t: {{EMPLOYEE_DEPT}}', 11);

  _sp(body); body.appendHorizontalRule(); _sp(body);
  _line(body, '{{BODY}}', 11);
  _sp(body); body.appendHorizontalRule(); _sp(body);

  _line(body, 'Surat ini merupakan tindakan disiplin resmi perusahaan. Karyawan yang bersangkutan', 11);
  _line(body, 'diharapkan segera memperbaiki diri dan tidak mengulangi pelanggaran yang sama.', 11);

  _sp(body);
  _line(body, '{{CITY}}, {{DOCUMENT_DATE}}', 11);
  _sp(body);

  var tbl = body.appendTable([
    ['Pimpinan Perusahaan,', 'Karyawan yang bersangkutan,'],
    ['{{COMPANY_NAME}}', ''],
    ['', ''],
    ['', ''],
    ['', ''],
    ['{{DIRECTOR_NAME}}\n{{DIRECTOR_TITLE}}', '{{EMPLOYEE_NAME}}\n{{EMPLOYEE_POSITION}}'],
  ]);
  tbl.setBorderWidth(0);
  tbl.setColumnWidth(0, 250);
  tbl.setColumnWidth(1, 250);

  return _finalizeDoc(doc, folder);
}


// ═══════════════════════════════════════════════════════
// TEMPLATE 5: PKWT / KONTRAK
// Digunakan oleh: PKWT, SPG (Pengangkatan), SMT (Mutasi), PI (Pakta Integritas)
// ═══════════════════════════════════════════════════════

function _makePKWTTemplate(config, folder) {
  var doc  = DocumentApp.create('[TEMPLATE] PKWT — RIFIM OS');
  var body = _makeDocBody(doc, config);

  _sp(body);
  _line(body, '{{DOCUMENT_TITLE}}', 13, true, '#C40000',
        DocumentApp.HorizontalAlignment.CENTER);
  _line(body, 'Nomor: {{DOCUMENT_NUMBER}}', 11, false, '#1A1A1A',
        DocumentApp.HorizontalAlignment.CENTER);

  _sp(body);
  _line(body, 'Pada hari ini, {{DOCUMENT_DATE}}, dibuat dan ditandatangani perjanjian/surat antara:', 11);

  _sp(body);
  _line(body, 'PIHAK PERTAMA', 11, true, '#C40000');
  _line(body, 'Perusahaan\t: {{COMPANY_NAME}}', 11);
  _line(body, 'Diwakili\t\t: {{DIRECTOR_NAME}}', 11);
  _line(body, 'Jabatan\t\t: {{DIRECTOR_TITLE}}', 11);

  _sp(body);
  _line(body, 'PIHAK KEDUA', 11, true, '#C40000');
  _line(body, 'Nama\t\t\t: {{EMPLOYEE_NAME}}', 11);
  _line(body, 'NIK / KTP\t\t: {{EMPLOYEE_ID_CARD}}', 11);
  _line(body, 'Jabatan\t\t\t: {{EMPLOYEE_POSITION}}', 11);
  _line(body, 'Departemen\t\t: {{EMPLOYEE_DEPT}}', 11);

  _sp(body); body.appendHorizontalRule();
  _line(body, 'ISI PERJANJIAN / KEPUTUSAN', 11, true, '#C40000');
  body.appendHorizontalRule(); _sp(body);

  _line(body, '{{BODY}}', 11);

  _sp(body);
  _line(body, 'Perjanjian / Surat Keputusan ini berlaku sejak ditandatangani kedua pihak.', 11);

  _sp(body);
  _line(body, '{{CITY}}, {{DOCUMENT_DATE}}', 11);
  _sp(body);

  var tbl = body.appendTable([
    ['PIHAK PERTAMA', 'PIHAK KEDUA'],
    ['{{COMPANY_NAME}}', ''],
    ['', ''],
    ['', ''],
    ['', ''],
    ['{{DIRECTOR_NAME}}\n{{DIRECTOR_TITLE}}', '{{EMPLOYEE_NAME}}'],
  ]);
  tbl.setBorderWidth(0);
  tbl.setColumnWidth(0, 250);
  tbl.setColumnWidth(1, 250);

  return _finalizeDoc(doc, folder);
}


// ═══════════════════════════════════════════════════════
// TEMPLATE 6: MOU / PERJANJIAN KERJASAMA
// Digunakan oleh: MOU, PKS
// ═══════════════════════════════════════════════════════

function _makeMOUTemplate(config, folder) {
  var doc  = DocumentApp.create('[TEMPLATE] MOU — RIFIM OS');
  var body = _makeDocBody(doc, config);

  _sp(body);
  _line(body, '{{DOCUMENT_TITLE}}', 13, true, '#C40000',
        DocumentApp.HorizontalAlignment.CENTER);
  _line(body, 'Nomor: {{DOCUMENT_NUMBER}}', 11, false, '#1A1A1A',
        DocumentApp.HorizontalAlignment.CENTER);

  _sp(body);
  _line(body, 'Pada hari {{SIGNING_DAY}}, tanggal {{DOCUMENT_DATE}}, telah disepakati oleh:', 11);

  _sp(body);
  _line(body, 'PIHAK PERTAMA', 11, true, '#C40000');
  _line(body, 'Perusahaan\t: {{COMPANY_NAME}}', 11);
  _line(body, 'Diwakili\t\t: {{DIRECTOR_NAME}}', 11);
  _line(body, 'Jabatan\t\t: {{DIRECTOR_TITLE}}', 11);
  _line(body, 'Alamat\t\t: {{COMPANY_ADDRESS}}', 11);

  _sp(body);
  _line(body, 'PIHAK KEDUA', 11, true, '#C40000');
  _line(body, 'Perusahaan\t: {{PARTY_B_NAME}}', 11);
  _line(body, 'Diwakili\t\t: {{PARTY_B_PIC}}', 11);
  _line(body, 'Jabatan\t\t: {{PARTY_B_TITLE}}', 11);
  _line(body, 'Alamat\t\t: {{PARTY_B_ADDRESS}}', 11);

  _sp(body); body.appendHorizontalRule();
  _line(body, 'ISI KESEPAKATAN', 11, true, '#C40000');
  body.appendHorizontalRule(); _sp(body);

  _line(body, '{{BODY}}', 11);

  _sp(body);
  _line(body, 'Nota ini berlaku sejak tanggal penandatanganan hingga {{END_DATE}}.', 11);
  _line(body, 'Hal yang belum diatur akan disepakati kemudian atas dasar musyawarah mufakat.', 11);

  _sp(body); _sp(body);
  var tbl = body.appendTable([
    ['PIHAK PERTAMA', 'PIHAK KEDUA'],
    ['{{COMPANY_NAME}}', '{{PARTY_B_NAME}}'],
    ['', ''],
    ['', ''],
    ['', ''],
    ['{{DIRECTOR_NAME}}\n{{DIRECTOR_TITLE}}', '{{PARTY_B_PIC}}\n{{PARTY_B_TITLE}}'],
  ]);
  tbl.setBorderWidth(0);
  tbl.setColumnWidth(0, 250);
  tbl.setColumnWidth(1, 250);

  return _finalizeDoc(doc, folder);
}


// ═══════════════════════════════════════════════════════
// HELPER: Simpan template IDs ke company_config
// ═══════════════════════════════════════════════════════

function _saveTemplateIds(ids) {
  var ss    = _getDB();
  var sheet = ss.getSheetByName('company_config');
  if (!sheet) {
    Logger.log('⚠️ Sheet company_config tidak ditemukan — membuat baru...');
    sheet = ss.insertSheet('company_config');
    sheet.appendRow(['key', 'value', 'description']);
  }

  var data     = sheet.getDataRange().getValues();
  var existing = {};
  for (var i = 1; i < data.length; i++) {
    existing[data[i][0]] = i + 1;
  }

  Object.keys(ids).forEach(function(key) {
    if (existing[key]) {
      sheet.getRange(existing[key], 2).setValue(ids[key]);
      Logger.log('  updated: ' + key);
    } else {
      sheet.appendRow([key, ids[key], 'ID template Google Doc — set by setupAllTemplates()']);
      Logger.log('  added: ' + key);
    }
  });

  Logger.log('✅ Template IDs tersimpan ke company_config');
}


// ═══════════════════════════════════════════════════════
// TEMPLATE KHUSUS PT. MENALA INTERNASIONAL GEMILANG (MIG)
// Dengan Logo, TTD, dan Stempel tertanam langsung di dokumen.
//
// Drive File IDs (logo/TTD/stempel sudah ada di Drive):
//   logo.png       → 1mQqV99UdKXkwz1E1lKTjb2UtzhWmOFX9
//   TTD bobby.png  → 1_MCuWfbC1InzU1pWhVmdi2ah4QC8r3uy
//   stempel.png    → 1zmEVKU2cwaBkZtl0Ki96P-nQ74YUTPjb
// ═══════════════════════════════════════════════════════

/**
 * Buat 6 template Google Doc untuk PT. Menala dengan Logo, TTD, Stempel.
 * Jalankan SATU KALI dari Apps Script Editor: createMenalaTemplates → Run
 *
 * Prasyarat:
 *   1. setupCompaniesSheet() sudah dijalankan
 *   2. createAllTemplates() sudah dijalankan (untuk template RIFIM & LAILAN)
 */
function createMenalaTemplates() {
  var LOGO_ID    = '1mQqV99UdKXkwz1E1lKTjb2UtzhWmOFX9';
  var TTD_ID     = '1_MCuWfbC1InzU1pWhVmdi2ah4QC8r3uy';
  var STEMPEL_ID = '1zmEVKU2cwaBkZtl0Ki96P-nQ74YUTPjb';

  var config    = getCompanyConfig();
  var rootId    = config['drive_root_folder_id'];
  var rootFolder;
  try {
    rootFolder = rootId ? DriveApp.getFolderById(rootId) : DriveApp.getRootFolder();
  } catch (_) {
    rootFolder = DriveApp.getRootFolder();
  }
  var migFolder = _getOrCreateFolder(rootFolder, 'Templates MIG');
  Logger.log('📁 Folder MIG: ' + migFolder.getId());

  var assets = { logoId: LOGO_ID, ttdId: TTD_ID, stempelId: STEMPEL_ID };

  Logger.log('=== Membuat 6 template PT. Menala ===');
  var ids = {};
  ids['tpl_surat'] = _makeMigSuratTemplate(migFolder, assets);
  ids['tpl_inv']   = _makeMigInvoiceTemplate(migFolder, assets);
  ids['tpl_kwt']   = _makeMigKwitansiTemplate(migFolder, assets);
  ids['tpl_sp']    = _makeMigSPTemplate(migFolder, assets);
  ids['tpl_pkwt']  = _makeMigPKWTTemplate(migFolder, assets);
  ids['tpl_mou']   = _makeMigMOUTemplate(migFolder, assets);

  _saveMigTemplateIds(ids);

  Logger.log('=== Template MIG selesai ===');
  Object.keys(ids).forEach(function(k) { Logger.log(k + ': ' + ids[k]); });
  Logger.log('✅ Cek sheet companies baris MIG kolom tpl_*');
}

/**
 * Kop surat MIG: tabel borderless Logo (kiri) | Nama+Alamat+Telp (kanan).
 */
function _makeMigDocBody(doc, assets) {
  var body = doc.getBody();
  body.clear();
  body.setMarginTop(36).setMarginBottom(72).setMarginLeft(72).setMarginRight(72);

  var logoBlob = DriveApp.getFileById(assets.logoId).getBlob();

  var tbl = body.appendTable([['', '']]);
  tbl.setBorderWidth(0);

  // Kolom kiri: logo
  var leftCell = tbl.getCell(0, 0);
  leftCell.clear();
  leftCell.getChild(0).asParagraph().appendInlineImage(logoBlob).setWidth(120).setHeight(55);
  leftCell.setVerticalAlignment(DocumentApp.VerticalAlignment.MIDDLE);

  // Kolom kanan: info perusahaan
  var rightCell = tbl.getCell(0, 1);
  rightCell.clear();
  var rp1 = rightCell.getChild(0).asParagraph();
  rp1.appendText('{{COMPANY_NAME}}');
  rp1.editAsText().setFontFamily('Arial').setFontSize(13).setBold(true).setForegroundColor('#C40000');
  rightCell.appendParagraph('{{COMPANY_ADDRESS}}')
    .editAsText().setFontFamily('Arial').setFontSize(9).setBold(false).setForegroundColor('#444444');
  rightCell.appendParagraph('Telp: {{COMPANY_PHONE}}   |   Email: {{COMPANY_EMAIL}}')
    .editAsText().setFontFamily('Arial').setFontSize(9).setForegroundColor('#444444');
  rightCell.setVerticalAlignment(DocumentApp.VerticalAlignment.MIDDLE);

  body.appendHorizontalRule();
  return body;
}

/**
 * Blok tanda tangan MIG: nama perusahaan → TTD+Stempel (inline) → nama direktur.
 */
function _makeMigSignature(body, assets) {
  _sp(body);
  _line(body, 'Hormat kami,', 11);
  _line(body, '{{COMPANY_NAME}}', 11, true);
  _sp(body);

  var ttdBlob     = DriveApp.getFileById(assets.ttdId).getBlob();
  var stempelBlob = DriveApp.getFileById(assets.stempelId).getBlob();

  var sigTbl = body.appendTable([['', '']]);
  sigTbl.setBorderWidth(0);

  var ttdCell = sigTbl.getCell(0, 0);
  ttdCell.clear();
  ttdCell.getChild(0).asParagraph().appendInlineImage(ttdBlob).setWidth(90).setHeight(45);

  var stempelCell = sigTbl.getCell(0, 1);
  stempelCell.clear();
  stempelCell.getChild(0).asParagraph().appendInlineImage(stempelBlob).setWidth(70).setHeight(70);

  _line(body, '{{DIRECTOR_NAME}}', 11, true);
  _line(body, '{{DIRECTOR_TITLE}}', 11);
}

function _makeMigSuratTemplate(folder, assets) {
  var doc  = DocumentApp.create('[TEMPLATE] Surat — PT. Menala');
  var body = _makeMigDocBody(doc, assets);

  _sp(body);
  _line(body, '{{DOCUMENT_TITLE}}', 13, true, '#C40000', DocumentApp.HorizontalAlignment.CENTER);
  _sp(body);

  _line(body, 'Nomor\t\t: {{DOCUMENT_NUMBER}}', 11);
  _line(body, 'Lampiran\t: {{ATTACHMENT}}', 11);
  _line(body, 'Perihal\t\t: {{SUBJECT}}', 11);
  _sp(body);

  _line(body, '{{CITY}}, {{DOCUMENT_DATE}}', 11, false, '#1A1A1A', DocumentApp.HorizontalAlignment.RIGHT);
  _sp(body);

  _line(body, 'Kepada Yth.', 11);
  _line(body, '{{RECIPIENT_NAME}}', 11, true);
  _line(body, '{{RECIPIENT_ADDRESS}}', 11);
  _sp(body);

  _line(body, 'Dengan hormat,', 11);
  _sp(body);
  _line(body, '{{BODY}}', 11);
  _sp(body);
  _line(body, 'Demikian surat ini kami sampaikan. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.', 11);

  _makeMigSignature(body, assets);
  return _finalizeDoc(doc, folder);
}

function _makeMigInvoiceTemplate(folder, assets) {
  var doc  = DocumentApp.create('[TEMPLATE] Invoice — PT. Menala');
  var body = _makeMigDocBody(doc, assets);

  _sp(body);
  _line(body, 'I N V O I C E', 16, true, '#C40000', DocumentApp.HorizontalAlignment.CENTER);
  _sp(body);

  _line(body, 'Nomor Invoice\t\t: {{DOCUMENT_NUMBER}}', 11);
  _line(body, 'Tanggal Invoice\t: {{DOCUMENT_DATE}}', 11);
  _line(body, 'Jatuh Tempo\t\t: {{DUE_DATE}}', 11);
  _line(body, 'Status Pembayaran\t: {{STATUS}}', 11, true);
  _sp(body);

  _line(body, 'DITAGIHKAN KEPADA:', 11, true, '#C40000');
  _line(body, '{{CLIENT_NAME}}', 11, true);
  _line(body, '{{CLIENT_ADDRESS}}', 11);
  _line(body, 'Telp: {{CLIENT_PHONE}}', 11);
  _sp(body);

  body.appendHorizontalRule();
  _line(body, 'RINCIAN LAYANAN / ITEM', 11, true, '#C40000');
  body.appendHorizontalRule();
  _sp(body);
  _line(body, '{{ITEMS}}', 11);
  _sp(body);

  body.appendHorizontalRule();
  _line(body, 'Subtotal\t\t\t\t: {{SUBTOTAL}}', 11);
  _line(body, 'PPN {{TAX_PERCENT}}%\t\t\t: {{TAX_AMOUNT}}', 11);
  _line(body, 'GRAND TOTAL\t\t\t: {{GRAND_TOTAL}}', 12, true, '#C40000');
  body.appendHorizontalRule();
  _sp(body);

  _line(body, 'INFORMASI PEMBAYARAN', 11, true);
  _line(body, 'Bank\t\t\t: {{BANK_NAME}}', 11);
  _line(body, 'No. Rekening\t: {{BANK_ACCOUNT}}', 11);
  _line(body, 'Atas Nama\t: {{BANK_HOLDER}}', 11);
  _line(body, 'Syarat\t\t: {{PAYMENT_TERMS}}', 11);
  _sp(body);
  _line(body, 'Catatan: {{NOTES}}', 10, false, '#666666');

  _makeMigSignature(body, assets);
  return _finalizeDoc(doc, folder);
}

function _makeMigKwitansiTemplate(folder, assets) {
  var doc  = DocumentApp.create('[TEMPLATE] Kwitansi — PT. Menala');
  var body = _makeMigDocBody(doc, assets);

  _sp(body);
  _line(body, 'K W I T A N S I', 16, true, '#C40000', DocumentApp.HorizontalAlignment.CENTER);
  _line(body, 'Nomor: {{DOCUMENT_NUMBER}}', 11, false, '#1A1A1A', DocumentApp.HorizontalAlignment.CENTER);
  _sp(body); body.appendHorizontalRule(); _sp(body);

  _line(body, 'Telah diterima dari\t\t: {{PAYER_NAME}}', 11, true);
  _line(body, 'Tanggal Pembayaran\t: {{PAYMENT_DATE}}', 11);
  _sp(body);
  _line(body, 'Keterangan\t: {{PAYMENT_PURPOSE}}', 11);
  _line(body, 'Rincian\t\t:\n{{PAYMENT_DETAIL}}', 11);
  _sp(body);

  body.appendHorizontalRule();
  _line(body, 'JUMLAH\t: {{AMOUNT}}', 13, true, '#C40000');
  _line(body, 'Terbilang\t: {{AMOUNT_TEXT}}', 11);
  body.appendHorizontalRule();
  _sp(body);

  _line(body, '{{CITY}}, {{DOCUMENT_DATE}}', 11, false, '#1A1A1A', DocumentApp.HorizontalAlignment.RIGHT);
  _sp(body);
  _line(body, 'Yang menerima,', 11);
  _line(body, '{{COMPANY_NAME}}', 11, true);
  _sp(body);

  var ttdBlob     = DriveApp.getFileById(assets.ttdId).getBlob();
  var stempelBlob = DriveApp.getFileById(assets.stempelId).getBlob();
  var sigTbl      = body.appendTable([['', '']]);
  sigTbl.setBorderWidth(0);
  var ttdSigCell  = sigTbl.getCell(0, 0);
  ttdSigCell.clear();
  ttdSigCell.getChild(0).asParagraph().appendInlineImage(ttdBlob).setWidth(90).setHeight(45);
  var stpSigCell  = sigTbl.getCell(0, 1);
  stpSigCell.clear();
  stpSigCell.getChild(0).asParagraph().appendInlineImage(stempelBlob).setWidth(70).setHeight(70);

  _line(body, '{{DIRECTOR_NAME}}', 11, true);
  _line(body, '{{DIRECTOR_TITLE}}', 11);
  return _finalizeDoc(doc, folder);
}

function _makeMigSPTemplate(folder, assets) {
  var doc  = DocumentApp.create('[TEMPLATE] Surat Peringatan — PT. Menala');
  var body = _makeMigDocBody(doc, assets);

  _sp(body);
  _line(body, '{{DOCUMENT_TITLE}}', 13, true, '#C40000', DocumentApp.HorizontalAlignment.CENTER);
  _line(body, 'Nomor: {{DOCUMENT_NUMBER}}', 11, false, '#1A1A1A', DocumentApp.HorizontalAlignment.CENTER);
  _sp(body);

  _line(body, 'Yang bertanda tangan di bawah ini, Pimpinan {{COMPANY_NAME}}, menerangkan bahwa:', 11);
  _line(body, 'dengan ini memberikan teguran/peringatan resmi kepada karyawan:', 11);
  _sp(body);
  _line(body, 'Nama Karyawan\t: {{EMPLOYEE_NAME}}', 11, true);
  _line(body, 'ID Karyawan\t\t: {{EMPLOYEE_ID}}', 11);
  _line(body, 'Jabatan\t\t\t: {{EMPLOYEE_POSITION}}', 11);
  _line(body, 'Departemen\t\t: {{EMPLOYEE_DEPT}}', 11);
  _sp(body); body.appendHorizontalRule(); _sp(body);
  _line(body, '{{BODY}}', 11);
  _sp(body); body.appendHorizontalRule(); _sp(body);
  _line(body, 'Surat ini merupakan tindakan disiplin resmi perusahaan. Karyawan yang bersangkutan', 11);
  _line(body, 'diharapkan segera memperbaiki diri dan tidak mengulangi pelanggaran yang sama.', 11);
  _sp(body);
  _line(body, '{{CITY}}, {{DOCUMENT_DATE}}', 11);
  _sp(body);

  var ttdBlob     = DriveApp.getFileById(assets.ttdId).getBlob();
  var stempelBlob = DriveApp.getFileById(assets.stempelId).getBlob();

  var tbl = body.appendTable([
    ['Pimpinan Perusahaan,', 'Karyawan yang bersangkutan,'],
    ['{{COMPANY_NAME}}', ''],
    ['', ''],
    ['{{DIRECTOR_NAME}}\n{{DIRECTOR_TITLE}}', '{{EMPLOYEE_NAME}}\n{{EMPLOYEE_POSITION}}'],
  ]);
  tbl.setBorderWidth(0);
  tbl.setColumnWidth(0, 250);
  tbl.setColumnWidth(1, 250);

  // Embed TTD + stempel inline in row 2 left cell
  var imgCell = tbl.getCell(2, 0);
  imgCell.clear();
  var imgPara = imgCell.getChild(0).asParagraph();
  imgPara.appendInlineImage(ttdBlob).setWidth(80).setHeight(40);
  imgPara.appendInlineImage(stempelBlob).setWidth(60).setHeight(60);

  return _finalizeDoc(doc, folder);
}

function _makeMigPKWTTemplate(folder, assets) {
  var doc  = DocumentApp.create('[TEMPLATE] PKWT — PT. Menala');
  var body = _makeMigDocBody(doc, assets);

  _sp(body);
  _line(body, '{{DOCUMENT_TITLE}}', 13, true, '#C40000', DocumentApp.HorizontalAlignment.CENTER);
  _line(body, 'Nomor: {{DOCUMENT_NUMBER}}', 11, false, '#1A1A1A', DocumentApp.HorizontalAlignment.CENTER);
  _sp(body);
  _line(body, 'Pada hari ini, {{DOCUMENT_DATE}}, dibuat dan ditandatangani perjanjian/surat antara:', 11);
  _sp(body);
  _line(body, 'PIHAK PERTAMA', 11, true, '#C40000');
  _line(body, 'Perusahaan\t: {{COMPANY_NAME}}', 11);
  _line(body, 'Diwakili\t\t: {{DIRECTOR_NAME}}', 11);
  _line(body, 'Jabatan\t\t: {{DIRECTOR_TITLE}}', 11);
  _sp(body);
  _line(body, 'PIHAK KEDUA', 11, true, '#C40000');
  _line(body, 'Nama\t\t\t: {{EMPLOYEE_NAME}}', 11);
  _line(body, 'NIK / KTP\t\t: {{EMPLOYEE_ID_CARD}}', 11);
  _line(body, 'Jabatan\t\t\t: {{EMPLOYEE_POSITION}}', 11);
  _line(body, 'Departemen\t\t: {{EMPLOYEE_DEPT}}', 11);
  _sp(body); body.appendHorizontalRule();
  _line(body, 'ISI PERJANJIAN / KEPUTUSAN', 11, true, '#C40000');
  body.appendHorizontalRule(); _sp(body);
  _line(body, '{{BODY}}', 11);
  _sp(body);
  _line(body, 'Perjanjian / Surat Keputusan ini berlaku sejak ditandatangani kedua pihak.', 11);
  _sp(body);
  _line(body, '{{CITY}}, {{DOCUMENT_DATE}}', 11);
  _sp(body);

  var ttdBlob     = DriveApp.getFileById(assets.ttdId).getBlob();
  var stempelBlob = DriveApp.getFileById(assets.stempelId).getBlob();

  var tbl = body.appendTable([
    ['PIHAK PERTAMA', 'PIHAK KEDUA'],
    ['{{COMPANY_NAME}}', ''],
    ['', ''],
    ['{{DIRECTOR_NAME}}\n{{DIRECTOR_TITLE}}', '{{EMPLOYEE_NAME}}'],
  ]);
  tbl.setBorderWidth(0);
  tbl.setColumnWidth(0, 250);
  tbl.setColumnWidth(1, 250);

  var imgCell = tbl.getCell(2, 0);
  imgCell.clear();
  var imgPara = imgCell.getChild(0).asParagraph();
  imgPara.appendInlineImage(ttdBlob).setWidth(80).setHeight(40);
  imgPara.appendInlineImage(stempelBlob).setWidth(60).setHeight(60);

  return _finalizeDoc(doc, folder);
}

function _makeMigMOUTemplate(folder, assets) {
  var doc  = DocumentApp.create('[TEMPLATE] MOU — PT. Menala');
  var body = _makeMigDocBody(doc, assets);

  _sp(body);
  _line(body, '{{DOCUMENT_TITLE}}', 13, true, '#C40000', DocumentApp.HorizontalAlignment.CENTER);
  _line(body, 'Nomor: {{DOCUMENT_NUMBER}}', 11, false, '#1A1A1A', DocumentApp.HorizontalAlignment.CENTER);
  _sp(body);
  _line(body, 'Pada hari {{SIGNING_DAY}}, tanggal {{DOCUMENT_DATE}}, telah disepakati oleh:', 11);
  _sp(body);
  _line(body, 'PIHAK PERTAMA', 11, true, '#C40000');
  _line(body, 'Perusahaan\t: {{COMPANY_NAME}}', 11);
  _line(body, 'Diwakili\t\t: {{DIRECTOR_NAME}}', 11);
  _line(body, 'Jabatan\t\t: {{DIRECTOR_TITLE}}', 11);
  _line(body, 'Alamat\t\t: {{COMPANY_ADDRESS}}', 11);
  _sp(body);
  _line(body, 'PIHAK KEDUA', 11, true, '#C40000');
  _line(body, 'Perusahaan\t: {{PARTY_B_NAME}}', 11);
  _line(body, 'Diwakili\t\t: {{PARTY_B_PIC}}', 11);
  _line(body, 'Jabatan\t\t: {{PARTY_B_TITLE}}', 11);
  _line(body, 'Alamat\t\t: {{PARTY_B_ADDRESS}}', 11);
  _sp(body); body.appendHorizontalRule();
  _line(body, 'ISI KESEPAKATAN', 11, true, '#C40000');
  body.appendHorizontalRule(); _sp(body);
  _line(body, '{{BODY}}', 11);
  _sp(body);
  _line(body, 'Nota ini berlaku sejak tanggal penandatanganan hingga {{END_DATE}}.', 11);
  _line(body, 'Hal yang belum diatur akan disepakati kemudian atas dasar musyawarah mufakat.', 11);
  _sp(body); _sp(body);

  var ttdBlob     = DriveApp.getFileById(assets.ttdId).getBlob();
  var stempelBlob = DriveApp.getFileById(assets.stempelId).getBlob();

  var tbl = body.appendTable([
    ['PIHAK PERTAMA', 'PIHAK KEDUA'],
    ['{{COMPANY_NAME}}', '{{PARTY_B_NAME}}'],
    ['', ''],
    ['{{DIRECTOR_NAME}}\n{{DIRECTOR_TITLE}}', '{{PARTY_B_PIC}}\n{{PARTY_B_TITLE}}'],
  ]);
  tbl.setBorderWidth(0);
  tbl.setColumnWidth(0, 250);
  tbl.setColumnWidth(1, 250);

  var imgCell = tbl.getCell(2, 0);
  imgCell.clear();
  var imgPara = imgCell.getChild(0).asParagraph();
  imgPara.appendInlineImage(ttdBlob).setWidth(80).setHeight(40);
  imgPara.appendInlineImage(stempelBlob).setWidth(60).setHeight(60);

  return _finalizeDoc(doc, folder);
}

/**
 * Simpan ID template ke sheet companies untuk perusahaan tertentu (baris code, kolom tpl_*).
 * Tambah kolom baru jika sheet companies lama belum punya kolom tpl_*.
 */
function _saveCompanyTemplateIds(code, ids) {
  var ss    = _getDB();
  var sheet = ss.getSheetByName('companies');
  if (!sheet) throw new Error('Sheet companies belum dibuat. Jalankan setupCompaniesSheet() dulu.');

  var data    = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });

  var TPL_COLS = ['tpl_surat','tpl_inv','tpl_kwt','tpl_sp','tpl_pkwt','tpl_mou'];
  TPL_COLS.forEach(function(col) {
    if (headers.indexOf(col) === -1) {
      var newColIdx = headers.length + 1;
      sheet.getRange(1, newColIdx).setValue(col).setFontWeight('bold');
      headers.push(col);
    }
  });

  var companyRow = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === code) { companyRow = i + 1; break; }
  }
  if (companyRow === -1) throw new Error('Baris ' + code + ' tidak ditemukan di sheet companies.');

  TPL_COLS.forEach(function(col) {
    var colIdx = headers.indexOf(col) + 1;
    sheet.getRange(companyRow, colIdx).setValue(ids[col] || '');
  });

  Logger.log('✅ Template IDs ' + code + ' tersimpan ke sheet companies.');
}

function _saveMigTemplateIds(ids) { _saveCompanyTemplateIds('MIG', ids); }


// ═══════════════════════════════════════════════════════
// TEMPLATE KHUSUS PT. RIFIM INTERNASIONAL GEMILANG
// Dengan Logo RIG, TTD Bobby, dan Stempel Rifim tertanam di dokumen.
//
// Drive File IDs (folder "Detail PT"):
//   Logo Rifim.png      → 1nCupDI298AB2BEZi-0La_fiTi7kc7GYL  (2.3MB — logo kop)
//   TTD bobby.png       → 1hacw-5aFC2RNASx2iV2fSaZTk4Ry6SZ7
//   stempel Rifim.png   → 1o4bTu5Xl_fU71NqRJy0AnQmnVyuVMQEA  (1.6MB — stempel TTD)
// ═══════════════════════════════════════════════════════

/**
 * Buat 6 template Google Doc untuk PT. RIFIM dengan Logo RIG, TTD, Stempel Rifim.
 * Jalankan SATU KALI dari Apps Script Editor: createRifimTemplates → Run
 */
function createRifimTemplates() {
  var assets = {
    logoId:    '1nCupDI298AB2BEZi-0La_fiTi7kc7GYL',  // Logo Rifim.png 2.3MB
    ttdId:     '1hacw-5aFC2RNASx2iV2fSaZTk4Ry6SZ7',  // TTD Bobby
    stempelId: '1o4bTu5Xl_fU71NqRJy0AnQmnVyuVMQEA',  // stempel Rifim.png 1.6MB
  };
  _createLogoTemplates('RIFIM', assets);
}


// ═══════════════════════════════════════════════════════
// TEMPLATE KHUSUS CV. LAILAN KALILAN INDONESIA
// Dengan Logo LAI, TTD Bobby, dan Stempel Lailan tertanam di dokumen.
//
// Drive File IDs (folder "Detail PT"):
//   logo lailan.png          → 17mfkZ8xA-TSzKqIRi9XEGT-LHobD9N_I  (592KB — logo kop)
//   TTD bobby.png            → 1hacw-5aFC2RNASx2iV2fSaZTk4Ry6SZ7
//   stempel lailankalilan.png → 1Jt45lz3VaKrXMVKNaq99vEHyIHD7Ae9Q  (7.7MB — stempel TTD)
// ═══════════════════════════════════════════════════════

/**
 * Buat 6 template Google Doc untuk CV. Lailan dengan Logo LAI, TTD, Stempel Lailan.
 * Jalankan SATU KALI dari Apps Script Editor: createLailanTemplates → Run
 */
function createLailanTemplates() {
  var assets = {
    logoId:    '17mfkZ8xA-TSzKqIRi9XEGT-LHobD9N_I',  // logo lailan.png 592KB
    ttdId:     '1hacw-5aFC2RNASx2iV2fSaZTk4Ry6SZ7',  // TTD Bobby
    stempelId: '1Jt45lz3VaKrXMVKNaq99vEHyIHD7Ae9Q',  // stempel lailankalilan.png 7.7MB
  };
  _createLogoTemplates('LAILAN', assets);
}

/**
 * Engine bersama: buat 6 template dengan logo+TTD+stempel untuk perusahaan `code`.
 * Reuse semua builder dari MIG (konten semua sama, hanya aset gambar berbeda).
 */
function _createLogoTemplates(code, assets) {
  var config     = getCompanyConfig();
  var rootId     = config['drive_root_folder_id'];
  var rootFolder;
  try { rootFolder = rootId ? DriveApp.getFolderById(rootId) : DriveApp.getRootFolder(); }
  catch (_) { rootFolder = DriveApp.getRootFolder(); }
  var tplFolder = _getOrCreateFolder(rootFolder, 'Templates ' + code);
  Logger.log('📁 Folder ' + code + ': ' + tplFolder.getId());

  Logger.log('=== Membuat 6 template ' + code + ' ===');
  var ids = {
    tpl_surat: _makeMigSuratTemplate(tplFolder, assets),
    tpl_inv:   _makeMigInvoiceTemplate(tplFolder, assets),
    tpl_kwt:   _makeMigKwitansiTemplate(tplFolder, assets),
    tpl_sp:    _makeMigSPTemplate(tplFolder, assets),
    tpl_pkwt:  _makeMigPKWTTemplate(tplFolder, assets),
    tpl_mou:   _makeMigMOUTemplate(tplFolder, assets),
  };

  _saveCompanyTemplateIds(code, ids);

  Logger.log('=== Template ' + code + ' selesai ===');
  Object.keys(ids).forEach(function(k) { Logger.log(k + ': ' + ids[k]); });
  Logger.log('✅ Cek sheet companies baris ' + code + ' kolom tpl_*');
}

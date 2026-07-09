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

  var name    = config['company_name']    || 'PT. RIFIM INTERNASIONAL GEMILANG';
  var address = config['company_address'] || 'Fanindo Blok S No. 20, Tanjung Uncang, Kota Batam';
  var phone   = config['company_phone']   || '+62 821 7010 2349';
  var email   = config['company_email']   || 'rifiminternasionalgemilang@gmail.com';

  var p1 = body.appendParagraph(name);
  p1.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  p1.editAsText().setFontFamily('Arial').setFontSize(14).setBold(true).setForegroundColor('#C40000');

  var p2 = body.appendParagraph(address);
  p2.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  p2.editAsText().setFontFamily('Arial').setFontSize(9).setBold(false).setForegroundColor('#444444');

  var p3 = body.appendParagraph('Telp: ' + phone + '   |   Email: ' + email);
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
  _line(body, 'PT. RIFIM INTERNASIONAL GEMILANG', 11, true);
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
  _line(body, 'PT. RIFIM INTERNASIONAL GEMILANG', 11, true);
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
  _line(body, 'PT. RIFIM INTERNASIONAL GEMILANG', 11, true);
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
  _line(body, 'Yang bertanda tangan di bawah ini, Pimpinan PT. RIFIM INTERNASIONAL GEMILANG,', 11);
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
    ['PT. RIFIM INTERNASIONAL GEMILANG', ''],
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
  _line(body, 'Perusahaan\t: PT. RIFIM INTERNASIONAL GEMILANG', 11);
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
    ['PT. RIFIM INTERNASIONAL GEMILANG', ''],
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
  _line(body, 'Perusahaan\t: PT. RIFIM INTERNASIONAL GEMILANG', 11);
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
    ['PT. RIFIM INTERNASIONAL GEMILANG', '{{PARTY_B_NAME}}'],
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

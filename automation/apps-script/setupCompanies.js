/**
 * RIFIM OS — Setup Companies Sheet
 * Buat sheet 'companies' dengan data 3 entitas Rifim Group.
 *
 * Cara pakai:
 * 1. Buka Apps Script Editor
 * 2. Pilih fungsi setupCompaniesSheet
 * 3. Klik Run
 */

function setupCompaniesSheet() {
  var ss       = _getDB();
  var existing = ss.getSheetByName('companies');
  if (existing) {
    Logger.log('Sheet companies sudah ada — tidak ada yang diubah.');
    return;
  }

  var config = getCompanyConfig();
  var sheet  = ss.insertSheet('companies');

  var headers = [
    'code','name','address','phone','email',
    'director_name','director_title','doc_prefix',
    'nib','npwp','city','is_active',
    'tpl_surat','tpl_inv','tpl_kwt','tpl_sp','tpl_pkwt','tpl_mou',
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

  var rifimAddress = config.company_address || '';
  var rifimPhone   = config.company_phone   || '082170102349';
  var rifimEmail   = config.company_email   || 'rifiminternationalgemilang@gmail.com';
  var rifimCity    = config.company_city    || 'Batam';
  var rifimDir     = config.director_name   || 'BOBBY RAHMAN M.B';
  var rifimTitle   = config.director_title  || 'Direktur Utama';
  var rifimNIB     = config.nib             || '';
  var rifimNPWP    = config.npwp            || '';

  var rows = [
    // RIFIM — perusahaan utama (tpl_* diisi otomatis oleh createAllTemplates)
    ['RIFIM', 'PT. RIFIM Internasional Gemilang',
      rifimAddress, rifimPhone, rifimEmail,
      rifimDir, rifimTitle, 'RIFIM',
      rifimNIB, rifimNPWP, rifimCity, true,
      '', '', '', '', '', ''],

    // MIG — PT. Menala Internasional Gemilang (tpl_* diisi oleh createMenalaTemplates)
    ['MIG', 'PT. Menala Internasional Gemilang',
      'Ruko Golden Land Tiban Blok N No.5, Tiban Indah, Sekupang, Batam, Kepulauan Riau',
      '082170102349', 'menalagemilang@gmail.com',
      'BOBBY RAHMAN M.B', 'Direktur', 'MIG',
      '1106260067028', '10.000.000.0-997.937-4', 'Batam', true,
      '', '', '', '', '', ''],

    // LAILAN — CV. Lailan Kalilan Indonesia (data sama dg RIFIM)
    ['LAILAN', 'CV. Lailan Kalilan Indonesia',
      rifimAddress, rifimPhone, rifimEmail,
      rifimDir, rifimTitle, 'LAILAN',
      '', '', rifimCity, true,
      '', '', '', '', '', ''],
  ];

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.autoResizeColumns(1, headers.length);

  Logger.log('Sheet companies berhasil dibuat dengan ' + rows.length + ' perusahaan.');
  Logger.log('RIFIM | MIG | LAILAN');
}

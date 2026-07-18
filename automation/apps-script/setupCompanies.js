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

/**
 * Isi kolom tpl_* di sheet companies dengan ID template per perusahaan.
 * Dijalankan SEKALI setelah template Drive sudah ada.
 * Bisa dipanggil via doGet?action=fill_company_tpls (sementara) atau GAS Editor.
 */
function fillCompanyTemplates() {
  var ss    = _getDB();
  var sheet = ss.getSheetByName('companies');
  if (!sheet) throw new Error('Sheet companies tidak ditemukan. Jalankan setupCompaniesSheet() dulu.');

  var TPL = {
    'RIFIM': {
      tpl_surat: '1JWcGbFWiyODAaTt_2BBs_xWu2Q0xkaQYsz-KTmFi44g',
      tpl_inv:   '1pVEt4wohHQgX_X0SsKPQOQh5DF4Uk_Z3d10Ifz24j-g',
      tpl_kwt:   '1H3xjfFjUVWLYMO7-lHWBKW-JuBWhIsGdyXF8tjDRuz8',
      tpl_sp:    '1MEbbgLCiH6zUsj7Ds7JvffFfKB55YioXgl-tn2VVQC0',
      tpl_pkwt:  '1wE9vQKSs2VFDjMiLqrYqEEg8kGCXbwo1Cw4epDQpl_c',
      tpl_mou:   '1h3CfgVvTvPHIlw4uIyXk-p_ZLjVBhiQRhyoEQDgsGHg',
    },
    'MIG': {
      tpl_surat: '1WWIbHvUhrzRa5uL0tVoKW8bMLKK6__Bma6hg8LcunTo',
      tpl_inv:   '1UycnCHK2p2UxPjAm6ZmiOF6MH9jb1sMGRHpRphsfvjU',
      tpl_kwt:   '1RLnnrfIwUL45PoKLJ0kDe4VoNHG-XhbiQyKIWGu-2FA',
      tpl_sp:    '1b7w5ErsQxdLH2X02dEfNc9FUbz9gwRPXCia95unHOVM',
      tpl_pkwt:  '1-qk7vdXx_aAy3x4X6FIvQcBSREACE6YVEdXp59ZF6Uc',
      tpl_mou:   '1hcRL6NBqEd3Fyngm9SPigfJuasJDl_0OPUn8ZpVZp54',
    },
    'LAILAN': {
      tpl_surat: '1cohEwYQCFwJu_FXRxqOo4Ghto4nP0tFIsgOec8yzFgM',
      tpl_inv:   '1i-xEywmY0zMJnZTWR6d7AKfEvE65eJAp7RkTFIjeINY',
      tpl_kwt:   '1tVgQnwFBHwe6JpRI6jpNcRw-f0dPBDEijwM8Zs3P7wQ',
      tpl_sp:    '1gPNyiV1A3Jy6dIbkA0WD4ZRxkTCOKAZcd020-MK4OmY',
      tpl_pkwt:  '1v6BL922WVhwYrKA4Bga5tsRNR3a1dwK-FGO-5qOvdk4',
      tpl_mou:   '1PBC_eEmXKVtWoJ8a03ysUW3ScQvOsvJ6nlxsC_aidC0',
    },
  };

  var TPL_COLS = ['tpl_surat','tpl_inv','tpl_kwt','tpl_sp','tpl_pkwt','tpl_mou'];
  var data     = sheet.getDataRange().getValues();
  var headers  = data[0].map(function(h) { return String(h).trim(); });
  var codeIdx  = headers.indexOf('code');
  var updated  = [];

  for (var i = 1; i < data.length; i++) {
    var code = String(data[i][codeIdx] || '').trim();
    var tpls = TPL[code];
    if (!tpls) continue;
    TPL_COLS.forEach(function(col) {
      var ci = headers.indexOf(col);
      if (ci >= 0 && tpls[col]) sheet.getRange(i + 1, ci + 1).setValue(tpls[col]);
    });
    updated.push(code);
  }

  Logger.log('fillCompanyTemplates selesai: ' + updated.join(', '));
  return { success: true, updated: updated };
}

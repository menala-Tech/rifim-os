/**
 * RIFIM OS — Branding Engine
 *
 * Sisipkan logo perusahaan ke Google Sheet (tampil di layar & PDF export).
 *
 * Setup wajib SEKALI dari GAS Editor setelah upload logo ke Drive:
 *   setupBrandingLogos({ rifim:'FILE_ID', menala:'FILE_ID', ... })
 *
 * Mapping logo (sesuai PROJECT_RULES.md):
 *   RIFIM       → PT. RIFIM Internasional Gemilang   → branding/logo/logo-rifim.png
 *   MENALA      → PT. Menala Internasional Gemilang   → branding/logo/logo-menala.png
 *   LAILAN      → CV. LailanKalilan Indonesia          → branding/logo/logo-lailan.png
 *   MAXIM       → Maxim                                → branding/logo/logo-maxim.png
 *   RIFIM_GROUP → Semua Perusahaan                    → branding/logo/logo-rifim-group.jpg
 *   ICON        → Icon App / PWA                      → branding/icon/icon-192.png
 */

// ── Drive File ID logo (diisi setelah upload ke Google Drive) ─────────────
// Jalankan setupBrandingLogosDefault() dari GAS Editor setelah ID diisi.
var _BRAND_DEFAULT_IDS = {
  rifim      : '1ylC1QAjPRT4OiRsCh1BfbrNNZI9JRpTE',  // logo-rifim.png
  menala     : '1mN9jmuWej2PjdlxqzmU90LsDhz1N1mVf',  // logo-menala.png
  lailan     : '1WC0wBexm6zIjuoKF_KEb7Znpk3Bwdv6V',  // logo-lailan.png
  maxim      : '1OC2cFMTGhGSzfkRwtLYs_ZBlaHGBe6gh',  // logo-maxim.png
  rifimGroup : '1oX0JnQSRFlVfgoctTqJQ9cz30F-Oehw3',  // logo-rifim-group.jpg
  icon       : '1GVCau2MeBXFt-yM7-B8_aSSGVp3VDS3U',  // icon-192.png
};

// ── Kunci PropertiesService ────────────────────────────────────────────────
var BRAND_KEY = {
  RIFIM       : 'brand_logo_rifim',
  MENALA      : 'brand_logo_menala',
  LAILAN      : 'brand_logo_lailan',
  MAXIM       : 'brand_logo_maxim',
  RIFIM_GROUP : 'brand_logo_rifim_group',
  ICON        : 'brand_logo_icon',
};

// ── Metadata perusahaan (untuk header sheet) ───────────────────────────────
var BRAND_INFO = {
  RIFIM: {
    nama    : 'PT. RIFIM INTERNASIONAL GEMILANG',
    alamat  : 'Batam · Jambi · Balikpapan · Manado · Pekanbaru',
    warna   : '#0D2A5E',
  },
  MENALA: {
    nama    : 'PT. MENALA INTERNASIONAL GEMILANG',
    alamat  : '',
    warna   : '#1A3A5E',
  },
  LAILAN: {
    nama    : 'CV. LAILANKALILAN INDONESIA',
    alamat  : '',
    warna   : '#2E4D7B',
  },
  RIFIM_GROUP: {
    nama    : 'RIFIM GROUP',
    alamat  : 'PT. RIFIM · PT. Menala · CV. LailanKalilan',
    warna   : '#0D2A5E',
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// 1. SETUP — simpan Drive File ID ke PropertiesService
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Daftarkan Drive File ID untuk setiap logo perusahaan.
 * Jalankan SEKALI dari GAS Editor setelah upload logo ke Google Drive.
 *
 * Cara dapat File ID:
 *   1. Upload logo ke Drive
 *   2. Klik kanan → "Get link" → copy ID dari URL
 *      https://drive.google.com/file/d/[FILE_ID]/view
 *
 * Contoh pemanggilan:
 *   setupBrandingLogos({
 *     rifim      : '1abc...xyz',
 *     menala     : '1def...uvw',
 *     lailan     : '1ghi...rst',
 *     maxim      : '1jkl...opq',
 *     rifimGroup : '1mno...lmn',
 *     icon       : '1pqr...ijk',
 *   })
 *
 * @param {Object} params
 */
/**
 * Setup logo menggunakan Drive File ID default (sudah tersimpan di kode).
 * Jalankan SEKALI dari GAS Editor setelah deploy.
 * Tidak perlu input apapun — ID sudah tertanam di _BRAND_DEFAULT_IDS.
 */
function setupBrandingLogosDefault() {
  setupBrandingLogos(_BRAND_DEFAULT_IDS);
}

function setupBrandingLogos(params) {
  if (!params) {
    SpreadsheetApp.getUi().alert(
      'Cara pakai:\nsetupBrandingLogos({\n' +
      '  rifim: "FILE_ID_LOGO_RIFIM",\n' +
      '  menala: "FILE_ID_LOGO_MENALA",\n  ...\n})');
    return;
  }
  var props = PropertiesService.getScriptProperties();
  var saved = [];
  if (params.rifim)      { props.setProperty(BRAND_KEY.RIFIM,       params.rifim);      saved.push('RIFIM'); }
  if (params.menala)     { props.setProperty(BRAND_KEY.MENALA,      params.menala);     saved.push('MENALA'); }
  if (params.lailan)     { props.setProperty(BRAND_KEY.LAILAN,      params.lailan);     saved.push('LAILAN'); }
  if (params.maxim)      { props.setProperty(BRAND_KEY.MAXIM,       params.maxim);      saved.push('MAXIM'); }
  if (params.rifimGroup) { props.setProperty(BRAND_KEY.RIFIM_GROUP, params.rifimGroup); saved.push('RIFIM_GROUP'); }
  if (params.icon)       { props.setProperty(BRAND_KEY.ICON,        params.icon);       saved.push('ICON'); }
  Logger.log('✅ Branding logos tersimpan: ' + saved.join(', '));
  SpreadsheetApp.getUi().alert('✅ Logo tersimpan:\n' + saved.join('\n'));
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. CORE — ambil blob & insert ke sheet
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Ambil blob logo dari Drive berdasarkan BRAND_KEY.
 * @private
 * @param {string} brandKey - salah satu nilai dari BRAND_KEY.*
 * @returns {Blob}
 */
function _getLogoBlob(brandKey) {
  var fileId = PropertiesService.getScriptProperties().getProperty(brandKey);
  if (!fileId) throw new Error(
    'Logo "' + brandKey + '" belum di-setup.\n' +
    'Jalankan: RIFIM OS → Setup → Setup Logo Perusahaan');
  return DriveApp.getFileById(fileId).getBlob();
}

/**
 * Sisipkan logo ke sheet sebagai over-grid image.
 * Otomatis hapus logo lama di posisi yang sama (aman di-re-run).
 *
 * @param {Sheet}  sheet
 * @param {string} brandKey  - BRAND_KEY.RIFIM / MENALA / dst
 * @param {number} col       - kolom anchor, 1-based
 * @param {number} row       - baris anchor, 1-based
 * @param {number} lebarPx   - lebar gambar (pixel)
 * @param {number} tinggiPx  - tinggi gambar (pixel)
 * @param {number} [offsetX] - offset X dari kiri sel (default 4)
 * @param {number} [offsetY] - offset Y dari atas sel (default 4)
 * @returns {OverGridImage|null}
 */
function insertLogoKeSheet(sheet, brandKey, col, row, lebarPx, tinggiPx, offsetX, offsetY) {
  try {
    // Hapus logo lama di anchor yang sama (hindari duplikat)
    sheet.getImages().forEach(function(img) {
      var anchor = img.getAnchorCell();
      if (anchor.getRow() === row && anchor.getColumn() === col) img.remove();
    });

    var blob = _getLogoBlob(brandKey);
    var img  = sheet.insertImage(blob, col, row,
                                 offsetX !== undefined ? offsetX : 4,
                                 offsetY !== undefined ? offsetY : 4);
    if (lebarPx)  img.setWidth(lebarPx);
    if (tinggiPx) img.setHeight(tinggiPx);
    return img;
  } catch (err) {
    Logger.log('⚠️ insertLogoKeSheet gagal: ' + err.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. HELPER — bangun header sheet profesional dengan logo
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Buat header sheet 3-baris standar RIFIM OS dengan logo di kiri.
 *
 * Layout:
 *   Row 1 (tinggi 55): [A1 - logo area] [B1:maxCol merge - nama perusahaan]
 *   Row 2 (tinggi 38): [A2 - kosong]    [B2:maxCol merge - judul dokumen]
 *   Row 3 (tinggi 10): spacer
 *
 * @param {Sheet}  sheet
 * @param {string} brandKey   - BRAND_KEY.* untuk logo
 * @param {string} judulDokumen - mis. "INVOICE TAGIHAN INTERN CABANG"
 * @param {number} maxCol     - jumlah kolom sheet (untuk merge)
 * @param {string} [warnaHex] - override warna header (default dari BRAND_INFO)
 */
function buatHeaderSheet(sheet, brandKey, judulDokumen, maxCol, warnaHex) {
  var info  = BRAND_INFO[_brandKeyToName(brandKey)] || BRAND_INFO.RIFIM;
  var warna = warnaHex || info.warna;

  // Bersihkan baris 1-3
  sheet.getRange(1, 1, 3, maxCol).clear();
  var merges = sheet.getMergedRanges();
  merges.forEach(function(m) {
    if (m.getRow() <= 3) { try { m.breakApart(); } catch(e) {} }
  });

  // Lebar kolom A (area logo)
  sheet.setColumnWidth(1, 110);

  // Tinggi baris
  sheet.setRowHeight(1, 55);
  sheet.setRowHeight(2, 38);
  sheet.setRowHeight(3, 10);

  // A1: warna latar logo (blank, gambar di-overlay)
  sheet.getRange('A1:A2').merge()
    .setBackground(warna);

  // B1:maxCol — nama perusahaan
  sheet.getRange(1, 2, 1, maxCol - 1).merge()
    .setValue(info.nama)
    .setBackground(warna).setFontColor('#FFFFFF')
    .setFontSize(13).setFontWeight('bold')
    .setHorizontalAlignment('left').setVerticalAlignment('middle')
    .setFontFamily('Arial');

  // B2:maxCol — judul dokumen
  sheet.getRange(2, 2, 1, maxCol - 1).merge()
    .setValue(judulDokumen)
    .setBackground(warna).setFontColor('#FFE599')
    .setFontSize(11).setFontWeight('bold')
    .setHorizontalAlignment('left').setVerticalAlignment('middle')
    .setFontFamily('Arial');

  // Tambah alamat/keterangan kecil di subtitle jika ada
  if (info.alamat) {
    sheet.getRange(2, 2, 1, maxCol - 1)
      .setValue(judulDokumen + '   |   ' + info.alamat);
  }

  // Sisipkan logo di A1 (lebar 100px, tinggi 80px, offset 5,5)
  insertLogoKeSheet(sheet, brandKey, 1, 1, 100, 80, 5, 5);

  // Baris 3: spacer
  sheet.getRange(3, 1, 1, maxCol).setBackground('#FFFFFF');
}

/**
 * Konversi BRAND_KEY value ke nama key di BRAND_INFO.
 * @private
 */
function _brandKeyToName(brandKey) {
  var map = {};
  Object.keys(BRAND_KEY).forEach(function(k) { map[BRAND_KEY[k]] = k; });
  return map[brandKey] || 'RIFIM';
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. TEST — jalankan dari GAS Editor untuk cek logo sudah terpasang
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Tes sisipkan semua logo ke sheet bernama "TEST_LOGO".
 * Hapus sheet ini setelah tes.
 */
function testInsertLogo() {
  var ss    = SpreadsheetApp.openById(RAOS_SS_ID);
  var sheet = ss.getSheetByName('TEST_LOGO') || ss.insertSheet('TEST_LOGO');
  sheet.clear();
  sheet.getImages().forEach(function(i) { i.remove(); });

  var logoList = [
    { key: BRAND_KEY.RIFIM,       col: 1, row: 1,  label: 'RIFIM' },
    { key: BRAND_KEY.MENALA,      col: 1, row: 5,  label: 'MENALA' },
    { key: BRAND_KEY.LAILAN,      col: 1, row: 9,  label: 'LAILAN' },
    { key: BRAND_KEY.MAXIM,       col: 1, row: 13, label: 'MAXIM' },
    { key: BRAND_KEY.RIFIM_GROUP, col: 1, row: 17, label: 'RIFIM GROUP' },
    { key: BRAND_KEY.ICON,        col: 1, row: 21, label: 'ICON' },
  ];

  logoList.forEach(function(item) {
    sheet.getRange(item.row, 2).setValue(item.label);
    insertLogoKeSheet(sheet, item.key, item.col, item.row, 120, 60);
  });

  SpreadsheetApp.getUi().alert(
    '✅ Test logo selesai!\nCek sheet "TEST_LOGO".\nHapus sheet ini setelah selesai cek.');
}

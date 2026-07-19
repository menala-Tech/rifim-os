/**
 * RIFIM OS — HTML Template Engine
 *
 * Pipeline HTML → Google Doc → PDF untuk semua 20 jenis dokumen,
 * 3 perusahaan (RIFIM, MIG, LAILAN).
 *
 * Keunggulan vs Google Docs API lama:
 *   ✅ Posisi TTD+stempel FIXED (tidak bergeser walau isi panjang)
 *   ✅ QR Code selalu di pojok kanan bawah
 *   ✅ Watermark via CSS opacity
 *   ✅ Kop surat konsisten (logo kiri | info kanan | garis merah)
 *   ✅ Proporsi: Header 15% / Content 65% / Signature+QR 20%
 *
 * Flow: generateDocumentViaHtml(input)
 *   → _loadCompanyAssets(code)       [logo, TTD, stempel → base64]
 *   → _buildHtml*(data, assets)      [render HTML template]
 *   → _htmlToPdf(html, name, folder) [Drive API convert]
 *   → return { pdfUrl, gdocUrl }
 *
 * Dipanggil dari documentEngine.js jika input.use_html_pipeline = true
 * (atau semua dokumen setelah migration ke pipeline ini selesai).
 *
 * Dependency: configLoader.js, numberingEngine.js, databaseLayer.js,
 *             placeholderEngine.js (untuk _formatDateIndonesian)
 */

// ═══════════════════════════════════════════════════════════════════════════
// KONSTANTA ASET (Drive File ID — jangan hapus komentar nama file-nya)
// ═══════════════════════════════════════════════════════════════════════════

// File ID Letterhead (kop) + Footer PNG per 2026-07-19, sesuai
// ROLE Document Letterhead & Footer 3 Perusahaan.md
var HTML_TPL_ASSETS = {
  RIFIM: {
    logo_id:          '1ylC1QAjPRT4OiRsCh1BfbrNNZI9JRpTE',   // logo-rifim.png
    ttd_id:           '1hacw-5aFC2RNASx2iV2fSaZTk4Ry6SZ7',   // TTD bobby.png
    stempel_id:       '1o4bTu5Xl_fU71NqRJy0AnQmnVyuVMQEA',   // stempel Rifim.png
    kop_banner_id:    '1KqbGdFhVlb2pQYTndK12gHR_qLnl-Q3r',   // Letterhead Rifim.png
    footer_banner_id: '1XkLnh6C-zBFGnVRiK6YZM045c1Nqe1Lx',   // Footer Banner Rifim.png
    color:            '#C40000',
  },
  MIG: {
    logo_id:          '1WWB7GnD16XCM7BDsIR1YUZaY0ejnF5jV',   // logo Menala baru
    ttd_id:           '1hacw-5aFC2RNASx2iV2fSaZTk4Ry6SZ7',   // TTD bobby.png
    stempel_id:       '1QgSBv_Avbmadxh7j9QuIcA2my-1Jpt6T',   // stempel Menala.png
    kop_banner_id:    '11B-Lbj8q9A5g6rypAytl70Wtn8f6uFPp',   // Letterhead Menala.png
    footer_banner_id: '1OA31Z4pi031wECayRQhEIKOB5kENdx40',   // Footer Menala.png
    color:            '#C40000',
  },
  LAILAN: {
    logo_id:          '1WC0wBexm6zIjuoKF_KEb7Znpk3Bwdv6V',   // logo-lailan.png
    ttd_id:           '1hacw-5aFC2RNASx2iV2fSaZTk4Ry6SZ7',   // TTD bobby.png
    stempel_id:       '1Jt45lz3VaKrXMVKNaq99vEHyIHD7Ae9Q',   // stempel lailankalilan.png
    kop_banner_id:    '1GVFsr7nf8fi6DMCUDZKA-LDYZVFd8gTe',   // Letterhead Lailan.png
    footer_banner_id: '14w0nukjGWWAu6UFhPTq_Kz4jda0Y66SN',   // Footer Banner Lailan.png
    color:            '#C40000',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// FOLDER PDF (drive subfolder per jenis dokumen)
// Root: 1XZDBwNNDrcLquTaKB-1cbegz7rniXdgK
// ═══════════════════════════════════════════════════════════════════════════

// Folder Drive untuk cache PNG composite TTD+stempel (Alternative A image compositing).
// PNG di-generate sekali per perusahaan via SlidesApp, disimpan di sini,
// lalu di-reuse untuk semua dokumen berikutnya.
var HTML_TPL_SIG_CACHE_FOLDER = '19taBn0YXxjXTb-SxqFXGhwOPShZ4VlIt';

var HTML_TPL_FOLDERS = {
  SURAT: '12xonf6PjSMJRzpcQyIcuYsPzAMwIq_DO',
  ST:    '12xonf6PjSMJRzpcQyIcuYsPzAMwIq_DO',
  SIZ:   '12xonf6PjSMJRzpcQyIcuYsPzAMwIq_DO',
  SKT:   '12xonf6PjSMJRzpcQyIcuYsPzAMwIq_DO',
  INV:   '1CaihPCFzy_lRyXpJBVaP5MW0GN3NlzGW',
  KWT:   '15MpOYopdsJMpqz9gWspWrcX7byMTmLpU',
  PROP:  '1q9J3ib0LP29u5z4ZzmWfc8YsqUaO6w6V',
  CP:    '1WJevB0auuTuhmWVUHy5HaWaOZuA02Zob',
  MOU:   '1LBE86oPD9HdbHDoSMMA4M5UXojzm0i1I',
  PKS:   '1dXFsjTFgIWpSavXuWlKBaThmUfu3GKdP',
  SP1:   '1M2Nch7tcV-FYpqoh1WpYOHMwLlWL34Bb',
  SP2:   '1M2Nch7tcV-FYpqoh1WpYOHMwLlWL34Bb',
  SP3:   '1M2Nch7tcV-FYpqoh1WpYOHMwLlWL34Bb',
  PHK:   '1M2Nch7tcV-FYpqoh1WpYOHMwLlWL34Bb',
  PKWT:  '1fj7ccKbJQAjgcgEB23JvwBRlslI2neYU',
  SPG:   '1fj7ccKbJQAjgcgEB23JvwBRlslI2neYU',
  SMT:   '1fj7ccKbJQAjgcgEB23JvwBRlslI2neYU',
  PI:    '1fj7ccKbJQAjgcgEB23JvwBRlslI2neYU',
  BA:    '1glIeErIjRpYX2zUcAlaWGPPBRPPRqQB3',
  FCO:   '183ASv9IYr7T0x5LbpR4IQeu4w5xZflI4',
};

// ═══════════════════════════════════════════════════════════════════════════
// SIGNATURE COMPOSITOR (Alternative A — TTD overlay stempel jadi 1 PNG)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Composite TTD + Stempel jadi satu PNG lewat SlidesApp API.
 * Stempel di-place di background, TTD overlay di atasnya (offset kiri-atas)
 * — sama seperti tanda tangan asli.
 *
 * PNG hasil di-cache di Drive folder HTML_TPL_SIG_CACHE_FOLDER, jadi
 * proses composite hanya jalan sekali per perusahaan (~5-8 detik pertama).
 *
 * @param {string} companyCode - 'RIFIM' | 'MIG' | 'LAILAN'
 * @returns {string} Drive file ID PNG hasil composite
 * @private
 */
function _getCombinedSignatureId(companyCode) {
  var cacheKey  = 'sig_combined_' + companyCode;
  var cacheSvc  = CacheService.getScriptCache();
  var cachedId  = cacheSvc.get(cacheKey);
  if (cachedId) {
    // Verify file masih ada (mungkin sudah di-trash user)
    try { DriveApp.getFileById(cachedId).getName(); return cachedId; } catch (_) {}
  }

  var fileName  = 'signature-combined-' + companyCode + '.png';
  var folder    = DriveApp.getFolderById(HTML_TPL_SIG_CACHE_FOLDER);

  // Cek apakah file sudah ada di Drive folder
  var existing = folder.getFilesByName(fileName);
  if (existing.hasNext()) {
    var existId = existing.next().getId();
    cacheSvc.put(cacheKey, existId, 21600); // cache 6 jam
    return existId;
  }

  // Belum ada — composite baru via SlidesApp
  var newId = _composeSignatureViaSlides(companyCode, fileName, folder);
  cacheSvc.put(cacheKey, newId, 21600);
  return newId;
}

/**
 * Composite TTD + Stempel via SlidesApp (satu-satunya cara image composition di GAS).
 * @private
 */
function _composeSignatureViaSlides(companyCode, fileName, targetFolder) {
  var ids = HTML_TPL_ASSETS[companyCode] || HTML_TPL_ASSETS['RIFIM'];
  var pres = SlidesApp.create('_tmp_sig_' + companyCode + '_' + new Date().getTime());
  var presId = pres.getId();

  try {
    // Set slide size ke 260x160 pt (rasio kompak untuk signature)
    pres.setPageSize(SlidesApp.PageSize.CUSTOM, 260, 160);

    var slide = pres.getSlides()[0];
    // Bersihkan default placeholders
    slide.getPageElements().forEach(function(e) { try { e.remove(); } catch (_) {} });

    // 1. Insert Stempel dulu (background layer)
    var stempelBlob = DriveApp.getFileById(ids.stempel_id).getBlob();
    var stempelImg  = slide.insertImage(stempelBlob);
    stempelImg.setLeft(85).setTop(18).setWidth(160).setHeight(120);

    // 2. Insert TTD di atas (foreground overlay, offset kiri-atas)
    // TTD posisi kiri sedikit menutupi kiri stempel — mirip goresan real
    var ttdBlob = DriveApp.getFileById(ids.ttd_id).getBlob();
    var ttdImg  = slide.insertImage(ttdBlob);
    ttdImg.setLeft(0).setTop(30).setWidth(160).setHeight(85);

    pres.saveAndClose();

    // Export slide sebagai PNG lewat Slides export URL
    var pageObjectId = slide.getObjectId();
    var exportUrl = 'https://docs.google.com/presentation/d/' + presId +
                    '/export/png?id=' + presId + '&pageid=' + pageObjectId;
    var resp = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
    });

    if (resp.getResponseCode() !== 200) {
      throw new Error('Slides export gagal: HTTP ' + resp.getResponseCode());
    }

    var pngBlob = resp.getBlob().setName(fileName);
    var file    = targetFolder.createFile(pngBlob);
    return file.getId();

  } finally {
    // Hapus temp Slides file
    try { DriveApp.getFileById(presId).setTrashed(true); } catch (_) {}
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ASSET LOADER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Load logo, TTD, stempel sebagai base64 data URI.
 * Gunakan thumbnail URL (w300) agar ukuran file tetap kecil dan
 * tidak melebihi batas memory GAS.
 *
 * @param {string} companyCode - 'RIFIM' | 'MIG' | 'LAILAN'
 * @returns {{ logo, ttd, stempel, color }} base64 data URIs
 */
function _loadCompanyAssets(companyCode) {
  var ids    = HTML_TPL_ASSETS[companyCode] || HTML_TPL_ASSETS['RIFIM'];
  var token  = ScriptApp.getOAuthToken();
  var color  = ids.color || '#C40000';

    function fetchAsBase64(fileId, szParam) {
    try {
      var url  = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w' + (szParam || 300);
      var resp = UrlFetchApp.fetch(url, {
        headers: { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true,
      });
      if (resp.getResponseCode() !== 200) return '';
      var blob = resp.getBlob();
      return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
    } catch (e) {
      Logger.log('_loadCompanyAssets error [' + fileId + ']: ' + e.message);
      return '';
    }
  }

  // Combined signature (TTD overlay stempel jadi 1 PNG) via SlidesApp compositor.
  // Cache di Drive folder, jadi composite jalan sekali per perusahaan.
  var signatureId = '';
  try { signatureId = _getCombinedSignatureId(companyCode); } catch (e) {
    Logger.log('_getCombinedSignatureId error: ' + e.message);
  }

  return {
    // Logo: server-side crop 150×110 agar file PNG multi-varian hanya tampil varian atas.
    logo:         fetchAsBase64(ids.logo_id, '150-h110-c'),
    // Banner kop + footer (kalau ada) — load full-width high-res
    kop_banner:   ids.kop_banner_id    ? fetchAsBase64(ids.kop_banner_id,    1240) : '',
    footer_banner: ids.footer_banner_id ? fetchAsBase64(ids.footer_banner_id, 1240) : '',
    // Signature composite (TTD + stempel dalam 1 PNG, overlap seperti asli)
    signature:    signatureId ? fetchAsBase64(signatureId, 500) : '',
    // TTD & stempel individual masih di-load sebagai fallback (kalau composite gagal)
    ttd:          fetchAsBase64(ids.ttd_id,     400),
    stempel:      fetchAsBase64(ids.stempel_id, 400),
    color:        color,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HTML BUILDING BLOCKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * CSS dasar yang digunakan di semua template.
 * Google Drive HTML→Doc conversion mendukung:
 *   font-family, font-size, color, background-color, border, padding, margin,
 *   text-align, vertical-align, width (%), page-break-inside.
 * @private
 */
function _baseCss() {
  // Sesuai ROLE Document Letterhead spec:
  // Font Aptos (fallback Calibri, Arial), 12pt, #000, justify, line-height 1.6,
  // paragraph spacing after 12pt, first-line-indent none.
  return [
    'body{font-family:Aptos,Calibri,Arial,Helvetica,sans-serif;font-size:12pt;color:#000;margin:0;padding:0;line-height:1.6;}',
    'table{border-collapse:collapse;width:100%;}',
    'td,th{vertical-align:top;padding:0;}',
    // Paragraf: justify + spacing 12pt after
    'p{margin:0 0 12pt 0;line-height:1.6;text-align:justify;}',
    'strong{font-weight:bold;}',
    // Title dokumen: 14pt bold center uppercase, spacing after 18pt
    '.doc-title{font-size:14pt;font-weight:bold;color:#000;text-align:center;text-transform:uppercase;margin:0 0 18pt 0;letter-spacing:0.5px;}',
    // Section heading: 12pt bold, spacing before 18pt after 8pt
    '.section-title{font-size:12pt;font-weight:bold;color:#000;margin:18pt 0 8pt 0;}',
    // Data table style: header bold white on dark gray, border 1px solid #DADCE0, padding 6px
    'table.data{border-collapse:collapse;width:100%;margin:8pt 0;}',
    'table.data th{background:#3C4043;color:#fff;font-weight:bold;padding:6px;border:1px solid #DADCE0;text-align:left;vertical-align:middle;}',
    'table.data td{padding:6px;border:1px solid #DADCE0;vertical-align:middle;}',
    // Info table (label/value) — borderless, tight padding
    'table.info td{padding:3px 0;}',
    // Signature block
    '.sig-wrap{margin-top:24pt;page-break-inside:avoid;}',
    '.qr-label{font-size:8pt;color:#999;}',
    'hr.thin{border:0;border-top:1px solid #DDD;margin:8px 0;}',
  ].join('\n');
}

/**
 * Kop surat: tabel 2-kolom — logo kiri | info perusahaan kanan.
 * Tinggi sekitar 15% halaman A4 (≈44mm).
 * @private
 */
function _kop(assets, company) {
  // BANNER MODE: kalau kop_banner PNG tersedia, embed sebagai gambar full-width.
  // Ini support design premium (logo + tagline + badge + background gradient +
  // shape) yang tidak bisa direplikasi via HTML/CSS di Google Docs converter.
  if (assets.kop_banner) {
    return [
      '<div style="margin:0 0 20px 0;">',
      '<img src="' + assets.kop_banner + '" style="display:block;width:100%;height:auto;">',
      '</div>',
    ].join('');
  }

  // FALLBACK: kop teks style (logo kiri + info kanan) — dipakai kalau banner belum di-upload
  var logoSrc = assets.logo
    ? '<img src="' + assets.logo + '" width="150" height="110" style="display:block;vertical-align:top;">'
    : '<div style="width:150px;height:110px;background:#eee;display:block;"></div>';

  return [
    '<table style="width:100%;margin-bottom:0;border-collapse:collapse;">',
    '<tr>',
    '<td style="width:170px;padding:0 16px 0 0;vertical-align:middle;">' + logoSrc + '</td>',
    '<td style="vertical-align:middle;padding:0;">',
    '<div style="font-size:15pt;font-weight:bold;color:#C40000;text-transform:uppercase;line-height:1.15;margin:0;">' + _esc(company.name || '') + '</div>',
    '<div style="font-size:10pt;color:#333;line-height:1.4;margin:3px 0 0 0;">' + _esc(company.address || '') + '</div>',
    '<div style="font-size:10pt;color:#333;line-height:1.4;margin:1px 0 0 0;">Telp: ' + _esc(company.phone || '') + ' &nbsp;|&nbsp; Email: ' + _esc(company.email || '') + '</div>',
    '</td>',
    '</tr>',
    '</table>',
    '<hr style="border:0;border-top:2.5px solid #C40000;margin:8px 0 16px;">',
  ].join('');
}

/**
 * Footer banner (kalau footer_banner tersedia).
 * Render di bagian bawah dokumen setelah QR block.
 * @private
 */
function _footer(assets) {
  if (!assets.footer_banner) return '';
  return [
    '<div style="margin:24px 0 0 0;">',
    '<img src="' + assets.footer_banner + '" style="display:block;width:100%;height:auto;">',
    '</div>',
  ].join('');
}

/**
 * Blok tanda tangan + QR: tabel 2-kolom.
 * TTD+stempel di kiri, QR+nomor dokumen di kanan.
 * Selalu di bagian bawah dokumen (page-break-inside: avoid).
 * @private
 */
function _signature(assets, company, placeDate, docNumber, qrDataUri) {
  // Signature block:
  // - Prioritas 1: single combined PNG (TTD overlay stempel, dari SlidesApp compositor)
  //   Ukuran: 220x140 (proporsi 260x160 slide dijaga)
  // - Fallback: TTD 150x90 + Stempel 170x125 side-by-side
  var sigBlock;
  if (assets.signature) {
    sigBlock = '<img src="' + assets.signature + '" width="220" height="140" style="display:block;">';
  } else {
    var ttdSrc = assets.ttd
      ? '<img src="' + assets.ttd + '" width="150" height="90" style="display:block;">'
      : '';
    var stempelSrc = assets.stempel
      ? '<img src="' + assets.stempel + '" width="170" height="125" style="display:block;">'
      : '';
    sigBlock = [
      '<table style="width:auto;border-collapse:collapse;border:0;margin:0;">',
      '<tr>',
      '<td style="vertical-align:middle;padding:0;">' + ttdSrc + '</td>',
      '<td style="vertical-align:middle;padding:0 0 0 8px;">' + stempelSrc + '</td>',
      '</tr>',
      '</table>',
    ].join('');
  }

  var qrSrc = qrDataUri
    ? '<img src="' + qrDataUri + '" width="100" height="100" style="display:block;margin-left:auto;">'
    : '';

  // Struktur sesuai spec:
  // Hormat kami,              (regular)
  // Nama Perusahaan           (bold)
  // [24pt distance from body — TTD+Stempel composite]
  // Director Name             (bold)
  // Position                  (regular, NOT bold)
  return [
    '<div class="sig-wrap">',
    '<p style="text-align:left;margin:0 0 4pt 0;">Hormat kami,</p>',
    '<p style="font-weight:bold;text-align:left;margin:0 0 6pt 0;">' + _esc(company.name || '') + '</p>',
    sigBlock,
    '<p style="font-weight:bold;text-align:left;margin:4pt 0 0 0;">' + _esc(company.director_name || '') + '</p>',
    '<p style="text-align:left;margin:0;">' + _esc(company.director_title || '') + '</p>',
    '</div>',
    // QR Code — pojok kanan bawah, terpisah
    '<table style="width:100%;margin-top:24pt;border-collapse:collapse;">',
    '<tr>',
    '<td style="text-align:right;vertical-align:bottom;">',
    qrSrc,
    '<p style="font-size:8pt;color:#999;text-align:right;margin:2px 0 0 0;">Scan untuk verifikasi dokumen</p>',
    '<p style="font-size:7.5pt;color:#999;text-align:right;margin:0;">' + _esc(docNumber) + '</p>',
    '</td>',
    '</tr>',
    '</table>',
  ].join('');
}

/**
 * Wrapper HTML lengkap dengan CSS dan body.
 * @private
 */
function _wrapHtml(bodyContent, assets) {
  return [
    '<!DOCTYPE html>',
    '<html><head><meta charset="UTF-8">',
    '<style>', _baseCss(), '</style>',
    '</head>',
    '<body>',
    '<div style="max-width:680px;margin:0 auto;padding:30px 40px;">',
    bodyContent,
    '</div>',
    '</body></html>',
  ].join('\n');
}

/** Escape HTML entities. @private */
function _esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/\n/g,'<br>');
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE PER JENIS DOKUMEN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Template: SURAT / ST / SIZ / SKT / BA / FCO / PROP / CP
 * Struktur umum surat resmi.
 */
function _tplSurat(d, assets, company) {
  return [
    _kop(assets, company),
    '<p class="doc-title">' + _esc(d.DOCUMENT_TITLE) + '</p>',
    // Info header (Nomor/Lampiran/Perihal) — label column width 140px, borderless
    '<table class="info" style="width:auto;">',
    '<tr>',
    '<td style="width:140px;white-space:nowrap;">Nomor</td>',
    '<td>: ' + _esc(d.DOCUMENT_NUMBER) + '</td>',
    '</tr><tr>',
    '<td style="white-space:nowrap;">Lampiran</td>',
    '<td>: ' + _esc(d.ATTACHMENT || '-') + '</td>',
    '</tr><tr>',
    '<td style="white-space:nowrap;">Perihal</td>',
    '<td>: ' + _esc(d.SUBJECT) + '</td>',
    '</tr></table>',
    // Blank line via paragraph margin
    '<p style="text-align:left;">Kepada Yth.<br>' +
      _esc(d.RECIPIENT_NAME || '') + '<br>' +
      _esc(d.RECIPIENT_ADDRESS || 'Di Tempat') + '</p>',
    '<p style="text-align:left;">Dengan hormat,</p>',
    '<p>' + _esc(d.BODY || '') + '</p>',
    '<p>Demikian surat ini kami sampaikan. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.</p>',
    d._signature,
  ].join('');
}

/**
 * Template: INVOICE
 */
function _tplInvoice(d, assets, company) {
  return [
    _kop(assets, company),
    '<p class="doc-title">I N V O I C E</p>',
    '<table style="width:auto;border-collapse:collapse;margin-bottom:16pt;">',
    '<tr>',
    '<td style="padding:3px 0;white-space:nowrap;width:140px;">Nomor Invoice</td>',
    '<td style="padding:3px 0;">: ' + _esc(d.DOCUMENT_NUMBER) + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Tanggal Invoice</td>',
    '<td style="padding:3px 0;">: ' + _esc(d.DOCUMENT_DATE) + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Jatuh Tempo</td>',
    '<td style="padding:3px 0;">: ' + _esc(d.DUE_DATE || '') + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Status Pembayaran</td>',
    '<td style="padding:3px 0;">: <strong style="color:#C40000;">' + _esc(d.STATUS || 'BELUM LUNAS') + '</strong></td>',
    '</tr></table>',
    '<hr class="thin">',
    '<p class="section-title">DITAGIHKAN KEPADA</p>',
    '<p><strong>' + _esc(d.CLIENT_NAME || '') + '</strong><br>',
    _esc(d.CLIENT_ADDRESS || '') + '<br>',
    'Telp: ' + _esc(d.CLIENT_PHONE || '') + '</p>',
    '<p class="section-title">RINCIAN LAYANAN</p>',
    '<p>' + _esc(d.ITEMS || '') + '</p>',
    '<hr class="thin">',
    '<table style="width:auto;margin-left:auto;"><tr>',
    '<td style="padding:3px 12px 3px 0;">Subtotal</td>',
    '<td>: ' + _esc(d.SUBTOTAL || '') + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 12px 3px 0;">PPN ' + _esc(d.TAX_PERCENT || '0') + '%</td>',
    '<td>: ' + _esc(d.TAX_AMOUNT || 'Rp 0') + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 12px 3px 0;font-weight:bold;">GRAND TOTAL</td>',
    '<td style="font-weight:bold;color:#C40000;font-size:12pt;">: ' + _esc(d.GRAND_TOTAL || '') + '</td>',
    '</tr></table>',
    '<hr class="thin">',
    '<p class="section-title">INFORMASI PEMBAYARAN</p>',
    '<table style="width:auto;"><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Bank</td>',
    '<td>: ' + _esc(d.BANK_NAME || '') + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">No. Rekening</td>',
    '<td>: <strong>' + _esc(d.BANK_ACCOUNT || '') + '</strong></td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Atas Nama</td>',
    '<td>: ' + _esc(d.BANK_HOLDER || '') + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Syarat Bayar</td>',
    '<td>: ' + _esc(d.PAYMENT_TERMS || '') + '</td>',
    '</tr></table>',
    d.NOTES ? '<p style="font-size:9pt;color:#666;margin-top:8px;">Catatan: ' + _esc(d.NOTES) + '</p>' : '',
    d._signature,
  ].join('');
}

/**
 * Template: KWITANSI
 */
function _tplKwitansi(d, assets, company) {
  return [
    _kop(assets, company),
    '<p class="doc-title">K W I T A N S I</p>',
    '<p style="text-align:center;font-size:11pt;color:#555;margin-bottom:16pt;">Nomor: ' + _esc(d.DOCUMENT_NUMBER) + '</p>',
    '<table style="width:100%;border-collapse:collapse;margin-bottom:16pt;">',
    '<tr>',
    '<td style="width:180px;padding:3px 0;white-space:nowrap;">Telah diterima dari</td>',
    '<td style="padding:3px 0;">: ' + _esc(d.PAYER_NAME || '') + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Tanggal Pembayaran</td>',
    '<td style="padding:3px 0;">: ' + _esc(d.PAYMENT_DATE || d.DOCUMENT_DATE) + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Keterangan</td>',
    '<td style="padding:3px 0;">: ' + _esc(d.PAYMENT_PURPOSE || '') + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Rincian</td>',
    '<td style="padding:3px 0;">: ' + _esc(d.PAYMENT_DETAIL || '') + '</td>',
    '</tr></table>',
    '<hr class="thin" style="margin:10px 0;">',
    '<table style="width:auto;margin-left:auto;"><tr>',
    '<td style="padding:3px 12px 3px 0;font-weight:bold;font-size:12pt;">JUMLAH</td>',
    '<td style="font-size:12pt;font-weight:bold;color:#C40000;">: ' + _esc(d.AMOUNT || '') + '</td>',
    '</tr></table>',
    '<p style="font-size:9.5pt;margin-top:4px;">Terbilang: <em>' + _esc(d.AMOUNT_TEXT || '') + '</em></p>',
    '<hr class="thin">',
    '<p style="text-align:right;margin-top:8px;">Yang menerima,</p>',
    d._signature,
  ].join('');
}

/**
 * Template: SURAT PERINGATAN (SP1, SP2, SP3, PHK)
 */
function _tplSP(d, assets, company) {
  return [
    _kop(assets, company),
    '<p class="doc-title">' + _esc(d.DOCUMENT_TITLE) + '</p>',
    '<p style="text-align:center;font-size:10pt;color:#555;margin-bottom:12px;">Nomor: ' + _esc(d.DOCUMENT_NUMBER) + '</p>',
    '<p>Yang bertanda tangan di bawah ini, Pimpinan <strong>' + _esc(company.name) + '</strong>,',
    'dengan ini memberikan teguran/peringatan resmi kepada karyawan:</p>',
    '<table style="width:auto;border-collapse:collapse;margin:12pt 0;">',
    '<tr>',
    '<td style="width:140px;padding:3px 0;white-space:nowrap;">Nama Karyawan</td>',
    '<td style="padding:3px 0;">: ' + _esc(d.EMPLOYEE_NAME || '') + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">ID Karyawan</td>',
    '<td style="padding:3px 0;">: ' + _esc(d.EMPLOYEE_ID || '') + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Jabatan</td>',
    '<td style="padding:3px 0;">: ' + _esc(d.EMPLOYEE_POSITION || '') + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Departemen</td>',
    '<td style="padding:3px 0;">: ' + _esc(d.EMPLOYEE_DEPT || '') + '</td>',
    '</tr></table>',
    '<hr class="thin">',
    '<p>' + _esc(d.BODY || '') + '</p>',
    '<hr class="thin">',
    '<p>Surat ini merupakan tindakan disiplin resmi perusahaan. Karyawan yang bersangkutan',
    'diharapkan segera memperbaiki diri dan tidak mengulangi pelanggaran yang sama.</p>',
    '<p style="margin-top:10px;">' + _esc(d.PLACE_DATE) + '</p>',
    '<table style="width:100%;margin-top:30px;page-break-inside:avoid;">',
    '<tr>',
    '<td style="width:50%;vertical-align:bottom;padding-right:8px;">',
    '<p><strong>Pimpinan Perusahaan,</strong></p>',
    '<p>' + _esc(company.name) + '</p>',
    '<br>',
    '<table style="border:0;width:auto;"><tr>',
    assets.ttd     ? '<td style="padding-right:6px;vertical-align:bottom;"><img src="' + assets.ttd     + '" width="90" height="45" style="display:block;"></td>' : '<td></td>',
    assets.stempel ? '<td style="vertical-align:bottom;"><img src="' + assets.stempel + '" width="68" height="68" style="display:block;"></td>' : '<td></td>',
    '</tr></table>',
    '<p style="font-weight:bold;margin-top:4px;">' + _esc(company.director_name || '') + '</p>',
    '<p style="font-size:9.5pt;color:#555;">' + _esc(company.director_title || '') + '</p>',
    '</td>',
    '<td style="width:50%;vertical-align:bottom;padding-left:8px;">',
    '<p><strong>Karyawan yang bersangkutan,</strong></p>',
    '<br><br><br><br>',
    '<p style="font-weight:bold;">' + _esc(d.EMPLOYEE_NAME || '_____________________') + '</p>',
    '<p style="font-size:9.5pt;color:#555;">' + _esc(d.EMPLOYEE_POSITION || '') + '</p>',
    '</td>',
    '</tr>',
    '</table>',
    // QR block for SP documents
    '<table style="width:100%;margin-top:16px;"><tr>',
    '<td style="text-align:right;vertical-align:bottom;">',
    d._qrBlock,
    '</td></tr></table>',
  ].join('');
}

/**
 * Template: PKWT / SPG / SMT / PI (kontrak dua pihak HR)
 */
function _tplKontrak(d, assets, company) {
  return [
    _kop(assets, company),
    '<p class="doc-title">' + _esc(d.DOCUMENT_TITLE) + '</p>',
    '<p style="text-align:center;font-size:10pt;color:#555;margin-bottom:12px;">Nomor: ' + _esc(d.DOCUMENT_NUMBER) + '</p>',
    '<p>Pada hari ini, <strong>' + _esc(d.DOCUMENT_DATE) + '</strong>, dibuat dan ditandatangani perjanjian/surat antara:</p>',
    '<p class="section-title">PIHAK PERTAMA</p>',
    '<table style="width:auto;"><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Perusahaan</td>',
    '<td>: <strong>' + _esc(company.name) + '</strong></td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Diwakili oleh</td>',
    '<td>: ' + _esc(company.director_name || '') + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Jabatan</td>',
    '<td>: ' + _esc(company.director_title || '') + '</td>',
    '</tr></table>',
    '<p class="section-title">PIHAK KEDUA</p>',
    '<table style="width:auto;"><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Nama</td>',
    '<td>: <strong>' + _esc(d.EMPLOYEE_NAME || '') + '</strong></td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">NIK / KTP</td>',
    '<td>: ' + _esc(d.EMPLOYEE_ID_CARD || d.EMPLOYEE_ID || '') + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Jabatan</td>',
    '<td>: ' + _esc(d.EMPLOYEE_POSITION || '') + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Departemen</td>',
    '<td>: ' + _esc(d.EMPLOYEE_DEPT || '') + '</td>',
    '</tr></table>',
    '<p class="section-title">ISI PERJANJIAN / KEPUTUSAN</p>',
    '<p>' + _esc(d.BODY || '') + '</p>',
    '<p style="margin-top:10px;">Perjanjian / Surat Keputusan ini berlaku sejak ditandatangani kedua pihak.</p>',
    '<table style="width:100%;margin-top:30px;page-break-inside:avoid;"><tr>',
    '<td style="width:50%;vertical-align:bottom;padding-right:8px;">',
    '<p><strong>PIHAK PERTAMA</strong></p>',
    '<p>' + _esc(company.name) + '</p>',
    '<br>',
    '<table style="border:0;width:auto;"><tr>',
    assets.ttd     ? '<td style="padding-right:6px;vertical-align:bottom;"><img src="' + assets.ttd     + '" width="90" height="45" style="display:block;"></td>' : '<td></td>',
    assets.stempel ? '<td style="vertical-align:bottom;"><img src="' + assets.stempel + '" width="68" height="68" style="display:block;"></td>' : '<td></td>',
    '</tr></table>',
    '<p style="font-weight:bold;margin-top:4px;">' + _esc(company.director_name || '') + '</p>',
    '<p style="font-size:9.5pt;color:#555;">' + _esc(company.director_title || '') + '</p>',
    '</td>',
    '<td style="width:50%;vertical-align:bottom;padding-left:8px;">',
    '<p><strong>PIHAK KEDUA</strong></p>',
    '<br><br><br><br>',
    '<p style="font-weight:bold;">' + _esc(d.EMPLOYEE_NAME || '_____________________') + '</p>',
    '</td>',
    '</tr></table>',
    '<table style="width:100%;margin-top:16px;"><tr>',
    '<td style="text-align:right;vertical-align:bottom;">' + d._qrBlock + '</td>',
    '</tr></table>',
  ].join('');
}

/**
 * Template: MOU / PKS (perjanjian dua perusahaan)
 */
function _tplMOU(d, assets, company) {
  return [
    _kop(assets, company),
    '<p class="doc-title">' + _esc(d.DOCUMENT_TITLE) + '</p>',
    '<p style="text-align:center;font-size:10pt;color:#555;margin-bottom:12px;">Nomor: ' + _esc(d.DOCUMENT_NUMBER) + '</p>',
    '<p>Pada hari ini, <strong>' + _esc(d.DOCUMENT_DATE) + '</strong>, telah disepakati oleh pihak-pihak berikut:</p>',
    '<p class="section-title">PIHAK PERTAMA</p>',
    '<table style="width:auto;"><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Perusahaan</td>',
    '<td>: <strong>' + _esc(company.name) + '</strong></td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Diwakili oleh</td>',
    '<td>: ' + _esc(company.director_name || '') + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Jabatan</td>',
    '<td>: ' + _esc(company.director_title || '') + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Alamat</td>',
    '<td>: ' + _esc(company.address || '') + '</td>',
    '</tr></table>',
    '<p class="section-title">PIHAK KEDUA</p>',
    '<table style="width:auto;"><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Perusahaan</td>',
    '<td>: <strong>' + _esc(d.PARTY_B_NAME || '') + '</strong></td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Diwakili oleh</td>',
    '<td>: ' + _esc(d.PARTY_B_PIC || '') + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Jabatan</td>',
    '<td>: ' + _esc(d.PARTY_B_TITLE || '') + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Alamat</td>',
    '<td>: ' + _esc(d.PARTY_B_ADDRESS || '') + '</td>',
    '</tr></table>',
    '<p class="section-title">ISI KESEPAKATAN</p>',
    '<p>' + _esc(d.BODY || '') + '</p>',
    d.END_DATE ? '<p>Kesepakatan ini berlaku sampai dengan <strong>' + _esc(d.END_DATE) + '</strong>.</p>' : '',
    '<p>Hal-hal yang belum diatur akan disepakati kemudian atas dasar musyawarah mufakat.</p>',
    '<table style="width:100%;margin-top:30px;page-break-inside:avoid;"><tr>',
    '<td style="width:50%;vertical-align:bottom;padding-right:8px;">',
    '<p><strong>PIHAK PERTAMA</strong></p>',
    '<p>' + _esc(company.name) + '</p>',
    '<br>',
    '<table style="border:0;width:auto;"><tr>',
    assets.ttd     ? '<td style="padding-right:6px;vertical-align:bottom;"><img src="' + assets.ttd     + '" width="90" height="45" style="display:block;"></td>' : '<td></td>',
    assets.stempel ? '<td style="vertical-align:bottom;"><img src="' + assets.stempel + '" width="68" height="68" style="display:block;"></td>' : '<td></td>',
    '</tr></table>',
    '<p style="font-weight:bold;margin-top:4px;">' + _esc(company.director_name || '') + '</p>',
    '<p style="font-size:9.5pt;color:#555;">' + _esc(company.director_title || '') + '</p>',
    '</td>',
    '<td style="width:50%;vertical-align:bottom;padding-left:8px;">',
    '<p><strong>PIHAK KEDUA</strong></p>',
    '<p>' + _esc(d.PARTY_B_NAME || '') + '</p>',
    '<br><br><br><br>',
    '<p style="font-weight:bold;">' + _esc(d.PARTY_B_PIC || '_____________________') + '</p>',
    '<p style="font-size:9.5pt;color:#555;">' + _esc(d.PARTY_B_TITLE || '') + '</p>',
    '</td>',
    '</tr></table>',
    '<table style="width:100%;margin-top:16px;"><tr>',
    '<td style="text-align:right;vertical-align:bottom;">' + d._qrBlock + '</td>',
    '</tr></table>',
  ].join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// DISPATCHER — pilih template berdasarkan docType
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build HTML string untuk dokumen berdasarkan tipe.
 * @param {string} docType  - Kode dokumen (SURAT, INV, dll.)
 * @param {object} d        - Placeholder data (dari buildPlaceholderData)
 * @param {object} assets   - { logo, ttd, stempel, color } base64
 * @param {object} company  - { name, address, phone, email, director_name, ... }
 * @param {string} qrDataUri - QR code base64 (opsional)
 * @returns {string} HTML lengkap
 */
function buildDocumentHtml(docType, d, assets, company, qrDataUri) {
  // Injeksi helper ke d agar template bisa akses langsung
  d._signature = _signature(assets, company, d.PLACE_DATE, d.DOCUMENT_NUMBER, qrDataUri);
  d._qrBlock   = qrDataUri
    ? '<img src="' + qrDataUri + '" width="84" height="84" style="display:block;margin-left:auto;"><p class="qr-label">Scan untuk verifikasi</p><p class="qr-label" style="font-size:7.5pt;">' + _esc(d.DOCUMENT_NUMBER) + '</p>'
    : '';

  var body;
  switch (docType) {
    case 'INV':                        body = _tplInvoice(d, assets, company); break;
    case 'KWT':                        body = _tplKwitansi(d, assets, company); break;
    case 'SP1': case 'SP2':
    case 'SP3': case 'PHK':            body = _tplSP(d, assets, company); break;
    case 'PKWT': case 'SPG':
    case 'SMT':  case 'PI':            body = _tplKontrak(d, assets, company); break;
    case 'MOU':  case 'PKS':           body = _tplMOU(d, assets, company); break;
    // Semua surat resmi (SURAT, ST, SIZ, SKT, BA, FCO, PROP, CP)
    default:                           body = _tplSurat(d, assets, company); break;
  }

  // Append footer banner (kalau tersedia)
  body = body + _footer(assets);

  return _wrapHtml(body, assets);
}

// ═══════════════════════════════════════════════════════════════════════════
// HTML → PDF via Drive API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert HTML string ke PDF, simpan ke folder Drive.
 * Metode: Upload sebagai Google Doc (Drive convert HTML→Doc), export PDF,
 * hapus temp Doc.
 *
 * @param {string} htmlContent  - HTML dokumen lengkap
 * @param {string} fileName     - Nama file tanpa ekstensi
 * @param {string} folderId     - Drive folder ID tujuan
 * @returns {DriveFile} File PDF yang sudah tersimpan
 */
function htmlToPdf(htmlContent, fileName, folderId) {
  var htmlBlob = Utilities.newBlob(htmlContent, 'text/html', fileName + '.html');

  // Upload HTML → konversi ke Google Doc
  var tempDoc = Drive.Files.insert(
    {
      title:    fileName,
      mimeType: 'application/vnd.google-apps.document',
      parents:  [{ id: 'root' }],
    },
    htmlBlob,
    { convert: true }
  );

  try {
    // Post-processing via DocumentApp: margin + paksa dimensi logo + hapus border table
    try {
      var gasDoc = DocumentApp.openById(tempDoc.id);
      var body   = gasDoc.getBody();
      // Margin sesuai ROLE Document spec:
      // Top: 1 cm = 28.35 pt, Bottom: 1.5 cm = 42.52 pt
      // Left/Right: 2.5 cm = 70.87 pt
      // (Header/Footer margin 1 cm sudah di-cover top margin dokumen)
      body.setMarginTop(28.35).setMarginBottom(42.52).setMarginLeft(70.87).setMarginRight(70.87);
      // Paksa dimensi gambar (safety net setelah HTML conversion).
      // 2 skenario:
      //   Composite mode (3 image): [logo, signature-composite, QR]
      //   Fallback mode  (4 image): [logo, TTD, stempel, QR]
      var imgs = body.getImages();
      var dims;
      if (imgs.length === 3) {
        dims = [[150,110],[220,140],[100,100]];      // composite mode
      } else {
        dims = [[150,110],[150,90],[170,125],[100,100]]; // fallback mode
      }
      for (var i = 0; i < imgs.length && i < dims.length; i++) {
        try { imgs[i].setWidth(dims[i][0]).setHeight(dims[i][1]); } catch (_) {}
      }
      // Hapus semua border table — Google Docs HTML converter default menambah border 1px
      // walau CSS border-collapse:collapse diset. Set border width 0 pada semua table.
      var tables = body.getTables();
      for (var t = 0; t < tables.length; t++) {
        try { tables[t].setBorderWidth(0); } catch (_) {}
        try { tables[t].setBorderColor('#FFFFFF'); } catch (_) {}
      }
      gasDoc.saveAndClose();
    } catch (_) { /* non-fatal */ }

    // Export sebagai PDF
    var pdfBlob = DriveApp.getFileById(tempDoc.id)
      .getAs(MimeType.PDF)
      .setName(fileName + '.pdf');

    // Simpan ke folder tujuan
    var folder  = DriveApp.getFolderById(folderId);
    var pdfFile = folder.createFile(pdfBlob);

    return pdfFile;

  } finally {
    // Hapus temp Google Doc — gunakan DriveApp (lebih reliable dari Drive.Files.trash v2)
    try { DriveApp.getFileById(tempDoc.id).setTrashed(true); } catch (_) {}
  }
}

/**
 * Generate QR code sebagai base64 data URI untuk embed di HTML.
 * @param {string} data - Konten QR (biasanya nomor dokumen + URL)
 * @returns {string} base64 data URI atau ''
 */
function generateQrBase64(data) {
  try {
    var qrUrl  = 'https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=4&data=' + encodeURIComponent(data);
    var resp   = UrlFetchApp.fetch(qrUrl, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) return '';
    var blob   = resp.getBlob();
    return 'data:image/png;base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    Logger.log('generateQrBase64 error: ' + e.message);
    return '';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTRY POINT — dipanggil dari documentEngine.js
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate dokumen via HTML pipeline.
 * Menggantikan alur Google Docs API lama.
 *
 * @param {object} input        - Sama seperti generateDocument() di documentEngine.js
 * @param {object} config       - Company config dari getCompanyConfig()
 * @param {object} company      - Row dari sheet companies (getCompanyByCode)
 * @param {string} docNumber    - Nomor dokumen dari numberingEngine
 * @param {object} placeholderData - Dari buildPlaceholderData()
 * @returns {{ success, pdfUrl, gdocUrl, message, pdfFileId }}
 */
function generateDocumentViaHtml(input, config, company, docNumber, placeholderData) {
  var companyCode = (input.company_code || 'RIFIM').toUpperCase();
  var docType     = input.documentType;

  // 1. Load aset (logo, TTD, stempel → base64)
  var assets = _loadCompanyAssets(companyCode);

  // 2. Bangun company info object untuk template
  var co = {
    name:           (company && company.name)           || config['company_name']    || 'PT. RIFIM INTERNASIONAL GEMILANG',
    address:        (company && company.address)        || config['company_address'] || '',
    phone:          (company && company.phone)          || config['company_phone']   || '',
    email:          (company && company.email)          || config['company_email']   || '',
    city:           (company && company.city)           || config['company_city']    || 'Batam',
    director_name:  input.directorName  || (company && company.director_name)  || config['director_name']  || '',
    director_title: input.directorTitle || (company && company.director_title) || config['director_title'] || '',
  };

  // 3. Generate QR code (gunakan nomor dokumen sebagai konten)
  var qrData    = docNumber + ' | RIFIM OS';
  var qrBase64  = generateQrBase64(qrData);

  // 4. Build HTML
  var htmlContent = buildDocumentHtml(docType, placeholderData, assets, co, qrBase64);

  // 5. Tentukan folder PDF tujuan
  var folderId = HTML_TPL_FOLDERS[docType] || '1XZDBwNNDrcLquTaKB-1cbegz7rniXdgK';

  // 6. Convert HTML → PDF
  var pdfFile = htmlToPdf(htmlContent, docNumber, folderId);

  // Simpan record ke sheet documents
  try {
    saveDocumentRecord({
      id:               _gasUuid(),
      document_number:  docNumber,
      document_type:    docType,
      document_code:    companyCode,
      document_date:    placeholderData.DOCUMENT_DATE || _gasToday('short'),
      recipient_name:   input.recipientName  || '',
      recipient_address: input.recipientAddress || '',
      subject:          input.subject || '',
      attachment:       input.attachment || 0,
      body_summary:     (input.body || '').substring(0, 200),
      status:           'FINAL',
      gdoc_url:         '',
      pdf_url:          pdfFile.getUrl(),
      qr_url:           'qr:' + docNumber,
      created_by:       (input.performed_by && input.performed_by.email) || '',
      pipeline_type:    'html',
    });
  } catch (recErr) {
    _gasLogError('htmlTemplateEngine', 'saveRecord', recErr, { docNumber: docNumber });
  }

  return {
    success:        true,
    documentNumber: docNumber,
    pdfUrl:         pdfFile.getUrl(),
    pdfFileId:      pdfFile.getId(),
    gdocUrl:        '',
    message:        'Dokumen berhasil dibuat: ' + docNumber,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PREVIEW HTML (untuk frontend — dikembalikan via webApp.js)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build HTML preview string untuk ditampilkan di browser Smart Office
 * SEBELUM generate PDF.
 *
 * Perbedaan dari generate: gambar menggunakan Drive thumbnail URL
 * (tidak perlu OAuth, bisa langsung di-embed di <img> browser), dan
 * TIDAK ada konversi PDF.
 *
 * @param {string}  docType       - Kode dokumen
 * @param {object}  d             - Placeholder data
 * @param {string}  companyCode   - 'RIFIM' | 'MIG' | 'LAILAN'
 * @param {object}  company       - Dari sheet companies
 * @returns {string} HTML preview (siap dimasukkan ke innerHTML)
 */
function buildDocumentPreviewHtml(docType, d, companyCode, company) {
  var ids    = HTML_TPL_ASSETS[companyCode] || HTML_TPL_ASSETS['RIFIM'];
  var token  = ScriptApp.getOAuthToken();

  // Gunakan Drive thumbnail URL (public-safe untuk browser via Bearer token di GAS,
  // tapi di client-side cukup pakai URL thumbnail yang bisa diakses jika file shared)
  function thumbUrl(fileId) {
    return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w300';
  }

  // Logo dikrop dari atas agar hanya tampil satu varian (file PNG bisa berisi >1 logo stacked)
  var previewAssets = {
    logo:    '<div style="width:88px;height:64px;overflow:hidden;display:block;">' +
               '<img src="' + thumbUrl(ids.logo_id) + '" width="88" style="display:block;min-height:64px;object-fit:cover;object-position:top center;">' +
             '</div>',
    ttd:     '<img src="' + thumbUrl(ids.ttd_id)     + '" width="90" height="45" style="display:block;">',
    stempel: '<img src="' + thumbUrl(ids.stempel_id) + '" width="68" height="68" style="display:block;">',
    color:   ids.color || '#C40000',
  };

  // Override kop dan signature untuk mode preview (gunakan <img> tag biasa, tanpa base64)
  function kopPreview(company) {
    // Banner mode preview
    if (ids.kop_banner_id) {
      return '<div style="margin:0 0 20px 0;"><img src="' + thumbUrl(ids.kop_banner_id) +
             '" style="display:block;width:100%;height:auto;"></div>';
    }
    // Fallback teks style
    return [
      '<table style="width:100%;border-collapse:collapse;margin-bottom:0;">',
      '<tr>',
      '<td style="width:170px;padding:0 16px 0 0;vertical-align:middle;">' + previewAssets.logo + '</td>',
      '<td style="vertical-align:middle;padding:0;">',
      '<div style="font-size:15pt;font-weight:bold;color:#C40000;text-transform:uppercase;line-height:1.15;">' + _esc(company.name || '') + '</div>',
      '<div style="font-size:10pt;color:#333;margin-top:3px;">' + _esc(company.address || '') + '</div>',
      '<div style="font-size:10pt;color:#333;margin-top:1px;">Telp: ' + _esc(company.phone || '') + ' &nbsp;|&nbsp; Email: ' + _esc(company.email || '') + '</div>',
      '</td></tr></table>',
      '<hr style="border:0;border-top:2.5px solid #C40000;margin:8px 0 16px;">',
    ].join('');
  }

  function footerPreview() {
    if (!ids.footer_banner_id) return '';
    return '<div style="margin:24px 0 0 0;"><img src="' + thumbUrl(ids.footer_banner_id) +
           '" style="display:block;width:100%;height:auto;"></div>';
  }

  function sigPreview(company, placeDate, docNumber) {
    return [
      '<table style="width:100%;border-collapse:collapse;margin-top:40px;page-break-inside:avoid;">',
      '<tr>',
      '<td style="width:50%;vertical-align:bottom;padding-right:8px;">',
      '<p>' + _esc(placeDate) + '</p>',
      '<p><strong>' + _esc(company.name || '') + '</strong></p>',
      '<br>',
      '<table style="border:0;border-collapse:collapse;"><tr>',
      '<td style="padding-right:6px;vertical-align:bottom;">' + previewAssets.ttd + '</td>',
      '<td style="vertical-align:bottom;">' + previewAssets.stempel + '</td>',
      '</tr></table>',
      '<p style="font-weight:bold;margin-top:4px;">' + _esc(company.director_name || '') + '</p>',
      '<p style="font-size:9.5pt;color:#555;">' + _esc(company.director_title || '') + '</p>',
      '</td>',
      '<td style="width:50%;vertical-align:bottom;text-align:right;">',
      '<div style="display:inline-block;padding:8px;border:2px dashed #DDD;border-radius:4px;text-align:center;">',
      '<div style="width:80px;height:80px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999;border-radius:4px;margin:auto;">QR Code</div>',
      '<div style="font-size:8pt;color:#999;margin-top:4px;">Scan untuk verifikasi</div>',
      '</div>',
      '</td>',
      '</tr></table>',
    ].join('');
  }

  // Patch d untuk preview
  var dPreview = Object.assign({}, d);
  dPreview._signature = sigPreview(company, d.PLACE_DATE, d.DOCUMENT_NUMBER);
  dPreview._qrBlock   = '<div style="display:inline-block;padding:6px;border:1px dashed #CCC;border-radius:4px;text-align:center;"><div style="width:72px;height:72px;background:#f0f0f0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#999;">QR</div><div style="font-size:7pt;color:#999;margin-top:2px;">Verifikasi</div></div>';

  // Override fungsi _kop untuk preview
  var origKop = _kop;
  var body;
  var savedKop = _kop;

  // Temporary override tidak bisa di GAS — jadi kita ganti implementasi:
  // Untuk preview, langsung inject HTML kop ke body
  switch (docType) {
    case 'INV': body = kopPreview(company) + _tplInvoiceBody(dPreview, company); break;
    case 'KWT': body = kopPreview(company) + _tplKwitansiBody(dPreview, company); break;
    default:    body = kopPreview(company) + _tplSuratBody(dPreview, company); break;
  }
  body = body + footerPreview();

  return '<div style="font-family:Arial,sans-serif;font-size:12pt;color:#000;max-width:680px;margin:0 auto;padding:24px 32px;line-height:1.6;">' + body + '</div>';
}

// Helper: body-only (tanpa kop) untuk masing-masing template
// Dipakai oleh buildDocumentPreviewHtml agar kop bisa diganti versi preview

function _tplSuratBody(d, company) {
  return [
    '<p style="font-size:13pt;font-weight:bold;color:#C40000;text-align:center;text-transform:uppercase;margin:10px 0 14px;">' + _esc(d.DOCUMENT_TITLE) + '</p>',
    '<table style="border-collapse:collapse;width:auto;"><tr>',
    '<td style="padding:3px 0;font-weight:bold;white-space:nowrap;">Nomor</td>',
    '<td>: ' + _esc(d.DOCUMENT_NUMBER) + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Lampiran</td>',
    '<td>: ' + _esc(d.ATTACHMENT || '-') + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Perihal</td>',
    '<td>: <strong>' + _esc(d.SUBJECT) + '</strong></td>',
    '</tr></table>',
    '<p style="text-align:right;margin:8px 0 10px;">' + _esc(d.PLACE_DATE) + '</p>',
    '<p>Kepada Yth.</p>',
    '<p><strong>' + _esc(d.RECIPIENT_NAME || '') + '</strong><br>' + _esc(d.RECIPIENT_ADDRESS || '') + '</p>',
    '<p>Dengan hormat,</p>',
    '<p>' + _esc(d.BODY || '[ Isi surat akan muncul di sini ]') + '</p>',
    '<p>Demikian surat ini kami sampaikan. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.</p>',
    d._signature,
  ].join('');
}

function _tplInvoiceBody(d, company) {
  return [
    '<p style="font-size:13pt;font-weight:bold;color:#C40000;text-align:center;text-transform:uppercase;margin:10px 0 14px;">I N V O I C E</p>',
    '<table style="border-collapse:collapse;width:auto;"><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Nomor Invoice</td>',
    '<td>: <strong>' + _esc(d.DOCUMENT_NUMBER) + '</strong></td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Tanggal Invoice</td>',
    '<td>: ' + _esc(d.DOCUMENT_DATE) + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Jatuh Tempo</td>',
    '<td>: ' + _esc(d.DUE_DATE || '') + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Status Pembayaran</td>',
    '<td>: <strong style="color:#C40000;">' + _esc(d.STATUS || 'BELUM LUNAS') + '</strong></td>',
    '</tr></table>',
    '<hr style="border:0;border-top:1px solid #DDD;margin:10px 0;">',
    '<p style="font-size:10pt;font-weight:bold;color:#C40000;border-bottom:1.5px solid #C40000;padding-bottom:4px;margin:14px 0 8px;">DITAGIHKAN KEPADA</p>',
    '<p><strong>' + _esc(d.CLIENT_NAME || '') + '</strong><br>' + _esc(d.CLIENT_ADDRESS || '') + '</p>',
    '<p style="font-size:10pt;font-weight:bold;color:#C40000;border-bottom:1.5px solid #C40000;padding-bottom:4px;margin:14px 0 8px;">RINCIAN LAYANAN</p>',
    '<p>' + _esc(d.ITEMS || '[ Item akan muncul di sini ]') + '</p>',
    '<hr style="border:0;border-top:1px solid #DDD;margin:8px 0;">',
    '<table style="border-collapse:collapse;width:auto;margin-left:auto;"><tr>',
    '<td style="padding:3px 12px 3px 0;">Subtotal</td>',
    '<td>: ' + _esc(d.SUBTOTAL || '') + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 12px 3px 0;">PPN ' + _esc(d.TAX_PERCENT || '0') + '%</td>',
    '<td>: ' + _esc(d.TAX_AMOUNT || 'Rp 0') + '</td>',
    '</tr><tr>',
    '<td style="padding:3px 12px 3px 0;font-weight:bold;">GRAND TOTAL</td>',
    '<td style="font-weight:bold;color:#C40000;font-size:12pt;">: ' + _esc(d.GRAND_TOTAL || '') + '</td>',
    '</tr></table>',
    d._signature,
  ].join('');
}

function _tplKwitansiBody(d, company) {
  return [
    '<p style="font-size:13pt;font-weight:bold;color:#C40000;text-align:center;text-transform:uppercase;margin:10px 0 6px;">K W I T A N S I</p>',
    '<p style="text-align:center;font-size:10pt;color:#555;margin-bottom:12px;">Nomor: ' + _esc(d.DOCUMENT_NUMBER) + '</p>',
    '<hr style="border:0;border-top:1px solid #DDD;margin:8px 0 10px;">',
    '<table style="border-collapse:collapse;width:100%;"><tr>',
    '<td style="width:48%;padding:3px 0;white-space:nowrap;font-weight:bold;">Telah diterima dari</td>',
    '<td>: <strong>' + _esc(d.PAYER_NAME || '') + '</strong></td>',
    '</tr><tr>',
    '<td style="padding:3px 0;white-space:nowrap;">Keterangan</td>',
    '<td>: ' + _esc(d.PAYMENT_PURPOSE || '') + '</td>',
    '</tr></table>',
    '<hr style="border:0;border-top:1px solid #DDD;margin:10px 0;">',
    '<table style="border-collapse:collapse;width:auto;margin-left:auto;"><tr>',
    '<td style="padding:3px 12px 3px 0;font-weight:bold;font-size:12pt;">JUMLAH</td>',
    '<td style="font-size:12pt;font-weight:bold;color:#C40000;">: ' + _esc(d.AMOUNT || '') + '</td>',
    '</tr></table>',
    '<p style="font-size:9.5pt;margin-top:4px;">Terbilang: <em>' + _esc(d.AMOUNT_TEXT || '') + '</em></p>',
    d._signature,
  ].join('');
}

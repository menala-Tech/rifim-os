/**
 * RIFIM OS — QR Engine
 * Generate QR Code dan embed ke Google Doc sebelum export PDF.
 *
 * Alur: saveDocument() → embedQrInDoc() → exportToPDF()
 * QR mengarah ke GDoc URL agar dokumen bisa diverifikasi online.
 */

/**
 * Buat URL image QR code via QR Server API (gratis, tanpa API key).
 * @param {string} data - Konten QR (biasanya GDoc URL)
 * @returns {string} URL image QR
 */
function generateQrImageUrl(data) {
  return 'https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=4&data=' +
    encodeURIComponent(data);
}

/**
 * Fetch QR image dan embed ke Google Doc.
 * - Cari placeholder {{QR_CODE}} → ganti dengan image inline
 * - Jika tidak ada placeholder → tambah di pojok kanan bawah dokumen
 *
 * @param {string} docId  - Google Doc ID
 * @param {string} qrData - Konten QR (URL dokumen)
 * @returns {string} qrImageUrl, atau '' jika gagal
 */
function embedQrInDoc(docId, qrData) {
  try {
    var qrImageUrl = generateQrImageUrl(qrData);
    var response   = UrlFetchApp.fetch(qrImageUrl, { muteHttpExceptions: true });

    if (response.getResponseCode() !== 200) {
      Logger.log('QR Engine: HTTP ' + response.getResponseCode() + ' — skip embed');
      return '';
    }

    var blob = response.getBlob().setName('rifim-qr.png');
    var doc  = DocumentApp.openById(docId);
    var body = doc.getBody();

    // Cari placeholder {{QR_CODE}}
    var found = body.findText('\\{\\{QR_CODE\\}\\}');
    if (found) {
      var para = found.getElement().getParent().asParagraph();
      para.clear();
      para.appendInlineImage(blob).setWidth(90).setHeight(90);
    } else {
      // Tidak ada placeholder → tambah blok QR di pojok kanan bawah
      body.appendParagraph('').setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
      var qrPara = body.appendParagraph('');
      qrPara.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
      qrPara.appendInlineImage(blob).setWidth(80).setHeight(80);
      var note = body.appendParagraph('Scan untuk verifikasi dokumen');
      note.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
      note.editAsText().setFontFamily('Arial').setFontSize(8).setForegroundColor('#999999');
    }

    doc.saveAndClose();
    Logger.log('QR Engine: embedded → ' + docId);
    return qrImageUrl;

  } catch (err) {
    Logger.log('QR Engine error (non-fatal): ' + err.message);
    return '';
  }
}

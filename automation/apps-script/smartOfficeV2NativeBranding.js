/**
 * Smart Office V2 — native page branding + canonical Drive output.
 * Final DOC + PDF always use the canonical Smart Office monthly document folder.
 */
function soV2ApplyNativePageBranding_(docId, companyCode) {
  var company = soV2GetCompany_(companyCode || 'RIFIM');
  var doc = DocumentApp.openById(docId);
  var body = doc.getBody();
  body.setMarginTop(28.35).setMarginBottom(28.35).setMarginLeft(70.87).setMarginRight(70.87);

  var header = doc.getHeader() || doc.addHeader();
  header.clear();
  if (company.letterhead_asset_id) {
    var h = header.appendImage(DriveApp.getFileById(String(company.letterhead_asset_id)).getBlob());
    try {
      var ratio = h.getHeight() / h.getWidth();
      h.setWidth(453).setHeight(Math.round(453 * ratio));
    } catch (_) {}
  }

  var footer = doc.getFooter() || doc.addFooter();
  footer.clear();
  if (company.footer_asset_id) {
    var f = footer.appendImage(DriveApp.getFileById(String(company.footer_asset_id)).getBlob());
    try {
      var fr = f.getHeight() / f.getWidth();
      f.setWidth(453).setHeight(Math.round(453 * fr));
    } catch (_) {}
  }
  doc.saveAndClose();
}

function soV2PreserveDocAndExportPdf_(docId, fileName, folderId, companyCode, docType) {
  soV2ApplyNativePageBranding_(docId, companyCode);
  if (typeof _smartOfficeCanonicalOutputFolder_ !== 'function') {
    throw new Error('Canonical Smart Office Drive resolver belum tersedia.');
  }
  // folderId is accepted only for backward-call compatibility; it is never trusted as destination.
  var folder = _smartOfficeCanonicalOutputFolder_(String(docType || 'SURAT').toUpperCase(), new Date());
  var docFile = DriveApp.getFileById(docId);
  docFile.setName(fileName);
  try { docFile.moveTo(folder); } catch (_) { /* shared-drive compatibility */ }
  var pdf = folder.createFile(docFile.getAs(MimeType.PDF).setName(fileName + '.pdf'));
  return {
    docId: docId,
    docUrl: docFile.getUrl(),
    pdfId: pdf.getId(),
    pdfUrl: pdf.getUrl(),
    folderId: folder.getId()
  };
}

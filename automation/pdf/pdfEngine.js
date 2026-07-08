/**
 * RIFIM OS — PDF Engine
 * Export Google Doc ke PDF dan simpan di Google Drive.
 */

/**
 * Export Google Doc ke PDF.
 * @param {string} docId      - Google Doc ID
 * @param {string} docNumber  - Nomor dokumen (untuk nama file)
 * @returns {GoogleAppsScript.Drive.File} PDF file
 */
function exportToPDF(docId, docNumber) {
  const config      = getCompanyConfig();
  const outputFolder = DriveApp.getFolderById(config.OUTPUT_FOLDER_ID);
  const pdfFolder   = _getOrCreatePDFFolder(outputFolder);

  const doc     = DriveApp.getFileById(docId);
  const pdfBlob = doc.getAs('application/pdf');
  const pdfName = docNumber.replace(/\//g, '-') + '.pdf';

  const existingFiles = pdfFolder.getFilesByName(pdfName);
  if (existingFiles.hasNext()) {
    existingFiles.next().setTrashed(true);
  }

  return pdfFolder.createFile(pdfBlob.setName(pdfName));
}

/** @private */
function _getOrCreatePDFFolder(parent) {
  const name     = 'PDF';
  const existing = parent.getFoldersByName(name);
  if (existing.hasNext()) return existing.next();
  return parent.createFolder(name);
}

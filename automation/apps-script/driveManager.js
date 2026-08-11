/**
 * RIFIM OS — Drive Manager V4
 *
 * Semua output Smart Office wajib memakai Canonical Drive Storage:
 *   02_MODULES_PWA/02_SMART_OFFICE/YYYY/MM_Bulan/03_PDF/<Jenis Dokumen>/
 *
 * Folder legacy drive_folder_* tetap ada di company_config hanya untuk
 * backward compatibility/audit, tetapi TIDAK dipakai untuk write baru.
 */

var _FOLDER_MAP = {
  SURAT: 'Surat', ST: 'Surat', SIZ: 'Surat', SKT: 'Surat',
  INV: 'Invoice', KWT: 'Kwitansi', PROP: 'Proposal', CP: 'Company Profile',
  MOU: 'MOU', PKS: 'Perjanjian Kerjasama',
  PKWT: 'Kontrak Karyawan', SPG: 'Kontrak Karyawan', SMT: 'Kontrak Karyawan', PI: 'Kontrak Karyawan',
  SP1: 'Surat Peringatan', SP2: 'Surat Peringatan', SP3: 'Surat Peringatan', PHK: 'Surat Peringatan',
  BA: 'Berita Acara', FCO: 'Form Checklist'
};

function getTemplateCopy(templateId, docNumber) {
  var template = DriveApp.getFileById(templateId);
  var draftName = '[DRAFT] ' + docNumber.replace(/\//g, '-');
  // V4: bahkan draft pertama langsung dibuat di tree canonical; tidak pernah
  // singgah sebagai writer ke My Drive/root atau folder legacy.
  var docCode = String(docNumber || '').split('/')[0] || 'LAIN';
  var folder = _smartOfficeCanonicalOutputFolder_(docCode, new Date());
  return template.makeCopy(draftName, folder);
}

function _smartOfficeCanonicalOutputFolder_(docCode, when) {
  if (typeof canonicalDriveGetMonthFolder !== 'function') {
    throw new Error('canonicalDriveStorage.js belum terpasang — Smart Office menolak fallback ke folder legacy');
  }
  var pdfRoot = canonicalDriveGetMonthFolder('smart_office', 'pdf', when);
  var typeName = _FOLDER_MAP[String(docCode || '').toUpperCase()] || 'Lainnya';
  return canonicalDriveGetOrCreateFolder_(pdfRoot, typeName);
}

function saveDocument(docFile, docCode, docNumber) {
  var folder = _smartOfficeCanonicalOutputFolder_(docCode, new Date());
  var fileName = docNumber.replace(/\//g, '-');
  docFile.setName(fileName);
  docFile.moveTo(folder);
  return docFile;
}

function exportToPDF(docId, docCode, docNumber) {
  var doc = DriveApp.getFileById(docId);
  var folder = _smartOfficeCanonicalOutputFolder_(docCode, new Date());
  var pdfName = docNumber.replace(/\//g, '-') + '.pdf';
  var pdfBlob = doc.getAs(MimeType.PDF).setName(pdfName);
  return folder.createFile(pdfBlob);
}

/**
 * Compatibility helper. Existing callers that still call _getMonthFolder()
 * are redirected to the canonical Smart Office PDF tree.
 */
function _getMonthFolder(docCode) {
  return _smartOfficeCanonicalOutputFolder_(docCode, new Date());
}

function _getOrCreateFolder(parentFolder, name) {
  if (typeof canonicalDriveGetOrCreateFolder_ === 'function') {
    return canonicalDriveGetOrCreateFolder_(parentFolder, name);
  }
  var it = parentFolder.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parentFolder.createFolder(name);
}

function getDrivePreviewUrl(fileId) {
  return 'https://drive.google.com/file/d/' + fileId + '/view';
}

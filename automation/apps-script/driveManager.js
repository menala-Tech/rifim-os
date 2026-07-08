/**
 * RIFIM OS — Drive Manager
 * Kelola penyimpanan file di Google Drive.
 *
 * Struktur penyimpanan:
 * 📁 Root (RIFIM OS)
 *   └── 📁 Dokumen
 *         └── 📁 [Jenis Dokumen]          ← misal: Surat, Invoice, SP
 *               └── 📁 [Bulan Tahun]      ← misal: Juli 2026
 *                     ├── 001-RIFIM-INV-VII-2026.gdoc
 *                     └── 001-RIFIM-INV-VII-2026.pdf
 */

// ── Mapping kode dokumen → nama folder ───────────────────────
var _FOLDER_MAP = {
  SURAT: 'Surat',
  ST:    'Surat',
  SIZ:   'Surat',
  SKT:   'Surat',
  INV:   'Invoice',
  KWT:   'Kwitansi',
  PROP:  'Proposal',
  CP:    'Company Profile',
  MOU:   'MOU',
  PKS:   'Perjanjian Kerjasama',
  PKWT:  'Kontrak Karyawan',
  SPG:   'Kontrak Karyawan',
  SMT:   'Kontrak Karyawan',
  PI:    'Kontrak Karyawan',
  SP1:   'Surat Peringatan',
  SP2:   'Surat Peringatan',
  SP3:   'Surat Peringatan',
  PHK:   'Surat Peringatan',
  BA:    'Berita Acara',
  FCO:   'Form Checklist',
};

var _MONTHS_ID = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
];


/**
 * Buat salinan template Google Doc.
 * @param {string} templateId  - Google Doc ID dari company_config
 * @param {string} docNumber   - Nomor dokumen (untuk nama file draft)
 * @returns {GoogleAppsScript.Drive.File}
 */
function getTemplateCopy(templateId, docNumber) {
  var template = DriveApp.getFileById(templateId);
  var draftName = '[DRAFT] ' + docNumber.replace(/\//g, '-');

  // Simpan draft ke root sementara, akan dipindah setelah selesai
  var copy = template.makeCopy(draftName);
  return copy;
}


/**
 * Pindahkan Google Doc ke folder final yang tepat.
 * Path: Root > Dokumen > [Jenis] > [Bulan Tahun]
 *
 * @param {GoogleAppsScript.Drive.File} docFile
 * @param {string} docCode   - SURAT / INV / SP1 / dll
 * @param {string} docNumber - 001/RIFIM/INV/VII/2026
 * @returns {GoogleAppsScript.Drive.File}
 */
function saveDocument(docFile, docCode, docNumber) {
  var folder   = _getMonthFolder(docCode);
  var fileName = docNumber.replace(/\//g, '-');

  docFile.setName(fileName);
  docFile.moveTo(folder);

  return docFile;
}


/**
 * Export Google Doc ke PDF, simpan ke folder yang sama.
 * @param {string} docId    - Google Doc ID (setelah placeholder terisi)
 * @param {string} docCode  - SURAT / INV / dll
 * @param {string} docNumber
 * @returns {GoogleAppsScript.Drive.File} File PDF
 */
function exportToPDF(docId, docCode, docNumber) {
  var doc     = DriveApp.getFileById(docId);
  var folder  = _getMonthFolder(docCode);
  var pdfName = docNumber.replace(/\//g, '-') + '.pdf';

  // Export sebagai PDF blob
  var pdfBlob = doc.getAs(MimeType.PDF).setName(pdfName);
  var pdfFile = folder.createFile(pdfBlob);

  return pdfFile;
}


/**
 * Ambil (atau buat) folder bulan untuk kode dokumen tertentu.
 * Path: Root > Dokumen > [Jenis] > [Bulan Tahun]
 * @private
 */
function _getMonthFolder(docCode) {
  var config  = getCompanyConfig();
  var rootId  = config['drive_root_folder_id'] || DRIVE_ROOT_FOLDER_ID;
  var root    = DriveApp.getFolderById(rootId);

  // Level 1: Dokumen
  var dokumen = _getOrCreateFolder(root, 'Dokumen');

  // Level 2: Jenis dokumen
  var typeName   = _FOLDER_MAP[docCode] || 'Lainnya';
  var typeFolder = _getOrCreateFolder(dokumen, typeName);

  // Level 3: Bulan Tahun (mis. "Juli 2026")
  var now        = new Date();
  var monthName  = _MONTHS_ID[now.getMonth()] + ' ' + now.getFullYear();
  var monthFolder = _getOrCreateFolder(typeFolder, monthName);

  return monthFolder;
}


/**
 * Ambil atau buat subfolder dalam parent.
 * @private
 */
function _getOrCreateFolder(parentFolder, name) {
  var it = parentFolder.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parentFolder.createFolder(name);
}


/**
 * Buat URL preview Google Drive untuk file.
 * @param {string} fileId
 * @returns {string}
 */
function getDrivePreviewUrl(fileId) {
  return 'https://drive.google.com/file/d/' + fileId + '/view';
}

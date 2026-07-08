/**
 * RIFIM OS — Drive Manager
 * Kelola penyimpanan file di Google Drive secara terstruktur.
 */

const DRIVE_FOLDERS = {
  SURAT:           'Surat',
  INVOICE:         'Invoice',
  KWITANSI:        'Kwitansi',
  PROPOSAL:        'Proposal',
  MOU:             'MOU',
  PKWT:            'PKWT',
  SP:              'Surat Peringatan',
  BERITA_ACARA:    'Berita Acara',
  SURAT_TUGAS:     'Surat Tugas',
  COMPANY_PROFILE: 'Company Profile',
};

/**
 * Buat salinan template dan kembalikan Google Doc-nya.
 * @param {string} templateId  - Google Doc template ID
 * @param {string} docNumber   - Nomor dokumen (untuk nama file)
 * @returns {GoogleAppsScript.Drive.File}
 */
function getTemplateCopy(templateId, docNumber) {
  const template = DriveApp.getFileById(templateId);
  const config   = getCompanyConfig();
  const tempFolder = DriveApp.getFolderById(config.TEMPLATE_FOLDER_ID);
  const copy = template.makeCopy('[DRAFT] ' + docNumber, tempFolder);
  return copy;
}

/**
 * Pindahkan dokumen final ke folder yang tepat.
 * @param {GoogleAppsScript.Drive.File} docFile
 * @param {string} docType
 * @param {string} docNumber
 * @returns {GoogleAppsScript.Drive.File}
 */
function saveDocument(docFile, docType, docNumber) {
  const config       = getCompanyConfig();
  const outputFolder = DriveApp.getFolderById(config.OUTPUT_FOLDER_ID);
  const subFolderName = DRIVE_FOLDERS[docType] || 'Lainnya';
  const subFolder    = _getOrCreateFolder(outputFolder, subFolderName);

  docFile.setName(docNumber.replace(/\//g, '-'));
  docFile.moveTo(subFolder);

  return docFile;
}

/**
 * Ambil atau buat sub-folder di dalam parent folder.
 * @private
 */
function _getOrCreateFolder(parentFolder, name) {
  const existing = parentFolder.getFoldersByName(name);
  if (existing.hasNext()) return existing.next();
  return parentFolder.createFolder(name);
}

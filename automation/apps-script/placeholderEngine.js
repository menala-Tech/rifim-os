/**
 * RIFIM OS — Placeholder Engine
 * Replace semua {{PLACEHOLDER}} dalam Google Doc dengan data yang diberikan.
 *
 * Prinsip: satu engine untuk semua jenis dokumen.
 */

/**
 * Replace placeholder di Google Doc.
 * @param {string} docId  - Google Doc ID
 * @param {object} data   - Key-value pair: { RECIPIENT_NAME: 'PT. XYZ', ... }
 */
function replacePlaceholders(docId, data) {
  if (!docId) throw new Error('docId diperlukan.');
  if (!data || typeof data !== 'object') throw new Error('data harus berupa object.');

  const doc  = DocumentApp.openById(docId);
  const body = doc.getBody();

  Object.keys(data).forEach(function(key) {
    const placeholder = '{{' + key + '}}';
    const value       = data[key] !== undefined && data[key] !== null ? String(data[key]) : '';
    body.replaceText(placeholder, value);
  });

  doc.saveAndClose();
}

/**
 * Buat data object lengkap dari input user + config perusahaan.
 * @param {object} userInput  - Data dari form user
 * @param {object} config     - Data perusahaan dari company_config
 * @param {string} docNumber  - Nomor dokumen dari Numbering Engine
 * @returns {object} Data siap pakai untuk replacePlaceholders()
 */
function buildPlaceholderData(userInput, config, docNumber) {
  const now  = new Date();
  const date = _formatDateIndonesian(now);

  return {
    // System
    DOCUMENT_NUMBER:    docNumber,
    DOCUMENT_DATE:      userInput.documentDate || date,
    DOCUMENT_TYPE:      userInput.documentType || '',

    // Company (dari config)
    COMPANY_NAME:       config.COMPANY_NAME    || '',
    COMPANY_ADDRESS:    config.COMPANY_ADDRESS || '',
    COMPANY_PHONE:      config.COMPANY_PHONE   || '',
    COMPANY_EMAIL:      config.COMPANY_EMAIL   || '',
    COMPANY_WEBSITE:    config.COMPANY_WEBSITE || '',
    CITY:               config.CITY            || 'Batam',

    // Signatory
    DIRECTOR_NAME:      config.DIRECTOR_NAME   || '',
    DIRECTOR_TITLE:     config.DIRECTOR_TITLE  || '',

    // Recipient (dari user input)
    RECIPIENT_NAME:     userInput.recipientName    || '',
    RECIPIENT_COMPANY:  userInput.recipientCompany || '',
    RECIPIENT_ADDRESS:  userInput.recipientAddress || '',

    // Document content (dari user input)
    SUBJECT:            userInput.subject    || '',
    ATTACHMENT:         userInput.attachment || '-',
    BODY:               userInput.body       || '',

    // Footer
    PLACE_DATE:         config.CITY + ', ' + date,
  };
}

/**
 * Format tanggal ke bahasa Indonesia.
 * @private
 */
function _formatDateIndonesian(date) {
  const months = [
    'Januari','Februari','Maret','April','Mei','Juni',
    'Juli','Agustus','September','Oktober','November','Desember'
  ];
  return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
}

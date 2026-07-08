/**
 * RIFIM OS — Placeholder Engine
 * Replace semua {{PLACEHOLDER}} dalam Google Doc dengan data yang diberikan.
 */

/**
 * Replace placeholder di Google Doc.
 * @param {string} docId
 * @param {object} data - { RECIPIENT_NAME: 'PT. XYZ', ... }
 */
function replacePlaceholders(docId, data) {
  if (!docId) throw new Error('docId diperlukan.');
  if (!data || typeof data !== 'object') throw new Error('data harus berupa object.');

  const doc  = DocumentApp.openById(docId);
  const body = doc.getBody();

  Object.keys(data).forEach(function(key) {
    const placeholder = '{{' + key + '}}';
    const value       = (data[key] !== undefined && data[key] !== null) ? String(data[key]) : '';
    body.replaceText(placeholder, value);
  });

  doc.saveAndClose();
}

/**
 * Buat data object lengkap dari input user + config perusahaan.
 * Semua field di userInput.extra di-spread jadi placeholder (uppercase).
 *
 * @param {object} userInput  - Data dari form dashboard
 * @param {object} config     - Key-value dari sheet company_config (lowercase keys)
 * @param {string} docNumber  - Nomor dari numberingEngine
 * @returns {object}
 */
function buildPlaceholderData(userInput, config, docNumber) {
  var now  = new Date();
  var date = _formatDateIndonesian(now);

  var data = {
    // ── System ──────────────────────────────────────────────
    DOCUMENT_NUMBER:   docNumber,
    DOCUMENT_DATE:     userInput.documentDate ? _formatDateIndonesian(new Date(userInput.documentDate)) : date,
    DOCUMENT_TYPE:     userInput.documentType || '',
    PLACE_DATE:        (config['company_city'] || 'Batam') + ', ' + date,

    // ── Perusahaan (config lowercase keys) ──────────────────
    COMPANY_NAME:      config['company_name']     || 'PT. RIFIM INTERNASIONAL GEMILANG',
    COMPANY_ADDRESS:   config['company_address']  || '',
    COMPANY_PHONE:     config['company_phone']    || '',
    COMPANY_EMAIL:     config['company_email']    || '',
    COMPANY_WEBSITE:   config['company_website']  || '',
    CITY:              config['company_city']      || 'Batam',

    // ── Penanda tangan ───────────────────────────────────────
    DIRECTOR_NAME:     userInput.directorName  || config['director_name']  || '',
    DIRECTOR_TITLE:    userInput.directorTitle || config['director_title'] || '',

    // ── Penerima / umum ──────────────────────────────────────
    RECIPIENT_NAME:    userInput.recipientName    || '',
    RECIPIENT_COMPANY: userInput.recipientCompany || '',
    RECIPIENT_ADDRESS: userInput.recipientAddress || '',

    // ── Konten dokumen ───────────────────────────────────────
    SUBJECT:           userInput.subject    || '',
    ATTACHMENT:        userInput.attachment || '-',
    BODY:              userInput.body       || '',

    // ── Status (Invoice, dll) ────────────────────────────────
    STATUS:            userInput.status     || 'BELUM LUNAS',
  };

  // ── Spread semua extra fields → jadi {{KEY_UPPERCASE}} ────
  // Dashboard mengirim extra: { employee_name: '...', task_desc: '...' }
  // → menjadi EMPLOYEE_NAME, TASK_DESC, dll.
  if (userInput.extra && typeof userInput.extra === 'object') {
    Object.keys(userInput.extra).forEach(function(k) {
      var placeholderKey = k.toUpperCase();
      if (!data[placeholderKey]) {
        data[placeholderKey] = userInput.extra[k] || '';
      }
    });
  }

  return data;
}

/**
 * Format tanggal ke bahasa Indonesia.
 * @private
 */
function _formatDateIndonesian(date) {
  var months = ['Januari','Februari','Maret','April','Mei','Juni',
                'Juli','Agustus','September','Oktober','November','Desember'];
  return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
}

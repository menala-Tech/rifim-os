/**
 * RIFIM OS — Database Layer
 * Abstraksi akses Google Sheets.
 * Dirancang agar mudah dimigrasi ke Supabase di Phase 2.
 */

/**
 * Simpan record dokumen ke sheet documents.
 * @param {object} record - Document record object
 */
function saveDocumentRecord(record) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('documents');

  if (!sheet) throw new Error('Sheet documents tidak ditemukan.');

  sheet.appendRow([
    record.id,
    record.document_number,
    record.document_type,
    record.document_date,
    record.recipient_name,
    record.recipient_address,
    record.subject,
    record.body,
    record.attachment,
    record.status,
    record.gdoc_url,
    record.pdf_url,
    record.qr_url  || '',
    record.created_by,
    record.created_at,
    record.updated_at,
  ]);
}

/**
 * Ambil semua dokumen dari sheet.
 * @param {object} filters - { documentType, status, month, year }
 * @returns {Array} Array of record objects
 */
function getDocuments(filters) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('documents');

  if (!sheet) throw new Error('Sheet documents tidak ditemukan.');

  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  let records   = [];

  for (let i = 1; i < data.length; i++) {
    const row    = data[i];
    const record = {};
    headers.forEach(function(h, idx) { record[h] = row[idx]; });
    records.push(record);
  }

  if (filters) {
    if (filters.documentType) records = records.filter(function(r) { return r.document_type === filters.documentType; });
    if (filters.status)       records = records.filter(function(r) { return r.status === filters.status; });
  }

  return records;
}

/**
 * Update status dokumen.
 * @param {string} documentNumber
 * @param {string} newStatus
 */
function updateDocumentStatus(documentNumber, newStatus) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('documents');
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === documentNumber) {
      sheet.getRange(i + 1, 10).setValue(newStatus);
      sheet.getRange(i + 1, 16).setValue(new Date().toISOString());
      return true;
    }
  }

  return false;
}

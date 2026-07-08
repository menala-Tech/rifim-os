/**
 * RIFIM OS — Database Layer
 * Abstraksi akses Google Sheets.
 * Dirancang agar mudah dimigrasi ke Supabase di Phase 2.
 *
 * Kolom sheet `documents` (17 kolom, urut):
 * id | document_number | document_type | document_code | document_date |
 * recipient_name | recipient_address | subject | attachment | body_summary |
 * status | gdoc_url | pdf_url | qr_url | created_by | created_at | updated_at
 */

/**
 * Simpan record dokumen ke sheet documents.
 * @param {object} record
 */
function saveDocumentRecord(record) {
  const sheet = _getDB().getSheetByName('documents');
  if (!sheet) throw new Error('Sheet documents tidak ditemukan.');

  sheet.appendRow([
    record.id,
    record.document_number,
    record.document_type,
    record.document_code   || '',
    record.document_date,
    record.recipient_name,
    record.recipient_address || '',
    record.subject,
    record.attachment      || '-',
    record.body_summary    || '',
    record.status          || 'FINAL',
    record.gdoc_url        || '',
    record.pdf_url         || '',
    record.qr_url          || '',
    record.created_by      || '',
    record.created_at,
    record.updated_at,
  ]);
}

/**
 * Ambil semua dokumen.
 * @param {object} filters - { documentCode, status }
 * @returns {Array}
 */
function getDocuments(filters) {
  const sheet = _getDB().getSheetByName('documents');
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
    if (filters.documentCode) records = records.filter(function(r) { return r.document_code === filters.documentCode; });
    if (filters.status)       records = records.filter(function(r) { return r.status === filters.status; });
  }

  return records;
}

/**
 * Update status dokumen berdasarkan document_number.
 * @param {string} documentNumber
 * @param {string} newStatus  DRAFT | FINAL | SENT | ARCHIVED
 */
function updateDocumentStatus(documentNumber, newStatus) {
  const sheet = _getDB().getSheetByName('documents');
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === documentNumber) {
      sheet.getRange(i + 1, 11).setValue(newStatus);           // kolom 11 = status
      sheet.getRange(i + 1, 17).setValue(new Date().toISOString()); // kolom 17 = updated_at
      return true;
    }
  }
  return false;
}

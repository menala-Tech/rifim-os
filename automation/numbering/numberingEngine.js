/**
 * RIFIM OS — Numbering Engine
 * Auto-generate nomor dokumen unik per jenis, bulan, tahun.
 *
 * Format: [SEQ]/[COMPANY]-[TYPE]/[MONTH-ROMAN]/[YEAR]
 * Contoh: 001/RIFIM/SURAT/VII/2026
 */

const ROMAN_MONTHS = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

const DOC_CODES = {
  SURAT:        'SURAT',
  INVOICE:      'INV',
  KWITANSI:     'KWT',
  PROPOSAL:     'PROP',
  MOU:          'MOU',
  PKWT:         'PKWT',
  SP:           'SP',
  BERITA_ACARA: 'BA',
  SURAT_TUGAS:  'ST',
  COMPANY_PROFILE: 'CP',
};

/**
 * Generate nomor dokumen berikutnya.
 * @param {string} docType  - Jenis dokumen (key dari DOC_CODES)
 * @param {string} company  - Kode perusahaan (default: 'RIFIM')
 * @returns {string} Nomor dokumen, contoh: 001/RIFIM/SURAT/VII/2026
 */
function generateDocumentNumber(docType, company) {
  company = company || 'RIFIM';

  const code = DOC_CODES[docType];
  if (!code) throw new Error('Unknown document type: ' + docType);

  const now     = new Date();
  const month   = now.getMonth() + 1;
  const year    = now.getFullYear();
  const seq     = _getNextSequence(docType, month, year);
  const seqStr  = String(seq).padStart(3, '0');
  const monthRm = ROMAN_MONTHS[month - 1];

  return seqStr + '/' + company + '/' + code + '/' + monthRm + '/' + year;
}

/**
 * Ambil sequence berikutnya dari sheet numbering_sequences.
 * @private
 */
function _getNextSequence(docType, month, year) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('numbering_sequences');

  if (!sheet) throw new Error('Sheet numbering_sequences tidak ditemukan.');

  const data = sheet.getDataRange().getValues();

  // Row 0 = header
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] === docType && row[1] === month && row[2] === year) {
      const newSeq = Number(row[3]) + 1;
      sheet.getRange(i + 1, 4).setValue(newSeq);
      sheet.getRange(i + 1, 5).setValue(new Date().toISOString());
      return newSeq;
    }
  }

  // Baris baru jika belum ada
  sheet.appendRow([docType, month, year, 1, new Date().toISOString()]);
  return 1;
}

/**
 * Parse nomor dokumen menjadi komponen-komponennya.
 * @param {string} docNumber - Nomor dokumen
 * @returns {object} { seq, company, code, month, year }
 */
function parseDocumentNumber(docNumber) {
  const parts = docNumber.split('/');
  if (parts.length !== 4) throw new Error('Format nomor dokumen tidak valid: ' + docNumber);

  return {
    seq:     parseInt(parts[0], 10),
    company: parts[1],
    code:    parts[2],
    month:   ROMAN_MONTHS.indexOf(parts[3].split('/')[0]) + 1,
    year:    parseInt(parts[3], 10),
  };
}

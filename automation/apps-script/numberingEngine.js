/**
 * RIFIM OS — Numbering Engine
 * Generate nomor dokumen otomatis dengan format:
 * 001/RIFIM/{CODE}/{BULAN_ROMAWI}/{TAHUN}
 *
 * Nomor urut diambil dari sheet numbering_sequences,
 * di-increment, lalu disimpan kembali (atomic per baris).
 */

const MONTHS_ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

/**
 * Generate nomor dokumen berikutnya untuk tipe tertentu.
 * @param {string} documentCode  - INV / SURAT / PKWT / SP1 / dll
 * @returns {string}             - mis. "012/RIFIM/INV/VII/2026"
 */
function generateDocumentNumber(documentCode, prefix) {
  prefix = prefix || 'RIFIM';
  const sheet = _getDB().getSheetByName('numbering_sequences');
  if (!sheet) throw new Error('Sheet numbering_sequences tidak ditemukan.');

  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  const roman = MONTHS_ROMAN[now.getMonth()];

  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === documentCode) {
      const rowYear  = Number(data[i][1]);
      const rowMonth = Number(data[i][2]);

      // Reset urutan jika bulan/tahun berubah
      const isNewPeriod = (rowYear !== year || rowMonth !== month);
      const lastSeq     = isNewPeriod ? 0 : Number(data[i][4]);
      const nextSeq     = lastSeq + 1;

      // Update baris di sheet
      sheet.getRange(i + 1, 2).setValue(year);
      sheet.getRange(i + 1, 3).setValue(month);
      sheet.getRange(i + 1, 4).setValue(roman);
      sheet.getRange(i + 1, 5).setValue(nextSeq);

      // Format: "012/RIFIM/INV/VII/2026"
      const seq = String(nextSeq).padStart(3, '0');
      return seq + '/' + prefix + '/' + documentCode + '/' + roman + '/' + year;
    }
  }

  throw new Error('Kode dokumen tidak terdaftar di numbering_sequences: ' + documentCode);
}

/**
 * Lihat nomor terakhir tanpa increment (untuk preview).
 * @param {string} documentCode
 * @returns {string}
 */
function peekNextDocumentNumber(documentCode, prefix) {
  prefix = prefix || 'RIFIM';
  const sheet = _getDB().getSheetByName('numbering_sequences');
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  const roman = MONTHS_ROMAN[now.getMonth()];
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === documentCode) {
      const rowYear  = Number(data[i][1]);
      const rowMonth = Number(data[i][2]);
      const isNew    = (rowYear !== year || rowMonth !== month);
      const nextSeq  = isNew ? 1 : Number(data[i][4]) + 1;
      return String(nextSeq).padStart(3, '0') + '/' + prefix + '/' + documentCode + '/' + roman + '/' + year;
    }
  }
  return '001/' + prefix + '/' + documentCode + '/' + roman + '/' + year;
}

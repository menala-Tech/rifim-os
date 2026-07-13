/**
 * RIFIM OS — Numbering Engine
 * Generate nomor dokumen otomatis dengan format:
 * 001/RIFIM/{CODE}/{BULAN_ROMAWI}/{TAHUN}
 *
 * Nomor urut diambil dari sheet numbering_sequences,
 * di-increment, lalu disimpan kembali.
 *
 * FIX #17 — CRITICAL RACE CONDITION:
 *   Operasi read-then-write ke numbering_sequences WAJIB dilindungi ScriptLock.
 *   Tanpa lock, dua request bersamaan membaca angka yang sama → nomor dokumen DUPLIKAT.
 *   Misal: request A dan B keduanya baca seq=11 → keduanya tulis "012/..." → tabrakan.
 */

var MONTHS_ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

/**
 * Generate nomor dokumen berikutnya untuk tipe tertentu.
 * Dilindungi ScriptLock — atomic read-increment-write.
 *
 * @param {string} documentCode  - INV / SURAT / PKWT / SP1 / dll
 * @param {string} [prefix]      - 'RIFIM' (default)
 * @returns {string}             - mis. "012/RIFIM/INV/VII/2026"
 */
function generateDocumentNumber(documentCode, prefix) {
  prefix = prefix || 'RIFIM';

  // FIX #17 — seluruh read-modify-write di dalam satu ScriptLock
  return _gasWithLock(function() {
    var sheet = _getDB().getSheetByName('numbering_sequences');
    if (!sheet) throw new Error('Sheet numbering_sequences tidak ditemukan.');

    var now   = new Date();
    var year  = now.getFullYear();
    var month = now.getMonth() + 1;
    var roman = MONTHS_ROMAN[now.getMonth()];
    var data  = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] !== documentCode) continue;

      var rowYear  = Number(data[i][1]);
      var rowMonth = Number(data[i][2]);

      // Reset urutan jika bulan/tahun berubah
      var isNewPeriod = (rowYear !== year || rowMonth !== month);
      var lastSeq     = isNewPeriod ? 0 : Number(data[i][4]);
      var nextSeq     = lastSeq + 1;

      // Tulis balik ke sheet dalam lock yang sama — tidak ada window untuk race
      sheet.getRange(i + 1, 2).setValue(year);
      sheet.getRange(i + 1, 3).setValue(month);
      sheet.getRange(i + 1, 4).setValue(roman);
      sheet.getRange(i + 1, 5).setValue(nextSeq);

      // Format: "012/RIFIM/INV/VII/2026"
      var seq = String(nextSeq).padStart(3, '0');
      return seq + '/' + prefix + '/' + documentCode + '/' + roman + '/' + year;
    }

    throw new Error('Kode dokumen tidak terdaftar di numbering_sequences: ' + documentCode);
  });
}

/**
 * Lihat nomor terakhir tanpa increment (untuk preview).
 * READ-ONLY — tidak perlu lock.
 *
 * @param {string} documentCode
 * @param {string} [prefix]
 * @returns {string}
 */
function peekNextDocumentNumber(documentCode, prefix) {
  prefix = prefix || 'RIFIM';
  var sheet = _getDB().getSheetByName('numbering_sequences');
  var now   = new Date();
  var year  = now.getFullYear();
  var month = now.getMonth() + 1;
  var roman = MONTHS_ROMAN[now.getMonth()];
  var data  = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === documentCode) {
      var rowYear  = Number(data[i][1]);
      var rowMonth = Number(data[i][2]);
      var isNew    = (rowYear !== year || rowMonth !== month);
      var nextSeq  = isNew ? 1 : Number(data[i][4]) + 1;
      return String(nextSeq).padStart(3, '0') + '/' + prefix + '/' + documentCode + '/' + roman + '/' + year;
    }
  }
  return '001/' + prefix + '/' + documentCode + '/' + roman + '/' + year;
}

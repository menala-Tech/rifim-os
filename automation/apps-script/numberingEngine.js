/**
 * RIFIM OS — Numbering Engine
 * Generate nomor dokumen otomatis dengan format:
 * {seq}/{PREFIX}/{CODE}/{BULAN_ROMAWI}/{TAHUN}
 * Contoh: 012/MIG/INV/VII/2026
 *
 * Nomor urut diambil dari sheet numbering_sequences,
 * di-increment, lalu disimpan kembali.
 *
 * FIX #17 — CRITICAL RACE CONDITION:
 *   Operasi read-then-write ke numbering_sequences WAJIB dilindungi ScriptLock.
 *   Tanpa lock, dua request bersamaan membaca angka yang sama → nomor dokumen DUPLIKAT.
 *
 * FIX #3.6 (DDS LETTER_STRUCTURE.md §1) — Counter per-entitas:
 *   Sheet numbering_sequences pakai composite key (document_code, prefix).
 *   Artinya RIFIM/MIG/LAILAN masing-masing punya counter sendiri per jenis dokumen,
 *   dan reset per periode (tahun + bulan). Sebelumnya counter cuma per document_code,
 *   sehingga MIG bisa dapat nomor urut yang "meloncat" karena RIFIM sudah pakai.
 *
 *   Schema kolom sheet numbering_sequences (setelah migrasi):
 *     A: document_code    (SURAT / INV / dst)
 *     B: prefix           (RIFIM / MIG / LAILAN)
 *     C: year
 *     D: month
 *     E: month_roman
 *     F: last_sequence
 *
 *   Backward compat: kalau sheet MASIH pakai skema lama (5 kolom tanpa prefix),
 *   engine akan throw error yang minta migrasi via
 *   migrateNumberingSequencesToPerEntity() (lihat setupDatabase.js).
 */

var MONTHS_ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

/**
 * Baca header sheet numbering_sequences dan cari indeks kolom yang diperlukan.
 * Throw error deskriptif kalau kolom prefix belum ada (belum migrasi).
 * @private
 */
function _numberingReadHeaders(sheet) {
  var lastCol  = sheet.getLastColumn();
  var headers  = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
                      .map(function(h) { return String(h).trim(); });
  var idx = {
    code:   headers.indexOf('document_code'),
    prefix: headers.indexOf('prefix'),
    year:   headers.indexOf('year'),
    month:  headers.indexOf('month'),
    roman:  headers.indexOf('month_roman'),
    seq:    headers.indexOf('last_sequence'),
  };
  if (idx.code < 0 || idx.year < 0 || idx.month < 0 || idx.roman < 0 || idx.seq < 0) {
    throw new Error('Sheet numbering_sequences: kolom wajib tidak lengkap. Header: ' + headers.join(', '));
  }
  if (idx.prefix < 0) {
    throw new Error(
      'Sheet numbering_sequences belum di-migrasi ke skema per-entitas. ' +
      'Jalankan migrateNumberingSequencesToPerEntity() SEKALI dari GAS Editor.'
    );
  }
  return { headers: headers, idx: idx, ncol: lastCol };
}

/**
 * Generate nomor dokumen berikutnya untuk kombinasi (docCode, prefix).
 * Dilindungi ScriptLock — atomic read-increment-write.
 * Kalau row (docCode, prefix) belum ada, auto-append di dalam lock yang sama.
 *
 * @param {string} documentCode  - INV / SURAT / PKWT / SP1 / dll
 * @param {string} [prefix]      - 'RIFIM' | 'MIG' | 'LAILAN' (default RIFIM)
 * @returns {string}             - mis. "012/MIG/INV/VII/2026"
 */
function generateDocumentNumber(documentCode, prefix) {
  prefix = String(prefix || 'RIFIM').toUpperCase();

  return _gasWithLock(function() {
    var sheet = _getDB().getSheetByName('numbering_sequences');
    if (!sheet) throw new Error('Sheet numbering_sequences tidak ditemukan.');

    var meta  = _numberingReadHeaders(sheet);
    var idx   = meta.idx;

    var now   = new Date();
    var year  = now.getFullYear();
    var month = now.getMonth() + 1;
    var roman = MONTHS_ROMAN[now.getMonth()];
    var data  = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idx.code]).trim()   !== documentCode) continue;
      if (String(data[i][idx.prefix]).trim() !== prefix)       continue;

      var rowYear  = Number(data[i][idx.year]);
      var rowMonth = Number(data[i][idx.month]);
      var isNewPeriod = (rowYear !== year || rowMonth !== month);
      var lastSeq     = isNewPeriod ? 0 : Number(data[i][idx.seq]);
      var nextSeq     = lastSeq + 1;

      sheet.getRange(i + 1, idx.year  + 1).setValue(year);
      sheet.getRange(i + 1, idx.month + 1).setValue(month);
      sheet.getRange(i + 1, idx.roman + 1).setValue(roman);
      sheet.getRange(i + 1, idx.seq   + 1).setValue(nextSeq);

      var seq = String(nextSeq).padStart(3, '0');
      return seq + '/' + prefix + '/' + documentCode + '/' + roman + '/' + year;
    }

    // Row (docCode, prefix) belum ada — auto-append (masih dalam lock).
    var newRow = new Array(meta.ncol).fill('');
    newRow[idx.code]   = documentCode;
    newRow[idx.prefix] = prefix;
    newRow[idx.year]   = year;
    newRow[idx.month]  = month;
    newRow[idx.roman]  = roman;
    newRow[idx.seq]    = 1;
    sheet.appendRow(newRow);

    return '001/' + prefix + '/' + documentCode + '/' + roman + '/' + year;
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
  prefix = String(prefix || 'RIFIM').toUpperCase();

  var sheet = _getDB().getSheetByName('numbering_sequences');
  if (!sheet) throw new Error('Sheet numbering_sequences tidak ditemukan.');

  var meta  = _numberingReadHeaders(sheet);
  var idx   = meta.idx;

  var now   = new Date();
  var year  = now.getFullYear();
  var month = now.getMonth() + 1;
  var roman = MONTHS_ROMAN[now.getMonth()];
  var data  = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx.code]).trim()   !== documentCode) continue;
    if (String(data[i][idx.prefix]).trim() !== prefix)       continue;

    var rowYear  = Number(data[i][idx.year]);
    var rowMonth = Number(data[i][idx.month]);
    var isNew    = (rowYear !== year || rowMonth !== month);
    var nextSeq  = isNew ? 1 : Number(data[i][idx.seq]) + 1;
    return String(nextSeq).padStart(3, '0') + '/' + prefix + '/' + documentCode + '/' + roman + '/' + year;
  }

  // Belum ada row untuk (docCode, prefix) — nomor pertama = 001
  return '001/' + prefix + '/' + documentCode + '/' + roman + '/' + year;
}

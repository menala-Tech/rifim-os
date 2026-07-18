/**
 * RIFIM OS — Database Layer
 * Abstraksi akses Google Sheets.
 * Dirancang agar mudah dimigrasi ke Supabase di Phase 2.
 *
 * Kolom sheet `documents` (17 kolom, urut):
 * id | document_number | document_type | document_code | document_date |
 * recipient_name | recipient_address | subject | attachment | body_summary |
 * status | gdoc_url | pdf_url | qr_url | created_by | created_at | updated_at
 *
 * PERUBAHAN (refactor konsistensi):
 *   - saveDocumentRecord()   → attachment sanitized ke integer / '-'
 *                            → wrapped _gasWithLock() (fix #4)
 *   - updateDocumentStatus() → wrapped _gasWithLock() (fix #5)
 *   - getDocumentList()      → Date object di created_at/updated_at selalu → ISO UTC
 */

// ── Indeks kolom sheet documents (1-based) ──────────────────────────
var _DOC_COL = {
  ID: 1, DOC_NUMBER: 2, DOC_TYPE: 3, DOC_CODE: 4, DOC_DATE: 5,
  RECIPIENT_NAME: 6, RECIPIENT_ADDR: 7, SUBJECT: 8, ATTACHMENT: 9,
  BODY_SUMMARY: 10, STATUS: 11, GDOC_URL: 12, PDF_URL: 13, QR_URL: 14,
  CREATED_BY: 15, CREATED_AT: 16, UPDATED_AT: 17,
};

/**
 * Sanitasi nilai attachment:
 *   - Angka bulat (atau string angka)  → integer
 *   - Kosong / null / undefined        → 0
 *   - String bebas '-', 'N/A', dll.    → 0  (tidak simpan teks di kolom angka)
 * @private
 */
function _docSanitizeAttachment(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '' || raw === '-') return 0;
  var n = Number(raw);
  if (isNaN(n)) return 0;
  return Math.round(n); // paksa integer
}

/**
 * Simpan record dokumen ke sheet documents.
 * Dilindungi ScriptLock — mencegah dua Smart Office request menulis bersamaan.
 * @param {object} record
 */
function saveDocumentRecord(record) {
  // FIX #3 — sanitasi attachment ke integer sebelum simpan
  var attachment = _docSanitizeAttachment(record.attachment);

  // FIX #1 — pastikan timestamp pakai ISO UTC
  var createdAt = record.created_at
    ? (record.created_at instanceof Date ? record.created_at.toISOString() : String(record.created_at))
    : _gasNow();
  var updatedAt = record.updated_at
    ? (record.updated_at instanceof Date ? record.updated_at.toISOString() : String(record.updated_at))
    : createdAt;

  // FIX #4 — proteksi race condition dengan ScriptLock
  _gasWithLock(function() {
    var sheet = _getDB().getSheetByName('documents');
    if (!sheet) throw new Error('Sheet documents tidak ditemukan.');

    sheet.appendRow([
      record.id,
      record.document_number,
      record.document_type,
      record.document_code    || '',
      record.document_date    || '',
      record.recipient_name   || '',
      record.recipient_address || '',
      record.subject,
      attachment,              // ← selalu integer, bukan teks bebas
      record.body_summary     || '',
      record.status           || 'FINAL',
      record.gdoc_url         || '',
      record.pdf_url          || '',
      record.qr_url           || '',
      record.created_by       || '',
      createdAt,               // ← ISO UTC
      updatedAt,               // ← ISO UTC
      record.pipeline_type    || 'gdocs',   // 'html' | 'gdocs'
    ]);
  });
}

/**
 * Ambil semua dokumen.
 * @param {object} filters - { documentCode, status }
 * @returns {Array}
 */
function getDocuments(filters) {
  var sheet = _getDB().getSheetByName('documents');
  if (!sheet) throw new Error('Sheet documents tidak ditemukan.');

  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var records = [];

  for (var i = 1; i < data.length; i++) {
    var row    = data[i];
    var record = {};
    headers.forEach(function(h, idx) { record[h] = row[idx]; });
    records.push(record);
  }

  if (filters) {
    if (filters.documentCode) {
      records = records.filter(function(r) { return r.document_code === filters.documentCode; });
    }
    if (filters.status) {
      records = records.filter(function(r) { return r.status === filters.status; });
    }
  }

  return records;
}

/**
 * Ambil daftar dokumen dengan filter & pagination.
 * @param {object} options - { status, search, page, limit }
 * @returns {object} { docs, total, page, limit, pages, stats }
 */
function getDocumentList(options) {
  var sheet = _getDB().getSheetByName('documents');
  if (!sheet) return { docs: [], total: 0, page: 1, limit: 100, pages: 0, stats: {} };

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { docs: [], total: 0, page: 1, limit: 100, pages: 0, stats: {} };

  var rows = data.slice(1).filter(function(r) { return r[0]; }).reverse();

  // FIX #1 — semua Date object dari Sheets dipaksa ke ISO UTC string
  var toIso = function(v) {
    if (v instanceof Date) return v.toISOString();
    if (v && String(v).trim()) return String(v);
    return '';
  };

  var allDocs = rows.map(function(r) {
    var docDate = r[4] instanceof Date
      ? Utilities.formatDate(r[4], 'Asia/Jakarta', 'yyyy-MM-dd')
      : (r[4] ? String(r[4]) : '');

    return {
      id:               r[_DOC_COL.ID - 1]               || '',
      document_number:  r[_DOC_COL.DOC_NUMBER - 1]       || '',
      document_type:    r[_DOC_COL.DOC_TYPE - 1]         || '',
      document_code:    r[_DOC_COL.DOC_CODE - 1]         || '',
      document_date:    docDate,
      recipient_name:   r[_DOC_COL.RECIPIENT_NAME - 1]   || '',
      recipient_address:r[_DOC_COL.RECIPIENT_ADDR - 1]   || '',
      subject:          r[_DOC_COL.SUBJECT - 1]          || '',
      attachment:       r[_DOC_COL.ATTACHMENT - 1]       || 0,
      body_summary:     r[_DOC_COL.BODY_SUMMARY - 1]     || '',
      status:           r[_DOC_COL.STATUS - 1]           || '',
      gdoc_url:         r[_DOC_COL.GDOC_URL - 1]         || '',
      pdf_url:          r[_DOC_COL.PDF_URL - 1]          || '',
      qr_url:           r[_DOC_COL.QR_URL - 1]           || '',
      created_by:       r[_DOC_COL.CREATED_BY - 1]       || '',
      created_at:       toIso(r[_DOC_COL.CREATED_AT - 1]),  // ← selalu ISO UTC
      updated_at:       toIso(r[_DOC_COL.UPDATED_AT - 1]),  // ← selalu ISO UTC
    };
  });

  var now       = new Date();
  var thisMonth = now.getMonth();
  var thisYear  = now.getFullYear();
  var stats = {
    total:     allDocs.length,
    bulan_ini: allDocs.filter(function(d) {
      if (!d.created_at) return false;
      var dt = new Date(d.created_at);
      return dt.getMonth() === thisMonth && dt.getFullYear() === thisYear;
    }).length,
    draft:    allDocs.filter(function(d) { return d.status === 'DRAFT';    }).length,
    final:    allDocs.filter(function(d) { return d.status === 'FINAL';    }).length,
    sent:     allDocs.filter(function(d) { return d.status === 'SENT';     }).length,
    archived: allDocs.filter(function(d) { return d.status === 'ARCHIVED'; }).length,
  };

  var status = options && options.status ? options.status : 'ALL';
  var docs   = status !== 'ALL'
    ? allDocs.filter(function(d) { return d.status === status; })
    : allDocs;

  var search = options && options.search ? options.search.toLowerCase() : '';
  if (search) {
    docs = docs.filter(function(d) {
      return (d.document_number || '').toLowerCase().indexOf(search) > -1 ||
             (d.subject         || '').toLowerCase().indexOf(search) > -1 ||
             (d.recipient_name  || '').toLowerCase().indexOf(search) > -1 ||
             (d.document_type   || '').toLowerCase().indexOf(search) > -1;
    });
  }

  var total = docs.length;
  var limit = options && options.limit ? Math.min(parseInt(options.limit) || 100, 200) : 100;
  var page  = options && options.page  ? Math.max(parseInt(options.page)  || 1,   1)   : 1;
  var start = (page - 1) * limit;

  return {
    docs:  docs.slice(start, start + limit),
    total: total,
    page:  page,
    limit: limit,
    pages: Math.ceil(total / limit) || 0,
    stats: stats,
  };
}

/**
 * Update status dokumen berdasarkan document_number.
 * Dilindungi ScriptLock — read-then-write adalah operasi non-atomik.
 * @param {string} documentNumber
 * @param {string} newStatus  DRAFT | FINAL | SENT | ARCHIVED
 */
function updateDocumentStatus(documentNumber, newStatus) {
  // FIX #5 — proteksi race condition dengan ScriptLock
  return _gasWithLock(function() {
    var sheet = _getDB().getSheetByName('documents');
    if (!sheet) return false;

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][_DOC_COL.DOC_NUMBER - 1] === documentNumber) {
        sheet.getRange(i + 1, _DOC_COL.STATUS).setValue(newStatus);
        sheet.getRange(i + 1, _DOC_COL.UPDATED_AT).setValue(_gasNow()); // ← ISO UTC
        return true;
      }
    }
    return false;
  });
}

/**
 * Update status dokumen berdasarkan document ID (UUID atau DOC-xxx).
 * Digunakan oleh Smart Office UI untuk archive / workflow transition.
 * @param {string} docId
 * @param {string} newStatus  DRAFT | FINAL | SENT | ARCHIVED
 * @returns {boolean}
 */
function updateDocumentStatusById(docId, newStatus) {
  return _gasWithLock(function() {
    var sheet = _getDB().getSheetByName('documents');
    if (!sheet) return false;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][_DOC_COL.ID - 1]) === String(docId)) {
        sheet.getRange(i + 1, _DOC_COL.STATUS).setValue(newStatus);
        sheet.getRange(i + 1, _DOC_COL.UPDATED_AT).setValue(_gasNow());
        return true;
      }
    }
    return false;
  });
}

/**
 * Ambil satu dokumen berdasarkan ID.
 * @param {string} docId
 * @returns {object|null}
 */
function getDocumentById(docId) {
  var sheet = _getDB().getSheetByName('documents');
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;
  var toIso = function(v) {
    if (v instanceof Date) return v.toISOString();
    return v ? String(v) : '';
  };
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (String(r[_DOC_COL.ID - 1]) !== String(docId)) continue;
    var docDate = r[4] instanceof Date
      ? Utilities.formatDate(r[4], 'Asia/Jakarta', 'yyyy-MM-dd')
      : (r[4] ? String(r[4]) : '');
    return {
      id:               r[_DOC_COL.ID - 1]              || '',
      document_number:  r[_DOC_COL.DOC_NUMBER - 1]      || '',
      document_type:    r[_DOC_COL.DOC_TYPE - 1]        || '',
      document_code:    r[_DOC_COL.DOC_CODE - 1]        || '',
      document_date:    docDate,
      recipient_name:   r[_DOC_COL.RECIPIENT_NAME - 1]  || '',
      recipient_address:r[_DOC_COL.RECIPIENT_ADDR - 1]  || '',
      subject:          r[_DOC_COL.SUBJECT - 1]         || '',
      attachment:       r[_DOC_COL.ATTACHMENT - 1]      || 0,
      body_summary:     r[_DOC_COL.BODY_SUMMARY - 1]    || '',
      status:           r[_DOC_COL.STATUS - 1]          || '',
      gdoc_url:         r[_DOC_COL.GDOC_URL - 1]        || '',
      pdf_url:          r[_DOC_COL.PDF_URL - 1]         || '',
      qr_url:           r[_DOC_COL.QR_URL - 1]          || '',
      created_by:       r[_DOC_COL.CREATED_BY - 1]      || '',
      created_at:       toIso(r[_DOC_COL.CREATED_AT - 1]),
      updated_at:       toIso(r[_DOC_COL.UPDATED_AT - 1]),
    };
  }
  return null;
}

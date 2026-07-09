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

  var allDocs = rows.map(function(r) {
    return {
      id:               r[0]  || '',
      document_number:  r[1]  || '',
      document_type:    r[2]  || '',
      document_code:    r[3]  || '',
      document_date:    r[4] instanceof Date
                          ? Utilities.formatDate(r[4], 'Asia/Jakarta', 'yyyy-MM-dd')
                          : (r[4] ? String(r[4]) : ''),
      recipient_name:   r[5]  || '',
      recipient_address:r[6]  || '',
      subject:          r[7]  || '',
      attachment:       r[8]  || '',
      body_summary:     r[9]  || '',
      status:           r[10] || '',
      gdoc_url:         r[11] || '',
      pdf_url:          r[12] || '',
      qr_url:           r[13] || '',
      created_by:       r[14] || '',
      created_at:       r[15] instanceof Date ? r[15].toISOString() : (r[15] ? String(r[15]) : ''),
      updated_at:       r[16] instanceof Date ? r[16].toISOString() : (r[16] ? String(r[16]) : ''),
    };
  });

  var now = new Date();
  var thisMonth = now.getMonth();
  var thisYear  = now.getFullYear();
  var stats = {
    total:      allDocs.length,
    bulan_ini:  allDocs.filter(function(d) {
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
  var docs = status !== 'ALL'
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

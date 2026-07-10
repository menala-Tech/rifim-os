/**
 * RIFIM OS — HRIS Data Layer
 * Abstraksi akses data HRIS via Supabase REST API.
 *
 * Setup (jalankan sekali di Apps Script):
 *   setupHrisConfig()
 *
 * Semua fungsi public di sini dipanggil dari webApp.js.
 */

var SUPABASE_URL = 'https://vlievtojpmrbsmzlqswl.supabase.co';

/**
 * Jalankan sekali untuk set Supabase Service Role Key di Script Properties.
 * Ganti 'PASTE_SERVICE_ROLE_KEY_HERE' dengan key dari Supabase Dashboard → Settings → API.
 */
function setupHrisConfig() {
  // URL HARUS format: https://[project-id].supabase.co
  // BUKAN URL dashboard: https://supabase.com/dashboard/project/...
  var correctUrl = 'https://vlievtojpmrbsmzlqswl.supabase.co';
  PropertiesService.getScriptProperties().setProperties({
    'SUPABASE_URL':         correctUrl,
    'SUPABASE_SERVICE_KEY': 'PASTE_SERVICE_ROLE_KEY_HERE',
  });
  Logger.log('URL tersimpan: ' + correctUrl);
  Logger.log('Ganti SUPABASE_SERVICE_KEY dengan service_role key asli, lalu run lagi!');
}

function verifyHrisConfig() {
  var props = PropertiesService.getScriptProperties();
  var url   = props.getProperty('SUPABASE_URL') || '(tidak ada)';
  var key   = props.getProperty('SUPABASE_SERVICE_KEY') || '(tidak ada)';
  Logger.log('SUPABASE_URL  : ' + url);
  Logger.log('SERVICE_KEY   : ' + (key.length > 10 ? key.substring(0,12) + '...' : key));
  Logger.log('URL valid?    : ' + (url === 'https://vlievtojpmrbsmzlqswl.supabase.co' ? 'YA' : 'SALAH - harus https://vlievtojpmrbsmzlqswl.supabase.co'));
}

// ─── EMPLOYEES ────────────────────────────────────────────────────

/**
 * Ambil daftar karyawan.
 * @param {{ company_code?, status?, search?, page?, limit? }} opts
 */
function hrisGetEmployees(opts) {
  opts = opts || {};
  var params = [];
  if (opts.company_code && opts.company_code !== 'ALL') {
    params.push('company_code=eq.' + opts.company_code);
  }
  if (opts.status && opts.status !== 'ALL') {
    params.push('status=eq.' + opts.status);
  }
  params.push('order=full_name.asc');
  params.push('limit=' + (opts.limit || 100));
  params.push('offset=' + (((opts.page || 1) - 1) * (opts.limit || 100)));

  var url  = _sbUrl('employees', params);
  var rows = _sbGet(url);

  if (opts.search) {
    var q = opts.search.toLowerCase();
    rows  = rows.filter(function(r) {
      return (r.full_name    || '').toLowerCase().includes(q) ||
             (r.employee_id  || '').toLowerCase().includes(q) ||
             (r.position     || '').toLowerCase().includes(q);
    });
  }
  return rows;
}

/**
 * Ambil satu karyawan berdasarkan employee_id.
 */
function hrisGetEmployee(employeeId) {
  var url  = _sbUrl('employees', ['employee_id=eq.' + encodeURIComponent(employeeId), 'limit=1']);
  var rows = _sbGet(url);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Buat karyawan baru.
 * @param {object} data
 */
function hrisAddEmployee(data) {
  _validateEmployee(data);
  data.created_at = new Date().toISOString();
  data.updated_at = data.created_at;
  _sbPost('employees', data);
  return { success: true, employee_id: data.employee_id };
}

/**
 * Update data karyawan.
 */
function hrisUpdateEmployee(employeeId, data) {
  data.updated_at = new Date().toISOString();
  delete data.id;
  delete data.created_at;
  _sbPatch('employees', 'employee_id=eq.' + encodeURIComponent(employeeId), data);
  return { success: true };
}

// ─── CONTRACTS ────────────────────────────────────────────────────

/**
 * Ambil kontrak karyawan.
 * @param {{ employee_id?, status? }} opts
 */
function hrisGetContracts(opts) {
  opts = opts || {};
  var params = ['order=created_at.desc', 'limit=200'];
  if (opts.employee_id) params.push('employee_id=eq.' + encodeURIComponent(opts.employee_id));
  if (opts.status)      params.push('status=eq.' + opts.status);
  return _sbGet(_sbUrl('employee_contracts', params));
}

/**
 * Ambil kontrak yang akan berakhir dalam N hari.
 */
function hrisGetExpiringContracts(days) {
  var today  = new Date();
  var future = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
  var todayStr  = today.toISOString().split('T')[0];
  var futureStr = future.toISOString().split('T')[0];
  var params = [
    'status=eq.AKTIF',
    'end_date=gte.' + todayStr,
    'end_date=lte.' + futureStr,
    'order=end_date.asc',
  ];
  return _sbGet(_sbUrl('employee_contracts', params));
}

/**
 * Buat kontrak baru (data dokumen bisa dari Document Engine).
 */
function hrisAddContract(data) {
  if (!data.employee_id) throw new Error('employee_id diperlukan.');
  if (!data.contract_type) throw new Error('contract_type diperlukan.');
  if (!data.start_date) throw new Error('start_date diperlukan.');
  data.created_at = new Date().toISOString();
  data.updated_at = data.created_at;
  _sbPost('employee_contracts', data);
  return { success: true };
}

// ─── ATTENDANCE ───────────────────────────────────────────────────

/**
 * Ambil absensi.
 * @param {{ employee_id?, date_from?, date_to? }} opts
 */
function hrisGetAttendance(opts) {
  opts = opts || {};
  var params = ['order=attendance_date.desc', 'limit=500'];
  if (opts.employee_id) params.push('employee_id=eq.' + encodeURIComponent(opts.employee_id));
  if (opts.date_from)   params.push('attendance_date=gte.' + opts.date_from);
  if (opts.date_to)     params.push('attendance_date=lte.' + opts.date_to);
  return _sbGet(_sbUrl('attendance', params));
}

/**
 * Catat absensi (upsert berdasarkan employee_id + attendance_date).
 */
function hrisAddAttendance(data) {
  if (!data.employee_id)     throw new Error('employee_id diperlukan.');
  if (!data.attendance_date) throw new Error('attendance_date diperlukan.');
  data.created_at = new Date().toISOString();

  var cfg     = _getSupabaseConfig();
  var url     = cfg.url + '/rest/v1/attendance?on_conflict=employee_id,attendance_date';
  var options = {
    method:             'POST',
    headers:            _sbHeaders(cfg.key, 'resolution=merge-duplicates'),
    payload:            JSON.stringify(data),
    muteHttpExceptions: true,
  };
  var res = UrlFetchApp.fetch(url, options);
  _checkResponse(res, 'Gagal catat absensi');
  return { success: true };
}

// ─── LEAVE ────────────────────────────────────────────────────────

/**
 * Ambil pengajuan cuti.
 */
function hrisGetLeaveRequests(opts) {
  opts = opts || {};
  var params = ['order=created_at.desc', 'limit=200'];
  if (opts.employee_id) params.push('employee_id=eq.' + encodeURIComponent(opts.employee_id));
  if (opts.status)      params.push('status=eq.' + opts.status);
  return _sbGet(_sbUrl('leave_requests', params));
}

/**
 * Ajukan cuti baru.
 */
function hrisApplyLeave(data) {
  if (!data.employee_id) throw new Error('employee_id diperlukan.');
  if (!data.leave_type)  throw new Error('leave_type diperlukan.');
  if (!data.start_date)  throw new Error('start_date diperlukan.');
  if (!data.end_date)    throw new Error('end_date diperlukan.');
  data.status     = 'PENDING';
  data.created_at = new Date().toISOString();
  data.updated_at = data.created_at;
  data.total_days = data.total_days || _countWorkdays(data.start_date, data.end_date);
  _sbPost('leave_requests', data);
  return { success: true };
}

/**
 * Setujui atau tolak cuti.
 */
function hrisApproveLeave(leaveId, status, approvedBy, rejectReason) {
  if (['DISETUJUI','DITOLAK'].indexOf(status) === -1) throw new Error('Status tidak valid.');
  var patch = {
    status:      status,
    approved_by: approvedBy,
    approved_at: new Date().toISOString(),
    updated_at:  new Date().toISOString(),
  };
  if (rejectReason) patch.reason = rejectReason;
  _sbPatch('leave_requests', 'id=eq.' + leaveId, patch);

  // Update leave_balance jika disetujui
  if (status === 'DISETUJUI') {
    _deductLeaveBalance(leaveId);
  }
  return { success: true };
}

/**
 * Ambil saldo cuti karyawan.
 */
function hrisGetLeaveBalance(employeeId, year) {
  year = year || new Date().getFullYear();
  var params = [
    'employee_id=eq.' + encodeURIComponent(employeeId),
    'year=eq.' + year,
    'limit=1',
  ];
  var rows = _sbGet(_sbUrl('leave_balances', params));
  if (rows.length > 0) return rows[0];

  // Auto-create balance jika belum ada
  var balance = { employee_id: employeeId, year: year, total_days: 12, used_days: 0 };
  _sbPost('leave_balances', balance);
  return Object.assign({}, balance, { remaining_days: 12 });
}

// ─── PAYROLL ─────────────────────────────────────────────────────

/**
 * Ambil data payroll.
 */
function hrisGetPayroll(opts) {
  opts = opts || {};
  var params = ['order=created_at.desc', 'limit=200'];
  if (opts.employee_id)   params.push('employee_id=eq.' + encodeURIComponent(opts.employee_id));
  if (opts.period_month)  params.push('period_month=eq.' + opts.period_month);
  if (opts.period_year)   params.push('period_year=eq.' + opts.period_year);
  return _sbGet(_sbUrl('payroll', params));
}

/**
 * Buat slip gaji.
 */
function hrisAddPayroll(data) {
  if (!data.employee_id)  throw new Error('employee_id diperlukan.');
  if (!data.period_month) throw new Error('period_month diperlukan.');
  if (!data.period_year)  throw new Error('period_year diperlukan.');
  data.status     = 'DRAFT';
  data.created_at = new Date().toISOString();
  data.updated_at = data.created_at;
  _sbPost('payroll', data);
  return { success: true };
}

/**
 * Finalisasi slip gaji (status DRAFT → FINAL).
 */
function hrisFinalizePayroll(payrollId, gdocUrl, pdfUrl, documentNumber) {
  _sbPatch('payroll', 'id=eq.' + payrollId, {
    status:          'FINAL',
    gdoc_url:        gdocUrl        || '',
    pdf_url:         pdfUrl         || '',
    document_number: documentNumber || '',
    updated_at:      new Date().toISOString(),
  });
  return { success: true };
}

// ─── Supabase Helpers ─────────────────────────────────────────────

function _getSupabaseConfig() {
  var props = PropertiesService.getScriptProperties();
  var url   = props.getProperty('SUPABASE_URL')         || SUPABASE_URL;
  var key   = props.getProperty('SUPABASE_SERVICE_KEY') || '';
  if (!key) throw new Error('Supabase Service Key belum dikonfigurasi. Jalankan setupHrisConfig().');
  return { url: url, key: key };
}

function _sbUrl(table, params) {
  var cfg = _getSupabaseConfig();
  return cfg.url + '/rest/v1/' + table + (params.length ? '?' + params.join('&') : '');
}

function _sbHeaders(key, prefer) {
  var h = {
    'apikey':        key,
    'Authorization': 'Bearer ' + key,
    'Content-Type':  'application/json',
  };
  if (prefer) h['Prefer'] = prefer;
  return h;
}

function _sbGet(url) {
  var cfg = _getSupabaseConfig();
  var res = UrlFetchApp.fetch(url, {
    method:             'GET',
    headers:            _sbHeaders(cfg.key),
    muteHttpExceptions: true,
  });
  _checkResponse(res, 'GET ' + url);
  return JSON.parse(res.getContentText());
}

function _sbPost(table, data) {
  var cfg = _getSupabaseConfig();
  var url = cfg.url + '/rest/v1/' + table;
  var res = UrlFetchApp.fetch(url, {
    method:             'POST',
    headers:            _sbHeaders(cfg.key, 'return=representation'),
    payload:            JSON.stringify(data),
    muteHttpExceptions: true,
  });
  _checkResponse(res, 'POST ' + table);
}

function _sbPatch(table, filter, data) {
  var cfg = _getSupabaseConfig();
  var url = cfg.url + '/rest/v1/' + table + '?' + filter;
  var res = UrlFetchApp.fetch(url, {
    method:             'PATCH',
    headers:            _sbHeaders(cfg.key),
    payload:            JSON.stringify(data),
    muteHttpExceptions: true,
  });
  _checkResponse(res, 'PATCH ' + table);
}

function _checkResponse(res, context) {
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error(context + ' — HTTP ' + code + ': ' + res.getContentText().substring(0, 200));
  }
}

function _validateEmployee(data) {
  if (!data.employee_id) throw new Error('employee_id diperlukan.');
  if (!data.full_name)   throw new Error('full_name diperlukan.');
  if (!data.company_code) throw new Error('company_code diperlukan.');
  if (!data.join_date)   throw new Error('join_date diperlukan.');
}

function _countWorkdays(startStr, endStr) {
  var start = new Date(startStr);
  var end   = new Date(endStr);
  var count = 0;
  var d     = new Date(start);
  while (d <= end) {
    var day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function _deductLeaveBalance(leaveId) {
  try {
    var cfg     = _getSupabaseConfig();
    var leaveUrl = cfg.url + '/rest/v1/leave_requests?id=eq.' + leaveId + '&select=employee_id,total_days';
    var leaveRes = UrlFetchApp.fetch(leaveUrl, { method: 'GET', headers: _sbHeaders(cfg.key), muteHttpExceptions: true });
    var leaves   = JSON.parse(leaveRes.getContentText());
    if (!leaves.length) return;
    var leave = leaves[0];
    var year  = new Date().getFullYear();
    var bal   = hrisGetLeaveBalance(leave.employee_id, year);
    _sbPatch('leave_balances',
      'employee_id=eq.' + encodeURIComponent(leave.employee_id) + '&year=eq.' + year,
      { used_days: (bal.used_days || 0) + (leave.total_days || 0), updated_at: new Date().toISOString() }
    );
  } catch (e) {
    console.warn('Gagal kurangi saldo cuti:', e.message);
  }
}

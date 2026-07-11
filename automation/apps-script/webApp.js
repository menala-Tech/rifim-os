/**
 * RIFIM OS — Web App Entry Point
 * Deploy sebagai GAS Web App agar dashboard Vercel bisa call engine.
 *
 * Cara deploy:
 * 1. Apps Script → Deploy → New Deployment → Web App
 * 2. Execute as: Me
 * 3. Who has access: Anyone
 * 4. Copy Web App URL → paste ke GAS_WEB_APP_URL di dashboard index.html
 */

/**
 * Handle POST dari dashboard.
 * Content-Type: text/plain dipakai di frontend untuk skip CORS preflight.
 *
 * Body JSON:
 * {
 *   documentType: 'INV',
 *   subject:      'Tagihan Jasa Promosi',
 *   attachment:   '-',
 *   documentDate: '2026-07-09',
 *   directorName: 'BOBBY RAHMAN M.B',
 *   directorTitle: 'Direktur Utama',
 *   extra: { client_name: 'PT. Maxim', items: '...', ... }
 * }
 */
function doPost(e) {
  try {
    const input = JSON.parse(e.postData.contents);

    // HRIS actions diidentifikasi dengan field hrisAction
    if (input.hrisAction) {
      return _json(_handleHrisPost(input));
    }

    // Log activity dari Portal / Smart Office (fire-and-forget dari frontend)
    if (input.action === 'log_activity') {
      const by = input.performed_by || {};
      logActivity(input.module, input.action_type, input.target_id || '',
        input.target_name || '', by.name || '', by.email || '', input.detail || '');
      return _json({ success: true });
    }

    // Default: Smart Office document generation
    const result = generateDocument(input);
    if (result && result.success) {
      const by = input.performed_by || {};
      logActivity('Smart Office', 'BUAT DOKUMEN',
        result.documentNumber || '', input.subject || '',
        by.name || '', by.email || '',
        'Tipe: ' + (input.documentType || '') + ' · ' + (input.company_code || ''));
      notifDocumentCreated({
        documentNumber: result.documentNumber || '',
        documentType:   DOCUMENT_TYPES[input.documentType] ? DOCUMENT_TYPES[input.documentType].label : (input.documentType || ''),
        subject:        input.subject || '',
        gdocUrl:        result.gdocUrl || '',
        pdfUrl:         result.pdfUrl  || '',
        createdBy:      by.name || by.email || '',
      });
    }
    return _json(result);

  } catch (err) {
    return _json({ success: false, message: 'Server error: ' + err.message });
  }
}

/**
 * Router HRIS POST actions.
 * @private
 */
function _handleHrisPost(input) {
  var by = input.performed_by || {};
  switch (input.hrisAction) {
    case 'add_employee': {
      var addResult = _syncAfterHrisWrite(hrisAddEmployee(input.data));
      logActivity('HRIS', 'TAMBAH',
        input.data.employee_id, input.data.full_name,
        by.name, by.email,
        (input.data.employment_type || '') + ' · ' + (input.data.position || '') + ' · ' + (input.data.branch || ''));
      return addResult;
    }
    case 'update_employee': {
      var updAction = (input.data && input.data.status === 'RESIGN') ? 'RESIGN'
                    : (input.data && input.data.status === 'PHK')    ? 'PHK' : 'EDIT';
      var updResult = _syncAfterHrisWrite(hrisUpdateEmployee(input.employee_id, input.data));
      var updDetail = updAction !== 'EDIT'
        ? 'status → ' + input.data.status
        : Object.keys(input.data || {}).filter(function(k) { return k !== 'updated_at'; }).join(', ') + ' diperbarui';
      logActivity('HRIS', updAction,
        input.employee_id, input.target_name || input.employee_id,
        by.name, by.email, updDetail);
      return updResult;
    }
    case 'add_contract':     return hrisAddContract(input.data);
    case 'add_attendance':   return hrisAddAttendance(input.data);
    case 'apply_leave':      return hrisApplyLeave(input.data);
    case 'approve_leave':
      return hrisApproveLeave(input.leave_id, input.status, input.approved_by, input.reject_reason);
    case 'add_payroll':      return hrisAddPayroll(input.data);
    case 'finalize_payroll':
      return hrisFinalizePayroll(input.payroll_id, input.gdoc_url, input.pdf_url, input.document_number);
    case 'auth_verify':      return authVerifyUser(input.email);
    default:
      return { success: false, message: 'hrisAction tidak dikenal: ' + input.hrisAction };
  }
}

/**
 * Panggil sync ke spreadsheet setelah write ke Supabase.
 * Jika sync gagal, operasi utama tetap berhasil.
 * @private
 */
function _syncAfterHrisWrite(result) {
  try { syncHrisEmployeesToSheet(); } catch (e) { console.warn('Sync sheet gagal:', e.message); }
  return result;
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle GET — health check & info.
 */
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  if (action === 'staff_list') {
    try {
      var rawList = hrisGetEmployees({ status: 'AKTIF', limit: 200 });
      var staff = rawList.map(function(r) {
        return {
          id:           r.employee_id   || '',
          nama:         r.full_name     || '',
          jabatan:      r.position      || '',
          department:   r.department    || '',
          cabang:       r.branch        || '',
          email:        r.email         || '',
          company_code: r.company_code  || '',
          status:       r.status        || '',
          salary_base:  r.salary_base   || '',
          join_date:    r.join_date     || '',
        };
      });
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, staff: staff }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, message: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'companies') {
    try {
      var list = getCompanies().map(function(c) {
        return { code: c.code, name: c.name, director_name: c.director_name, director_title: c.director_title, doc_prefix: c.doc_prefix };
      });
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, companies: list }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, message: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'peek') {
    const code   = e.parameter.code   || 'SURAT';
    const prefix = e.parameter.prefix || 'RIFIM';
    try {
      const nextNum = peekNextDocumentNumber(code, prefix);
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, nextNumber: nextNum }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, message: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'auth') {
    try {
      var email      = ((e.parameter.email || '').toLowerCase()).trim();
      var source     = e.parameter.source || 'Portal';
      var authResult = authVerifyUser(email);
      if (authResult.success) {
        logActivity(source, 'LOGIN', '', '',
          authResult.user.full_name || '', email,
          'Role: ' + (authResult.user.role || ''));
      }
      return _json(authResult);
    } catch (err) {
      return _json({ success: false, message: err.message });
    }
  }

  // ─── HRIS GET Actions ─────────────────────────────────────────────
  if (action === 'hris_employees') {
    try {
      var rows = hrisGetEmployees({
        company_code: e.parameter.company_code || 'ALL',
        status:       e.parameter.status       || 'ALL',
        search:       e.parameter.search       || '',
        page:         parseInt(e.parameter.page  || '1'),
        limit:        parseInt(e.parameter.limit || '100'),
      });
      return _json({ success: true, employees: rows, total: rows.length });
    } catch (err) { return _json({ success: false, message: err.message }); }
  }

  if (action === 'hris_employee') {
    try {
      var emp = hrisGetEmployee(e.parameter.employee_id);
      return _json(emp ? { success: true, employee: emp } : { success: false, message: 'Karyawan tidak ditemukan.' });
    } catch (err) { return _json({ success: false, message: err.message }); }
  }

  if (action === 'hris_contracts') {
    try {
      var rows = hrisGetContracts({ employee_id: e.parameter.employee_id, status: e.parameter.status });
      return _json({ success: true, contracts: rows });
    } catch (err) { return _json({ success: false, message: err.message }); }
  }

  if (action === 'hris_attendance') {
    try {
      var rows = hrisGetAttendance({
        employee_id: e.parameter.employee_id,
        date_from:   e.parameter.date_from,
        date_to:     e.parameter.date_to,
      });
      return _json({ success: true, attendance: rows });
    } catch (err) { return _json({ success: false, message: err.message }); }
  }

  if (action === 'hris_leave_requests') {
    try {
      var rows = hrisGetLeaveRequests({ employee_id: e.parameter.employee_id, status: e.parameter.status });
      return _json({ success: true, leave_requests: rows });
    } catch (err) { return _json({ success: false, message: err.message }); }
  }

  if (action === 'hris_leave_balance') {
    try {
      var bal = hrisGetLeaveBalance(e.parameter.employee_id, e.parameter.year);
      return _json({ success: true, balance: bal });
    } catch (err) { return _json({ success: false, message: err.message }); }
  }

  if (action === 'hris_payroll') {
    try {
      var rows = hrisGetPayroll({
        employee_id:  e.parameter.employee_id,
        period_month: e.parameter.period_month,
        period_year:  e.parameter.period_year,
      });
      return _json({ success: true, payroll: rows });
    } catch (err) { return _json({ success: false, message: err.message }); }
  }

  if (action === 'arsip') {
    try {
      const options = {
        status: e.parameter.status || 'ALL',
        search: e.parameter.search || '',
        page:   e.parameter.page   || 1,
        limit:  e.parameter.limit  || 100,
      };
      const result = getDocumentList(options);
      return ContentService
        .createTextOutput(JSON.stringify(Object.assign({ success: true }, result)))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, message: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Default: health check
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      app:     'RIFIM OS Smart Office',
      version: '1.0.0',
      status:  'running',
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

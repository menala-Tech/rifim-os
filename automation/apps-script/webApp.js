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

    // Default: Smart Office document generation
    return _json(generateDocument(input));

  } catch (err) {
    return _json({ success: false, message: 'Server error: ' + err.message });
  }
}

/**
 * Router HRIS POST actions.
 * @private
 */
function _handleHrisPost(input) {
  switch (input.hrisAction) {
    case 'add_employee':     return hrisAddEmployee(input.data);
    case 'update_employee':  return hrisUpdateEmployee(input.employee_id, input.data);
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
      var STAFF_SS_ID = '1fcraq3QHqIaD-13Ebzt6stT9aA6j_loTXeAtpNX12kw';
      var staffSS    = SpreadsheetApp.openById(STAFF_SS_ID);
      var staffSheet = staffSS.getSheetByName('MASTER DATA STAFF');
      if (!staffSheet) throw new Error('Sheet MASTER DATA STAFF tidak ditemukan.');
      var rows  = staffSheet.getDataRange().getValues();
      var staff = [];
      for (var i = 1; i < rows.length; i++) {
        var nama = String(rows[i][1] || '').trim();
        if (!nama) continue;
        staff.push({
          nama:    nama,
          id:      String(rows[i][4] || '').trim(),   // ID Staff (col E)
          jabatan: String(rows[i][5] || '').trim(),   // Jabatan  (col F)
          cabang:  String(rows[i][3] || '').trim(),   // ID Cabang (col D)
          email:   String(rows[i][0] || '').trim(),   // Email (col A)
        });
      }
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
      var email  = ((e.parameter.email || '').toLowerCase()).trim();
      // Auth Engine (Phase 2) — returns role-aware user profile
      var authResult = authVerifyUser(email);
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

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
  var input;
  try {
    input = JSON.parse(e.postData.contents);
  } catch (parseErr) {
    // Payload tidak bisa di-parse — log dan tolak
    _gasLogError('doPost', 'parse', parseErr,
      { raw: (e.postData && e.postData.contents || '').substring(0, 500) });
    return _json({ success: false, message: 'Payload JSON tidak valid.' });
  }

  try {
    if (_docIsAction_(input.action)) {
      return docHandlePost(e);
    }

    // ── HRIS actions ───────────────────────────────────────────────
    if (input.hrisAction) {
      return _json(_handleHrisPost(input));
    }

    // ── Smart Office: preview dokumen HTML (browser preview sebelum generate PDF) ─
    if (input.action === 'previewDocument') {
      if (!input.documentType || !input.company_code) {
        return _json({ success: false, message: 'documentType dan company_code wajib untuk preview.' });
      }
      try {
        var pvConfig  = getCompanyConfig();
        var pvCompany = getCompanyByCode(input.company_code);
        var pvPrefix  = pvCompany && pvCompany.doc_prefix ? String(pvCompany.doc_prefix) : 'RIFIM';
        var pvNum     = pvPrefix + '-' + input.documentType + '-PREVIEW';
        var pvData    = buildPlaceholderData(input, pvConfig, pvNum);
        var pvCo = {
          name:           (pvCompany && pvCompany.name)           || pvConfig['company_name']    || '',
          address:        (pvCompany && pvCompany.address)        || pvConfig['company_address'] || '',
          phone:          (pvCompany && pvCompany.phone)          || pvConfig['company_phone']   || '',
          email:          (pvCompany && pvCompany.email)          || pvConfig['company_email']   || '',
          director_name:  input.directorName  || (pvCompany && pvCompany.director_name)  || '',
          director_title: input.directorTitle || (pvCompany && pvCompany.director_title) || '',
        };
        var previewHtml = buildDocumentPreviewHtml(input.documentType, pvData, input.company_code.toUpperCase(), pvCo);
        return _json({ success: true, html: previewHtml });
      } catch (err) {
        _gasLogError('doPost', 'previewDocument', err, { documentType: input.documentType });
        return _json({ success: false, message: err.message });
      }
    }

    // ── Smart Office: generate dokumen via HTML pipeline (HTML → PDF) ──────────
    if (input.action === 'generateDocumentHtml') {
      input.use_html_pipeline = true;
      // Re-use flow generateDocument() yang sudah ada route ke HTML pipeline
      var htmlResult = generateDocument(input);
      if (htmlResult && htmlResult.success) {
        var byH = input.performed_by || {};
        logActivity('Smart Office', 'BUAT DOKUMEN (HTML)',
          htmlResult.documentNumber || '', input.subject || '',
          byH.name || '', byH.email || '',
          'Tipe: ' + (input.documentType || '') + ' · ' + (input.company_code || ''));
      }
      return _json(htmlResult);
    }

    // ── Smart Office: update document status ────────────────────────
    if (input.action === 'update_status') {
      if (!input.id || !input.status) {
        return _json({ success: false, message: 'Parameter id dan status wajib.' });
      }
      var validStatuses = ['DRAFT', 'FINAL', 'SENT', 'ARCHIVED'];
      if (validStatuses.indexOf(input.status) === -1) {
        return _json({ success: false, message: 'Status tidak valid: ' + input.status });
      }
      try {
        var updated = updateDocumentStatusById(input.id, input.status);
        if (updated) {
          var byU = input.performed_by || {};
          logActivity('Smart Office', 'UPDATE STATUS',
            input.id, input.status,
            byU.name || '', byU.email || '',
            'Status → ' + input.status);
        }
        return _json({ success: updated,
          message: updated ? 'Status diperbarui.' : 'Dokumen tidak ditemukan.' });
      } catch (err) {
        _gasLogError('doPost', 'update_status', err, { id: input.id, status: input.status });
        return _json({ success: false, message: err.message });
      }
    }

    // ── CRM/HRIS POST endpoints (foto upload butuh POST body, tidak muat di URL query)
    if (input.action === 'hris_upload_employee_photo') {
      try {
        return _json(_hrisUploadEmployeePhoto_(input));
      } catch (err) {
        _gasLogError('doPost', 'hris_upload_employee_photo', err,
          { employee_id: input.employee_id, photo_type: input.photo_type });
        return _json({ success: false, message: err.message });
      }
    }

    // ── Staff App PWA actions (staffLogin, staffSaldoSubmit, dll.) ─
    if (input.action && input.action !== 'log_activity') {
      var staffResult = routeStaffApp(input.action, input);
      if (staffResult !== null) return _json(staffResult);

      // ── Saldo Engine (saldoGetDriverBalance, saldoGetRekapCabang) ──
      var saldoResult = routeSaldoEngine(input.action, input);
      if (saldoResult !== null) return _json(saldoResult);

      // ── Fee Engine (feeGetRekapHarian, feeGetRekapBulanan, dll.) ──
      var feeResult = routeFeeEngine(input.action, input);
      if (feeResult !== null) return _json(feeResult);

      // ── RAOS Driver Layer (raosGetDriverList, raosAddDriver, raosUpdateDriver) ──
      var raosResult = routeRaosDriverLayer(input.action, input);
      if (raosResult !== null) return _json(raosResult);
    }

    // ── Log activity (fire-and-forget dari Portal / Smart Office) ──
    if (input.action === 'log_activity') {
      var by0 = input.performed_by || {};
      logActivity(input.module, input.action_type, input.target_id || '',
        input.target_name || '', by0.name || '', by0.email || '', input.detail || '');
      return _json({ success: true });
    }

    // ── Default: Smart Office document generation ──────────────────
    // Validasi field attachment: harus integer (nomor lampiran), bukan teks bebas
    if (input.attachment !== undefined && input.attachment !== '-') {
      var attNum = Number(input.attachment);
      if (isNaN(attNum) || !Number.isInteger(attNum)) {
        _gasLogWarn('Smart Office', 'generateDocument',
          'attachment bukan integer: ' + String(input.attachment),
          { documentType: input.documentType, subject: input.subject });
        // Koreksi: paksa ke integer atau default 0
        input.attachment = Number.isInteger(attNum) ? attNum : 0;
      } else {
        input.attachment = attNum; // enforce number type
      }
    }

    var docResult = generateDocument(input);
    if (docResult && docResult.success) {
      var by = input.performed_by || {};
      logActivity('Smart Office', 'BUAT DOKUMEN',
        docResult.documentNumber || '', input.subject || '',
        by.name || '', by.email || '',
        'Tipe: ' + (input.documentType || '') + ' · ' + (input.company_code || ''));
      notifDocumentCreated({
        documentNumber: docResult.documentNumber || '',
        documentType:   DOCUMENT_TYPES[input.documentType]
                          ? DOCUMENT_TYPES[input.documentType].label
                          : (input.documentType || ''),
        subject:        input.subject  || '',
        gdocUrl:        docResult.gdocUrl || '',
        pdfUrl:         docResult.pdfUrl  || '',
        createdBy:      by.name || by.email || '',
      });
    }
    return _json(docResult);

  } catch (err) {
    // Catat ke system_log — bukan hanya console.warn
    _gasLogError('doPost', input.action || input.hrisAction || 'unknown', err,
      { action: input.action, hrisAction: input.hrisAction, documentType: input.documentType });
    return _json({ ok: false, error: err.message });
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
 * Jika sync gagal, operasi utama tetap berhasil — tapi dicatat ke system_log.
 * @private
 */
function _syncAfterHrisWrite(result) {
  try {
    syncHrisEmployeesToSheet();
  } catch (syncErr) {
    // Dulu hanya console.warn — sekarang juga log ke system_log
    _gasLogError('HRIS', '_syncAfterHrisWrite', syncErr, null);
  }
  return result;
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function docHandleGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var ctx = _docAuthContext_(params.user);
    var action = String(params.action || '');
    var data;

    if (action === 'doc_audit' || action === 'doc_verify_chain') {
      _docRequireRole_(ctx, _docAdminRoles_());
    }

    switch (action) {
      case 'doc_list':
        data = searchDocuments({
          query: params.query,
          companySlug: params.companySlug,
          docType: params.docType,
          status: params.status,
          from: params.from,
          to: params.to,
          limit: params.limit,
          offset: params.offset,
        });
        break;
      case 'doc_get':
        data = _docGetWithCurrentRevision_(params.id || params.documentId);
        break;
      case 'doc_revisions':
        data = listRevisions(params.documentId || params.id);
        break;
      case 'doc_revision_diff':
        data = getRevisionDiff(params.revIdA || params.revisionIdA, params.revIdB || params.revisionIdB);
        break;
      case 'doc_audit':
        data = queryEvents({ entityType: params.entityType, entityId: params.entityId, since: params.since, limit: params.limit });
        break;
      case 'doc_pending':
        data = getPendingForApprover(ctx.userId);
        break;
      case 'doc_verify_chain':
        data = _docVerifyChainSafe_({ fromId: params.fromId, toId: params.toId });
        break;
      default:
        throw new Error('doc GET action tidak dikenal: ' + action);
    }

    return _docJsonOk_(data);
  } catch (err) {
    return _docJsonError_(err);
  }
}

function docHandlePost(e) {
  var input;
  try {
    input = JSON.parse(e.postData.contents || '{}');
  } catch (err) {
    return _docJsonError_(new Error('Payload JSON tidak valid.'));
  }

  try {
    var postParams = (e && e.parameter) || {};
    var ctx = _docAuthContext_(postParams.user || input.user);
    var action = String(input.action || '');
    _docRequireRole_(ctx, _docWriteRoles_());

    var data;
    switch (action) {
      case 'doc_create':
        data = _docCreateDraft_(input, ctx);
        break;
      case 'doc_transition':
        data = transitionDocument({ documentId: input.documentId, action: input.workflowAction || input.transitionAction || input.documentAction || (input.payload && input.payload.action), actor: ctx.userId, payload: input.payload || {} });
        break;
      case 'doc_decide':
        data = decideApproval({ approvalId: input.approvalId, approverId: ctx.userId, decision: input.decision, comment: input.comment });
        break;
      case 'doc_revise':
        data = createRevision({ documentId: input.documentId, payload: input.payload || {}, actor: ctx.userId });
        _sbPatch('doc_documents', 'id=eq.' + encodeURIComponent(input.documentId), {
          current_revision_id: data.revisionId,
          status: 'draft',
          updated_at: new Date().toISOString(),
        });
        break;
      case 'doc_restore':
        data = restoreRevision({ documentId: input.documentId, revisionId: input.revisionId, actor: ctx.userId });
        break;
      default:
        throw new Error('doc POST action tidak dikenal: ' + action);
    }

    return _docJsonOk_(data);
  } catch (err) {
    return _docJsonError_(err);
  }
}

function _docCreateDraft_(input, ctx) {
  var documentId = input.documentId || Utilities.getUuid();
  var now = new Date().toISOString();
  var title = input.title || (input.payload && input.payload.title) || '';
  var payload = input.payload || {};

  _sbPost('doc_documents', {
    id: documentId,
    title: title,
    doc_number: input.docNumber || input.doc_number || ('DOC-' + now.replace(/[-:.TZ]/g, '')),
    company_slug: input.companySlug || input.company_slug || '',
    doc_type: input.docType || input.doc_type || '',
    status: 'draft',
    created_by: ctx.userId,
    created_at: now,
    updated_at: now,
  });

  var revision = createRevision({ documentId: documentId, payload: payload, actor: ctx.userId, pdfDriveId: input.pdfDriveId });
  _sbPatch('doc_documents', 'id=eq.' + encodeURIComponent(documentId), {
    current_revision_id: revision.revisionId,
    updated_at: new Date().toISOString(),
  });

  return { documentId: documentId, revisionId: revision.revisionId, revisionNumber: revision.revisionNumber };
}

function _docGetWithCurrentRevision_(documentId) {
  if (!documentId) throw new Error('documentId diperlukan.');
  var docs = _sbGet(_docRestUrl_('doc_documents', [
    'id=eq.' + encodeURIComponent(documentId),
    'select=id,title,doc_number,company_slug,doc_type,status,current_revision_id,created_at,updated_at',
    'limit=1',
  ]));
  if (!docs.length) throw new Error('Dokumen tidak ditemukan.');

  var doc = docs[0];
  var revision = null;
  if (doc.current_revision_id) {
    var revisions = _sbGet(_docRestUrl_('doc_revisions', [
      'id=eq.' + encodeURIComponent(doc.current_revision_id),
      'select=id,revision_number,payload,created_by,created_at,pdf_url',
      'limit=1',
    ]));
    revision = revisions.length ? revisions[0] : null;
  }
  return { document: doc, revision: revision };
}

function _docAuthContext_(userEmail) {
  userEmail = String(userEmail || '').toLowerCase().trim();
  if (!userEmail) throw new Error('unauthorized');

  var rows = _sbGet(_docRestUrl_('user_profiles', [
    'email=eq.' + encodeURIComponent(userEmail),
    'select=id,email,role,is_active',
    'limit=1',
  ]));
  if (!rows.length) {
    rows = _sbGet(_docRestUrl_('users', [
      'email=eq.' + encodeURIComponent(userEmail),
      'select=id,email,role,is_active',
      'limit=1',
    ]));
  }
  if (!rows.length || rows[0].is_active === false) throw new Error('unauthorized');

  return { userId: rows[0].id, email: rows[0].email || userEmail, role: String(rows[0].role || '').toLowerCase() };
}

function _docRequireRole_(ctx, roles) {
  if (roles.indexOf(ctx.role) === -1) throw new Error('forbidden: role ' + ctx.role + ' tidak diizinkan');
}

function _docWriteRoles_() {
  return ['koordinator', 'admin', 'management', 'direksi', 'direktur'];
}

function _docAdminRoles_() {
  return ['admin', 'management', 'direksi', 'direktur'];
}

function _docIsAction_(action) {
  return String(action || '').indexOf('doc_') === 0;
}

function _docVerifyChainSafe_(input) {
  var result = verifyChain(input || {});
  return {
    ok: result && result.ok === true,
    brokenAt: result && result.brokenAt !== undefined && result.brokenAt !== null ? String(result.brokenAt) : null,
    checkedRows: Number(result && result.checkedRows) || 0,
  };
}

function _docJsonOk_(data) {
  return _docJsonOutput_({ ok: true, data: data });
}

function _docJsonError_(err) {
  var message = err && err.message ? err.message : String(err || 'Unknown error');
  return _docJsonOutput_({ ok: false, error: message });
}

function _docJsonOutput_(payload) {
  var text;
  try {
    text = JSON.stringify(_docSafeJsonValue_(payload));
  } catch (err) {
    text = JSON.stringify({ ok: false, error: 'Response JSON tidak valid: ' + (err && err.message ? err.message : String(err)) });
  }
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

function _docSafeJsonValue_(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'number') return isFinite(value) ? value : null;
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'function') return null;
  if (Object.prototype.toString.call(value) === '[object Date]') return value.toISOString();
  if (typeof value !== 'object') return value;

  if (Object.prototype.toString.call(value) === '[object Array]') {
    return value.map(function (item) { return _docSafeJsonValue_(item); });
  }

  var safe = {};
  Object.keys(value).forEach(function (key) {
    safe[key] = _docSafeJsonValue_(value[key]);
  });
  return safe;
}

function _docRestUrl_(table, params) {
  var cfg = _getSupabaseConfig();
  return cfg.url + '/rest/v1/' + table + (params && params.length ? '?' + params.join('&') : '');
}


/**
 * Handle GET — health check & info.
 */
function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  if (_docIsAction_(action)) {
    try {
      return docHandleGet(e);
    } catch (err) {
      return _docJsonError_(err);
    }
  }

  // CRM API dispatcher (sesi 2026-08-02) — return early kalau action
  // adalah CRM endpoint (company_config_*, whitelist_*, crm_audit_tail).
  // File: crmApi.js
  var crmResp = crmHandleGet(e);
  if (crmResp) return crmResp;

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

  // ─── HRIS SYNC — SSOT MASTER DATA STAFF → employees (on-demand) ───
  if (action === 'hris_sync_master_staff_now') {
    try {
      var r = syncEmployeesFromMasterStaff();
      return _json({ success: true, result: r });
    } catch (err) { return _json({ success: false, message: err.message }); }
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

  if (action === 'get_document') {
    try {
      var doc = getDocumentById(e.parameter.id || '');
      return _json(doc ? { success: true, doc: doc } : { success: false, message: 'Dokumen tidak ditemukan.' });
    } catch (err) { return _json({ success: false, message: err.message }); }
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

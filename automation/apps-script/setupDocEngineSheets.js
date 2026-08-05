/**
 * RIFIM OS — Document Engine Sheets Setup
 *
 * Membuat 3 tab di spreadsheet SSoT (ID: 1jHeA...) untuk mirror data
 * Supabase doc_* tables. Sheet ini WAJIB ada — konsisten dengan Rule §0
 * (antar sheet harus terintegrasi).
 *
 * Tab yang dibuat:
 *   1. doc_approval_rules   — config approver per (company, doc_type)
 *      Sinkron 2-arah: admin edit di sheet → push ke Supabase
 *      via syncDocApprovalRulesToSupabase().
 *   2. doc_audit_mirror     — read-only, pull terakhir 1000 event audit
 *      dari Supabase. Refresh via syncDocAuditFromSupabase() (menu +
 *      trigger 30 menit).
 *   3. doc_pending_approvals — dashboard realtime approver inbox
 *      (siapa harus approve apa). Refresh via syncDocPendingApprovals().
 *
 * Reusable helpers: _getDB (configLoader.js), _sbGet/_sbPost/_sbPatch
 * (hrisLayer.js), _getSupabaseConfig().
 */

// ─────────────────────────────────────────────
// MAIN ENTRY (dipanggil dari menu 🏢 Document Engine → Setup Sheets)
// ─────────────────────────────────────────────

function initDocEngineSheets() {
  var ss = _getDB();
  Logger.log('=== Init Document Engine Sheets ===');

  _setupDocApprovalRulesSheet(ss);
  _setupDocAuditMirrorSheet(ss);
  _setupDocPendingApprovalsSheet(ss);

  SpreadsheetApp.getUi().alert(
    '✅ 3 tab Document Engine ter-create.\n\n' +
    '  • doc_approval_rules    (edit di sini → sync ke Supabase)\n' +
    '  • doc_audit_mirror      (read-only)\n' +
    '  • doc_pending_approvals (dashboard approver)\n\n' +
    'Selanjutnya jalankan:\n' +
    '  Menu → 🔄 Sync Approval Rules → Supabase\n' +
    '  Menu → 🔄 Refresh Audit Mirror'
  );
}

// ─────────────────────────────────────────────
// TAB 1: doc_approval_rules (config, edit-able)
// ─────────────────────────────────────────────

function _setupDocApprovalRulesSheet(ss) {
  var sheet = ss.getSheetByName('doc_approval_rules') || ss.insertSheet('doc_approval_rules');
  sheet.clear();

  var headers = [
    'company_slug',     // 'rifim'|'mig'|'lailan'
    'doc_type',         // 'surat'|'invoice'|'kwitansi'|'sp'|'pkwt'|'mou'
    'approvers_json',   // JSON array of user_profiles.id, e.g. ["uuid1","uuid2"]
    'mode',             // 'sequential'|'parallel'
    'is_active',        // TRUE/FALSE
    'notes',            // opsional
    'updated_at',       // auto-fill saat sync
  ];

  var range = sheet.getRange(1, 1, 1, headers.length);
  range.setValues([headers]);
  range.setBackground('#1a4d7a').setFontColor('#FFFFFF').setFontWeight('bold');

  var widths = [140, 140, 400, 120, 90, 240, 160];
  widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });

  // Data validation
  var docTypes = ['surat', 'invoice', 'kwitansi', 'sp', 'pkwt', 'mou'];
  var modes    = ['sequential', 'parallel'];
  var companies = ['rifim', 'mig', 'lailan'];

  var dtRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(docTypes, true).setAllowInvalid(false).build();
  sheet.getRange(2, 2, sheet.getMaxRows() - 1).setDataValidation(dtRule);

  var mdRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(modes, true).setAllowInvalid(false).build();
  sheet.getRange(2, 4, sheet.getMaxRows() - 1).setDataValidation(mdRule);

  var cpRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(companies, true).setAllowInvalid(false).build();
  sheet.getRange(2, 1, sheet.getMaxRows() - 1).setDataValidation(cpRule);

  sheet.setFrozenRows(1);
  Logger.log('✅ doc_approval_rules sheet ready.');
}

// ─────────────────────────────────────────────
// TAB 2: doc_audit_mirror (read-only)
// ─────────────────────────────────────────────

function _setupDocAuditMirrorSheet(ss) {
  var sheet = ss.getSheetByName('doc_audit_mirror') || ss.insertSheet('doc_audit_mirror');
  sheet.clear();

  var headers = [
    'id', 'entity_type', 'entity_id', 'actor_id',
    'action', 'payload_json', 'prev_hash_12', 'row_hash_12',
    'created_at_wib',
  ];
  var range = sheet.getRange(1, 1, 1, headers.length);
  range.setValues([headers]);
  range.setBackground('#4a4a4a').setFontColor('#FFFFFF').setFontWeight('bold');

  var widths = [80, 110, 260, 260, 140, 400, 120, 120, 180];
  widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });

  // Banner readonly
  sheet.getRange(1, headers.length + 1).setValue('⚠️ READ-ONLY — sync dari Supabase, jangan edit manual')
    .setFontStyle('italic').setFontColor('#B00020');

  sheet.setFrozenRows(1);
  Logger.log('✅ doc_audit_mirror sheet ready.');
}

// ─────────────────────────────────────────────
// TAB 3: doc_pending_approvals (dashboard)
// ─────────────────────────────────────────────

function _setupDocPendingApprovalsSheet(ss) {
  var sheet = ss.getSheetByName('doc_pending_approvals') || ss.insertSheet('doc_pending_approvals');
  sheet.clear();

  var headers = [
    'approval_id', 'document_id', 'title', 'company_slug',
    'doc_type', 'approver_name', 'approver_email',
    'order_index', 'created_at_wib', 'waiting_hours',
  ];
  var range = sheet.getRange(1, 1, 1, headers.length);
  range.setValues([headers]);
  range.setBackground('#c9a227').setFontColor('#FFFFFF').setFontWeight('bold');

  var widths = [260, 260, 300, 100, 100, 200, 240, 90, 180, 120];
  widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });

  // Kondisi waiting_hours > 24 → merah
  var rule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(24)
    .setBackground('#f4cccc')
    .setRanges([sheet.getRange('J2:J1000')])
    .build();
  sheet.setConditionalFormatRules([rule]);

  sheet.setFrozenRows(1);
  Logger.log('✅ doc_pending_approvals sheet ready.');
}

// ═════════════════════════════════════════════════════════════════════
// SYNC FUNCTIONS
// ═════════════════════════════════════════════════════════════════════

/**
 * PUSH: sheet doc_approval_rules → Supabase doc_approval_rules table.
 * Upsert by (company_slug, doc_type).
 */
function syncDocApprovalRulesToSupabase() {
  var ss = _getDB();
  var sheet = ss.getSheetByName('doc_approval_rules');
  if (!sheet) throw new Error('Sheet doc_approval_rules belum ada. Run initDocEngineSheets() dulu.');

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    Logger.log('Sheet kosong, tidak ada row untuk di-sync.');
    return { pushed: 0 };
  }

  var cfg = _getSupabaseConfig();
  var pushed = 0;
  var errors = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var company = (row[0] || '').toString().trim();
    var docType = (row[1] || '').toString().trim();
    if (!company || !docType) continue;

    var approversRaw = (row[2] || '').toString().trim();
    var approvers;
    try {
      approvers = approversRaw ? JSON.parse(approversRaw) : [];
      if (!Array.isArray(approvers)) throw new Error('approvers_json harus array');
    } catch (e) {
      errors.push('Row ' + (i + 1) + ': approvers_json invalid — ' + e.message);
      continue;
    }

    var payload = {
      company_slug: company,
      doc_type: docType,
      approvers: approvers,
      mode: (row[3] || 'sequential').toString().trim(),
      is_active: row[4] === true || row[4] === 'TRUE',
    };

    // Upsert via PostgREST on_conflict
    var url = cfg.url + '/rest/v1/doc_approval_rules?on_conflict=company_slug,doc_type';
    var res = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: Object.assign(_sbHeaders(cfg.key, 'return=representation,resolution=merge-duplicates'), {}),
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    var code = res.getResponseCode();
    if (code < 200 || code >= 300) {
      errors.push('Row ' + (i + 1) + ': HTTP ' + code + ' — ' + res.getContentText().substring(0, 150));
      continue;
    }

    sheet.getRange(i + 1, 7).setValue(new Date()); // updated_at
    pushed++;
  }

  Logger.log('Pushed ' + pushed + ' rule(s). Errors: ' + errors.length);
  errors.forEach(function(e) { Logger.log('  ' + e); });

  SpreadsheetApp.getUi().alert(
    '📤 Sync Approval Rules\n\n' +
    'Pushed : ' + pushed + '\n' +
    'Errors : ' + errors.length +
    (errors.length ? '\n\n' + errors.slice(0, 3).join('\n') : '')
  );

  return { pushed: pushed, errors: errors };
}

/**
 * PULL: Supabase doc_audit_log → sheet doc_audit_mirror (last 1000 rows).
 * Dipanggil manual dari menu + trigger 30 menit.
 */
function syncDocAuditFromSupabase() {
  var ss = _getDB();
  var sheet = ss.getSheetByName('doc_audit_mirror');
  if (!sheet) throw new Error('Sheet doc_audit_mirror belum ada.');

  var cfg = _getSupabaseConfig();
  var url = cfg.url + '/rest/v1/doc_audit_log?select=id,entity_type,entity_id,actor_id,action,payload,prev_hash,row_hash,created_at&order=id.desc&limit=1000';
  var rows = _sbGet(url);

  // Clear body (keep header row)
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();

  if (!rows.length) {
    Logger.log('doc_audit_log kosong.');
    return { pulled: 0 };
  }

  var tz = 'Asia/Jakarta';
  var values = rows.map(function(r) {
    return [
      r.id,
      r.entity_type,
      r.entity_id,
      r.actor_id || '',
      r.action,
      JSON.stringify(r.payload || {}),
      (r.prev_hash || '').substring(0, 12),
      (r.row_hash  || '').substring(0, 12),
      Utilities.formatDate(new Date(r.created_at), tz, 'yyyy-MM-dd HH:mm:ss'),
    ];
  });

  sheet.getRange(2, 1, values.length, values[0].length).setValues(values);
  Logger.log('Pulled ' + values.length + ' audit row(s).');
  return { pulled: values.length };
}

/**
 * PULL: doc_approvals pending → sheet doc_pending_approvals.
 * Join dengan user_profiles untuk nama approver.
 */
function syncDocPendingApprovals() {
  var ss = _getDB();
  var sheet = ss.getSheetByName('doc_pending_approvals');
  if (!sheet) throw new Error('Sheet doc_pending_approvals belum ada.');

  var cfg = _getSupabaseConfig();
  var url = cfg.url + '/rest/v1/doc_approvals?select=id,document_id,approver_id,order_index,created_at,doc_documents(title,company_slug,doc_type),user_profiles(full_name,email)&status=eq.pending&order=created_at.asc';
  var rows = _sbGet(url);

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();

  if (!rows.length) {
    Logger.log('Tidak ada pending approvals.');
    return { pulled: 0 };
  }

  var tz = 'Asia/Jakarta';
  var now = Date.now();
  var values = rows.map(function(r) {
    var doc = r.doc_documents || {};
    var usr = r.user_profiles || {};
    var createdMs = new Date(r.created_at).getTime();
    var waitingHrs = Math.round((now - createdMs) / 3.6e6 * 10) / 10;
    return [
      r.id, r.document_id, doc.title || '', doc.company_slug || '',
      doc.doc_type || '', usr.full_name || '', usr.email || '',
      r.order_index,
      Utilities.formatDate(new Date(r.created_at), tz, 'yyyy-MM-dd HH:mm:ss'),
      waitingHrs,
    ];
  });

  sheet.getRange(2, 1, values.length, values[0].length).setValues(values);
  Logger.log('Pulled ' + values.length + ' pending approval(s).');
  return { pulled: values.length };
}

// ═════════════════════════════════════════════════════════════════════
// TRIGGER SETUP
// ═════════════════════════════════════════════════════════════════════

/**
 * Install trigger 30 menit untuk syncDocAuditFromSupabase +
 * syncDocPendingApprovals. Panggil sekali dari menu.
 */
function installDocEngineTriggers() {
  ['syncDocAuditFromSupabase', 'syncDocPendingApprovals'].forEach(function(fn) {
    ScriptApp.getProjectTriggers().forEach(function(t) {
      if (t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t);
    });
    ScriptApp.newTrigger(fn).timeBased().everyMinutes(30).create();
  });
  SpreadsheetApp.getUi().alert('✅ 2 trigger 30-menit terpasang:\n  • syncDocAuditFromSupabase\n  • syncDocPendingApprovals');
}

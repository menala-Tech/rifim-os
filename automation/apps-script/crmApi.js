/**
 * RIFIM OS — CRM API (sesi 2026-08-02)
 * Endpoint yang di-consume oleh modul CRM di `rifim-os.vercel.app/crm`.
 *
 * Cara install: file ini di-push via clasp bersama file .js lain.
 * TAMBAHKAN 3 baris ini di TOP of doGet(e) di webApp.js:
 *
 *   function doGet(e) {
 *     var crmResp = crmHandleGet(e);
 *     if (crmResp) return crmResp;
 *     // ... existing doGet logic
 *   }
 *
 * Semua endpoint return JSON: { success: bool, ... payload / message }
 * Write hanya Admin/Direksi/Direktur. Actor wajib berasal dari Supabase access token
 * yang diverifikasi server-side; parameter email browser tidak dipercaya.
 */

// ═══════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════
var CRM_READ_ROLES  = ['admin','management','direksi','direktur'];
var CRM_WRITE_ROLES = ['admin','direksi','direktur'];

var CRM_ACTIONS = {
  company_config_list: true,
  company_config_set: true,
  company_config_drive_audit: true,
  canonical_drive_audit: true,
  canonical_drive_prepare_month: true,
  canonical_drive_backup_master: true,
  whitelist_list: true,
  whitelist_add: true,
  whitelist_remove: true,
  whitelist_update: true,
  crm_audit_tail: true,
  sistem_config_list: true,
  sistem_config_set: true,
  sistem_config_audit: true,
  sistem_config_sync_all: true,
  raos_users_list: true,
  raos_users_update: true,
  raos_users_reset_pin: true,
  raos_credentials_list: true,
  raos_credentials_reset_pin: true,
  raos_ssot_pin_update: true,
  contacts_list: true,
  contacts_upsert: true,
  contacts_delete: true,
  finance_list: true,
  finance_cabang_list: true,
  finance_tagihan_list: true,
  finance_tagihan_add: true,
  finance_tagihan_mark_paid: true,
  finance_rekap_harian: true,
  finance_rekap_bulanan: true,
  finance_log_list: true,
  finance_saldo_raos_list: true,
  finance_saldo_raos_mark_paid: true,
  finance_kpi_target_branch_list: true,
  finance_kpi_target_branch_upsert: true,
  finance_kpi_target_staff_list: true,
  finance_kpi_target_staff_upsert: true,
  finance_payroll_compute: true,
  finance_payroll_list: true,
  finance_drivers_list: true,
  finance_driver_assignment_list: true,
  finance_driver_assign_random: true,
  hris_payroll_bonus_list: true,
  hris_payroll_v2_bundle: true,
  hris_payroll_v2_branches: true,
  hris_payroll_v2_manual_kasbon: true,
  hris_payroll_v2_deposit: true,
  hris_upload_employee_photo: true,
  hris_attendance_raos_list: true,
  hris_attendance_summary_month: true,
  hris_attendance_edit: true,
  hris_gapok_proporsional_list: true,
};

// ═══════════════════════════════════════════════════════════════════════
// Dispatcher — dipanggil dari webApp.js doGet
// ═══════════════════════════════════════════════════════════════════════
function crmHandleGet(e) {
  var action = e && e.parameter && e.parameter.action;
  if (!action || !CRM_ACTIONS[action]) return null;
  return _crmJson({
    success: false,
    code: 'METHOD_NOT_ALLOWED',
    message: 'Endpoint privileged wajib POST dengan session access token.',
  });
}

function crmHandlePost(input) {
  var action = input && input.action;
  if (!action || !CRM_ACTIONS[action]) return null;
  try {
    _crmRequireRead_(input);
    return _crmJson(_crmDispatch_(action, input));
  } catch (err) {
    return _crmJson({
      success: false,
      code: err.code || 'CRM_API_ERROR',
      message: err.message || String(err),
    });
  }
}

function _crmDispatch_(action, params) {
  if (action === 'company_config_list') return { success: true, config: _crmReadKV_('company_config') };
  if (action === 'company_config_set') return _crmSetKV_('company_config', params);
  if (action === 'company_config_drive_audit') return _crmCompanyConfigDriveAudit_(params);
  if (action === 'canonical_drive_audit') return _crmCanonicalDriveAudit_(params);
  if (action === 'canonical_drive_prepare_month') return _crmCanonicalDrivePrepareMonth_(params);
  if (action === 'canonical_drive_backup_master') return _crmCanonicalDriveBackupMaster_(params);
  if (action === 'whitelist_list') return { success: true, whitelist: _crmWhitelistList_() };
  if (action === 'whitelist_add') return _crmWhitelistMutate_('add', params);
  if (action === 'whitelist_remove') return _crmWhitelistMutate_('remove', params);
  if (action === 'whitelist_update') return _crmWhitelistUpdate_(params);
  if (action === 'crm_audit_tail') return { success: true, logs: _crmAuditTail_(parseInt(params.limit) || 100) };
  if (action === 'sistem_config_list') return _crmSistemConfigList_(params);
  if (action === 'sistem_config_set') return _crmSistemConfigSetSheet_(params);
  if (action === 'sistem_config_audit') return _crmSistemConfigAudit_(params);
  if (action === 'sistem_config_sync_all') return _crmSistemConfigSyncAll_(params);
  if (action === 'raos_users_list') return _crmRaosUsersList_(params);
  if (action === 'raos_users_update') return _crmRaosUsersUpdate_(params);
  if (action === 'raos_users_reset_pin') return _crmRaosUsersResetPin_(params);
  if (action === 'raos_credentials_list') return _crmRaosCredentialsList_(params);
  if (action === 'raos_credentials_reset_pin') return _crmRaosCredentialsResetPin_(params);
  if (action === 'raos_ssot_pin_update') {
    return { success: false, code: 'LEGACY_PIN_OWNED_BY_SSOT', message: 'PIN legacy tidak boleh diubah dari CRM. Gunakan dedicated PIN RAOS.' };
  }
  if (action === 'contacts_list') return _crmContactsList_(params);
  if (action === 'contacts_upsert') return _crmContactsUpsert_(params);
  if (action === 'contacts_delete') return _crmContactsDelete_(params);
  if (action === 'finance_list') return _finLedgerList_(params);
  if (action === 'finance_cabang_list') return _finCabangList_(params);
  if (action === 'finance_tagihan_list') return _finTagihanList_(params);
  if (action === 'finance_tagihan_add') return _finTagihanAdd_(params);
  if (action === 'finance_tagihan_mark_paid') return _finTagihanMarkPaid_(params);
  if (action === 'finance_rekap_harian') return _finRekapHarian_(params);
  if (action === 'finance_rekap_bulanan') return _finRekapBulanan_(params);
  if (action === 'finance_log_list') return _finLogList_(params);
  if (action === 'finance_saldo_raos_list') return _finSaldoRaosList_(params);
  if (action === 'finance_saldo_raos_mark_paid') return _finSaldoRaosMarkPaid_(params);
  if (action === 'finance_kpi_target_branch_list') return _finKpiTargetBranchList_(params);
  if (action === 'finance_kpi_target_branch_upsert') return _finKpiTargetBranchUpsert_(params);
  if (action === 'finance_kpi_target_staff_list') return _finKpiTargetStaffList_(params);
  if (action === 'finance_kpi_target_staff_upsert') return _finKpiTargetStaffUpsert_(params);
  if (action === 'finance_payroll_compute') return _finPayrollCompute_(params);
  if (action === 'finance_payroll_list') return _finPayrollList_(params);
  if (action === 'finance_drivers_list') return _finDriversList_(params);
  if (action === 'finance_driver_assignment_list') return _finDriverAssignmentList_(params);
  if (action === 'finance_driver_assign_random') return _finDriverAssignRandom_(params);
  if (action === 'hris_payroll_bonus_list') return _hrisPayrollBonusList_(params);
  if (action === 'hris_payroll_v2_bundle') return _payrollV2Bundle_(params);
  if (action === 'hris_payroll_v2_branches') return _payrollV2BranchList_(params);
  if (action === 'hris_payroll_v2_manual_kasbon') return _payrollV2ManualKasbon_(params);
  if (action === 'hris_payroll_v2_deposit') return _payrollV2Deposit_(params);
  if (action === 'hris_upload_employee_photo') return _hrisUploadEmployeePhoto_(params);
  if (action === 'hris_attendance_raos_list') return _hrisAttendanceRaosList_(params);
  if (action === 'hris_attendance_summary_month') return _hrisAttendanceSummaryMonth_(params);
  if (action === 'hris_attendance_edit') return _hrisAttendanceEdit_(params);
  if (action === 'hris_gapok_proporsional_list') return _hrisGapokProporsionalList_(params);
  throw new Error('CRM action tidak dikenal: ' + action);
}

// ═══════════════════════════════════════════════════════════════════════
// Company Config (sheet `company_config` di Smart Office DB)
// ═══════════════════════════════════════════════════════════════════════
function _crmReadKV_(sheetName) {
  var sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet ' + sheetName + ' tidak ditemukan');
  var data = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][0] || '').trim();
    if (!key) continue;
    out.push({ key: key, value: data[i][1], description: data[i][2] || '' });
  }
  return out;
}

function _crmCompanyConfigDriveAudit_(params) {
  _crmRequireRead_(params);
  var rows = _crmReadKV_('company_config');
  var items = [];
  rows.forEach(function(row) {
    var key = String(row.key || '');
    var id = String(row.value || '').trim();
    if (!id) return;
    var isFolder = (/^drive_.*folder_id$/).test(key) || key === 'signature_cache_folder_id';
    var isFile = key.indexOf('gdoc_template_') === 0 || key.indexOf('logo_') === 0 || key.indexOf('kop_banner_') === 0 || key.indexOf('footer_banner_') === 0;
    if (!isFolder && !isFile) return;
    var legacy = key === 'drive_dokumen_folder_id' || key.indexOf('drive_folder_') === 0;
    try {
      var obj = isFolder ? DriveApp.getFolderById(id) : DriveApp.getFileById(id);
      items.push({ key:key, id:id, type:isFolder ? 'folder' : 'file', ok:true, name:obj.getName(), legacy:legacy });
    } catch (err) {
      items.push({ key:key, id:id, type:isFolder ? 'folder' : 'file', ok:false, legacy:legacy, message:err.message || String(err) });
    }
  });
  var bad = items.filter(function(x) { return !x.ok; });
  var canonical = (typeof canonicalDriveAudit === 'function')
    ? canonicalDriveAudit()
    : { success:false, healthy:false, issues:[{code:'CANONICAL_RESOLVER_MISSING',message:'canonicalDriveStorage.js belum terpasang'}] };
  return {
    success:true,
    healthy:bad.length === 0 && canonical.healthy === true,
    checked:items.length,
    invalid:bad.length,
    legacy_count:items.filter(function(x){return x.legacy;}).length,
    items:items,
    canonical:canonical
  };
}

function _crmCanonicalDriveAudit_(params) {
  _crmRequireRead_(params);
  if (typeof canonicalDriveAudit !== 'function') {
    return { success:false, healthy:false, message:'canonicalDriveStorage.js belum terpasang' };
  }
  return canonicalDriveAudit();
}

function _crmCanonicalDriveDate_(raw) {
  var value = String(raw || '').trim();
  if (!value) return new Date();
  // Accept YYYY-MM or YYYY-MM-DD.
  if (/^\d{4}-\d{2}$/.test(value)) value += '-01';
  var d = new Date(value + (value.length === 10 ? 'T12:00:00' : ''));
  if (isNaN(d.getTime())) throw new Error('month/date tidak valid: ' + raw);
  return d;
}

function _crmCanonicalDrivePrepareMonth_(params) {
  _crmRequireAdmin_(params);
  if (typeof canonicalDriveEnsureAllModulesMonth !== 'function' || typeof canonicalDriveEnsureAllCompaniesMonth !== 'function') {
    return { success:false, message:'canonicalDriveStorage.js belum terpasang' };
  }
  var when = _crmCanonicalDriveDate_(params.month || params.date);
  var modules = canonicalDriveEnsureAllModulesMonth(when);
  var companies = canonicalDriveEnsureAllCompaniesMonth(when);
  var parts = canonicalDriveMonthParts_(when);
  _crmAuditWrite_(params, 'prepare_month', 'canonical_drive', parts.year + '/' + parts.month, '', 'modules+companies');
  return { success:true, year:parts.year, month:parts.month, modules:modules, companies:companies };
}

function _crmCanonicalDriveBackupMaster_(params) {
  _crmRequireAdmin_(params);
  if (typeof canonicalDriveBackupMasterSpreadsheet !== 'function') {
    return { success:false, message:'canonicalDriveStorage.js belum terpasang' };
  }
  var when = _crmCanonicalDriveDate_(params.month || params.date);
  var file = canonicalDriveBackupMasterSpreadsheet(when);
  _crmAuditWrite_(params, 'backup_master', 'canonical_drive', file.getId(), '', file.getName());
  return { success:true, file_id:file.getId(), file_name:file.getName(), url:file.getUrl() };
}

function _crmSetKV_(sheetName, params) {
  _crmRequireAdmin_(params);
  var key = String(params.key || '').trim();
  var value = params.value == null ? '' : String(params.value);
  if (!key) return { success: false, message: 'Parameter key wajib' };

  var sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh) return { success: false, message: 'Sheet ' + sheetName + ' tidak ditemukan' };

  var data = sh.getDataRange().getValues();
  var before = null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === key) {
      before = data[i][1];
      sh.getRange(i + 1, 2).setValue(value);
      _crmAuditWrite_(params, before === null ? 'add' : 'edit', sheetName, key, before, value);
      return { success: true, key: key, value: value, before: before };
    }
  }
  // key baru — append row
  sh.appendRow([key, value, params.description || '']);
  _crmAuditWrite_(params, 'add', sheetName, key, null, value);
  return { success: true, key: key, value: value, before: null, appended: true };
}

// ═══════════════════════════════════════════════════════════════════════
// Whitelist Portal (dari company_config.allowed_emails, comma-separated)
// ═══════════════════════════════════════════════════════════════════════
function _crmWhitelistList_() {
  var cfg = getCompanyConfig();
  var raw = String(cfg.allowed_emails || '');
  return raw.split(',').map(function(e) { return e.trim().toLowerCase(); }).filter(Boolean);
}

function _crmWhitelistMutate_(op, params) {
  _crmRequireAdmin_(params);
  var email = String(params.email || '').trim().toLowerCase();
  if (!email || email.indexOf('@') === -1) return { success: false, message: 'Email invalid' };

  var current = _crmWhitelistList_();
  var before = current.slice();
  var next;

  if (op === 'add') {
    if (current.indexOf(email) !== -1) return { success: false, message: 'Email sudah di whitelist' };
    next = current.concat([email]);
  } else if (op === 'remove') {
    next = current.filter(function(e) { return e !== email; });
    if (next.length === current.length) return { success: false, message: 'Email tidak ada di whitelist' };
  } else {
    return { success: false, message: 'Unknown op' };
  }

  // Write balik ke company_config.allowed_emails
  _crmSetKV_('company_config', {
    user:  params.user,
    access_token: params.access_token || params.token || '',
    key:   'allowed_emails',
    value: next.join(','),
    description: 'Comma-separated emails yang boleh login portal',
  });
  _crmAuditWrite_(params, op, 'whitelist', email, before.join(','), next.join(','));
  return { success: true, op: op, email: email, whitelist: next };
}

function _crmWhitelistUpdate_(params) {
  _crmRequireAdmin_(params);
  var oldEmail = String(params.email     || '').trim().toLowerCase();
  var newEmail = String(params.new_email || '').trim().toLowerCase();
  if (!oldEmail || oldEmail.indexOf('@') === -1) return { success: false, message: 'Email lama invalid' };
  if (!newEmail || newEmail.indexOf('@') === -1) return { success: false, message: 'Email baru invalid' };
  if (oldEmail === newEmail) return { success: false, message: 'Email lama dan baru sama' };

  var current = _crmWhitelistList_();
  var before  = current.slice();
  var idx     = current.indexOf(oldEmail);
  if (idx === -1) return { success: false, message: 'Email lama tidak ada di whitelist' };
  if (current.indexOf(newEmail) !== -1) return { success: false, message: 'Email baru sudah ada di whitelist' };

  var next = current.slice();
  next[idx] = newEmail;

  _crmSetKV_('company_config', {
    user:  params.user,
    access_token: params.access_token || params.token || '',
    key:   'allowed_emails',
    value: next.join(','),
    description: 'Comma-separated emails yang boleh login portal',
  });
  _crmAuditWrite_(params, 'update', 'whitelist', oldEmail + ' → ' + newEmail, before.join(','), next.join(','));
  return { success: true, op: 'update', email: oldEmail, new_email: newEmail, whitelist: next };
}

// ═══════════════════════════════════════════════════════════════════════
// Audit log — durable Sheet trace + best-effort Supabase mirror.
// ═══════════════════════════════════════════════════════════════════════
function _crmAuditWrite_(params, action, targetType, targetKey, before, after) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('CRM_AUDIT_LOG');
  if (!sh) {
    sh = ss.insertSheet('CRM_AUDIT_LOG');
    sh.appendRow(['timestamp','actor_email','action','target_type','target_key','before','after','ip','user_agent']);
    sh.setFrozenRows(1);
  }
  var actorEmail = String(params._crm_actor_email || params.user || 'unknown');
  sh.appendRow([
    new Date(), actorEmail, action, targetType, targetKey,
    before === null ? '' : String(before), after === null ? '' : String(after),
    String(params.ip || ''), String(params.ua || ''),
  ]);

  // Best-effort mirror. Sheet logging must never be rolled back because the DB mirror is unavailable.
  try {
    _crmSbFetch_('POST', '/rest/v1/crm_audit_log', {
      actor_id: params._crm_actor_id || null,
      actor_email: actorEmail,
      action: String(action || 'unknown'),
      target_type: String(targetType || 'unknown'),
      target_key: targetKey == null ? null : String(targetKey),
      before: before === undefined ? null : before,
      after: after === undefined ? null : after,
      metadata: { source:'crm_gas', ip:String(params.ip || ''), user_agent:String(params.ua || '') },
      created_at: new Date().toISOString(),
    });
  } catch (mirrorErr) {
    console.warn('CRM audit Supabase mirror failed:', mirrorErr.message || mirrorErr);
  }
}

function _crmAuditTail_(limit) {
  // Canonical read: Supabase mirror first; Sheet remains durable fallback / operational trace.
  try {
    var sb = _crmSbFetch_('GET', '/rest/v1/crm_audit_log?select=created_at,actor_email,action,target_type,target_key,before,after&order=created_at.desc&limit=' + encodeURIComponent(limit));
    if (Array.isArray(sb) && sb.length) {
      return sb.map(function(r) {
        return { timestamp:r.created_at, actor_email:r.actor_email, action:r.action, target_type:r.target_type, target_key:r.target_key, before:r.before, after:r.after };
      });
    }
  } catch (err) { console.warn('CRM audit Supabase read failed, fallback Sheet:', err.message || err); }

  var sh = SpreadsheetApp.getActive().getSheetByName('CRM_AUDIT_LOG');
  if (!sh) return [];
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  var start = Math.max(2, lastRow - limit + 1);
  var rows = sh.getRange(start, 1, lastRow - start + 1, 9).getValues();
  return rows.reverse().map(function(r) {
    return { timestamp:r[0], actor_email:r[1], action:r[2], target_type:r[3], target_key:r[4], before:r[5], after:r[6] };
  });
}

// ═══════════════════════════════════════════════════════════════════════
// CRM role enforcement — actor derived from verified Supabase access token
// ═══════════════════════════════════════════════════════════════════════
function _crmRequireRole_(params, allowedRoles, mode) {
  params = params || {};
  var token = String(params.access_token || params.token || '').trim();
  if (!token) {
    var tokenErr = new Error('Session token diperlukan untuk ' + mode + ' CRM');
    tokenErr.code = 'TOKEN_REQUIRED';
    throw tokenErr;
  }

  var verified = authVerifyAccessToken(token);
  if (!verified.success) {
    var authErr = new Error(verified.message || 'Session tidak valid');
    authErr.code = verified.code || 'UNAUTHORIZED';
    throw authErr;
  }

  var role = String(verified.user && verified.user.role || '').toLowerCase();
  if (allowedRoles.indexOf(role) === -1) {
    var roleErr = new Error('Role ' + role + ' tidak boleh ' + mode + ' CRM');
    roleErr.code = 'ROLE_NOT_ALLOWED';
    throw roleErr;
  }

  // Canonical actor comes from the verified token, never from a caller-supplied email.
  params._crm_actor_email = String(verified.user.email || '');
  params._crm_actor_id = verified.user.id || null;
  params.user = params._crm_actor_email;
  params.actor_id = params._crm_actor_id;
  return verified.user;
}

function _crmRequireRead_(params) {
  return _crmRequireRole_(params, CRM_READ_ROLES, 'melihat');
}

function _crmRequireAdmin_(params) {
  return _crmRequireRole_(params, CRM_WRITE_ROLES, 'mengubah');
}

// ═══════════════════════════════════════════════════════════════════════
// JSON helper
// ═══════════════════════════════════════════════════════════════════════
function _crmJson(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════════════════════════════════
// Supabase REST helpers — pakai service_role dari Script Properties
// (bypass RLS, jadi role check dilakukan di sisi GAS via _crmRequireAdmin_).
// _getSupabaseConfig() ada di hrisLayer.js.
// ═══════════════════════════════════════════════════════════════════════
function _crmSbFetch_(method, path, body) {
  var cfg = _getSupabaseConfig();
  var opts = {
    method: method,
    headers: {
      'apikey':        cfg.key,
      'Authorization': 'Bearer ' + cfg.key,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
    },
    muteHttpExceptions: true,
  };
  if (body !== undefined && body !== null) opts.payload = JSON.stringify(body);
  var res = UrlFetchApp.fetch(cfg.url + path, opts);
  var code = res.getResponseCode();
  var txt  = res.getContentText();
  if (code >= 400) throw new Error('Supabase ' + method + ' ' + path + ' → ' + code + ': ' + txt.substring(0, 200));
  if (!txt) return null;
  try { return JSON.parse(txt); } catch (e) { return txt; }
}

// ═══════════════════════════════════════════════════════════════════════
// #3 System Config RAOS — Sheet canonical + server-side Supabase mirror
// ═══════════════════════════════════════════════════════════════════════
var RAOS_MASTER_SHEET_ID = '1eYS2mM3Sy-BNAVGfp8BUHtsZuLiGDetnJeGw-AWk__8';

function _crmSistemConfigList_(params) {
  _crmRequireRead_(params);
  var ss = SpreadsheetApp.openById(RAOS_MASTER_SHEET_ID);
  var sh = ss.getSheetByName('SISTEM CONFIG');
  if (!sh) return { success: false, message: 'Tab SISTEM CONFIG tidak ada di RAOS master' };
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return { success: true, config: [] };
  var rows = sh.getRange(2, 1, lastRow - 1, Math.min(3, sh.getLastColumn())).getValues();
  var out = rows.map(function(r) {
    return { key: String(r[0] || '').trim(), value: r[1] == null ? '' : String(r[1]), description: r[2] || '' };
  }).filter(function(r) { return !!r.key; });
  return { success: true, config: out };
}

function _crmSyncSystemConfigMirror_(key, value) {
  var existing = _crmSbFetch_('GET', '/rest/v1/system_config?key=eq.' + encodeURIComponent(key) + '&select=id');
  var body = { key: key, value: value, updated_at: new Date().toISOString() };
  if (Array.isArray(existing) && existing.length > 0) {
    _crmSbFetch_('PATCH', '/rest/v1/system_config?id=eq.' + encodeURIComponent(existing[0].id), body);
  } else {
    _crmSbFetch_('POST', '/rest/v1/system_config', body);
  }
}

function _crmSistemConfigSetSheet_(params) {
  _crmRequireAdmin_(params);
  var key   = String(params.key   || '').trim();
  var value = params.value == null ? '' : String(params.value);
  if (!key) return { success: false, message: 'Parameter key wajib' };

  try {
    var ss = SpreadsheetApp.openById(RAOS_MASTER_SHEET_ID);
    var sh = ss.getSheetByName('SISTEM CONFIG');
    if (!sh) return { success: false, message: 'Tab SISTEM CONFIG tidak ada di RAOS master' };
    var data = sh.getDataRange().getValues();
    var before = null;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === key) {
        before = data[i][1];
        sh.getRange(i + 1, 2).setValue(value);
        var mirrorWarning = null;
        try { _crmSyncSystemConfigMirror_(key, value); } catch (mirrorErr) { mirrorWarning = mirrorErr.message; }
        _crmAuditWrite_(params, 'edit', 'sistem_config_sheet', key, before, value);
        return { success: true, key: key, value: value, before: before, mirror_warning: mirrorWarning };
      }
    }
    sh.appendRow([key, value, '']);
    var appendMirrorWarning = null;
    try { _crmSyncSystemConfigMirror_(key, value); } catch (mirrorErr2) { appendMirrorWarning = mirrorErr2.message; }
    _crmAuditWrite_(params, 'add', 'sistem_config_sheet', key, null, value);
    return { success: true, key: key, value: value, appended: true, mirror_warning: appendMirrorWarning };
  } catch (err) {
    return { success: false, message: 'Sheet write gagal: ' + err.message };
  }
}

function _crmSistemConfigAudit_(params) {
  _crmRequireRead_(params);
  var sheetResult = _crmSistemConfigList_(params);
  if (!sheetResult.success) return sheetResult;
  var sheetRows = sheetResult.config || [];
  var sbRows = _crmSbFetch_('GET', '/rest/v1/system_config?select=key,value,updated_at&order=key.asc');
  if (!Array.isArray(sbRows)) sbRows = [];
  var sheetMap = {}, sbMap = {};
  sheetRows.forEach(function(r) { sheetMap[String(r.key)] = String(r.value == null ? '' : r.value); });
  sbRows.forEach(function(r) { sbMap[String(r.key)] = String(r.value == null ? '' : r.value); });
  var missing = [], mismatched = [], extra = [];
  Object.keys(sheetMap).forEach(function(key) {
    if (!Object.prototype.hasOwnProperty.call(sbMap, key)) missing.push(key);
    else if (sheetMap[key] !== sbMap[key]) mismatched.push({ key:key, sheet:sheetMap[key], supabase:sbMap[key] });
  });
  Object.keys(sbMap).forEach(function(key) {
    if (!Object.prototype.hasOwnProperty.call(sheetMap, key)) extra.push(key);
  });
  return {
    success: true,
    healthy: missing.length === 0 && mismatched.length === 0,
    sheet_count: sheetRows.length,
    supabase_count: sbRows.length,
    missing_in_supabase: missing,
    mismatched: mismatched,
    extra_in_supabase: extra,
  };
}

function _crmSistemConfigSyncAll_(params) {
  _crmRequireAdmin_(params);
  var sheetResult = _crmSistemConfigList_(params);
  if (!sheetResult.success) return sheetResult;
  var rows = sheetResult.config || [];
  var synced = 0, failed = [];
  rows.forEach(function(r) {
    try { _crmSyncSystemConfigMirror_(r.key, r.value); synced++; }
    catch (e) { failed.push({ key:r.key, message:e.message || String(e) }); }
  });
  _crmAuditWrite_(params, 'sync_all', 'sistem_config', 'sheet_to_supabase', '',
    'synced=' + synced + '; failed=' + failed.length);
  return { success: failed.length === 0, synced: synced, failed: failed, total: rows.length };
}

// ═══════════════════════════════════════════════════════════════════════
// #4 User Supabase RAOS — proxy ke Supabase (bypass RLS via service_role)
// ═══════════════════════════════════════════════════════════════════════
function _crmRaosUsersList_(params) {
  _crmRequireRead_(params);
  // Fetch user_profiles + email dari auth.users via paginate admin API
  var profiles = _crmSbFetch_('GET', '/rest/v1/user_profiles?select=id,staff_id,full_name,role,branch_id,is_active,phone,source,ssot_synced_at&order=full_name.asc');
  if (!Array.isArray(profiles)) profiles = [];

  // Ambil email map dari auth admin users. Single fetch per_page=1000
  // (cukup untuk skala RIFIM saat ini, ~50-100 user). Pagination
  // sebelumnya (10 × 200) bikin GAS UrlFetchApp throttled → HTML error.
  var emailMap = {};
  try {
    var res = _crmSbFetch_('GET', '/auth/v1/admin/users?page=1&per_page=1000');
    var users = (res && res.users) || [];
    for (var i = 0; i < users.length; i++) emailMap[users[i].id] = users[i].email || '';
  } catch (_) { /* email optional — fallback kosong kalau admin API throttled */ }

  // Ambil branch mapping (id → name)
  var branchMap = {};
  try {
    var branches = _crmSbFetch_('GET', '/rest/v1/branches?select=id,name,slug');
    if (Array.isArray(branches)) {
      for (var j = 0; j < branches.length; j++) branchMap[branches[j].id] = branches[j];
    }
  } catch (_) { /* branches optional */ }

  var out = profiles.map(function(p) {
    var b = p.branch_id ? branchMap[p.branch_id] : null;
    return {
      id:              p.id,
      email:           emailMap[p.id] || '',
      staff_id:        p.staff_id || '',
      full_name:       p.full_name || '',
      role:            p.role || '',
      is_active:       p.is_active,
      phone:           p.phone || '',
      source:          p.source || '',
      branch_id:       p.branch_id || null,
      branch_name:     b ? b.name : '',
      branch_slug:     b ? b.slug : '',
      ssot_synced_at:  p.ssot_synced_at || null,
    };
  });
  return { success: true, users: out, total: out.length };
}

function _crmRaosUsersUpdate_(params) {
  _crmRequireAdmin_(params);
  var id = String(params.id || '').trim();
  if (!id) return { success: false, message: 'Parameter id wajib' };

  var before = _crmSbFetch_('GET', '/rest/v1/user_profiles?id=eq.' + encodeURIComponent(id) + '&select=*');
  if (!Array.isArray(before) || before.length === 0) return { success: false, message: 'User tidak ditemukan' };
  var current = before[0];
  var source = String(current.source || '');
  var isSsotManaged = source.indexOf('ssot_') === 0;

  var patch = {};
  // branch_id memang field operasional RAOS dan sengaja dipertahankan oleh
  // sync Staff/Driver. Karena itu field ini boleh dikelola dari CRM.
  if (params.branch_id !== undefined) {
    patch.branch_id = params.branch_id === 'null' || params.branch_id === '' ? null : params.branch_id;
  }
  if (!isSsotManaged) {
    if (params.role      !== undefined) patch.role      = String(params.role).toLowerCase();
    if (params.is_active !== undefined) patch.is_active = String(params.is_active) === 'true';
    if (params.full_name !== undefined) patch.full_name = String(params.full_name);
    if (params.phone     !== undefined) patch.phone     = String(params.phone);
  }
  if (Object.keys(patch).length === 0) {
    return { success: false, code: 'SSOT_MANAGED', message: isSsotManaged
      ? 'Akun ini dikelola SSOT. Dari CRM hanya Cabang RAOS yang boleh diubah.'
      : 'Tidak ada field yang di-update' };
  }

  var res = _crmSbFetch_('PATCH', '/rest/v1/user_profiles?id=eq.' + encodeURIComponent(id), patch);
  _crmAuditWrite_(params, 'edit', 'raos_user', id, JSON.stringify(current).substring(0, 200), JSON.stringify(patch));
  return {
    success: true,
    user: (Array.isArray(res) && res[0]) || null,
    ssot_managed: isSsotManaged,
    message: isSsotManaged ? 'Cabang RAOS diperbarui. Identitas tetap mengikuti SSOT.' : 'User diperbarui.'
  };
}

function _crmRaosUsersResetPin_(params) {
  _crmRequireAdmin_(params);
  var id  = String(params.id || '').trim();
  var pin = String(params.pin || '').trim();
  if (!id) return { success: false, message: 'Parameter id wajib' };
  if (!/^\d{6,}$/.test(pin)) return { success: false, message: 'Password harus minimal 6 digit angka' };

  var profileRows = _crmSbFetch_('GET', '/rest/v1/user_profiles?id=eq.' + encodeURIComponent(id) + '&select=id,source,role');
  if (!Array.isArray(profileRows) || !profileRows.length) return { success:false, message:'User tidak ditemukan' };
  var profile = profileRows[0];
  if (String(profile.source || '').indexOf('ssot_') === 0) {
    return { success:false, code:'SSOT_MANAGED', message:'Password Auth akun SSOT tidak boleh diubah dari CRM. Staff gunakan PIN RAOS; Driver mengikuti ID Driver.' };
  }

  var res = _crmSbFetch_('PUT', '/auth/v1/admin/users/' + encodeURIComponent(id), { password: pin });
  _crmAuditWrite_(params, 'reset_auth_password', 'raos_user_manual', id, '', 'Password manual direset (' + pin.length + ' digit)');
  return { success: true, id: id, email: (res && res.email) || '' };
}

// ═══════════════════════════════════════════════════════════════════════
// RAOS PIN — tabel raos_credentials. Dedicated credential untuk Portal + PWA RAOS;
// terpisah dari PIN legacy/SSOT yang dipakai aplikasi lain.
// PIN plaintext untuk MVP; migrate ke bcrypt kalau sudah stabil.
// ═══════════════════════════════════════════════════════════════════════
function _crmRaosCredentialsList_(params) {
  _crmRequireAdmin_(params);
  var rows = _crmSbFetch_('GET', '/rest/v1/raos_credentials?select=user_id,raos_staff_code,updated_at,ssot_pin');
  if (!Array.isArray(rows)) rows = [];
  var out = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    out[r.user_id] = {
      has_raos_pin:    true,          // NOT NULL di skema — kalau row ada, pasti punya PIN
      staff_code:      r.raos_staff_code || '',
      updated_at:      r.updated_at || null,
      has_ssot_pin:    !!r.ssot_pin,
    };
  }
  return { success: true, credentials: out, total: rows.length };
}

function _crmRaosCredentialsResetPin_(params) {
  _crmRequireAdmin_(params);
  var id  = String(params.id || '').trim();
  var pin = String(params.pin || '').trim();
  if (!id) return { success: false, message: 'Parameter id wajib' };
  if (!/^\d{6,}$/.test(pin)) return { success: false, message: 'PIN Portal harus minimal 6 digit angka' };
  var actorId = String(params.actor_id || params._crm_actor_id || '').trim();
  if (!actorId) return { success: false, message: 'Actor terverifikasi tidak ditemukan' };

  var res = _crmSbFetch_('POST', '/rest/v1/rpc/raos_admin_reset_login_secret', {
    p_user_id: id,
    p_new_pin: pin,
    p_actor_id: actorId,
  });
  if (!res || res.ok !== true) return { success: false, message: 'Reset PIN Portal gagal' };

  _crmAuditWrite_(params, 'reset_portal_pin', 'raos_credentials', id, '',
    'PIN Portal direset via bcrypt RPC (' + pin.length + ' digit)');
  return { success: true, id: id };
}

// ═══════════════════════════════════════════════════════════════════════
// SSOT PIN update — edit kolom H (Pin) sheet MASTER DATA STAFF untuk staff
// tertentu (by ID Staff / RIF****). Sinkron ke Supabase Auth password
// terjadi di sync cycle berikutnya (max 6 jam) atau via Force Refresh
// Staff Auth di /sistem.
// Kolom sheet (0-based): E(4)=ID Staff · H(7)=Pin
// ═══════════════════════════════════════════════════════════════════════
var MASTER_STAFF_SHEET_ID = '1fcraq3QHqIaD-13Ebzt6stT9aA6j_loTXeAtpNX12kw';
var MASTER_STAFF_TAB_NAME = 'MASTER DATA STAFF';

function _crmRaosSsotPinUpdate_(params) {
  _crmRequireAdmin_(params);
  var staffCode = String(params.staff_id || '').trim();  // RIF****
  var pin       = String(params.pin || '').trim();
  if (!staffCode) return { success: false, message: 'Parameter staff_id wajib' };
  if (!/^\d{6,}$/.test(pin)) return { success: false, message: 'PIN SSOT harus minimal 6 digit angka' };

  try {
    var ss = SpreadsheetApp.openById(MASTER_STAFF_SHEET_ID);
    var sh = ss.getSheetByName(MASTER_STAFF_TAB_NAME);
    if (!sh) return { success: false, message: 'Tab "' + MASTER_STAFF_TAB_NAME + '" tidak ada' };

    var lastRow = sh.getLastRow();
    if (lastRow < 2) return { success: false, message: 'Sheet kosong' };

    // Cari row by kolom E (index 4 = kolom 5 di 1-based)
    var idCol = sh.getRange(2, 5, lastRow - 1, 1).getValues();
    var rowIndex = -1;
    for (var i = 0; i < idCol.length; i++) {
      if (String(idCol[i][0] || '').trim().toUpperCase() === staffCode.toUpperCase()) {
        rowIndex = i + 2;  // 1-based + skip header
        break;
      }
    }
    if (rowIndex === -1) return { success: false, message: 'ID Staff ' + staffCode + ' tidak ditemukan di sheet SSOT' };

    // Set kolom H (8 di 1-based)
    var pinCell = sh.getRange(rowIndex, 8);
    var before = pinCell.getValue();
    pinCell.setValue(pin);

    // Sync juga ke raos_credentials.ssot_pin supaya bridge login Portal langsung akurat
    // (raos_verify_and_bridge return message "sync ulang dari GAS" kalau ssot_pin NULL).
    // Optional: skip kalau raos_credentials row belum ada.
    try {
      // Lookup user_id dari user_profiles by staff_id
      var profiles = _crmSbFetch_('GET', '/rest/v1/user_profiles?staff_id=eq.' + encodeURIComponent(staffCode) + '&select=id');
      if (Array.isArray(profiles) && profiles.length > 0) {
        var uid = profiles[0].id;
        var existing = _crmSbFetch_('GET', '/rest/v1/raos_credentials?user_id=eq.' + encodeURIComponent(uid) + '&select=user_id');
        if (Array.isArray(existing) && existing.length > 0) {
          _crmSbFetch_('PATCH', '/rest/v1/raos_credentials?user_id=eq.' + encodeURIComponent(uid),
            { ssot_pin: pin, updated_at: new Date().toISOString() });
        }
      }
    } catch (_) { /* best effort, non-fatal */ }

    _crmAuditWrite_(params, 'update_ssot_pin', 'sheet_master_staff', staffCode,
      before ? '(hidden)' : '(empty)', 'PIN diupdate (' + pin.length + ' digit) row ' + rowIndex);
    return {
      success: true,
      staff_id: staffCode,
      row: rowIndex,
      note: 'PIN sheet SSOT diupdate. Supabase Auth password akan sync di cycle berikutnya (max 6 jam) atau klik "Force Refresh Staff Auth" di /sistem untuk propagate segera.'
    };
  } catch (err) {
    return { success: false, message: 'Sheet write gagal: ' + err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// #5 CRM Kontak Eksternal — tabel Supabase crm_contacts
// ═══════════════════════════════════════════════════════════════════════
function _crmContactsList_(params) {
  _crmRequireRead_(params);
  var qs = 'select=*&order=updated_at.desc';
  if (params.category && params.category !== '') qs += '&category=eq.' + encodeURIComponent(params.category);
  if (params.search   && params.search   !== '') {
    // ilike di name/company/email
    var s = '%' + String(params.search).trim() + '%';
    qs += '&or=(name.ilike.' + encodeURIComponent(s) + ',company.ilike.' + encodeURIComponent(s) + ',email.ilike.' + encodeURIComponent(s) + ')';
  }
  var rows = _crmSbFetch_('GET', '/rest/v1/crm_contacts?' + qs);
  return { success: true, contacts: Array.isArray(rows) ? rows : [], total: Array.isArray(rows) ? rows.length : 0 };
}

function _crmContactsUpsert_(params) {
  _crmRequireAdmin_(params);
  var id = params.id ? String(params.id).trim() : '';

  // Sparse body — hanya include field yg explicit di params (mirror pattern
  // raos_users_update). Cegah PATCH tidak sengaja meng-nullify field yang
  // user tidak sentuh saat edit via API (mis. curl kirim id+name+notes saja).
  var body = {};
  if (params.name     !== undefined) body.name     = String(params.name).trim();
  if (params.email    !== undefined) body.email    = params.email    ? String(params.email).trim().toLowerCase() : null;
  if (params.phone    !== undefined) body.phone    = params.phone    ? String(params.phone).trim() : null;
  if (params.company  !== undefined) body.company  = params.company  ? String(params.company).trim() : null;
  if (params.category !== undefined) body.category = params.category ? String(params.category).trim() : 'lainnya';
  if (params.notes    !== undefined) body.notes    = params.notes    ? String(params.notes) : null;
  if (params.tags     !== undefined) body.tags     = String(params.tags).split(',').map(function(t) { return t.trim(); }).filter(Boolean);

  var res, action;
  if (id) {
    if (Object.keys(body).length === 0) return { success: false, message: 'Tidak ada field yang di-update' };
    res = _crmSbFetch_('PATCH', '/rest/v1/crm_contacts?id=eq.' + encodeURIComponent(id), body);
    action = 'edit';
  } else {
    // CREATE — nama wajib. created_by biarkan NULL (kolom uuid FK ke
    // user_profiles dari migration crm_066; GAS proxy pakai service_role
    // tidak punya lookup aktor-email → user_profiles.id). Aktor tetap
    // tercatat lengkap di CRM_AUDIT_LOG (sheet + audit table).
    if (!body.name) return { success: false, message: 'Nama wajib diisi' };
    res = _crmSbFetch_('POST', '/rest/v1/crm_contacts', body);
    action = 'add';
  }
  var row = Array.isArray(res) ? res[0] : res;
  var auditName = (row && row.name) || body.name || '';
  _crmAuditWrite_(params, action, 'contact', (row && row.id) || id || auditName,
    id ? auditName : '', auditName);
  return { success: true, contact: row };
}

function _crmContactsDelete_(params) {
  _crmRequireAdmin_(params);
  var id = String(params.id || '').trim();
  if (!id) return { success: false, message: 'Parameter id wajib' };

  var before = _crmSbFetch_('GET', '/rest/v1/crm_contacts?id=eq.' + encodeURIComponent(id) + '&select=name');
  var name = (Array.isArray(before) && before[0] && before[0].name) || '';
  _crmSbFetch_('DELETE', '/rest/v1/crm_contacts?id=eq.' + encodeURIComponent(id));
  _crmAuditWrite_(params, 'remove', 'contact', id, name, '');
  return { success: true, id: id };
}

// ═══════════════════════════════════════════════════════════════════════
// FINANCE MODULE — 9 endpoint yg baca/tulis spreadsheet Finance RIFIM
// (1AgpEqhpDU4B..., sheet LIA/Tagihan/TABEL HARIAN/TABEL BULANAN/SYSTEM LOG
// + 10 tab per-cabang). Semua read+write pakai SpreadsheetApp.openById()
// dengan cache 60s untuk data set besar (LIA 470+ rows).
// ═══════════════════════════════════════════════════════════════════════
var FINANCE_SHEET_ID = '1AgpEqhpDU4BUxcN_i_jaF8Ccw6RwptV2TOJjyTCVPSo';
var FIN_CABANG_LIST = [
  'Operasional','ID Rifim Airport Batam','ID Rifim Airport Pekanbaru','ID Rifim Airport Manado',
  'ID Rifim Airport Balikpapan','ID Rifim Airport Jambi','ID Rifim Airport Makassar',
  'ID Rifim Batam','ID Rifim Jambi','ID Rifim Jambi Luar','ID Massage Batam/Jakarta',
];

function _finOpen_() { return SpreadsheetApp.openById(FINANCE_SHEET_ID); }

function _finRead_(sheetName, opts) {
  var ss = _finOpen_();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Tab "' + sheetName + '" tidak ada di Finance sheet');
  var last = sh.getLastRow();
  if (last < 2) return { headers: [], rows: [] };
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || '').trim(); });
  var rows = sh.getRange(2, 1, last - 1, lastCol).getValues();
  return { headers: headers, rows: rows };
}

function _finRowToObj_(headers, row) {
  var o = {};
  for (var i = 0; i < headers.length; i++) o[headers[i] || ('col' + i)] = row[i];
  return o;
}

function _finRoleGate_(params) {
  var email = String(params.user || '').toLowerCase().trim();
  if (!email) throw new Error('Parameter user (email) wajib');
  var verified = authVerifyUser(email);
  if (!verified.success) throw new Error('Email ' + email + ' tidak diizinkan');
  var role = String(verified.user && verified.user.role || '').toLowerCase();
  if (['admin','management','direksi','direktur'].indexOf(role) === -1) {
    throw new Error('Role ' + role + ' tidak boleh akses Finance (perlu admin/mgmt/direksi)');
  }
  return verified.user;
}

// ─── Dashboard: LIA master ledger, filter tanggal/jenis/cabang/search
function _finLedgerList_(params) {
  _finRoleGate_(params);
  var data = _finRead_('LIA');
  var from  = params.from ? new Date(params.from + 'T00:00:00+07:00').getTime() : 0;
  var to    = params.to   ? new Date(params.to   + 'T23:59:59+07:00').getTime() : Infinity;
  var jenis = String(params.jenis || '').toLowerCase();
  var cabang = String(params.cabang || '');
  var search = String(params.search || '').toLowerCase();

  var out = [];
  for (var i = 0; i < data.rows.length; i++) {
    var o = _finRowToObj_(data.headers, data.rows[i]);
    var ts = o.Timestamp ? new Date(o.Timestamp).getTime() : 0;
    if (ts < from || ts > to) continue;
    if (cabang && String(o.Cabang || '') !== cabang) continue;
    var isPemasukan = Number(o.Pemasukan) > 0;
    var isPengeluaran = Number(o.Pengeluaran) > 0;
    if (jenis === 'pemasukan' && !isPemasukan) continue;
    if (jenis === 'pengeluaran' && !isPengeluaran) continue;
    if (search) {
      var hay = (String(o.Keterangan || '') + ' ' + String(o['Nama Staff (Kasbon)'] || o['Nama Staff'] || '') + ' ' + String(o.Email || '')).toLowerCase();
      if (hay.indexOf(search) === -1) continue;
    }
    out.push({
      timestamp:  o.Timestamp,
      email:      o.Email,
      pemasukan:  Number(o.Pemasukan) || 0,
      pengeluaran:Number(o.Pengeluaran) || 0,
      cabang:     o.Cabang || '',
      keterangan: o.Keterangan || '',
      bukti_foto: o['Bukti Foto'] || '',
      nama_staff: o['Nama Staff (Kasbon)'] || o['Nama Staff'] || '',
    });
  }
  // Sort terbaru dulu
  out.sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
  // Optional pagination
  var limit  = parseInt(params.limit)  || 200;
  var offset = parseInt(params.offset) || 0;
  return { success: true, total: out.length, rows: out.slice(offset, offset + limit) };
}

// ─── Cabang: sheet per cabang (nama tab = nama cabang persis)
function _finCabangList_(params) {
  _finRoleGate_(params);
  var sheet = String(params.sheet || '');
  if (!sheet) return { success: false, message: 'Parameter sheet (nama cabang) wajib' };
  var data = _finRead_(sheet);
  var search = String(params.search || '').toLowerCase();
  var out = [];
  var saldo = 0;
  for (var i = 0; i < data.rows.length; i++) {
    var o = _finRowToObj_(data.headers, data.rows[i]);
    var pemas = Number(o.Pemasukan) || 0;
    var penge = Number(o.Pengeluaran) || 0;
    saldo += pemas - penge;
    if (search) {
      var hay = (String(o.Keterangan || '') + ' ' + String(o['Nama Staff (Kasbon)'] || o['Nama Staff'] || '')).toLowerCase();
      if (hay.indexOf(search) === -1) continue;
    }
    out.push({
      timestamp:  o.Timestamp,
      pemasukan:  pemas,
      pengeluaran:penge,
      saldo:      saldo,
      keterangan: o.Keterangan || '',
      nama_staff: o['Nama Staff (Kasbon)'] || o['Nama Staff'] || '',
    });
  }
  out.reverse(); // terbaru dulu
  return { success: true, cabang: sheet, total: out.length, rows: out };
}

// ─── Tagihan
function _finTagihanList_(params) {
  _finRoleGate_(params);
  var data = _finRead_('Tagihan');
  var status = String(params.status || '').toLowerCase();
  var bulan  = String(params.bulan  || '');
  var search = String(params.search || '').toLowerCase();
  var out = [];
  for (var i = 0; i < data.rows.length; i++) {
    var o = _finRowToObj_(data.headers, data.rows[i]);
    var noTag = String(o['No Tagihan'] || o['No.Tagihan'] || '').trim();
    var instansi = String(o.Instansi || '').trim();
    if (!noTag && !instansi) continue;
    var tglBayar = o['Tanggal Bayar'] || o['Tgl Bayar'] || '';
    var jumlah = Number(o.Jumlah) || 0;
    var isPaid = !!tglBayar;
    var st = isPaid ? 'sudah_bayar' : 'belum_bayar';
    if (status === 'sudah_bayar' && !isPaid) continue;
    if (status === 'belum_bayar' && isPaid) continue;
    if (bulan && String(o.Bulan || '') !== bulan) continue;
    if (search) {
      var hay = (noTag + ' ' + instansi + ' ' + String(o.Jenis || '')).toLowerCase();
      if (hay.indexOf(search) === -1) continue;
    }
    out.push({
      row_index:  i + 2, // 1-index + header
      no_tagihan: noTag,
      instansi:   instansi,
      jenis:      o.Jenis || '',
      bulan:      o.Bulan || '',
      jumlah:     jumlah,
      no_rekening:o['No Rekening'] || o['No.Rekening'] || '',
      tgl_bayar:  tglBayar,
      status:     st,
    });
  }
  return { success: true, total: out.length, rows: out };
}

function _finTagihanAdd_(params) {
  _finRoleGate_(params);
  var body = {
    Jenis:        String(params.jenis || '').trim(),
    'No Tagihan': String(params.no_tagihan || '').trim(),
    Instansi:     String(params.instansi || '').trim(),
    Bulan:        String(params.bulan || '').trim(),
    Jumlah:       Number(params.jumlah) || 0,
    'No Rekening':String(params.no_rekening || '').trim(),
  };
  if (!body.Instansi || !body['No Tagihan']) return { success: false, message: 'no_tagihan + instansi wajib' };

  var ss = _finOpen_();
  var sh = ss.getSheetByName('New Tagihan') || ss.getSheetByName('Tagihan');
  if (!sh) return { success: false, message: 'Tab New Tagihan / Tagihan tidak ada' };
  var last = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || '').trim(); });
  var row = headers.map(function(h) { return body[h] !== undefined ? body[h] : ''; });
  sh.appendRow(row);
  _crmAuditWrite_(params, 'add', 'tagihan', body['No Tagihan'], null, body.Instansi + ' · ' + body.Jumlah);
  return { success: true, no_tagihan: body['No Tagihan'], row: last + 1 };
}

function _finTagihanMarkPaid_(params) {
  _finRoleGate_(params);
  var noTag = String(params.no_tagihan || '').trim();
  if (!noTag) return { success: false, message: 'Parameter no_tagihan wajib' };
  var tglBayar = String(params.tgl_bayar || Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd')).trim();

  var ss = _finOpen_();
  var sh = ss.getSheetByName('Tagihan');
  if (!sh) return { success: false, message: 'Tab Tagihan tidak ada' };
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || '').trim(); });
  var idxNo    = headers.indexOf('No Tagihan');    if (idxNo < 0) idxNo = headers.indexOf('No.Tagihan');
  var idxBayar = headers.indexOf('Tanggal Bayar'); if (idxBayar < 0) idxBayar = headers.indexOf('Tgl Bayar');
  if (idxNo < 0 || idxBayar < 0) return { success: false, message: 'Kolom No Tagihan / Tanggal Bayar tidak ditemukan' };
  var data = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][idxNo]).trim() === noTag) {
      sh.getRange(i + 2, idxBayar + 1).setValue(tglBayar);
      _crmAuditWrite_(params, 'mark_paid', 'tagihan', noTag, '', tglBayar);
      return { success: true, no_tagihan: noTag, tgl_bayar: tglBayar, row: i + 2 };
    }
  }
  return { success: false, message: 'No Tagihan ' + noTag + ' tidak ditemukan' };
}

// ─── Rekap (parse pivot tabel jadi array)
function _finRekapHarian_(params) {
  _finRoleGate_(params);
  var ss = _finOpen_();
  var sh = ss.getSheetByName('TABEL HARIAN');
  if (!sh) return { success: false, message: 'Tab TABEL HARIAN tidak ada' };
  var last = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  var raw = sh.getRange(1, 1, last, lastCol).getValues();
  return { success: true, headers_row_1: raw[0], rows_from_2: raw.slice(1) };
}

function _finRekapBulanan_(params) {
  _finRoleGate_(params);
  var ss = _finOpen_();
  var sh = ss.getSheetByName('TABEL BULANAN');
  if (!sh) return { success: false, message: 'Tab TABEL BULANAN tidak ada' };
  var last = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  var raw = sh.getRange(1, 1, last, lastCol).getValues();
  return { success: true, headers_row_1: raw[0], rows_from_2: raw.slice(1) };
}

// ─── System Log
function _finLogList_(params) {
  _finRoleGate_(params);
  var data = _finRead_('SYSTEM LOG');
  var status = String(params.status || '').toUpperCase();
  var search = String(params.search || '').toLowerCase();
  var limit  = parseInt(params.limit) || 200;

  var out = [];
  for (var i = data.rows.length - 1; i >= 0 && out.length < limit; i--) {
    var o = _finRowToObj_(data.headers, data.rows[i]);
    var st = String(o.Status || '').toUpperCase();
    if (status && st !== status) continue;
    if (search) {
      var hay = (String(o.Fungsi || '') + ' ' + String(o.Pesan || '')).toLowerCase();
      if (hay.indexOf(search) === -1) continue;
    }
    out.push({
      tanggal: o.Tanggal,
      jam:     o.Jam,
      fungsi:  o.Fungsi || '',
      status:  st,
      pesan:   o.Pesan || '',
    });
  }
  return { success: true, total: out.length, rows: out };
}

// ─── Saldo RAOS (proxy Supabase raos_saldo_requests, bypass RLS via service_role)
function _finSaldoRaosList_(params) {
  _finSaldoTokenGate_(params);
  var qs = 'select=id,staff_id,branch_id,nominal,status,is_processed,processed_at,processed_by,created_at,driver_id,driver_login_id,driver_name&order=created_at.desc&limit=200';
  var status = String(params.status || '');
  var branchId = String(params.branch_id || '');
  if (status === 'pending')   qs += '&is_processed=eq.false&status=eq.pending';
  if (status === 'approved')  qs += '&is_processed=eq.false&status=eq.approved';
  if (status === 'paid')      qs += '&is_processed=eq.true';
  if (status === 'rejected')  qs += '&status=eq.rejected';
  if (branchId) qs += '&branch_id=eq.' + encodeURIComponent(branchId);

  var rows = _crmSbFetch_('GET', '/rest/v1/raos_saldo_requests?' + qs);
  if (!Array.isArray(rows)) rows = [];

  // Enrich dengan nama staff & driver & cabang
  var staffIds = {}, branchIds = {};
  rows.forEach(function(r) {
    if (r.staff_id)  staffIds[r.staff_id] = true;
    if (r.branch_id) branchIds[r.branch_id] = true;
  });
  var staffMap = {}, branchMap = {};
  if (Object.keys(staffIds).length) {
    var ids = Object.keys(staffIds).map(function(x) { return encodeURIComponent(x); }).join(',');
    try {
      var ss = _crmSbFetch_('GET', '/rest/v1/user_profiles?select=id,full_name,staff_id&id=in.(' + ids + ')');
      (ss || []).forEach(function(u) { staffMap[u.id] = u; });
    } catch (_) {}
  }
  if (Object.keys(branchIds).length) {
    var bids = Object.keys(branchIds).map(function(x) { return encodeURIComponent(x); }).join(',');
    try {
      var bb = _crmSbFetch_('GET', '/rest/v1/branches?select=id,name,slug&id=in.(' + bids + ')');
      (bb || []).forEach(function(b) { branchMap[b.id] = b; });
    } catch (_) {}
  }

  var out = rows.map(function(r) {
    var s = r.staff_id  ? staffMap[r.staff_id]  : null;
    var b = r.branch_id ? branchMap[r.branch_id]: null;
    return {
      id:            r.id,
      staff_name:    s ? s.full_name : '',
      staff_code:    s ? s.staff_id : '',
      branch_name:   b ? b.name : '',
      branch_slug:   b ? b.slug : '',
      nominal:       Number(r.nominal) || 0,
      status:        r.status,
      is_processed:  r.is_processed,
      processed_at:  r.processed_at,
      processed_by:  r.processed_by,
      created_at:    r.created_at,
      driver_id:     r.driver_id || null,
      driver_login_id: r.driver_login_id || '',
      driver_login:  r.driver_login_id || '',
      driver_name:   r.driver_name || '',
    };
  });
  return { success: true, total: out.length, rows: out };
}

function _finSaldoRaosMarkPaid_(params) {
  var actor = _finSaldoTokenGate_(params);
  var id = String(params.id || '').trim();
  if (!id) return { success: false, code: 'INVALID_INPUT', message: 'Parameter id wajib' };
  if (!actor.id) return { success: false, code: 'PROCESSOR_NOT_FOUND', message: 'UUID processor tidak ditemukan.' };

  var result = _crmSbFetch_('POST', '/rest/v1/rpc/raos_saldo_mark_paid', {
    p_request_id: id,
    p_processor_id: actor.id,
  });
  var status = result && result.status;
  if (['updated', 'already_processed', 'not_approved', 'not_found'].indexOf(status) === -1) {
    return { success: false, code: 'RPC_RESPONSE_INVALID', message: 'Response mark-paid tidak valid.' };
  }
  if (status === 'updated') {
    var auditParams = { user: actor.email || actor.id };
    _crmAuditWrite_(auditParams, 'mark_paid', 'saldo_raos', id, '', 'Lunas oleh ' + (actor.email || actor.id));
  }
  return {
    success: status === 'updated' || status === 'already_processed',
    status: status,
    code: status === 'not_approved' ? 'NOT_APPROVED' : (status === 'not_found' ? 'NOT_FOUND' : null),
    current_status: result.current_status || null,
    row: result.row || null,
    message: status === 'already_processed' ? 'Pengajuan sudah pernah diproses.' :
      (status === 'not_approved' ? 'Pengajuan belum approved.' :
      (status === 'not_found' ? 'Pengajuan tidak ditemukan.' : 'Pengajuan ditandai lunas.')),
  };
}

function _finSaldoTokenGate_(params) {
  var verified = authVerifyAccessToken(params && (params.access_token || params.token));
  if (!verified.success) {
    var authErr = new Error(verified.message || 'Unauthorized');
    authErr.code = verified.code || 'UNAUTHORIZED';
    throw authErr;
  }
  var role = String(verified.user && verified.user.role || '').toLowerCase();
  if (['admin', 'management', 'direksi', 'direktur'].indexOf(role) === -1) {
    var roleErr = new Error('Role ' + role + ' tidak boleh akses Finance.');
    roleErr.code = 'ROLE_NOT_ALLOWED';
    throw roleErr;
  }
  return verified.user;
}

// ═══════════════════════════════════════════════════════════════════════
// KPI Targets V2 + Payroll (raos_070, sesi 2026-08-04 lanjutan)
// Data source: Supabase raos_kpi_targets_branch/staff, raos_payroll,
// view raos_target_tercapai_bulan, RPC raos_compute_payroll_month
// ═══════════════════════════════════════════════════════════════════════

// Helper: normalize p_month = 'YYYY-MM' or 'YYYY-MM-01' → 'YYYY-MM-01'
function _finMonthNorm_(m) {
  var s = String(m || '').trim();
  if (!s) {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
  }
  if (/^\d{4}-\d{2}$/.test(s)) return s + '-01';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.substring(0, 7) + '-01';
  throw new Error('Format bulan invalid: ' + s + ' (harus YYYY-MM atau YYYY-MM-01)');
}

// ─── Target Cabang: list per bulan (join branches)
function _finKpiTargetBranchList_(params) {
  _finRoleGate_(params);
  var month = _finMonthNorm_(params.month);

  var branches = _crmSbFetch_('GET', '/rest/v1/branches?select=id,name,slug&order=name.asc');
  if (!Array.isArray(branches)) branches = [];

  var rows = _crmSbFetch_('GET', '/rest/v1/raos_kpi_targets_branch?select=id,branch_id,target_cabang,target_staff_default,mode,updated_at&effective_month=eq.' + encodeURIComponent(month));
  if (!Array.isArray(rows)) rows = [];

  var byBranch = {};
  rows.forEach(function(r) { byBranch[r.branch_id] = r; });

  // Poin 10 (2026-08-07): count staff aktif per cabang untuk auto-prorate.
  var allStaffLite = _crmSbFetch_('GET', '/rest/v1/user_profiles?select=branch_id&is_active=eq.true&role=in.(staff,koordinator)');
  var staffCountByBranch = {};
  (allStaffLite || []).forEach(function(s) {
    if (!s.branch_id) return;
    staffCountByBranch[s.branch_id] = (staffCountByBranch[s.branch_id] || 0) + 1;
  });

  var out = branches.map(function(b) {
    var t = byBranch[b.id] || {};
    var slugLower = String(b.slug || '').toLowerCase();
    var isExcluded = /soeta|makassar/.test(slugLower);
    var targetCabang = Number(t.target_cabang) || 0;
    var branchDefault = t.target_staff_default != null ? Number(t.target_staff_default) : null;
    var staffCount = staffCountByBranch[b.id] || 0;
    var autoProrated = null;
    if (branchDefault == null && targetCabang > 0 && staffCount > 0) {
      autoProrated = Math.round(targetCabang / staffCount);
    }
    return {
      branch_id: b.id,
      branch_name: b.name,
      branch_slug: b.slug,
      is_excluded_saldo: isExcluded,
      target_cabang: targetCabang,
      target_staff_default: branchDefault,
      target_staff_effective: branchDefault != null ? branchDefault : autoProrated,
      target_staff_auto_prorated: autoProrated,
      staff_count: staffCount,
      mode: t.mode || (isExcluded ? 'order' : 'saldo'),
      target_id: t.id || null,
      updated_at: t.updated_at || null,
    };
  });

  return { success: true, month: month, rows: out };
}

// ─── Target Cabang: upsert
function _finKpiTargetBranchUpsert_(params) {
  _finRoleGate_(params);
  var branchId = String(params.branch_id || '').trim();
  if (!branchId) return { success: false, message: 'branch_id wajib' };
  var month = _finMonthNorm_(params.month);
  var targetCabang = Number(params.target_cabang) || 0;
  var targetStaffDefault = params.target_staff_default != null && params.target_staff_default !== ''
    ? Number(params.target_staff_default) : null;
  var mode = String(params.mode || 'saldo');
  if (mode !== 'saldo' && mode !== 'order') return { success: false, message: 'mode harus saldo/order' };

  // Cek existing
  var existing = _crmSbFetch_('GET', '/rest/v1/raos_kpi_targets_branch?select=id,target_cabang,target_staff_default,mode&branch_id=eq.' + encodeURIComponent(branchId) + '&effective_month=eq.' + encodeURIComponent(month));
  var beforeStr = (existing && existing[0]) ? JSON.stringify(existing[0]) : '(baru)';

  var body = {
    branch_id: branchId,
    effective_month: month,
    target_cabang: targetCabang,
    target_staff_default: targetStaffDefault,
    mode: mode,
    updated_at: new Date().toISOString(),
  };

  var res;
  if (existing && existing[0]) {
    res = _crmSbFetch_('PATCH', '/rest/v1/raos_kpi_targets_branch?id=eq.' + encodeURIComponent(existing[0].id), body);
  } else {
    res = _crmSbFetch_('POST', '/rest/v1/raos_kpi_targets_branch', body);
  }

  _crmAuditWrite_(params, 'upsert', 'kpi_target_branch', branchId + '@' + month, beforeStr, JSON.stringify(body));
  return { success: true, row: Array.isArray(res) ? res[0] : res };
}

// ─── Target Staff: list per bulan (join staff + realisasi + payroll)
function _finKpiTargetStaffList_(params) {
  _finRoleGate_(params);
  var month = _finMonthNorm_(params.month);
  var branchId = String(params.branch_id || '').trim();

  // Ambil semua staff aktif dengan branch_id
  var staffQs = 'select=id,full_name,staff_id,role,branch_id,gaji&is_active=eq.true&role=in.(staff,koordinator)&order=full_name.asc';
  if (branchId) staffQs += '&branch_id=eq.' + encodeURIComponent(branchId);
  var staffs = _crmSbFetch_('GET', '/rest/v1/user_profiles?' + staffQs);
  if (!Array.isArray(staffs)) staffs = [];

  // Ambil target_staff overrides
  var targetOverrides = _crmSbFetch_('GET', '/rest/v1/raos_kpi_targets_staff?select=staff_id,target_saldo,member_parkir_amount&effective_month=eq.' + encodeURIComponent(month));
  var overrideMap = {};
  (targetOverrides || []).forEach(function(t) { overrideMap[t.staff_id] = t; });

  // Ambil realisasi dari view
  var realisasi = _crmSbFetch_('GET', '/rest/v1/raos_target_tercapai_bulan?select=staff_id,realisasi_saldo,request_count&effective_month=eq.' + encodeURIComponent(month));
  var realisasiMap = {};
  (realisasi || []).forEach(function(r) { realisasiMap[r.staff_id] = r; });

  // Ambil default per cabang (target_cabang untuk auto-prorate poin 10+11)
  var branchTargets = _crmSbFetch_('GET', '/rest/v1/raos_kpi_targets_branch?select=branch_id,target_cabang,target_staff_default,mode&effective_month=eq.' + encodeURIComponent(month));
  var branchTargetMap = {};
  (branchTargets || []).forEach(function(b) { branchTargetMap[b.branch_id] = b; });

  // Poin 10+11 (2026-08-07): auto-prorate target_staff_default kalau null.
  // Hitung count staff aktif per cabang (semua cabang, tidak dibatasi branchId
  // filter, karena Target Cabang page butuh angka semua cabang).
  var allStaffLite = _crmSbFetch_('GET', '/rest/v1/user_profiles?select=branch_id&is_active=eq.true&role=in.(staff,koordinator)');
  var staffCountByBranch = {};
  (allStaffLite || []).forEach(function(s) {
    if (!s.branch_id) return;
    staffCountByBranch[s.branch_id] = (staffCountByBranch[s.branch_id] || 0) + 1;
  });

  // Ambil branch info
  var branches = _crmSbFetch_('GET', '/rest/v1/branches?select=id,name,slug');
  var branchMap = {};
  (branches || []).forEach(function(b) { branchMap[b.id] = b; });

  // Ambil payroll bulan ini
  var payroll = _crmSbFetch_('GET', '/rest/v1/raos_payroll?select=staff_id,gapok,bonus_saldo,bpjs,paket_data,member_parkir,bonus_kpi,thp,target_pct,driver_active_pct,status_target,computed_at&effective_month=eq.' + encodeURIComponent(month));
  var payrollMap = {};
  (payroll || []).forEach(function(p) { payrollMap[p.staff_id] = p; });

  var out = staffs.map(function(s) {
    var override = overrideMap[s.id] || {};
    var r = realisasiMap[s.id] || {};
    var bt = branchTargetMap[s.branch_id] || {};
    var b = branchMap[s.branch_id] || {};
    var p = payrollMap[s.id] || {};
    // Poin 10+11: chain fallback — override > branch default > auto-prorate (target_cabang / count staff aktif)
    var branchDefault = bt.target_staff_default != null ? Number(bt.target_staff_default) : null;
    var autoProrated = null;
    if (branchDefault == null && bt.target_cabang) {
      var cnt = staffCountByBranch[s.branch_id] || 0;
      if (cnt > 0) autoProrated = Math.round(Number(bt.target_cabang) / cnt);
    }
    var target = override.target_saldo != null
      ? Number(override.target_saldo)
      : (branchDefault != null ? branchDefault : (autoProrated != null ? autoProrated : 0));
    var real = Number(r.realisasi_saldo || 0);
    var pct = target > 0 ? Math.round((real / target) * 10000) / 100 : 0;
    var slugLower = String(b.slug || '').toLowerCase();
    var isExcluded = /soeta|makassar/.test(slugLower);

    return {
      staff_id: s.id,
      staff_code: s.staff_id,
      staff_name: s.full_name,
      role: s.role,
      branch_id: s.branch_id,
      branch_name: b.name || '',
      branch_slug: b.slug || '',
      is_excluded_saldo: isExcluded,
      gapok: Number(s.gaji || 0),
      target_saldo: target,
      target_saldo_override: override.target_saldo != null ? Number(override.target_saldo) : null,
      realisasi_saldo: real,
      request_count: Number(r.request_count || 0),
      pct: pct,
      member_parkir: Number(override.member_parkir_amount || p.member_parkir || 0),
      bonus_saldo: Number(p.bonus_saldo || 0),
      bpjs: Number(p.bpjs || 55000),
      paket_data: Number(p.paket_data || 100000),
      bonus_kpi: Number(p.bonus_kpi || 0),
      thp: Number(p.thp || 0),
      target_pct: Number(p.target_pct || pct),
      driver_active_pct: Number(p.driver_active_pct || 0),
      status_target: p.status_target || (isExcluded ? 'na' : (pct >= 100 ? 'ok' : (pct >= 80 ? 'warning' : 'cut_off'))),
      computed_at: p.computed_at || null,
    };
  });

  return { success: true, month: month, branch_id: branchId, rows: out };
}

// ─── Target Staff: upsert override target_saldo + member_parkir
function _finKpiTargetStaffUpsert_(params) {
  _finRoleGate_(params);
  var staffId = String(params.staff_id || '').trim();
  if (!staffId) return { success: false, message: 'staff_id wajib' };
  var month = _finMonthNorm_(params.month);
  var targetSaldo = params.target_saldo != null && params.target_saldo !== ''
    ? Number(params.target_saldo) : null;
  var memberParkir = Number(params.member_parkir_amount) || 0;

  var existing = _crmSbFetch_('GET', '/rest/v1/raos_kpi_targets_staff?select=id,target_saldo,member_parkir_amount&staff_id=eq.' + encodeURIComponent(staffId) + '&effective_month=eq.' + encodeURIComponent(month));
  var beforeStr = (existing && existing[0]) ? JSON.stringify(existing[0]) : '(baru)';

  var body = {
    staff_id: staffId,
    effective_month: month,
    target_saldo: targetSaldo,
    member_parkir_amount: memberParkir,
    updated_at: new Date().toISOString(),
  };

  var res;
  if (existing && existing[0]) {
    res = _crmSbFetch_('PATCH', '/rest/v1/raos_kpi_targets_staff?id=eq.' + encodeURIComponent(existing[0].id), body);
  } else {
    res = _crmSbFetch_('POST', '/rest/v1/raos_kpi_targets_staff', body);
  }

  _crmAuditWrite_(params, 'upsert', 'kpi_target_staff', staffId + '@' + month, beforeStr, JSON.stringify(body));
  return { success: true, row: Array.isArray(res) ? res[0] : res };
}

// ─── Payroll: trigger RPC compute_payroll_month
function _finPayrollCompute_(params) {
  _finRoleGate_(params);
  var month = _finMonthNorm_(params.month);
  var res = _crmSbFetch_('POST', '/rest/v1/rpc/raos_compute_payroll_month', { p_month: month });
  _crmAuditWrite_(params, 'compute', 'payroll', month, '', String(res));
  return { success: true, month: month, processed: Number(res) || 0 };
}

// ─── Payroll: list raos_payroll bulan tertentu (join staff + branch)
function _finPayrollList_(params) {
  _finRoleGate_(params);
  var month = _finMonthNorm_(params.month);
  var branchId = String(params.branch_id || '').trim();

  var rows = _crmSbFetch_('GET', '/rest/v1/raos_payroll?select=id,staff_id,gapok,bonus_saldo,bpjs,paket_data,member_parkir,bonus_kpi,thp,target_pct,driver_active_pct,status_target,computed_at&effective_month=eq.' + encodeURIComponent(month));
  if (!Array.isArray(rows)) rows = [];

  if (rows.length === 0) return { success: true, month: month, rows: [] };

  var staffIds = rows.map(function(r) { return encodeURIComponent(r.staff_id); }).join(',');
  var staffs = _crmSbFetch_('GET', '/rest/v1/user_profiles?select=id,staff_id,full_name,role,branch_id&id=in.(' + staffIds + ')');
  var staffMap = {};
  (staffs || []).forEach(function(s) { staffMap[s.id] = s; });

  var branchIds = {};
  (staffs || []).forEach(function(s) { if (s.branch_id) branchIds[s.branch_id] = true; });
  var branchIdList = Object.keys(branchIds).map(function(x) { return encodeURIComponent(x); }).join(',');
  var branchMap = {};
  if (branchIdList) {
    var branches = _crmSbFetch_('GET', '/rest/v1/branches?select=id,name,slug&id=in.(' + branchIdList + ')');
    (branches || []).forEach(function(b) { branchMap[b.id] = b; });
  }

  var out = rows.map(function(r) {
    var s = staffMap[r.staff_id] || {};
    var b = branchMap[s.branch_id] || {};
    return {
      id: r.id,
      staff_id: r.staff_id,
      staff_code: s.staff_id || '',
      staff_name: s.full_name || '',
      role: s.role || '',
      branch_id: s.branch_id || null,
      branch_name: b.name || '',
      branch_slug: b.slug || '',
      gapok: Number(r.gapok || 0),
      bonus_saldo: Number(r.bonus_saldo || 0),
      bpjs: Number(r.bpjs || 0),
      paket_data: Number(r.paket_data || 0),
      member_parkir: Number(r.member_parkir || 0),
      bonus_kpi: Number(r.bonus_kpi || 0),
      thp: Number(r.thp || 0),
      target_pct: Number(r.target_pct || 0),
      driver_active_pct: Number(r.driver_active_pct || 0),
      status_target: r.status_target,
      computed_at: r.computed_at,
    };
  });

  if (branchId) {
    out = out.filter(function(r) { return r.branch_id === branchId; });
  }

  return { success: true, month: month, branch_id: branchId, rows: out };
}

// ═══════════════════════════════════════════════════════════════════════
// DB Driver + Random Assignment (raos_070) — Fase 5
// ═══════════════════════════════════════════════════════════════════════

function _finDriversList_(params) {
  _finRoleGate_(params);
  var branchId = String(params.branch_id || '').trim();
  var qs = 'select=id,driver_id,name,phone,vehicle_type,vehicle_plate,is_active,source,branch_id,created_at&order=name.asc';
  if (branchId) qs += '&branch_id=eq.' + encodeURIComponent(branchId);
  var rows = _crmSbFetch_('GET', '/rest/v1/raos_drivers?' + qs);
  if (!Array.isArray(rows)) rows = [];

  // Enrich: assignment + branch
  var branches = _crmSbFetch_('GET', '/rest/v1/branches?select=id,name,slug');
  var branchMap = {};
  (branches || []).forEach(function(b) { branchMap[b.id] = b; });

  var driverIds = rows.map(function(r) { return encodeURIComponent(r.id); });
  var assignmentMap = {};
  if (driverIds.length) {
    // Chunk 100 IDs untuk hindari URL length limit
    for (var i = 0; i < driverIds.length; i += 100) {
      var chunk = driverIds.slice(i, i + 100).join(',');
      var assignments = _crmSbFetch_('GET', '/rest/v1/raos_driver_staff_assignment?select=driver_id,staff_id,assigned_at&driver_id=in.(' + chunk + ')');
      (assignments || []).forEach(function(a) { assignmentMap[a.driver_id] = a; });
    }
  }

  var staffIds = {};
  Object.keys(assignmentMap).forEach(function(k) { staffIds[assignmentMap[k].staff_id] = true; });
  var staffMap = {};
  var staffIdList = Object.keys(staffIds).map(function(x) { return encodeURIComponent(x); }).join(',');
  if (staffIdList) {
    var staffs = _crmSbFetch_('GET', '/rest/v1/user_profiles?select=id,full_name,staff_id&id=in.(' + staffIdList + ')');
    (staffs || []).forEach(function(s) { staffMap[s.id] = s; });
  }

  var out = rows.map(function(r) {
    var b = branchMap[r.branch_id] || {};
    var a = assignmentMap[r.id] || null;
    var s = a ? (staffMap[a.staff_id] || null) : null;
    return {
      id: r.id,
      driver_id: r.driver_id,
      name: r.name,
      phone: r.phone,
      vehicle_type: r.vehicle_type,
      vehicle_plate: r.vehicle_plate,
      is_active: r.is_active,
      source: r.source,
      branch_id: r.branch_id,
      branch_name: b.name || '',
      branch_slug: b.slug || '',
      assigned_staff_id: a ? a.staff_id : null,
      assigned_staff_name: s ? s.full_name : '',
      assigned_staff_code: s ? s.staff_id : '',
      assigned_at: a ? a.assigned_at : null,
      created_at: r.created_at,
    };
  });

  return { success: true, total: out.length, rows: out };
}

function _finDriverAssignmentList_(params) {
  _finRoleGate_(params);
  var branchId = String(params.branch_id || '').trim();
  if (!branchId) return { success: false, message: 'branch_id wajib' };

  var rows = _crmSbFetch_('GET', '/rest/v1/raos_driver_staff_assignment?select=id,driver_id,staff_id,assigned_at,assigned_by&branch_id=eq.' + encodeURIComponent(branchId));
  if (!Array.isArray(rows)) rows = [];

  // Group by staff_id
  var byStaff = {};
  rows.forEach(function(r) {
    if (!byStaff[r.staff_id]) byStaff[r.staff_id] = { staff_id: r.staff_id, drivers: [] };
    byStaff[r.staff_id].drivers.push({ driver_id: r.driver_id, assigned_at: r.assigned_at });
  });

  var staffIds = Object.keys(byStaff).map(function(x) { return encodeURIComponent(x); }).join(',');
  if (staffIds) {
    var staffs = _crmSbFetch_('GET', '/rest/v1/user_profiles?select=id,full_name,staff_id,role&id=in.(' + staffIds + ')');
    (staffs || []).forEach(function(s) {
      if (byStaff[s.id]) {
        byStaff[s.id].staff_name = s.full_name;
        byStaff[s.id].staff_code = s.staff_id;
        byStaff[s.id].role = s.role;
      }
    });
  }

  var out = Object.values(byStaff);
  out.sort(function(a, b) { return (b.drivers ? b.drivers.length : 0) - (a.drivers ? a.drivers.length : 0); });

  return { success: true, branch_id: branchId, total_assignments: rows.length, staff_groups: out };
}

function _finDriverAssignRandom_(params) {
  // Restrict management/direksi hanya
  var email = String(params.user || '').toLowerCase().trim();
  if (!email) return { success: false, message: 'Parameter user wajib' };
  var verified = authVerifyUser(email);
  if (!verified.success) return { success: false, message: 'Email tidak diizinkan' };
  var role = String(verified.user && verified.user.role || '').toLowerCase();
  // Fix 2026-08-07: role 'admin' (Bobby di users table) sebelumnya di-tolak
  // walau semantically ADMIN adalah role tertinggi. Include 'admin' ke daftar.
  if (role !== 'admin' && role !== 'management' && role !== 'direksi' && role !== 'direktur') {
    return { success: false, message: 'Hanya admin/management/direksi yang boleh random-assign driver' };
  }

  var branchId = String(params.branch_id || '').trim();
  if (!branchId) return { success: false, message: 'branch_id wajib' };
  var force = String(params.force || 'false') === 'true';

  var res = _crmSbFetch_('POST', '/rest/v1/rpc/raos_random_assign_drivers', { p_branch_id: branchId, p_force: force });
  _crmAuditWrite_(params, 'random_assign', 'driver_staff_assignment', branchId, '', 'force=' + force + ' → ' + String(res));
  return { success: true, branch_id: branchId, force: force, assigned: Number(res) || 0 };
}

// ═══════════════════════════════════════════════════════════════════════
// HRIS Absensi — source raos_attendance (SSOT dari PWA RAOS)
// ═══════════════════════════════════════════════════════════════════════

function _hrisNormalizeRole_(role) {
  var r = String(role || '').trim().toLowerCase();
  if (r === 'direktur') return 'direksi';
  if (r === 'koord') return 'koordinator';
  if (r === 'mgmt') return 'management';
  return r;
}

function _hrisAttendanceAccessContext_(params) {
  var email = String(params.user || '').toLowerCase().trim();
  if (!email) throw new Error('Parameter user (email) wajib');

  var verified = authVerifyUser(email);
  if (!verified || !verified.success) throw new Error('Email ' + email + ' tidak diizinkan');

  var user = verified.user || {};
  var role = _hrisNormalizeRole_(user.role);
  if (['admin', 'management', 'direksi', 'koordinator'].indexOf(role) === -1) {
    throw new Error('Role ' + role + ' tidak boleh akses HRIS Absensi');
  }

  var branchId = String(user.branch_id || user.branchId || '').trim();
  if (role === 'koordinator' && !branchId) {
    throw new Error('Koordinator belum memiliki branch_id; akses Absensi ditolak agar tidak bocor lintas cabang');
  }

  return {
    user: user,
    role: role,
    branch_id: branchId,
    can_write: role === 'admin' || role === 'direksi',
    is_branch_scoped: role === 'koordinator'
  };
}

function _hrisAttendanceRequireWrite_(params) {
  var ctx = _hrisAttendanceAccessContext_(params);
  if (!ctx.can_write) {
    throw new Error('Role ' + ctx.role + ' hanya boleh melihat Absensi');
  }
  return ctx;
}

function _hrisAttendanceEffectiveBranch_(params, ctx) {
  var requested = String(params.branch_id || '').trim();
  if (ctx.is_branch_scoped) return ctx.branch_id;
  return requested;
}

// List raos_attendance dalam range tanggal + filter branch/staff, join user_profiles+branches+shifts
function _hrisAttendanceRaosList_(params) {
  var ctx = _hrisAttendanceAccessContext_(params);
  var dateFrom = String(params.date_from || '').trim();
  var dateTo   = String(params.date_to   || '').trim();
  var branchId = _hrisAttendanceEffectiveBranch_(params, ctx);
  var staffId  = String(params.staff_id  || '').trim();
  var search   = String(params.search    || '').toLowerCase();

  if (!dateFrom || !dateTo) return { success: false, message: 'date_from + date_to wajib (YYYY-MM-DD)' };

  var qs = 'select=id,staff_id,branch_id,shift_id,date,check_in_at,check_out_at,check_in_lat,check_in_lng,check_out_lat,check_out_lng,selfie_in_url,selfie_out_url,status,is_location_valid,auto_checkout&order=date.desc,check_in_at.desc';
  qs += '&date=gte.' + encodeURIComponent(dateFrom);
  qs += '&date=lte.' + encodeURIComponent(dateTo);
  if (branchId) qs += '&branch_id=eq.' + encodeURIComponent(branchId);
  if (staffId)  qs += '&staff_id=eq.'  + encodeURIComponent(staffId);
  qs += '&limit=500';

  var rows = _crmSbFetch_('GET', '/rest/v1/raos_attendance?' + qs);
  if (!Array.isArray(rows)) rows = [];

  if (!rows.length) return { success: true, count: 0, rows: [] };

  // Enrich: staff, branch, shift
  var staffIds = {}, branchIds = {}, shiftIds = {};
  rows.forEach(function(r) {
    if (r.staff_id)  staffIds[r.staff_id]  = true;
    if (r.branch_id) branchIds[r.branch_id] = true;
    if (r.shift_id)  shiftIds[r.shift_id]  = true;
  });

  var staffMap = {}, branchMap = {}, shiftMap = {};
  var sIds = Object.keys(staffIds).map(encodeURIComponent).join(',');
  if (sIds) {
    var ss = _crmSbFetch_('GET', '/rest/v1/user_profiles?select=id,full_name,staff_id&id=in.(' + sIds + ')');
    (ss || []).forEach(function(u) { staffMap[u.id] = u; });
  }
  var bIds = Object.keys(branchIds).map(encodeURIComponent).join(',');
  if (bIds) {
    var bb = _crmSbFetch_('GET', '/rest/v1/branches?select=id,name,slug&id=in.(' + bIds + ')');
    (bb || []).forEach(function(b) { branchMap[b.id] = b; });
  }
  var shIds = Object.keys(shiftIds).map(encodeURIComponent).join(',');
  if (shIds) {
    var sh = _crmSbFetch_('GET', '/rest/v1/shifts?select=id,name,start_time,end_time,tolerance_minutes&id=in.(' + shIds + ')');
    (sh || []).forEach(function(x) { shiftMap[x.id] = x; });
  }

  // Post-process: hitung late minutes per row (client-side agar tidak beban SQL heavy)
  var out = rows.map(function(r) {
    var s = r.staff_id  ? staffMap[r.staff_id]  : null;
    var b = r.branch_id ? branchMap[r.branch_id]: null;
    var sh = r.shift_id ? shiftMap[r.shift_id]  : null;
    var lateMinutes = 0;
    if (sh && sh.start_time && r.check_in_at) {
      var expected = new Date(r.date + 'T' + sh.start_time + '+07:00').getTime();
      var actual   = new Date(r.check_in_at).getTime();
      var tolMs    = (sh.tolerance_minutes || 0) * 60 * 1000;
      var diffMin  = Math.floor((actual - expected - tolMs) / 60000);
      if (diffMin > 0) lateMinutes = diffMin;
    }
    var lateDeduction = Math.floor(lateMinutes / 30) * 10000;
    var loc = (r.check_in_lat && r.check_in_lng)
      ? (Number(r.check_in_lat).toFixed(5) + ',' + Number(r.check_in_lng).toFixed(5))
      : '';
    return {
      id: r.id,
      staff_id: r.staff_id,
      staff_code: s ? s.staff_id : '',
      staff_name: s ? s.full_name : '',
      branch_id: r.branch_id,
      branch_name: b ? b.name : '',
      branch_slug: b ? b.slug : '',
      shift_name: sh ? sh.name : '',
      date: r.date,
      check_in_at: r.check_in_at,
      check_out_at: r.check_out_at,
      selfie_in_url: r.selfie_in_url,
      selfie_out_url: r.selfie_out_url,
      status: r.status,
      is_location_valid: r.is_location_valid,
      auto_checkout: r.auto_checkout,
      late_minutes: lateMinutes,
      late_deduction: lateDeduction,
      location: loc,
      maps_link: loc ? ('https://www.google.com/maps?q=' + loc) : '',
    };
  });

  // Filter search di JS (setelah enrichment)
  if (search) {
    out = out.filter(function(r) {
      return (r.staff_name + ' ' + r.staff_code + ' ' + r.branch_name).toLowerCase().indexOf(search) !== -1;
    });
  }

  return {
    success: true,
    count: out.length,
    rows: out,
    scope: ctx.is_branch_scoped ? 'branch' : 'permission_data_scope',
    effective_branch_id: branchId || null
  };
}

// Summary bulanan via RPC raos_absensi_summary_month
function _hrisAttendanceSummaryMonth_(params) {
  var ctx = _hrisAttendanceAccessContext_(params);
  var monthISO = _finMonthNorm_(params.month);
  var staffId = String(params.staff_id || '').trim() || null;
  var branchId = _hrisAttendanceEffectiveBranch_(params, ctx) || null;
  if (ctx.is_branch_scoped) {
    return {
      success: false,
      code: 'RPC_BRANCH_SCOPE_REQUIRED',
      message: 'Summary Koordinator membutuhkan RPC branch-scoped sebelum diaktifkan.'
    };
  }
  var body = { p_month: monthISO, p_staff_id: staffId };
  var res = _crmSbFetch_('POST', '/rest/v1/rpc/raos_absensi_summary_month', body);
  return {
    success: true,
    month: monthISO,
    staff_id: staffId,
    branch_id: branchId,
    rows: Array.isArray(res) ? res : []
  };
}

// Edit raos_attendance row via RPC hris_attendance_edit (migration raos_071).
// RPC SECURITY DEFINER role-gate admin/mgmt/direksi + support override jam +
// potongan override + edit_reason + audit trail (manual_edited_by/_at).
// Sinkron ke sheet dilakukan via cron sync layer existing (jangan direct write sheet).
function _hrisAttendanceEdit_(params) {
  var ctx = _hrisAttendanceRequireWrite_(params);
  var id = String(params.id || '').trim();
  if (!id) return { success: false, message: 'id (raos_attendance.id) wajib' };

  // Body optional — endpoint boleh dipanggil dgn subset field
  var body = { p_attendance_id: id };
  if (params.check_in_at_override  !== undefined) body.p_check_in_override  = String(params.check_in_at_override)  || null;
  if (params.check_out_at_override !== undefined) body.p_check_out_override = String(params.check_out_at_override) || null;
  if (params.late_deduction_idr    !== undefined) body.p_late_deduction_idr = Number(params.late_deduction_idr) || 0;
  if (params.reason                !== undefined) body.p_reason             = String(params.reason || '') || null;

  // Fetch existing untuk audit before (kolom yg bisa berubah)
  var before = _crmSbFetch_('GET',
    '/rest/v1/raos_attendance?select=check_in_at,check_in_at_override,check_out_at,check_out_at_override,late_deduction_idr,edit_reason&id=eq.' +
    encodeURIComponent(id));
  var beforeStr = (before && before[0]) ? JSON.stringify(before[0]) : '(none)';

  var res = _crmSbFetch_('POST', '/rest/v1/rpc/hris_attendance_edit', body);
  _crmAuditWrite_(params, 'edit_via_rpc', 'raos_attendance', id, beforeStr, JSON.stringify(body));

  return { success: true, id: id, actor_role: ctx.role, rpc: res };
}

// Gapok proporsional per bulan berdasarkan hari_masuk vs (jml_hari_bulan - MONTHLY_LIBUR_DAYS).
// Source: view hris_gapok_proporsional_view (migration raos_071).
function _hrisGapokProporsionalList_(params) {
  var ctx = _hrisAttendanceAccessContext_(params);
  var monthISO = _finMonthNorm_(params.month);
  var staffId  = String(params.staff_id || '').trim();
  var branchId = _hrisAttendanceEffectiveBranch_(params, ctx);
  var qs = 'select=*&bulan=eq.' + encodeURIComponent(monthISO) + '&order=staff_name.asc&limit=1000';
  if (staffId) qs += '&staff_id=eq.' + encodeURIComponent(staffId);
  if (branchId) qs += '&branch_id=eq.' + encodeURIComponent(branchId);
  var rows = _crmSbFetch_('GET', '/rest/v1/hris_gapok_proporsional_view?' + qs);
  return {
    success: true,
    month: monthISO,
    count: (rows || []).length,
    branch_id: branchId || null,
    rows: rows || []
  };
}

// ═══════════════════════════════════════════════════════════════════════
// HRIS Foto Karyawan → Canonical Drive Storage V4
// Struktur: HRIS/YYYY/MM_Bulan/11_MEDIA_KARYAWAN/Foto Karyawan/<Nama (ID)>/
// Data pribadi tidak dibuat ANYONE_WITH_LINK.
// ═══════════════════════════════════════════════════════════════════════
function _hrisFolderGetOrCreate_(parent, name) {
  if (typeof canonicalDriveGetOrCreateFolder_ === 'function') return canonicalDriveGetOrCreateFolder_(parent, name);
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function _hrisSlugStaffFolder_(fullName, employeeId) {
  var clean = String(fullName || '').trim().replace(/[<>:"\/\\|?*]/g, ' ').replace(/\s+/g, ' ');
  var id = String(employeeId || '').trim().toUpperCase();
  if (!clean) clean = 'UNKNOWN';
  return id ? (clean + ' (' + id + ')') : clean;
}

function _hrisUploadEmployeePhoto_(params) {
  _crmRequireAdmin_(params); // Management tetap view-only.

  var employeeId = String(params.employee_id || '').trim().toUpperCase();
  var fullName   = String(params.full_name   || '').trim();
  var photoType  = String(params.photo_type  || '').toLowerCase();
  var dataUrl    = String(params.data_url    || '');

  if (!employeeId) return { success: false, message: 'employee_id wajib' };
  if (!fullName)   return { success: false, message: 'full_name wajib' };
  if (photoType !== 'ktp' && photoType !== '2x3') return { success: false, message: 'photo_type harus ktp atau 2x3' };
  if (!dataUrl.startsWith('data:')) return { success: false, message: 'data_url harus base64 data URL (data:image/...)' };
  if (typeof canonicalDriveGetMonthFolder !== 'function') return { success:false, message:'canonicalDriveStorage.js belum terpasang' };

  var match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return { success: false, message: 'data_url format invalid — harus data:<mime>;base64,<data>' };
  var mimeType = match[1];
  var base64   = match[2];
  var ext = (mimeType === 'image/png') ? 'png' : (mimeType === 'image/webp' ? 'webp' : 'jpg');
  var fileName = photoType + '.' + ext;

  try {
    var mediaRoot = canonicalDriveGetMonthFolder('hris', 'media_karyawan', new Date());
    var staffRoot = _hrisFolderGetOrCreate_(mediaRoot, 'Foto Karyawan');
    var staffFolder = _hrisFolderGetOrCreate_(staffRoot, _hrisSlugStaffFolder_(fullName, employeeId));

    var existing = staffFolder.getFilesByName(fileName);
    while (existing.hasNext()) existing.next().setTrashed(true);

    var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, fileName);
    var file = staffFolder.createFile(blob);
    // Jangan set ANYONE_WITH_LINK: KTP/foto karyawan adalah data pribadi.
    var driveUrl = file.getUrl();

    _crmAuditWrite_(params, 'upload_photo', 'hris_employee_photo',
      employeeId + '/' + photoType, '', driveUrl);

    return {
      success: true,
      file_id: file.getId(),
      url: driveUrl,
      drive_url: driveUrl,
      visibility: 'drive_acl',
      folder_id: staffFolder.getId(),
      folder_name: staffFolder.getName(),
      file_name: fileName
    };
  } catch (err) {
    return { success: false, message: 'Drive upload gagal: ' + err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// HRIS Payroll bridge — return bonus per staff untuk consumed HRIS UI
// ═══════════════════════════════════════════════════════════════════════
function _hrisPayrollBonusList_(params) {
  _finRoleGate_(params);
  var month = _finMonthNorm_(params.month);
  var rows = _crmSbFetch_('GET', '/rest/v1/raos_payroll?select=staff_id,bonus_saldo,bonus_kpi,member_parkir,target_pct,status_target&effective_month=eq.' + encodeURIComponent(month));
  if (!Array.isArray(rows)) rows = [];

  var staffIds = rows.map(function(r) { return encodeURIComponent(r.staff_id); }).join(',');
  var staffMap = {};
  if (staffIds) {
    var staffs = _crmSbFetch_('GET', '/rest/v1/user_profiles?select=id,staff_id,full_name&id=in.(' + staffIds + ')');
    (staffs || []).forEach(function(s) { staffMap[s.id] = s; });
  }

  var out = rows.map(function(r) {
    var s = staffMap[r.staff_id] || {};
    return {
      staff_id: r.staff_id,
      staff_code: s.staff_id || '',
      staff_name: s.full_name || '',
      bonus_saldo: Number(r.bonus_saldo || 0),
      bonus_kpi: Number(r.bonus_kpi || 0),
      member_parkir: Number(r.member_parkir || 0),
      total_bonus: Number(r.bonus_saldo || 0) + Number(r.bonus_kpi || 0) + Number(r.member_parkir || 0),
      target_pct: Number(r.target_pct || 0),
      status_target: r.status_target,
    };
  });

  return { success: true, month: month, rows: out };
}

function _payrollV2NormalizeMonth_(value) {
  var month = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(month)) month = month.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('month wajib format YYYY-MM');
  return month;
}

function _payrollV2PropsKey_(kind, month) {
  return 'PAYROLL_V2_' + String(kind || '').toUpperCase() + '_' + month;
}

function _payrollV2OverlayRead_(kind, month) {
  var raw = PropertiesService.getScriptProperties().getProperty(_payrollV2PropsKey_(kind, month));
  if (!raw) return [];
  try {
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function _payrollV2OverlayUpsert_(kind, month, payload) {
  var rows = _payrollV2OverlayRead_(kind, month);
  var employeeId = String(payload.employee_id || '').trim().toUpperCase();
  rows = rows.filter(function(row) {
    return String(row.employee_id || '').trim().toUpperCase() !== employeeId;
  });
  rows.push(payload);
  PropertiesService.getScriptProperties().setProperty(_payrollV2PropsKey_(kind, month), JSON.stringify(rows));
  return rows;
}

function _payrollV2BranchList_(params) {
  _crmRequireRead_(params);
  var rows = _crmSbFetch_('GET', '/rest/v1/branches?select=id,name,slug,branch_type,is_active&is_active=eq.true&order=name.asc');
  rows = Array.isArray(rows) ? rows : [];
  var hasHeadOffice = rows.some(function(row) {
    return String(row.name || '').toLowerCase() === 'head office';
  });
  if (!hasHeadOffice) {
    rows.unshift({ id: 'HEAD_OFFICE', name: 'Head Office', slug: 'head-office', branch_type: 'head_office', is_active: true, virtual: true });
  }
  return { success: true, rows: rows };
}

function _payrollV2Attendance_(month) {
  var qs = 'select=staff_code,staff_name,branch_id,branch_name,hari_masuk,potongan_terlambat,total_telat_menit,potongan_absen';
  qs += '&bulan=eq.' + encodeURIComponent(month + '-01') + '&limit=2000';
  var rows = _crmSbFetch_('GET', '/rest/v1/hris_gapok_proporsional_view?' + qs);
  return Array.isArray(rows) ? rows : [];
}

function _payrollV2Target_(month) {
  try {
    var rows = _crmSbFetch_('GET', '/rest/v1/raos_payroll?select=staff_id,bonus_saldo,bonus_kpi,branch_id&effective_month=eq.' + encodeURIComponent(month + '-01') + '&limit=2000');
    return Array.isArray(rows) ? rows : [];
  } catch (_) {
    return [];
  }
}

function _payrollV2Kasbon_(month) {
  var rows = [];
  try {
    rows = _crmSbFetch_('GET', '/rest/v1/finance_staff_cash_advance_view?select=*&month=eq.' + encodeURIComponent(month + '-01') + '&limit=2000');
  } catch (_) {}
  rows = Array.isArray(rows) ? rows : [];
  rows = rows.map(function(row) {
    var copy = {};
    Object.keys(row || {}).forEach(function(key) { copy[key] = row[key]; });
    if (!copy.kasbon_source) copy.kasbon_source = 'finance_canonical';
    return copy;
  });
  return rows.concat(_payrollV2OverlayRead_('MANUAL_KASBON', month).map(function(row) {
    var copy = {};
    Object.keys(row || {}).forEach(function(key) { copy[key] = row[key]; });
    copy.kasbon_source = 'manual_payroll_button';
    return copy;
  }));
}

function _payrollV2Deposits_(month) {
  return _payrollV2OverlayRead_('DEPOSIT', month);
}

function _payrollV2Bundle_(params) {
  _crmRequireRead_(params);
  var month = _payrollV2NormalizeMonth_(params.month);
  var branchId = String(params.branch_id || '').trim();
  var employees = _crmSbFetch_('GET', '/rest/v1/employees?select=employee_id,full_name,system_role,position,department,branch_id,branch,company_code,salary_base,allowances,other_deduction,payroll_document_number,status&status=eq.AKTIF&limit=2000');
  employees = Array.isArray(employees) ? employees : [];
  employees = employees.filter(function(row) {
    var role = String(row.system_role || row.role || '').toLowerCase();
    return ['staff', 'koordinator', 'admin', 'management'].indexOf(role) !== -1;
  });
  if (branchId && branchId !== 'ALL' && branchId !== 'HEAD_OFFICE') {
    employees = employees.filter(function(row) { return String(row.branch_id || '') === branchId; });
  }
  if (branchId === 'HEAD_OFFICE') {
    employees = employees.filter(function(row) { return String(row.branch || '').toLowerCase() === 'head office'; });
  }

  var leaves = [];
  try {
    leaves = _crmSbFetch_('GET', '/rest/v1/leave_requests?select=employee_id,total_days,approved_days,status,start_date,end_date&status=eq.DISETUJUI&limit=2000');
  } catch (_) {}

  var overtime = [];
  try {
    overtime = _crmSbFetch_('GET', '/rest/v1/employee_overtime?select=employee_id,approved_amount,amount,status,work_date&status=eq.APPROVED&work_date=gte.' + month + '-01&limit=2000');
  } catch (_) {}

  return {
    success: true,
    period: month,
    employees: employees,
    attendance: _payrollV2Attendance_(month),
    targets: _payrollV2Target_(month),
    leave: Array.isArray(leaves) ? leaves : [],
    kasbon: _payrollV2Kasbon_(month),
    deposits: _payrollV2Deposits_(month),
    overtime: Array.isArray(overtime) ? overtime : []
  };
}

function _payrollV2ManualKasbon_(params) {
  _crmRequireAdmin_(params);
  var employeeId = String(params.employee_id || '').trim().toUpperCase();
  var amount = Number(params.amount || 0);
  var month = _payrollV2NormalizeMonth_(params.month);
  var note = String(params.note || '').trim();
  if (!employeeId || amount <= 0) return { success: false, message: 'employee_id + amount wajib' };
  _payrollV2OverlayUpsert_('MANUAL_KASBON', month, {
    employee_id: employeeId,
    amount: amount,
    outstanding_amount: amount,
    kasbon_source: 'manual_payroll_button',
    note: note,
    updated_at: new Date().toISOString(),
    updated_by: String(params._crm_actor_email || params.user || '')
  });
  _crmAuditWrite_(params, 'payroll_manual_kasbon_overlay', 'payroll_manual_kasbon', employeeId + '@' + month, '', 'Rp ' + amount + (note ? ' · ' + note : ''));
  return { success: true, overlay: true, employee_id: employeeId, month: month, amount: amount, note: note };
}

function _payrollV2Deposit_(params) {
  _crmRequireAdmin_(params);
  var employeeId = String(params.employee_id || '').trim().toUpperCase();
  var amount = Number(params.amount || 0);
  var month = _payrollV2NormalizeMonth_(params.month);
  var note = String(params.note || '').trim();
  if (!employeeId || amount <= 0) return { success: false, message: 'employee_id + amount wajib' };
  _payrollV2OverlayUpsert_('DEPOSIT', month, {
    employee_id: employeeId,
    amount: amount,
    note: note,
    updated_at: new Date().toISOString(),
    updated_by: String(params._crm_actor_email || params.user || '')
  });
  _crmAuditWrite_(params, 'payroll_deposit_overlay', 'payroll_deposit', employeeId + '@' + month, '', 'Rp ' + amount + (note ? ' · ' + note : ''));
  return { success: true, overlay: true, employee_id: employeeId, month: month, amount: amount, note: note };
}


// Document Engine browser client helpers
// Safe no-op in Google Apps Script runtime; active only when loaded by the PWA.
(function(root) {
  if (!root || !root.window) return;

  var windowObj = root.window;
  var CrmApi = windowObj.CrmApi = windowObj.CrmApi || {};
  var internalCache = {};
  var CACHE_TTL_MS = 60 * 1000;

  function _docsGasUrl() {
    var cfg = windowObj.CRM_API || {};
    var url = cfg.gasUrl || windowObj.CRM_GAS_URL || windowObj.GAS_WEB_APP_URL || windowObj.GAS_URL;
    if (!url) throw new Error('CRM_GAS_URL belum dikonfigurasi');
    return String(url);
  }

  function _docsUserEmail() {
    if (typeof windowObj._crmGetUserEmail === 'function') return windowObj._crmGetUserEmail();
    var cfg = windowObj.CRM_API || {};
    if (cfg.userEmail) return cfg.userEmail;
    if (windowObj.currentUser && windowObj.currentUser.email) return windowObj.currentUser.email;
    if (!windowObj.localStorage) return '';

    var direct = windowObj.localStorage.getItem('rifim_user_email') || windowObj.localStorage.getItem('crm_user_email');
    if (direct) return direct;

    var keys = ['rifim_user', 'crm_user', 'currentUser', 'user'];
    for (var index = 0; index < keys.length; index++) {
      try {
        var raw = windowObj.localStorage.getItem(keys[index]);
        if (!raw) continue;
        var parsed = JSON.parse(raw);
        if (parsed && parsed.email) return parsed.email;
      } catch (err) {}
    }
    return '';
  }

  function _docsCleanParams(params) {
    var out = {};
    Object.keys(params || {}).forEach(function(key) {
      var value = params[key];
      if (value === undefined || value === null || value === '') return;
      out[key] = value;
    });
    return out;
  }

  function _docsQuery(params) {
    var query = new URLSearchParams();
    Object.keys(_docsCleanParams(params)).forEach(function(key) {
      query.set(key, params[key]);
    });
    return query.toString();
  }

  function _docsCacheKey(action, params) {
    return 'docs:' + action + ':' + _docsQuery(params);
  }

  function _docsCacheGet(key) {
    if (windowObj.apiCache && typeof windowObj.apiCache.get === 'function') return windowObj.apiCache.get(key);
    var hit = internalCache[key];
    if (!hit || hit.expiresAt <= Date.now()) {
      delete internalCache[key];
      return undefined;
    }
    return hit.value;
  }

  function _docsCacheSet(key, value) {
    if (windowObj.apiCache && typeof windowObj.apiCache.set === 'function') {
      windowObj.apiCache.set(key, value, CACHE_TTL_MS);
      return value;
    }
    internalCache[key] = { value: value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  }

  function _docsInvalidateCache() {
    if (windowObj.apiCache && typeof windowObj.apiCache.invalidatePrefix === 'function') {
      windowObj.apiCache.invalidatePrefix('docs:');
      return;
    }
    Object.keys(internalCache).forEach(function(key) {
      if (key.indexOf('docs:') === 0) delete internalCache[key];
    });
  }

  function _docsUpdated(action, data) {
    if (typeof windowObj.CustomEvent === 'function') {
      windowObj.dispatchEvent(new windowObj.CustomEvent('docs-updated', { detail: { action: action, data: data } }));
      return;
    }
    if (windowObj.document && typeof windowObj.document.createEvent === 'function') {
      var event = windowObj.document.createEvent('CustomEvent');
      event.initCustomEvent('docs-updated', false, false, { action: action, data: data });
      windowObj.dispatchEvent(event);
    }
  }

  function _docsNormalizeCreate(result) {
    if (result && result.documentId && !result.id) result.id = result.documentId;
    return result;
  }

  function _docsHandleResponse(response) {
    return response.text().then(function(text) {
      var payload;
      try {
        payload = text ? JSON.parse(text) : {};
      } catch (err) {
        throw new Error('Response GAS bukan JSON valid');
      }
      if (!response.ok) throw new Error(payload.error || payload.message || ('HTTP ' + response.status));
      if (payload.ok === false || payload.success === false) throw new Error(payload.error || payload.message || 'Request gagal');
      return payload.ok === true && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
    });
  }

  function _docsFetchGet(action, params) {
    var requestParams = _docsCleanParams(params || {});
    requestParams.action = action;
    requestParams.user = _docsUserEmail();
    if (!requestParams.user) return Promise.reject(new Error('unauthorized'));

    var separator = _docsGasUrl().indexOf('?') === -1 ? '?' : '&';
    return windowObj.fetch(_docsGasUrl() + separator + _docsQuery(requestParams), {
      method: 'GET',
      credentials: 'include'
    }).then(_docsHandleResponse);
  }

  function _docsFetchPost(action, payload) {
    var body = _docsCleanParams(payload || {});
    body.action = action;
    body.user = _docsUserEmail();
    if (!body.user) return Promise.reject(new Error('unauthorized'));

    return windowObj.fetch(_docsGasUrl(), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body)
    }).then(_docsHandleResponse);
  }

  function _docsCachedGet(action, params) {
    var requestParams = _docsCleanParams(params || {});
    requestParams.user = _docsUserEmail();
    var key = _docsCacheKey(action, requestParams);
    var cached = _docsCacheGet(key);
    if (cached !== undefined) return Promise.resolve(cached);
    return _docsFetchGet(action, params).then(function(data) {
      return _docsCacheSet(key, data);
    });
  }

  function _docsMutate(action, payload, normalize) {
    return _docsFetchPost(action, payload).then(function(data) {
      var result = normalize ? normalize(data) : data;
      _docsInvalidateCache();
      _docsUpdated(action, result);
      return result;
    });
  }

  CrmApi.docs = {
    list: function(params) {
      return _docsCachedGet('doc_list', params || {});
    },
    get: function(id) {
      return _docsFetchGet('doc_get', { id: id });
    },
    revisions: function(documentId) {
      return _docsFetchGet('doc_revisions', { documentId: documentId });
    },
    revisionDiff: function(revIdA, revIdB) {
      return _docsFetchGet('doc_revision_diff', { revIdA: revIdA, revIdB: revIdB });
    },
    audit: function(params) {
      return _docsFetchGet('doc_audit', params || {});
    },
    pending: function() {
      return _docsCachedGet('doc_pending', {});
    },
    verifyChain: function(params) {
      return _docsFetchGet('doc_verify_chain', params || {});
    },
    create: function(params) {
      return _docsMutate('doc_create', params || {}, _docsNormalizeCreate);
    },
    transition: function(params) {
      var body = Object.assign({}, params || {});
      if (body.action) {
        body.workflowAction = body.action;
        delete body.action;
      }
      return _docsMutate('doc_transition', body);
    },
    decide: function(params) {
      return _docsMutate('doc_decide', params || {});
    },
    revise: function(params) {
      return _docsMutate('doc_revise', params || {});
    },
    restore: function(params) {
      return _docsMutate('doc_restore', params || {});
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

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
 * Wajib admin-only untuk write. Auth check via header X-Portal-User atau
 * query param ?user=<email>, dicocokkan ke company_config.allowed_emails
 * + role check via configLoader.
 */

// ═══════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════
var CRM_WRITE_ROLES = ['admin','management','direksi','direktur'];

// ═══════════════════════════════════════════════════════════════════════
// Dispatcher — dipanggil dari webApp.js doGet
// ═══════════════════════════════════════════════════════════════════════
function crmHandleGet(e) {
  var action = e && e.parameter && e.parameter.action;
  if (!action) return null;

  try {
    // ─── Company Config ──────────────────────────────────
    if (action === 'company_config_list')   return _crmJson({ success: true, config: _crmReadKV_('company_config') });
    if (action === 'company_config_set')    return _crmJson(_crmSetKV_('company_config', e.parameter));

    // ─── Whitelist Portal ────────────────────────────────
    if (action === 'whitelist_list')        return _crmJson({ success: true, whitelist: _crmWhitelistList_() });
    if (action === 'whitelist_add')         return _crmJson(_crmWhitelistMutate_('add',    e.parameter));
    if (action === 'whitelist_remove')      return _crmJson(_crmWhitelistMutate_('remove', e.parameter));
    if (action === 'whitelist_update')      return _crmJson(_crmWhitelistUpdate_(e.parameter));

    // ─── Audit log tail (dari SYSTEM_LOG sheet, cache 60s) ──
    if (action === 'crm_audit_tail')        return _crmJson({ success: true, logs: _crmAuditTail_(parseInt(e.parameter.limit) || 100) });

    // ─── System Config RAOS: sheet sync only (Supabase mirror di frontend RPC)
    if (action === 'sistem_config_set')     return _crmJson(_crmSistemConfigSetSheet_(e.parameter));

    // ─── User Supabase RAOS proxy (bypass RLS via service_role, admin-only via GAS auth)
    if (action === 'raos_users_list')       return _crmJson(_crmRaosUsersList_(e.parameter));
    if (action === 'raos_users_update')     return _crmJson(_crmRaosUsersUpdate_(e.parameter));
    if (action === 'raos_users_reset_pin')  return _crmJson(_crmRaosUsersResetPin_(e.parameter));

    // ─── CRM Kontak Eksternal (tabel Supabase crm_contacts, service_role via GAS)
    if (action === 'contacts_list')         return _crmJson(_crmContactsList_(e.parameter));
    if (action === 'contacts_upsert')       return _crmJson(_crmContactsUpsert_(e.parameter));
    if (action === 'contacts_delete')       return _crmJson(_crmContactsDelete_(e.parameter));

    return null; // bukan CRM action, delegate ke handler lain di doGet
  } catch (err) {
    return _crmJson({ success: false, message: 'CRM API error: ' + err.message });
  }
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
  var result = _crmSetKV_('company_config', {
    user:  params.user,
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
    key:   'allowed_emails',
    value: next.join(','),
    description: 'Comma-separated emails yang boleh login portal',
  });
  _crmAuditWrite_(params, 'update', 'whitelist', oldEmail + ' → ' + newEmail, before.join(','), next.join(','));
  return { success: true, op: 'update', email: oldEmail, new_email: newEmail, whitelist: next };
}

// ═══════════════════════════════════════════════════════════════════════
// Audit log — pakai sheet SYSTEM_LOG existing (kolom: timestamp, user, action, target, before, after)
// Kalau SYSTEM_LOG tidak ada, auto-create dengan header standar.
// ═══════════════════════════════════════════════════════════════════════
function _crmAuditWrite_(params, action, targetType, targetKey, before, after) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('CRM_AUDIT_LOG');
  if (!sh) {
    sh = ss.insertSheet('CRM_AUDIT_LOG');
    sh.appendRow(['timestamp','actor_email','action','target_type','target_key','before','after','ip','user_agent']);
    sh.setFrozenRows(1);
  }
  sh.appendRow([
    new Date(),
    String(params.user || 'unknown'),
    action,
    targetType,
    targetKey,
    before === null ? '' : String(before),
    after  === null ? '' : String(after),
    String(params.ip || ''),
    String(params.ua || ''),
  ]);
}

function _crmAuditTail_(limit) {
  var sh = SpreadsheetApp.getActive().getSheetByName('CRM_AUDIT_LOG');
  if (!sh) return [];
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  var start = Math.max(2, lastRow - limit + 1);
  var rows = sh.getRange(start, 1, lastRow - start + 1, 9).getValues();
  return rows.reverse().map(function(r) {
    return {
      timestamp: r[0], actor_email: r[1], action: r[2],
      target_type: r[3], target_key: r[4], before: r[5], after: r[6],
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Role check — email harus ada di whitelist DAN role ∈ CRM_WRITE_ROLES
// ═══════════════════════════════════════════════════════════════════════
function _crmRequireAdmin_(params) {
  var email = String(params.user || '').toLowerCase().trim();
  if (!email) throw new Error('Parameter user (email) wajib untuk write action');

  var verified = authVerifyUser(email);
  if (!verified.success) throw new Error('Email ' + email + ' tidak diizinkan');

  var role = String(verified.user && verified.user.role || '').toLowerCase();
  if (CRM_WRITE_ROLES.indexOf(role) === -1) {
    throw new Error('Role ' + role + ' tidak boleh edit CRM (perlu admin/mgmt/direksi)');
  }
  return verified.user;
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
// #3 System Config RAOS — sheet SISTEM CONFIG di RAOS master spreadsheet
// (Supabase mirror ditangani frontend via RPC set_system_config)
// ═══════════════════════════════════════════════════════════════════════
var RAOS_MASTER_SHEET_ID = '1eYS2mM3Sy-BNAVGfp8BUHtsZuLiGDetnJeGw-AWk__8';

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
        _crmAuditWrite_(params, 'edit', 'sistem_config_sheet', key, before, value);
        return { success: true, key: key, value: value, before: before };
      }
    }
    sh.appendRow([key, value, '']);
    _crmAuditWrite_(params, 'add', 'sistem_config_sheet', key, null, value);
    return { success: true, key: key, value: value, appended: true };
  } catch (err) {
    return { success: false, message: 'Sheet write gagal: ' + err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// #4 User Supabase RAOS — proxy ke Supabase (bypass RLS via service_role)
// ═══════════════════════════════════════════════════════════════════════
function _crmRaosUsersList_(params) {
  _crmRequireAdmin_(params);
  // Fetch user_profiles + email dari auth.users via paginate admin API
  var profiles = _crmSbFetch_('GET', '/rest/v1/user_profiles?select=id,staff_id,full_name,role,branch_id,is_active,phone,source,ssot_synced_at&order=full_name.asc');
  if (!Array.isArray(profiles)) profiles = [];

  // Ambil email map dari auth admin users (paginated)
  var emailMap = {};
  var page = 1, perPage = 200, maxPage = 10;
  while (page <= maxPage) {
    var res = _crmSbFetch_('GET', '/auth/v1/admin/users?page=' + page + '&per_page=' + perPage);
    var users = (res && res.users) || [];
    for (var i = 0; i < users.length; i++) emailMap[users[i].id] = users[i].email || '';
    if (users.length < perPage) break;
    page++;
  }

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

  var patch = {};
  if (params.role       !== undefined) patch.role       = String(params.role).toLowerCase();
  if (params.branch_id  !== undefined) patch.branch_id  = params.branch_id === 'null' || params.branch_id === '' ? null : params.branch_id;
  if (params.is_active  !== undefined) patch.is_active  = String(params.is_active) === 'true';
  if (params.full_name  !== undefined) patch.full_name  = String(params.full_name);
  if (params.phone      !== undefined) patch.phone      = String(params.phone);
  if (Object.keys(patch).length === 0) return { success: false, message: 'Tidak ada field yang di-update' };

  var before = _crmSbFetch_('GET', '/rest/v1/user_profiles?id=eq.' + encodeURIComponent(id) + '&select=*');
  if (!Array.isArray(before) || before.length === 0) return { success: false, message: 'User tidak ditemukan' };

  // Warn kalau source ssot_master_staff akan ter-overwrite di sync 1 jam
  var warn = null;
  if (String(before[0].source || '') === 'ssot_master_staff') {
    var protectedKeys = ['role','full_name','phone'];
    for (var k = 0; k < protectedKeys.length; k++) {
      if (patch[protectedKeys[k]] !== undefined) {
        warn = 'PERHATIAN: field ' + protectedKeys[k] + ' akan ter-overwrite sync SSOT 1 jam. Update juga di sheet MASTER DATA STAFF.';
        break;
      }
    }
  }

  var res = _crmSbFetch_('PATCH', '/rest/v1/user_profiles?id=eq.' + encodeURIComponent(id), patch);
  _crmAuditWrite_(params, 'edit', 'raos_user', id, JSON.stringify(before[0]).substring(0, 200), JSON.stringify(patch));
  var out = { success: true, user: (Array.isArray(res) && res[0]) || null };
  if (warn) out.warning = warn;
  return out;
}

function _crmRaosUsersResetPin_(params) {
  _crmRequireAdmin_(params);
  var id  = String(params.id || '').trim();
  var pin = String(params.pin || '').trim();
  if (!id) return { success: false, message: 'Parameter id wajib' };
  if (!/^\d{6,}$/.test(pin)) return { success: false, message: 'PIN harus minimal 6 digit angka' };

  var res = _crmSbFetch_('PUT', '/auth/v1/admin/users/' + encodeURIComponent(id), { password: pin });
  _crmAuditWrite_(params, 'reset_pin', 'raos_user', id, '', 'PIN direset (' + pin.length + ' digit)');
  return { success: true, id: id, email: (res && res.email) || '' };
}

// ═══════════════════════════════════════════════════════════════════════
// #5 CRM Kontak Eksternal — tabel Supabase crm_contacts
// ═══════════════════════════════════════════════════════════════════════
function _crmContactsList_(params) {
  _crmRequireAdmin_(params);
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
  var name = String(params.name || '').trim();
  if (!name) return { success: false, message: 'Nama wajib diisi' };

  var body = {
    name:     name,
    email:    params.email    ? String(params.email).trim().toLowerCase() : null,
    phone:    params.phone    ? String(params.phone).trim() : null,
    company:  params.company  ? String(params.company).trim() : null,
    category: params.category ? String(params.category).trim() : 'lainnya',
    notes:    params.notes    ? String(params.notes) : null,
  };
  // tags: comma-separated string → array
  if (params.tags !== undefined) {
    body.tags = String(params.tags).split(',').map(function(t) { return t.trim(); }).filter(Boolean);
  }

  var id = params.id ? String(params.id).trim() : '';
  var res, action;
  if (id) {
    res = _crmSbFetch_('PATCH', '/rest/v1/crm_contacts?id=eq.' + encodeURIComponent(id), body);
    action = 'edit';
  } else {
    body.created_by = String(params.user || '');
    res = _crmSbFetch_('POST', '/rest/v1/crm_contacts', body);
    action = 'add';
  }
  var row = Array.isArray(res) ? res[0] : res;
  _crmAuditWrite_(params, action, 'contact', (row && row.id) || id || name, id ? name : '', name);
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

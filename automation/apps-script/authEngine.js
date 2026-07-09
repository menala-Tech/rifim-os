/**
 * RIFIM OS — Auth Engine
 * Phase 2 Engine: Authentication & Role-Based Access Control
 *
 * Role hierarchy: ADMIN > DIREKTUR > KOORDINATOR > STAFF > DRIVER
 */

var AUTH_ROLES = {
  ADMIN:       5,
  DIREKTUR:    4,
  KOORDINATOR: 3,
  STAFF:       2,
  DRIVER:      1,
};

var AUTH_PERMISSIONS = {
  'hris.read':          ['STAFF', 'KOORDINATOR', 'DIREKTUR', 'ADMIN'],
  'hris.write':         ['KOORDINATOR', 'DIREKTUR', 'ADMIN'],
  'hris.delete':        ['DIREKTUR', 'ADMIN'],
  'hris.approve_leave': ['KOORDINATOR', 'DIREKTUR', 'ADMIN'],
  'hris.payroll.read':  ['KOORDINATOR', 'DIREKTUR', 'ADMIN'],
  'hris.payroll.write': ['DIREKTUR', 'ADMIN'],
  'document.generate':  ['STAFF', 'KOORDINATOR', 'DIREKTUR', 'ADMIN'],
  'document.delete':    ['DIREKTUR', 'ADMIN'],
  'admin.users':        ['ADMIN'],
};

/**
 * Verifikasi user dan ambil profil (cek allowed_emails dulu, lalu Supabase).
 * @param {string} email
 * @returns {{ success, user: { email, full_name, role, company_code, is_active } }}
 */
function authVerifyUser(email) {
  if (!email) return { success: false, message: 'Email diperlukan.' };
  email = email.toLowerCase().trim();

  var config      = getCompanyConfig();
  var allowedList = _buildAllowedList(config);

  if (allowedList.indexOf(email) === -1) {
    return { success: false, message: 'Email tidak diizinkan.' };
  }

  try {
    var sbUser = _supabaseGetUser(email);
    if (sbUser && sbUser.is_active) {
      _supabaseUpdateLastLogin(sbUser.id);
      return {
        success: true,
        user: {
          email:        sbUser.email,
          full_name:    sbUser.full_name,
          role:         sbUser.role,
          company_code: sbUser.company_code,
          is_active:    sbUser.is_active,
        },
      };
    }
  } catch (e) {
    console.warn('AuthEngine Supabase unavailable, fallback to config:', e.message);
  }

  // Fallback: user ada di config tapi belum di tabel users
  return {
    success: true,
    user: {
      email:        email,
      full_name:    config.director_name || 'Admin',
      role:         'ADMIN',
      company_code: 'ALL',
      is_active:    true,
    },
  };
}

/**
 * Cek apakah user punya permission tertentu.
 * @param {string} email
 * @param {string} permission - mis: 'hris.write'
 * @returns {boolean}
 */
function authHasPermission(email, permission) {
  var result = authVerifyUser(email);
  if (!result.success || !result.user.is_active) return false;
  var allowed = AUTH_PERMISSIONS[permission] || [];
  return allowed.indexOf(result.user.role) > -1;
}

/**
 * Tambah atau update user di tabel Supabase.
 * @param {{ email, full_name, role, company_code }} userData
 */
function authUpsertUser(userData) {
  var cfg = _getSupabaseConfig();
  var url = cfg.url + '/rest/v1/users?on_conflict=email';
  UrlFetchApp.fetch(url, {
    method:             'POST',
    headers:            {
      'apikey':       cfg.key,
      'Authorization': 'Bearer ' + cfg.key,
      'Content-Type': 'application/json',
      'Prefer':       'resolution=merge-duplicates',
    },
    payload:            JSON.stringify({
      email:        userData.email.toLowerCase().trim(),
      full_name:    userData.full_name,
      role:         userData.role        || 'STAFF',
      company_code: userData.company_code || 'RIFIM',
      is_active:    true,
      updated_at:   new Date().toISOString(),
    }),
    muteHttpExceptions: true,
  });
}

// ─── Private ────────────────────────────────────────────────────

function _buildAllowedList(config) {
  var list = [];
  if (config.company_email) list.push(config.company_email.toLowerCase().trim());
  if (config.allowed_emails) {
    config.allowed_emails.split(',').forEach(function(e) {
      var t = e.toLowerCase().trim();
      if (t) list.push(t);
    });
  }
  return list;
}

function _supabaseGetUser(email) {
  var cfg = _getSupabaseConfig();
  var url = cfg.url + '/rest/v1/users?email=eq.' + encodeURIComponent(email) + '&select=*&limit=1';
  var res = UrlFetchApp.fetch(url, {
    method:             'GET',
    headers:            { 'apikey': cfg.key, 'Authorization': 'Bearer ' + cfg.key },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) return null;
  var rows = JSON.parse(res.getContentText());
  return rows.length > 0 ? rows[0] : null;
}

function _supabaseUpdateLastLogin(userId) {
  try {
    var cfg = _getSupabaseConfig();
    var url = cfg.url + '/rest/v1/users?id=eq.' + userId;
    UrlFetchApp.fetch(url, {
      method:             'PATCH',
      headers:            {
        'apikey':        cfg.key,
        'Authorization': 'Bearer ' + cfg.key,
        'Content-Type':  'application/json',
      },
      payload:            JSON.stringify({ last_login: new Date().toISOString() }),
      muteHttpExceptions: true,
    });
  } catch (e) { /* non-critical */ }
}

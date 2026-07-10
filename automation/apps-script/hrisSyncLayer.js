/**
 * RIFIM OS — HRIS Sync Layer
 * Sinkronisasi data karyawan dari Supabase → Google Spreadsheet.
 * Sheet 'employees' dipakai Smart Office sebagai referensi data karyawan.
 */

var EMPLOYEES_SHEET_NAME = 'employees';

var EMPLOYEES_HEADERS = [
  'employee_id', 'full_name', 'email', 'phone',
  'company_code', 'employment_type', 'position',
  'department', 'branch', 'join_date', 'end_date',
  'salary_base', 'status', 'updated_at',
];

/**
 * Jalankan sekali di GAS Editor untuk membuat/mereset sheet employees.
 * Aman dijalankan berulang — hanya buat jika belum ada.
 */
function setupEmployeesSheet() {
  var ss    = _getDB();
  var sheet = ss.getSheetByName(EMPLOYEES_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(EMPLOYEES_SHEET_NAME);
    Logger.log('Sheet employees dibuat.');
  } else {
    sheet.clearContents();
    Logger.log('Sheet employees direset.');
  }
  sheet.getRange(1, 1, 1, EMPLOYEES_HEADERS.length).setValues([EMPLOYEES_HEADERS]);
  sheet.setFrozenRows(1);
  Logger.log('Setup sheet employees selesai.');
}

/**
 * Sinkronisasi semua karyawan dari Supabase ke sheet employees.
 * Dipanggil otomatis setelah add/update/resign karyawan.
 * @returns {{ synced: number }}
 */
function syncHrisEmployeesToSheet() {
  var employees = hrisGetEmployees({ limit: 1000 });
  var ss        = _getDB();
  var sheet     = ss.getSheetByName(EMPLOYEES_SHEET_NAME);
  if (!sheet) {
    setupEmployeesSheet();
    sheet = ss.getSheetByName(EMPLOYEES_SHEET_NAME);
  }

  // Hapus data lama (baris 2 dst), biarkan header
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, EMPLOYEES_HEADERS.length).clearContent();
  }

  if (!employees || employees.length === 0) return { synced: 0 };

  var rows = employees.map(function(emp) {
    return EMPLOYEES_HEADERS.map(function(col) {
      var val = emp[col];
      return (val === null || val === undefined) ? '' : String(val);
    });
  });

  sheet.getRange(2, 1, rows.length, EMPLOYEES_HEADERS.length).setValues(rows);
  Logger.log('Sync selesai: ' + rows.length + ' karyawan.');
  return { synced: rows.length };
}

// ─── ACTIVITY LOG ────────────────────────────────────────────────────────────

var ACTIVITY_LOG_SHEET_NAME = 'activity_log';
var ACTIVITY_LOG_HEADERS = [
  'timestamp', 'module', 'action', 'target_id',
  'target_name', 'performed_by_name', 'performed_by_email', 'detail',
];

/**
 * Jalankan sekali di GAS Editor untuk membuat sheet activity_log.
 * Aman dijalankan berulang — hanya tambah header jika sheet kosong.
 */
function setupActivityLogSheet() {
  var ss    = _getDB();
  var sheet = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ACTIVITY_LOG_SHEET_NAME);
    Logger.log('Sheet activity_log dibuat.');
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, ACTIVITY_LOG_HEADERS.length).setValues([ACTIVITY_LOG_HEADERS]);
    sheet.setFrozenRows(1);
  }
  Logger.log('Setup sheet activity_log selesai.');
}

/**
 * Catat satu baris aktivitas. Gagal diam-diam — tidak boleh batalkan operasi utama.
 * @param {string} module          - 'Portal' | 'HRIS' | 'Smart Office'
 * @param {string} action          - 'LOGIN' | 'LOGOUT' | 'TAMBAH' | 'EDIT' | 'RESIGN' | 'PHK' | 'BUAT DOKUMEN'
 * @param {string} targetId        - employee_id / document_number
 * @param {string} targetName      - nama karyawan / judul dokumen
 * @param {string} performedByName - nama user yang melakukan
 * @param {string} performedByEmail
 * @param {string} detail          - keterangan tambahan (field yang diubah, tipe dokumen, dsb)
 */
function logActivity(module, action, targetId, targetName, performedByName, performedByEmail, detail) {
  try {
    var ss    = _getDB();
    var sheet = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
    if (!sheet) {
      setupActivityLogSheet();
      sheet = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
    }
    var tsStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([
      tsStr,
      module           || '',
      action           || '',
      targetId         || '',
      targetName       || '',
      performedByName  || '',
      performedByEmail || '',
      detail           || '',
    ]);
  } catch (e) {
    console.warn('logActivity gagal:', e.message);
  }
}

/**
 * Ambil daftar karyawan dari sheet (dipakai Smart Office untuk dokumen).
 * @returns {Array<{ id, nama, jabatan, cabang, email, company_code, status }>}
 */
function getEmployeesFromSheet() {
  var ss    = _getDB();
  var sheet = ss.getSheetByName(EMPLOYEES_SHEET_NAME);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var headers = data[0];
  var idx     = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  var list = [];
  for (var i = 1; i < data.length; i++) {
    var row  = data[i];
    var nama = String(row[idx['full_name']] || '').trim();
    if (!nama) continue;
    list.push({
      id:           String(row[idx['employee_id']]   || '').trim(),
      nama:         nama,
      jabatan:      String(row[idx['position']]      || '').trim(),
      department:   String(row[idx['department']]    || '').trim(),
      cabang:       String(row[idx['branch']]        || '').trim(),
      email:        String(row[idx['email']]         || '').trim(),
      company_code: String(row[idx['company_code']]  || '').trim(),
      status:       String(row[idx['status']]        || '').trim(),
      salary_base:  String(row[idx['salary_base']]   || '').trim(),
      join_date:    String(row[idx['join_date']]     || '').trim(),
    });
  }
  return list;
}

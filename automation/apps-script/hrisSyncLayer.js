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
    });
  }
  return list;
}

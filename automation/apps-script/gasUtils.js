/**
 * RIFIM OS — GAS Utilities
 * ─────────────────────────────────────────────────────────────────
 * Utilitas bersama untuk seluruh modul GAS:
 *   1. Timestamp standar ISO UTC
 *   2. LockService wrapper (anti race-condition)
 *   3. Validasi schema input
 *   4. System log (audit trail + error logging)
 *
 * CATATAN PEMUATAN: GAS menyusun file ALFABETIK saat runtime.
 * "gasUtils.js" (g) dimuat sebelum semua file yang mulai dengan h-z,
 * jadi semua fungsi di sini sudah tersedia untuk file lain.
 */

// ══════════════════════════════════════════════════════════════════
// 1. TIMESTAMP — ISO 8601 UTC
// ══════════════════════════════════════════════════════════════════

/**
 * Kembalikan timestamp ISO 8601 UTC.
 * WAJIB dipakai untuk semua kolom storage: Timestamp, created_at, updated_at.
 * Contoh output: "2026-07-13T08:30:00.000Z"
 *
 * MENGAPA ISO UTC?
 * - Bisa di-parse oleh new Date() tanpa ambiguitas timezone
 * - Sortable secara leksikografik
 * - Kompatibel langsung dengan Supabase & Postgres TIMESTAMPTZ
 * - _monParseTs() sudah handle ISO via fallback new Date(s)
 */
function _gasNow() {
  return new Date().toISOString();
}

/**
 * Tanggal lokal (timezone spreadsheet) untuk kolom Tanggal yang bukan
 * timestamp penuh — mis. kolom B Antrian Bandara.
 * Output: "2026-07-13"
 */
function _gasToday(ss) {
  return Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
}

/**
 * Waktu lokal untuk display — mis. jam masuk antrian, jam absen.
 * Output: "08:30"
 * JANGAN simpan ini sebagai satu-satunya timestamp — pakai _gasNow() untuk storage.
 */
function _gasTimeDisplay(ss) {
  return Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'HH:mm');
}

// ══════════════════════════════════════════════════════════════════
// 2. UUID / UNIQUE ID
// ══════════════════════════════════════════════════════════════════

/**
 * Generate UUID v4 via GAS Utilities.getUuid().
 * Gunakan untuk kolom ID baris baru (Antrian, dokumen, dsb).
 * Output: "110e8400-e29b-41d4-a716-446655440000"
 *
 * Mengganti pola lama: 'Q-' + formatDate(now, tz, 'yyMMdd-HHmmss')
 * yang tidak dijamin unik saat 2 request masuk pada detik yang sama.
 */
function _gasUuid() {
  return Utilities.getUuid();
}

// ══════════════════════════════════════════════════════════════════
// 3. LOCK SERVICE — Proteksi race condition
// ══════════════════════════════════════════════════════════════════

/**
 * Jalankan fn() di dalam ScriptLock — mencegah 2+ request PWA menulis
 * ke sheet yang sama secara bersamaan (race condition → baris tumpang tindih).
 *
 * Pattern wajib untuk semua write operation (appendRow, setValue, setValues):
 *   return _gasWithLock(function() {
 *     sh.appendRow([...]);
 *     return { ok: true };
 *   });
 *
 * @param {Function} fn       - Operasi tulis yang akan dilindungi
 * @param {number}  [ms=10000] - Maks tunggu lock (ms). Default 10 detik.
 * @returns {*} Return value dari fn()
 * @throws  Jika lock tidak bisa didapat dalam timeout (tangkap di pemanggil)
 */
function _gasWithLock(fn, ms) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(ms || 10000);
    return fn();
  } finally {
    // WAJIB: releaseLock() di finally agar lock tidak menggantung
    // walau fn() lempar exception.
    lock.releaseLock();
  }
}

// ══════════════════════════════════════════════════════════════════
// 4. SYSTEM LOG — Audit trail + error logging
// ══════════════════════════════════════════════════════════════════

var _SYS_LOG_SHEET = 'system_log';
var _SYS_LOG_HDR   = [
  'timestamp_utc', 'source', 'action', 'level', 'message', 'payload_json'
];

/**
 * Tulis satu baris ke sheet system_log.
 *
 * @param {string} source   - Modul/PWA asal: 'Staff PWA', 'HRIS', 'Smart Office'
 * @param {string} action   - Nama fungsi: 'staffAbsensi', 'queueAdd', 'doPost'
 * @param {string} level    - 'INFO' | 'WARN' | 'ERROR'
 * @param {string} message  - Deskripsi singkat
 * @param {*}      [payload]- Data mentah (JSON-safe, dipotong di 2000 karakter)
 */
function _gasLog(source, action, level, message, payload) {
  try {
    var ss = SpreadsheetApp.openById(RAOS_SS_ID);
    var sh = _gasEnsureLogSheet(ss);
    var payloadStr = '';
    if (payload !== undefined) {
      try   { payloadStr = JSON.stringify(payload).substring(0, 2000); }
      catch (e) { payloadStr = String(payload).substring(0, 2000); }
    }
    sh.appendRow([
      _gasNow(),
      String(source  || ''),
      String(action  || ''),
      String(level   || 'INFO'),
      String(message || ''),
      payloadStr,
    ]);
  } catch (logErr) {
    // Jangan crash sistem utama karena logging gagal
    console.error('[RIFIM OS] system_log write failed: ' + logErr.message);
  }
}

/** Shorthand: log level ERROR. Panggil dari catch block. */
function _gasLogError(source, action, err, payload) {
  _gasLog(source, action, 'ERROR',
    String(err && err.message ? err.message : err), payload);
}

/** Shorthand: log level WARN. */
function _gasLogWarn(source, action, message, payload) {
  _gasLog(source, action, 'WARN', message, payload);
}

/** Shorthand: log level INFO. */
function _gasLogInfo(source, action, message, payload) {
  _gasLog(source, action, 'INFO', message, payload);
}

/** Pastikan sheet system_log ada; buat kalau belum. */
function _gasEnsureLogSheet(ss) {
  var sh = ss.getSheetByName(_SYS_LOG_SHEET);
  if (sh) return sh;
  sh = ss.insertSheet(_SYS_LOG_SHEET);
  sh.getRange(1, 1, 1, _SYS_LOG_HDR.length).setValues([_SYS_LOG_HDR])
    .setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 230); // timestamp
  sh.setColumnWidth(5, 280); // message
  sh.setColumnWidth(6, 500); // payload
  return sh;
}

/**
 * Buat / reset sheet system_log.
 * Jalankan SEKALI dari GAS Editor: pilih gasUtils.js → setupSystemLog → Run.
 */
function setupSystemLog() {
  var ss = SpreadsheetApp.openById(RAOS_SS_ID);
  var existing = ss.getSheetByName(_SYS_LOG_SHEET);
  if (existing) {
    Logger.log('⚠️  system_log sudah ada (' + (existing.getLastRow() - 1) + ' baris). Tidak di-reset.');
    return;
  }
  _gasEnsureLogSheet(ss);
  Logger.log('✅ sheet system_log dibuat.');
}

// ══════════════════════════════════════════════════════════════════
// 5. VALIDASI — Schema-based input sanitization
// ══════════════════════════════════════════════════════════════════

/**
 * Validasi obj terhadap schema. Kembalikan array pesan error (kosong = valid).
 *
 * Schema field options:
 *   required : boolean   — field wajib ada & tidak kosong
 *   type     : 'string' | 'number' | 'integer' — tipe paksa
 *   min      : number    — nilai minimum (number/integer)
 *   max      : number    — nilai maksimum (number/integer)
 *   enum     : string[]  — nilai harus salah satu dari list
 *   regex    : RegExp    — pattern test (string)
 *   maxLen   : number    — panjang maksimum string
 *
 * Contoh:
 *   var errs = _gasValidate(params, {
 *     nominal:  { required: true, type: 'integer', min: 1000, max: 10000000 },
 *     loginId:  { required: true, type: 'string',  regex: /^\d+$/ },
 *     keputusan:{ required: true, enum: ['VALID','TOLAK'] },
 *   });
 *   if (errs.length) return { ok: false, error: errs.join('; ') };
 *
 * @param {Object} obj    - Payload dari PWA
 * @param {Object} schema - Definisi aturan
 * @returns {string[]}    - Array pesan error; kosong = valid
 */
function _gasValidate(obj, schema) {
  var errors = [];
  var keys   = Object.keys(schema);
  for (var ki = 0; ki < keys.length; ki++) {
    var key  = keys[ki];
    var rule = schema[key];
    var val  = obj[key];
    var empty = (val === undefined || val === null || String(val).trim() === '');

    if (rule.required && empty) {
      errors.push('"' + key + '" wajib diisi');
      continue;
    }
    if (empty) continue; // opsional & kosong → skip rules lain

    if (rule.type === 'number' || rule.type === 'integer') {
      var n = Number(val);
      if (isNaN(n)) {
        errors.push('"' + key + '" harus berupa angka');
        continue;
      }
      if (rule.type === 'integer' && !Number.isInteger(n)) {
        errors.push('"' + key + '" harus bilangan bulat (tanpa desimal)');
      }
      if (rule.min !== undefined && n < rule.min) {
        errors.push('"' + key + '" minimal ' + rule.min);
      }
      if (rule.max !== undefined && n > rule.max) {
        errors.push('"' + key + '" maksimal ' + rule.max);
      }
    }

    if (rule.type === 'string' || rule.type === undefined) {
      var s = String(val);
      if (rule.maxLen && s.length > rule.maxLen) {
        errors.push('"' + key + '" maksimal ' + rule.maxLen + ' karakter');
      }
      if (rule.regex && !rule.regex.test(s)) {
        errors.push('"' + key + '" format tidak valid');
      }
    }

    if (rule.enum && rule.enum.indexOf(String(val).trim().toUpperCase()) === -1
        && rule.enum.indexOf(val) === -1) {
      errors.push('"' + key + '" harus salah satu dari: ' + rule.enum.join(', '));
    }
  }
  return errors;
}

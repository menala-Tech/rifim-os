/**
 * RIFIM OS — Staff App API
 * Backend API untuk Staff PWA (apps/pwa/staff-app).
 *
 * Endpoint (via doPost webApp.js → routing action):
 *   staffLogin          — login ID Staff + PIN (dari Database Staff sheet)
 *   staffSaldoSubmit    — input top-up saldo driver → Form Input Saldo PWA
 *   staffSaldoRiwayat   — riwayat pengisian bulan berjalan per staff (+ target)
 *   staffSaldoMonitor   — [Koordinator] monitoring saldo per cabang hari ini
 *   staffSaldoValidasi  — [Koordinator] validasi/tolak entry saldo
 *   staffAbsensi        — check-in/check-out geofence + foto
 *   staffAbsensiStatus  — status absensi hari ini
 *   queueList           — daftar antrian bandara per cabang
 *   queueAdd            — tambah driver ke antrian
 *   queueUpdate         — update status antrian (CALLED/PICKED/DONE/CANCEL)
 *
 * Sheet yang dipakai:
 *   Database Staff        — auth (sync dari Supabase, JANGAN edit manual)
 *   Form Input Saldo PWA  — transaksi saldo (sudah ada via setupRaosSheets)
 *   Absensi Staff         — absensi harian (dibuat via setupStaffAppSheets)
 *   Antrian Bandara       — queue driver airport (dibuat via setupStaffAppSheets)
 *
 * SETUP AWAL (jalankan SEKALI di GAS Editor):
 *   setupStaffAppSheets()
 */

// ── Konstanta kolom Form Input Saldo PWA (1-based) ─────────────────
// A=Timestamp, B=Cabang, C=Nama Staff, D=Nominal, E=ID Login Driver,
// F=Nama Driver, G=Sudah Diisi, H=Alert Terkirim, I=Alert Terakhir,
// J=Validasi, K=Validator, L=Validated At   ← kolom J-L ditambah setupStaffAppSheets()
var _SA_SALDO_COL = {
  TIMESTAMP: 1, CABANG: 2, NAMA_STAFF: 3, NOMINAL: 4, LOGIN_ID: 5,
  NAMA_DRIVER: 6, SUDAH_DIISI: 7, ALERT: 8, ALERT_TERAKHIR: 9,
  VALIDASI: 10, VALIDATOR: 11, VALIDATED_AT: 12,
};
var _SA_SALDO_SHEET   = 'Form Input Saldo PWA';
var _SA_ABSENSI_SHEET = 'Absensi Staff';
var _SA_QUEUE_SHEET   = 'Antrian Bandara';
var _SA_STAFF_SHEET   = 'Database Staff';
var _SA_DATA_START    = 3; // row 1 = header, row 2 = note

// Radius geofence absensi default (meter) — bisa dioverride per cabang di GEOFENCE_CABANG
var _SA_GEOFENCE_RADIUS_M = 300;

// ══════════════════════════════════════════════════════════════════
// SETUP
// ══════════════════════════════════════════════════════════════════

/**
 * Buat sheet Absensi Staff + Antrian Bandara, dan tambah kolom
 * Validasi (J-L) di Form Input Saldo PWA. Jalankan SEKALI.
 */
function setupStaffAppSheets() {
  var ss = SpreadsheetApp.openById(RAOS_SS_ID);

  // ── 1. Absensi Staff ────────────────────────────────────────────
  var shAbs = ss.getSheetByName(_SA_ABSENSI_SHEET);
  if (!shAbs) {
    shAbs = ss.insertSheet(_SA_ABSENSI_SHEET);
    var hAbs = ['Timestamp', 'Tanggal', 'ID Staff', 'Nama', 'Cabang',
                'Tipe', 'Latitude', 'Longitude', 'Jarak (m)', 'Dalam Area', 'Foto URL'];
    shAbs.getRange(1, 1, 1, hAbs.length).setValues([hAbs])
      .setFontWeight('bold').setBackground('#46BDC6').setFontColor('#FFFFFF');
    shAbs.getRange(2, 1, 1, hAbs.length).merge()
      .setValue('ℹ️  Absensi staff via Staff PWA. Tipe: MASUK / PULANG. Diisi otomatis oleh sistem.')
      .setFontStyle('italic').setFontColor('#888888');
    shAbs.setFrozenRows(1);
    Logger.log('✅ Sheet dibuat: ' + _SA_ABSENSI_SHEET);
  }

  // ── 2. Antrian Bandara ──────────────────────────────────────────
  var shQ = ss.getSheetByName(_SA_QUEUE_SHEET);
  if (!shQ) {
    shQ = ss.insertSheet(_SA_QUEUE_SHEET);
    var hQ = ['ID', 'Tanggal', 'Cabang', 'ID Driver', 'Nama Driver',
              'Status', 'Masuk Antrian', 'Dipanggil', 'Selesai', 'Oleh Staff'];
    shQ.getRange(1, 1, 1, hQ.length).setValues([hQ])
      .setFontWeight('bold').setBackground('#4285F4').setFontColor('#FFFFFF');
    shQ.getRange(2, 1, 1, hQ.length).merge()
      .setValue('ℹ️  Antrian driver airport. Status: WAITING → CALLED → PICKED → DONE / CANCEL.')
      .setFontStyle('italic').setFontColor('#888888');
    shQ.setFrozenRows(1);
    Logger.log('✅ Sheet dibuat: ' + _SA_QUEUE_SHEET);
  }

  // ── 3. Kolom validasi J-L di Form Input Saldo PWA ───────────────
  var shSaldo = ss.getSheetByName(_SA_SALDO_SHEET);
  if (shSaldo) {
    var hVal = [['Validasi', 'Validator', 'Validated At']];
    shSaldo.getRange(1, _SA_SALDO_COL.VALIDASI, 1, 3).setValues(hVal)
      .setFontWeight('bold').setBackground('#34A853').setFontColor('#FFFFFF');
    Logger.log('✅ Kolom Validasi (J-L) ditambahkan di ' + _SA_SALDO_SHEET);
  } else {
    Logger.log('⚠️ Sheet "' + _SA_SALDO_SHEET + '" belum ada — jalankan setupRaosSheets() dulu.');
  }

  Logger.log('Setup Staff App selesai.');
}

// ══════════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════════

/**
 * Login staff dengan ID Staff + PIN.
 * Sumber: sheet Database Staff (kolom: A=ID Staff, B=Nama, C=Jabatan,
 * D=ID Cabang, E=Nama Cabang, F=Gaji, G=No WA, H=Email, I=Pin, J=Status).
 * @returns {object} { ok, staff: {id, nama, jabatan, cabang, role} }
 */
function staffLogin(params) {
  var staffId = String(params.staffId || '').trim().toUpperCase();
  var pin     = String(params.pin || '').trim();
  if (!staffId || !pin) return { ok: false, error: 'ID Staff dan PIN wajib diisi.' };

  var ss = SpreadsheetApp.openById(RAOS_SS_ID);
  var sh = ss.getSheetByName(_SA_STAFF_SHEET);
  if (!sh) return { ok: false, error: 'Database Staff belum tersedia.' };

  var lastRow = sh.getLastRow();
  if (lastRow < _SA_DATA_START) return { ok: false, error: 'Database Staff kosong.' };

  var data = sh.getRange(_SA_DATA_START, 1, lastRow - _SA_DATA_START + 1, 10).getValues();
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (String(row[0]).trim().toUpperCase() !== staffId) continue;

    if (String(row[9]).trim().toUpperCase() !== 'AKTIF') {
      return { ok: false, error: 'Akun tidak aktif. Hubungi admin.' };
    }
    if (String(row[8]).trim() !== pin) {
      return { ok: false, error: 'PIN salah.' };
    }

    var jabatan = String(row[2] || '').trim().toUpperCase();
    return {
      ok: true,
      staff: {
        id      : String(row[0]).trim(),
        nama    : String(row[1]).trim(),
        jabatan : jabatan,
        cabang  : String(row[4] || row[3] || '').trim(),
        role    : jabatan.indexOf('KOORDINATOR') > -1 ? 'KOORDINATOR' : 'STAFF',
      }
    };
  }
  return { ok: false, error: 'ID Staff tidak ditemukan.' };
}

// ══════════════════════════════════════════════════════════════════
// SALDO — INPUT & RIWAYAT
// ══════════════════════════════════════════════════════════════════

/**
 * Submit pengajuan top-up saldo driver → append ke Form Input Saldo PWA.
 * Nama Driver auto-lookup dari _cariDriverByLoginId() (raosPotonganEngine.js).
 */
function staffSaldoSubmit(params) {
  var cabang    = String(params.cabang || '').trim();
  var namaStaff = String(params.namaStaff || '').trim();
  var nominal   = Number(params.nominal) || 0;
  var loginId   = String(params.loginId || '').trim();

  if (!cabang || !namaStaff || !loginId) return { ok: false, error: 'Data tidak lengkap.' };
  if (nominal < 1000) return { ok: false, error: 'Nominal minimal Rp 1.000.' };

  var driver = _cariDriverByLoginId(loginId);
  var namaDriver = driver ? driver.nama : 'TIDAK DITEMUKAN';

  var ss = SpreadsheetApp.openById(RAOS_SS_ID);
  var sh = ss.getSheetByName(_SA_SALDO_SHEET);
  if (!sh) return { ok: false, error: 'Sheet ' + _SA_SALDO_SHEET + ' tidak ditemukan.' };

  var tz    = ss.getSpreadsheetTimeZone();
  var tsStr = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm:ss');

  sh.appendRow([
    tsStr, cabang, namaStaff, nominal, loginId, namaDriver,
    false, false, '', 'PENDING', '', ''
  ]);

  return {
    ok: true,
    namaDriver: namaDriver,
    driverDitemukan: !!driver,
    timestamp: tsStr,
  };
}

/**
 * Riwayat pengisian saldo bulan berjalan untuk satu staff.
 * @returns { ok, riwayat: [...], totalBulanIni, jumlahTransaksi }
 */
function staffSaldoRiwayat(params) {
  var namaStaff = String(params.namaStaff || '').trim().toLowerCase();
  if (!namaStaff) return { ok: false, error: 'Nama staff wajib.' };

  var ss = SpreadsheetApp.openById(RAOS_SS_ID);
  var sh = ss.getSheetByName(_SA_SALDO_SHEET);
  if (!sh) return { ok: false, error: 'Sheet tidak ditemukan.' };

  var tz     = ss.getSpreadsheetTimeZone();
  var now    = new Date();
  var bulan  = now.getMonth();
  var tahun  = now.getFullYear();

  var lastRow = sh.getLastRow();
  var riwayat = [];
  var total   = 0;

  if (lastRow >= _SA_DATA_START) {
    var data = sh.getRange(_SA_DATA_START, 1, lastRow - _SA_DATA_START + 1, 12).getValues();
    data.forEach(function(row) {
      if (String(row[_SA_SALDO_COL.NAMA_STAFF - 1]).trim().toLowerCase() !== namaStaff) return;
      var tgl = _monParseTs(row[0]);
      if (!tgl || tgl.getMonth() !== bulan || tgl.getFullYear() !== tahun) return;

      var nominal  = Number(row[_SA_SALDO_COL.NOMINAL - 1]) || 0;
      var validasi = String(row[_SA_SALDO_COL.VALIDASI - 1] || 'PENDING').trim();
      var diisi    = row[_SA_SALDO_COL.SUDAH_DIISI - 1] === true;

      riwayat.push({
        tanggal   : Utilities.formatDate(tgl, tz, 'dd/MM HH:mm'),
        loginId   : String(row[_SA_SALDO_COL.LOGIN_ID - 1]),
        namaDriver: String(row[_SA_SALDO_COL.NAMA_DRIVER - 1]),
        nominal   : nominal,
        validasi  : validasi,
        sudahDiisi: diisi,
      });
      if (validasi !== 'TOLAK') total += nominal;
    });
  }

  riwayat.reverse(); // terbaru dulu
  return { ok: true, riwayat: riwayat, totalBulanIni: total, jumlahTransaksi: riwayat.length };
}

// ══════════════════════════════════════════════════════════════════
// SALDO — MONITORING & VALIDASI (KOORDINATOR)
// ══════════════════════════════════════════════════════════════════

/**
 * Monitoring saldo hari ini per cabang — untuk Koordinator.
 * @returns { ok, entries: [...], ringkasan: {total, nominal, pending} }
 */
function staffSaldoMonitor(params) {
  var cabang = String(params.cabang || '').trim().toLowerCase();

  var ss = SpreadsheetApp.openById(RAOS_SS_ID);
  var sh = ss.getSheetByName(_SA_SALDO_SHEET);
  if (!sh) return { ok: false, error: 'Sheet tidak ditemukan.' };

  var tz    = ss.getSpreadsheetTimeZone();
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  var lastRow = sh.getLastRow();
  var entries = [];
  var totalNominal = 0, pending = 0;

  if (lastRow >= _SA_DATA_START) {
    var data = sh.getRange(_SA_DATA_START, 1, lastRow - _SA_DATA_START + 1, 12).getValues();
    data.forEach(function(row, idx) {
      var tgl = _monParseTs(row[0]);
      if (!tgl || Utilities.formatDate(tgl, tz, 'yyyy-MM-dd') !== today) return;
      if (cabang && String(row[_SA_SALDO_COL.CABANG - 1]).trim().toLowerCase() !== cabang) return;

      var nominal  = Number(row[_SA_SALDO_COL.NOMINAL - 1]) || 0;
      var validasi = String(row[_SA_SALDO_COL.VALIDASI - 1] || 'PENDING').trim();

      entries.push({
        row       : idx + _SA_DATA_START,
        jam       : Utilities.formatDate(tgl, tz, 'HH:mm'),
        namaStaff : String(row[_SA_SALDO_COL.NAMA_STAFF - 1]),
        loginId   : String(row[_SA_SALDO_COL.LOGIN_ID - 1]),
        namaDriver: String(row[_SA_SALDO_COL.NAMA_DRIVER - 1]),
        nominal   : nominal,
        validasi  : validasi,
        sudahDiisi: row[_SA_SALDO_COL.SUDAH_DIISI - 1] === true,
      });
      totalNominal += nominal;
      if (validasi === 'PENDING') pending++;
    });
  }

  entries.reverse();
  return {
    ok: true, entries: entries,
    ringkasan: { total: entries.length, nominal: totalNominal, pending: pending }
  };
}

/**
 * Validasi / tolak entry saldo — Koordinator only.
 * @param params { row, keputusan: 'VALID'|'TOLAK', validator }
 */
function staffSaldoValidasi(params) {
  var row       = Number(params.row) || 0;
  var keputusan = String(params.keputusan || '').trim().toUpperCase();
  var validator = String(params.validator || '').trim();

  if (row < _SA_DATA_START) return { ok: false, error: 'Baris tidak valid.' };
  if (keputusan !== 'VALID' && keputusan !== 'TOLAK') {
    return { ok: false, error: 'Keputusan harus VALID atau TOLAK.' };
  }

  var ss = SpreadsheetApp.openById(RAOS_SS_ID);
  var sh = ss.getSheetByName(_SA_SALDO_SHEET);
  if (!sh) return { ok: false, error: 'Sheet tidak ditemukan.' };

  var tz    = ss.getSpreadsheetTimeZone();
  var tsStr = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm:ss');

  sh.getRange(row, _SA_SALDO_COL.VALIDASI, 1, 3).setValues([[keputusan, validator, tsStr]]);
  return { ok: true, keputusan: keputusan };
}

// ══════════════════════════════════════════════════════════════════
// ABSENSI
// ══════════════════════════════════════════════════════════════════

/**
 * Koordinat cabang untuk geofence — dari PropertiesService.
 * Format property GEOFENCE_CABANG (JSON):
 *   {"ID Rifim Airport Batam": {"lat": 1.1229, "lng": 104.1139, "radius": 1000}, ...}
 * Nilai null = cabang belum punya koordinat (absensi jalan, status "TIDAK DICEK").
 * Setup: jalankan setupGeofenceCabang() SEKALI dari GAS Editor.
 * @returns {{lat: number, lng: number, radius: number}|null}
 */
function _saGetGeofence(cabang) {
  var raw = PropertiesService.getScriptProperties().getProperty('GEOFENCE_CABANG');
  if (!raw) return null;
  try {
    var g = JSON.parse(raw)[cabang];
    if (!g) return null;
    // Dukung format lama [lat, lng] dan format baru {lat, lng, radius}
    if (Array.isArray(g)) return { lat: g[0], lng: g[1], radius: _SA_GEOFENCE_RADIUS_M };
    return { lat: g.lat, lng: g.lng, radius: g.radius || _SA_GEOFENCE_RADIUS_M };
  } catch (e) { return null; }
}

/**
 * Simpan koordinat geofence semua cabang ke PropertiesService.
 * Jalankan SEKALI dari GAS Editor (file: staffAppApi.js).
 * Koordinat bandara = data publik, aman disimpan di kode.
 * Cabang bernilai null belum punya koordinat counter — absensi tetap jalan
 * dengan status "TIDAK DICEK" sampai koordinatnya diisi.
 */
function setupGeofenceCabang() {
  var geofence = {
    'ID Rifim Airport Batam':      { lat: 1.1229474611566184,  lng: 104.11399999608159, radius: 1000 },
    'ID Rifim Airport Jambi':      { lat: -1.6315198788190148, lng: 103.6438881064391,  radius: 1000 },
    'ID Rifim Airport Balikpapan': { lat: -1.2613140099073543, lng: 116.89823585376726, radius: 1000 },
    'ID Rifim Airport Manado':     { lat: 1.5432943843910787,  lng: 124.92259315566997, radius: 1000 },
    'ID Rifim Airport Pekanbaru':  { lat: 0.46502090112651967, lng: 101.44852194619506, radius: 1000 },
    'ID Rifim Batam':      null, // TODO: belum ada koordinat counter
    'ID Rifim Jambi Luar': null, // TODO: belum ada koordinat counter
  };
  PropertiesService.getScriptProperties()
    .setProperty('GEOFENCE_CABANG', JSON.stringify(geofence));

  var terisi = Object.keys(geofence).filter(function(k) { return geofence[k]; });
  Logger.log('✅ GEOFENCE_CABANG tersimpan.');
  Logger.log('   Terisi (' + terisi.length + '): ' + terisi.join(', '));
  Logger.log('   Belum ada koordinat: ID Rifim Batam, ID Rifim Jambi Luar');
}

/** Haversine — jarak antar 2 koordinat dalam meter. */
function _saJarakMeter(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Absensi check-in / check-out.
 * @param params { staffId, nama, cabang, tipe: 'MASUK'|'PULANG', lat, lng, fotoBase64? }
 */
function staffAbsensi(params) {
  var staffId = String(params.staffId || '').trim();
  var nama    = String(params.nama || '').trim();
  var cabang  = String(params.cabang || '').trim();
  var tipe    = String(params.tipe || '').trim().toUpperCase();
  var lat     = Number(params.lat);
  var lng     = Number(params.lng);

  if (!staffId || !tipe) return { ok: false, error: 'Data tidak lengkap.' };
  if (tipe !== 'MASUK' && tipe !== 'PULANG') return { ok: false, error: 'Tipe absensi tidak valid.' };
  if (isNaN(lat) || isNaN(lng)) return { ok: false, error: 'Lokasi GPS wajib aktif.' };

  var ss = SpreadsheetApp.openById(RAOS_SS_ID);
  var sh = ss.getSheetByName(_SA_ABSENSI_SHEET);
  if (!sh) return { ok: false, error: 'Sheet Absensi Staff belum di-setup.' };

  var tz    = ss.getSpreadsheetTimeZone();
  var now   = new Date();
  var today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');

  // Cegah dobel absen tipe sama di hari sama
  var lastRow = sh.getLastRow();
  if (lastRow >= _SA_DATA_START) {
    var existing = sh.getRange(_SA_DATA_START, 1, lastRow - _SA_DATA_START + 1, 6).getValues();
    for (var i = 0; i < existing.length; i++) {
      if (String(existing[i][2]).trim() === staffId &&
          String(existing[i][1]) === today &&
          String(existing[i][5]).trim().toUpperCase() === tipe) {
        return { ok: false, error: 'Sudah absen ' + tipe + ' hari ini.' };
      }
    }
  }

  // Geofence
  var koordinat = _saGetGeofence(cabang);
  var jarak = null, dalamArea = 'TIDAK DICEK';
  if (koordinat) {
    jarak = _saJarakMeter(lat, lng, koordinat.lat, koordinat.lng);
    dalamArea = jarak <= koordinat.radius ? 'YA' : 'TIDAK';
  }

  // Simpan foto ke Drive (opsional)
  var fotoUrl = '';
  if (params.fotoBase64) {
    try {
      var blob = Utilities.newBlob(
        Utilities.base64Decode(String(params.fotoBase64).replace(/^data:image\/\w+;base64,/, '')),
        'image/jpeg',
        'absen_' + staffId + '_' + Utilities.formatDate(now, tz, 'yyyyMMdd_HHmmss') + '.jpg'
      );
      var folder = _saGetAbsensiFolder();
      fotoUrl = folder.createFile(blob).getUrl();
    } catch (e) {
      Logger.log('staffAbsensi: gagal simpan foto — ' + e.message);
    }
  }

  sh.appendRow([
    Utilities.formatDate(now, tz, 'dd/MM/yyyy HH:mm:ss'),
    today, staffId, nama, cabang, tipe, lat, lng,
    jarak === null ? '' : jarak, dalamArea, fotoUrl
  ]);

  return {
    ok: true, tipe: tipe,
    jam: Utilities.formatDate(now, tz, 'HH:mm'),
    jarak: jarak, dalamArea: dalamArea,
  };
}

/** Folder Drive untuk foto absensi — buat jika belum ada. */
function _saGetAbsensiFolder() {
  var props    = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('ABSENSI_FOTO_FOLDER_ID');
  if (folderId) {
    try { return DriveApp.getFolderById(folderId); } catch (e) {}
  }
  var folder = DriveApp.createFolder('RIFIM OS - Foto Absensi');
  props.setProperty('ABSENSI_FOTO_FOLDER_ID', folder.getId());
  return folder;
}

/**
 * Status absensi hari ini untuk satu staff.
 * @returns { ok, masuk: 'HH:mm'|null, pulang: 'HH:mm'|null }
 */
function staffAbsensiStatus(params) {
  var staffId = String(params.staffId || '').trim();
  if (!staffId) return { ok: false, error: 'ID Staff wajib.' };

  var ss = SpreadsheetApp.openById(RAOS_SS_ID);
  var sh = ss.getSheetByName(_SA_ABSENSI_SHEET);
  if (!sh) return { ok: true, masuk: null, pulang: null };

  var tz    = ss.getSpreadsheetTimeZone();
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var masuk = null, pulang = null;

  var lastRow = sh.getLastRow();
  if (lastRow >= _SA_DATA_START) {
    var data = sh.getRange(_SA_DATA_START, 1, lastRow - _SA_DATA_START + 1, 6).getValues();
    data.forEach(function(row) {
      if (String(row[2]).trim() !== staffId || String(row[1]) !== today) return;
      var tgl  = _monParseTs(row[0]);
      var jam  = tgl ? Utilities.formatDate(tgl, tz, 'HH:mm') : '—';
      var tipe = String(row[5]).trim().toUpperCase();
      if (tipe === 'MASUK')  masuk  = jam;
      if (tipe === 'PULANG') pulang = jam;
    });
  }
  return { ok: true, masuk: masuk, pulang: pulang };
}

// ══════════════════════════════════════════════════════════════════
// ANTRIAN BANDARA
// ══════════════════════════════════════════════════════════════════

/**
 * Daftar antrian aktif (WAITING/CALLED/PICKED) per cabang hari ini.
 */
function queueList(params) {
  var cabang = String(params.cabang || '').trim().toLowerCase();

  var ss = SpreadsheetApp.openById(RAOS_SS_ID);
  var sh = ss.getSheetByName(_SA_QUEUE_SHEET);
  if (!sh) return { ok: false, error: 'Sheet Antrian Bandara belum di-setup.' };

  var tz    = ss.getSpreadsheetTimeZone();
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  var lastRow = sh.getLastRow();
  var antrian = [], selesaiHariIni = 0;

  if (lastRow >= _SA_DATA_START) {
    var data = sh.getRange(_SA_DATA_START, 1, lastRow - _SA_DATA_START + 1, 10).getValues();
    data.forEach(function(row, idx) {
      if (String(row[1]) !== today) return;
      if (cabang && String(row[2]).trim().toLowerCase() !== cabang) return;

      var status = String(row[5]).trim().toUpperCase();
      if (status === 'DONE') { selesaiHariIni++; return; }
      if (status === 'CANCEL') return;

      antrian.push({
        row       : idx + _SA_DATA_START,
        id        : String(row[0]),
        loginId   : String(row[3]),
        namaDriver: String(row[4]),
        status    : status,
        masuk     : String(row[6]),
        dipanggil : String(row[7]),
      });
    });
  }

  return { ok: true, antrian: antrian, selesaiHariIni: selesaiHariIni };
}

/**
 * Tambah driver ke antrian. Nama driver auto-lookup.
 * @param params { cabang, loginId, staffNama }
 */
function queueAdd(params) {
  var cabang  = String(params.cabang || '').trim();
  var loginId = String(params.loginId || '').trim();
  var staff   = String(params.staffNama || '').trim();
  if (!cabang || !loginId) return { ok: false, error: 'Cabang dan ID Driver wajib.' };

  var driver = _cariDriverByLoginId(loginId);
  if (!driver) return { ok: false, error: 'Driver tidak ditemukan di database.' };

  var ss = SpreadsheetApp.openById(RAOS_SS_ID);
  var sh = ss.getSheetByName(_SA_QUEUE_SHEET);
  if (!sh) return { ok: false, error: 'Sheet Antrian Bandara belum di-setup.' };

  var tz    = ss.getSpreadsheetTimeZone();
  var now   = new Date();
  var today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');

  // Cegah driver dobel antri
  var lastRow = sh.getLastRow();
  if (lastRow >= _SA_DATA_START) {
    var data = sh.getRange(_SA_DATA_START, 1, lastRow - _SA_DATA_START + 1, 6).getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][1]) === today &&
          String(data[i][3]).trim() === loginId) {
        var st = String(data[i][5]).trim().toUpperCase();
        if (st === 'WAITING' || st === 'CALLED' || st === 'PICKED') {
          return { ok: false, error: driver.nama + ' sudah dalam antrian (' + st + ').' };
        }
      }
    }
  }

  var qId = 'Q-' + Utilities.formatDate(now, tz, 'yyMMdd-HHmmss');
  sh.appendRow([
    qId, today, cabang, loginId, driver.nama,
    'WAITING', Utilities.formatDate(now, tz, 'HH:mm'), '', '', staff
  ]);

  return { ok: true, id: qId, namaDriver: driver.nama };
}

/**
 * Update status antrian.
 * @param params { row, status: 'CALLED'|'PICKED'|'DONE'|'CANCEL' }
 */
function queueUpdate(params) {
  var row    = Number(params.row) || 0;
  var status = String(params.status || '').trim().toUpperCase();
  var valid  = ['CALLED', 'PICKED', 'DONE', 'CANCEL'];

  if (row < _SA_DATA_START) return { ok: false, error: 'Baris tidak valid.' };
  if (valid.indexOf(status) === -1) return { ok: false, error: 'Status tidak valid.' };

  var ss = SpreadsheetApp.openById(RAOS_SS_ID);
  var sh = ss.getSheetByName(_SA_QUEUE_SHEET);
  if (!sh) return { ok: false, error: 'Sheet tidak ditemukan.' };

  var tz  = ss.getSpreadsheetTimeZone();
  var jam = Utilities.formatDate(new Date(), tz, 'HH:mm');

  sh.getRange(row, 6).setValue(status);
  if (status === 'CALLED') sh.getRange(row, 8).setValue(jam);
  if (status === 'DONE' || status === 'CANCEL') sh.getRange(row, 9).setValue(jam);

  return { ok: true, status: status, jam: jam };
}

// ══════════════════════════════════════════════════════════════════
// ROUTER — dipanggil dari webApp.js doPost
// ══════════════════════════════════════════════════════════════════

/**
 * Route action Staff App → fungsi handler.
 * Return null jika action bukan milik Staff App (biar webApp.js lanjut routing lain).
 */
function routeStaffApp(action, params) {
  switch (action) {
    case 'staffLogin':         return staffLogin(params);
    case 'staffSaldoSubmit':   return staffSaldoSubmit(params);
    case 'staffSaldoRiwayat':  return staffSaldoRiwayat(params);
    case 'staffSaldoMonitor':  return staffSaldoMonitor(params);
    case 'staffSaldoValidasi': return staffSaldoValidasi(params);
    case 'staffAbsensi':       return staffAbsensi(params);
    case 'staffAbsensiStatus': return staffAbsensiStatus(params);
    case 'queueList':          return queueList(params);
    case 'queueAdd':           return queueAdd(params);
    case 'queueUpdate':        return queueUpdate(params);
    default: return null;
  }
}

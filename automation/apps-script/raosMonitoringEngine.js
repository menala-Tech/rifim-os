/**
 * RIFIM OS — RAOS Monitoring Engine
 * Monitoring real-time + WA alert dua modul:
 *
 *   1. SALDO   — Form Input Saldo AIST: baris belum diisi Login ID > SLA menit
 *                Alert ke grup WA saldo per-cabang (SAL_WA_GROUP_PER_CABANG)
 *
 *   2. POTONGAN — Database Potongan: cabang tanpa input baru > 60 menit
 *                Alert ke grup WA admin cabang (MON_WA_POT_GRUP)
 *
 * Setup awal (jalankan SEKALI dari GAS Editor):
 *   1. setupMonitoringSheets()   — buat sheet MONITORING_SALDO + MONITORING_POTONGAN
 *   2. setupMonitoringTriggers() — pasang semua trigger tiap 5 menit
 *
 * Sumber WA group ID:
 *   MonitoringSaldo.gs (SAL_WA_GROUP_PER_CABANG) → _MON_WA_SALDO_GRUP
 *   Monitoring.gs (MON_WA_GROUP_PER_CABANG) → _MON_WA_POT_GRUP
 */

// ── KONFIGURASI ───────────────────────────────────────────────────

var _MON_SLA_SALDO_MENIT    = 30;  // menit tanpa Login ID di AIST form → alert
var _MON_SLA_SALDO_PWA_MENIT = 5;  // menit belum dicentang "Sudah Diisi" di PWA form → alert
var _MON_SLA_POTONGAN_MENIT = 60;  // menit tanpa input potongan → alert
var _MON_JAM_MULAI          = 7;   // monitoring aktif mulai 07:00
var _MON_JAM_SELESAI        = 23;  // monitoring aktif sampai 23:00

var _MON_SHEET_SALDO    = 'MONITORING_SALDO';
var _MON_SHEET_POTONGAN = 'MONITORING_POTONGAN';

// Cabang saldo (7 cabang) — urutan tampilan di sheet
var _MON_SALDO_CABANG = [
  'ID Rifim Airport Batam',
  'ID Rifim Batam',
  'ID Rifim Airport Jambi',
  'ID Rifim Jambi Luar',
  'ID Rifim Airport Balikpapan',
  'ID Rifim Airport Manado',
  'ID Rifim Airport Pekanbaru',
];

// Cabang potongan (5 airport) — dari Monitoring.gs
var _MON_POT_CABANG = [
  'ID Rifim Airport Batam',
  'ID Rifim Airport Jambi',
  'ID Rifim Airport Balikpapan',
  'ID Rifim Airport Manado',
  'ID Rifim Airport Pekanbaru',
];

// WA Grup saldo per cabang — dari MonitoringSaldo.gs SAL_WA_GROUP_PER_CABANG
var _MON_WA_SALDO_GRUP = {
  'ID Rifim Airport Batam':      '120363416803569567@g.us',
  'ID Rifim Batam':              '120363428603841015@g.us',
  'ID Rifim Airport Jambi':      '120363426397739283@g.us',
  'ID Rifim Jambi Luar':         '120363428541236760@g.us',
  'ID Rifim Airport Balikpapan': '120363421746844167@g.us',
  'ID Rifim Airport Manado':     '120363423659965572@g.us',
  'ID Rifim Airport Pekanbaru':  '120363402974243112@g.us',
};

// WA Grup admin per cabang — dari Monitoring.gs MON_WA_GROUP_PER_CABANG
var _MON_WA_POT_GRUP = {
  'ID Rifim Airport Batam':      '120363162218897223@g.us',
  'ID Rifim Airport Jambi':      '120363142722288524@g.us',
  'ID Rifim Airport Balikpapan': '120363420259437087@g.us',
  'ID Rifim Airport Manado':     '120363423102090113@g.us',
  'ID Rifim Airport Pekanbaru':  '120363347628262640@g.us',
};

// ── HELPER ────────────────────────────────────────────────────────

function _monNamaSingkat(cabang) {
  return String(cabang).replace('ID Rifim Airport ', 'Apt. ').replace('ID Rifim ', '');
}

function _monFormatSelisih(menit) {
  if (menit == null || menit < 0) return '—';
  if (menit < 60) return menit + ' menit';
  var jam = Math.floor(menit / 60);
  var sisa = menit % 60;
  return jam + ' jam' + (sisa > 0 ? ' ' + sisa + ' mnt' : '');
}

/**
 * Parse berbagai format timestamp yang muncul di RIFIM OS → Date.
 * Format yang di-handle (urutan prioritas):
 *   dd/MM/yyyy HH:mm:ss  — CREATED_AT dari GAS (Utilities.formatDate)
 *   dd-MM-yyyy HH:mm:ss  — format batch lama
 *   dd.MM.yyyy HH:mm:ss  — AIST paste dengan detik (Form Input Saldo AIST col A)
 *   dd.MM.yyyy HH:mm     — AIST paste tanpa detik (Input Potongan col D = "11.07.2026 18:40")
 *   dd/MM/yyyy HH:mm     — varian tanpa detik
 *   dd-MM-yyyy HH:mm     — varian tanpa detik
 *   Date object          — langsung dikembalikan
 */
function _monParseTs(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  var s = String(raw).trim();

  // Dengan detik: sep = / - .
  var m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);

  // Tanpa detik: sep = / - .  (contoh: "11.07.2026 18:40")
  m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], 0);

  var fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function _monCabangMatch(raw, list) {
  var s = String(raw || '').trim().toLowerCase();
  return list.find(function(c) { return c.toLowerCase() === s; }) || null;
}

function _monDalamJamOps(now, tz) {
  var jam = Number(Utilities.formatDate(now, tz, 'H'));
  return jam >= _MON_JAM_MULAI && jam < _MON_JAM_SELESAI;
}

// ══════════════════════════════════════════════════════════════════
// SETUP
// ══════════════════════════════════════════════════════════════════

function setupMonitoringSheets() {
  var ss = SpreadsheetApp.openById(RAOS_SS_ID);
  var ui = SpreadsheetApp.getUi();

  // ── Sheet MONITORING_SALDO ──────────────────────────────────────
  var shSaldo = ss.getSheetByName(_MON_SHEET_SALDO);
  if (!shSaldo) shSaldo = ss.insertSheet(_MON_SHEET_SALDO);
  shSaldo.clearContents();

  // Widget summary B1:B6
  [['Cabang Aman:'], ['Total Hari Ini'], ['Sudah Diisi Login ID'],
   ['Belum Diisi (Pending)'], ['Total Nominal'], ['Update Terakhir']]
    .forEach(function(v, i) { shSaldo.getRange(i + 1, 1).setValue(v[0]); });
  shSaldo.getRange('A1:A6').setFontWeight('bold');

  // Header row 8
  var hSaldo = ['Cabang', 'Last Request', 'Pending Tertua', 'Status', 'Total Hari Ini', 'Belum Diisi', 'Nominal Hari Ini'];
  shSaldo.getRange(8, 1, 1, hSaldo.length).setValues([hSaldo])
    .setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');

  // Isi nama cabang mulai baris 9
  _MON_SALDO_CABANG.forEach(function(c, i) {
    shSaldo.getRange(9 + i, 1).setValue(c);
  });
  for (var col = 1; col <= 7; col++) shSaldo.setColumnWidth(col, 160);

  // ── Sheet MONITORING_POTONGAN ───────────────────────────────────
  var shPot = ss.getSheetByName(_MON_SHEET_POTONGAN);
  if (!shPot) shPot = ss.insertSheet(_MON_SHEET_POTONGAN);
  shPot.clearContents();

  [['Cabang Online:'], ['Total Order Hari Ini'], ['Total Hak Driver'],
   ['Total Potongan Kantor'], ['Update Terakhir']]
    .forEach(function(v, i) { shPot.getRange(i + 1, 1).setValue(v[0]); });
  shPot.getRange('A1:A5').setFontWeight('bold');

  var hPot = ['Cabang', 'Last Input', 'Selisih', 'Status', 'Order Hari Ini', 'Total Omzet', 'Admin Terakhir'];
  shPot.getRange(7, 1, 1, hPot.length).setValues([hPot])
    .setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');

  _MON_POT_CABANG.forEach(function(c, i) {
    shPot.getRange(8 + i, 1).setValue(c);
  });
  for (var c2 = 1; c2 <= 7; c2++) shPot.setColumnWidth(c2, 160);

  ui.alert('✅ Sheet MONITORING_SALDO dan MONITORING_POTONGAN siap.\n\nLangkah berikut: jalankan setupMonitoringTriggers().');
}

// ══════════════════════════════════════════════════════════════════
// MONITORING SALDO
// ══════════════════════════════════════════════════════════════════

/**
 * Refresh dashboard MONITORING_SALDO dari "Form Input Saldo AIST".
 * "Belum diisi" = kolom A (Tanggal) ada, kolom D (Login ID) kosong.
 * "Sudah diisi" = kolom A ada, kolom D terisi.
 * Dipanggil otomatis tiap 5 menit oleh trigger.
 */
function refreshMonitoringSaldo() {
  var ss     = SpreadsheetApp.openById(RAOS_SS_ID);
  var shForm = ss.getSheetByName('Form Input Saldo AIST');
  var shMon  = ss.getSheetByName(_MON_SHEET_SALDO);
  if (!shForm || !shMon) {
    Logger.log('refreshMonitoringSaldo: sheet tidak ditemukan (Form Input Saldo AIST / ' + _MON_SHEET_SALDO + ')');
    return;
  }

  var tz      = ss.getSpreadsheetTimeZone();
  var now     = new Date();
  var today   = Utilities.formatDate(now, tz, 'yyyy-MM-dd');

  // state per cabang
  var state = {};
  _MON_SALDO_CABANG.forEach(function(c) {
    state[c] = { lastRequest: null, totalHariIni: 0, belumDiisi: 0, nominalHariIni: 0, pendingTertuaMenit: null };
  });

  var lastRow = shForm.getLastRow();
  if (lastRow >= 3) {
    // Baca kolom A-H (8 kolom): A=Tanggal, B=SUM, D=LoginID, G=Cabang
    var data = shForm.getRange(3, 1, lastRow - 2, 8).getValues();

    data.forEach(function(row) {
      var tanggalRaw = row[0]; // A
      if (!tanggalRaw || tanggalRaw === '') return;

      var tgl = _monParseTs(tanggalRaw);
      if (!tgl) return;

      var loginId   = row[3]; // D
      // SUM bisa berupa string "195 000" (paste langsung dari AIST) atau number
      var sumRaw  = row[1];
      var nominal = (typeof sumRaw === 'number')
                      ? sumRaw
                      : Number(String(sumRaw).replace(/\s+/g, '').replace(/[^0-9.-]/g, '')) || 0;
      var cabangRaw = String(row[6] || '').trim(); // G
      var cabang    = _monCabangMatch(cabangRaw, _MON_SALDO_CABANG);

      var tglStr = Utilities.formatDate(tgl, tz, 'yyyy-MM-dd');
      if (cabang && tglStr === today) {
        var s = state[cabang];
        s.totalHariIni++;
        s.nominalHariIni += nominal;
        if (!s.lastRequest || tgl > s.lastRequest) s.lastRequest = tgl;
      }

      // "Belum diisi" = Login ID masih kosong (tanpa filter tanggal — bisa lintas hari)
      var loginKosong = !loginId || String(loginId).trim() === '';
      if (loginKosong) {
        // Routing ke cabang jika G sudah terisi, atau skip jika belum bisa ditentukan
        if (cabang) {
          var menit = Math.floor((now - tgl) / 60000);
          state[cabang].belumDiisi++;
          if (state[cabang].pendingTertuaMenit === null || menit > state[cabang].pendingTertuaMenit) {
            state[cabang].pendingTertuaMenit = menit;
          }
        }
      }
    });
  }

  // Tulis ke MONITORING_SALDO (baris 9+)
  var labelRange = shMon.getRange(9, 1, _MON_SALDO_CABANG.length, 1).getValues();
  _MON_SALDO_CABANG.forEach(function(cabang) {
    var rowIdx = -1;
    for (var j = 0; j < labelRange.length; j++) {
      if (String(labelRange[j][0]).trim().toLowerCase() === cabang.toLowerCase()) {
        rowIdx = 9 + j; break;
      }
    }
    if (rowIdx === -1) return;

    var s      = state[cabang];
    var status = s.totalHariIni === 0 ? '⚪'
               : s.pendingTertuaMenit === null ? '🟢'
               : s.pendingTertuaMenit < _MON_SLA_SALDO_MENIT ? '🟡'
               : '🔴';
    var lastReqStr = s.lastRequest ? Utilities.formatDate(s.lastRequest, tz, 'HH:mm') : '—';
    var pendingStr = s.pendingTertuaMenit === null ? '—' : _monFormatSelisih(s.pendingTertuaMenit);

    shMon.getRange(rowIdx, 2, 1, 6).setValues([[
      lastReqStr, pendingStr, status, s.totalHariIni, s.belumDiisi,
      'Rp ' + s.nominalHariIni.toLocaleString('id-ID')
    ]]);
  });

  // Widget summary
  var totalHariIni = _MON_SALDO_CABANG.reduce(function(acc, c) { return acc + state[c].totalHariIni; }, 0);
  var totalBelum   = _MON_SALDO_CABANG.reduce(function(acc, c) { return acc + state[c].belumDiisi; }, 0);
  var totalNominal = _MON_SALDO_CABANG.reduce(function(acc, c) { return acc + state[c].nominalHariIni; }, 0);
  var cabangAman   = _MON_SALDO_CABANG.filter(function(c) { return state[c].belumDiisi === 0; }).length;

  shMon.getRange('B1').setValue(cabangAman + '/' + _MON_SALDO_CABANG.length);
  shMon.getRange('B2').setValue(totalHariIni);
  shMon.getRange('B3').setValue(totalHariIni - totalBelum);
  shMon.getRange('B4').setValue(totalBelum);
  shMon.getRange('B5').setValue('Rp ' + totalNominal.toLocaleString('id-ID'));
  shMon.getRange('B6').setValue(Utilities.formatDate(now, tz, 'HH:mm') + ' WIB');
}

/**
 * Cek SLA saldo — kirim WA ke grup per-cabang jika Login ID belum diisi > SLA.
 * Repeat tiap SLA menit selama belum diisi.
 */
function cekSLASaldo() {
  var ss     = SpreadsheetApp.openById(RAOS_SS_ID);
  var shForm = ss.getSheetByName('Form Input Saldo AIST');
  if (!shForm) return;

  var tz  = ss.getSpreadsheetTimeZone();
  var now = new Date();
  if (!_monDalamJamOps(now, tz)) return;

  var lastRow = shForm.getLastRow();
  if (lastRow < 3) return;

  var data = shForm.getRange(3, 1, lastRow - 2, 8).getValues();
  var telatPerCabang = {}; // key = cabang name atau '_UNKNOWN_'

  data.forEach(function(row) {
    var tanggalRaw = row[0];
    if (!tanggalRaw || tanggalRaw === '') return;

    var loginId = row[3];
    if (loginId && String(loginId).trim() !== '') return; // sudah ada Login ID

    var tgl = _monParseTs(tanggalRaw);
    if (!tgl) return;

    var selisihMenit = Math.floor((now - tgl) / 60000);
    if (selisihMenit < _MON_SLA_SALDO_MENIT) return;

    var sumRaw2   = row[1];
    var nominal   = (typeof sumRaw2 === 'number')
                      ? sumRaw2
                      : Number(String(sumRaw2).replace(/\s+/g, '').replace(/[^0-9.-]/g, '')) || 0;
    var creditAcc = String(row[2] || '').trim();
    var cabangRaw = String(row[6] || '').trim();
    var cabang    = _monCabangMatch(cabangRaw, _MON_SALDO_CABANG);
    var kunci     = cabang || '_UNKNOWN_';

    if (!telatPerCabang[kunci]) telatPerCabang[kunci] = [];
    telatPerCabang[kunci].push({ cabang: cabang || '(belum diketahui)', creditAcc: creditAcc, nominal: nominal, selisihMenit: selisihMenit, tgl: tgl });
  });

  if (Object.keys(telatPerCabang).length === 0) return;

  var props = PropertiesService.getScriptProperties();
  var tsStr = Utilities.formatDate(now, tz, 'dd/MM/yyyy HH:mm:ss');

  Object.keys(telatPerCabang).forEach(function(kunci) {
    var list    = telatPerCabang[kunci];
    var cabang  = list[0].cabang;
    var groupId = kunci !== '_UNKNOWN_' ? _MON_WA_SALDO_GRUP[cabang] : null;

    // Cek repeat: baru kirim lagi setelah SLA menit berlalu dari alert terakhir
    var alertKey    = 'MON_SAL_ALERT_' + kunci;
    var lastAlertTs = props.getProperty(alertKey);
    if (lastAlertTs) {
      var lastAlertDate = _monParseTs(lastAlertTs);
      if (lastAlertDate) {
        var menitSejak = Math.floor((now - lastAlertDate) / 60000);
        if (menitSejak < _MON_SLA_SALDO_MENIT) return;
      }
    }

    var pesan = _monPesanSaldoTelat(cabang, list, tz);
    try {
      if (groupId) {
        waSendToTarget(groupId, pesan);
      } else {
        // Fallback: kirim ke grup utama (WA_GROUP_ID)
        waSendToGroup(pesan);
      }
      props.setProperty(alertKey, tsStr);
      Logger.log('cekSLASaldo: alert terkirim ke ' + (groupId || 'grup utama') + ' untuk ' + cabang);
    } catch (err) {
      Logger.log('cekSLASaldo: gagal kirim WA (' + cabang + '): ' + err.message);
    }
  });
}

function _monPesanSaldoTelat(cabang, list, tz) {
  var nama   = _monNamaSingkat(cabang);
  var tglStr = Utilities.formatDate(new Date(), tz, 'd MMMM yyyy');
  var detail = list.map(function(item) {
    var jamStr = Utilities.formatDate(item.tgl, tz, 'HH:mm');
    return '• ' + item.creditAcc + ' — Rp ' + item.nominal.toLocaleString('id-ID') +
           ' (masuk ' + jamStr + ', sudah ' + item.selisihMenit + ' mnt)';
  }).join('\n');

  return '🚨 RIFIM — SALDO BELUM DIPROSES\n\n' +
    'Cabang: ' + nama + '\n' +
    list.length + ' transaksi belum diisi Login ID (>' + _MON_SLA_SALDO_MENIT + ' menit):\n\n' +
    detail + '\n\n' +
    'Mohon isi kolom D (Login ID) di sheet\n"Form Input Saldo AIST" segera.\n\n' +
    'Tanggal: ' + tglStr + '\n' +
    '─────────────────────\nPT Rifim Internasional Gemilang';
}

// ══════════════════════════════════════════════════════════════════
// MONITORING POTONGAN
// ══════════════════════════════════════════════════════════════════

/**
 * Refresh dashboard MONITORING_POTONGAN dari "Database Potongan".
 * Baca kolom C (ID_CABANG, col 3), F (Price, col 6), J (Potongan Kantor, col 10),
 * K (Hak Driver, col 11), O (CREATED_AT, col 15).
 * (Referensi _DB_COL dari raosPotonganEngine.js — file di-load dalam scope GAS yang sama)
 */
function refreshMonitoringPotongan() {
  var ss    = SpreadsheetApp.openById(RAOS_SS_ID);
  var shDB  = ss.getSheetByName('Database Potongan');
  var shMon = ss.getSheetByName(_MON_SHEET_POTONGAN);
  if (!shDB || !shMon) {
    Logger.log('refreshMonitoringPotongan: sheet tidak ditemukan');
    return;
  }

  var tz       = ss.getSpreadsheetTimeZone();
  var now      = new Date();
  var startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var endDay   = new Date(startDay.getTime() + 86400000);

  var state = {};
  _MON_POT_CABANG.forEach(function(c) {
    state[c] = { lastInput: null, orderHariIni: 0, omzetHariIni: 0, hakDriverHariIni: 0, potonganHariIni: 0 };
  });

  var lastRow = shDB.getLastRow();
  if (lastRow >= 3) {
    var data = shDB.getRange(3, 1, lastRow - 2, 15).getValues();
    data.forEach(function(row) {
      // col C (idx 2) = ID_CABANG, col F (idx 5) = Price
      // col J (idx 9) = Potongan Kantor, col K (idx 10) = Hak Driver
      // col O (idx 14) = CREATED_AT
      var cabang = _monCabangMatch(row[2], _MON_POT_CABANG);
      if (!cabang) return;

      var createdAt = _monParseTs(row[14]) || _monParseTs(row[1]); // O lalu fallback B
      if (!createdAt) return;

      var s = state[cabang];
      if (!s.lastInput || createdAt > s.lastInput) s.lastInput = createdAt;

      if (createdAt >= startDay && createdAt < endDay) {
        s.orderHariIni++;
        s.omzetHariIni      += Number(row[5])  || 0;  // F = Price
        s.potonganHariIni   += Number(row[9])  || 0;  // J = Potongan Kantor
        s.hakDriverHariIni  += Number(row[10]) || 0;  // K = Hak Driver
      }
    });
  }

  var props      = PropertiesService.getScriptProperties();
  var labelRange = shMon.getRange(8, 1, _MON_POT_CABANG.length, 1).getValues();

  _MON_POT_CABANG.forEach(function(cabang) {
    var rowIdx = -1;
    for (var j = 0; j < labelRange.length; j++) {
      if (String(labelRange[j][0]).trim().toLowerCase() === cabang.toLowerCase()) {
        rowIdx = 8 + j; break;
      }
    }
    if (rowIdx === -1) return;

    var s            = state[cabang];
    var selisihMenit = s.lastInput ? Math.floor((now - s.lastInput) / 60000) : null;
    var status       = !s.lastInput          ? '⚪'
                     : selisihMenit < 30     ? '🟢'
                     : selisihMenit < _MON_SLA_POTONGAN_MENIT ? '🟡'
                     : '🔴';
    var lastInputStr = s.lastInput ? Utilities.formatDate(s.lastInput, tz, 'HH:mm') : '—';
    var adminTerakhir = props.getProperty('MON_POT_ADMIN_' + cabang) || '—';

    shMon.getRange(rowIdx, 2, 1, 6).setValues([[
      lastInputStr, _monFormatSelisih(selisihMenit), status,
      s.orderHariIni, 'Rp ' + s.omzetHariIni.toLocaleString('id-ID'), adminTerakhir
    ]]);
  });

  // Widget summary
  var cabangOnline  = _MON_POT_CABANG.filter(function(c) {
    return state[c].lastInput && Math.floor((now - state[c].lastInput) / 60000) < _MON_SLA_POTONGAN_MENIT;
  }).length;
  var totalOrder    = _MON_POT_CABANG.reduce(function(acc, c) { return acc + state[c].orderHariIni; }, 0);
  var totalHakDrv   = _MON_POT_CABANG.reduce(function(acc, c) { return acc + state[c].hakDriverHariIni; }, 0);
  var totalPotongan = _MON_POT_CABANG.reduce(function(acc, c) { return acc + state[c].potonganHariIni; }, 0);

  shMon.getRange('B1').setValue(cabangOnline + '/' + _MON_POT_CABANG.length);
  shMon.getRange('B2').setValue(totalOrder);
  shMon.getRange('B3').setValue('Rp ' + totalHakDrv.toLocaleString('id-ID'));
  shMon.getRange('B4').setValue('Rp ' + totalPotongan.toLocaleString('id-ID'));
  shMon.getRange('B5').setValue(Utilities.formatDate(now, tz, 'HH:mm') + ' WIB');
}

/**
 * Cek SLA potongan — alert ke grup admin cabang jika tidak ada input > 60 menit.
 * Pola state change + repeat tiap SLA menit (dari Monitoring.gs).
 */
function cekSLAPotongan() {
  var ss   = SpreadsheetApp.openById(RAOS_SS_ID);
  var shDB = ss.getSheetByName('Database Potongan');
  if (!shDB) return;

  var tz  = ss.getSpreadsheetTimeZone();
  var now = new Date();
  if (!_monDalamJamOps(now, tz)) return;

  var lastRow = shDB.getLastRow();

  // Kumpulkan lastInput per cabang
  var lastInputPerCabang = {};
  if (lastRow >= 3) {
    var data = shDB.getRange(3, 1, lastRow - 2, 15).getValues();
    data.forEach(function(row) {
      var cabang = _monCabangMatch(row[2], _MON_POT_CABANG);
      if (!cabang) return;
      var createdAt = _monParseTs(row[14]) || _monParseTs(row[1]);
      if (!createdAt) return;
      if (!lastInputPerCabang[cabang] || createdAt > lastInputPerCabang[cabang]) {
        lastInputPerCabang[cabang] = createdAt;
      }
    });
  }

  var props = PropertiesService.getScriptProperties();
  var tsStr = Utilities.formatDate(now, tz, 'dd/MM/yyyy HH:mm:ss');

  _MON_POT_CABANG.forEach(function(cabang) {
    var lastInput    = lastInputPerCabang[cabang];
    var stateKey     = 'MON_POT_STATE_' + cabang;
    var stateLama    = props.getProperty(stateKey) || 'ONLINE';
    var groupId      = _MON_WA_POT_GRUP[cabang];

    if (!lastInput) return; // belum pernah ada data → skip

    var selisihMenit = Math.floor((now - lastInput) / 60000);
    var isOffline    = selisihMenit >= _MON_SLA_POTONGAN_MENIT;

    if (isOffline) {
      // Cek repeat — jangan kirim terlalu sering
      var alertKey    = 'MON_POT_ALERT_' + cabang;
      var lastAlertTs = props.getProperty(alertKey);
      var bolehAlert  = true;
      if (lastAlertTs) {
        var lad = _monParseTs(lastAlertTs);
        if (lad && Math.floor((now - lad) / 60000) < _MON_SLA_POTONGAN_MENIT) bolehAlert = false;
      }

      if (bolehAlert && groupId) {
        var pesan = _monPesanPotonganOffline(cabang, lastInput, selisihMenit, tz);
        try {
          waSendToTarget(groupId, pesan);
          props.setProperty(alertKey, tsStr);
          props.setProperty(stateKey, 'OFFLINE');
          Logger.log('cekSLAPotongan: alert OFFLINE terkirim — ' + cabang);
        } catch (err) {
          Logger.log('cekSLAPotongan: gagal kirim WA (' + cabang + '): ' + err.message);
        }
      } else if (!bolehAlert) {
        props.setProperty(stateKey, 'OFFLINE');
      }
    } else {
      // Cabang kembali online setelah offline
      if (stateLama === 'OFFLINE' && groupId) {
        try {
          waSendToTarget(groupId, _monPesanPotonganOnline(cabang, tz));
          props.setProperty(stateKey, 'ONLINE');
          Logger.log('cekSLAPotongan: ONLINE kembali — ' + cabang);
        } catch (err) {
          Logger.log('cekSLAPotongan: gagal kirim WA ONLINE (' + cabang + '): ' + err.message);
        }
      } else {
        props.setProperty(stateKey, 'ONLINE');
      }
    }
  });
}

function _monPesanPotonganOffline(cabang, lastInput, selisihMenit, tz) {
  var nama      = _monNamaSingkat(cabang);
  var jamStr    = Utilities.formatDate(lastInput, tz, 'HH:mm');
  var tglStr    = Utilities.formatDate(new Date(), tz, 'd MMMM yyyy');
  var jamDeteksi = Utilities.formatDate(new Date(), tz, 'HH:mm');

  return '🚨 ALERT OFFLINE — ' + nama.toUpperCase() + '\n\n' +
    'Input data BERHENTI selama ' + _monFormatSelisih(selisihMenit) + '\n' +
    'Input terakhir : ' + jamStr + '\n' +
    'Jam deteksi    : ' + jamDeteksi + '\n' +
    'Tanggal        : ' + tglStr + '\n\n' +
    '⚠️ TINDAKAN DIPERLUKAN SEGERA:\n' +
    '1. Cari orderan dari penumpang\n' +
    '2. Pastikan driver standby\n' +
    '3. Cek aplikasi driver berjalan dan saldo driver\n' +
    '4. Tingkatkan performa mencari pelanggan\n\n' +
    'Status: 🔴 OFFLINE\n\n' +
    '─────────────────────\nPT Rifim Internasional Gemilang';
}

function _monPesanPotonganOnline(cabang, tz) {
  var nama   = _monNamaSingkat(cabang);
  var tglStr = Utilities.formatDate(new Date(), tz, 'd MMMM yyyy');
  return '✅ KEMBALI ONLINE — ' + nama.toUpperCase() + '\n\n' +
    'Input data potongan kembali normal.\n' +
    'Tanggal: ' + tglStr + '\n\n' +
    'Status: 🟢 ONLINE\n\n' +
    '─────────────────────\nPT Rifim Internasional Gemilang';
}

// ══════════════════════════════════════════════════════════════════
// MONITORING SALDO PWA — Form Input Saldo PWA col G "Sudah Diisi"
// ══════════════════════════════════════════════════════════════════

/**
 * Cek SLA saldo PWA — kirim WA ke grup per-cabang jika ada driver request
 * di "Form Input Saldo PWA" yang belum dicentang "Sudah Diisi" (col G) > SLA menit.
 *
 * Format sheet Form Input Saldo PWA (1-based):
 *   A=Timestamp, B=Cabang, C=Nama Staff, D=Nominal, E=ID Login Driver,
 *   F=Nama Driver, G=Sudah Diisi (checkbox), H=Alert Terkirim, I=Alert Terakhir
 *
 * Data mulai baris 3 (row 1=header, row 2=note).
 */
function cekSLASaldoPWA() {
  var ss    = SpreadsheetApp.openById(RAOS_SS_ID);
  var shPWA = ss.getSheetByName('Form Input Saldo PWA');
  if (!shPWA) return;

  var tz  = ss.getSpreadsheetTimeZone();
  var now = new Date();
  if (!_monDalamJamOps(now, tz)) return;

  var lastRow = shPWA.getLastRow();
  if (lastRow < 3) return;

  // Baca 9 kolom: A-I
  var data = shPWA.getRange(3, 1, lastRow - 2, 9).getValues();
  var telatPerCabang = {};

  data.forEach(function(row, idx) {
    var timestamp  = row[0]; // A
    var cabangRaw  = row[1]; // B
    var nominal    = row[3]; // D
    var loginId    = row[4]; // E
    var namaDriver = row[5]; // F
    var sudahDiisi = row[6]; // G — checkbox TRUE/FALSE

    if (!timestamp || sudahDiisi === true) return; // skip baris kosong atau sudah selesai

    var tgl = _monParseTs(timestamp);
    if (!tgl) return;

    var selisihMenit = Math.floor((now - tgl) / 60000);
    if (selisihMenit < _MON_SLA_SALDO_PWA_MENIT) return;

    var cabang = _monCabangMatch(String(cabangRaw || '').trim(), _MON_SALDO_CABANG);
    var kunci  = cabang || '_UNKNOWN_';

    if (!telatPerCabang[kunci]) telatPerCabang[kunci] = { cabang: cabang || String(cabangRaw || 'Unknown'), items: [] };
    telatPerCabang[kunci].items.push({
      namaDriver   : String(namaDriver || loginId || '(unknown)'),
      loginId      : String(loginId || ''),
      nominal      : Number(nominal) || 0,
      requestJam   : Utilities.formatDate(tgl, tz, 'HH:mm'),
      selisihMenit : selisihMenit,
      sheetRow     : idx + 3,
    });
  });

  if (Object.keys(telatPerCabang).length === 0) return;

  var props = PropertiesService.getScriptProperties();
  var tsStr = Utilities.formatDate(now, tz, 'dd/MM/yyyy HH:mm:ss');

  Object.keys(telatPerCabang).forEach(function(kunci) {
    var group   = telatPerCabang[kunci];
    var cabang  = group.cabang;
    var groupId = kunci !== '_UNKNOWN_' ? _MON_WA_SALDO_GRUP[cabang] : null;

    // Cek repeat — jangan kirim lebih sering dari SLA
    var alertKey    = 'MON_PWA_ALERT_' + kunci;
    var lastAlertTs = props.getProperty(alertKey);
    if (lastAlertTs) {
      var lad = _monParseTs(lastAlertTs);
      if (lad && Math.floor((now - lad) / 60000) < _MON_SLA_SALDO_PWA_MENIT) return;
    }

    var pesan = _monPesanSaldoPWATelat(cabang, group.items, tz);
    try {
      if (groupId) {
        waSendToTarget(groupId, pesan);
      } else {
        waSendToGroup(pesan);
      }
      props.setProperty(alertKey, tsStr);

      // Tandai H (Alert Terkirim) = TRUE dan I (Alert Terakhir) = timestamp
      group.items.forEach(function(item) {
        shPWA.getRange(item.sheetRow, 8).setValue(true); // H: Alert Terkirim
        shPWA.getRange(item.sheetRow, 9).setValue(tsStr); // I: Alert Terakhir
      });

      Logger.log('cekSLASaldoPWA: alert terkirim ke ' + (groupId || 'grup utama') + ' — ' + cabang);
    } catch (err) {
      Logger.log('cekSLASaldoPWA: gagal kirim WA (' + cabang + '): ' + err.message);
    }
  });
}

function _monPesanSaldoPWATelat(cabang, items, tz) {
  var nama   = _monNamaSingkat(cabang);
  var tglStr = Utilities.formatDate(new Date(), tz, 'd MMMM yyyy');
  var detail = items.map(function(item) {
    return '• ' + item.namaDriver + ' — Login ' + item.loginId +
           ' — Rp ' + item.nominal.toLocaleString('id-ID') +
           ' (request ' + item.requestJam + ', sudah ' + item.selisihMenit + ' menit)';
  }).join('\n');

  return '🔴 RIFIM - SALDO BELUM DIPROSES\n\n' +
    'Cabang :\n' + nama + '\n\n' +
    items.length + ' permintaan belum dicentang "Sudah Diisi" (>' + _MON_SLA_SALDO_PWA_MENIT + ' menit) :\n' +
    detail + '\n\n' +
    'Tanggal :\n' + tglStr + '\n\n' +
    'Mohon segera diisi di AIST, lalu centang "Sudah Diisi" di sheet.\n\n' +
    '─────────────────────\n' +
    'PT Rifim Internasional Gemilang';
}

// ── TEST MANUAL ───────────────────────────────────────────────────

/** Test: kirim pesan test ke semua grup saldo */
function testMonitoringSaldoWA() {
  var msg = '🔧 Test koneksi WA Monitoring Saldo RIFIM OS — jika pesan ini muncul, routing OK.';
  Object.keys(_MON_WA_SALDO_GRUP).forEach(function(cabang) {
    try { waSendToTarget(_MON_WA_SALDO_GRUP[cabang], '(' + _monNamaSingkat(cabang) + ') ' + msg); }
    catch (e) { Logger.log('Test saldo WA gagal (' + cabang + '): ' + e.message); }
    Utilities.sleep(500);
  });
}

/** Test: kirim pesan test ke semua grup potongan */
function testMonitoringPotonganWA() {
  var msg = '🔧 Test koneksi WA Monitoring Potongan RIFIM OS — jika pesan ini muncul, routing OK.';
  Object.keys(_MON_WA_POT_GRUP).forEach(function(cabang) {
    try { waSendToTarget(_MON_WA_POT_GRUP[cabang], '(' + _monNamaSingkat(cabang) + ') ' + msg); }
    catch (e) { Logger.log('Test potongan WA gagal (' + cabang + '): ' + e.message); }
    Utilities.sleep(500);
  });
}

// ── SETUP TRIGGERS ────────────────────────────────────────────────

function setupMonitoringTriggers() {
  var namaFungsi = [
    'refreshMonitoringSaldo', 'cekSLASaldo', 'cekSLASaldoPWA',
    'refreshMonitoringPotongan', 'cekSLAPotongan',
  ];

  // Hapus trigger lama dengan nama yang sama
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (namaFungsi.indexOf(t.getHandlerFunction()) > -1) ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('refreshMonitoringSaldo').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('cekSLASaldo').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('cekSLASaldoPWA').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('refreshMonitoringPotongan').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('cekSLAPotongan').timeBased().everyMinutes(5).create();

  SpreadsheetApp.getUi().alert(
    '✅ Trigger Monitoring terpasang (5 trigger):\n\n' +
    '• refreshMonitoringSaldo    — tiap 5 menit\n' +
    '• cekSLASaldo               — tiap 5 menit\n' +
    '  (alert AIST form jika Login ID belum diisi >' + _MON_SLA_SALDO_MENIT + ' mnt)\n\n' +
    '• cekSLASaldoPWA            — tiap 5 menit\n' +
    '  (alert PWA form jika "Sudah Diisi" belum dicentang >' + _MON_SLA_SALDO_PWA_MENIT + ' mnt)\n\n' +
    '• refreshMonitoringPotongan — tiap 5 menit\n' +
    '• cekSLAPotongan            — tiap 5 menit\n' +
    '  (alert grup admin jika tidak ada input potongan >' + _MON_SLA_POTONGAN_MENIT + ' mnt)'
  );
}

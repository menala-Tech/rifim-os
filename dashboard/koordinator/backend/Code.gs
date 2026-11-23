/**
 * Dashboard Keuangan MENALA — Backend Google Apps Script
 *
 * Sumber data: spreadsheet "DASHBOARD Rp" (sanitized; sheet "Transaksi").
 * Kolom wajib: Tanggal, Cabang, Tipe (masuk|keluar), Nominal.
 * Kolom opsional: Keterangan.
 *
 * Deploy: Execute as "Me", Who has access "Anyone".
 */

const SHEET_ID = '175tdmIOEz3uoNAnN9u79PMinOuL0Ew9VFQgoDZMLazU';
const SHEET_TRANSAKSI = 'Transaksi';
const SHEET_TAGIHAN = 'Tagihan';   // opsional; tidak error kalau absent
const SHEET_SUMMARY = 'DASHBOARD_SUMMARY';

const TIMEZONE = 'Asia/Jakarta';
const CACHE_TTL_MS = 5 * 60 * 1000;
const EDIT_DEBOUNCE_MS = 2 * 60 * 1000;
const LAST_RUN_PROP = 'last_agg_ms';

// Cabang yang di-exclude dari total (case-insensitive substring match).
const CABANG_EXCLUDE = ['soeta'];

// =========================================================================
// ENTRY POINT
// =========================================================================
function doGet() {
  try {
    const payload = bacaCacheSummary() || agregasiLengkap();
    return respond({ ok: true, updated_at: payload.updated_at, data: payload.data });
  } catch (err) {
    return respond({ ok: false, error: 'INTERNAL_ERROR', detail: String(err && err.message || err) });
  }
}

function doPost() { return doGet(); }

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// =========================================================================
// AGREGASI UTAMA
// =========================================================================
function agregasiLengkap() {
  const now = new Date();
  const bulanYM = Utilities.formatDate(now, TIMEZONE, 'yyyy-MM');

  const all = ambilTransaksi();
  const bulanIni = all.filter((t) => t.tanggal.indexOf(bulanYM) === 0);

  const pemasukan = sumBy(bulanIni, 'masuk');
  const pengeluaran = sumBy(bulanIni, 'keluar');

  // Run-rate 30 hari. shortcut: naive run-rate, upgrade ke WMA kalau butuh akurasi musiman.
  const hariTerpakai = Math.max(3, Number(Utilities.formatDate(now, TIMEZONE, 'd')));
  const komitmen = tagihanBelumBayar();
  const estPendapatan = Math.round(pemasukan / hariTerpakai * 30);
  const estPengeluaran = Math.round(pengeluaran / hariTerpakai * 30) + komitmen;

  const data = {
    pemasukan: pemasukan,
    pengeluaran: pengeluaran,
    estPendapatan: estPendapatan,
    estPengeluaran: estPengeluaran,
    komitmen_belum_bayar: komitmen,
    periode: Utilities.formatDate(now, TIMEZONE, 'MMMM yyyy'),
    breakdown_cabang: breakdownCabang(bulanIni),
    tren_masuk: trenHarian(all, now, 'masuk'),
    tren_keluar: trenHarian(all, now, 'keluar'),
    transaksi_terbaru: transaksiTerbaru(bulanIni, 10)
  };

  const payload = {
    updated_at: Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX"),
    data: data
  };
  tulisCacheSummary(payload);
  return payload;
}

// =========================================================================
// READER: Transaksi
// =========================================================================
function ambilTransaksi() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SHEET_TRANSAKSI) || ss.getSheetByName('Input Data');
  if (!sh) throw new Error('Sheet "' + SHEET_TRANSAKSI + '" atau "Input Data" tidak ditemukan');
  const rows = sh.getDataRange().getValues();
  if (rows.length < 2) return [];
  const header = rows.shift().map(String);
  const col = (names) => {
    for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i; }
    throw new Error('Kolom tidak ketemu: ' + names.join(','));
  };
  const ci = {
    tanggal: col(['Tanggal', 'tanggal', 'Date', 'Timestamp']),
    cabang: col(['Cabang', 'cabang', 'Branch', 'Subdivision']),
    tipe: col(['Tipe', 'tipe', 'Jenis', 'Type']),
    nominal: col(['Nominal', 'nominal', 'Amount', 'Jumlah'])
  };
  return rows
    .map((r) => ({
      tanggal: formatTanggal(r[ci.tanggal]),
      cabang: String(r[ci.cabang] || '').trim(),
      tipe: normalizeTipe(r[ci.tipe]),
      nominal: Number(r[ci.nominal]) || 0
    }))
    .filter((t) => t.tanggal && t.tipe && t.nominal > 0 && !isExcluded(t.cabang));
}

function formatTanggal(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, TIMEZONE, 'yyyy-MM-dd');
  const m = String(v || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let yr = +m[3]; if (yr < 100) yr += 2000;
    const d = new Date(yr, +m[2] - 1, +m[1]);
    return Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd');
  }
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd');
}

function normalizeTipe(v) {
  const s = String(v || '').toLowerCase().trim();
  if (s === 'masuk' || s === 'pemasukan' || s === 'in' || s === 'kredit') return 'masuk';
  if (s === 'keluar' || s === 'pengeluaran' || s === 'out' || s === 'debit') return 'keluar';
  return '';
}

function isExcluded(cabang) {
  const s = String(cabang || '').toLowerCase();
  return CABANG_EXCLUDE.some((x) => s.indexOf(x) >= 0);
}

function sumBy(arr, tipe) {
  return arr.filter((t) => t.tipe === tipe).reduce((a, b) => a + b.nominal, 0);
}

// =========================================================================
// BREAKDOWN, TREN, TRANSAKSI TERBARU
// =========================================================================
function breakdownCabang(bulanIni) {
  const map = Object.create(null);
  bulanIni.forEach((t) => {
    if (!map[t.cabang]) map[t.cabang] = { nama: t.cabang, masuk: 0, keluar: 0, tx: 0 };
    map[t.cabang][t.tipe] += t.nominal;
    map[t.cabang].tx++;
  });
  return Object.keys(map).map((k) => map[k])
    .sort((a, b) => (b.masuk + b.keluar) - (a.masuk + a.keluar));
}

function trenHarian(all, now, tipe) {
  const out = new Array(14).fill(0);
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const key = Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd');
    const idx = 13 - i;
    all.forEach((t) => {
      if (t.tipe === tipe && t.tanggal === key) out[idx] += t.nominal;
    });
  }
  return out;
}

function transaksiTerbaru(bulanIni, n) {
  return bulanIni.slice()
    .sort((a, b) => (b.tanggal > a.tanggal ? 1 : -1))
    .slice(0, n)
    .map((t) => ({ tanggal: t.tanggal, cabang: t.cabang, tipe: t.tipe, nominal: t.nominal }));
}

// =========================================================================
// KOMITMEN: Tagihan Belum Bayar (opsional)
// =========================================================================
function tagihanBelumBayar() {
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_TAGIHAN);
  if (!sh) return 0;
  const rows = sh.getDataRange().getValues();
  if (rows.length < 2) return 0;
  // Dukung dua layout: baris 1 header; atau baris 1 judul + baris 2 header.
  let headerIdx = 0;
  if (rows[0].length === 1 && rows.length > 1) headerIdx = 1;
  const header = rows[headerIdx].map(String);
  const nomIdx = header.indexOf('Nominal');
  const statusIdx = header.indexOf('Status');
  if (nomIdx < 0 || statusIdx < 0) return 0;
  let total = 0;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const status = String(rows[i][statusIdx] || '').toLowerCase();
    if (status.indexOf('belum') >= 0) {
      const v = rows[i][nomIdx];
      total += typeof v === 'number' ? v : Number(String(v).replace(/[^\d-]/g, '')) || 0;
    }
  }
  return total;
}

// =========================================================================
// CACHE sheet (dengan Lock agar reader tidak lihat state setengah jadi)
// =========================================================================
function tulisCacheSummary(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sh = ss.getSheetByName(SHEET_SUMMARY);
    if (!sh) sh = ss.insertSheet(SHEET_SUMMARY);
    sh.getRange(1, 1, 1, 2).setValues([[JSON.stringify(payload), new Date()]]);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function bacaCacheSummary() {
  try {
    const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_SUMMARY);
    if (!sh) return null;
    const vals = sh.getRange(1, 1, 1, 2).getValues()[0];
    const raw = vals[0], ts = vals[1];
    if (!raw || !(ts instanceof Date)) return null;
    if (Date.now() - ts.getTime() > CACHE_TTL_MS) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// =========================================================================
// TRIGGER
// =========================================================================
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('agregasiLengkap').timeBased().everyMinutes(5).create();
  const ss = SpreadsheetApp.openById(SHEET_ID);
  ScriptApp.newTrigger('onEditTransaksi').forSpreadsheet(ss).onEdit().create();
}

function onEditTransaksi(e) {
  if (!e || !e.range || e.range.getSheet().getName() !== SHEET_TRANSAKSI) return;
  const props = PropertiesService.getScriptProperties();
  const last = Number(props.getProperty(LAST_RUN_PROP) || 0);
  if (Date.now() - last < EDIT_DEBOUNCE_MS) return;
  props.setProperty(LAST_RUN_PROP, String(Date.now()));
  agregasiLengkap();
}

// =========================================================================
// SELF-CHECK (jalankan manual sekali setelah paste)
// =========================================================================
function _selfCheck() {
  const p = agregasiLengkap();
  if (!p || !p.data) throw new Error('payload kosong');
  if (typeof p.data.pemasukan !== 'number') throw new Error('pemasukan bukan number');
  if (p.data.tren_masuk.length !== 14) throw new Error('tren_masuk harus 14 slot');
  if (p.data.tren_keluar.length !== 14) throw new Error('tren_keluar harus 14 slot');
  Logger.log('OK pemasukan=' + p.data.pemasukan +
    ' pengeluaran=' + p.data.pengeluaran +
    ' komitmen=' + p.data.komitmen_belum_bayar +
    ' cabang=' + p.data.breakdown_cabang.map((c) => c.nama).join(','));
}

// =========================================================================
// GENERATOR TAB UI SPREADSHEET (Membangun Tab DASHBOARD UI di Spreadsheet)
// =========================================================================
function buatSpreadsheetUIDashboard() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const TAB_NAME = 'DASHBOARD UI';
  let sh = ss.getSheetByName(TAB_NAME);
  if (!sh) {
    sh = ss.insertSheet(TAB_NAME, 0);
  }

  sh.clear();
  sh.setGridlines(false);

  // 1. Header Banner
  sh.getRange('B2:M2').merge()
    .setValue('DASHBOARD KEUANGAN MENALA / RIFIM')
    .setBackground('#1c060b')
    .setFontColor('#fbbf24')
    .setFontSize(16)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sh.setRowHeight(2, 45);

  sh.getRange('B3:M3').merge()
    .setValue('Ringkasan 4 Metrik Keuangan Utama (Bulan Berjalan & Estimasi 30 Hari) • Exclude SOETA')
    .setBackground('#2d0c15')
    .setFontColor('#fef08a')
    .setFontSize(10)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sh.setRowHeight(3, 25);

  // Jalankan agregasi untuk mendapatkan data terbaru
  const payload = agregasiLengkap();
  const d = payload.data;
  const netFlow = (d.estPendapatan || 0) - (d.estPengeluaran || 0);

  // 2. Kartu KPI (5 Kartu)
  // Format Card: Header Label (row 5), Value (row 6), Sub (row 7)
  const cards = [
    { rangeTitle: 'B5:C5', rangeVal: 'B6:C6', rangeSub: 'B7:C7', col: 'B', title: 'PEMASUKAN BULAN INI', val: d.pemasukan, sub: 'Aktual Bulan Berjalan', bg: '#064e3b', text: '#34d399' },
    { rangeTitle: 'E5:F5', rangeVal: 'E6:F6', rangeSub: 'E7:F7', col: 'E', title: 'PENGELUARAN BULAN INI', val: d.pengeluaran, sub: 'Aktual Bulan Berjalan', bg: '#7f1d1d', text: '#f87171' },
    { rangeTitle: 'H5:I5', rangeVal: 'H6:I6', rangeSub: 'H7:I7', col: 'H', title: 'ESTIMASI PENDAPATAN', val: d.estPendapatan, sub: 'Proyeksi 30 Hari (Run-rate)', bg: '#1e3a8a', text: '#60a5fa' },
    { rangeTitle: 'K5:L5', rangeVal: 'K6:L6', rangeSub: 'K7:L7', col: 'K', title: 'ESTIMASI PENGELUARAN', val: d.estPengeluaran, sub: 'Run-rate + Tagihan Belum Bayar', bg: '#7c2d12', text: '#fb923c' }
  ];

  cards.forEach(c => {
    sh.getRange(c.rangeTitle).merge().setValue(c.title).setBackground(c.bg).setFontColor('#ffffff').setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center');
    sh.getRange(c.rangeVal).merge().setValue(c.val).setNumberFormat('"Rp"#,##0').setBackground('#0f172a').setFontColor(c.text).setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
    sh.getRange(c.rangeSub).merge().setValue(c.sub).setBackground('#1e293b').setFontColor('#94a3b8').setFontSize(8).setHorizontalAlignment('center');
  });

  // Net Flow Box
  sh.getRange('B9:L9').merge()
    .setValue('NET FLOW ESTIMASI 30 HARI: ' + Utilities.formatDate(new Date(), TIMEZONE, 'MMMM yyyy'))
    .setBackground('#1e293b').setFontColor('#94a3b8').setFontSize(10).setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange('B10:L10').merge()
    .setValue(netFlow)
    .setNumberFormat('"Rp"#,##0')
    .setBackground('#0f172a')
    .setFontColor(netFlow >= 0 ? '#34d399' : '#f87171')
    .setFontSize(18)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // 3. Tabel Breakdown Per Cabang
  sh.getRange('B12:G12').merge()
    .setValue('RINCIAN DISTRIBUSI PER CABANG / SUBDIVISION')
    .setBackground('#1c060b').setFontColor('#fbbf24').setFontSize(10).setFontWeight('bold');

  const headers = ['No', 'Cabang / Subdivision', 'Pemasukan', 'Pengeluaran', 'Net Cabang', 'Jumlah Tx'];
  sh.getRange(13, 2, 1, 6).setValues([headers])
    .setBackground('#334155').setFontColor('#f8fafc').setFontWeight('bold').setFontSize(9).setHorizontalAlignment('center');

  const rows = (d.breakdown_cabang || []).map((b, idx) => [
    idx + 1,
    b.nama,
    b.masuk,
    b.keluar,
    b.masuk - b.keluar,
    b.tx || '-'
  ]);

  if (rows.length > 0) {
    sh.getRange(14, 2, rows.length, 6).setValues(rows).setFontSize(9);
    sh.getRange(14, 2, rows.length, 1).setHorizontalAlignment('center');
    sh.getRange(14, 3, rows.length, 1).setHorizontalAlignment('left');
    sh.getRange(14, 4, rows.length, 3).setNumberFormat('"Rp"#,##0').setHorizontalAlignment('right');
    sh.getRange(14, 7, rows.length, 1).setHorizontalAlignment('center');
  }

  // Auto-width
  sh.setColumnWidth(1, 20);
  sh.setColumnWidth(2, 40);
  sh.setColumnWidth(3, 160);
  sh.setColumnWidth(4, 130);
  sh.setColumnWidth(5, 130);
  sh.setColumnWidth(6, 130);
  sh.setColumnWidth(7, 80);

  Logger.log('DASHBOARD UI berhasil dibuat pada tab "DASHBOARD UI"');
}

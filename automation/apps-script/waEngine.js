/**
 * RIFIM OS — WhatsApp Engine (Fonnte)
 *
 * Engine umum untuk semua modul: RAOS, Finance, HRIS, Smart Office.
 * Semua fungsi WA melewati file ini — tidak boleh ada panggilan Fonnte langsung di file lain.
 *
 * Konfigurasi disimpan di PropertiesService (bukan hardcode):
 *   FONNTE_TOKEN   — token API Fonnte (set via setupWaEngine())
 *   WA_GROUP_ID    — ID grup WA tujuan broadcast (set via setupWaEngine())
 *
 * Extracted & generalized dari:
 *   - Batch 9 (kirimWA.gs): kirim ke nomor individu, slip gaji
 *   - Batch 11 (whatsapp.gs): kirim ke grup, rekap harian/bulanan
 */

var _WA_FONNTE_URL = 'https://api.fonnte.com/send';

// ─── Setup ────────────────────────────────────────────────────

/**
 * Simpan konfigurasi Fonnte ke PropertiesService.
 * Jalankan SEKALI dari GAS Editor setelah deploy.
 *
 * @param {string} token   - Fonnte API token
 * @param {string} groupId - WhatsApp Group ID (format: 12036xxx@g.us)
 */
function setupWaEngine(token, groupId) {
  var props = PropertiesService.getScriptProperties();
  if (token)   props.setProperty('FONNTE_TOKEN',   token);
  if (groupId) props.setProperty('WA_GROUP_ID',    groupId);
  Logger.log('WA Engine: config tersimpan.');
}

function _getFonnteToken() {
  var t = PropertiesService.getScriptProperties().getProperty('FONNTE_TOKEN');
  if (!t) throw new Error('FONNTE_TOKEN belum di-setup. Jalankan setupWaEngine() dulu.');
  return t;
}

function _getWaGroupId() {
  var g = PropertiesService.getScriptProperties().getProperty('WA_GROUP_ID');
  if (!g) throw new Error('WA_GROUP_ID belum di-setup. Jalankan setupWaEngine() dulu.');
  return g;
}

// ─── Core Send ────────────────────────────────────────────────

/**
 * Kirim pesan WA ke SATU nomor (individu).
 *
 * @param {string} nomor - Nomor HP format 628xxx (tanpa +, tanpa spasi)
 * @param {string} pesan - Isi pesan (teks biasa, markdown WA didukung)
 * @returns {object} Response Fonnte
 */
function waSendToNumber(nomor, pesan) {
  nomor = String(nomor || '').replace(/\D/g, '');
  if (!nomor) throw new Error('WA Engine: nomor tidak valid.');
  return _fonntePost_(nomor, pesan);
}

/**
 * Kirim pesan WA ke GRUP (broadcast operasional / finance).
 *
 * @param {string} pesan - Isi pesan
 * @returns {object} Response Fonnte
 */
function waSendToGroup(pesan) {
  return _fonntePost_(_getWaGroupId(), pesan);
}

/**
 * Kirim pesan WA ke banyak nomor sekaligus (batch).
 * Jeda 1 detik antar pesan untuk menghindari rate-limit Fonnte.
 *
 * @param {Array<{nomor:string, pesan:string}>} list
 * @returns {{sukses:number, gagal:number, detail:string[]}}
 */
function waSendBatch(list) {
  var sukses = 0, gagal = 0, detail = [];
  list.forEach(function(item) {
    try {
      waSendToNumber(item.nomor, item.pesan);
      sukses++;
      detail.push('✅ ' + item.nomor);
    } catch (e) {
      gagal++;
      detail.push('❌ ' + item.nomor + ': ' + e.message);
    }
    Utilities.sleep(1000);
  });
  return { sukses: sukses, gagal: gagal, detail: detail };
}

// ─── Template Pesan per Modul ─────────────────────────────────

/**
 * Template: Slip gaji (HRIS)
 */
function waBuildPesanSlipGaji(namaStaff, periode, linkPDF) {
  return (
    '📄 *Slip Gaji ' + periode + '*\n\n' +
    'Yth. ' + namaStaff + ',\n\n' +
    'Slip gaji Anda untuk periode *' + periode + '* sudah tersedia.\n\n' +
    '🔗 ' + linkPDF + '\n\n' +
    '⚠️ _Dokumen ini RAHASIA — jangan dibagikan ke pihak lain._\n' +
    'Pertanyaan? Hubungi admin atau koordinator cabang Anda.\n\n' +
    '_PT RIFIM INTERNASIONAL GEMILANG_'
  );
}

/**
 * Template: Notifikasi dokumen baru (Smart Office)
 */
function waBuildPesanDokumenBaru(params) {
  // params: { nomorDokumen, jenisDokumen, perihal, createdBy }
  return (
    '📋 *Dokumen Baru Dibuat*\n\n' +
    'No: *' + (params.nomorDokumen || '-') + '*\n' +
    'Jenis: ' + (params.jenisDokumen || '-') + '\n' +
    'Perihal: ' + (params.perihal || '-') + '\n' +
    'Oleh: ' + (params.createdBy || '-') + '\n\n' +
    '_RIFIM Smart Office_'
  );
}

/**
 * Template: Rekap keuangan harian (Finance)
 * @param {Array<{nama:string, pemasukan:number, pengeluaran:number, net:number, status:string}>} cabangList
 * @param {string} tanggal
 */
function waBuildRingkasanHarian(cabangList, tanggal) {
  var lines = [
    '📊 *REKAP KEUANGAN HARIAN*',
    'PT. RIFIM INTERNASIONAL GEMILANG',
    'Tanggal: ' + tanggal,
    ''
  ];
  var totalMasuk = 0, totalKeluar = 0;
  cabangList.forEach(function(c) {
    totalMasuk  += (c.pemasukan   || 0);
    totalKeluar += (c.pengeluaran || 0);
    lines.push('• ' + c.nama + ' ' + (c.status || ''));
    lines.push(
      '  Masuk: ' + waFormatRupiah(c.pemasukan) +
      ' | Keluar: ' + waFormatRupiah(c.pengeluaran) +
      ' | Net: ' + waFormatRupiah(c.net)
    );
  });
  lines.push('');
  lines.push('*TOTAL*');
  lines.push('Masuk: ' + waFormatRupiah(totalMasuk) + ' | Keluar: ' + waFormatRupiah(totalKeluar) + ' | Net: ' + waFormatRupiah(totalMasuk - totalKeluar));
  return lines.join('\n');
}

/**
 * Template: Rekap keuangan bulanan (Finance)
 * @param {Array<{nama:string, pemasukan:number, pengeluaran:number, net:number, margin:number, status:string}>} cabangList
 * @param {string} bulan
 */
function waBuildRingkasanBulanan(cabangList, bulan) {
  var lines = [
    '📈 *REKAP KEUANGAN BULANAN*',
    'PT. RIFIM INTERNASIONAL GEMILANG',
    'Bulan: ' + bulan,
    ''
  ];
  var totalMasuk = 0, totalKeluar = 0;
  var best = null;
  cabangList.forEach(function(c) {
    totalMasuk  += (c.pemasukan   || 0);
    totalKeluar += (c.pengeluaran || 0);
    if (!best || (c.net || 0) > best.net) best = { nama: c.nama, net: c.net || 0 };
    lines.push('• ' + c.nama + ' ' + (c.status || ''));
    lines.push(
      '  Masuk: ' + waFormatRupiah(c.pemasukan) +
      ' | Keluar: ' + waFormatRupiah(c.pengeluaran) +
      ' | Net: ' + waFormatRupiah(c.net) +
      ' | Margin: ' + ((c.margin || 0) * 100).toFixed(1) + '%'
    );
  });
  var totalNet    = totalMasuk - totalKeluar;
  var totalMargin = totalMasuk > 0 ? totalNet / totalMasuk : 0;
  lines.push('');
  lines.push('*TOTAL*');
  lines.push('Masuk: ' + waFormatRupiah(totalMasuk) + ' | Keluar: ' + waFormatRupiah(totalKeluar) + ' | Net: ' + waFormatRupiah(totalNet) + ' | Margin: ' + (totalMargin * 100).toFixed(1) + '%');
  if (best) lines.push('🏆 Terbaik: ' + best.nama + ' (' + waFormatRupiah(best.net) + ')');
  return lines.join('\n');
}

/**
 * Template: Notifikasi saldo driver rendah (RAOS)
 */
function waBuildPesanSaldoRendah(params) {
  // params: { namaDriver, idDriver, saldo, cabang }
  return (
    '⚠️ *Saldo Driver Rendah*\n\n' +
    'Driver: ' + (params.namaDriver || '-') + '\n' +
    'ID: ' + (params.idDriver || '-') + '\n' +
    'Cabang: ' + (params.cabang || '-') + '\n' +
    'Saldo: *' + waFormatRupiah(params.saldo) + '*\n\n' +
    '_Mohon segera top-up saldo._\n' +
    '_RIFIM OS — RAOS_'
  );
}

/**
 * Template: Notifikasi kontrak hampir berakhir (HRIS)
 */
function waBuildPesanKontrakHampirBerakhir(params) {
  // params: { namaKaryawan, idKaryawan, tanggalBerakhir, sisaHari }
  return (
    '⏳ *Kontrak Hampir Berakhir*\n\n' +
    'Karyawan: ' + (params.namaKaryawan || '-') + '\n' +
    'ID: ' + (params.idKaryawan || '-') + '\n' +
    'Berakhir: ' + (params.tanggalBerakhir || '-') + '\n' +
    'Sisa: *' + (params.sisaHari || 0) + ' hari*\n\n' +
    '_Mohon segera ditindaklanjuti._\n' +
    '_RIFIM OS — HRIS_'
  );
}

/**
 * Template: Ringkasan payroll siap (HRIS)
 */
function waBuildPesanPayrollSiap(params) {
  // params: { periode, jumlahStaff, estimasiTotal, jumlahCabang }
  return (
    '💰 *Payroll Siap Diproses*\n\n' +
    'Periode: *' + (params.periode || '-') + '*\n' +
    'Staff: ' + (params.jumlahStaff || 0) + ' orang\n' +
    'Cabang: ' + (params.jumlahCabang || 0) + '\n' +
    'Estimasi: *' + waFormatRupiah(params.estimasiTotal) + '*\n\n' +
    '_Segera jalankan Hitung Gaji & Tutup Buku._\n' +
    '_RIFIM OS — HRIS_'
  );
}

// ─── Format Helpers ───────────────────────────────────────────

/**
 * Format angka ke "Rp 1.000.000" (untuk pesan WA).
 */
function waFormatRupiah(nilai) {
  return 'Rp ' + Math.round(Number(nilai) || 0).toLocaleString('id-ID');
}

/**
 * Format tanggal ke "dd/MM/yyyy".
 */
function waFormatTanggal(date) {
  if (!(date instanceof Date)) return String(date || '');
  return Utilities.formatDate(date, 'Asia/Jakarta', 'dd/MM/yyyy');
}

/**
 * Format periode ke "Juli 2026".
 */
function waFormatPeriode(date) {
  var bulan = ['Januari','Februari','Maret','April','Mei','Juni',
               'Juli','Agustus','September','Oktober','November','Desember'];
  if (!(date instanceof Date)) return String(date || '');
  return bulan[date.getMonth()] + ' ' + date.getFullYear();
}

/**
 * Normalisasi nomor HP: hapus semua non-digit, pastikan dimulai 62.
 */
function waNormalisasiNomor(raw) {
  var n = String(raw || '').replace(/\D/g, '');
  if (n.startsWith('0')) n = '62' + n.slice(1);
  return n;
}

// ─── Private ──────────────────────────────────────────────────

function _fonntePost_(target, pesan) {
  var response = UrlFetchApp.fetch(_WA_FONNTE_URL, {
    method: 'POST',
    headers: { 'Authorization': _getFonnteToken() },
    payload: {
      target:      target,
      message:     pesan,
      countryCode: '62'
    },
    muteHttpExceptions: true
  });
  var code = response.getResponseCode();
  var body = response.getContentText();
  if (code !== 200) throw new Error('Fonnte HTTP ' + code + ': ' + body);
  var json = JSON.parse(body);
  if (json && json.status === false) {
    throw new Error('Fonnte error: ' + (json.reason || json.message || body));
  }
  Logger.log('WA Engine: terkirim ke ' + target);
  return json;
}

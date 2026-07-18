/**
 * RIFIM OS — Placeholder Engine
 * Replace semua {{PLACEHOLDER}} dalam Google Doc dengan data yang diberikan.
 */

/**
 * Replace placeholder di Google Doc.
 * @param {string} docId
 * @param {object} data - { RECIPIENT_NAME: 'PT. XYZ', ... }
 */
function replacePlaceholders(docId, data) {
  if (!docId) throw new Error('docId diperlukan.');
  if (!data || typeof data !== 'object') throw new Error('data harus berupa object.');

  var doc = DocumentApp.openById(docId);

  // Sections to search: body + header + footer (company info biasanya di header template)
  var sections = [doc.getBody()];
  try { var h = doc.getHeader(); if (h) sections.push(h); } catch (_) {}
  try { var f = doc.getFooter(); if (f) sections.push(f); } catch (_) {}

  Object.keys(data).forEach(function(key) {
    // Escape curly braces untuk Java regex yang dipakai GAS replaceText
    var placeholder = '\\{\\{' + key + '\\}\\}';
    var value       = (data[key] !== undefined && data[key] !== null) ? String(data[key]) : '';
    sections.forEach(function(section) {
      try { section.replaceText(placeholder, value); } catch (_) {}
    });
  });

  doc.saveAndClose();
}

/**
 * Buat data object lengkap dari input user + config perusahaan.
 * Semua field di userInput.extra di-spread jadi placeholder (uppercase).
 *
 * @param {object} userInput  - Data dari form dashboard
 * @param {object} config     - Key-value dari sheet company_config (lowercase keys)
 * @param {string} docNumber  - Nomor dari numberingEngine
 * @returns {object}
 */
function buildPlaceholderData(userInput, config, docNumber) {
  var now   = new Date();
  var date  = _formatDateIndonesian(now);
  var extra = userInput.extra || {};

  var data = {
    // ── System ──────────────────────────────────────────────
    DOCUMENT_NUMBER:   docNumber,
    DOCUMENT_DATE:     userInput.documentDate ? _formatDateIndonesian(new Date(userInput.documentDate)) : date,
    DOCUMENT_TYPE:     userInput.documentType || '',
    DOCUMENT_TITLE:    _getDocumentTitle(userInput.documentType),
    PLACE_DATE:        (config['company_city'] || 'Batam') + ', ' + date,

    // ── Perusahaan ───────────────────────────────────────────
    COMPANY_NAME:      config['company_name']    || 'PT. RIFIM INTERNASIONAL GEMILANG',
    COMPANY_ADDRESS:   config['company_address'] || '',
    COMPANY_PHONE:     config['company_phone']   || '',
    COMPANY_EMAIL:     config['company_email']   || '',
    COMPANY_WEBSITE:   config['company_website'] || '',
    CITY:              config['company_city']    || 'Batam',

    // ── Penanda tangan ───────────────────────────────────────
    DIRECTOR_NAME:     userInput.directorName  || config['director_name']  || '',
    DIRECTOR_TITLE:    userInput.directorTitle || config['director_title'] || '',

    // ── Penerima (diisi oleh extra spread juga) ──────────────
    RECIPIENT_NAME:    '',
    RECIPIENT_COMPANY: '',
    RECIPIENT_ADDRESS: '',

    // ── Konten dokumen ───────────────────────────────────────
    SUBJECT:     userInput.subject    || '',
    ATTACHMENT:  _formatAttachmentDisplay(userInput.attachment),
    BODY:        '',

    // ── Status ───────────────────────────────────────────────
    STATUS:      userInput.status || 'BELUM LUNAS',
  };

  // ── Spread semua extra fields → {{KEY_UPPERCASE}} ─────────
  if (extra && typeof extra === 'object') {
    Object.keys(extra).forEach(function(k) {
      var key = k.toUpperCase();
      if (!data[key]) data[key] = extra[k] || '';
    });
  }

  // ── Assembe BODY dari extra jika belum terisi ────────────
  if (!data['BODY']) {
    data['BODY'] = _buildBody(userInput.documentType, extra);
  }

  return data;
}


/**
 * Format nilai attachment (integer dari payload PWA) menjadi teks display
 * untuk placeholder {{ATTACHMENT}} di dokumen.
 *   0 / kosong / non-angka → '-'
 *   1                      → '1 (Satu) Berkas'
 *   n                      → 'n Berkas'
 * Kontrak payload: frontend WAJIB kirim attachment sebagai integer
 * (Rule 40-47 PROJECT_RULES.md). String angka lama tetap diterima.
 * @private
 */
function _formatAttachmentDisplay(raw) {
  var n = Math.round(Number(raw));
  if (isNaN(n) || n <= 0) return '-';
  var terbilang = {
    1: 'Satu', 2: 'Dua', 3: 'Tiga', 4: 'Empat', 5: 'Lima',
    6: 'Enam', 7: 'Tujuh', 8: 'Delapan', 9: 'Sembilan', 10: 'Sepuluh',
  };
  return terbilang[n]
    ? n + ' (' + terbilang[n] + ') Berkas'
    : n + ' Berkas';
}


/**
 * Judul dokumen untuk placeholder {{DOCUMENT_TITLE}} di template.
 * @private
 */
function _getDocumentTitle(docType) {
  var titles = {
    SURAT: 'SURAT RESMI',
    ST:    'SURAT TUGAS',
    SIZ:   'SURAT IZIN',
    SKT:   'SURAT KETERANGAN',
    BA:    'BERITA ACARA',
    FCO:   'FORM CHECKLIST OPERASIONAL',
    INV:   'INVOICE',
    KWT:   'KWITANSI',
    PROP:  'PROPOSAL',
    CP:    'COMPANY PROFILE',
    MOU:   'NOTA KESEPAHAMAN (MOU)',
    PKS:   'PERJANJIAN KERJASAMA',
    SP1:   'SURAT PERINGATAN I',
    SP2:   'SURAT PERINGATAN II',
    SP3:   'SURAT PERINGATAN III',
    PHK:   'SURAT PEMUTUSAN HUBUNGAN KERJA',
    PKWT:  'PERJANJIAN KERJA WAKTU TERTENTU',
    SPG:   'SURAT KEPUTUSAN PENGANGKATAN',
    SMT:   'SURAT KEPUTUSAN MUTASI',
    PI:    'PAKTA INTEGRITAS',
  };
  return titles[docType] || docType;
}


/**
 * Assembe isi BODY dari extra fields berdasarkan jenis dokumen.
 * Dipanggil jika {{BODY}} belum diisi oleh extra.body.
 * @private
 */
function _buildBody(docType, extra) {
  var e  = extra || {};
  var nl = '\n';

  function fd(d) {
    if (!d) return '';
    try { return _formatDateIndonesian(new Date(d)); } catch (_) { return d; }
  }

  switch (docType) {

    case 'SURAT':
      return e.body || '';

    case 'ST':
      return 'Menugaskan karyawan berikut ini:' + nl + nl +
        'Nama Karyawan : ' + (e.employee_name     || '') + nl +
        'ID Karyawan   : ' + (e.employee_id       || '') + nl +
        'Jabatan       : ' + (e.employee_position || '') + nl +
        'Departemen    : ' + (e.employee_dept     || '') + nl + nl +
        'Uraian Tugas  :' + nl + (e.task_desc     || '') + nl + nl +
        'Lokasi Tugas  : ' + (e.task_location || '') + nl +
        'Periode       : ' + fd(e.start_date) + ' s.d. ' + fd(e.end_date) + nl + nl +
        'Karyawan yang bersangkutan diharapkan melaksanakan tugas dengan penuh tanggung jawab' + nl +
        'dan melaporkan hasilnya kepada pimpinan setelah tugas selesai.';

    case 'SIZ':
      return 'Memberikan izin kepada karyawan:' + nl + nl +
        'Nama Karyawan : ' + (e.employee_name     || '') + nl +
        'ID Karyawan   : ' + (e.employee_id       || '') + nl +
        'Jabatan       : ' + (e.employee_position || '') + nl + nl +
        'Jenis Izin    : ' + (e.leave_type  || '') + nl +
        'Alasan        : ' + (e.reason      || '') + nl +
        'Mulai         : ' + fd(e.start_date) + nl +
        'Selesai       : ' + fd(e.end_date)   + nl +
        'Jumlah Hari   : ' + (e.leave_days  || '') + ' hari' + nl + nl +
        'Karyawan yang bersangkutan wajib melapor kembali kepada atasan setelah masa izin berakhir.';

    case 'SKT':
      return 'Menerangkan dengan sesungguhnya bahwa:' + nl + nl +
        'Nama       : ' + (e.employee_name     || '') + nl +
        'ID         : ' + (e.employee_id       || '') + nl +
        'Jabatan    : ' + (e.employee_position || '') + nl +
        'Departemen : ' + (e.employee_dept     || '') + nl + nl +
        (e.statement_purpose || '') + nl + nl +
        'Surat Keterangan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.';

    case 'BA':
      return 'Pada hari ini telah dilaksanakan kegiatan:' + nl + nl +
        'Nama Kegiatan : ' + (e.event_name  || '') + nl +
        'Tanggal       : ' + fd(e.event_date) + nl +
        'Waktu         : ' + (e.event_time  || '') + nl +
        'Tempat        : ' + (e.location    || '') + nl + nl +
        'PESERTA:' + nl + (e.attendees || '') + nl + nl +
        'URAIAN KEGIATAN:' + nl + (e.description || '') + nl + nl +
        'HASIL / KEPUTUSAN:' + nl + (e.result || '');

    case 'PROP':
      return 'I. LATAR BELAKANG' + nl + (e.background || '') + nl + nl +
        'II. TUJUAN KERJASAMA' + nl + (e.objectives || '') + nl + nl +
        'III. LINGKUP LAYANAN' + nl + (e.scope_items || '') + nl + nl +
        'IV. TIMELINE : ' + (e.timeline || '') + nl + nl +
        'V. ESTIMASI ANGGARAN : ' + (e.budget || '');

    case 'CP':
      return 'TENTANG KAMI' + nl + (e.services || '') + nl + nl +
        'VISI' + nl + (e.vision || '') + nl + nl +
        'MISI' + nl + (e.mission || '') + nl + nl +
        'KEUNGGULAN KAMI' + nl + (e.strengths || '');

    case 'FCO':
      return 'Jenis Checklist : ' + (e.checklist_type || '') + nl +
        'Petugas         : ' + (e.officer_name  || '') + nl +
        'Jabatan         : ' + (e.officer_title || '') + nl +
        'Tanggal         : ' + fd(e.check_date) + nl +
        'Periode         : ' + (e.period   || '') + nl +
        'Lokasi          : ' + (e.location || '') + nl + nl +
        'HASIL PEMERIKSAAN:' + nl + (e.checklist_items || '') + nl + nl +
        'Catatan & Temuan:' + nl + (e.notes || '-');

    case 'SP1':
      return 'Sehubungan dengan pelanggaran yang telah dilakukan oleh karyawan:' + nl + nl +
        'Tanggal Kejadian : ' + fd(e.incident_date) + nl + nl +
        'Uraian Pelanggaran:' + nl + (e.violation || '') + nl + nl +
        'Maka dengan ini diberikan SURAT PERINGATAN PERTAMA (SP-1) sebagai tindakan disiplin.' + nl +
        'Diharapkan karyawan segera memperbaiki diri dan tidak mengulangi pelanggaran.';

    case 'SP2':
      return 'Sehubungan dengan pelanggaran yang kembali dilakukan oleh karyawan,' + nl +
        'mengacu pada SP-1 Nomor: ' + (e.previous_sp_number || '') + nl + nl +
        'Tanggal Kejadian : ' + fd(e.incident_date) + nl + nl +
        'Uraian Pelanggaran:' + nl + (e.violation || '') + nl + nl +
        'Maka dengan ini diberikan SURAT PERINGATAN KEDUA (SP-2).' + nl +
        'Apabila pelanggaran terulang, perusahaan akan mengambil tindakan lebih lanjut.';

    case 'SP3':
      return 'Mengacu pada SP-1 Nomor: ' + (e.sp1_number || '') + nl +
        'dan SP-2 Nomor: ' + (e.sp2_number || '') + nl + nl +
        'Tanggal Kejadian : ' + fd(e.incident_date) + nl + nl +
        'Uraian Pelanggaran:' + nl + (e.violation || '') + nl + nl +
        'Dengan ini diberikan SURAT PERINGATAN KETIGA (SP-3) sekaligus sebagai peringatan' + nl +
        'terakhir. Pelanggaran selanjutnya akan berujung pada pemutusan hubungan kerja.';

    case 'PHK':
      return 'Dengan ini memberitahukan Pemutusan Hubungan Kerja (PHK) kepada:' + nl + nl +
        'Tanggal Bergabung   : ' + fd(e.join_date) + nl +
        'Hari Kerja Terakhir : ' + fd(e.last_working_day) + nl + nl +
        'Alasan PHK:' + nl + (e.phk_reason || '') + nl + nl +
        'Seluruh hak dan kewajiban karyawan akan diselesaikan sesuai ketentuan perundangan yang berlaku.';

    case 'PKWT':
      return 'KETENTUAN POKOK PERJANJIAN KERJA:' + nl + nl +
        'Jabatan     : ' + (e.employee_position || '') + nl +
        'Departemen  : ' + (e.employee_dept     || '') + nl +
        'Gaji Pokok  : ' + (e.salary     || '') + nl +
        'Tanggal Gaji: Setiap tanggal ' + (e.payday    || '') + nl +
        'Jam Kerja   : ' + (e.work_hours || '') + ' per hari, ' + (e.work_days || '') + ' hari per minggu' + nl +
        'Mulai Kerja : ' + fd(e.contract_start) + nl +
        'Akhir Kontrak: ' + fd(e.contract_end) + nl + nl +
        'Kedua pihak telah membaca, memahami, dan menyetujui seluruh isi perjanjian ini.';

    case 'SPG':
      return 'Dengan mempertimbangkan kinerja dan dedikasi karyawan, menetapkan:' + nl + nl +
        'PENGANGKATAN JABATAN' + nl + nl +
        'Dari Jabatan  : ' + (e.old_position  || '') + nl +
        'Ke Jabatan    : ' + (e.new_position  || '') + nl +
        'Departemen    : ' + (e.employee_dept || '') + nl +
        'Berlaku Mulai : ' + fd(e.effective_date) + nl + nl +
        'Karyawan yang bersangkutan diharapkan menjalankan tugas dan tanggung jawab jabatan baru' + nl +
        'dengan sebaik-baiknya demi kemajuan perusahaan.';

    case 'SMT':
      return 'Dengan mempertimbangkan kebutuhan operasional perusahaan, menetapkan:' + nl + nl +
        'MUTASI KARYAWAN' + nl + nl +
        'Jabatan       : ' + (e.employee_position || '') + nl +
        'Dari Dept.    : ' + (e.from_dept         || '') + nl +
        'Ke Dept.      : ' + (e.to_dept           || '') + nl +
        'Lokasi Baru   : ' + (e.new_location      || '') + nl +
        'Berlaku Mulai : ' + fd(e.effective_date) + nl + nl +
        'Karyawan yang bersangkutan diharapkan segera melaporkan diri kepada pimpinan di' + nl +
        'unit kerja yang baru.';

    case 'PI':
      return 'Saya yang bertanda tangan di bawah ini, dengan penuh kesadaran dan tanggung jawab,' + nl +
        'menyatakan PAKTA INTEGRITAS sebagai berikut:' + nl + nl +
        '1. Tidak akan melakukan tindakan Korupsi, Kolusi, dan Nepotisme (KKN) dalam' + nl +
        '   menjalankan tugas dan fungsi jabatan saya.' + nl + nl +
        '2. Menjaga kerahasiaan informasi perusahaan, data pelanggan, dan hal-hal yang' + nl +
        '   bersifat rahasia sesuai kebijakan perusahaan.' + nl + nl +
        '3. Bersikap jujur, transparan, dan bertanggung jawab dalam setiap pekerjaan.' + nl + nl +
        '4. Mengutamakan kepentingan perusahaan dan kepuasan pelanggan di atas kepentingan pribadi.' + nl + nl +
        '5. Mematuhi seluruh peraturan, tata tertib, dan SOP yang berlaku di perusahaan.' + nl + nl +
        'Apabila saya melanggar pernyataan ini, saya bersedia menerima sanksi sesuai ketentuan' + nl +
        'yang berlaku, termasuk pemutusan hubungan kerja.';

    case 'MOU':
      return 'PASAL 1 — LINGKUP KERJASAMA' + nl + (e.scope || '') + nl + nl +
        'PASAL 2 — JANGKA WAKTU' + nl +
        'Kesepakatan ini berlaku selama ' + (e.duration || '') + '.' + nl + nl +
        'PASAL 3 — HAK DAN KEWAJIBAN' + nl + (e.rights_obligations || '') + nl + nl +
        'PASAL 4 — KERAHASIAAN' + nl +
        'Para pihak sepakat untuk menjaga kerahasiaan informasi yang diperoleh selama kerjasama.' + nl + nl +
        'PASAL 5 — PENYELESAIAN SENGKETA' + nl +
        'Setiap perselisihan akan diselesaikan secara musyawarah mufakat. Apabila tidak tercapai,' + nl +
        'akan diselesaikan melalui jalur hukum yang berlaku.';

    case 'PKS':
      return 'PASAL 1 — LINGKUP PEKERJAAN' + nl + (e.scope || '') + nl + nl +
        'PASAL 2 — NILAI DAN PEMBAYARAN' + nl +
        'Nilai Kerjasama    : ' + (e.value         || '') + nl +
        'Mekanisme Bayar    : ' + (e.payment_terms || '') + nl +
        'Durasi             : ' + (e.duration      || '') + nl + nl +
        'PASAL 3 — HAK DAN KEWAJIBAN' + nl + (e.rights_obligations || '') + nl + nl +
        'PASAL 4 — KERAHASIAAN' + nl +
        'Para pihak wajib menjaga kerahasiaan informasi selama dan setelah masa perjanjian.' + nl + nl +
        'PASAL 5 — PENYELESAIAN SENGKETA' + nl +
        'Sengketa diselesaikan secara musyawarah, atau melalui jalur hukum jika diperlukan.';

    default:
      return e.body || '';
  }
}

/**
 * Format tanggal ke bahasa Indonesia.
 * @private
 */
function _formatDateIndonesian(date) {
  var months = ['Januari','Februari','Maret','April','Mei','Juni',
                'Juli','Agustus','September','Oktober','November','Desember'];
  return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
}

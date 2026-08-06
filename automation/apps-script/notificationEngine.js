/**
 * RIFIM OS — Notification Engine
 * Phase 2 Engine: Email & RAOS Chat Notifications
 *
 * Email  → GmailApp (langsung, tanpa token eksternal)
 * Chat   → chatBridge.js (Supabase RPC)
 *
 * Setiap fungsi notifXxx() kirim dua kanal sekaligus: email + RAOS Chat.
 * Chat selalu try/catch non-fatal agar kegagalan chat tidak block email.
 */

/**
 * Kirim email via GmailApp.
 * @param {string} to
 * @param {string} subject
 * @param {string} htmlBody
 * @param {{ name?, cc?, bcc? }} opts
 */
function notifSendEmail(to, subject, htmlBody, opts) {
  opts = opts || {};
  GmailApp.sendEmail(to, subject, '', {
    htmlBody: htmlBody,
    name:     opts.name || 'RIFIM OS',
    cc:       opts.cc   || '',
    bcc:      opts.bcc  || '',
  });
  Logger.log('Email terkirim → ' + to + ' | ' + subject);
}

/**
 * Notifikasi dokumen berhasil dibuat di Smart Office.
 * Dipanggil dari webApp.js setelah generateDocument() sukses.
 *
 * @param {{ documentNumber, documentType, subject, gdocUrl, pdfUrl, createdBy }} params
 */
function notifDocumentCreated(params) {
  var subject = '[RIFIM OS] Dokumen Dibuat — ' + params.documentNumber;
  var html = _emailTemplate({
    title:   'Dokumen Berhasil Dibuat',
    content:
      '<p>Dokumen baru telah berhasil dibuat melalui RIFIM Smart Office.</p>' +
      '<table style="border-collapse:collapse;width:100%">' +
      _tr('Nomor Dokumen', params.documentNumber) +
      _tr('Jenis Dokumen', params.documentType)   +
      _tr('Perihal',       params.subject)         +
      _tr('Dibuat Oleh',   params.createdBy || '-') +
      '</table>' +
      '<p style="margin-top:16px">' +
      (params.gdocUrl ? '<a href="' + params.gdocUrl + '" style="display:inline-block;margin-right:12px;padding:8px 16px;background:#1a1a2e;color:white;text-decoration:none;border-radius:4px;">📄 Buka Google Doc</a>' : '') +
      (params.pdfUrl  ? '<a href="' + params.pdfUrl  + '" style="display:inline-block;padding:8px 16px;background:#C40000;color:white;text-decoration:none;border-radius:4px;">📥 Download PDF</a>' : '') +
      '</p>',
  });
  try {
    notifSendEmail('rifiminternationalgemilang@gmail.com', subject, html, { name: 'RIFIM Smart Office' });
  } catch (err) {
    Logger.log('notifDocumentCreated email gagal (non-fatal): ' + err.message);
  }
  try {
    _chatPostAnnouncement(_buildDokumenBaruMessage({
      nomorDokumen: params.documentNumber,
      jenisDokumen: params.documentType,
      perihal:      params.subject,
      createdBy:    params.createdBy,
    }), 'doc_created', {
      document_number: params.documentNumber,
      document_type: params.documentType,
      created_by: params.createdBy || null,
      gdoc_url: params.gdocUrl || null,
      pdf_url: params.pdfUrl || null,
      deep_link: params.gdocUrl || params.pdfUrl || null,
    });
  } catch (errChat) {
    _gasLogError('Smart Office', 'notifDocumentCreated_chat', errChat, { document_number: params.documentNumber });
  }
}

/**
 * Notifikasi kontrak karyawan hampir berakhir.
 * Dipanggil dari time-based trigger (tiap hari).
 */
function notifCheckExpiringContracts() {
  var contracts;
  try {
    contracts = hrisGetExpiringContracts(30); // 30 hari ke depan
  } catch (err) {
    // Rule 43a — trigger tanpa pengawasan: catat kegagalan ke system_log
    _gasLogError('HRIS', 'notifCheckExpiringContracts', err);
    return;
  }
  contracts.forEach(function(c) {
    try {
    var emp = hrisGetEmployee(c.employee_id);
    if (!emp) return;
    var daysLeft = _daysUntil(c.end_date);
    var subject  = '[RIFIM OS] Kontrak Hampir Berakhir — ' + emp.full_name + ' (' + daysLeft + ' hari)';
    var html = _emailTemplate({
      title:   'Notifikasi Kontrak Hampir Berakhir',
      content:
        '<p>Yth. Tim HRD,</p>' +
        '<p>Kontrak karyawan berikut akan berakhir dalam <strong>' + daysLeft + ' hari</strong>:</p>' +
        '<table style="border-collapse:collapse;width:100%">' +
        _tr('Nama',           emp.full_name) +
        _tr('ID Karyawan',    emp.employee_id) +
        _tr('Jabatan',        emp.position || '-') +
        _tr('Perusahaan',     emp.company_code) +
        _tr('Jenis Kontrak',  c.contract_type) +
        _tr('Tanggal Berakhir', c.end_date) +
        _tr('No. Dokumen',    c.document_number || '-') +
        '</table>' +
        '<p style="margin-top:16px">Mohon segera ditindaklanjuti.</p>',
    });
    notifSendEmail('rifiminternationalgemilang@gmail.com', subject, html);
    try {
      _chatPostAnnouncement(_buildKontrakHampirBerakhirMessage({
        namaKaryawan:  emp.full_name,
        idKaryawan:    emp.employee_id,
        tanggalBerakhir: c.end_date,
        sisaHari:      daysLeft,
      }), 'hris_kontrak', {
        employee_id: emp.employee_id,
        end_date: c.end_date,
        days_left: daysLeft,
      });
    } catch (errChat) {
      _gasLogError('HRIS', 'notifCheckExpiringContracts_chat', errChat,
        { employee_id: emp.employee_id, end_date: c.end_date });
    }
    } catch (errC) {
      // Satu kontrak gagal → catat, lanjut ke kontrak berikutnya
      _gasLogError('HRIS', 'notifCheckExpiringContracts', errC,
        { employee_id: c.employee_id, end_date: c.end_date });
    }
  });
}

/**
 * Notifikasi perubahan status cuti.
 * @param {{ full_name, email, employee_id }} employee
 * @param {{ leave_type, start_date, end_date, total_days, status, reject_reason? }} leave
 */
function notifLeaveStatusChanged(employee, leave) {
  var statusText = leave.status === 'DISETUJUI' ? 'Disetujui ✅' : 'Ditolak ❌';
  var subject    = '[RIFIM OS] Cuti ' + statusText + ' — ' + employee.full_name;
  var html = _emailTemplate({
    title:   'Update Status Pengajuan Cuti',
    content:
      '<p>Yth. ' + employee.full_name + ',</p>' +
      '<p>Pengajuan cuti Anda telah <strong>' + statusText + '</strong>.</p>' +
      '<table style="border-collapse:collapse;width:100%">' +
      _tr('Jenis Cuti',  leave.leave_type) +
      _tr('Tanggal',     leave.start_date + ' s/d ' + leave.end_date) +
      _tr('Total Hari',  leave.total_days + ' hari') +
      (leave.status === 'DITOLAK' ? _tr('Alasan', leave.reject_reason || '-') : '') +
      '</table>',
  });
  if (employee.email) notifSendEmail(employee.email, subject, html);
  notifSendEmail('rifiminternationalgemilang@gmail.com', subject, html, { name: 'RIFIM OS HRIS' });
  // Chat Pengumuman — khusus yang DISETUJUI agar tidak spam
  if (leave.status === 'DISETUJUI') {
    try {
      _chatPostAnnouncement(
        '📋 Cuti Disetujui\n' + employee.full_name + '\n' +
        leave.leave_type + ' — ' + leave.start_date + ' s/d ' + leave.end_date +
        ' (' + leave.total_days + ' hari)\nRIFIM OS — HRIS',
        'hris_cuti',
        { employee_id: employee.employee_id, status: leave.status, start_date: leave.start_date, end_date: leave.end_date }
      );
    } catch (errChat) {
      _gasLogError('HRIS', 'notifLeaveStatusChanged_chat', errChat, { employee_id: employee.employee_id });
    }
  }
}

/**
 * Notifikasi slip gaji tersedia.
 * @param {{ full_name, email }} employee
 * @param {{ period_month, period_year, total_salary, gdoc_url, pdf_url }} payroll
 */
function notifPayslipReady(employee, payroll) {
  var period  = _monthName(payroll.period_month) + ' ' + payroll.period_year;
  var subject = '[RIFIM OS] Slip Gaji ' + period + ' — ' + employee.full_name;
  var html = _emailTemplate({
    title:   'Slip Gaji Tersedia',
    content:
      '<p>Yth. ' + employee.full_name + ',</p>' +
      '<p>Slip gaji Anda untuk periode <strong>' + period + '</strong> sudah tersedia.</p>' +
      (payroll.gdoc_url ? '<p><a href="' + payroll.gdoc_url + '" style="color:#1a1a2e">📄 Lihat Slip Gaji</a></p>' : '') +
      (payroll.pdf_url  ? '<p><a href="' + payroll.pdf_url  + '" style="color:#1a1a2e">📥 Download PDF</a></p>'   : ''),
  });
  if (employee.email) notifSendEmail(employee.email, subject, html);
  try {
    var userId = employee.user_id || employee.profile_id || null;
    var roomId = userId ? _supaRpc('raos_resolve_private_room', { p_user_id: userId }) : null;
    var privateRoomFound = !!roomId;
    if (!roomId) roomId = _supaRpc('raos_resolve_announcement_room', {});
    _chatPostSystem(roomId,
      _buildSlipGajiMessage(employee.full_name, period, payroll.pdf_url || payroll.gdoc_url || '-'),
      'payroll',
      {
        user_id: userId,
        period_month: payroll.period_month,
        period_year: payroll.period_year,
        private_room_found: privateRoomFound,
        deep_link: payroll.pdf_url || payroll.gdoc_url || null,
      }
    );
  } catch (errChat) {
    _gasLogError('HRIS', 'notifPayslipReady_chat', errChat, { user_id: employee.user_id || employee.profile_id || null });
  }
}

/**
 * Notifikasi payroll siap diproses (akhir bulan, trigger bulanan).
 * Setup trigger via: ScriptApp.newTrigger('notifPayrollSiapDiproses').timeBased().onMonthDay(28).atHour(8).create()
 *
 * @param {{ periode, jumlahStaff, estimasiTotal, jumlahCabang }} params
 */
function notifPayrollSiapDiproses(params) {
  params = params || {};
  var period = params.periode || _chatFormatPeriode(new Date());
  var subject = '[RIFIM OS] Payroll Siap Diproses — ' + period;
  var html = _emailTemplate({
    title: 'Payroll Siap Diproses',
    content:
      '<p>Yth. Tim Keuangan & HRD,</p>' +
      '<p>Proses penggajian untuk periode <strong>' + period + '</strong> siap dijalankan.</p>' +
      '<table style="border-collapse:collapse;width:100%">' +
      _tr('Periode',    period) +
      _tr('Jumlah Staff',  (params.jumlahStaff  || '-') + ' orang') +
      _tr('Jumlah Cabang', (params.jumlahCabang || '-')) +
      _tr('Estimasi Total', params.estimasiTotal ? 'Rp ' + Number(params.estimasiTotal).toLocaleString('id-ID') : '-') +
      '</table>' +
      '<p style="margin-top:16px">Segera jalankan <strong>Hitung Gaji</strong> dan <strong>Tutup Buku</strong> bulan ini.</p>',
  });
  try {
    notifSendEmail('rifiminternationalgemilang@gmail.com', subject, html, { name: 'RIFIM OS Payroll' });
  } catch (err) {
    Logger.log('notifPayrollSiapDiproses email gagal (non-fatal): ' + err.message);
  }
  try {
    _chatPostAnnouncement(_buildPayrollSiapMessage({
      periode:       period,
      jumlahStaff:   params.jumlahStaff   || 0,
      jumlahCabang:  params.jumlahCabang  || 0,
      estimasiTotal: params.estimasiTotal || 0,
    }), 'payroll', {
      period: period,
      staff_count: params.jumlahStaff || 0,
      branch_count: params.jumlahCabang || 0,
    });
  } catch (errChat) {
    _gasLogError('HRIS', 'notifPayrollSiapDiproses_chat', errChat, { period: period });
  }
}

/**
 * Buat trigger harian untuk notifCheckExpiringContracts (setiap hari jam 08:00 WIB).
 * Cek kontrak yang berakhir ≤30 hari → email + chat Pengumuman.
 * Jalankan SEKALI dari GAS Editor. Idempotent — trigger lama dihapus dulu.
 */
function setupTriggerExpiringContracts() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'notifCheckExpiringContracts') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('notifCheckExpiringContracts')
    .timeBased().everyDays(1).atHour(8).inTimezone('Asia/Jakarta').create();
  Logger.log('Trigger notifCheckExpiringContracts aktif: setiap hari jam 08:00 WIB');
}

/**
 * Buat trigger bulanan untuk notifPayrollSiapDiproses (hari ke-28 jam 08:00).
 * Jalankan SEKALI dari GAS Editor.
 */
function setupTriggerPayrollSiap() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'notifPayrollSiapDiproses') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('notifPayrollSiapDiproses')
    .timeBased().onMonthDay(28).atHour(8).inTimezone('Asia/Jakarta').create();
  Logger.log('Trigger notifPayrollSiapDiproses aktif: hari ke-28 jam 08:00 WIB');
}

/**
 * Notifikasi rekap keuangan harian ke chat Pengumuman.
 * Dipanggil dari Finance module.
 *
 * @param {Array<{nama, pemasukan, pengeluaran, net, status}>} cabangList
 * @param {string} tanggal
 */
function notifRekapFinanceHarian(cabangList, tanggal) {
  try {
    _chatPostAnnouncement(_buildRingkasanHarianMessage(cabangList, tanggal), 'finance_rekap',
      { period: 'daily', date: tanggal, branch_count: (cabangList || []).length });
  } catch (errChat) {
    _gasLogError('Finance', 'notifRekapFinanceHarian_chat', errChat, { date: tanggal });
  }
}

/**
 * Notifikasi rekap keuangan bulanan ke chat Pengumuman.
 * Dipanggil dari Finance module.
 *
 * @param {Array<{nama, pemasukan, pengeluaran, net, margin, status}>} cabangList
 * @param {string} bulan
 */
function notifRekapFinanceBulanan(cabangList, bulan) {
  try {
    _chatPostAnnouncement(_buildRingkasanBulananMessage(cabangList, bulan), 'finance_rekap',
      { period: 'monthly', month: bulan, branch_count: (cabangList || []).length });
  } catch (errChat) {
    _gasLogError('Finance', 'notifRekapFinanceBulanan_chat', errChat, { month: bulan });
  }
}

/**
 * Notifikasi saldo driver rendah (RAOS).
 *
 * @param {{ namaDriver, idDriver, saldo, cabang, noWA? }} params
 */
function notifSaldoDriverRendah(params) {
  try {
    _chatPostSaldoRoom(params.cabang, _buildSaldoRendahMessage(params), 'saldo_rendah', {
      driver_id: params.idDriver || null,
      driver_name: params.namaDriver || null,
      balance: Number(params.saldo) || 0,
    });
  } catch (errChat) {
    _gasLogError('RAOS', 'notifSaldoDriverRendah_chat', errChat,
      { branch_name: params.cabang, driver_id: params.idDriver || null });
  }
}

// ─── Private Helpers ─────────────────────────────────────────────

function _emailTemplate(opts) {
  return (
    '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f0f0f0;">' +
    '<div style="background:#1a1a2e;color:white;padding:16px 24px;border-radius:8px 8px 0 0;">' +
    '<h2 style="margin:0;letter-spacing:1px;">RIFIM OS</h2>' +
    '<p style="margin:4px 0 0;font-size:12px;opacity:.7;">Enterprise Operating System — PT. RIFIM Internasional Gemilang</p>' +
    '</div>' +
    '<div style="background:#ffffff;padding:24px;border:1px solid #e0e0e0;">' +
    '<h3 style="color:#1a1a2e;margin-top:0;">' + opts.title + '</h3>' +
    opts.content +
    '</div>' +
    '<div style="background:#e8e8e8;padding:12px 24px;border-radius:0 0 8px 8px;font-size:11px;color:#888;text-align:center;">' +
    'Email ini dikirim otomatis oleh RIFIM OS. Jangan membalas email ini.' +
    '</div></body></html>'
  );
}

function _tr(label, value) {
  return '<tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;width:40%">' +
    label + '</td><td style="padding:6px 8px;border:1px solid #ddd">' + (value || '-') + '</td></tr>';
}

function _daysUntil(dateStr) {
  var target = new Date(dateStr);
  var today  = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function _monthName(month) {
  return ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][month - 1] || month;
}

/**
 * RIFIM OS — Notification Engine
 * Phase 2 Engine: Email & WhatsApp Notifications
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
    Logger.log('notifDocumentCreated gagal (non-fatal): ' + err.message);
  }
}

/**
 * Notifikasi kontrak karyawan hampir berakhir.
 * Dipanggil dari time-based trigger (tiap hari).
 */
function notifCheckExpiringContracts() {
  var contracts = hrisGetExpiringContracts(30); // 30 hari ke depan
  contracts.forEach(function(c) {
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

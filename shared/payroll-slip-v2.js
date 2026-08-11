(function(global) {
  'use strict';

  var COMPANY = {
    RIFIM: {
      name: 'PT. RIFIM INTERNASIONAL GEMILANG',
      header: '/branding/header/header-rifim.png',
      footer: '/branding/footer/footer-rifim.png'
    },
    MIG: {
      name: 'PT. MENALA INTERNASIONAL GEMILANG',
      header: '/branding/header/header-menala.png',
      footer: '/branding/footer/footer-menala.png'
    },
    LAILAN: {
      name: 'CV. LAILAN KALILAN INDONESIA',
      header: '/branding/header/header-lailan.png',
      footer: '/branding/footer/footer-lailan.png'
    }
  };

  function money(value) {
    return 'Rp ' + Number(value || 0).toLocaleString('id-ID');
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>]/g, function(char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char];
    });
  }

  function documentNumber(row) {
    return row.document_number || ('PAY-' + String(row.period || '').replace('-', '') + '-' + String(row.employee_id || ''));
  }

  function kasbonLabel(row) {
    return row.kasbon_has_manual ? 'Kasbon Staff (termasuk input tombol manual)' : 'Kasbon Staff';
  }

  function html(row) {
    var company = COMPANY[row.company_code] || COMPANY.RIFIM;
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(documentNumber(row)) + '</title>' +
      '<style>' +
      '@page{size:A4;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#202020;margin:0}' +
      '.sheet{position:relative;min-height:277mm;border:1px solid #ddd;padding:28mm 16mm 26mm;overflow:hidden}' +
      '.head{position:absolute;top:0;left:0;right:0;height:25mm;background:url(\'' + company.header + '\') center top/100% 100% no-repeat}' +
      '.foot{position:absolute;bottom:0;left:0;right:0;height:20mm;background:url(\'' + company.footer + '\') center bottom/100% 100% no-repeat}' +
      '.wm{position:absolute;inset:70mm 20mm auto;font-size:86px;font-weight:900;color:#f3cc00;opacity:.08;transform:rotate(-20deg);text-align:center}' +
      '.title{text-align:right;font-size:22px;font-weight:800}.meta{display:grid;grid-template-columns:150px 1fr;gap:6px 12px;margin:22px 0;font-size:12px}' +
      '.sec{font-size:11px;font-weight:800;border-bottom:2px solid #111;padding-bottom:4px;margin-top:16px}' +
      'table{width:100%;border-collapse:collapse;font-size:12px;margin-top:5px}td{padding:6px 2px;border-bottom:1px solid #eee}td:last-child{text-align:right}' +
      '.total{margin-top:12px;border-top:2px solid #111;border-bottom:2px solid #111;padding:10px 4px;font-size:17px;font-weight:900;display:flex;justify-content:space-between}' +
      '.sign{margin-top:24px;display:flex;justify-content:flex-end;text-align:center;font-size:11px}.sign div{width:180px;height:70px}.doc{font-size:10px;color:#666;margin-top:10px}' +
      '@media print{button{display:none}.sheet{border:0}}' +
      '</style></head><body><div class="sheet">' +
      '<div class="head"></div><div class="foot"></div><div class="wm">MAXIM</div>' +
      '<div class="title">SLIP GAJI<br><span style="font-size:13px">' + esc(row.period || '') + '</span></div>' +
      '<div class="meta">' +
        '<b>Perusahaan</b><span>' + esc(company.name) + '</span>' +
        '<b>Cabang</b><span>' + esc(row.branch_name || '-') + '</span>' +
        '<b>ID Karyawan</b><span>' + esc(row.employee_id) + '</span>' +
        '<b>Nama</b><span>' + esc(row.staff_name) + '</span>' +
        '<b>Jabatan</b><span>' + esc(row.position || row.role || '-') + '</span>' +
        '<b>Departemen</b><span>' + esc(row.department || '-') + '</span>' +
        '<b>No. Dokumen</b><span>' + esc(documentNumber(row)) + '</span>' +
      '</div>' +
      '<div class="sec">PENDAPATAN</div><table>' +
        '<tr><td>Gaji Pokok</td><td>' + money(row.salary_base) + '</td></tr>' +
        '<tr><td>Tunjangan</td><td>' + money(row.allowances) + '</td></tr>' +
        '<tr><td>Bonus Saldo RAOS</td><td>' + money(row.bonus_saldo) + '</td></tr>' +
        '<tr><td>Bonus KPI / Target</td><td>' + money(row.bonus_kpi) + '</td></tr>' +
        '<tr><td>Lembur</td><td>' + money(row.overtime) + '</td></tr>' +
        '<tr><td>Deposit</td><td>' + money(row.deposit) + '</td></tr>' +
      '</table>' +
      '<div class="sec">POTONGAN</div><table>' +
        '<tr><td>Terlambat (' + Number(row.late_minutes || 0) + ' menit)</td><td>' + money(row.late_deduction) + '</td></tr>' +
        '<tr><td>Absensi / Tidak Hadir</td><td>' + money(row.absence_deduction) + '</td></tr>' +
        '<tr><td>' + esc(kasbonLabel(row)) + '</td><td>' + money(row.kasbon) + '</td></tr>' +
        '<tr><td>Potongan Lain</td><td>' + money(row.other_deduction) + '</td></tr>' +
      '</table>' +
      '<div class="total"><span>TOTAL PEMBAYARAN</span><span>' + money(row.total_payment) + '</span></div>' +
      '<div class="doc">Hadir: ' + Number(row.present_days || 0) + ' hari · Cuti: ' + Number(row.leave_days || 0) + ' hari · Data bersumber dari HRIS/RAOS/Finance sesuai periode.' + (row.kasbon_has_manual ? ' Kasbon payroll memuat input dari tombol manual.' : '') + '</div>' +
      '<div class="sign"><div>Disetujui,<br><br><br><b>DIREKSI</b></div></div>' +
      '</div><script>window.onload=function(){setTimeout(function(){window.print();},250)}<\/script></body></html>';
  }

  function open(row) {
    var win = window.open('', '_blank');
    if (!win) {
      global.showToast('Popup diblokir browser.', 'error');
      return;
    }
    win.document.write(html(row));
    win.document.close();
  }

  function openAll(rows) {
    if (!rows || !rows.length) {
      global.showToast('Tidak ada data payroll.', 'error');
      return;
    }
    var win = window.open('', '_blank');
    if (!win) {
      global.showToast('Popup diblokir browser.', 'error');
      return;
    }
    var body = rows.map(function(row, index) {
      var srcdoc = html(row).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      return '<iframe style="width:100%;height:1120px;border:0" srcdoc="' + srcdoc + '"></iframe>' + (index < rows.length - 1 ? '<div style="page-break-after:always"></div>' : '');
    }).join('');
    win.document.write('<!doctype html><html><head><style>@media print{.break{page-break-after:always}}</style></head><body>' + body + '</body></html>');
    win.document.close();
  }

  global.PayrollSlipV2 = {
    open: open,
    openAll: openAll,
    html: html
  };
})(window);

(function (global) {
  'use strict';
  function hrisAttendanceRole() {
    var raw = global.currentUser && global.currentUser.role ? String(global.currentUser.role).toUpperCase() : '';
    if (raw === 'DIREKTUR') return 'DIREKSI';
    if (raw === 'KOORD') return 'KOORDINATOR';
    if (raw === 'MGMT') return 'MANAGEMENT';
    return raw;
  }
  function canAttendanceWrite() {
    var role = hrisAttendanceRole();
    return role === 'ADMIN' || role === 'DIREKSI';
  }
  function canAttendanceRead() {
    return ['ADMIN', 'MANAGEMENT', 'DIREKSI', 'KOORDINATOR'].indexOf(hrisAttendanceRole()) !== -1;
  }
  function canAttendanceExportPdf() {
    var role = hrisAttendanceRole();
    return role === 'ADMIN' || role === 'DIREKSI';
  }
  function canAttendanceOvertime() {
    var role = hrisAttendanceRole();
    return role === 'ADMIN' || role === 'DIREKSI';
  }
  function attendanceBranchOptions(rows) {
    var role = hrisAttendanceRole();
    var list = Array.isArray(rows) ? rows.filter(function(row) {
      return row && row.is_active !== false;
    }).slice() : [];
    var hasHeadOffice = list.some(function(row) {
      return String(row.branch_name || row.name || '').toLowerCase() === 'head office';
    });
    if (!hasHeadOffice && (role === 'ADMIN' || role === 'MANAGEMENT' || role === 'DIREKSI')) {
      list.push({ branch_id: 'HEAD_OFFICE', branch_name: 'Head Office', is_active: true, virtual: true });
    }
    return list;
  }
  function validateAttendancePdfRange(from, to) {
    if (!canAttendanceExportPdf()) {
      return { ok: false, message: 'Export PDF hanya untuk Admin/Direksi.' };
    }
    if (!from || !to) {
      return { ok: false, message: 'Tanggal awal dan akhir wajib.' };
    }
    var fromDate = new Date(from + 'T00:00:00');
    var toDate = new Date(to + 'T00:00:00');
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return { ok: false, message: 'Format tanggal tidak valid.' };
    }
    if (fromDate.getFullYear() !== toDate.getFullYear() || fromDate.getMonth() !== toDate.getMonth()) {
      return { ok: false, message: 'PDF hanya boleh satu bulan kalender.' };
    }
    var lastDay = new Date(fromDate.getFullYear(), fromDate.getMonth() + 1, 0).getDate();
    if (fromDate.getDate() !== 1 || toDate.getDate() !== lastDay) {
      return { ok: false, message: 'Rentang PDF wajib tanggal 01 sampai akhir bulan (' + String(lastDay).padStart(2, '0') + ').' };
    }
    return { ok: true };
  }
  function applyAttendanceUiPolicy() {
    var canWrite = canAttendanceWrite();
    var manualBtn = document.getElementById('btn-att-manual');
    if (manualBtn) manualBtn.style.display = 'none';
    var pdfBtn = document.getElementById('btn-att-pdf');
    if (pdfBtn) pdfBtn.style.display = canAttendanceExportPdf() ? '' : 'none';
    var overtimeBtn = document.getElementById('btn-att-overtime');
    if (overtimeBtn) overtimeBtn.style.display = canAttendanceOvertime() ? '' : 'none';
    var branchFilter = document.getElementById('filter-att-branch');
    if (branchFilter && hrisAttendanceRole() === 'KOORDINATOR') {
      branchFilter.disabled = true;
      branchFilter.title = 'Koordinator hanya dapat melihat cabang sendiri';
    }
    document.querySelectorAll('[data-att-write]').forEach(function(el) {
      el.style.display = canWrite ? '' : 'none';
    });
  }
  function attendanceActionCell(rowId) {
    if (!canAttendanceWrite()) return '<span style="color:#888">Lihat saja</span>';
    return '<button class="btn btn-ghost btn-sm" data-att-write title="Edit absensi" onclick="openAttendanceEditModal(' +
      global.escAttr(JSON.stringify(String(rowId || ''))) + ')">' + global.iconSvg('pencil') + '</button>';
  }
  global.hrisAttendanceRole = hrisAttendanceRole;
  global.canAttendanceWrite = canAttendanceWrite;
  global.canAttendanceRead = canAttendanceRead;
  global.canAttendanceExportPdf = canAttendanceExportPdf;
  global.canAttendanceOvertime = canAttendanceOvertime;
  global.attendanceBranchOptions = attendanceBranchOptions;
  global.validateAttendancePdfRange = validateAttendancePdfRange;
  global.applyAttendanceUiPolicy = applyAttendanceUiPolicy;
  global.attendanceActionCell = attendanceActionCell;
})(window);

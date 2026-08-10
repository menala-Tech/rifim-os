/**
 * LOCAL PATCH — frontend HRIS Attendance role/data-scope helpers.
 * Target: modules/hris/index.html
 */

function hrisAttendanceRole() {
  var raw = currentUser && currentUser.role ? String(currentUser.role).toUpperCase() : '';
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

function applyAttendanceUiPolicy() {
  var canWrite = canAttendanceWrite();
  var manualBtn = document.getElementById('btn-att-manual');
  if (manualBtn) manualBtn.style.display = 'none'; // legacy HRIS attendance write disabled

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
    escAttr(JSON.stringify(String(rowId || ''))) + ')">' + iconSvg('pencil') + '</button>';
}

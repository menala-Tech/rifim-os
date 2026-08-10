/** Merge into Target Staff/Cabang renderer: status on selected day. */
function targetDailyAttendanceLabel(row){
  var s=String(row&&row.attendance_day_status||'NONAKTIF').toUpperCase()
  return s==='AKTIF' ? '<span class="badge badge-aktif">AKTIF</span>' : '<span class="badge badge-nonaktif">NON AKTIF</span>'
}

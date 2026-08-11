(function (global) {
  'use strict'

  const TARGET_ROLES = new Set(['staff','koordinator'])
  const PAYROLL_ROLES = new Set(['staff','koordinator','admin','management'])

  function normalizeRole(value) {
    if (global.RifimMasterRolePolicy) return global.RifimMasterRolePolicy.normalizeRole(value)
    const x = String(value || '').trim().toLowerCase()
    if (['direktur','direktur utama','direksi'].includes(x)) return 'direksi'
    if (['management','manajemen'].includes(x)) return 'management'
    if (['koordinator','coordinator'].includes(x)) return 'koordinator'
    if (x === 'admin') return 'admin'
    if (x === 'driver') return 'driver'
    if (['staff','staff konter','pickup point'].includes(x)) return 'staff'
    return x || 'unknown'
  }

  function plan(employee) {
    const role = normalizeRole(employee.role || employee.position)
    const active = String(employee.status || '').toUpperCase() === 'AKTIF'
    if (!active) return { role, active:false, modules:{} }
    return {
      role,
      active:true,
      modules:{
        pwa_raos: role !== 'direksi' && role !== 'management',
        raos_auth_pin: ['staff','koordinator','admin'].includes(role),
        attendance: ['staff','koordinator','admin','management'].includes(role),
        scan_order: ['staff','koordinator'].includes(role),
        isi_saldo: ['staff','koordinator','admin','management','direksi'].includes(role),
        target_staff: TARGET_ROLES.has(role),
        target_cabang: TARGET_ROLES.has(role),
        db_driver: false,
        finance: ['admin','management','direksi'].includes(role),
        chat_room: ['staff','koordinator','admin','management','direksi'].includes(role),
        hris_payroll: PAYROLL_ROLES.has(role),
        smart_office: ['koordinator','admin','management','direksi'].includes(role),
      },
    }
  }

  global.EmployeeModuleSyncRules = { normalizeRole, plan }
})(window)

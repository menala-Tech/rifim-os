(function (global) {
  'use strict'

  const ROLE_ALIASES = {
    staff: 'staff',
    'staff konter': 'staff',
    'pickup point': 'staff',

    koordinator: 'koordinator',
    coordinator: 'koordinator',

    admin: 'admin',
    administrator: 'admin',

    management: 'management',
    manajemen: 'management',

    direksi: 'direksi',
    direktur: 'direksi',
    'direktur utama': 'direksi',

    driver: 'driver',
  }

  const ACCESS = {
    admin:       { view:true, create:true, edit:true, delete:true,  scope:'all_allowed' },
    management:  { view:true, create:false,edit:false,delete:false, scope:'all_allowed' },
    koordinator: { view:true, create:false,edit:false,delete:false, scope:'branch' },
    direksi:     { view:true, create:true, edit:true, delete:true,  scope:'all' },
    staff:       { view:true, create:true, edit:false,delete:false, scope:'self_branch_operational' },
    driver:      { view:true, create:false,edit:false,delete:false, scope:'self' },
  }

  const DEPARTMENT_BY_ROLE = {
    staff: 'Operasional',
    koordinator: 'Operasional',
    admin: 'Admin',
    management: 'Management',
    direksi: 'Direktur',
    driver: 'Operasional',
  }

  const TARGET_INCLUDED = new Set(['staff','koordinator'])
  const PAYROLL_INCLUDED = new Set(['staff','koordinator','admin','management'])

  function normalizeRole(value) {
    const raw = String(value || '').trim().toLowerCase()
    return ROLE_ALIASES[raw] || raw
  }

  function accessFor(role) {
    return ACCESS[normalizeRole(role)] || {
      view:false, create:false, edit:false, delete:false, scope:'none'
    }
  }

  function departmentFor(role) {
    return DEPARTMENT_BY_ROLE[normalizeRole(role)] || 'Operasional'
  }

  function inOperationalTarget(role) {
    return TARGET_INCLUDED.has(normalizeRole(role))
  }

  function inHrisPayroll(role) {
    return PAYROLL_INCLUDED.has(normalizeRole(role))
  }

  function applyCrudToDom(role, root) {
    const policy = accessFor(role)
    root = root || document

    root.querySelectorAll('[data-action="create"]').forEach(el => {
      el.hidden = !policy.create
      if ('disabled' in el) el.disabled = !policy.create
    })
    root.querySelectorAll('[data-action="edit"]').forEach(el => {
      el.hidden = !policy.edit
      if ('disabled' in el) el.disabled = !policy.edit
    })
    root.querySelectorAll('[data-action="delete"]').forEach(el => {
      el.hidden = !policy.delete
      if ('disabled' in el) el.disabled = !policy.delete
    })
    root.querySelectorAll('[data-action="view"]').forEach(el => {
      el.hidden = !policy.view
    })

    return policy
  }

  global.RifimMasterRolePolicy = {
    normalizeRole,
    accessFor,
    departmentFor,
    inOperationalTarget,
    inHrisPayroll,
    applyCrudToDom,
    ACCESS,
  }
})(window)

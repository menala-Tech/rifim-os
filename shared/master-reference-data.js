(function (global) {
  'use strict'

  const DEPARTMENTS = Object.freeze([
    'Operasional',
    'Admin',
    'Management',
    'Direktur',
  ])

  // Branch IDs/slugs are loaded from the existing branches master.
  // Head Office is a business scope even if it is not a physical airport branch.
  const HEAD_OFFICE = Object.freeze({
    id: 'HEAD_OFFICE',
    slug: 'Head Office',
    name: 'Head Office',
    branch_type: 'head_office',
  })

  function normalizeDepartment(value) {
    const x = String(value || '').trim().toLowerCase()
    if (x === 'admin') return 'Admin'
    if (x === 'management' || x === 'manajemen') return 'Management'
    if (x === 'direksi' || x === 'direktur' || x === 'direktur utama') return 'Direktur'
    return 'Operasional'
  }

  function withHeadOffice(branches) {
    const rows = Array.isArray(branches) ? branches.slice() : []
    if (!rows.some(x => String(x.slug || x.name || '').toLowerCase() === 'head office')) {
      rows.push(HEAD_OFFICE)
    }
    return rows
  }

  global.RifimMasterReferenceData = {
    DEPARTMENTS,
    HEAD_OFFICE,
    normalizeDepartment,
    withHeadOffice,
  }
})(window)

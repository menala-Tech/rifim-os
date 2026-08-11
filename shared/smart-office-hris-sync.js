(function (global) {
  'use strict'

  const CACHE_KEY = 'smart_office_hris_employees_v2'
  const TTL = 30 * 60 * 1000
  let config = null
  let employees = []
  let loadedAt = 0

  function configure(opts) {
    config = opts || {}
    loadCache()
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!parsed || !Array.isArray(parsed.employees)) return
      employees = parsed.employees
      loadedAt = Number(parsed.at || 0)
    } catch (_) {}
  }

  function saveCache(rows) {
    employees = Array.isArray(rows) ? rows : []
    loadedAt = Date.now()
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at: loadedAt, employees }))
    } catch (_) {}
  }

  function gasUrl() {
    if (!config || !config.gasUrl) throw new Error('SmartOfficeHrisSync belum dikonfigurasi')
    return config.gasUrl
  }

  async function refresh(force) {
    if (!force && employees.length && Date.now() - loadedAt < TTL) return employees
    const url = new URL(gasUrl())
    url.searchParams.set('action', 'staff_list')
    const res = await fetch(url.toString())
    const data = await res.json()
    if (!data || data.success !== true) {
      throw new Error(data && data.message ? data.message : 'Gagal membaca daftar staff Smart Office')
    }
    saveCache(data.staff || [])
    return employees
  }

  function normalizeRow(row) {
    if (!row) return null
    return {
      full_name: row.nama || row.full_name || '',
      employee_id: row.id || row.employee_id || row.staff_id || '',
      position: row.jabatan || row.position || '',
      department: row.department || row.dept || '',
      branch: row.cabang || row.branch || '',
      salary_base: row.salary_base || row.salary || '',
      join_date: row.join_date || '',
      status: row.status || 'AKTIF',
    }
  }

  function findEmployee(query) {
    const q = String(query || '').trim().toLowerCase()
    if (!q) return null
    const found = employees.find(row => {
      const e = normalizeRow(row)
      return String(e.employee_id || '').toLowerCase() === q ||
        String(e.full_name || '').toLowerCase() === q
    })
    return found ? normalizeRow(found) : null
  }

  function departmentForEmployee(emp) {
    if (global.RifimMasterReferenceData) {
      return global.RifimMasterReferenceData.normalizeDepartment(emp.position || emp.department)
    }
    return emp.department || 'Operasional'
  }

  function setValue(id, value, readonly) {
    const el = document.getElementById(id)
    if (!el || value == null || value === '') return
    el.value = value
    if (readonly === true) el.readOnly = true
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function salaryText(value) {
    if (value == null || value === '') return ''
    const numeric = String(value).replace(/[^0-9]/g, '')
    if (!numeric) return ''
    return 'Rp ' + Number(numeric).toLocaleString('id-ID')
  }

  function fillEmployee(emp) {
    if (!emp) return false
    setValue('employee_name', emp.full_name, false)
    setValue('employee_id', emp.employee_id, true)
    setValue('employee_position', emp.position, true)
    setValue('employee_dept', departmentForEmployee(emp), true)
    setValue('salary', salaryText(emp.salary_base), true)
    setValue('join_date', emp.join_date, true)
    setValue('officer_name', emp.full_name, false)
    setValue('officer_title', emp.position, true)
    ;['task_location', 'new_location', 'branch_name', 'branch'].forEach(id => {
      const el = document.getElementById(id)
      if (el && !el.value) setValue(id, emp.branch, false)
    })
    return true
  }

  function ensureDatalist() {
    let dl = document.getElementById('smartOfficeEmployeeList')
    if (!dl) {
      dl = document.createElement('datalist')
      dl.id = 'smartOfficeEmployeeList'
      document.body.appendChild(dl)
    }
    dl.innerHTML = employees.map(row => {
      const e = normalizeRow(row)
      const label = [e.full_name, e.position, e.branch].filter(Boolean).join(' — ')
      return '<option value="' + escapeHtml(e.full_name) + '">' + escapeHtml(label) + '</option>' +
        '<option value="' + escapeHtml(e.employee_id) + '">' + escapeHtml(label) + '</option>'
    }).join('')
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function attachEmployeeLookup(container) {
    container = container || document
    const inputs = [
      container.querySelector('#employee_name'),
      container.querySelector('#employee_id'),
      container.querySelector('#officer_name'),
    ].filter(Boolean)

    const trigger = async input => {
      const raw = input && input.value
      if (!raw) return
      let emp = findEmployee(raw)
      if (!emp) {
        await refresh(false).catch(() => {})
        emp = findEmployee(raw)
      }
      if (emp) fillEmployee(emp)
    }

    inputs.forEach(input => {
      input.setAttribute('list', 'smartOfficeEmployeeList')
      input.setAttribute('autocomplete', 'off')
      if (input.dataset.soHrisBound === '1') return
      input.dataset.soHrisBound = '1'
      input.addEventListener('change', () => trigger(input))
      input.addEventListener('blur', () => trigger(input))
    })

    ensureDatalist()
  }

  async function onDocumentFieldsRendered(container) {
    ensureDatalist()
    attachEmployeeLookup(container || document)
    refresh(false).then(() => {
      ensureDatalist()
      attachEmployeeLookup(container || document)
    }).catch(err => console.warn('[SmartOffice HRIS lookup]', err))
  }

  global.SmartOfficeHrisSync = {
    configure,
    refresh,
    findEmployee,
    fillEmployee,
    attachEmployeeLookup,
    onDocumentFieldsRendered,
  }
})(window)

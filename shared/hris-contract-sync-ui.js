(function (global) {
  'use strict'

  const CACHE_KEY = 'hris_contract_employee_view_v1'

  function getCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    } catch (_) { return null }
  }

  function setCache(rows) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at:Date.now(), rows }))
    } catch (_) {}
  }

  function renderIntoExistingTable(rows) {
    const tbody = document.getElementById('tbody-contracts')
    if (!tbody) return

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Belum ada kontrak.</td></tr>'
      return
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${esc(r.employee_id)}</td>
        <td>${esc(r.full_name || '-')}</td>
        <td>${esc(r.contract_type || '-')}</td>
        <td>${esc(r.start_date || '-')}</td>
        <td>${esc(r.end_date || '-')}</td>
        <td>
          ${r.pdf_url ? `<a href="${escAttr(r.pdf_url)}" target="_blank">${esc(r.document_number || 'PDF')}</a>` : esc(r.document_number || '-')}
        </td>
        <td>
          <span class="badge badge-${String(r.validation_status || 'pending').toLowerCase()}">
            ${esc(r.validation_status || 'pending')}
          </span>
        </td>
        <td>
          ${actions(r)}
        </td>
      </tr>
    `).join('')

    tbody.querySelectorAll('[data-validate-contract]').forEach(btn => {
      btn.addEventListener('click', () => validateContract(btn.dataset.validateContract))
    })
  }

  function actions(row) {
    const role = currentRole()
    const write = ['admin','direksi'].includes(role)
    if (!write) return '<button class="btn btn-ghost btn-sm" disabled>Lihat</button>'

    if (row.validation_status !== 'validated') {
      return `<button class="btn btn-success btn-sm" data-validate-contract="${escAttr(row.id)}">Validasi</button>`
    }
    return '<span class="badge badge-aktif">Tervalidasi</span>'
  }

  function currentRole() {
    try {
      return String(global.currentUser?.role || JSON.parse(localStorage.getItem('rifim_auth') || '{}').role || '').toLowerCase()
    } catch (_) { return '' }
  }

  async function supabaseClient() {
    if (global.supabase?.from) return global.supabase
    if (global._supabase?.from) return global._supabase
    throw new Error('Supabase client HRIS tidak ditemukan')
  }

  async function load() {
    const cached = getCache()
    if (cached?.rows) renderIntoExistingTable(cached.rows)

    const sb = await supabaseClient()
    const { data, error } = await sb
      .from('hris_contract_employee_view')
      .select('*')
      .order('updated_at', { ascending:false })

    if (error) throw error
    const rows = data || []
    setCache(rows)
    renderIntoExistingTable(rows)
    return rows
  }

  async function validateContract(id) {
    const sb = await supabaseClient()
    const { error } = await sb.rpc('hris_validate_contract', { p_contract_id:id })
    if (error) {
      alert(error.message)
      return
    }
    await load()
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  }
  function escAttr(v) {
    return esc(v).replace(/"/g,'&quot;')
  }

  global.HrisContractSyncUI = {
    load,
    renderIntoExistingTable,
  }
})(window)

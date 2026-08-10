(function (global) {
  'use strict'

  async function accessToken() {
    // Prefer portal/session helper when available.
    if (typeof global._finGetAccessToken === 'function') {
      try { return await global._finGetAccessToken() } catch (_) {}
    }

    try {
      const raw = localStorage.getItem('rifim_auth')
      if (!raw) return ''
      const auth = JSON.parse(raw)
      return auth.access_token || auth.accessToken || ''
    } catch (_) {
      return ''
    }
  }

  function pick(result, ...keys) {
    for (const key of keys) {
      if (result && result[key]) return result[key]
    }
    return ''
  }

  /**
   * Call after Smart Office generate succeeds.
   * Does nothing for non-PKWT docs.
   */
  async function onGenerated(code, payload, result) {
    if (String(code || '').toUpperCase() !== 'PKWT') return null

    const employeeId = String(payload?.employee_id || '').trim()
    if (!employeeId) throw new Error('PKWT belum memiliki ID Karyawan')

    const token = await accessToken()
    if (!token) throw new Error('Session RIFIM OS tidak ditemukan')

    const body = {
      employee_id: employeeId,
      contract_type: 'PKWT',
      document_number: pick(result, 'document_number', 'documentNumber', 'number') || payload.document_number || '',
      gdoc_url: pick(result, 'gdoc_url', 'google_doc_url', 'doc_url'),
      pdf_url: pick(result, 'pdf_url', 'pdfUrl'),
      document_id: pick(result, 'document_id', 'id'),
      start_date: payload.contract_start || null,
      end_date: payload.contract_end || null,
      payload,
    }

    const res = await fetch('/api/internal/hris-contract-sync', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        Authorization:'Bearer ' + token,
      },
      body:JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.success !== true) {
      throw new Error(data.message || 'Gagal sinkron PKWT ke HRIS')
    }
    return data.contract
  }

  global.SmartOfficePkwtHrisBridge = {
    onGenerated,
  }
})(window)

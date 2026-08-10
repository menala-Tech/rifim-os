(function (global) {
  'use strict'
  if (!/\/finance(?:\/|$)/.test(location.pathname)) return

  function badge(label, ok, detail) {
    return '<span class="aist-agent-pill ' + (ok ? 'ok' : 'bad') + '" title="' + (detail || '') + '">'
      + (ok ? '🟢 ' : '🔴 ') + label + '</span>'
  }

  async function loadStatus() {
    if (typeof _finGetAccessToken !== 'function') return null
    var token = await _finGetAccessToken()
    if (!token) return null

    var res = await fetch('/api/internal/aist-agent/status', {
      headers: { Authorization: 'Bearer ' + token },
    })
    if (!res.ok) return null
    return res.json()
  }

  function mount(host) {
    if (!host || host.dataset.aistAgentStatus === '1') return
    host.dataset.aistAgentStatus = '1'

    var box = document.createElement('div')
    box.className = 'aist-agent-status'
    box.innerHTML = '<strong>MENALA AIST Agent</strong><div data-agent-pills>Memuat status...</div>'
    host.prepend(box)

    var pills = box.querySelector('[data-agent-pills]')

    function refresh() {
      loadStatus().then(function (data) {
        var a = data && data.agent
        if (!a) {
          pills.innerHTML = badge('Agent Offline', false, 'Tidak ada agent online')
          return
        }
        pills.innerHTML = [
          badge('Agent Connected', true, a.device_id),
          badge('AIST Ready', !!a.aist_ready, a.machine_name),
          badge('Finance Ready', !!a.finance_ready, a.operator_email),
          badge(a.status === 'busy' ? 'Busy' : 'Idle', a.status !== 'error', a.last_error || ''),
        ].join(' ')
      }).catch(function () {
        pills.innerHTML = badge('Agent Offline', false)
      })
    }

    refresh()
    setInterval(refresh, 10000)
  }

  global.RifimAistAgentStatus = { mount: mount }
})(window)

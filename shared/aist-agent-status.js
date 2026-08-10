(function (global) {
  'use strict'
  if (!/\/finance(?:\/|$)/.test(location.pathname)) return

  function badge(label, ok, detail) {
    return '<span class="aist-agent-pill ' + (ok ? 'ok' : 'bad') + '" title="' + String(detail || '').replace(/"/g, '&quot;') + '">'
      + (ok ? '🟢 ' : '🔴 ') + label + '</span>'
  }

  async function loadStatus() {
    if (typeof _finGetAccessToken !== 'function') return null
    var token = await _finGetAccessToken()
    if (!token) return null
    var res = await fetch('/api/internal/aist-agent/status', { headers: { Authorization: 'Bearer ' + token } })
    if (!res.ok) return null
    return res.json()
  }

  function ensureStyle() {
    if (document.getElementById('aist-agent-status-style')) return
    var style = document.createElement('style')
    style.id = 'aist-agent-status-style'
    style.textContent = '.aist-agent-status{margin:0 0 12px;padding:9px 11px;border:1px solid rgba(255,255,255,.12);border-radius:9px;background:rgba(0,0,0,.14);font-size:11px}.aist-agent-status strong{display:block;margin-bottom:6px}.aist-agent-pill{display:inline-block;margin:2px 4px 2px 0;padding:3px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.12)}.aist-agent-pill.ok{background:rgba(22,163,74,.12)}.aist-agent-pill.bad{background:rgba(220,38,38,.12)}'
    document.head.appendChild(style)
  }

  function mount(host) {
    if (!host || host.dataset.aistAgentStatus === '1') return
    host.dataset.aistAgentStatus = '1'
    ensureStyle()
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
      }).catch(function () { pills.innerHTML = badge('Agent Offline', false) })
    }

    refresh()
    setInterval(refresh, 10000)
  }

  function autoMount() {
    var panel = document.querySelector('.panel[data-panel="saldo-raos"]')
    if (panel) mount(panel)
  }

  global.RifimAistAgentStatus = { mount: mount }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount, { once: true })
  else autoMount()
})(window)

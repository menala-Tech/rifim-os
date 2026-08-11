(function () {
  'use strict'
  if (!/\/finance(?:\/|$)/.test(location.pathname)) return

  var decorated = new WeakSet()

  function getDriverLogin(row) {
    if (!row || !row.cells || row.cells.length < 5) return ''
    var detail = row.cells[3].querySelector('span')
    return String(detail ? detail.textContent : '').trim()
  }

  async function requestManual(button) {
    var requestId = button.dataset.aistSaldo
    if (!requestId) return

    var original = button.textContent
    button.disabled = true
    button.textContent = '⏳ Queued…'

    try {
      if (typeof _finGetAccessToken !== 'function') throw new Error('Session Finance belum siap')
      var token = await _finGetAccessToken()
      if (!token) throw new Error('Login Finance ulang')

      var res = await fetch('/api/internal/aist-agent/manual-request', {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          Authorization:'Bearer ' + token,
        },
        body:JSON.stringify({ request_id:requestId }),
      })
      var data = await res.json().catch(function () { return {} })
      if (!res.ok || data.success !== true) {
        throw new Error(data.message || 'Gagal kirim job ke AIST Agent')
      }

      button.textContent = '🟡 Agent Processing'
      if (typeof showToast === 'function') {
        showToast('✅ Job dikirim ke MENALA AIST Agent', 'ok')
      }

      // Status final akan masuk lewat refresh/realtime Finance.
      setTimeout(function () {
        if (typeof loadSaldoRaos === 'function') loadSaldoRaos()
      }, 2500)
    } catch (err) {
      button.disabled = false
      button.textContent = original
      if (typeof showToast === 'function') {
        showToast('❌ ' + (err && err.message ? err.message : String(err)), 'err')
      }
    }
  }

  function decorate() {
    document.querySelectorAll('button[data-mark-saldo]').forEach(function (manualPaid) {
      if (decorated.has(manualPaid)) return
      decorated.add(manualPaid)

      var row = manualPaid.closest('tr')
      var cell = manualPaid.parentElement
      var requestId = manualPaid.dataset.markSaldo || ''
      var driverLogin = getDriverLogin(row)

      var btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'btn info small'
      btn.dataset.aistSaldo = requestId
      btn.textContent = '▶ Auto-Fill AIST'
      btn.disabled = !driverLogin
      btn.style.marginRight = '6px'
      btn.title = driverLogin ? 'Kirim ke MENALA AIST Agent' : 'ID Driver belum tersedia'
      btn.addEventListener('click', function () { requestManual(btn) })

      cell.insertBefore(btn, manualPaid)
    })
  }

  function start() {
    decorate()
    new MutationObserver(decorate).observe(document.body, { childList:true, subtree:true })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true })
  } else {
    start()
  }
})()

/**
 * Finance Isi Saldo — cache-first / stale-while-revalidate.
 * Auto-wraps existing _gasCall without changing Finance inline renderer.
 */
(function (global) {
  'use strict'

  var PREFIX = 'rifim_finance_saldo_raos_v3:'
  var TTL = 15 * 60 * 1000
  var MAX_STALE = 24 * 60 * 60 * 1000
  var originalGasCall = null
  var nextFresh = null
  var installed = false

  function scopeKey() {
    try {
      var auth = JSON.parse(localStorage.getItem('rifim_auth') || '{}')
      return [auth.id || auth.user_id || auth.email || 'anonymous', String(auth.role || 'none').toLowerCase()].join('|')
        .replace(/[^a-zA-Z0-9@._|:-]/g, '_')
    } catch (_) { return 'anonymous|none' }
  }

  function key(params) {
    params = params || {}
    return PREFIX + scopeKey() + ':' + JSON.stringify({ status: params.status || '', branch: params.branch || '' })
  }

  function read(params) {
    try {
      var raw = localStorage.getItem(key(params))
      if (!raw) return null
      var parsed = JSON.parse(raw)
      if (!parsed || !parsed.at || !parsed.payload) return null
      var age = Date.now() - parsed.at
      if (age > MAX_STALE) { localStorage.removeItem(key(params)); return null }
      return { payload: parsed.payload, at: parsed.at, age: age, fresh: age <= TTL }
    } catch (_) { return null }
  }

  function write(params, payload) {
    try { localStorage.setItem(key(params), JSON.stringify({ at: Date.now(), payload: payload })) } catch (_) {}
  }

  function clear() {
    try {
      var prefix = PREFIX + scopeKey() + ':'
      var keys = []
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i)
        if (k && k.indexOf(prefix) === 0) keys.push(k)
      }
      keys.forEach(function (k) { localStorage.removeItem(k) })
    } catch (_) {}
  }

  function samePayload(a, b) {
    try { return JSON.stringify(a) === JSON.stringify(b) } catch (_) { return false }
  }

  function install() {
    if (installed || typeof global._gasCall !== 'function') return false
    installed = true
    originalGasCall = global._gasCall

    global._gasCall = async function (action, params) {
      params = params || {}
      if (action === 'finance_saldo_raos_list') {
        var cacheId = key(params)
        if (nextFresh && nextFresh.cacheId === cacheId) {
          var ready = nextFresh.payload
          nextFresh = null
          return ready
        }

        var cached = read(params)
        if (cached) {
          Promise.resolve(originalGasCall(action, params)).then(function (fresh) {
            if (!fresh || fresh.success === false) return
            var changed = !samePayload(cached.payload, fresh)
            write(params, fresh)
            if (changed && typeof global.loadSaldoRaos === 'function') {
              nextFresh = { cacheId: cacheId, payload: fresh }
              setTimeout(function () { global.loadSaldoRaos() }, 0)
            }
          }).catch(function () {})
          return cached.payload
        }

        var first = await originalGasCall(action, params)
        if (first && first.success !== false) write(params, first)
        return first
      }

      var result = await originalGasCall(action, params)
      if ((action === 'finance_saldo_raos_mark_paid' || action === 'finance_saldo_cancel') && result && result.success !== false) clear()
      return result
    }
    global._gasCall.__financeSaldoCacheWrapped = true
    return true
  }

  function installWhenReady() {
    if (install()) return
    var attempts = 0
    var timer = setInterval(function () {
      attempts++
      if (install() || attempts > 200) clearInterval(timer)
    }, 25)
  }

  global.FinanceSaldoCacheFirst = {
    read: read, write: write, clear: clear, invalidateAfterMutation: clear,
    install: install, version: '3.0.0-auto-wrapper'
  }
  installWhenReady()
})(window)

/**
 * RIFIM OS — table-header-freeze runtime offset sync (2026-08-18 fix).
 *
 * shared/table-header-freeze.css hard-codes a sticky `top` offset per
 * module (HRIS 104px, CRM 155px, RAOS 97px, Sistem 86px, Documents 64px,
 * Finance 58+46px) via `body:has(...)` selectors. That's a guess baked
 * into CSS — if any module's header/nav/tabs height ever changes (a
 * longer badge label wrapping to 2 lines, a font bump, a new header
 * element) without someone remembering to update the matching number
 * here, the sticky table header lands mid-table again — the exact bug
 * class this whole freeze layer exists to prevent for Payroll.
 *
 * This script measures the REAL rendered height of each module's own
 * header/nav/tabs stack and publishes it as `--rifim-table-freeze-offset`.
 * table-header-freeze.css consumes it as `var(--rifim-table-freeze-offset,
 * <original-hardcoded-number>)` — same default behavior until this script
 * successfully measures, then it self-corrects.
 *
 * Loaded alongside table-header-freeze.css itself (see
 * shared/fixed-module-shell.js `ensureTableHeaderCss()`).
 */
(function (global) {
  'use strict'

  var resizeTimer = null

  // One row per module recognized by table-header-freeze.css. `marker`
  // must match the same selector used there to scope the module; `stack`
  // is the set of elements whose combined height is "everything sticky
  // above the table" for that module. First marker that matches wins.
  var MODULE_PROBES = [
    { marker: '#app .module-badge', stack: ['#app > header', '.tabs'] },      // Finance
    { marker: '#app .header-module', stack: ['header', 'nav'] },              // HRIS
    { marker: '#app .cfg-table', stack: ['header', '.tabs'] },                // CRM
    { marker: '#app .hdr-logo-img', stack: ['header', 'nav'] },               // RAOS
    { marker: '.topnav', stack: ['.topnav'] },                                // Smart Office
    { marker: '#app .log-panel', stack: ['#app > header'] },                  // Sistem
    { marker: '.doc-main', stack: ['.topbar'] },                              // Documents
  ]

  function sync() {
    var root = document.documentElement.style
    for (var i = 0; i < MODULE_PROBES.length; i++) {
      var probe = MODULE_PROBES[i]
      if (!document.querySelector(probe.marker)) continue
      var total = 0
      var measured = true
      for (var j = 0; j < probe.stack.length; j++) {
        var el = document.querySelector(probe.stack[j])
        if (!el) { measured = false; break }
        var rect = el.getBoundingClientRect()
        if (rect.height <= 0) { measured = false; break }
        total += rect.height
      }
      if (measured && total > 0) {
        root.setProperty('--rifim-table-freeze-offset', total + 'px')
      }
      return // only one module marker is expected to match per page
    }
  }

  function init() {
    sync()
    global.addEventListener('resize', function () {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(sync, 150)
    })
    // Re-measure shortly after first paint too — a logo <img> finishing
    // load, or a badge label wrapping once real data replaces a
    // placeholder, can change header height after the initial sync.
    setTimeout(sync, 400)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  global.RifimTableFreezeSync = { sync: sync }
})(window)

(function () {
  'use strict';

  if (!/\/finance(?:\/|$)/.test(location.pathname)) return;

  var decorated = new WeakSet();

  function parseNominal(text) {
    var digits = String(text || '').replace(/[^0-9]/g, '');
    return Number(digits || 0);
  }

  function getDriverLogin(row) {
    if (!row || !row.cells || row.cells.length < 5) return '';
    var driverCell = row.cells[3];
    var detail = driverCell.querySelector('span');
    return String(detail ? detail.textContent : '').trim();
  }

  async function autoFill(button) {
    var id = button.dataset.aistSaldo;
    var row = button.closest('tr');
    var driverLogin = getDriverLogin(row);
    var nominal = parseNominal(row && row.cells[4] ? row.cells[4].textContent : '');

    if (!id || !driverLogin || !nominal) {
      if (typeof showToast === 'function') showToast('❌ Data request/driver/nominal belum lengkap', 'err');
      return;
    }

    var original = button.textContent;
    button.disabled = true;
    button.textContent = '⏳ AIST…';

    try {
      if (typeof _finGetAccessToken !== 'function') throw new Error('Session Finance belum siap');
      var token = await _finGetAccessToken();
      if (!token) throw new Error('Session token tidak ada. Login ulang melalui Portal.');

      var response = await fetch('/api/internal/aist-runner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({
          request_id: id,
          driver_login: driverLogin,
          nominal: nominal,
        }),
      });

      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || data.success !== true) {
        throw new Error(data.message || ('Auto-Fill AIST gagal (HTTP ' + response.status + ')'));
      }

      if (typeof _srStopLoop === 'function') _srStopLoop(id);
      if (typeof showToast === 'function') showToast('✅ AIST sukses — saldo otomatis ditandai lunas', 'ok');
      if (typeof loadSaldoRaos === 'function') await loadSaldoRaos();
    } catch (error) {
      if (typeof showToast === 'function') {
        showToast('❌ ' + (error && error.message ? error.message : String(error)), 'err');
      }
      button.disabled = false;
      button.textContent = original;
    }
  }

  function decorate() {
    document.querySelectorAll('button[data-mark-saldo]').forEach(function (manualButton) {
      if (decorated.has(manualButton)) return;
      decorated.add(manualButton);

      var row = manualButton.closest('tr');
      var cell = manualButton.parentElement;
      var id = manualButton.dataset.markSaldo || '';
      var driverLogin = getDriverLogin(row);

      var autoButton = document.createElement('button');
      autoButton.type = 'button';
      autoButton.className = 'btn info small';
      autoButton.dataset.aistSaldo = id;
      autoButton.textContent = '▶️ Auto-Fill AIST';
      autoButton.title = driverLogin
        ? 'Isi saldo ini melalui Playwright AIST'
        : 'Driver login belum tersedia';
      autoButton.disabled = !driverLogin;
      autoButton.style.marginRight = '6px';
      autoButton.addEventListener('click', function () { autoFill(autoButton); });

      cell.insertBefore(autoButton, manualButton);
    });
  }

  function start() {
    decorate();
    var observer = new MutationObserver(decorate);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

(function(global) {
  'use strict';

  function open(type, rows) {
    if (!global.PayrollV2 || !global.PayrollV2.canWrite()) {
      global.showToast('Hanya Admin/Direksi', 'error');
      return;
    }

    var label = type === 'kasbon' ? 'Kasbon Manual' : 'Deposit';
    var wrap = document.createElement('div');
    wrap.className = 'modal-overlay open';
    wrap.innerHTML =
      '<div class="modal" style="max-width:480px">' +
        '<div class="modal-header"><h3>' + label + '</h3><button class="modal-close">&times;</button></div>' +
        '<div class="modal-body">' +
          '<div class="form-grid cols-1">' +
            '<div class="form-group"><label>Karyawan</label><select id="pv2-emp">' +
              (rows || []).map(function(row) {
                return '<option value="' + String(row.employee_id || '') + '">' + String(row.staff_name || row.employee_id || '') + ' - ' + String(row.employee_id || '') + '</option>';
              }).join('') +
            '</select></div>' +
            '<div class="form-group"><label>Nominal</label><input id="pv2-amount" type="number" min="1"></div>' +
            '<div class="form-group"><label>Keterangan</label><textarea id="pv2-note" rows="2"></textarea></div>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn btn-ghost pv2-cancel">Batal</button><button class="btn btn-primary pv2-save">Simpan</button></div>' +
      '</div>';

    function close() {
      wrap.remove();
    }

    wrap.querySelector('.modal-close').onclick = close;
    wrap.querySelector('.pv2-cancel').onclick = close;
    wrap.addEventListener('click', function(event) {
      if (event.target === wrap) close();
    });

    wrap.querySelector('.pv2-save').onclick = async function() {
      var employeeId = wrap.querySelector('#pv2-emp').value;
      var amount = Number(wrap.querySelector('#pv2-amount').value || 0);
      var note = wrap.querySelector('#pv2-note').value || '';
      var month = global.PayrollV2 && typeof global.PayrollV2.getCurrentMonth === 'function' ? global.PayrollV2.getCurrentMonth() : '';
      if (!employeeId || amount <= 0) {
        global.showToast('Karyawan dan nominal wajib diisi.', 'error');
        return;
      }
      if (!month) {
        global.showToast('Periode payroll belum dipilih.', 'error');
        return;
      }
      var action = type === 'kasbon' ? 'hris_payroll_v2_manual_kasbon' : 'hris_payroll_v2_deposit';
      var response = await global.gasPost({ action: action, employee_id: employeeId, amount: amount, note: note, month: month });
      if (response && response.success) {
        global.showToast(label + ' tersimpan.', 'success');
        close();
        if (typeof global.loadPayrollV2FromFilters === 'function') global.loadPayrollV2FromFilters();
      } else {
        global.showToast((response && response.message) || ('Gagal menyimpan ' + label.toLowerCase() + '.'), 'error');
      }
    };

    document.body.appendChild(wrap);
  }

  global.PayrollModalV2 = { open: open };
})(window);

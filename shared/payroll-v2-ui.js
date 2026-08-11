(function(global) {
  'use strict';

  function normalizeRole(role) {
    var raw = String(role || '').trim().toUpperCase();
    if (raw === 'DIREKTUR') return 'DIREKSI';
    if (raw === 'KOORD') return 'KOORDINATOR';
    if (raw === 'MGMT') return 'MANAGEMENT';
    return raw;
  }

  function money(value) {
    return 'Rp ' + Number(value || 0).toLocaleString('id-ID');
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char];
    });
  }

  var rows = [];
  var role = '';
  var currentMonth = '';
  var currentBranch = 'ALL';

  function setRole(nextRole) {
    role = normalizeRole(nextRole);
  }

  function canWrite() {
    return role === 'ADMIN' || role === 'DIREKSI';
  }

  function canRead() {
    return role === 'ADMIN' || role === 'MANAGEMENT' || role === 'DIREKSI';
  }

  function hideWriteActions() {
    var visible = canWrite();
    document.querySelectorAll('[data-payroll-write]').forEach(function(node) {
      node.style.display = visible ? '' : 'none';
    });
  }

  function renderSummary(list) {
    var total = list.reduce(function(sum, item) { return sum + Number(item.total_payment || 0); }, 0);
    var hadir = list.reduce(function(sum, item) { return sum + Number(item.present_days || 0); }, 0);
    var telat = list.reduce(function(sum, item) { return sum + Number(item.late_minutes || 0); }, 0);
    var cuti = list.reduce(function(sum, item) { return sum + Number(item.leave_days || 0); }, 0);
    var kasbon = list.reduce(function(sum, item) { return sum + Number(item.kasbon || 0); }, 0);
    var values = {
      'pay-v2-total': money(total),
      'pay-v2-count': String(list.length),
      'pay-v2-present': String(hadir),
      'pay-v2-late': String(telat),
      'pay-v2-leave': String(cuti),
      'pay-v2-kasbon': money(kasbon)
    };
    Object.keys(values).forEach(function(id) {
      var node = document.getElementById(id);
      if (node) node.textContent = values[id];
    });
  }

  function renderTable(list) {
    var tbody = document.getElementById('tbody-payroll-v2');
    if (!tbody) return;
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="14" class="empty-state">Belum ada payroll pada filter ini.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(function(item) {
      var kasbonLabel = item.kasbon_has_manual
        ? '<div class="text-[11px]" style="color:#a16207;font-weight:700">termasuk input tombol manual</div>'
        : '';
      return '<tr>' +
        '<td><b>' + esc(item.employee_id) + '</b></td>' +
        '<td>' + esc(item.staff_name) + '</td>' +
        '<td>' + esc(item.branch_name || '-') + '</td>' +
        '<td>' + Number(item.present_days || 0) + '</td>' +
        '<td class="pay-late">' + Number(item.late_minutes || 0) + '</td>' +
        '<td>' + Number(item.leave_days || 0) + '</td>' +
        '<td>' + money(item.salary_base) + '</td>' +
        '<td>' + money(item.allowances) + '</td>' +
        '<td>' + money(Number(item.bonus_saldo || 0) + Number(item.bonus_kpi || 0) + Number(item.overtime || 0) + Number(item.deposit || 0)) + '</td>' +
        '<td class="pay-deduction">' + money(item.deductions) + '</td>' +
        '<td class="pay-deduction">' + money(item.kasbon) + kasbonLabel + '</td>' +
        '<td class="pay-total">' + money(item.total_payment) + '</td>' +
        '<td><button class="pay-doc-link" onclick="PayrollV2.openSlip(' + esc(JSON.stringify(String(item.employee_id || ''))) + ')">' + esc(item.document_number || 'Generate') + '</button></td>' +
        '<td><button class="btn btn-sm btn-pdf" onclick="PayrollV2.openSlip(' + esc(JSON.stringify(String(item.employee_id || ''))) + ')">PDF</button></td>' +
      '</tr>';
    }).join('');
  }

  function cacheKeyFor(month, branch) {
    return 'payroll_v2_' + month + '_' + (branch || 'ALL');
  }

  function cacheGet(key) {
    if (typeof global._hrisCacheGet === 'function') return global._hrisCacheGet(key);
    return null;
  }

  function cacheSet(key, value) {
    if (typeof global._hrisCacheSet === 'function') global._hrisCacheSet(key, value);
  }

  function sessionToken() {
    return typeof global.getRaosSyncToken === 'function' ? String(global.getRaosSyncToken() || '') : '';
  }

  async function postPayroll(action, payload) {
    return global.gasPost(Object.assign({
      action: action,
      access_token: sessionToken()
    }, payload || {}));
  }

  function aggregate(bundle) {
    function by(rows, keyFn) {
      var map = {};
      (rows || []).forEach(function(row) {
        var key = keyFn(row);
        if (key) map[key] = row;
      });
      return map;
    }

    function sumBy(rows, keyFn, valueFn) {
      var map = {};
      (rows || []).forEach(function(row) {
        var key = keyFn(row);
        if (!key) return;
        map[key] = (map[key] || 0) + Number(valueFn(row) || 0);
      });
      return map;
    }

    function countBy(rows, keyFn, predicateFn) {
      var map = {};
      (rows || []).forEach(function(row) {
        var key = keyFn(row);
        if (!key || !predicateFn(row)) return;
        map[key] = (map[key] || 0) + 1;
      });
      return map;
    }

    function upper(value) {
      return String(value || '').trim().toUpperCase();
    }

    var attendance = by(bundle.attendance, function(row) { return upper(row.staff_code || row.employee_id); });
    var targets = by(bundle.targets, function(row) { return upper(row.staff_code || row.employee_id); });
    var leaves = sumBy(bundle.leave, function(row) { return upper(row.employee_id || row.staff_code); }, function(row) { return row.approved_days || row.total_days; });
    var kasbon = sumBy(bundle.kasbon, function(row) { return upper(row.employee_id || row.staff_code || row.staff_id); }, function(row) { return row.outstanding_amount != null ? row.outstanding_amount : row.amount; });
    var kasbonManualCount = countBy(bundle.kasbon, function(row) { return upper(row.employee_id || row.staff_code || row.staff_id); }, function(row) {
      return String(row.kasbon_source || '').toLowerCase() === 'manual_payroll_button';
    });
    var deposits = sumBy(bundle.deposits, function(row) { return upper(row.employee_id || row.staff_code || row.staff_id); }, function(row) { return row.amount; });
    var overtime = sumBy(bundle.overtime, function(row) { return upper(row.employee_id || row.staff_code); }, function(row) { return row.approved_amount || row.amount; });

    return (bundle.employees || []).map(function(employee) {
      var id = upper(employee.employee_id || employee.staff_id);
      var att = attendance[id] || {};
      var target = targets[id] || {};
      var salary = Number(employee.salary_base || 0);
      var allowances = Number(employee.allowances || 0);
      var lateDeduction = Number(att.potongan_terlambat || att.late_deduction || att.late_deduction_idr || 0);
      var absenceDeduction = Number(att.potongan_absen || att.absent_deduction || att.absent_deduction_idr || 0);
      var otherDeduction = Number(employee.other_deduction || 0);
      var bonusSaldo = Number(target.bonus_saldo || target.saldo_bonus || 0);
      var bonusKpi = Number(target.bonus_kpi || target.kpi_bonus || 0);
      var overtimeAmount = Number(overtime[id] || 0);
      var depositAmount = Number(deposits[id] || 0);
      var kasbonAmount = Number(kasbon[id] || 0);
      var gross = salary + allowances + bonusSaldo + bonusKpi + overtimeAmount + depositAmount;
      var deductions = lateDeduction + absenceDeduction + otherDeduction + kasbonAmount;
      return {
        employee_id: id,
        staff_name: employee.full_name || employee.name || id,
        role: String(employee.system_role || employee.role || '').toLowerCase(),
        position: employee.position || '',
        department: employee.department || '',
        branch_id: employee.branch_id || null,
        branch_name: employee.branch || employee.branch_name || '',
        company_code: employee.company_code || 'RIFIM',
        company_name: employee.company_name || '',
        period: bundle.period,
        present_days: Number(att.hari_masuk || att.present_days || 0),
        late_minutes: Number(att.total_telat_menit || att.late_minutes || 0),
        leave_days: Number(leaves[id] || 0),
        salary_base: salary,
        allowances: allowances,
        bonus_saldo: bonusSaldo,
        bonus_kpi: bonusKpi,
        overtime: overtimeAmount,
        deposit: depositAmount,
        late_deduction: lateDeduction,
        absence_deduction: absenceDeduction,
        kasbon: kasbonAmount,
        kasbon_has_manual: Number(kasbonManualCount[id] || 0) > 0,
        other_deduction: otherDeduction,
        deductions: deductions,
        total_payment: Math.max(0, gross - deductions),
        document_number: employee.payroll_document_number || ('PAY-' + String(bundle.period || '').replace('-', '') + '-' + id)
      };
    });
  }

  async function load(month, branch) {
    if (!canRead()) return { success: false, message: 'Role tidak boleh melihat Payroll' };
    currentMonth = month;
    currentBranch = branch || 'ALL';
    var key = cacheKeyFor(month, currentBranch);
    try {
      var cached = cacheGet(key);
      if (cached && cached.rows) {
        rows = cached.rows;
        renderSummary(rows);
        renderTable(rows);
      }
    } catch (_) {}

    var response = await postPayroll('hris_payroll_v2_bundle', { month: month, branch_id: currentBranch });
    if (!response || !response.success) {
      return response || { success: false, message: 'Gagal memuat payroll v2' };
    }

    rows = aggregate(response);
    renderSummary(rows);
    renderTable(rows);
    cacheSet(key, { rows: rows });
    return { success: true, rows: rows };
  }

  async function loadBranches() {
    var select = document.getElementById('pay-v2-branch');
    if (!select) return;
    var response = await postPayroll('hris_payroll_v2_branches');
    if (!response || !response.success || !Array.isArray(response.rows)) return;
    select.innerHTML = '<option value="ALL">Semua Cabang</option>' + response.rows.map(function(row) {
      var id = row.id || row.branch_id || '';
      var name = row.name || row.branch_name || '';
      return '<option value="' + esc(id) + '">' + esc(name) + '</option>';
    }).join('');
  }

  function openSlip(employeeId) {
    var row = rows.find(function(item) { return item.employee_id === employeeId; });
    if (!row) return;
    if (global.PayrollSlipV2 && typeof global.PayrollSlipV2.open === 'function') {
      global.PayrollSlipV2.open(row);
    }
  }

  function pdfAll() {
    if (!canWrite()) {
      global.showToast('Hanya Admin/Direksi', 'error');
      return;
    }
    if (global.PayrollSlipV2 && typeof global.PayrollSlipV2.openAll === 'function') {
      global.PayrollSlipV2.openAll(rows);
    }
  }

  function manualKasbon() {
    if (!canWrite()) {
      global.showToast('Hanya Admin/Direksi', 'error');
      return;
    }
    if (global.PayrollModalV2 && typeof global.PayrollModalV2.open === 'function') {
      global.PayrollModalV2.open('kasbon', rows);
    }
  }

  function deposit() {
    if (!canWrite()) {
      global.showToast('Hanya Admin/Direksi', 'error');
      return;
    }
    if (global.PayrollModalV2 && typeof global.PayrollModalV2.open === 'function') {
      global.PayrollModalV2.open('deposit', rows);
    }
  }

  global.PayrollV2 = {
    setRole: setRole,
    canWrite: canWrite,
    canRead: canRead,
    hideWriteActions: hideWriteActions,
    load: load,
    loadBranches: loadBranches,
    openSlip: openSlip,
    pdfAll: pdfAll,
    manualKasbon: manualKasbon,
    deposit: deposit,
    getRows: function() { return rows.slice(); },
    getCurrentMonth: function() { return currentMonth; },
    getCurrentBranch: function() { return currentBranch; }
  };
})(window);

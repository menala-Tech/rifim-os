(function (global) {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function fmtDate(value) {
    if (!value) return '—';
    var date = new Date(value);
    if (isNaN(date.getTime())) return escapeHtml(value);
    return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function statusClass(status) {
    var normalized = String(status || 'draft').toLowerCase();
    if (normalized.indexOf('approved') >= 0 || normalized === 'signed') return 'ok';
    if (normalized.indexOf('reject') >= 0) return 'err';
    if (normalized.indexOf('pending') >= 0) return 'warn';
    return 'muted';
  }

  function statusPill(status) {
    return '<span class="status-pill ' + statusClass(status) + '">' + escapeHtml(status || 'draft') + '</span>';
  }

  function skeleton() {
    return '<div class="skeleton line wide"></div><div class="skeleton line"></div><div class="skeleton block"></div>';
  }

  function empty(message) {
    return '<div class="empty"><div class="empty-icon">📄</div><p>' + escapeHtml(message || 'Belum ada data') + '</p></div>';
  }

  function toast(message, type) {
    var el = document.getElementById('doc-toast');
    if (!el) return;
    el.textContent = message || '';
    el.className = 'toast show ' + (type || 'ok');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { el.className = 'toast'; }, 3600);
  }

  function renderDocumentTable(payload) {
    var rows = (payload && payload.results) || [];
    var total = payload && typeof payload.total === 'number' ? payload.total : rows.length;
    if (!rows.length) return empty('Tidak ada dokumen yang cocok.');

    return '<div class="table-meta">Total: <strong>' + total + '</strong></div>' +
      '<table class="doc-table"><thead><tr>' +
      '<th>Title</th><th>Doc Number</th><th>Type</th><th>Status</th><th>Updated</th>' +
      '</tr></thead><tbody>' + rows.map(function (row) {
        var updated = row.updated_at || row.created_at;
        return '<tr data-doc-id="' + escapeHtml(row.id) + '">' +
          '<td><strong>' + escapeHtml(row.title || 'Untitled') + '</strong><small>' + escapeHtml(row.company_slug || '') + '</small></td>' +
          '<td class="mono">' + escapeHtml(row.doc_number || '—') + '</td>' +
          '<td>' + escapeHtml(row.doc_type || '—') + '</td>' +
          '<td>' + statusPill(row.status) + '</td>' +
          '<td>' + fmtDate(updated) + '</td>' +
        '</tr>';
      }).join('') + '</tbody></table>';
  }

  function renderRevisionTimeline(revisions) {
    if (!revisions || !revisions.length) return empty('Belum ada revisi.');
    return '<div class="timeline">' + revisions.map(function (rev, index) {
      var prev = revisions[index - 1];
      var diffLink = prev ? '<button class="btn tiny ghost" data-diff-a="' + escapeHtml(prev.id) + '" data-diff-b="' + escapeHtml(rev.id) + '">Lihat Diff</button>' : '';
      return '<article class="timeline-item">' +
        '<div class="timeline-dot">' + escapeHtml(rev.revision_number || index + 1) + '</div>' +
        '<div class="timeline-body"><h4>Revision #' + escapeHtml(rev.revision_number || index + 1) + '</h4>' +
        '<p>' + fmtDate(rev.created_at) + ' · ' + escapeHtml(rev.created_by || rev.actor || 'system') + '</p>' + diffLink + '</div>' +
      '</article>';
    }).join('') + '</div>';
  }

  function renderApprovalProgress(approvals) {
    if (!approvals || !approvals.length) return empty('Approval belum tersedia untuk dokumen ini.');
    return '<div class="approval-progress">' + approvals.map(function (item, idx) {
      var decision = item.status || item.decision || 'pending';
      return '<div class="approval-step ' + statusClass(decision) + '">' +
        '<span>' + (idx + 1) + '</span><strong>' + escapeHtml(item.approver_name || item.approver_id || 'Approver') + '</strong><small>' + escapeHtml(decision) + '</small>' +
      '</div>';
    }).join('') + '</div>';
  }

  function renderAuditTable(rows) {
    if (!rows || !rows.length) return empty('Audit trail belum ada.');
    return '<table class="doc-table compact"><thead><tr><th>ID</th><th>Entity</th><th>Action</th><th>Time</th></tr></thead><tbody>' +
      rows.map(function (row) {
        return '<tr><td class="mono">' + escapeHtml(row.id) + '</td><td>' + escapeHtml(row.entity_type) + '<small>' + escapeHtml(row.entity_id || '') + '</small></td><td>' + escapeHtml(row.action) + '</td><td>' + fmtDate(row.created_at) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function renderInboxCards(rows) {
    if (!rows || !rows.length) return empty('Tidak ada approval pending untuk Anda.');
    return rows.map(function (row) {
      return '<article class="approval-card" data-approval-id="' + escapeHtml(row.id || row.approval_id) + '">' +
        '<div><h3>' + escapeHtml(row.title || row.document_title || 'Dokumen approval') + '</h3>' +
        '<p>' + escapeHtml(row.doc_number || row.document_id || '') + '</p></div>' +
        '<div>' + statusPill(row.status || 'pending') + '<button class="btn small" data-open-decision>Review</button></div>' +
      '</article>';
    }).join('');
  }

  function showDecisionModal(approvalId, onSubmit) {
    var modal = document.getElementById('doc-modal');
    modal.hidden = false;
    modal.innerHTML = '<div class="modal"><h3>Keputusan Approval</h3><p class="muted">Approval ID: <span class="mono">' + escapeHtml(approvalId) + '</span></p>' +
      '<textarea id="decision-comment" rows="5" placeholder="Komentar opsional"></textarea>' +
      '<div class="modal-actions"><button class="btn ok" data-decision="approved">Approve</button><button class="btn danger" data-decision="rejected">Reject</button><button class="btn ghost" data-close>Cancel</button></div></div>';
    modal.onclick = function (event) {
      if (event.target === modal || event.target.hasAttribute('data-close')) {
        modal.hidden = true;
        modal.innerHTML = '';
      }
      var decision = event.target.getAttribute('data-decision');
      if (decision) {
        var comment = document.getElementById('decision-comment').value;
        modal.hidden = true;
        modal.innerHTML = '';
        onSubmit(decision, comment);
      }
    };
  }

  global.DocsRenderer = {
    escapeHtml: escapeHtml,
    fmtDate: fmtDate,
    statusPill: statusPill,
    skeleton: skeleton,
    empty: empty,
    toast: toast,
    renderDocumentTable: renderDocumentTable,
    renderRevisionTimeline: renderRevisionTimeline,
    renderApprovalProgress: renderApprovalProgress,
    renderAuditTable: renderAuditTable,
    renderInboxCards: renderInboxCards,
    showDecisionModal: showDecisionModal
  };
})(window);

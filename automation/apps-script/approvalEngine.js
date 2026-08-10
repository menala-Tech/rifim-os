/**
 * RIFIM OS — Approval Engine
 * Canonical document approval. Final business rule: only active Direksi/Direktur
 * may be an approver or decide an approval.
 */
function createApprovals(input) {
  input = input || {};
  _approvalValidateCreateInput(input);

  var rule = _approvalGetRule(input.companySlug, input.docType);
  var approvers = _approvalOnlyDireksi_(_approvalParseApprovers(rule.approvers));
  var mode = String(rule.mode || 'sequential').toLowerCase() === 'parallel' ? 'parallel' : 'sequential';
  var approvalIds = [];

  if (!approvers.length) throw new Error('Aturan approval tidak memiliki approver Direksi aktif.');

  for (var i = 0; i < approvers.length; i++) {
    var approvalId = _approvalUuid();
    approvalIds.push(approvalId);
    _sbPost('doc_approvals', {
      id: approvalId,
      document_id: input.documentId,
      revision_id: input.revisionId,
      approver_id: approvers[i],
      order_index: i,
      status: mode === 'parallel' || i === 0 ? 'pending' : 'skipped',
    });
    _approvalLogEvent(approvalId, 'created', {
      document_id: input.documentId,
      revision_id: input.revisionId,
      order_index: i,
      mode: mode,
    });
  }

  return { success: true, approvalIds: approvalIds, mode: mode };
}

function decideApproval(input) {
  input = input || {};
  _approvalValidateDecisionInput(input);
  _approvalAssertDireksi_(input.approverId);

  var approval = _approvalGetApproval(input.approvalId);
  if (approval.approver_id !== input.approverId) throw new Error('Approver tidak cocok untuk approval ini.');
  if (String(approval.status || '').toLowerCase() !== 'pending') throw new Error('Approval tidak dalam status pending.');

  var decision = String(input.decision).toLowerCase();
  _approvalPatchApproval(input.approvalId, {
    status: decision,
    comment: input.comment || null,
    decided_at: new Date().toISOString(),
  });
  _approvalLogEvent(input.approvalId, decision, {
    document_id: approval.document_id,
    approver_id: input.approverId,
    comment: input.comment || null,
  });

  if (decision === 'rejected') {
    _approvalSkipRemaining(approval.document_id, input.approvalId);
    _approvalPatchDocumentStatus(approval.document_id, 'rejected');
    return { success: true, documentStatus: 'rejected' };
  }

  var approvals = _approvalListForDocument(approval.document_id);
  var nextApproval = _approvalFindNextSequential(approvals, approval.order_index);
  if (nextApproval) {
    _approvalPatchApproval(nextApproval.id, { status: 'pending' });
    _approvalLogEvent(nextApproval.id, 'pending', {
      document_id: approval.document_id,
      previous_approval_id: input.approvalId,
    });
    _approvalPatchDocumentStatus(approval.document_id, 'pending_approval');
    return { success: true, documentStatus: 'pending_approval', nextApprovalId: nextApproval.id };
  }

  approvals = _approvalListForDocument(approval.document_id);
  if (_approvalAllApproved(approvals)) {
    _approvalPatchDocumentStatus(approval.document_id, 'approved');
    return { success: true, documentStatus: 'approved' };
  }

  _approvalPatchDocumentStatus(approval.document_id, 'pending_approval');
  return { success: true, documentStatus: 'pending_approval' };
}

function getPendingForApprover(approverId) {
  if (!approverId) throw new Error('approverId diperlukan.');
  _approvalAssertDireksi_(approverId);
  var cfg = _getSupabaseConfig();
  var url = cfg.url + '/rest/v1/rpc/doc_get_pending_approvals';
  var res = UrlFetchApp.fetch(url, {
    method: 'POST',
    headers: _sbHeaders(cfg.key),
    payload: JSON.stringify({ p_approver_id: approverId }),
    muteHttpExceptions: true,
  });
  _approvalCheckResponse(res, 'POST rpc/doc_get_pending_approvals');
  return JSON.parse(res.getContentText());
}

function _approvalValidateCreateInput(input) {
  if (!input.documentId) throw new Error('documentId diperlukan.');
  if (!input.revisionId) throw new Error('revisionId diperlukan.');
  if (!input.companySlug) throw new Error('companySlug diperlukan.');
  if (!input.docType) throw new Error('docType diperlukan.');
}

function _approvalValidateDecisionInput(input) {
  if (!input.approvalId) throw new Error('approvalId diperlukan.');
  if (!input.approverId) throw new Error('approverId diperlukan.');
  if (['approved', 'rejected'].indexOf(String(input.decision || '').toLowerCase()) === -1) throw new Error('decision harus approved atau rejected.');
}

function _approvalGetRule(companySlug, docType) {
  var rows = _sbGet(_approvalRestUrl('doc_approval_rules', [
    'company_slug=eq.' + encodeURIComponent(companySlug),
    'doc_type=eq.' + encodeURIComponent(docType),
    'is_active=eq.true',
    'limit=1',
  ]));
  if (rows && rows.length) return rows[0];

  var fallbackApprover = _approvalGetFallbackApprover();
  _approvalLogSystemWarning('approval_rule_fallback', {
    company_slug: companySlug,
    doc_type: docType,
    approver_id: fallbackApprover,
  });
  return { approvers: [fallbackApprover], mode: 'sequential' };
}

function _approvalGetFallbackApprover() {
  var rows = _sbGet(_approvalRestUrl('user_profiles', [
    'select=id',
    'role=in.(direksi,direktur)',
    'is_active=eq.true',
    'order=created_at.asc',
    'limit=1',
  ]));
  if (!rows || !rows.length) throw new Error('Fallback approver direksi aktif tidak ditemukan.');
  return rows[0].id;
}

function _approvalOnlyDireksi_(approverIds) {
  var valid = [];
  for (var i = 0; approverIds && i < approverIds.length; i++) {
    var rows = _sbGet(_approvalRestUrl('user_profiles', [
      'id=eq.' + encodeURIComponent(approverIds[i]),
      'role=in.(direksi,direktur)',
      'is_active=eq.true',
      'select=id',
      'limit=1',
    ]));
    if (rows && rows.length) valid.push(rows[0].id);
  }
  return valid.length ? valid : [_approvalGetFallbackApprover()];
}

function _approvalAssertDireksi_(userId) {
  var rows = _sbGet(_approvalRestUrl('user_profiles', [
    'id=eq.' + encodeURIComponent(userId),
    'role=in.(direksi,direktur)',
    'is_active=eq.true',
    'select=id',
    'limit=1',
  ]));
  if (!rows || !rows.length) throw new Error('Hanya Direksi/Direktur aktif yang boleh memutus approval.');
}

function _approvalGetApproval(approvalId) {
  var rows = _sbGet(_approvalRestUrl('doc_approvals', [
    'id=eq.' + encodeURIComponent(approvalId),
    'select=id,document_id,revision_id,approver_id,order_index,status',
    'limit=1',
  ]));
  if (!rows || !rows.length) throw new Error('Approval tidak ditemukan: ' + approvalId);
  return rows[0];
}

function _approvalListForDocument(documentId) {
  return _sbGet(_approvalRestUrl('doc_approvals', [
    'document_id=eq.' + encodeURIComponent(documentId),
    'select=id,status,order_index',
    'order=order_index.asc',
  ]));
}

function _approvalFindNextSequential(approvals, currentOrderIndex) {
  for (var i = 0; approvals && i < approvals.length; i++) {
    var approval = approvals[i];
    if (Number(approval.order_index) > Number(currentOrderIndex) && String(approval.status || '').toLowerCase() === 'skipped') return approval;
  }
  return null;
}

function _approvalAllApproved(approvals) {
  if (!approvals || !approvals.length) return false;
  for (var i = 0; i < approvals.length; i++) {
    if (String(approvals[i].status || '').toLowerCase() !== 'approved') return false;
  }
  return true;
}

function _approvalSkipRemaining(documentId, decidedApprovalId) {
  _approvalPatchApprovals(
    'document_id=eq.' + encodeURIComponent(documentId) + '&id=neq.' + encodeURIComponent(decidedApprovalId) + '&status=in.(pending,skipped)',
    { status: 'skipped' }
  );
}
function _approvalPatchApproval(approvalId, data) { _approvalPatchApprovals('id=eq.' + encodeURIComponent(approvalId), data); }
function _approvalPatchApprovals(filter, data) {
  var cfg = _getSupabaseConfig();
  var url = cfg.url + '/rest/v1/doc_approvals?' + filter;
  var res = UrlFetchApp.fetch(url, { method: 'PATCH', headers: _sbHeaders(cfg.key), payload: JSON.stringify(data), muteHttpExceptions: true });
  _approvalCheckResponse(res, 'PATCH doc_approvals');
}
function _approvalPatchDocumentStatus(documentId, status) { _sbPatch('doc_documents', 'id=eq.' + encodeURIComponent(documentId), { status: status, updated_at: new Date().toISOString() }); }
function _approvalLogEvent(approvalId, action, payload) { _sbPost('rpc/doc_log_event', { p_entity_type: 'approval', p_entity_id: approvalId, p_action: action, p_payload: payload || {} }); }
function _approvalLogSystemWarning(action, payload) { try { _sbPost('system_log', { level: 'WARN', module: 'approvalEngine', action: action, payload: payload || {}, created_at: new Date().toISOString() }); } catch (_) {} }
function _approvalParseApprovers(value) {
  if (!value) return [];
  if (Object.prototype.toString.call(value) === '[object Array]') return value;
  if (typeof value === 'string') {
    try { var parsed = JSON.parse(value); if (Object.prototype.toString.call(parsed) === '[object Array]') return parsed; }
    catch (_) { return value.split(',').map(function (item) { return item.trim(); }).filter(Boolean); }
  }
  return [];
}
function _approvalRestUrl(table, params) { var cfg = _getSupabaseConfig(); return cfg.url + '/rest/v1/' + table + (params && params.length ? '?' + params.join('&') : ''); }

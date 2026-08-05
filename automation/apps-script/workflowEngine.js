/**
 * RIFIM OS â€” Workflow Engine
 * State machine untuk dokumen: draft â†’ pending_approval â†’ approved
 *                                                         â†’ rejected
 *                              approved â†’ signed â†’ archived
 *
 * OWNER TASK: Codex (branch: codex/workflow-engine)
 *
 * Tabel Supabase yang dipakai:
 *   - doc_documents            (kolom status: doc_status enum)
 *   - doc_revisions            (immutable snapshot)
 *   - doc_approvals            (dibuat lewat approvalEngine.js saat submit)
 *   - doc_audit_log            (INSERT lewat RPC public.doc_log_event)
 *
 * Kontrak fungsi (JANGAN ubah signature â€” dipanggil dari webApp.js):
 *
 *   transitionDocument({
 *     documentId : uuid,
 *     action     : 'submit'|'approve'|'reject'|'sign'|'archive'|'revise',
 *     actor      : uuid,       // user_profiles.id
 *     payload    : Object,     // opsional: comment, revision baru, dll
 *   }) â†’ { success: bool, status: doc_status, revisionId?: uuid, error?: string }
 *
 * Aturan transisi legal (VALIDASI DI SINI, bukan di client):
 *   draft            â†’ submit  â†’ pending_approval
 *   pending_approval â†’ approve â†’ approved             (kalau semua approver ACC)
 *   pending_approval â†’ reject  â†’ rejected
 *   rejected         â†’ revise  â†’ draft                (bikin revision baru)
 *   approved         â†’ sign    â†’ signed               (attach TTD + stempel)
 *   signed           â†’ archive â†’ archived
 *   * â†’ revise â†’ draft (owner boleh selalu revisi selama belum signed)
 *
 * Setiap transisi WAJIB:
 *   1. UPDATE doc_documents.status
 *   2. Panggil doc_log_event('document', documentId, 'transitioned', {from, to, action})
 *   3. Return status baru
 *
 * Untuk action='submit' dan 'revise': koordinasi dengan approvalEngine +
 * revisionEngine (buat approvals dari doc_approval_rules).
 *
 * Reusable helpers dari hrisLayer.js:
 *   _getSupabaseConfig(), _sbGet(url), _sbPost(table,data),
 *   _sbPatch(table, filter, data)
 *
 * RPC panggil via:
 *   _sbPost('rpc/doc_log_event', {p_entity_type, p_entity_id, p_action, p_payload});
 */

function transitionDocument(input) {
  try {
    input = input || {};
    _workflowValidateInput(input);

    var document = _workflowGetDocument(input.documentId);
    var fromStatus = document.status;
    var action = String(input.action).toLowerCase();
    var transition = _workflowResolveTransition(fromStatus, action);
    var revisionResult = null;

    if (action === 'revise') {
      revisionResult = _workflowCreateRevision(input, document);
    }

    if (action === 'submit') {
      revisionResult = _workflowEnsureSubmittedRevision(input, document);
      _workflowCreateApprovals(input, document, revisionResult.revisionId);
    }

    if (action === 'approve') {
      _workflowAssertAllApprovalsAccepted(input.documentId);
    }

    _workflowPatchDocument(input.documentId, transition.to, revisionResult);
    _workflowLogTransition(input.documentId, input.actor, fromStatus, transition.to, action);

    var result = { success: true, status: transition.to };
    if (revisionResult && revisionResult.revisionId) {
      result.revisionId = revisionResult.revisionId;
    }
    return result;
  } catch (err) {
    return {
      success: false,
      status: null,
      error: err && err.message ? err.message : String(err),
    };
  }
}

var WORKFLOW_LEGAL_TRANSITIONS = {
  draft: {
    submit: 'pending_approval',
  },
  pending_approval: {
    approve: 'approved',
    reject: 'rejected',
  },
  rejected: {
    revise: 'draft',
  },
  approved: {
    sign: 'signed',
    revise: 'draft',
  },
  signed: {
    archive: 'archived',
  },
};

var WORKFLOW_ACTIONS = ['submit', 'approve', 'reject', 'sign', 'archive', 'revise'];

function _workflowValidateInput(input) {
  if (!input.documentId) throw new Error('documentId diperlukan.');
  if (!input.action) throw new Error('action diperlukan.');
  if (!input.actor) throw new Error('actor diperlukan.');

  var action = String(input.action).toLowerCase();
  if (WORKFLOW_ACTIONS.indexOf(action) === -1) {
    throw new Error('Action tidak valid: ' + input.action);
  }
}

function _workflowResolveTransition(fromStatus, action) {
  fromStatus = String(fromStatus || '').toLowerCase();
  action = String(action || '').toLowerCase();

  if (action === 'revise' && fromStatus !== 'signed' && fromStatus !== 'archived') {
    return { from: fromStatus, to: 'draft' };
  }

  var transitions = WORKFLOW_LEGAL_TRANSITIONS[fromStatus] || {};
  var toStatus = transitions[action];
  if (!toStatus) {
    throw new Error('Transisi tidak valid: ' + fromStatus + ' -> ' + action);
  }
  return { from: fromStatus, to: toStatus };
}

function _workflowGetDocument(documentId) {
  var rows = _sbGet(_workflowRestUrl('doc_documents', [
    'id=eq.' + encodeURIComponent(documentId),
    'limit=1',
  ]));

  if (!rows || !rows.length) {
    throw new Error('Dokumen tidak ditemukan: ' + documentId);
  }
  return rows[0];
}

function _workflowPatchDocument(documentId, status, revisionResult) {
  var patch = {
    status: status,
    updated_at: new Date().toISOString(),
  };

  if (revisionResult && revisionResult.revisionId) {
    patch.current_revision_id = revisionResult.revisionId;
  }

  _sbPatch('doc_documents', 'id=eq.' + encodeURIComponent(documentId), patch);
}

function _workflowLogTransition(documentId, actor, fromStatus, toStatus, action) {
  _sbPost('rpc/doc_log_event', {
    p_entity_type: 'document',
    p_entity_id: documentId,
    p_action: 'transitioned',
    p_payload: {
      from: fromStatus,
      to: toStatus,
      action: action,
      actor: actor,
    },
  });
}

function _workflowEnsureSubmittedRevision(input, document) {
  var payload = input.payload || {};
  var revisionId = payload.revisionId || payload.revision_id || document.current_revision_id;
  if (revisionId) return { revisionId: revisionId };

  return _workflowCreateRevision(input, document);
}

function _workflowCreateRevision(input, document) {
  var payload = input.payload || {};
  if (!payload.revision && !payload.snapshot && !payload.document && !payload.data) {
    throw new Error('Payload revisi diperlukan untuk action revise atau submit tanpa current_revision_id.');
  }

  if (typeof createRevision === 'function') {
    try {
      var engineResult = createRevision({
        documentId: input.documentId,
        payload: payload.revision || payload.snapshot || payload.document || payload.data,
        actor: input.actor,
        pdfDriveId: payload.pdfDriveId || payload.pdf_drive_id,
      });
      if (engineResult && engineResult.revisionId) return engineResult;
    } catch (err) {
      if (!_workflowIsPlaceholderError(err)) throw err;
    }
  }

  return _workflowCreateRevisionFallback(input, payload);
}

function _workflowCreateRevisionFallback(input, payload) {
  var snapshot = payload.revision || payload.snapshot || payload.document || payload.data;
  var latestRows = _sbGet(_workflowRestUrl('doc_revisions', [
    'document_id=eq.' + encodeURIComponent(input.documentId),
    'select=revision_number',
    'order=revision_number.desc',
    'limit=1',
  ]));
  var nextRevisionNumber = latestRows && latestRows.length
    ? Number(latestRows[0].revision_number || 0) + 1
    : 1;
  var revisionId = _workflowUuid();

  _sbPost('doc_revisions', {
    id: revisionId,
    document_id: input.documentId,
    revision_number: nextRevisionNumber,
    payload: snapshot,
    diff: nextRevisionNumber === 1 ? null : payload.diff || null,
    created_by: input.actor,
  });

  _sbPost('rpc/doc_log_event', {
    p_entity_type: 'revision',
    p_entity_id: revisionId,
    p_action: 'created',
    p_payload: { revision_number: nextRevisionNumber, actor: input.actor },
  });

  return {
    success: true,
    revisionId: revisionId,
    revisionNumber: nextRevisionNumber,
    diff: nextRevisionNumber === 1 ? null : payload.diff || null,
  };
}

function _workflowCreateApprovals(input, document, revisionId) {
  if (typeof createApprovals === 'function') {
    try {
      return createApprovals({
        documentId: input.documentId,
        revisionId: revisionId,
        companySlug: document.company_slug || document.companySlug || '',
        docType: document.doc_type || document.docType || document.document_type || '',
      });
    } catch (err) {
      if (!_workflowIsPlaceholderError(err)) throw err;
    }
  }

  return _workflowCreateApprovalsFallback(input, document, revisionId);
}

function _workflowCreateApprovalsFallback(input, document, revisionId) {
  var companySlug = document.company_slug || document.companySlug || '';
  var docType = document.doc_type || document.docType || document.document_type || '';
  var rules = _sbGet(_workflowRestUrl('doc_approval_rules', [
    'company_slug=eq.' + encodeURIComponent(companySlug),
    'doc_type=eq.' + encodeURIComponent(docType),
    'limit=1',
  ]));

  if (!rules || !rules.length) {
    throw new Error('Aturan approval belum ditemukan untuk ' + companySlug + '/' + docType + '.');
  }

  var rule = rules[0];
  var approvers = _workflowParseApprovers(rule.approvers);
  var mode = String(rule.mode || 'sequential').toLowerCase() === 'parallel' ? 'parallel' : 'sequential';
  var approvalIds = [];

  if (!approvers.length) {
    throw new Error('Aturan approval tidak memiliki approver.');
  }

  for (var i = 0; i < approvers.length; i++) {
    var approvalId = _workflowUuid();
    approvalIds.push(approvalId);
    _sbPost('doc_approvals', {
      id: approvalId,
      document_id: input.documentId,
      revision_id: revisionId,
      approver_id: approvers[i],
      order_index: i,
      status: mode === 'parallel' || i === 0 ? 'pending' : 'skipped',
    });
  }

  return { success: true, approvalIds: approvalIds, mode: mode };
}

function _workflowAssertAllApprovalsAccepted(documentId) {
  var approvals = _sbGet(_workflowRestUrl('doc_approvals', [
    'document_id=eq.' + encodeURIComponent(documentId),
    'select=id,status',
  ]));

  for (var i = 0; approvals && i < approvals.length; i++) {
    if (String(approvals[i].status || '').toLowerCase() !== 'approved') {
      throw new Error('Dokumen belum bisa di-approve: masih ada approval yang belum ACC.');
    }
  }
}

function _workflowParseApprovers(value) {
  if (!value) return [];
  if (Object.prototype.toString.call(value) === '[object Array]') return value;
  if (typeof value === 'string') {
    try {
      var parsed = JSON.parse(value);
      if (Object.prototype.toString.call(parsed) === '[object Array]') return parsed;
    } catch (_) {
      return value.split(',').map(function (item) { return item.trim(); }).filter(Boolean);
    }
  }
  return [];
}

function _workflowRestUrl(table, params) {
  var cfg = _getSupabaseConfig();
  return cfg.url + '/rest/v1/' + table + (params && params.length ? '?' + params.join('&') : '');
}

function _workflowUuid() {
  if (typeof Utilities !== 'undefined' && Utilities.getUuid) {
    return Utilities.getUuid();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (char) {
    var random = Math.random() * 16 | 0;
    var value = char === 'x' ? random : (random & 0x3 | 0x8);
    return value.toString(16);
  });
}

function _workflowIsPlaceholderError(err) {
  var message = err && err.message ? err.message : String(err);
  return message.indexOf('belum diimplementasi') !== -1 || message.indexOf('assign ke Codex') !== -1;
}

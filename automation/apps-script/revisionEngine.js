/**
 * RIFIM OS — Revision Engine
 * Versioning dokumen: setiap edit = revision baru (append-only).
 * Diff disimpan sebagai JSON patch (RFC 6902) supaya bisa lihat perubahan
 * antar revisi tanpa duplikasi payload penuh.
 *
 * OWNER TASK: Codex (branch: codex/revision-engine)
 *
 * Tabel Supabase:
 *   - doc_revisions      (UNIQUE(document_id, revision_number))
 *   - doc_documents      (update current_revision_id + status ke 'draft' saat revise)
 *
 * Kontrak fungsi:
 *
 *   createRevision({
 *     documentId : uuid,
 *     payload    : Object,         // full snapshot input dokumen
 *     actor      : uuid,
 *     pdfDriveId : string?,        // opsional, diisi setelah PDF generate
 *   }) → { success, revisionId, revisionNumber, diff }
 *
 *   listRevisions(documentId) → [
 *     { id, revision_number, created_by, created_at, pdf_url },
 *     ...
 *   ]
 *
 *   restoreRevision({
 *     documentId : uuid,
 *     revisionId : uuid,           // target revision buat di-restore
 *     actor      : uuid,
 *   }) → { success, newRevisionId, newRevisionNumber }
 *
 *   getRevisionDiff(revIdA, revIdB) → JSON patch array (RFC 6902)
 *
 * Aturan:
 *   - revision_number auto-increment per document (SELECT MAX + 1, wrap dalam
 *     retry kalau race — atau pakai advisory lock).
 *   - Revisi #1: diff = null (baseline).
 *   - createRevision tidak trigger transisi status — caller (workflowEngine)
 *     yang atur.
 *   - Log audit: doc_log_event('revision', revisionId, 'created', {revision_number}).
 *
 * Helper JSON patch: implementasi minimal di file ini (add/remove/replace ops
 * cukup). Untuk kasus kompleks, cukup simpan full payload di revisi berikut.
 */

function createRevision(input) {
  input = input || {};
  _revisionValidateCreateInput(input);

  return _revisionCreateWithRetry({
    documentId: input.documentId,
    payload: input.payload,
    actor: input.actor,
    pdfDriveId: input.pdfDriveId,
    fromRestore: null,
    updateDocument: false,
  });
}

function listRevisions(documentId) {
  if (!documentId) throw new Error('documentId diperlukan.');

  return _sbGet(_revisionRestUrl('doc_revisions', [
    'document_id=eq.' + encodeURIComponent(documentId),
    'select=id,revision_number,created_by,created_at,pdf_url',
    'order=revision_number.asc',
  ]));
}

function restoreRevision(input) {
  input = input || {};
  if (!input.documentId) throw new Error('documentId diperlukan.');
  if (!input.revisionId) throw new Error('revisionId diperlukan.');
  if (!input.actor) throw new Error('actor diperlukan.');

  var targetRevision = _revisionGetRevision(input.revisionId);
  if (targetRevision.document_id !== input.documentId) {
    throw new Error('Revision target tidak cocok dengan documentId.');
  }

  var result = _revisionCreateWithRetry({
    documentId: input.documentId,
    payload: targetRevision.payload,
    actor: input.actor,
    pdfDriveId: null,
    fromRestore: input.revisionId,
    updateDocument: true,
  });

  return {
    success: true,
    newRevisionId: result.revisionId,
    newRevisionNumber: result.revisionNumber,
  };
}

function getRevisionDiff(revIdA, revIdB) {
  if (!revIdA) throw new Error('revIdA diperlukan.');
  if (!revIdB) throw new Error('revIdB diperlukan.');

  var revA = _revisionGetRevision(revIdA);
  var revB = _revisionGetRevision(revIdB);
  return _revisionComputeJsonPatch(revA.payload, revB.payload);
}

function _revisionValidateCreateInput(input) {
  if (!input.documentId) throw new Error('documentId diperlukan.');
  if (typeof input.payload === 'undefined') throw new Error('payload diperlukan.');
  if (!input.actor) throw new Error('actor diperlukan.');
}

function _revisionCreateWithRetry(options) {
  var maxAttempts = 3;
  var lastError = null;

  for (var attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return _revisionCreateOnce(options);
    } catch (err) {
      lastError = err;
      if (!_revisionIsUniqueConflict(err) || attempt === maxAttempts) {
        throw err;
      }
    }
  }

  throw lastError;
}

function _revisionCreateOnce(options) {
  var previousRevision = _revisionGetLatestRevision(options.documentId);
  var revisionNumber = previousRevision
    ? Number(previousRevision.revision_number || 0) + 1
    : 1;
  var revisionId = _revisionUuid();
  var diff = previousRevision
    ? _revisionComputeJsonPatch(previousRevision.payload, options.payload)
    : null;

  var row = {
    id: revisionId,
    document_id: options.documentId,
    revision_number: revisionNumber,
    payload: options.payload,
    diff: diff,
    created_by: options.actor,
  };

  if (options.pdfDriveId) {
    row.pdf_drive_id = options.pdfDriveId;
  }

  _sbPost('doc_revisions', row);

  if (options.updateDocument) {
    _revisionPatchDocumentCurrentRevision(options.documentId, revisionId);
  }

  _revisionLogCreated(revisionId, revisionNumber, options.fromRestore);

  return {
    success: true,
    revisionId: revisionId,
    revisionNumber: revisionNumber,
    diff: diff,
  };
}

function _revisionGetLatestRevision(documentId) {
  var rows = _sbGet(_revisionRestUrl('doc_revisions', [
    'document_id=eq.' + encodeURIComponent(documentId),
    'select=id,revision_number,payload',
    'order=revision_number.desc',
    'limit=1',
  ]));

  return rows && rows.length ? rows[0] : null;
}

function _revisionGetRevision(revisionId) {
  var rows = _sbGet(_revisionRestUrl('doc_revisions', [
    'id=eq.' + encodeURIComponent(revisionId),
    'select=id,document_id,revision_number,payload',
    'limit=1',
  ]));

  if (!rows || !rows.length) {
    throw new Error('Revision tidak ditemukan: ' + revisionId);
  }
  return rows[0];
}

function _revisionPatchDocumentCurrentRevision(documentId, revisionId) {
  _sbPatch('doc_documents', 'id=eq.' + encodeURIComponent(documentId), {
    current_revision_id: revisionId,
    status: 'draft',
    updated_at: new Date().toISOString(),
  });
}

function _revisionLogCreated(revisionId, revisionNumber, fromRestore) {
  var payload = { revision_number: revisionNumber };
  if (fromRestore) payload.from_restore = fromRestore;

  _sbPost('rpc/doc_log_event', {
    p_entity_type: 'revision',
    p_entity_id: revisionId,
    p_action: 'created',
    p_payload: payload,
  });
}

function _revisionComputeJsonPatch(a, b) {
  var patch = [];
  _revisionAppendJsonPatch(patch, '', a, b);
  return patch;
}

function _revisionAppendJsonPatch(patch, path, a, b) {
  if (_revisionJsonEqual(a, b)) return;

  if (!_revisionIsPlainObject(a) || !_revisionIsPlainObject(b)) {
    patch.push({ op: 'replace', path: path, value: _revisionCloneJson(b) });
    return;
  }

  var keys = {};
  Object.keys(a).forEach(function (key) { keys[key] = true; });
  Object.keys(b).forEach(function (key) { keys[key] = true; });

  Object.keys(keys).sort().forEach(function (key) {
    var childPath = path + '/' + _revisionEscapeJsonPointer(key);
    var hasA = Object.prototype.hasOwnProperty.call(a, key);
    var hasB = Object.prototype.hasOwnProperty.call(b, key);

    if (!hasB) {
      patch.push({ op: 'remove', path: childPath });
    } else if (!hasA) {
      patch.push({ op: 'add', path: childPath, value: _revisionCloneJson(b[key]) });
    } else {
      _revisionAppendJsonPatch(patch, childPath, a[key], b[key]);
    }
  });
}

function _revisionIsPlainObject(value) {
  return value !== null &&
    typeof value === 'object' &&
    Object.prototype.toString.call(value) === '[object Object]';
}

function _revisionJsonEqual(a, b) {
  return _revisionCanonicalJson(a) === _revisionCanonicalJson(b);
}

function _revisionCanonicalJson(value) {
  return JSON.stringify(_revisionSortJsonValue(value));
}

function _revisionSortJsonValue(value) {
  if (value === null || typeof value !== 'object') return value;

  if (Object.prototype.toString.call(value) === '[object Array]') {
    return value.map(function (item) {
      return _revisionSortJsonValue(item);
    });
  }

  var sorted = {};
  Object.keys(value).sort().forEach(function (key) {
    sorted[key] = _revisionSortJsonValue(value[key]);
  });
  return sorted;
}

function _revisionCloneJson(value) {
  return typeof value === 'undefined'
    ? null
    : JSON.parse(JSON.stringify(value));
}

function _revisionEscapeJsonPointer(value) {
  return String(value).replace(/~/g, '~0').replace(/\//g, '~1');
}

function _revisionRestUrl(table, params) {
  var cfg = _getSupabaseConfig();
  return cfg.url + '/rest/v1/' + table + (params && params.length ? '?' + params.join('&') : '');
}

function _revisionUuid() {
  if (typeof Utilities !== 'undefined' && Utilities.getUuid) {
    return Utilities.getUuid();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (char) {
    var random = Math.random() * 16 | 0;
    var value = char === 'x' ? random : (random & 0x3 | 0x8);
    return value.toString(16);
  });
}

function _revisionIsUniqueConflict(err) {
  var message = err && err.message ? err.message : String(err);
  return message.indexOf('HTTP 409') !== -1 || message.toLowerCase().indexOf('unique') !== -1;
}
/**
 * RIFIM OS — Audit Engine
 * Thin wrapper di sisi GAS untuk RPC public.doc_log_event.
 * Immutability + hash-chain sudah di-enforce di DB (trigger + REVOKE UPDATE).
 *
 * OWNER TASK: Codex (branch: codex/audit-engine)
 *
 * Kontrak fungsi:
 *
 *   logEvent({
 *     entityType : 'document'|'revision'|'approval',
 *     entityId   : uuid,
 *     action     : string,          // 'created'|'transitioned'|'approved'|'rejected'|'signed'|...
 *     payload    : Object?,
 *   }) → { success, id }
 *
 *   queryEvents({
 *     entityType : string?,
 *     entityId   : uuid?,
 *     since      : ISO date?,
 *     limit      : int? (default 100),
 *   }) → [
 *     { id, entity_type, entity_id, actor_id, action, payload, prev_hash, row_hash, created_at },
 *     ...
 *   ]
 *
 *   verifyChain({ fromId?, toId? }) → {
 *     ok            : bool,
 *     brokenAt      : bigint?,      // id baris pertama yang chain-nya invalid
 *     checkedRows   : int,
 *   }
 *
 * Aturan:
 *   - logEvent selalu via _sbPost('rpc/doc_log_event', {...}) — TIDAK BOLEH
 *     INSERT langsung ke doc_audit_log (RLS INSERT policy WITH CHECK false).
 *   - verifyChain: re-compute row_hash pakai algoritma di DB
 *     (sha256(prev_hash + '|' + entity_type + '|' + entity_id + '|' + action + '|' + payload_text))
 *     dan bandingkan dengan row_hash tersimpan. Kalau ada mismatch,
 *     return brokenAt = id baris pertama yang beda.
 *   - Payload text untuk hashing = canonical JSON (kunci ter-sort).
 *
 * Test util (dev only):
 *   logSampleEvents(n) → seed N event dummy buat smoke test.
 */

function logEvent(input) {
  input = input || {};
  _auditValidateLogInput(input);

  _sbPost('rpc/doc_log_event', {
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_action: input.action,
    p_payload: input.payload || {},
  });

  return { success: true, id: null };
}

function queryEvents(input) {
  input = input || {};

  var limit = Number(input.limit || 100);
  if (!isFinite(limit) || limit < 1) limit = 100;
  if (limit > 1000) limit = 1000;

  var params = [
    'select=id,entity_type,entity_id,actor_id,action,payload,prev_hash,row_hash,created_at',
    'order=id.desc',
    'limit=' + limit,
  ];

  if (input.entityType) {
    params.push('entity_type=eq.' + encodeURIComponent(input.entityType));
  }
  if (input.entityId) {
    params.push('entity_id=eq.' + encodeURIComponent(input.entityId));
  }
  if (input.since) {
    params.push('created_at=gte.' + encodeURIComponent(input.since));
  }

  return _sbGet(_auditRestUrl('doc_audit_log', params));
}

function verifyChain(input) {
  input = input || {};

  var params = [
    'select=id,entity_type,entity_id,action,payload,prev_hash,row_hash',
    'order=id.asc',
    'limit=1000',
  ];

  if (input.fromId) {
    params.push('id=gte.' + encodeURIComponent(input.fromId));
  }
  if (input.toId) {
    params.push('id=lte.' + encodeURIComponent(input.toId));
  }

  var rows = _sbGet(_auditRestUrl('doc_audit_log', params));
  var checkedRows = 0;

  for (var i = 0; rows && i < rows.length; i++) {
    var row = rows[i];
    checkedRows++;

    var payloadText = _auditCanonicalJson(
      Object.prototype.hasOwnProperty.call(row, 'payload') ? row.payload : null
    );
    var hashInput = [
      row.prev_hash || '',
      row.entity_type || '',
      row.entity_id || '',
      row.action || '',
      payloadText,
    ].join('|');
    var expectedHash = _auditSha256Hex(hashInput);
    var storedHash = String(row.row_hash || '').toLowerCase();

    if (expectedHash !== storedHash) {
      return { ok: false, brokenAt: row.id, checkedRows: checkedRows };
    }
  }

  return { ok: true, brokenAt: null, checkedRows: checkedRows };
}

function _auditValidateLogInput(input) {
  if (!input.entityType) throw new Error('entityType diperlukan.');
  if (!input.entityId) throw new Error('entityId diperlukan.');
  if (!input.action) throw new Error('action diperlukan.');
}

function _auditRestUrl(table, params) {
  var cfg = _getSupabaseConfig();
  return cfg.url + '/rest/v1/' + table + (params && params.length ? '?' + params.join('&') : '');
}

function _auditCanonicalJson(value) {
  return JSON.stringify(_auditSortJsonValue(value));
}

function _auditSortJsonValue(value) {
  if (value === null || typeof value !== 'object') return value;

  if (Object.prototype.toString.call(value) === '[object Array]') {
    return value.map(function (item) {
      return _auditSortJsonValue(item);
    });
  }

  var sorted = {};
  Object.keys(value).sort().forEach(function (key) {
    sorted[key] = _auditSortJsonValue(value[key]);
  });
  return sorted;
}

function _auditSha256Hex(value) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value);
  return digest.map(function (byte) {
    var unsigned = byte < 0 ? byte + 256 : byte;
    return ('0' + unsigned.toString(16)).slice(-2);
  }).join('');
}

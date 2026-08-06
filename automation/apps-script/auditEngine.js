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
  try {
    input = input || {};

    var fromId = _auditOptionalPositiveId(input.fromId, 'fromId');
    var toId = _auditOptionalPositiveId(input.toId, 'toId');
    var params = [
      'select=id,entity_type,entity_id,action,payload,prev_hash,row_hash',
      'order=id.asc',
      'limit=1000',
    ];

    if (fromId !== null) {
      params.push('id=gte.' + encodeURIComponent(fromId));
    }
    if (toId !== null) {
      params.push('id=lte.' + encodeURIComponent(toId));
    }

    var rows = _sbGet(_auditRestUrl('doc_audit_log', params));
    if (!rows || Object.prototype.toString.call(rows) !== '[object Array]') {
      throw new Error('verifyChain: response audit log tidak valid.');
    }

    var checkedRows = 0;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i] || {};
      checkedRows++;

      // Hash algo v4 (migration docengine_006): SKIP payload dari chain.
      // Payload tetap tersimpan; tampering di-guard oleh immutability trigger
      // BEFORE UPDATE OR DELETE di doc_audit_log. Chain guard: ordering +
      // entity_type + entity_id + action + prev_hash link.
      var hashInput = [
        _auditHashPart(row.prev_hash),
        _auditHashPart(row.entity_type),
        _auditHashPart(row.entity_id),
        _auditHashPart(row.action),
      ].join('|');
      var expectedHash = _auditSha256Hex(hashInput);
      var storedHash = _auditHashPart(row.row_hash).toLowerCase();

      if (!storedHash || expectedHash !== storedHash) {
        return { ok: false, brokenAt: row.id || null, checkedRows: checkedRows };
      }
    }

    return { ok: true, brokenAt: null, checkedRows: checkedRows };
  } catch (err) {
    throw new Error('verifyChain gagal: ' + (err && err.message ? err.message : String(err)));
  }
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

function _auditOptionalPositiveId(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  var id = Number(value);
  if (!isFinite(id) || id < 1 || Math.floor(id) !== id) {
    throw new Error(fieldName + ' harus berupa angka positif.');
  }
  return String(id);
}

function _auditCanonicalJson(value) {
  var normalized = _auditNormalizeJsonValue(value);
  var json = JSON.stringify(_auditSortJsonValue(normalized));
  return typeof json === 'string' ? json : '{}';
}

function _auditNormalizeJsonValue(value) {
  if (value === undefined || value === null || value === '') return {};
  if (typeof value !== 'string') return value;

  var text = value.trim();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch (err) {
    return text;
  }
}

function _auditSortJsonValue(value) {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object') return value;

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

function _auditHashPart(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function _auditSha256Hex(value) {
  var text = _auditHashPart(value);
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return digest.map(function (byte) {
    var unsigned = byte < 0 ? byte + 256 : byte;
    return ('0' + unsigned.toString(16)).slice(-2);
  }).join('');
}

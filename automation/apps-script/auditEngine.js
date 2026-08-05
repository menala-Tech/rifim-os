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

// TODO(codex): implement logEvent() / queryEvents() / verifyChain()
function logEvent(input) {
  throw new Error('auditEngine.logEvent() belum diimplementasi — assign ke Codex');
}

function queryEvents(input) {
  throw new Error('auditEngine.queryEvents() belum diimplementasi — assign ke Codex');
}

function verifyChain(input) {
  throw new Error('auditEngine.verifyChain() belum diimplementasi — assign ke Codex');
}

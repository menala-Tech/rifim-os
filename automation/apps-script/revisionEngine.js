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

// TODO(codex): implement createRevision()
function createRevision(input) {
  throw new Error('revisionEngine.createRevision() belum diimplementasi — assign ke Codex');
}

// TODO(codex): implement listRevisions() / restoreRevision() / getRevisionDiff()
function listRevisions(documentId) {
  throw new Error('revisionEngine.listRevisions() belum diimplementasi — assign ke Codex');
}

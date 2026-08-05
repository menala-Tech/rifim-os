/**
 * RIFIM OS — Approval Engine
 * Routing approver berdasarkan (company_slug, doc_type) dari sheet/table
 * doc_approval_rules. Support sequential dan parallel mode.
 *
 * OWNER TASK: Codex (branch: codex/approval-engine)
 *
 * Tabel Supabase:
 *   - doc_approval_rules (config: company_slug, doc_type, approvers uuid[], mode)
 *   - doc_approvals      (instance per dokumen)
 *   - doc_documents      (status update)
 *
 * Kontrak fungsi:
 *
 *   createApprovals({
 *     documentId  : uuid,
 *     revisionId  : uuid,
 *     companySlug : string,
 *     docType     : string,
 *   }) → { success: bool, approvalIds: uuid[], mode: 'sequential'|'parallel' }
 *
 *   decideApproval({
 *     approvalId : uuid,
 *     approverId : uuid,
 *     decision   : 'approved'|'rejected',
 *     comment    : string?,
 *   }) → {
 *     success       : bool,
 *     documentStatus: doc_status,   // recomputed status doc setelah keputusan
 *     nextApprovalId: uuid?,        // kalau sequential, id approval berikutnya
 *   }
 *
 *   getPendingForApprover(approverId) → RPC doc_get_pending_approvals(approverId)
 *
 * Aturan:
 *   - Kalau ANY approver reject → doc status = 'rejected' (semua sisa 'pending' → 'skipped').
 *   - Kalau semua approver approve → doc status = 'approved'.
 *   - Sequential: buat SEMUA approvals di awal, tapi hanya order_index=0 yang
 *     'pending', sisanya 'skipped' → di-set 'pending' setelah pendahulunya approve.
 *   - Parallel: semua 'pending' bersamaan.
 *   - WAJIB log ke doc_audit_log via doc_log_event('approval', approvalId, ...)
 *
 * Konfigurasi default kalau (company, doc_type) belum ada di doc_approval_rules:
 *   - Fallback: approvers = [direksi_pertama_aktif], mode='sequential'
 *   - Log warning ke system_log.
 */

// TODO(codex): implement createApprovals()
function createApprovals(input) {
  throw new Error('approvalEngine.createApprovals() belum diimplementasi — assign ke Codex');
}

// TODO(codex): implement decideApproval()
function decideApproval(input) {
  throw new Error('approvalEngine.decideApproval() belum diimplementasi — assign ke Codex');
}

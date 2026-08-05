/**
 * RIFIM OS — Search Engine
 * Full-text search dokumen di doc_documents + doc_revisions.payload.
 *
 * OWNER TASK: Codex (branch: codex/search-engine)
 *
 * Strategi awal (v1): PostgREST filter `or=(title.ilike.*q*,doc_number.ilike.*q*)`
 * digabung filter jsonb payload `.metadata @> '{"key":"value"}'`. Cukup untuk
 * dataset <10k doc.
 *
 * Strategi lanjut (v2, opsional — tunggu volume): bikin materialized view
 * doc_search_index dengan tsvector; refresh via cron/GAS trigger.
 * Kalau butuh MV, minta Claude yang bikin migration — Codex jangan touch
 * migrations.
 *
 * Kontrak fungsi:
 *
 *   searchDocuments({
 *     query        : string,          // free text
 *     companySlug  : string?,
 *     docType      : string?,
 *     status       : doc_status?,
 *     from         : ISO date?,
 *     to           : ISO date?,
 *     limit        : int  (default 20, max 100),
 *     offset       : int  (default 0),
 *   }) → {
 *     total   : int,
 *     results : [
 *       { id, title, doc_number, company_slug, doc_type, status,
 *         current_revision_id, created_at,
 *         snippet : string  // potongan match dari title/metadata
 *       }, ...
 *     ]
 *   }
 *
 * Aturan:
 *   - Escape wildcards `%_*` di query sebelum inject ke ilike.
 *   - Kalau query kosong tapi filter (company/status/date) diisi, tetap valid.
 *   - Log pencarian ke system_log LEVEL=DEBUG (opsional, buat analitik dulu).
 */

// TODO(codex): implement searchDocuments()
function searchDocuments(input) {
  throw new Error('searchEngine.searchDocuments() belum diimplementasi — assign ke Codex');
}

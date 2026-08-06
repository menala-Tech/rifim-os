---
name: rifim-os-document-engine-workflow
description: Workflow/Approval/Revision/Audit/Search engine untuk Document Engine RIFIM OS - state machine dokumen (draft->approved), hash-chained audit log (SHA-256 immutable), sequential/parallel approval flow, revision versioning dgn JSON patch RFC 6902, search full-text. PWA di modules/documents/. Gunakan skill ini setiap kali menyentuh tabel doc_*, endpoint doc_* di webApp.js, CrmApi.docs.*, atau modules/documents PWA.
---

# RIFIM OS Document Engine Workflow

Skill ini khusus untuk workflow/approval/revision/audit/search Document Engine.
Skill lama `rifim-os-document-engine` tetap untuk DDS, template, HTML->PDF, kop, footer, signature, dan export dokumen.

## Arsitektur (diagram ASCII)

```text
[PWA modules/documents]
      | CrmApi.docs.*  (automation/apps-script/crmApi.js - IIFE window guard)
      | HTTP GET/POST /exec
[GAS Web App]
      | webApp.js docHandleGet/docHandlePost (12 action doc_*)
      |
+------------+------------+------------+------------+------------+
| workflow   | approval   | revision   | audit      | search     |
| Engine     | Engine     | Engine     | Engine     | Engine     |
+-----+------+-----+------+-----+------+-----+------+-----+------+
      |            |            |            |            |
doc_documents doc_approvals doc_revisions doc_audit_log search over doc data
                                        (immutable, SHA-256 hash chain)
```

Layer contract:
- PWA tidak langsung fetch Supabase.
- PWA hanya memanggil `CrmApi.docs.*`.
- `CrmApi.docs.*` hanya memanggil GAS Web App `/exec`.
- `webApp.js` melakukan auth by email lalu role gate.
- Sub-engine GAS memanggil Supabase via `_sbGet`, `_sbPost`, `_sbPatch`, dan `_sbHeaders`.
- Audit log selalu melalui RPC `rpc/doc_log_event`.
- Search membaca `doc_documents` via PostgREST filter dan exact count.
- Revision engine membuat payload immutable per revision.
- Approval engine mengubah `doc_approvals` dan status dokumen.
- Workflow engine menjaga transisi state yang valid.

## 5 Tabel Supabase

### 1. doc_documents

- Fungsi: header dokumen dan status lifecycle.
- Kolom penting: `id`, `title`, `doc_number`, `company_slug`, `doc_type`, `status`, `current_revision_id`, `created_by`, `created_at`, `updated_at`.
- `status` memakai enum `doc_status`.
- `current_revision_id` FK ke `doc_revisions.id`.
- `company_slug` dan `doc_type` dipakai untuk lookup approval rules.
- `doc_number` dipakai search bersama title.
- RLS: read sesuai policy project; write lewat GAS/service role path.
- Guard: status hanya boleh berubah via engine supaya audit tetap konsisten.
- Jangan update `current_revision_id` tanpa membuat row revision baru.
- Jangan hard-delete dokumen production tanpa cleanup terkontrol.

### 2. doc_revisions

- Fungsi: versi payload dokumen.
- Kolom penting: `id`, `document_id`, `revision_number`, `payload`, `diff`, `pdf_drive_id`, `created_by`, `created_at`.
- FK: `document_id` -> `doc_documents.id`.
- Unique: `UNIQUE(document_id, revision_number)`.
- `payload` berupa `jsonb`, full snapshot per revision.
- `diff` berupa JSON Patch RFC 6902 terhadap revision sebelumnya.
- Revision #1 baseline: `diff = null`.
- Revision >=2: `diff` array operation `add`, `remove`, `replace`.
- Race guard: `createRevision` retry max 3x saat unique conflict.
- RLS: insert lewat GAS engine; client tidak insert langsung.
- Immutability expectation: revision lama tidak diedit; buat revision baru.

### 3. doc_approval_rules

- Fungsi: konfigurasi approval per company dan doc type.
- Kolom penting: `id`, `company_slug`, `doc_type`, `approvers`, `mode`, `created_at`, `updated_at`.
- Unique: `(company_slug, doc_type)`.
- `approvers` berisi array UUID user profile.
- `mode` enum `sequential` atau `parallel`.
- Sumber SSoT operasional juga dimirror ke sheet `doc_approval_rules`.
- Jika rule tidak ada, engine fallback ke direksi aktif pertama dengan mode sequential.
- RLS: config harus dijaga admin/management.
- Jangan mock approver; pakai UUID real dari `user_profiles`.
- Perubahan rule tidak otomatis mengubah approval instance lama.

### 4. doc_approvals

- Fungsi: instance approval per document/revision.
- Kolom penting: `id`, `document_id`, `revision_id`, `approver_id`, `order_index`, `status`, `decision_at`, `comment`, `created_at`.
- FK: `document_id` -> `doc_documents.id`.
- FK: `revision_id` -> `doc_revisions.id`.
- FK: `approver_id` -> `user_profiles.id`.
- `order_index` menentukan urutan sequential.
- `status` enum approval: `pending`, `approved`, `rejected`, `skipped`.
- Sequential: hanya order pertama `pending`, sisanya `skipped` sampai giliran.
- Parallel: semua approver langsung `pending`.
- Reject membuat sisa pending/skipped menjadi skipped dan dokumen rejected.
- RLS: pending approval dibaca lewat RPC `doc_get_pending_approvals`.

### 5. doc_audit_log

- Fungsi: audit immutable untuk semua event workflow.
- Kolom penting: `id`, `entity_type`, `entity_id`, `action`, `payload`, `prev_hash`, `row_hash`, `created_at`.
- `id` bigserial menjaga urutan chain.
- `prev_hash` adalah row_hash row audit sebelumnya.
- `row_hash` = SHA-256 dari canonical material.
- Trigger memblok UPDATE dan DELETE.
- RLS insert direct ditolak; jangan insert langsung.
- Semua write wajib via RPC `doc_log_event`.
- `verifyChain` recompute chain dari rows yang diambil via `_sbGet`.
- `doc_audit_mirror` sheet adalah mirror read-only untuk admin.
- Audit payload harus ringkas, aman, dan tidak menyimpan secret.

## 2 RPC Supabase

### doc_log_event(p_entity_type, p_entity_id, p_action, p_payload)

- Security: `SECURITY DEFINER`.
- Search path: `public, extensions`.
- Tujuan: satu-satunya pintu tulis audit log.
- Hash chain SHA-256.
- Hash algo v3 dari migration 003: strip whitespace dari `p_payload::text` supaya konsisten dengan JS `JSON.stringify`.
- Input entity_type contoh: `document`, `revision`, `approval`, `workflow`.
- Input action contoh: `created`, `submitted`, `approved`, `rejected`, `restored`.
- Dipanggil dari GAS via `_sbPost('rpc/doc_log_event', payload)`.
- Jangan ubah signature tanpa update `auditEngine.js`, `approvalEngine.js`, `revisionEngine.js`, dan `workflowEngine.js`.
- Jangan pindahkan logic hash ke client.

### doc_get_pending_approvals(p_approver_id)

- Security: `SECURITY DEFINER`.
- Param final: `p_approver_id`.
- Migration 004 rename dari `p_approver` ke `p_approver_id`.
- Dipakai oleh `getPendingForApprover(approverId)`.
- Dipakai endpoint HTTP `doc_pending`.
- Return list approval pending untuk user tersebut.
- Join biasanya membawa metadata dokumen agar inbox bisa render card.
- Client tidak query `doc_approvals` langsung.
- Saat debug kosong, cek user email -> `user_profiles.id` -> approver_id.
- Saat debug RLS, ingat RPC berjalan sebagai definer.

## 5 Sub-engine files

| File | Fungsi utama | PR merge |
|---|---|---|
| `automation/apps-script/workflowEngine.js` | `transitionDocument` state machine + fallback engine call | #13 |
| `automation/apps-script/approvalEngine.js` | `createApprovals`, `decideApproval`, `getPendingForApprover` | #18 |
| `automation/apps-script/revisionEngine.js` | `createRevision`, `listRevisions`, `restoreRevision`, `getRevisionDiff` RFC 6902 | #16 |
| `automation/apps-script/auditEngine.js` | `logEvent`, `queryEvents`, `verifyChain` SHA-256 verify | #15 |
| `automation/apps-script/searchEngine.js` | `searchDocuments` PostgREST filter + exact count | #21 |

File pendukung:
- `automation/apps-script/webApp.js` dispatch HTTP `doc_*`, PR #23.
- `automation/apps-script/crmApi.js` browser client `CrmApi.docs.*`, PR #24.
- `automation/apps-script/testDocEngineE2E.js` manual GAS E2E suite, PR #22.
- `modules/documents/` PWA scaffold, PR #25.
- `modules/documents/index.html` path fix, cherry-pick main `ad1c839`.

## State machine transisi

| Kondisi awal | Action | Next status | Catatan |
|---|---|---|---|
| `draft` | `submit` | `pending_approval` | Dokumen masuk flow approval. |
| `pending_approval` | `approve` | `approved` | Dipakai jika approval final menyatakan semua approve. |
| `pending_approval` | `reject` | `rejected` | Reject menghentikan flow. |
| `approved` | `sign` | `signed` | Sign belum attach TTD/stempel; asset config masih debt. |
| `rejected` | `revise` | `draft` | Buat revisi baru dahulu jika payload berubah. |
| `approved` | `revise` | `draft` | Reopen sebagai draft dengan revision baru. |
| `signed` | `revise` | `draft` | Hati-hati: signed doc harus preserving audit. |
| status apa pun | action tidak valid | no change | Return `{success:false,error}` atau throw sesuai entrypoint. |

Prinsip state machine:
- Transisi harus eksplisit.
- Tidak boleh update status langsung dari PWA.
- Semua action mutasi harus mencatat audit event.
- `submit` biasanya diikuti `createApprovals`.
- `approve/reject` final berasal dari approval engine.
- `sign` adalah placeholder workflow hingga asset TTD/stempel siap.
- Invalid transition harus aman: tidak mengubah row.
- Test invalid transition memakai `sign` dari `draft`.
- Jika status dokumen tidak dikenal, fail closed.
- Jangan silently coerce action typo.

## Sequential vs Parallel approval

### Sequential

- `createApprovals` membuat semua row approval di awal.
- Approver pertama (`order_index = 0`) mendapat `status = pending`.
- Approver berikutnya mendapat `status = skipped` sampai giliran.
- Saat approver aktif approve, engine mencari row `skipped` berikutnya.
- Row berikutnya dipatch menjadi `pending`.
- Return `nextApprovalId` saat masih ada approver berikutnya.
- Status dokumen tetap `pending_approval` sampai approver terakhir approve.
- Saat approver terakhir approve, status dokumen menjadi `approved`.
- Jika approver mana pun reject, status dokumen menjadi `rejected`.
- Reject juga membuat sisa pending/skipped menjadi `skipped`.

### Parallel

- `createApprovals` membuat semua row langsung `pending`.
- Semua approver bisa memutuskan tanpa urutan.
- Approve pertama belum membuat dokumen approved jika masih ada pending lain.
- Dokumen tetap `pending_approval` selama masih ada pending.
- Saat semua approval `approved`, status dokumen menjadi `approved`.
- Jika satu approver reject, dokumen menjadi `rejected`.
- Reject menghentikan flow dan sisa approval tidak perlu diputuskan.
- UI harus menampilkan progress horizontal per approver.
- Inbox approval harus hanya menampilkan pending untuk user current.
- Jangan campur mode dalam satu document approval instance.

## Tab SSoT sheet

### doc_approval_rules

- Sheet config approval rules.
- Sinkron 2 arah dengan Supabase config sesuai flow admin.
- Kolom utama: company_slug, doc_type, approvers, mode.
- Gunakan UUID real user_profiles untuk approvers.
- Mode hanya `sequential` atau `parallel`.
- Jangan edit manual tanpa sync plan.

### doc_audit_mirror

- Mirror read-only dari `doc_audit_log`.
- Refresh via menu Document Engine atau trigger 30 menit.
- Dipakai admin untuk inspeksi cepat.
- Jangan tulis balik ke Supabase dari mirror.
- Jika mirror berbeda dari DB, DB adalah source of truth.
- Jangan simpan secret di payload audit.

### doc_pending_approvals

- Dashboard sheet untuk pending approval.
- Refresh via trigger 30 menit.
- Source dari RPC pending approvals atau query engine.
- Dipakai untuk operasi monitor, bukan untuk write decision.
- Decision tetap via PWA/GAS `doc_decide`.
- Jika row stale, refresh mirror sebelum debug.

## 12 endpoint HTTP (webApp.js)

| Action | Method | Role gate | Ringkasan |
|---|---|---|---|
| `doc_list` | GET | authenticated | `searchDocuments({query, companySlug, docType, status, from, to, limit, offset})`. |
| `doc_get` | GET | authenticated | Ambil `doc_documents` by id + current revision. |
| `doc_revisions` | GET | authenticated | `listRevisions(documentId)`. |
| `doc_revision_diff` | GET | authenticated | `getRevisionDiff(revIdA, revIdB)`. |
| `doc_audit` | GET | admin/management/direksi | `queryEvents({entityType, entityId, since, limit})`. |
| `doc_pending` | GET | authenticated | `getPendingForApprover(ctx.userId)`. |
| `doc_verify_chain` | GET | admin/management/direksi | `verifyChain({fromId, toId})`. |
| `doc_create` | POST | koord+ | Insert draft doc + `createRevision` #1. |
| `doc_transition` | POST | koord+ | `transitionDocument({documentId, action, actor, payload})`. |
| `doc_decide` | POST | koord+ | `decideApproval({approvalId, approverId, decision, comment})`. |
| `doc_revise` | POST | koord+ | `createRevision` + set status `draft`. |
| `doc_restore` | POST | koord+ | `restoreRevision` ke revision target sebagai revision baru. |

Auth contract:
- GET menerima `?user=email`.
- POST menerima JSON body dengan `user`.
- `_docAuthContext_` lookup email di `user_profiles.email`.
- Email user_profiles dibackfill dari `auth.users` via migration 005.
- Trigger `sync_user_profile_email` menjaga email tetap sinkron.
- Role guard write: `koordinator`, `admin`, `management`, `direksi`.
- Role guard audit/verify: `admin`, `management`, `direksi`.
- Error response standar `{ok:false,error}`.
- Success response standar `{ok:true,data}`.
- POST content-type tetap `text/plain` untuk hindari CORS preflight.

## CrmApi.docs client

- File: `automation/apps-script/crmApi.js`.
- Implementasi browser-only IIFE dengan guard `typeof window`.
- Aman saat file ikut di GAS runtime karena block tidak jalan tanpa `window`.
- Namespace: `window.CrmApi.docs`.
- URL GAS: `CRM_API.gasUrl`, `CRM_GAS_URL`, `GAS_WEB_APP_URL`, atau `GAS_URL`.
- Email: `_crmGetUserEmail()` atau fallback localStorage/current user.
- GET helper menambahkan `action` dan `user` ke query string.
- POST helper mengirim `Content-Type: text/plain`.
- Response parser throw jika `ok:false` atau `success:false`.
- Return selalu `data` jika response `{ok:true,data}`.

12 methods:
- `CrmApi.docs.list(params)` -> `{total, results}`.
- `CrmApi.docs.get(id)` -> `{document, revision}`.
- `CrmApi.docs.revisions(documentId)` -> revision array.
- `CrmApi.docs.revisionDiff(revIdA, revIdB)` -> JSON Patch array.
- `CrmApi.docs.audit(params)` -> audit rows.
- `CrmApi.docs.pending()` -> pending approvals for current user.
- `CrmApi.docs.verifyChain(params)` -> `{ok, brokenAt, checkedRows}`.
- `CrmApi.docs.create(params)` -> new document + revision id.
- `CrmApi.docs.transition(params)` -> workflow transition result.
- `CrmApi.docs.decide(params)` -> approval decision result.
- `CrmApi.docs.revise(params)` -> new revision result.
- `CrmApi.docs.restore(params)` -> restored revision result.

Cache behavior:
- `doc_list` cache 60 detik.
- `doc_pending` cache 60 detik.
- Mutasi create/transition/decide/revise/restore invalidate cache.
- Mutasi fire browser event `docs-updated`.
- PWA router mendengar `docs-updated` untuk refresh list/inbox.
- Path cache final: `/modules/shared/api-cache.js`.
- Path `crmApi.js` final: `/automation/apps-script/crmApi.js`.
- Path fix landed di main `ad1c839`.

## PWA module modules/documents/

Struktur folder:

```text
modules/documents/
  index.html
  pages/list.html
  pages/detail.html
  pages/create.html
  pages/inbox.html
  pages/revise.html
  engines/docs-router.js
  engines/docs-renderer.js
  styles/docs.css
```

### index.html

- Landing shell dengan 4 tab nav: My Docs, Inbox Approval, Create, Search.
- Load `/modules/shared/api-cache.js`.
- Load `/automation/apps-script/crmApi.js`.
- Load `docs-renderer.js` dan `docs-router.js`.
- Gate membaca `localStorage.rifim_user_email`.
- Fallback membaca `localStorage.rifim_auth.email`.
- Jika kosong redirect ke `/modules/portal/`.
- `DOMContentLoaded` -> `CrmApi.init()` -> `DocsRouter.init()`.
- Shell menyediakan `#doc-page`, `#doc-toast`, dan `#doc-modal`.
- Jangan taruh business logic besar di `index.html`.

### pages/list.html

- Filter grid: query, company, docType, status, from, to.
- Table 5 kolom: title, doc_number, type, status pill, updated_at.
- Row click navigasi ke `#/detail?id=X`.
- Loading state skeleton sebelum data siap.
- Data dari `CrmApi.docs.list`.

### pages/detail.html

- Render header title/status/meta.
- Render revision timeline vertikal.
- Tombol `Lihat Diff` memanggil `revisionDiff`.
- Render approval progress horizontal.
- Render audit trail table.
- Link ke `#/revise?id=X`.

### pages/create.html

- Form field: companySlug, docType, title.
- JSON payload editor textarea.
- Validate JSON on blur.
- Submit ke `CrmApi.docs.create`.
- Success redirect ke detail dokumen baru.

### pages/inbox.html

- Card list pending approval.
- Data dari `CrmApi.docs.pending`.
- Review modal dengan Approve/Reject/comment.
- Submit decision ke `CrmApi.docs.decide`.
- Success refresh inbox.

### pages/revise.html

- Form payload JSON revision baru.
- Load current revision payload dari detail.
- Submit ke `CrmApi.docs.revise`.
- Success redirect ke detail.
- Jangan overwrite revision lama.

### engines/docs-router.js

- Hash router untuk `#/list`, `#/detail`, `#/create`, `#/inbox`, `#/revise`.
- Alias `#/search` ke list.
- State utama: `root`, `currentRoute`, `listFilters`.
- Fetch fragment HTML dari `/modules/documents/pages/*.html`.
- Dispatch render per route.
- Catch error dan tampilkan toast merah.
- Jangan import framework.
- Keep static HTML + inline JS style.

### engines/docs-renderer.js

- Helper `DocsRenderer.renderDocumentTable`.
- Helper `renderRevisionTimeline`.
- Helper `renderApprovalProgress`.
- Helper `renderAuditTable`.
- Helper `renderInboxCards`.
- Helper `showDecisionModal`.
- Helper `toast`, `empty`, `skeleton`, `statusPill`.
- Renderer harus escape HTML.

### styles/docs.css

- Reuse feel portal: dark background, navy `#1a4d7a`, red `#C40000`.
- Status pill warna: ok/warn/err/muted.
- Skeleton screen saat loading.
- Responsive mobile: grid collapse ke 1 kolom.
- Tidak mengubah CSS modul portal/finance/hris/sistem.

## Test suite E2E

- File: `automation/apps-script/testDocEngineE2E.js`.
- Entry point: `runAllDocEngineTests()`.
- Output awal: `=== Document Engine E2E ===`.
- Output akhir: `=== SUMMARY: N/M passed, X failed ===`.
- Helper `_testSeedDocument(companySlug, docType, title, payload, actor)`.
- Helper `_testAssert(condition, msg)`.
- Helper `testCleanup()`.
- Cleanup delete test docs title prefix `E2E_TEST_`.
- Seed UUID Genia: `96c180b5-e163-4542-9fad-82134f9417d4`.
- Seed UUID Bobby: `258c9f7a-31d9-46e0-b3d2-47d5caf69b50`.
- Seed UUID Sasih: `085e8100-8ba0-4f9d-920e-7f43416b006a`.

10 test case:
1. `testCreateAndListDocument`.
2. `testRevisionDiff`.
3. `testRestoreRevision`.
4. `testTransitionDraftToPending`.
5. `testSequentialApprovalHappyPath`.
6. `testSequentialApprovalReject`.
7. `testParallelApprovalHappyPath`.
8. `testAuditChainIntegrity`.
9. `testAuditLogFilter`.
10. `testInvalidTransitionBlocked`.

## 5 Supabase migration

- `docengine_001_core_tables` - 5 tabel + 3 enum + RLS + immutability trigger.
- `docengine_002_audit_rpc` - RPC `doc_log_event` + `doc_get_pending_approvals`.
- `docengine_003_normalize_hash_algo` - strip whitespace di `p_payload::text`.
- `docengine_004_rename_pending_approvals_param` - `p_approver` -> `p_approver_id`.
- `docengine_005_user_profiles_email_sync` - add email col + sync trigger dari `auth.users`.


## Debt / TODO

- `sign` action belum attach TTD+stempel; defer sampai config asset siap.
- MV `doc_search_index`; defer sampai volume >10k dokumen.
- Push notification approver saat `createApprovals`; butuh koordinasi Edge Function `raos-send-push`.
- PWA detail approval progress akan lebih akurat jika endpoint `doc_get` ikut return approvals joined.
- Audit mirror refresh perlu dipantau jika trigger 30 menit gagal.
- Path `/modules/shared/api-cache.js` sudah fixed di main `ad1c839`; jangan revert ke `/shared/api-cache.js`.

## Cara test manual

### GAS Editor - seed approval

```javascript
var docId = 'e4fb25bd-8770-45b8-8eaa-0a2596021168';
var revId = 'd7299c82-3aee-4651-97b2-bdf5c2a486b5';
var out = createApprovals({
  documentId: docId,
  revisionId: revId,
  companySlug: 'rifim',
  docType: 'invoice'
});
Logger.log(JSON.stringify(out));
var r1 = decideApproval({
  approvalId: out.approvalIds[0],
  approverId: '96c180b5-e163-4542-9fad-82134f9417d4',
  decision: 'approved'
});
Logger.log(JSON.stringify(r1));
```

### GAS Editor - full E2E

```javascript
runAllDocEngineTests();
```

### GAS Editor - audit verify

```javascript
var e = logEvent({entityType:'document', entityId:Utilities.getUuid(), action:'test.skill', payload:{n:1}});
Logger.log(JSON.stringify(e));
Logger.log(JSON.stringify(verifyChain({fromId:1})));
```

### Web App curl

```bash
GAS="https://script.google.com/macros/s/AKfycbz.../exec"
U="rifiminternationalgemilang@gmail.com"
curl -sL "$GAS?action=doc_list&user=$U&limit=5"
curl -sL "$GAS?action=doc_pending&user=$U"
curl -sL "$GAS?action=doc_verify_chain&user=$U&fromId=1"
```

### Browser post-deploy

- Buka `https://rifim-os.vercel.app/modules/documents/`.
- Login via Portal jika diarahkan.
- Console tidak boleh ada 404 untuk `api-cache.js` atau `crmApi.js`.
- Console check: `typeof CrmApi.docs` harus `object`.
- My Docs harus bisa memanggil `CrmApi.docs.list`.
- Inbox Approval harus bisa memanggil `CrmApi.docs.pending`.
- Create harus validate JSON payload.
- Detail harus render revision timeline.
- `Lihat Diff` harus menampilkan JSON Patch.
- Approve/Reject modal harus kirim comment.

## PR history sesi 2026-08-05 malam

- #13 workflow engine.
- #14 document engine scaffold awal.
- #15 audit engine.
- #16 revision engine.
- #18 approval engine.
- #21 search engine.
- #22 E2E test suite.
- #23 webApp doc dispatch.
- #24 CrmApi.docs client.
- #25 PWA modules/documents scaffold.
- #26 path fix api-cache + crmApi, cherry-picked as `ad1c839`.

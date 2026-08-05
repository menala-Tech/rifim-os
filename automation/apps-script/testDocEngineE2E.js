/**
 * RIFIM OS — Document Engine E2E Test Suite
 *
 * Jalankan manual dari GAS Editor:
 *   runAllDocEngineTests()
 */

var E2E_TEST_PREFIX = 'E2E_TEST_';
var E2E_ACTOR_GENIA = '96c180b5-e163-4542-9fad-82134f9417d4';
var E2E_ACTOR_BOBBY = '258c9f7a-31d9-46e0-b3d2-47d5caf69b50';
var E2E_ACTOR_SASIH = '085e8100-8ba0-4f9d-920e-7f43416b006a';

function runAllDocEngineTests() {
  Logger.log('=== Document Engine E2E ===');

  var tests = [
    testCreateAndListDocument,
    testRevisionDiff,
    testRestoreRevision,
    testTransitionDraftToPending,
    testSequentialApprovalHappyPath,
    testSequentialApprovalReject,
    testParallelApprovalHappyPath,
    testAuditChainIntegrity,
    testAuditLogFilter,
    testInvalidTransitionBlocked,
  ];

  var passed = 0;
  var failed = 0;

  for (var i = 0; i < tests.length; i++) {
    var testFn = tests[i];
    var started = Date.now();
    try {
      testFn();
      passed++;
      Logger.log('✅ ' + testFn.name + ' (' + (Date.now() - started) + 'ms)');
    } catch (err) {
      failed++;
      Logger.log('❌ ' + testFn.name + ' — ' + (err && err.message ? err.message : String(err)));
    }
  }

  Logger.log('=== SUMMARY: ' + passed + '/' + tests.length + ' passed, ' + failed + ' failed ===');
  return { passed: passed, failed: failed, total: tests.length };
}

function testCreateAndListDocument() {
  var seeded = _testSeedDocument('rifim', 'invoice', _testTitle('CREATE_LIST_INVOICE'), { title: 'invoice e2e' }, E2E_ACTOR_GENIA);
  var result = searchDocuments({ query: 'invoice', companySlug: 'rifim', limit: 10 });
  var found = result.results.some(function (row) { return row.id === seeded.documentId; });
  _testAssert(found, 'seeded document must be found by searchDocuments');
}

function testRevisionDiff() {
  var seeded = _testSeedDocument('rifim', 'invoice', _testTitle('REV_DIFF'), { title: 'A' }, E2E_ACTOR_GENIA);
  var rev2 = createRevision({ documentId: seeded.documentId, payload: { title: 'B' }, actor: E2E_ACTOR_GENIA });
  _testPatchDocument(seeded.documentId, { current_revision_id: rev2.revisionId });

  var diff = getRevisionDiff(seeded.revisionId, rev2.revisionId);
  _testAssert(JSON.stringify(diff) === JSON.stringify([{ op: 'replace', path: '/title', value: 'B' }]),
    'expected title replace diff, got ' + JSON.stringify(diff));
}

function testRestoreRevision() {
  var seeded = _testSeedDocument('rifim', 'invoice', _testTitle('RESTORE'), { title: 'A' }, E2E_ACTOR_GENIA);
  var rev2 = createRevision({ documentId: seeded.documentId, payload: { title: 'B' }, actor: E2E_ACTOR_GENIA });
  _testPatchDocument(seeded.documentId, { current_revision_id: rev2.revisionId });

  var restored = restoreRevision({ documentId: seeded.documentId, revisionId: seeded.revisionId, actor: E2E_ACTOR_GENIA });
  var doc = _testGetDocument(seeded.documentId);
  var rev3 = _testGetRevision(restored.newRevisionId);

  _testAssert(doc.current_revision_id === restored.newRevisionId,
    'current_revision_id should point to restored new revision');
  _testAssert(restored.newRevisionNumber === 3, 'expected restored revision #3, got ' + restored.newRevisionNumber);
  _testAssert(JSON.stringify(rev3.payload) === JSON.stringify({ title: 'A' }),
    'restored payload should equal v1 payload');
}

function testTransitionDraftToPending() {
  var docType = _testDocType('submit');
  _testSeedApprovalRule('rifim', docType, [E2E_ACTOR_GENIA, E2E_ACTOR_BOBBY], 'sequential');
  var seeded = _testSeedDocument('rifim', docType, _testTitle('TRANSITION'), { title: 'submit' }, E2E_ACTOR_GENIA);

  var result = transitionDocument({ documentId: seeded.documentId, action: 'submit', actor: E2E_ACTOR_GENIA });
  var doc = _testGetDocument(seeded.documentId);

  _testAssert(result.success === true, 'submit should succeed: ' + JSON.stringify(result));
  _testAssert(doc.status === 'pending_approval', "expected 'pending_approval', got '" + doc.status + "'");
}

function testSequentialApprovalHappyPath() {
  var docType = _testDocType('seq_happy');
  _testSeedApprovalRule('rifim', docType, [E2E_ACTOR_GENIA, E2E_ACTOR_BOBBY], 'sequential');
  var seeded = _testSeedDocument('rifim', docType, _testTitle('SEQ_HAPPY'), { title: 'seq happy' }, E2E_ACTOR_GENIA);
  _testPatchDocument(seeded.documentId, { status: 'pending_approval' });

  var out = createApprovals({ documentId: seeded.documentId, revisionId: seeded.revisionId, companySlug: 'rifim', docType: docType });
  var r1 = decideApproval({ approvalId: out.approvalIds[0], approverId: E2E_ACTOR_GENIA, decision: 'approved' });
  _testAssert(!!r1.nextApprovalId, 'nextApprovalId should be returned after first sequential approval');
  _testAssert(_testGetDocument(seeded.documentId).status === 'pending_approval', 'doc should stay pending after first approval');

  var r2 = decideApproval({ approvalId: out.approvalIds[1], approverId: E2E_ACTOR_BOBBY, decision: 'approved' });
  _testAssert(r2.documentStatus === 'approved', "expected documentStatus 'approved', got '" + r2.documentStatus + "'");
  _testAssert(_testGetDocument(seeded.documentId).status === 'approved', 'doc.status should be approved');
}

function testSequentialApprovalReject() {
  var docType = _testDocType('seq_reject');
  _testSeedApprovalRule('rifim', docType, [E2E_ACTOR_GENIA, E2E_ACTOR_BOBBY], 'sequential');
  var seeded = _testSeedDocument('rifim', docType, _testTitle('SEQ_REJECT'), { title: 'seq reject' }, E2E_ACTOR_GENIA);
  _testPatchDocument(seeded.documentId, { status: 'pending_approval' });

  var out = createApprovals({ documentId: seeded.documentId, revisionId: seeded.revisionId, companySlug: 'rifim', docType: docType });
  var rejected = decideApproval({ approvalId: out.approvalIds[0], approverId: E2E_ACTOR_GENIA, decision: 'rejected' });
  var remaining = _testGetApproval(out.approvalIds[1]);

  _testAssert(rejected.documentStatus === 'rejected', "expected 'rejected', got '" + rejected.documentStatus + "'");
  _testAssert(_testGetDocument(seeded.documentId).status === 'rejected', 'doc.status should be rejected');
  _testAssert(remaining.status === 'skipped', "remaining approval should be skipped, got '" + remaining.status + "'");
}

function testParallelApprovalHappyPath() {
  var docType = _testDocType('parallel_happy');
  _testSeedApprovalRule('rifim', docType, [E2E_ACTOR_GENIA, E2E_ACTOR_BOBBY], 'parallel');
  var seeded = _testSeedDocument('rifim', docType, _testTitle('PARALLEL'), { title: 'parallel' }, E2E_ACTOR_GENIA);
  _testPatchDocument(seeded.documentId, { status: 'pending_approval' });

  var out = createApprovals({ documentId: seeded.documentId, revisionId: seeded.revisionId, companySlug: 'rifim', docType: docType });
  decideApproval({ approvalId: out.approvalIds[0], approverId: E2E_ACTOR_GENIA, decision: 'approved' });
  _testAssert(_testGetDocument(seeded.documentId).status === 'pending_approval', 'parallel doc should stay pending until all approve');

  var r2 = decideApproval({ approvalId: out.approvalIds[1], approverId: E2E_ACTOR_BOBBY, decision: 'approved' });
  _testAssert(r2.documentStatus === 'approved', "expected 'approved', got '" + r2.documentStatus + "'");
  _testAssert(_testGetDocument(seeded.documentId).status === 'approved', 'parallel doc.status should be approved');
}

function testAuditChainIntegrity() {
  var result = verifyChain({ fromId: 1 });
  _testAssert(result.ok === true, 'audit chain should be ok: ' + JSON.stringify(result));
  _testAssert(result.brokenAt === null, 'brokenAt should be null: ' + JSON.stringify(result));
}

function testAuditLogFilter() {
  var rows = queryEvents({ entityType: 'document', limit: 20 });
  _testAssert(rows.length >= 5, 'expected >=5 document audit rows, got ' + rows.length);
}

function testInvalidTransitionBlocked() {
  var seeded = _testSeedDocument('rifim', 'invoice', _testTitle('INVALID_TRANSITION'), { title: 'invalid' }, E2E_ACTOR_GENIA);
  var result = transitionDocument({ documentId: seeded.documentId, action: 'sign', actor: E2E_ACTOR_SASIH });

  _testAssert(result.success === false, 'invalid transition should return success:false');
  _testAssert(/Transisi tidak valid/.test(result.error || ''), 'expected invalid transition error, got ' + JSON.stringify(result));
}

function testCleanup() {
  var docs = _sbGet(_testRestUrl('doc_documents', [
    'title=like.' + encodeURIComponent(E2E_TEST_PREFIX + '*'),
    'select=id',
    'limit=1000',
  ]));
  var docIds = docs.map(function (doc) { return doc.id; });

  if (docIds.length) {
    var idsFilter = 'in.(' + docIds.join(',') + ')';
    _testDelete('doc_approvals', 'document_id=' + idsFilter);
    _testPatch('doc_documents', 'id=' + idsFilter, { current_revision_id: null });
    _testDelete('doc_revisions', 'document_id=' + idsFilter);
    _testDelete('doc_documents', 'id=' + idsFilter);
  }

  _testDelete('doc_approval_rules', 'doc_type=like.' + encodeURIComponent('e2e_test_*'));
  Logger.log('✅ testCleanup removed ' + docIds.length + ' E2E document(s).');
  return { deletedDocuments: docIds.length };
}

function _testSeedDocument(companySlug, docType, title, payload, actor) {
  var documentId = Utilities.getUuid();
  var docNumber = 'E2E-' + new Date().getTime() + '-' + Math.floor(Math.random() * 100000);

  var now = new Date().toISOString();

  _sbPost('doc_documents', {
    id: documentId,
    title: title,
    doc_number: docNumber,
    company_slug: companySlug,
    doc_type: docType,
    status: 'draft',
    created_by: actor,
    created_at: now,
    updated_at: now,
  });

  var revision = createRevision({ documentId: documentId, payload: payload || {}, actor: actor });
  _testPatchDocument(documentId, { current_revision_id: revision.revisionId });

  _testLogDocumentCreated(documentId, title);
  return { documentId: documentId, revisionId: revision.revisionId };
}

function _testAssert(condition, msg) {
  if (!condition) throw new Error('assert failed: ' + msg);
  Logger.log('✅ assert: ' + msg);
}

function _testSeedApprovalRule(companySlug, docType, approvers, mode) {
  _testDelete('doc_approval_rules', 'company_slug=eq.' + encodeURIComponent(companySlug) + '&doc_type=eq.' + encodeURIComponent(docType));
  _sbPost('doc_approval_rules', { company_slug: companySlug, doc_type: docType, approvers: approvers, mode: mode, is_active: true });
}

function _testTitle(suffix) {
  return E2E_TEST_PREFIX + suffix + '_' + new Date().getTime() + '_' + Math.floor(Math.random() * 100000);
}

function _testDocType(suffix) {
  return 'e2e_test_' + suffix + '_' + new Date().getTime() + '_' + Math.floor(Math.random() * 100000);
}

function _testGetDocument(documentId) {
  var rows = _sbGet(_testRestUrl('doc_documents', [
    'id=eq.' + encodeURIComponent(documentId),
    'select=id,title,doc_number,company_slug,doc_type,status,current_revision_id,created_at',
    'limit=1',
  ]));
  if (!rows.length) throw new Error('document not found: ' + documentId);
  return rows[0];
}

function _testGetRevision(revisionId) {
  var rows = _sbGet(_testRestUrl('doc_revisions', [
    'id=eq.' + encodeURIComponent(revisionId),
    'select=id,document_id,revision_number,payload',
    'limit=1',
  ]));
  if (!rows.length) throw new Error('revision not found: ' + revisionId);
  return rows[0];
}

function _testGetApproval(approvalId) {
  var rows = _sbGet(_testRestUrl('doc_approvals', [
    'id=eq.' + encodeURIComponent(approvalId),
    'select=id,document_id,approver_id,status,order_index',
    'limit=1',
  ]));
  if (!rows.length) throw new Error('approval not found: ' + approvalId);
  return rows[0];
}

function _testPatchDocument(documentId, patch) {
  _sbPatch('doc_documents', 'id=eq.' + encodeURIComponent(documentId), patch);
}

function _testLogDocumentCreated(documentId, title) {
  _sbPost('rpc/doc_log_event', {
    p_entity_type: 'document',
    p_entity_id: documentId,
    p_action: 'e2e_created',
    p_payload: { title: title },
  });
}

function _testPatch(table, filter, data) {
  var cfg = _getSupabaseConfig();
  var url = cfg.url + '/rest/v1/' + table + '?' + filter;
  var res = UrlFetchApp.fetch(url, {
    method: 'PATCH',
    headers: _sbHeaders(cfg.key),
    payload: JSON.stringify(data),
    muteHttpExceptions: true,
  });
  _testCheckResponse(res, 'PATCH ' + table);
}

function _testDelete(table, filter) {
  var cfg = _getSupabaseConfig();
  var url = cfg.url + '/rest/v1/' + table + '?' + filter;
  var res = UrlFetchApp.fetch(url, { method: 'DELETE', headers: _sbHeaders(cfg.key), muteHttpExceptions: true });
  _testCheckResponse(res, 'DELETE ' + table);
}

function _testRestUrl(table, params) {
  var cfg = _getSupabaseConfig();
  return cfg.url + '/rest/v1/' + table + (params && params.length ? '?' + params.join('&') : '');
}

function _testCheckResponse(res, context) {
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error(context + ' — HTTP ' + code + ': ' + res.getContentText().substring(0, 200));
  }
}
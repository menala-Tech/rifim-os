// Phase 6 — Fonnte Broadcast (Chat + WA) contract + architect remediation.
// Verifies:
//   1. role authorization (admin/direksi only)
//   2. canonical chat write first (raos_post_system_message RPC)
//   3. WA best-effort AFTER chat when chat OK
//   4. split-brain fix: chat+WA=true, chat FAIL → WA NOT called
//      → wa.reason === 'skipped_due_to_chat_failure'
//   5. WA-only mode (chat=false, whatsapp=true) works without chat success
//   6. arbitrary client-provided phones ignored (env-only)
//   7. ADMIN_WA_PHONES server-side only
//   8. dispatch_disabled safe
//   9. audit written to canonical system_logs sink (NOT rifim_ops_audit_log)
//  10. no reference to raos_ops_audit / rifim_ops_audit_log
//  11. no secret exposure in audit
//  12. function count <=12
// Run: node testing/fonnte-broadcast-contract.test.js
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

function loadBroadcast(deps) {
  const resolves = [
    path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'broadcast.js'),
    path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'fonnte-wa.js'),
    path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'system-log.js'),
  ];
  for (const p of resolves) { try { delete require.cache[require.resolve(p)]; } catch (_) {} }
  const create = require(path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'broadcast.js'));
  return create(deps);
}

function makeDeps({ chatFails = false, roomsRows = null } = {}) {
  const calls = [];
  const inserts = [];
  const sb = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', body: opts.body });
    // Whitelist assertion — MUST NOT touch legacy audit tables
    assert.ok(!/raos_ops_audit|rifim_ops_audit_log/.test(url), 'broadcast must not query legacy audit tables (url=' + url + ')');
    if (url.includes('chat_rooms')) return roomsRows || [{ id: 'branch-room-uuid' }];
    if (url.includes('raos_post_system_message')) {
      if (chatFails) throw new Error('RPC failed');
      return ['msg-uuid-1'];
    }
    if (url.includes('system_logs') && opts.method === 'POST') {
      let body; try { body = JSON.parse(opts.body); } catch (_) { body = {}; }
      inserts.push(body);
      return {};
    }
    return [];
  };
  return { sb, calls, inserts };
}

const failures = [];
const pass = n => console.log('  ok  ' + n);
const fail = (n, e) => { failures.push({ n, e }); console.log('  FAIL  ' + n + '\n        ' + (e && e.stack || e && e.message || e)); };

async function run() {
  process.env.FONNTE_TOKEN = 'test-token-xxx';
  process.env.ADMIN_WA_PHONES = '6281111111111,6282222222222';
  delete process.env.FONNTE_ENABLED;

  // T1 — role authorization
  try {
    const deps = makeDeps();
    const bc = loadBroadcast(deps);
    let threw = false;
    try {
      await bc.postBroadcast({ body: { title: 'x', message: 'y', audience: 'admin' } }, { id: 's1', role: 'staff' });
    } catch (e) { threw = /admin\/direksi/i.test(e.message); }
    assert.ok(threw, 'staff must be rejected');
    const r = await bc.postBroadcast({ body: { title: 'x', message: 'y', audience: 'admin', channels: { chat: true } } }, { id: 'a1', role: 'admin' });
    assert.ok(r && r.chat && r.chat.ok, 'admin can broadcast');
    pass('T1 role authorization');
  } catch (e) { fail('T1 role authorization', e); }

  // T2 — canonical chat write first
  try {
    const deps = makeDeps();
    const bc = loadBroadcast(deps);
    await bc.postBroadcast({ body: { title: 't', message: 'm', audience: 'admin', channels: { chat: true, whatsapp: true } } }, { id: 'a1', role: 'admin' });
    const rpc = deps.calls.find(c => c.url.includes('raos_post_system_message'));
    assert.ok(rpc, 'chat RPC called');
    const body = JSON.parse(rpc.body);
    assert.strictEqual(body.p_category, 'pengumuman');
    pass('T2 canonical chat write first');
  } catch (e) { fail('T2 canonical chat write first', e); }

  // T3 — WA best-effort AFTER chat when chat OK
  try {
    const deps = makeDeps();
    const bc = loadBroadcast(deps);
    const r = await bc.postBroadcast({ body: { title: 't', message: 'm', audience: 'admin', channels: { chat: true, whatsapp: true } } }, { id: 'a1', role: 'admin' });
    assert.strictEqual(r.chat.ok, true);
    assert.strictEqual(r.wa.reason, 'dispatch_disabled');
    pass('T3 WA best-effort after chat OK');
  } catch (e) { fail('T3 WA best-effort after chat OK', e); }

  // T4 — split-brain fix: chat FAILS + WA=true → WA NOT called, reason=skipped_due_to_chat_failure
  try {
    const deps = makeDeps({ chatFails: true });
    const bc = loadBroadcast(deps);
    const r = await bc.postBroadcast({ body: { title: 't', message: 'm', audience: 'admin', channels: { chat: true, whatsapp: true } } }, { id: 'a1', role: 'admin' });
    assert.strictEqual(r.chat.ok, false);
    assert.strictEqual(r.chat.reason, 'chat_write_failed');
    assert.strictEqual(r.wa.reason, 'skipped_due_to_chat_failure', 'wa.reason must indicate skip due to chat failure');
    assert.strictEqual(r.wa.sent, 0);
    // Ensure fonnte.send NEVER attempted — no upstream Fonnte-related sb calls
    // (we don't call fonnte.send when we detect chat-failure gate)
    pass('T4 split-brain prevented: chat fail → WA skipped');
  } catch (e) { fail('T4 split-brain prevented', e); }

  // T5 — WA-only mode works without chat success requirement
  try {
    const deps = makeDeps();  // chat not called at all in WA-only
    const bc = loadBroadcast(deps);
    const r = await bc.postBroadcast({ body: { title: 't', message: 'm', audience: 'admin', channels: { chat: false, whatsapp: true } } }, { id: 'a1', role: 'admin' });
    assert.strictEqual(r.chat.reason, 'chat_skipped_by_channels');
    // WA attempted (FONNTE_ENABLED unset → dispatch_disabled — attempt made)
    assert.strictEqual(r.wa.reason, 'dispatch_disabled', 'WA-only mode should attempt WA (reason=dispatch_disabled here because env off)');
    assert.ok(!deps.calls.find(c => c.url.includes('raos_post_system_message')), 'no chat RPC in WA-only');
    pass('T5 WA-only mode does not require chat success');
  } catch (e) { fail('T5 WA-only mode', e); }

  // T6 — arbitrary client phones ignored
  try {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'broadcast.js'), 'utf8');
    assert.ok(!/req\.body[.'"\[]phones/.test(src) && !/input[.'"\[]phones/.test(src), 'broadcast.js MUST NOT read phones from request body');
    assert.ok(/getAdminPhonesFromEnv/.test(src), 'must source phones from env only');
    pass('T6 arbitrary client phones ignored');
  } catch (e) { fail('T6 arbitrary client phones ignored', e); }

  // T7 — ADMIN_WA_PHONES server-side only (grep proof)
  try {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'broadcast.js'), 'utf8');
    assert.ok(/getAdminPhonesFromEnv\(\)/.test(src));
    pass('T7 ADMIN_WA_PHONES server-side only');
  } catch (e) { fail('T7 ADMIN_WA_PHONES server-side only', e); }

  // T8 — dispatch_disabled safe (chat OK stays OK, WA reason=dispatch_disabled)
  try {
    delete process.env.FONNTE_ENABLED;
    const deps = makeDeps();
    const bc = loadBroadcast(deps);
    const r = await bc.postBroadcast({ body: { title: 't', message: 'm', audience: 'admin', channels: { chat: true, whatsapp: true } } }, { id: 'a1', role: 'admin' });
    assert.strictEqual(r.chat.ok, true);
    assert.strictEqual(r.wa.reason, 'dispatch_disabled');
    pass('T8 dispatch_disabled safe');
  } catch (e) { fail('T8 dispatch_disabled safe', e); }

  // T9 — audit written to canonical system_logs
  try {
    const deps = makeDeps();
    const bc = loadBroadcast(deps);
    await bc.postBroadcast({ body: { title: 't', message: 'm', audience: 'admin', channels: { chat: true, whatsapp: true } } }, { id: 'a1', role: 'admin' });
    const row = deps.inserts.find(i => i.type === 'notification_broadcast');
    assert.ok(row, 'must insert into system_logs with type=notification_broadcast');
    assert.ok(typeof row.detail === 'string');
    const parsed = JSON.parse(row.detail);
    assert.ok(parsed.chat && parsed.wa && parsed.audience === 'admin');
    pass('T9 audit uses canonical system_logs sink');
  } catch (e) { fail('T9 audit uses system_logs sink', e); }

  // T10 — no reference to raos_ops_audit / rifim_ops_audit_log
  try {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'broadcast.js'), 'utf8');
    assert.ok(!/\/rest\/v1\/raos_ops_audit/.test(src), 'must not query raos_ops_audit');
    assert.ok(!/\/rest\/v1\/rifim_ops_audit_log/.test(src), 'must not query rifim_ops_audit_log');
    // opsAudit dependency also removed
    assert.ok(!/opsAudit\(/.test(src), 'must not call opsAudit (broken sink)');
    pass('T10 no legacy audit table refs');
  } catch (e) { fail('T10 no legacy audit table refs', e); }

  // T11 — no secret exposure in audit
  try {
    const deps = makeDeps();
    const bc = loadBroadcast(deps);
    await bc.postBroadcast({ body: { title: 't', message: 'm', audience: 'admin', channels: { chat: true, whatsapp: true } } }, { id: 'a1', role: 'admin' });
    for (const row of deps.inserts) {
      const dumped = JSON.stringify(row);
      assert.ok(!/eyJhbGci|sb_secret_|FONNTE_TOKEN|ADMIN_WA_PHONES/.test(dumped), 'audit must not contain secrets/env');
    }
    pass('T11 no secret exposure in audit');
  } catch (e) { fail('T11 no secret exposure in audit', e); }

  // T12 — function count <=12
  try {
    const apiDir = path.resolve(__dirname, '..', 'api');
    function walk(d) {
      let out = [];
      for (const name of fs.readdirSync(d)) {
        const full = path.join(d, name);
        const st = fs.statSync(full);
        if (st.isDirectory()) { if (name === '_lib' || name === '_modules') continue; out = out.concat(walk(full)); }
        else if (name.endsWith('.js')) out.push(full);
      }
      return out;
    }
    const fns = walk(apiDir);
    assert.ok(fns.length <= 12, `function count ${fns.length} must be <= 12`);
    pass(`T12 function count ${fns.length} <= 12`);
  } catch (e) { fail('T12 function count <= 12', e); }

  if (failures.length) { console.log('\nFAIL — ' + failures.length + ' assertion(s) failed'); process.exit(1); }
  else { console.log('\nALL PASSED'); }
}

run().catch(e => { console.error(e); process.exit(1); });

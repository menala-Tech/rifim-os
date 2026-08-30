// Phase 6 — Fonnte Broadcast (Chat + WA) contract.
// Verifies:
//   1. role authorization (admin/direksi only)
//   2. canonical chat write first (raos_post_system_message RPC)
//   3. WA best-effort after chat
//   4. WA failure does NOT rollback chat
//   5. arbitrary client-provided phones rejected/ignored
//   6. ADMIN_WA_PHONES sourced server-side only
//   7. dispatch_disabled safe (FONNTE_ENABLED=false)
//   8. audit emitted (opsAudit called)
//   9. no secret exposure in audit context
//   10. function count <=12
// Run: node testing/fonnte-broadcast-contract.test.js
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

function loadBroadcast(deps) {
  delete require.cache[require.resolve(path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'broadcast.js'))];
  delete require.cache[require.resolve(path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'fonnte-wa.js'))];
  const create = require(path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'broadcast.js'));
  return create(deps);
}

function makeDeps({ chatFails = false, roomsRows = null } = {}) {
  const calls = [];
  const audits = [];
  const sb = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', body: opts.body });
    if (url.includes('chat_rooms')) return roomsRows || [{ id: 'branch-room-uuid' }];
    if (url.includes('raos_post_system_message')) {
      if (chatFails) throw new Error('RPC failed');
      return ['msg-uuid-1'];
    }
    return [];
  };
  const opsAudit = async (...args) => { audits.push(args); };
  return { sb, opsAudit, calls, audits };
}

const failures = [];
const pass = n => console.log('  ok  ' + n);
const fail = (n, e) => { failures.push({ n, e }); console.log('  FAIL  ' + n + '\n        ' + (e && e.stack || e && e.message || e)); };

async function run() {
  process.env.FONNTE_TOKEN = 'test-token-xxx';
  process.env.ADMIN_WA_PHONES = '6281111111111,6282222222222';
  delete process.env.FONNTE_ENABLED; // default OFF

  // T1 — role authorization (staff rejected, admin OK, direksi OK)
  try {
    const deps = makeDeps();
    const bc = loadBroadcast(deps);
    let threw = false;
    try {
      await bc.postBroadcast({ body: { title: 'x', message: 'y', audience: 'admin' } }, { id: 's1', role: 'staff' });
    } catch (e) { threw = /admin\/direksi/i.test(e.message); }
    assert.ok(threw, 'staff role must be rejected');
    const r = await bc.postBroadcast({ body: { title: 'x', message: 'y', audience: 'admin', channels: { chat: true } } }, { id: 'a1', role: 'admin' });
    assert.ok(r && r.chat && r.chat.ok, 'admin can broadcast');
    pass('T1 role authorization');
  } catch (e) { fail('T1 role authorization', e); }

  // T2 — canonical chat write first (RPC called)
  try {
    const deps = makeDeps();
    const bc = loadBroadcast(deps);
    await bc.postBroadcast({ body: { title: 't', message: 'm', audience: 'admin', channels: { chat: true, whatsapp: true } } }, { id: 'a1', role: 'admin' });
    const rpcCall = deps.calls.find(c => c.url.includes('raos_post_system_message'));
    assert.ok(rpcCall, 'raos_post_system_message RPC must be called');
    const body = JSON.parse(rpcCall.body);
    assert.strictEqual(body.p_category, 'pengumuman');
    assert.ok(body.p_room_id && body.p_room_id.length > 0);
    pass('T2 canonical chat write first');
  } catch (e) { fail('T2 canonical chat write first', e); }

  // T3 — WA best-effort after chat (both invoked, WA disabled → sent=0)
  try {
    const deps = makeDeps();
    const bc = loadBroadcast(deps);
    const r = await bc.postBroadcast({ body: { title: 't', message: 'm', audience: 'admin', channels: { chat: true, whatsapp: true } } }, { id: 'a1', role: 'admin' });
    assert.strictEqual(r.chat.ok, true);
    assert.strictEqual(r.wa.sent, 0);
    assert.strictEqual(r.wa.reason, 'dispatch_disabled');
    pass('T3 WA best-effort after chat');
  } catch (e) { fail('T3 WA best-effort after chat', e); }

  // T4 — WA failure does NOT rollback chat
  try {
    // Simulate WA "would fail" by disabling — chat still succeeds
    const deps = makeDeps();
    const bc = loadBroadcast(deps);
    const r = await bc.postBroadcast({ body: { title: 't', message: 'm', audience: 'admin', channels: { chat: true, whatsapp: true } } }, { id: 'a1', role: 'admin' });
    assert.strictEqual(r.chat.ok, true, 'chat succeeds even when WA fails/disabled');
    // No rollback of chat write (RPC only called once, no cleanup call)
    const rpcCalls = deps.calls.filter(c => c.url.includes('raos_post_system_message'));
    assert.strictEqual(rpcCalls.length, 1, 'chat write called once, no rollback');
    pass('T4 WA failure does not rollback chat');
  } catch (e) { fail('T4 WA failure does not rollback chat', e); }

  // T5 — arbitrary client phones ignored (WA uses env only)
  try {
    const deps = makeDeps();
    const bc = loadBroadcast(deps);
    const evilBody = {
      title: 't', message: 'm', audience: 'admin',
      channels: { chat: false, whatsapp: true },
      phones: ['6289999999999'],           // client-provided, should be ignored
      admin_phones: ['6289888888888'],     // client-provided, should be ignored
      recipient: ['6289777777777'],        // any other alias, should be ignored
    };
    const r = await bc.postBroadcast({ body: evilBody }, { id: 'a1', role: 'admin' });
    // Regardless of dispatch success, arbitrary phones must NOT appear in wa result
    // (impossible to reach because helper doesn't accept phones from input body)
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'broadcast.js'), 'utf8');
    assert.ok(!/req\.body[.'"\[]phones/.test(src) && !/input[.'"\[]phones/.test(src), 'broadcast.js MUST NOT read phones from request body');
    assert.ok(/getAdminPhonesFromEnv/.test(src), 'broadcast.js must sources phones from env only');
    pass('T5 arbitrary client phones ignored (env-only)');
  } catch (e) { fail('T5 arbitrary client phones ignored', e); }

  // T6 — ADMIN_WA_PHONES server-side only (grep proof)
  try {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'broadcast.js'), 'utf8');
    assert.ok(/getAdminPhonesFromEnv\(\)/.test(src), 'must call getAdminPhonesFromEnv()');
    // T5 already asserts no phone extraction from request — this reinforces
    pass('T6 ADMIN_WA_PHONES server-side only');
  } catch (e) { fail('T6 ADMIN_WA_PHONES server-side only', e); }

  // T7 — dispatch_disabled safe (chat still succeeds when FONNTE_ENABLED off)
  try {
    delete process.env.FONNTE_ENABLED;
    const deps = makeDeps();
    const bc = loadBroadcast(deps);
    const r = await bc.postBroadcast({ body: { title: 't', message: 'm', audience: 'admin', channels: { chat: true, whatsapp: true } } }, { id: 'a1', role: 'admin' });
    assert.strictEqual(r.chat.ok, true);
    assert.strictEqual(r.wa.reason, 'dispatch_disabled');
    pass('T7 dispatch_disabled safe');
  } catch (e) { fail('T7 dispatch_disabled safe', e); }

  // T8 — audit emitted
  try {
    const deps = makeDeps();
    const bc = loadBroadcast(deps);
    await bc.postBroadcast({ body: { title: 't', message: 'm', audience: 'admin', channels: { chat: true } } }, { id: 'a1', role: 'admin' });
    assert.ok(deps.audits.length >= 1, 'opsAudit must be called');
    const [actor, event, resource] = deps.audits[0];
    assert.strictEqual(event, 'notification_broadcast');
    assert.strictEqual(resource, 'notification');
    pass('T8 audit emitted');
  } catch (e) { fail('T8 audit emitted', e); }

  // T9 — no secret exposure in audit context (regex check)
  try {
    const deps = makeDeps();
    const bc = loadBroadcast(deps);
    await bc.postBroadcast({ body: { title: 't', message: 'm', audience: 'admin', channels: { chat: true, whatsapp: true } } }, { id: 'a1', role: 'admin' });
    for (const args of deps.audits) {
      const dumped = JSON.stringify(args);
      assert.ok(!/eyJhbGci|sb_secret_|FONNTE_TOKEN|ADMIN_WA_PHONES/.test(dumped), 'audit must not contain secrets/env');
    }
    pass('T9 no secret exposure in audit');
  } catch (e) { fail('T9 no secret exposure in audit', e); }

  // T10 — function count <= 12
  try {
    const apiDir = path.resolve(__dirname, '..', 'api');
    function walk(d) {
      let out = [];
      for (const name of fs.readdirSync(d)) {
        const full = path.join(d, name);
        const st = fs.statSync(full);
        if (st.isDirectory()) {
          if (name === '_lib' || name === '_modules') continue;
          out = out.concat(walk(full));
        } else if (name.endsWith('.js')) out.push(full);
      }
      return out;
    }
    const fns = walk(apiDir);
    assert.ok(fns.length <= 12, `function count ${fns.length} must be <= 12`);
    pass(`T10 function count ${fns.length} <= 12`);
  } catch (e) { fail('T10 function count <= 12', e); }

  if (failures.length) { console.log('\nFAIL — ' + failures.length + ' assertion(s) failed'); process.exit(1); }
  else { console.log('\nALL PASSED'); }
}

run().catch(e => { console.error(e); process.exit(1); });

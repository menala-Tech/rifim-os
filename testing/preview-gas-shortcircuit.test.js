// Hotfix 2026-08-29 (R5 final): Production GAS is unreachable from Vercel
// Preview because Preview issues QA Supabase JWT while GAS validates against
// Production Supabase. This suite locks in the Preview short-circuit contract
// of shared/gas-call.js so callers (CRM, Finance) render a neutral
// "Fitur GAS tidak tersedia di Preview QA" notice instead of the red
// "Session tidak valid atau kedaluwarsa" error.
//
// Run: node testing/preview-gas-shortcircuit.test.js

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'shared', 'gas-call.js'), 'utf8');

function makeWindow(opts = {}) {
  const win = {
    location: { hostname: opts.hostname || 'rifim-os.vercel.app' },
    localStorage: { getItem: () => null, setItem: () => {} },
    RifimPortalSession: opts.portalSession || null,
  };
  return win;
}

function run(opts, action, extra, rifimApi, fetchImpl) {
  const win = makeWindow(opts);
  if (rifimApi) win.RifimAPI = rifimApi;
  if (fetchImpl) win.fetch = fetchImpl;
  win.document = undefined;
  win.addEventListener = () => {};
  const ctx = { window: win, globalThis: win };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { timeout: 1000 });
  if (typeof win._gasCall !== 'function') {
    throw new Error('_gasCall not installed on window');
  }
  const done = (async () => {
    const res = await win._gasCall(action, extra || {});
    return res;
  })();
  return { win, promise: done };
}

const PREVIEW_HOSTS = [
  'rifim-os-git-fix-foo.vercel.app',
  'rifim-os-foo.vercel.app',
  'rifim-os-preview.vercel.app',
];

async function main() {
  const failures = [];
  const pass = n => console.log('  ok  ' + n);
  const fail = (n, e) => { failures.push({ n, e }); console.log('  FAIL  ' + n + '\n        ' + (e && e.message || e)); };

  try {
    for (const h of PREVIEW_HOSTS) {
      const { promise } = run({ hostname: h }, 'company_config_list', {}, { get() { throw new Error('RifimAPI should not be called in Preview'); } });
      const data = await promise;
      assert.strictEqual(data.success, false, 'success must be false in Preview');
      assert.strictEqual(data.code, 'PREVIEW_GAS_UNAVAILABLE', 'code must be PREVIEW_GAS_UNAVAILABLE');
      assert.strictEqual(data.preview_notice, true, 'preview_notice must be true');
      assert.ok(String(data.message || '').includes('tidak tersedia'), 'message must say unavailable');
    }
    pass('T1: _gasCall short-circuits for all Vercel Preview hosts');
  } catch (e) { fail('T1: _gasCall short-circuits for all Vercel Preview hosts', e); }

  try {
    const { win, promise } = run({ hostname: 'some-other-preview.vercel.app' }, 'contacts_list', { user: 'a@b.com' });
    const data = await promise;
    // No fetch/RifimAPI should have been attempted; if they were, the test would error.
    assert.deepStrictEqual(Object.keys(data).sort(), ['code', 'message', 'preview_notice', 'success']);
    pass('T2: PREVIEW_GAS_UNAVAILABLE response shape is fixed and stable');
  } catch (e) { fail('T2: PREVIEW_GAS_UNAVAILABLE response shape is fixed and stable', e); }

  try {
    const calls = [];
    const rifimApi = { get: (action, params) => { calls.push({ action, params }); return Promise.resolve({ success: true, rows: [] }); } };
    const { promise } = run({ hostname: 'rifim-os.vercel.app' }, 'finance_list', { limit: 200 }, rifimApi);
    const data = await promise;
    assert.strictEqual(data.success, true, 'Production still gets real data');
    assert.strictEqual(calls.length, 1, 'RifimAPI.get called once on Production');
    assert.strictEqual(calls[0].action, 'finance_list');
    pass('T3: Production host still routes to RifimAPI.get (Finance dashboard)');
  } catch (e) { fail('T3: Production host still routes to RifimAPI.get (Finance dashboard)', e); }

  try {
    const rifimApi = { get: () => Promise.resolve({ success: false, message: 'Session tidak valid atau kedaluwarsa' }) };
    const { promise } = run({ hostname: 'rifim-os.vercel.app' }, 'crm_audit_tail', { user: 'a@b.com' }, rifimApi);
    const data = await promise;
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, undefined, 'must NOT inject PREVIEW_GAS_UNAVAILABLE on real Production failure');
    assert.strictEqual(data.preview_notice, undefined, 'must NOT set preview_notice on real Production failure');
    assert.ok(String(data.message || '').indexOf('tidak tersedia') === -1, 'message must be from GAS, not Preview notice');
    pass('T4: Production GAS auth failure still fails closed without preview_notice');
  } catch (e) { fail('T4: Production GAS auth failure still fails closed without preview_notice', e); }

  try {
    const rifimApi = { get: () => { throw new Error('network down'); } };
    const { promise } = run({ hostname: 'rifim-os.vercel.app' }, 'raos_users_list', { user: 'a@b.com' }, rifimApi);
    const data = await promise;
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.preview_notice, undefined);
    pass('T5: Production transport error does NOT become a Preview notice');
  } catch (e) { fail('T5: Production transport error does NOT become a Preview notice', e); }

  try {
    const calls = [];
    const rifimApi = { post: (body) => { calls.push(body); return Promise.resolve({ success: true }); } };
    const { promise } = run({ hostname: 'rifim-os.vercel.app' }, 'company_config_set', { key: 'x', value: '1' }, rifimApi);
    const data = await promise;
    assert.strictEqual(data.success, true);
    assert.strictEqual(calls.length, 1, 'mutations on Production go to RifimAPI.post');
    pass('T6: Production mutations still go through RifimAPI.post');
  } catch (e) { fail('T6: Production mutations still go through RifimAPI.post', e); }

  try {
    // This simulates a Supabase-backed Preview request that does NOT use _gasCall.
    // _gasCall only wraps GAS, so any direct fetch to Vercel hris-contracts is
    // not short-circuited and must remain unaffected by this hotfix.
    const otherFetch = { direct: true };
    const { promise } = run({ hostname: 'rifim-os-git-foo.vercel.app' }, 'direct_supabase_action', {}, null, () => otherFetch);
    const data = await promise;
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, 'PREVIEW_GAS_UNAVAILABLE');
    pass('T7: _gasCall short-circuits unknown actions too (fails closed in Preview)');
  } catch (e) { fail('T7: _gasCall short-circuits unknown actions too (fails closed in Preview)', e); }

  try {
    // RifimPortalSession.config.isPreview wins over hostname heuristic.
    const rifimApi = { get: () => Promise.resolve({ success: true }) };
    const { promise } = run({
      hostname: 'rifim-os-git-foo.vercel.app',
      portalSession: { config: { isPreview: false } }
    }, 'company_config_list', { user: 'a@b.com' }, rifimApi);
    const data = await promise;
    assert.strictEqual(data.success, true, 'Portal isPreview=false overrides hostname');
    pass('T8: RifimPortalSession.config.isPreview can force Production behavior');
  } catch (e) { fail('T8: RifimPortalSession.config.isPreview can force Production behavior', e); }

  console.log('\n' + (failures.length ? 'FAILED ' + failures.length : 'ALL PASSED'));
  process.exit(failures.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });

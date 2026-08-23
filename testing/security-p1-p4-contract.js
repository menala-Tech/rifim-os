const assert = require('assert');
const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const migration = read('supabase/migrations/20260824120000_rifim_security_p1_p4.sql');
const portal = read('modules/portal/index.html');
const securePortal = read('modules/portal/secure.html');
const crm = read('modules/crm/index.html');
const gasProxy = read('shared/gas-fetch-proxy.js');
const financeRouter = read('shared/finance-data-router.js');
const finance = read('modules/finance/index.html');

assert.match(portal, /functions\.invoke\('raos-login-exchange'/, 'legacy portal must use login exchange');
assert.doesNotMatch(portal, /sb\.rpc\('raos_verify_and_bridge'/, 'legacy portal must not call legacy RPC directly');
assert.match(migration, /revoke execute on function public\.raos_verify_and_bridge\(text, text\) from anon;/i);
assert.match(migration, /revoke execute on function public\.raos_verify_and_bridge\(text, text\) from authenticated;/i);
assert.match(migration, /grant execute on function public\.raos_verify_and_bridge\(text, text\) to service_role;/i);
assert.doesNotMatch(portal + securePortal + migration, /console\.(log|warn|error)\([^)]*(pin|password|access_token|refresh_token|service_role)/i);

assert.match(crm, /allowedRoles:\s*\['admin','management','direksi'\]/, 'CRM module gate must exclude koordinator');
assert.doesNotMatch(crm, /allowedRoles:\s*\[[^\]]*koordinator/, 'CRM direct gate must not allow koordinator');
assert.match(portal, /data-module="crm"[^>]*data-roles="admin,direksi,management"[^>]*goTo\('\/crm'\)/, 'legacy portal CRM card must be role-scoped');
assert.match(securePortal, /data-path="\/crm"[^>]*data-roles="admin,direksi,management"/, 'secure portal CRM card must be role-scoped');

assert.doesNotMatch(gasProxy, /nativeFetch\(originalUrl|directInit|fallbackCount|browser-auth-fallback/i, 'GAS proxy wrapper must not silently fall back to direct browser GAS fetch');
assert.match(gasProxy, /version:\s*'2\.2\.0-server-proxy-only'/, 'GAS proxy wrapper must advertise server-proxy-only behavior');
assert.match(financeRouter, /apiPost\('finance_legacy_gas'/, 'Finance legacy reads must stay routed through internal API');
assert.match(finance, /Finance data router belum aktif/, 'Finance fallback _gasCall must remain fail-closed for legacy reads');

[
  'aist_refresh_invoice_for_request_id\\(uuid\\)',
  'aist_invoice_refresh_job_trigger\\(\\)',
  'aist_invoice_refresh_saldo_trigger\\(\\)',
].forEach((signature) => {
  const re = new RegExp(`revoke execute on function public\\.${signature} from (public|anon|authenticated);`, 'ig');
  const roles = Array.from(migration.matchAll(re)).map((m) => m[1].toLowerCase()).sort();
  assert.deepStrictEqual(roles, ['anon', 'authenticated', 'public'], `${signature} must revoke public client roles`);
  assert.match(migration, new RegExp(`grant execute on function public\\.${signature} to service_role;`, 'i'), `${signature} must preserve service_role`);
});

console.log('security-p1-p4-contract: PASS');

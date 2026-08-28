/**
 * NAMING NOTE (2026-08-18 audit): this file is named hris-contracts.js but
 * has grown into the shared backend for HRIS contracts AND Finance
 * (saldo, KPI targets, payroll compute, driver assignment). Documenting the
 * full endpoint list here so a future grep for e.g. "finance_saldo_mark_paid"
 * finds this file even though the filename doesn't suggest it — before
 * adding a new endpoint, check this list first to avoid creating a
 * duplicate route elsewhere for logic that already lives here.
 *
 * GET  ?mode=<omitted>                    -> listContracts (HRIS contracts)
 * POST ?mode=validate                     -> validateContract
 * GET  ?mode=finance_saldo_list            -> listSaldo
 * POST ?mode=finance_saldo_mark_paid       -> markSaldo
 * GET  ?mode=finance_branches              -> listFinanceBranches
 * GET  ?mode=finance_branch_targets        -> listBranchTargets
 * POST ?mode=finance_branch_target_upsert  -> upsertBranchTarget
 * GET  ?mode=finance_staff_targets         -> listStaffTargets
 * POST ?mode=finance_staff_target_upsert   -> upsertStaffTarget
 * POST ?mode=finance_payroll_compute       -> computePayroll
 * GET  ?mode=finance_drivers               -> listDrivers
 * POST ?mode=finance_driver_assign         -> assignDrivers
 * POST ?mode=finance_legacy_gas             -> financeLegacyGas (P0.4 2026-08-18)
 * POST ?mode=finance_tagihan_add            -> financeTagihan
 * POST ?mode=finance_tagihan_mark_paid      -> financeTagihan
 */
function env(n){return String(process.env[n]||'').trim()}
async function read(res){const t=await res.text();try{return t?JSON.parse(t):{}}catch(_){return{message:t||`HTTP ${res.status}`}}}
function out(res,s,b){res.status(s).setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(b))}
const crypto=require('crypto');
function q(v){return encodeURIComponent(String(v==null?'':v))}
const AIST_HANDOFF_TTL_MS=10*60*1000;
function aistSecret(){
  const s=env('AIST_HANDOFF_SECRET');
  if(!s) throw new Error('AIST_HANDOFF_SECRET missing');
  return s;
}
function b64uEncode(b){return b.toString('base64url').replace(/=+$/,'')}
function b64uDecode(s){return Buffer.from(String(s).replace(/-/g,'+').replace(/_/g,'/') + '=='.slice(0,(4 - String(s).length % 4) % 4),'base64')}
function issueAistHandoff(){
  const secret=aistSecret(); if(!secret) throw new Error('AIST handoff secret missing');
  const exp=Date.now()+AIST_HANDOFF_TTL_MS;
  const nonce=b64uEncode(crypto.randomBytes(16));
  const p={exp,scope:'aist_queue_read',nonce};
  const body=JSON.stringify(p);
  const sig=b64uEncode(crypto.createHmac('sha256',secret).update(body).digest());
  const token=b64uEncode(Buffer.from(JSON.stringify({p,s:sig})));
  return {token,expires_at:new Date(exp).toISOString(),scope:p.scope};
}
function verifyAistHandoff(token){
  const secret=aistSecret(); if(!secret) throw new Error('AIST handoff secret missing');
  try{
    const raw=JSON.parse(b64uDecode(token).toString('utf8'));
    if(!raw||!raw.p||!raw.s) throw new Error('token format invalid');
    const p=raw.p;
    if(typeof p.exp!=='number'||p.exp<Date.now()) throw new Error('token expired');
    if(p.scope!=='aist_queue_read') throw new Error('token scope invalid');
    const body=JSON.stringify(p);
    const sig=b64uEncode(crypto.createHmac('sha256',secret).update(body).digest());
    if(sig!==raw.s) throw new Error('token signature invalid');
    return p;
  }catch(e){ throw new Error('token invalid: '+(e.message||e)); }
}
function aistQueueToken(req){
  const q=req.query||{}, b=req.body||{};
  return String(q.t||b.t||req.headers['x-aist-handoff']||'').trim();
}

function roleOf(v){v=String(v||'').toLowerCase();return v==='direktur'?'direksi':v==='koord'?'koordinator':v==='mgmt'?'management':v}
function monthDate(v){const s=String(v||'').trim();if(/^\d{4}-\d{2}$/.test(s))return s+'-01';if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s.slice(0,7)+'-01';const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`}
function monthNext(start){const y=+start.slice(0,4),m=+start.slice(5,7);const n=m===12?1:m+1,ny=n===1?y+1:y;return `${ny}-${String(n).padStart(2,'0')}-01`}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d}
function financeRead(p){if(!['admin','direksi','management'].includes(p.role))throw new Error('Role tidak boleh melihat Finance')}
function financeWrite(p){if(!['admin','direksi'].includes(p.role))throw new Error('Hanya Admin/Direksi boleh mengubah Finance')}
async function sb(path,opts={}){const url=env('SUPABASE_URL'),svc=env('SUPABASE_SERVICE_ROLE_KEY');if(!url||!svc)throw new Error('Supabase server env missing');const r=await fetch(url+path,{...opts,headers:{apikey:svc,Authorization:`Bearer ${svc}`,'Content-Type':'application/json',...(opts.headers||{})}});const b=await read(r);if(!r.ok)throw new Error(b.message||b.error||`Supabase HTTP ${r.status}`);return b}
async function actor(req){const url=env('SUPABASE_URL'),pub=env('SUPABASE_PUBLISHABLE_KEY'),bearer=String(req.headers.authorization||'');if(!url||!pub)throw new Error('Supabase server env missing');if(!bearer.startsWith('Bearer '))throw new Error('Session required');const ur=await fetch(`${url}/auth/v1/user`,{headers:{apikey:pub,Authorization:bearer}}),u=await read(ur);if(!ur.ok||!u?.id)throw new Error('Session invalid');const rows=await sb(`/rest/v1/user_profiles?id=eq.${q(u.id)}&select=id,role,branch_id,is_active&limit=1`),p=rows?.[0];if(!p?.is_active)throw new Error('Profil tidak aktif');p.role=roleOf(p.role);return p}
// P0 round 2 fix (2026-08-20): some RPCs (raos_saldo_mark_paid) gate on
// `auth.uid() = p_processor_id`, which only resolves when Postgres sees the
// CALLING USER's own JWT -- not the service_role key that sb() always sends.
// sbAsActor() re-issues the request with the actor's own already-verified
// Bearer token (never decoded/trusted client-side; actor() above already
// validated it against /auth/v1/user before any caller reaches this) and the
// publishable key as apikey, so PostgREST/PL-pgSQL's auth.uid() resolves to
// the real caller instead of NULL. Use this ONLY for RPCs that specifically
// need the caller's own identity in auth.uid(); sb() (service_role) remains
// the default for everything else in this file.
async function sbAsActor(path,opts={},bearer){const url=env('SUPABASE_URL'),pub=env('SUPABASE_PUBLISHABLE_KEY');if(!url||!pub)throw new Error('Supabase server env missing');if(!String(bearer||'').startsWith('Bearer '))throw new Error('Session required');const r=await fetch(url+path,{...opts,headers:{apikey:pub,Authorization:bearer,'Content-Type':'application/json',...(opts.headers||{})}});const b=await read(r);if(!r.ok)throw new Error(b.message||b.error||`Supabase HTTP ${r.status}`);return b}

// HRIS contract API (existing canonical behavior)
async function listContracts(req,p){if(!['admin','direksi','management','koordinator'].includes(p.role))throw new Error('Role tidak boleh melihat Kontrak');let path='/rest/v1/hris_contract_employee_view?select=*&order=updated_at.desc&limit=1000';const employeeId=String(req.query.employee_id||'').trim();if(employeeId)path+=`&employee_id=eq.${q(employeeId)}`;let rows=await sb(path);if(p.role==='koordinator'){const prof=await sb(`/rest/v1/user_profiles?branch_id=eq.${q(p.branch_id||'')}&is_active=eq.true&select=staff_id`);const allowed=new Set((prof||[]).map(x=>String(x.staff_id||'').toUpperCase()).filter(Boolean));rows=(rows||[]).filter(x=>allowed.has(String(x.employee_id||'').toUpperCase()))}return rows||[]}
async function validateContract(req,p){if(!['admin','direksi'].includes(p.role))throw new Error('Hanya Admin/Direksi boleh validasi kontrak');const id=String(req.body?.contract_id||'').trim();if(!id)throw new Error('contract_id wajib');return await sb('/rest/v1/rpc/hris_validate_contract',{method:'POST',body:JSON.stringify({p_contract_id:id})})}

// Finance / RAOS canonical direct reads
async function listSaldo(req,p){financeRead(p);let path='/rest/v1/raos_saldo_requests?is_archived=eq.false&select=id,request_no,staff_id,branch_id,nominal,status,requested_at,created_at,is_processed,processed_at,driver_id,driver_login_id,driver_name,client_id,is_archived,archived_at&order=created_at.desc&limit=500';const status=String(req.query.status||'').trim().toLowerCase();if(status&&status!=='all'){if(['paid','processed','lunas'].includes(status))path+='&is_processed=eq.true';else if(['unprocessed','belum_lunas'].includes(status))path+='&is_processed=eq.false';else path+=`&status=eq.${q(status)}`}const rows=await sb(path);const staffIds=[...new Set((rows||[]).map(x=>x.staff_id).filter(Boolean))],branchIds=[...new Set((rows||[]).map(x=>x.branch_id).filter(Boolean))];let prof=[],branches=[];if(staffIds.length)prof=await sb(`/rest/v1/user_profiles?id=in.(${staffIds.map(q).join(',')})&select=id,full_name,staff_id`);if(branchIds.length)branches=await sb(`/rest/v1/branches?id=in.(${branchIds.map(q).join(',')})&select=id,name,slug`);const pm=Object.fromEntries((prof||[]).map(x=>[String(x.id),x])),bm=Object.fromEntries((branches||[]).map(x=>[String(x.id),x]));return (rows||[]).map(r=>{const s=pm[String(r.staff_id)]||{},b=bm[String(r.branch_id)]||{};return{...r,staff_name:s.full_name||'',staff_code:s.staff_id||'',branch_name:b.name||b.slug||''}})}
async function markSaldo(req,p){financeWrite(p);const id=String(req.body?.id||req.body?.request_id||'').trim();if(!id)throw new Error('id wajib');return await sbAsActor('/rest/v1/rpc/raos_saldo_mark_paid',{method:'POST',body:JSON.stringify({p_request_id:id,p_processor_id:p.id})},String(req.headers.authorization||''))}

async function listFinanceBranches(req,p){financeRead(p);return await sb('/rest/v1/branches?is_active=eq.true&parent_branch_id=is.null&select=id,code,name,slug,branch_type&order=name.asc')}

async function listBranchTargets(req,p){
  financeRead(p);
  const month=monthDate(req.query.month);
  const [branches,targets,roster]=await Promise.all([
    sb('/rest/v1/branches?is_active=eq.true&parent_branch_id=is.null&select=id,code,name,slug,branch_type&order=name.asc'),
    sb(`/rest/v1/raos_kpi_targets_branch?effective_month=eq.${month}&select=branch_id,effective_month,target_cabang,target_staff_default,mode,updated_at`),
    sb('/rest/v1/raos_hris_target_branch_roster?select=branch_id,branch_name,active_target_people,ready_people,sync_issue_people')
  ]);
  const tm=Object.fromEntries((targets||[]).map(x=>[String(x.branch_id),x]));
  const rm=Object.fromEntries((roster||[]).map(x=>[String(x.branch_id),x]));
  return (branches||[]).map(b=>{
    const t=tm[String(b.id)]||{},r=rm[String(b.id)]||{};
    const staffCount=num(r.ready_people||r.active_target_people,0);
    const targetCabang=t.target_cabang==null?0:num(t.target_cabang);
    // Canonical equal-share rule: CEIL, matching RAOS saldo/order KPI snapshots.
    const auto=t.target_staff_default==null&&staffCount>0?Math.ceil(targetCabang/staffCount):null;
    const effective=t.target_staff_default==null?auto:num(t.target_staff_default);
    const mode=t.mode||((/soekarno|makassar|soeta/i.test(String(b.name)+' '+String(b.code)))?'order':'saldo');
    return {branch_id:b.id,branch_code:b.code,branch_name:b.name,branch_slug:b.slug,mode,target_cabang:targetCabang,target_staff_default:t.target_staff_default==null?null:num(t.target_staff_default),target_staff_auto_prorated:auto,target_staff_effective:effective,staff_count:staffCount,sync_issue_people:num(r.sync_issue_people,0),is_excluded_saldo:mode==='order',updated_at:t.updated_at||null,effective_month:month};
  });
}

async function upsertBranchTarget(req,p){
  financeWrite(p);
  const branchId=String(req.body?.branch_id||'').trim(),month=monthDate(req.body?.month);
  if(!branchId)throw new Error('branch_id wajib');
  const mode=String(req.body?.mode||'saldo').toLowerCase();if(!['saldo','order'].includes(mode))throw new Error('mode tidak valid');
  const rawDefault=req.body?.target_staff_default;
  const payload={branch_id:branchId,effective_month:month,target_cabang:num(req.body?.target_cabang,0),target_staff_default:rawDefault===''||rawDefault==null?null:num(rawDefault),mode,created_by:p.id,updated_at:new Date().toISOString()};
  const rows=await sb('/rest/v1/raos_kpi_targets_branch?on_conflict=branch_id,effective_month',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(payload)});
  return rows?.[0]||payload;
}

async function listStaffTargets(req,p){
  financeRead(p);
  const month=monthDate(req.query.month),branchId=String(req.query.branch_id||'').trim();
  let rosterPath='/rest/v1/raos_hris_target_roster?sync_status=eq.ready&select=employee_uuid,employee_id,full_name,position,salary_base,user_id,system_role,branch_id,branch_name,resolved_role,sync_status&order=branch_name.asc,full_name.asc';
  if(branchId)rosterPath+=`&branch_id=eq.${q(branchId)}`;
  let roster=await sb(rosterPath);
  roster=(roster||[]).filter(r=>r.user_id&&['staff','koordinator'].includes(roleOf(r.resolved_role||r.system_role)));
  const [branchTargets,staffTargets,realisasi,payroll,scans]=await Promise.all([
    sb(`/rest/v1/raos_kpi_targets_branch?effective_month=eq.${month}&select=branch_id,target_cabang,target_staff_default,mode`),
    sb(`/rest/v1/raos_kpi_targets_staff?effective_month=eq.${month}&select=staff_id,target_saldo,target_order,member_parkir_amount,updated_at`),
    sb(`/rest/v1/raos_target_tercapai_bulan?effective_month=eq.${month}&select=staff_id,realisasi_saldo`),
    sb(`/rest/v1/raos_payroll?effective_month=eq.${month}&select=staff_id,gapok,bonus_saldo,bpjs,paket_data,member_parkir,bonus_kpi,target_pct,driver_active_pct,status_target,late_deduction_total,thp,computed_at`),
    sb(`/rest/v1/scan_orders?status=eq.valid&scanned_at=gte.${q(month)}&scanned_at=lt.${q(monthNext(month))}&select=staff_id`)
  ]);
  const bm=Object.fromEntries((branchTargets||[]).map(x=>[String(x.branch_id),x]));
  const sm=Object.fromEntries((staffTargets||[]).map(x=>[String(x.staff_id),x]));
  const rm=Object.fromEntries((realisasi||[]).map(x=>[String(x.staff_id),x]));
  const pm=Object.fromEntries((payroll||[]).map(x=>[String(x.staff_id),x]));
  const scanCounts={};for(const s of (scans||[])){if(!s?.staff_id)continue;const sid2=String(s.staff_id);scanCounts[sid2]=(scanCounts[sid2]||0)+1;}
  const counts={};for(const r of roster)counts[String(r.branch_id)]=(counts[String(r.branch_id)]||0)+1;
  return roster.map(r=>{
    const sid=String(r.user_id),bt=bm[String(r.branch_id)]||{},st=sm[sid]||{},real=rm[sid]||{},pay=pm[sid]||{};
    const mode=bt.mode||'saldo',cnt=counts[String(r.branch_id)]||0;
    // Canonical equal-share rule: CEIL, matching RAOS saldo/order KPI snapshots.
    const auto=bt.target_staff_default==null&&cnt>0?Math.ceil(num(bt.target_cabang)/cnt):null;
    const saldoOverride=st.target_saldo==null?null:num(st.target_saldo);
    const orderOverride=st.target_order==null?null:num(st.target_order);
    const effective=mode==='order'
      ?(orderOverride!=null?orderOverride:(bt.target_staff_default!=null?num(bt.target_staff_default):auto))
      :(saldoOverride!=null?saldoOverride:(bt.target_staff_default!=null?num(bt.target_staff_default):auto));
    const realSaldo=num(real.realisasi_saldo);
    const realCount=mode==='order'?(scanCounts[sid]||0):0;
    const pct=effective>0?((mode==='order'?realCount:realSaldo)/effective*100):num(pay.target_pct,0);
    return {staff_id:sid,staff_code:r.employee_id,staff_name:r.full_name,role:roleOf(r.resolved_role||r.system_role),branch_id:r.branch_id,branch_name:r.branch_name,is_excluded_saldo:mode==='order',mode,gapok:pay.gapok==null?num(r.salary_base):num(pay.gapok),target_saldo:mode==='saldo'?effective:null,target_saldo_override:mode==='saldo'?saldoOverride:null,target_order:mode==='order'?effective:null,target_order_override:mode==='order'?orderOverride:null,realisasi_saldo:realSaldo,pct:pay.target_pct==null?pct:num(pay.target_pct),target_scan:mode==='order'?effective:null,realisasi_scan:mode==='order'?realCount:null,pct_scan:mode==='order'?pct:null,bonus_saldo:num(pay.bonus_saldo),bpjs:num(pay.bpjs),paket_data:num(pay.paket_data),member_parkir:pay.member_parkir==null?num(st.member_parkir_amount):num(pay.member_parkir),bonus_kpi:num(pay.bonus_kpi),thp:num(pay.thp),status_target:pay.status_target||'na',driver_active_pct:num(pay.driver_active_pct),late_deduction_total:num(pay.late_deduction_total),computed_at:pay.computed_at||null};
  });
}

async function upsertStaffTarget(req,p){
  financeWrite(p);
  const staffId=String(req.body?.staff_id||'').trim(),month=monthDate(req.body?.month);if(!staffId)throw new Error('staff_id wajib');
  const raw=req.body?.target_saldo,rawOrder=req.body?.target_order,parkir=num(req.body?.member_parkir_amount,0);
  if((raw===''||raw==null)&&(rawOrder===''||rawOrder==null)&&parkir===0){
    await sb(`/rest/v1/raos_kpi_targets_staff?staff_id=eq.${q(staffId)}&effective_month=eq.${month}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});
    return {deleted:true,staff_id:staffId,effective_month:month};
  }
  const payload={staff_id:staffId,effective_month:month,target_saldo:raw===''||raw==null?null:num(raw),target_order:rawOrder===''||rawOrder==null?null:num(rawOrder),member_parkir_amount:parkir,updated_at:new Date().toISOString()};
  const rows=await sb('/rest/v1/raos_kpi_targets_staff?on_conflict=staff_id,effective_month',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(payload)});
  return rows?.[0]||payload;
}

async function computePayroll(req,p){financeWrite(p);const month=monthDate(req.body?.month);const r=await sb('/rest/v1/rpc/raos_compute_payroll_month',{method:'POST',body:JSON.stringify({p_month:month})});return {processed:num(r),month}}

async function listDrivers(req,p){
  financeRead(p);
  const branchId=String(req.query.branch_id||'').trim();if(!branchId)throw new Error('branch_id wajib');
  const [drivers,assignments,branch]=await Promise.all([
    sb(`/rest/v1/raos_drivers?branch_id=eq.${q(branchId)}&select=id,driver_id,name,phone,vehicle_type,vehicle_plate,branch_id,is_active,driver_type&order=name.asc&limit=2000`),
    sb(`/rest/v1/raos_driver_staff_assignment?branch_id=eq.${q(branchId)}&select=driver_id,staff_id,assigned_at`),
    sb(`/rest/v1/branches?id=eq.${q(branchId)}&select=id,name,slug&limit=1`)
  ]);
  const staffIds=[...new Set((assignments||[]).map(x=>x.staff_id).filter(Boolean))];
  let staff=[];if(staffIds.length)staff=await sb(`/rest/v1/user_profiles?id=in.(${staffIds.map(q).join(',')})&select=id,staff_id,full_name,role`);
  const am=Object.fromEntries((assignments||[]).map(x=>[String(x.driver_id),x])),sm=Object.fromEntries((staff||[]).map(x=>[String(x.id),x])),b=branch?.[0]||{};
  return (drivers||[]).map(d=>{const a=am[String(d.id)]||{},s=sm[String(a.staff_id)]||{};return{...d,branch_name:b.name||b.slug||'',assigned_staff_id:a.staff_id||null,assigned_staff_name:s.full_name||'',assigned_staff_code:s.staff_id||'',assigned_staff_role:roleOf(s.role||''),assigned_at:a.assigned_at||null}});
}
async function assignDrivers(req,p){financeWrite(p);const branchId=String(req.body?.branch_id||'').trim();if(!branchId)throw new Error('branch_id wajib');const force=String(req.body?.force||'false').toLowerCase()==='true'||req.body?.force===true;const r=await sb('/rest/v1/rpc/raos_random_assign_drivers',{method:'POST',body:JSON.stringify({p_branch_id:branchId,p_force:force})});return {assigned:num(r),branch_id:branchId,force}}

// P0.4 fix (2026-08-18): server-side passthrough for the 6 legacy GAS "read"
// actions that Finance still sources from the Google Sheet workbook (no
// Supabase-side canonical table exists for them yet). Root cause of the
// production "GAS backend sedang throttled" message: the browser called GAS
// directly (fetch from the client) through a stack of THREE independent
// wrapper layers (finance-data-router.js -> api-cache.js FinanceRuntimeFix
// -> api-cache-core.js RifimAPI), each with its own cache/retry, all still
// bottoming out in a single client-side fetch(GAS_URL) with only 1 retry and
// a 900ms backoff -- a transient Apps Script cold-start/quota HTML response
// had a real chance of surfacing directly to the user. Moving the call
// server-side lets a single canonical layer retry harder (this function) and
// lets finance-data-router.js's existing stale-cache fallback keep working
// exactly as before, just against one transport instead of three.
const LEGACY_GAS_ACTIONS=new Set(['finance_list','finance_cabang_list','finance_tagihan_list','finance_rekap_harian','finance_rekap_bulanan','finance_log_list']);
const LEGACY_GAS_TIMEOUT_MS=Number(env('FINANCE_LEGACY_GAS_TIMEOUT_MS'))||9000; // override only used by local tests
const LEGACY_GAS_MAX_ATTEMPTS=3; // architect requirement F.E: bounded retry, no unbounded loop
async function fetchWithTimeout(url,opts,timeoutMs){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{return await fetch(url,{...opts,signal:ctrl.signal})}
  finally{clearTimeout(timer)}
}
async function financeLegacyGas(req,p){
  // ARCHITECT REVIEW (2026-08-18): financeRead() gates this to
  // admin/direksi/management only (see function def above) -- koordinator/
  // staff/driver/anon cannot reach this mode. actor() (called before this
  // function, in handler()) already requires a valid Supabase bearer + an
  // is_active profile, so there is no unauthenticated path into this code.
  financeRead(p);
  const gasAction=String(req.body?.gas_action||'').trim();
  // A. Whitelist-only -- reject any action outside the 6 canonical legacy
  // reads. No arbitrary gas_action is ever forwarded to Apps Script.
  if(!LEGACY_GAS_ACTIONS.has(gasAction))throw new Error('gas_action tidak dikenali: '+gasAction);
  const gasUrl=env('GAS_URL')||'https://script.google.com/macros/s/AKfycbzzK75gxawaylaUZpoC1zp_hq5ktznlN7scIl24HkdEgR2l3cVmpUSLck0potcMZZtw/exec';
  const bearer=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
  // ARCHITECT FIX: previous version spread ...extra AFTER action/access_token,
  // so a client body containing its own "action" or "access_token" key would
  // silently override the validated gas_action / server-derived bearer --
  // i.e. the whitelist check above could be bypassed by a same-request field
  // override, and a caller could smuggle an arbitrary access_token to GAS.
  // Extra params are now spread FIRST and the two trusted fields are set
  // last, so they always win regardless of what the client body contains.
  // D. No secret leak: only the CALLER's OWN bearer token (already validated
  // by actor()) is forwarded as access_token -- never SUPABASE_SERVICE_ROLE_KEY
  // or any other server secret.
  const extra={...(req.body||{})};
  delete extra.mode;delete extra.gas_action;delete extra.action;delete extra.access_token;
  const payload={...extra,action:gasAction,access_token:bearer};
  let lastMsg='';
  // Diagnostic logging (2026-08-19, round 2): action/status/content-type/
  // final-URL-host/attempt only -- never the bearer, never payload values.
  // GAS response was consistently HTML even though server-side retry runs
  // (confirmed 3x in production, per round-2 report), which per item H means
  // this is a CONFIG/AUTH/TRANSPORT failure, not a transient cold-start --
  // most likely causes: (1) the deployed GAS Web App version predates
  // crmApi.js's finance_* action handlers (source has them; whether the
  // *active* deployment version does is unverifiable from here -- no clasp/
  // GAS Editor access in this session), or (2) UrlFetchApp is being redirected
  // to a Google login page because the deployment's access level changed.
  // This log is what lets a human confirm which, without guessing.
  function diag(attempt,status,contentType,finalUrl,note){
    try{
      const finalHost=finalUrl?(new URL(finalUrl)).hostname:null;
      const pathClass=finalUrl?((new URL(finalUrl)).pathname.startsWith('/ServiceLogin')||(new URL(finalUrl)).hostname.indexOf('accounts.google.com')!==-1?'google-login-redirect':((new URL(finalUrl)).pathname.startsWith('/macros/')?'apps-script-exec':'other')):null;
      console.error('[finance_legacy_gas]',JSON.stringify({action:gasAction,attempt:attempt+1,status,contentType,finalHost,pathClass,note}));
    }catch(_){}
  }
  for(let attempt=0;attempt<LEGACY_GAS_MAX_ATTEMPTS;attempt++){
    let r;
    try{
      // F. Bounded per-attempt timeout so a hung GAS request can't pin the
      // Vercel function open indefinitely.
      r=await fetchWithTimeout(gasUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)},LEGACY_GAS_TIMEOUT_MS);
    }catch(e){
      lastMsg=(e&&e.name==='AbortError')?'Timeout setelah '+LEGACY_GAS_TIMEOUT_MS+'ms':(e instanceof Error?e.message:String(e));
      diag(attempt,null,null,null,'fetch_error:'+lastMsg);
      if(attempt<LEGACY_GAS_MAX_ATTEMPTS-1){await new Promise(res=>setTimeout(res,600*(attempt+1)));continue}
      break;
    }
    const ct=r.headers.get('content-type')||'';
    if(r.status===429||r.status>=500){
      // E. HTTP-level throttle/server-error from GAS is a transient
      // transport failure, not a canonical response -- retry, don't surface.
      lastMsg='GAS HTTP '+r.status;
      diag(attempt,r.status,ct,r.url,'http_error');
      if(attempt<LEGACY_GAS_MAX_ATTEMPTS-1){await new Promise(res=>setTimeout(res,600*(attempt+1)));continue}
      break;
    }
    const txt=await r.text();
    if(txt.trim().startsWith('<')){
      // H. An HTML body back from what should be a JSON API is a CONFIG/
      // AUTH/TRANSPORT failure (wrong/stale deployment version, or GAS
      // redirecting to a Google login page), NOT an automatic "cold start"
      // assumption -- classification and diagnostic logging only, per
      // architect round-2 review; retry budget unchanged (still bounded 3x).
      lastMsg='GAS balas HTML (config/auth/transport failure -- lihat diagnostic log), percobaan '+(attempt+1);
      diag(attempt,r.status,ct,r.url,'html_response:'+txt.slice(0,120).replace(/\s+/g,' '));
      if(attempt<LEGACY_GAS_MAX_ATTEMPTS-1){await new Promise(res=>setTimeout(res,600*(attempt+1)));continue}
      break;
    }
    // G. Response normalization -- pass through GAS's own canonical JSON
    // shape ({success:true,...} or {success:false,message:...}) as-is; if it
    // isn't parseable JSON at all, normalize into the same canonical shape
    // rather than leaking the raw body.
    try{const parsed=JSON.parse(txt);return (parsed&&typeof parsed==='object')?parsed:{success:false,message:'Response GAS bukan objek JSON'}}
    catch(e){diag(attempt,r.status,ct,r.url,'json_parse_error');return {success:false,message:'Response GAS bukan JSON: '+txt.substring(0,200)}}
  }
  // G. Canonical error JSON -- never HTML, never an unhandled throw reaching
  // the client as a raw 500 with stack trace.
  return {success:false,message:'GAS backend sedang tidak tersedia setelah '+LEGACY_GAS_MAX_ATTEMPTS+'x percobaan server-side: '+lastMsg,_gas_throttled:true};
}

// P0.5 fix (2026-08-22): tagihan add/mark-paid used to bypass the canonical
// server boundary and call GAS directly from the browser. Now they are
// handled exactly like finance_legacy_gas: actor() + financeWrite() on the
// server, caller's own verified Bearer forwarded as access_token to GAS,
// client-supplied action/token fields removed, bounded retry, and the same
// diagnostic logging. The GAS crmApi.js write-role gate still runs, but the
// browser no longer sends the token across the network.
const { invoiceNominal } = require('../../shared/aist-invoice-nominal.js');
const AIST_EXCLUDED_STATUS = new Set([
  'lunas','paid','ditolak','dibatalkan','selesai','completed','rejected','cancelled'
]);

function formatWib(iso){
  if(!iso) return '';
  try{
    const d = new Date(iso);
    return d.toLocaleString('id-ID',{timeZone:'Asia/Jakarta',hour12:false});
  }catch(_){return String(iso);}
}

async function listAistQueue(){
  const exclude = Array.from(AIST_EXCLUDED_STATUS).map(q).join(',');
  const path = `/rest/v1/raos_saldo_requests?select=id,request_no,staff_id,branch_id,nominal,status,requested_at,created_at,is_processed,driver_id,driver_login_id,driver_name,client_id&is_processed=eq.false&status=not.in.(${exclude})&driver_login_id=not.is.null&nominal=gt.0&order=created_at.desc&limit=500`;
  const rows = await sb(path);
  const staffIds = [...new Set((rows||[]).map(x=>x.staff_id).filter(Boolean))];
  const branchIds = [...new Set((rows||[]).map(x=>x.branch_id).filter(Boolean))];
  let prof=[], branches=[];
  if(staffIds.length) prof = await sb(`/rest/v1/user_profiles?id=in.(${staffIds.map(q).join(',')})&select=id,full_name,staff_id`);
  if(branchIds.length) branches = await sb(`/rest/v1/branches?id=in.(${branchIds.map(q).join(',')})&select=id,name,slug`);
  const pm = Object.fromEntries((prof||[]).map(x=>[String(x.id),x]));
  const bm = Object.fromEntries((branches||[]).map(x=>[String(x.id),x]));
  return (rows||[]).map(r=>{
    const raw = Number(r.nominal)||0;
    const s = pm[String(r.staff_id)]||{};
    const b = bm[String(r.branch_id)]||{};
    return {
      request_id: String(r.id),
      request_no: String(r.request_no||''),
      driver_login: String(r.driver_login_id).replace(/\D/g,''),
      driver_name: String(r.driver_name||''),
      branch_name: String(b.name||b.slug||''),
      staff_name: String(s.full_name||''),
      staff_code: String(s.staff_id||''),
      saldo_nominal: raw,
      invoice_nominal: invoiceNominal(raw),
      submitted_at: r.requested_at || r.created_at,
      submitted_at_wib: formatWib(r.requested_at || r.created_at),
      status: String(r.status||'pending'),
    };
  });
}

const TAGIHAN_GAS_ACTIONS=new Set(['finance_tagihan_add','finance_tagihan_mark_paid']);
async function financeTagihan(req,p,mode){
  financeWrite(p);
  const gasAction=String(mode||'');
  if(!TAGIHAN_GAS_ACTIONS.has(gasAction))throw new Error('mode tagihan tidak dikenali: '+gasAction);
  const gasUrl=env('GAS_URL')||'https://script.google.com/macros/s/AKfycbzzK75gxawaylaUZpoC1zp_hq5ktznlN7scIl24HkdEgR2l3cVmpUSLck0potcMZZtw/exec';
  const bearer=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
  const extra={...(req.body||{})};
  delete extra.mode;delete extra.gas_action;delete extra.action;delete extra.access_token;
  const payload={...extra,action:gasAction,access_token:bearer};
  let lastMsg='';
  function diag(attempt,status,contentType,finalUrl,note){
    try{
      const finalHost=finalUrl?(new URL(finalUrl)).hostname:null;
      const pathClass=finalUrl?((new URL(finalUrl)).pathname.startsWith('/ServiceLogin')||(new URL(finalUrl)).hostname.indexOf('accounts.google.com')!==-1?'google-login-redirect':((new URL(finalUrl)).pathname.startsWith('/macros/')?'apps-script-exec':'other')):null;
      console.error('[finance_tagihan]',JSON.stringify({action:gasAction,attempt:attempt+1,status,contentType,finalHost,pathClass,note}));
    }catch(_){}
  }
  for(let attempt=0;attempt<LEGACY_GAS_MAX_ATTEMPTS;attempt++){
    let r;
    try{
      r=await fetchWithTimeout(gasUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)},LEGACY_GAS_TIMEOUT_MS);
    }catch(e){
      lastMsg=(e&&e.name==='AbortError')?'Timeout setelah '+LEGACY_GAS_TIMEOUT_MS+'ms':(e instanceof Error?e.message:String(e));
      diag(attempt,null,null,null,'fetch_error:'+lastMsg);
      if(attempt<LEGACY_GAS_MAX_ATTEMPTS-1){await new Promise(res=>setTimeout(res,600*(attempt+1)));continue}
      break;
    }
    const ct=r.headers.get('content-type')||'';
    if(r.status===429||r.status>=500){
      lastMsg='GAS HTTP '+r.status;
      diag(attempt,r.status,ct,r.url,'http_error');
      if(attempt<LEGACY_GAS_MAX_ATTEMPTS-1){await new Promise(res=>setTimeout(res,600*(attempt+1)));continue}
      break;
    }
    const txt=await r.text();
    if(txt.trim().startsWith('<')){
      lastMsg='GAS balas HTML (config/auth/transport failure -- lihat diagnostic log), percobaan '+(attempt+1);
      diag(attempt,r.status,ct,r.url,'html_response:'+txt.slice(0,120).replace(/\s+/g,' '));
      if(attempt<LEGACY_GAS_MAX_ATTEMPTS-1){await new Promise(res=>setTimeout(res,600*(attempt+1)));continue}
      break;
    }
    try{const parsed=JSON.parse(txt);return (parsed&&typeof parsed==='object')?parsed:{success:false,message:'Response GAS bukan objek JSON'}}
    catch(e){diag(attempt,r.status,ct,r.url,'json_parse_error');return {success:false,message:'Response GAS bukan JSON: '+txt.substring(0,200)}}
  }
  return {success:false,message:'GAS backend sedang tidak tersedia setelah '+LEGACY_GAS_MAX_ATTEMPTS+'x percobaan server-side: '+lastMsg,_gas_throttled:true};
}

module.exports=async function handler(req,res){
  try{
    const mode=String(req.query.mode||req.body?.mode||'');
    if(mode==='aist_queue'){
      res.setHeader('Access-Control-Allow-Origin','*');
      res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers','Content-Type');
      if(req.method==='OPTIONS') return out(res,200,{success:true});
      if(req.method==='GET'){
        try{
          verifyAistHandoff(aistQueueToken(req));
          return out(res,200,{success:true,rows:await listAistQueue(),source:'supabase'});
        }catch(e){return out(res,403,{success:false,message:'AIST handoff token missing, invalid, expired, or wrong scope'});}
      }
      return out(res,405,{success:false,message:'Method not allowed'});
    }
    const p=await actor(req);
    if(req.method==='POST'&&mode==='aist_queue_issue'){
      financeRead(p);
      const h=issueAistHandoff();
      return out(res,200,{success:true,token:h.token,expires_at:h.expires_at,scope:h.scope});
    }
    if(req.method==='GET'&&mode==='finance_saldo_list')return out(res,200,{success:true,rows:await listSaldo(req,p),source:'supabase'});
    if(req.method==='POST'&&mode==='finance_saldo_mark_paid'){const r=await markSaldo(req,p);return out(res,200,{success:true,...(r||{})})}
    if(req.method==='GET'&&mode==='finance_branches')return out(res,200,{success:true,rows:await listFinanceBranches(req,p),source:'supabase'});
    if(req.method==='GET'&&mode==='finance_branch_targets')return out(res,200,{success:true,rows:await listBranchTargets(req,p),source:'supabase'});
    if(req.method==='POST'&&mode==='finance_branch_target_upsert')return out(res,200,{success:true,row:await upsertBranchTarget(req,p)});
    if(req.method==='GET'&&mode==='finance_staff_targets')return out(res,200,{success:true,rows:await listStaffTargets(req,p),source:'supabase'});
    if(req.method==='POST'&&mode==='finance_staff_target_upsert')return out(res,200,{success:true,row:await upsertStaffTarget(req,p)});
    if(req.method==='POST'&&mode==='finance_payroll_compute')return out(res,200,{success:true,...await computePayroll(req,p)});
    if(req.method==='GET'&&mode==='finance_drivers')return out(res,200,{success:true,rows:await listDrivers(req,p),source:'supabase'});
    if(req.method==='POST'&&mode==='finance_driver_assign')return out(res,200,{success:true,...await assignDrivers(req,p)});
    if(req.method==='POST'&&mode==='finance_legacy_gas')return out(res,200,await financeLegacyGas(req,p));
    if(req.method==='POST'&&mode==='finance_tagihan_add')return out(res,200,await financeTagihan(req,p,mode));
    if(req.method==='POST'&&mode==='finance_tagihan_mark_paid')return out(res,200,await financeTagihan(req,p,mode));
    if(req.method==='GET')return out(res,200,{success:true,rows:await listContracts(req,p)});
    if(req.method==='POST'&&mode==='validate')return out(res,200,{success:true,result:await validateContract(req,p)});
    return out(res,405,{success:false,message:'Method not allowed'});
  }catch(e){return out(res,400,{success:false,message:e instanceof Error?e.message:String(e)})}
}

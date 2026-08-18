function env(n){return String(process.env[n]||'').trim()}
async function read(res){const t=await res.text();try{return t?JSON.parse(t):{}}catch(_){return{message:t||`HTTP ${res.status}`}}}
function out(res,s,b){res.status(s).setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(b))}
function q(v){return encodeURIComponent(String(v==null?'':v))}
function roleOf(v){v=String(v||'').toLowerCase();return v==='direktur'?'direksi':v==='koord'?'koordinator':v==='mgmt'?'management':v}
function monthDate(v){const s=String(v||'').trim();if(/^\d{4}-\d{2}$/.test(s))return s+'-01';if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s.slice(0,7)+'-01';const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d}
function financeRead(p){if(!['admin','direksi','management'].includes(p.role))throw new Error('Role tidak boleh melihat Finance')}
function financeWrite(p){if(!['admin','direksi'].includes(p.role))throw new Error('Hanya Admin/Direksi boleh mengubah Finance')}
async function sb(path,opts={}){const url=env('SUPABASE_URL'),svc=env('SUPABASE_SERVICE_ROLE_KEY');if(!url||!svc)throw new Error('Supabase server env missing');const r=await fetch(url+path,{...opts,headers:{apikey:svc,Authorization:`Bearer ${svc}`,'Content-Type':'application/json',...(opts.headers||{})}});const b=await read(r);if(!r.ok)throw new Error(b.message||b.error||`Supabase HTTP ${r.status}`);return b}
async function actor(req){const url=env('SUPABASE_URL'),pub=env('SUPABASE_PUBLISHABLE_KEY'),bearer=String(req.headers.authorization||'');if(!url||!pub)throw new Error('Supabase server env missing');if(!bearer.startsWith('Bearer '))throw new Error('Session required');const ur=await fetch(`${url}/auth/v1/user`,{headers:{apikey:pub,Authorization:bearer}}),u=await read(ur);if(!ur.ok||!u?.id)throw new Error('Session invalid');const rows=await sb(`/rest/v1/user_profiles?id=eq.${q(u.id)}&select=id,role,branch_id,is_active&limit=1`),p=rows?.[0];if(!p?.is_active)throw new Error('Profil tidak aktif');p.role=roleOf(p.role);return p}

// HRIS contract API (existing canonical behavior)
async function listContracts(req,p){if(!['admin','direksi','management','koordinator'].includes(p.role))throw new Error('Role tidak boleh melihat Kontrak');let path='/rest/v1/hris_contract_employee_view?select=*&order=updated_at.desc&limit=1000';const employeeId=String(req.query.employee_id||'').trim();if(employeeId)path+=`&employee_id=eq.${q(employeeId)}`;let rows=await sb(path);if(p.role==='koordinator'){const prof=await sb(`/rest/v1/user_profiles?branch_id=eq.${q(p.branch_id||'')}&is_active=eq.true&select=staff_id`);const allowed=new Set((prof||[]).map(x=>String(x.staff_id||'').toUpperCase()).filter(Boolean));rows=(rows||[]).filter(x=>allowed.has(String(x.employee_id||'').toUpperCase()))}return rows||[]}
async function validateContract(req,p){if(!['admin','direksi'].includes(p.role))throw new Error('Hanya Admin/Direksi boleh validasi kontrak');const id=String(req.body?.contract_id||'').trim();if(!id)throw new Error('contract_id wajib');return await sb('/rest/v1/rpc/hris_validate_contract',{method:'POST',body:JSON.stringify({p_contract_id:id})})}

// Finance / RAOS canonical direct reads
async function listSaldo(req,p){financeRead(p);let path='/rest/v1/raos_saldo_requests?select=id,request_no,staff_id,branch_id,nominal,status,requested_at,created_at,is_processed,processed_at,driver_id,driver_login_id,driver_name,client_id&order=created_at.desc&limit=500';const status=String(req.query.status||'').trim().toLowerCase();if(status&&status!=='all'){if(['paid','processed','lunas'].includes(status))path+='&is_processed=eq.true';else if(['unprocessed','belum_lunas'].includes(status))path+='&is_processed=eq.false';else path+=`&status=eq.${q(status)}`}const rows=await sb(path);const staffIds=[...new Set((rows||[]).map(x=>x.staff_id).filter(Boolean))],branchIds=[...new Set((rows||[]).map(x=>x.branch_id).filter(Boolean))];let prof=[],branches=[];if(staffIds.length)prof=await sb(`/rest/v1/user_profiles?id=in.(${staffIds.map(q).join(',')})&select=id,full_name,staff_id`);if(branchIds.length)branches=await sb(`/rest/v1/branches?id=in.(${branchIds.map(q).join(',')})&select=id,name,slug`);const pm=Object.fromEntries((prof||[]).map(x=>[String(x.id),x])),bm=Object.fromEntries((branches||[]).map(x=>[String(x.id),x]));return (rows||[]).map(r=>{const s=pm[String(r.staff_id)]||{},b=bm[String(r.branch_id)]||{};return{...r,staff_name:s.full_name||'',staff_code:s.staff_id||'',branch_name:b.name||b.slug||''}})}
async function markSaldo(req,p){financeWrite(p);const id=String(req.body?.id||req.body?.request_id||'').trim();if(!id)throw new Error('id wajib');return await sb('/rest/v1/rpc/raos_saldo_mark_paid',{method:'POST',body:JSON.stringify({p_request_id:id,p_processor_id:p.id})})}

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
    const auto=t.target_staff_default==null&&staffCount>0?Math.floor(targetCabang/staffCount):null;
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
  const [branchTargets,staffTargets,realisasi,payroll]=await Promise.all([
    sb(`/rest/v1/raos_kpi_targets_branch?effective_month=eq.${month}&select=branch_id,target_cabang,target_staff_default,mode`),
    sb(`/rest/v1/raos_kpi_targets_staff?effective_month=eq.${month}&select=staff_id,target_saldo,member_parkir_amount,updated_at`),
    sb(`/rest/v1/raos_target_tercapai_bulan?effective_month=eq.${month}&select=staff_id,request_count,realisasi_saldo`),
    sb(`/rest/v1/raos_payroll?effective_month=eq.${month}&select=staff_id,gapok,bonus_saldo,bpjs,paket_data,member_parkir,bonus_kpi,target_pct,driver_active_pct,status_target,late_deduction_total,thp,computed_at`)
  ]);
  const bm=Object.fromEntries((branchTargets||[]).map(x=>[String(x.branch_id),x]));
  const sm=Object.fromEntries((staffTargets||[]).map(x=>[String(x.staff_id),x]));
  const rm=Object.fromEntries((realisasi||[]).map(x=>[String(x.staff_id),x]));
  const pm=Object.fromEntries((payroll||[]).map(x=>[String(x.staff_id),x]));
  const counts={};for(const r of roster)counts[String(r.branch_id)]=(counts[String(r.branch_id)]||0)+1;
  return roster.map(r=>{
    const sid=String(r.user_id),bt=bm[String(r.branch_id)]||{},st=sm[sid]||{},real=rm[sid]||{},pay=pm[sid]||{};
    const mode=bt.mode||'saldo',cnt=counts[String(r.branch_id)]||0;
    const auto=bt.target_staff_default==null&&cnt>0?Math.floor(num(bt.target_cabang)/cnt):null;
    const effective=st.target_saldo!=null?num(st.target_saldo):(bt.target_staff_default!=null?num(bt.target_staff_default):auto);
    const realSaldo=num(real.realisasi_saldo),realCount=num(real.request_count);
    const pct=effective>0?((mode==='order'?realCount:realSaldo)/effective*100):num(pay.target_pct,0);
    return {staff_id:sid,staff_code:r.employee_id,staff_name:r.full_name,role:roleOf(r.resolved_role||r.system_role),branch_id:r.branch_id,branch_name:r.branch_name,is_excluded_saldo:mode==='order',mode,gapok:pay.gapok==null?num(r.salary_base):num(pay.gapok),target_saldo:effective,target_saldo_override:st.target_saldo==null?null:num(st.target_saldo),realisasi_saldo:realSaldo,pct:pay.target_pct==null?pct:num(pay.target_pct),target_scan:mode==='order'?effective:null,realisasi_scan:mode==='order'?realCount:null,pct_scan:mode==='order'?pct:null,bonus_saldo:num(pay.bonus_saldo),bpjs:num(pay.bpjs),paket_data:num(pay.paket_data),member_parkir:pay.member_parkir==null?num(st.member_parkir_amount):num(pay.member_parkir),bonus_kpi:num(pay.bonus_kpi),thp:num(pay.thp),status_target:pay.status_target||'na',driver_active_pct:num(pay.driver_active_pct),late_deduction_total:num(pay.late_deduction_total),computed_at:pay.computed_at||null};
  });
}

async function upsertStaffTarget(req,p){
  financeWrite(p);
  const staffId=String(req.body?.staff_id||'').trim(),month=monthDate(req.body?.month);if(!staffId)throw new Error('staff_id wajib');
  const raw=req.body?.target_saldo,parkir=num(req.body?.member_parkir_amount,0);
  if((raw===''||raw==null)&&parkir===0){
    await sb(`/rest/v1/raos_kpi_targets_staff?staff_id=eq.${q(staffId)}&effective_month=eq.${month}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});
    return {deleted:true,staff_id:staffId,effective_month:month};
  }
  const payload={staff_id:staffId,effective_month:month,target_saldo:raw===''||raw==null?null:num(raw),member_parkir_amount:parkir,updated_at:new Date().toISOString()};
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

module.exports=async function handler(req,res){
  try{
    const p=await actor(req),mode=String(req.query.mode||req.body?.mode||'');
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
    if(req.method==='GET')return out(res,200,{success:true,rows:await listContracts(req,p)});
    if(req.method==='POST'&&mode==='validate')return out(res,200,{success:true,result:await validateContract(req,p)});
    return out(res,405,{success:false,message:'Method not allowed'});
  }catch(e){return out(res,400,{success:false,message:e instanceof Error?e.message:String(e)})}
}

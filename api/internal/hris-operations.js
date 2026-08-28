function env(n){return String(process.env[n]||'').trim()}
function roleOf(v){v=String(v||'').toLowerCase();return v==='direktur'?'direksi':v==='koord'?'koordinator':v==='mgmt'?'management':v}
function out(res,s,b){res.status(s).setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(b))}
async function read(r){const t=await r.text();try{return t?JSON.parse(t):{}}catch(_){return{message:t||('HTTP '+r.status)}}}
function q(v){return encodeURIComponent(String(v==null?'':v))}
async function serviceFetch(path,opts={}){
  const url=env('SUPABASE_URL'),svc=env('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!svc)throw new Error('Supabase server env missing')
  const r=await fetch(url+path,{...opts,headers:{apikey:svc,Authorization:'Bearer '+svc,'Content-Type':'application/json',...(opts.headers||{})}})
  const body=await read(r)
  if(!r.ok)throw new Error(body.message||body.error||('Supabase HTTP '+r.status))
  return body
}
async function actor(req){
  const url=env('SUPABASE_URL'),pub=env('SUPABASE_PUBLISHABLE_KEY')
  const bearer=String(req.headers.authorization||'')
  if(!url||!pub)throw new Error('Supabase public env missing')
  if(!bearer.startsWith('Bearer '))throw new Error('Session required')
  const ur=await fetch(url+'/auth/v1/user',{headers:{apikey:pub,Authorization:bearer}})
  const u=await read(ur)
  if(!ur.ok||!u?.id)throw new Error('Session invalid')
  const rows=await serviceFetch('/rest/v1/user_profiles?id=eq.'+q(u.id)+'&select=id,email,full_name,role,staff_id,branch_id,is_active&limit=1')
  const p=rows?.[0]
  if(!p?.is_active)throw new Error('Profil tidak aktif')
  p.role=roleOf(p.role)
  return{user:u,profile:p,bearer}
}
function canWrite(role){return['admin','direksi'].includes(role)}
async function userRpc(a,name,args){
  const url=env('SUPABASE_URL'),pub=env('SUPABASE_PUBLISHABLE_KEY')
  const r=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:pub,Authorization:a.bearer,'Content-Type':'application/json'},body:JSON.stringify(args||{})})
  const body=await read(r)
  if(!r.ok){const e=new Error(body.message||body.error||('RPC '+name+' gagal'));e.code=body.code||'';throw e}
  return body
}
async function audit(a,operation,module,scope,affected,success,detail){
  try{
    await serviceFetch('/rest/v1/rifim_ops_audit_log',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({
      actor_id:a.user.id,actor_role:a.profile.role,operation,module,scope:scope||{},affected_rows:Number(affected||0),success:!!success,detail:detail||{}
    })})
  }catch(e){console.error('[hris-operations] audit failed:',e.message)}
}
function activationMessage(err){
  const m=String(err?.message||err||'')
  if(/validated_active_contract_required/i.test(m))return 'Belum dapat diaktifkan: kontrak aktif yang tervalidasi belum tersedia.'
  if(/write_permission_required/i.test(m))return 'Anda tidak memiliki izin untuk mengaktifkan staff.'
  if(/employee_not_found/i.test(m))return 'Data staff tidak ditemukan.'
  if(/employee_id_required/i.test(m))return 'ID staff wajib diisi.'
  return m
}
async function activate(a,b){
  if(!canWrite(a.profile.role))throw new Error('Hanya Admin/Direksi boleh mengaktifkan staff')
  const employeeId=String(b.employee_id||'').trim()
  if(!employeeId)throw new Error('employee_id wajib')
  try{
    const row=await userRpc(a,'hris_activate_employee',{p_employee_id:employeeId})
    return{row,message:'✅ Staff berhasil diaktifkan'}
  }catch(e){
    await audit(a,'activate_employee_failed','hris',{employee_id:employeeId},0,false,{reason:activationMessage(e)})
    throw new Error(activationMessage(e))
  }
}
async function reconcile(a,apply){
  if(!canWrite(a.profile.role))throw new Error('Hanya Admin/Direksi boleh melakukan rekonsiliasi aktivasi')
  const result=await userRpc(a,'hris_reconcile_activation_states',{p_apply:!!apply})
  return{result}
}
function norm(v){return String(v==null?'':v).trim()}
function same(a,b){return norm(a).toLowerCase()===norm(b).toLowerCase()}
async function staffSync(a){
  if(!canWrite(a.profile.role))throw new Error('Hanya Admin/Direksi boleh sinkron Database Staff')

  const [master,branches,employees,defaults]=await Promise.all([
    serviceFetch('/rest/v1/raos_staff_master?select=staff_id,full_name,email,phone,branch_id,airport,terminal,role,status,auth_user_id&order=staff_id.asc&limit=5000'),
    serviceFetch('/rest/v1/branches?select=id,slug,name,code&limit=500'),
    serviceFetch('/rest/v1/employees?select=employee_id,full_name,email,phone,branch,position,status&limit=5000'),
    serviceFetch('/rest/v1/raos_hris_employee_defaults?select=staff_id&limit=5000').catch(()=>[])
  ])
  const branchById=new Map((branches||[]).map(x=>[String(x.id),x]))
  const records=(master||[]).map((x,i)=>{
    const br=branchById.get(String(x.branch_id||''))
    return{
      source_row:i+1,
      email:norm(x.email)||null,
      full_name:norm(x.full_name)||null,
      salary:null,
      legacy_branch_name:br?.slug||norm(x.airport)||null,
      staff_id:norm(x.staff_id).toUpperCase()||null,
      jabatan:norm(x.role)||null,
      phone:norm(x.phone)||null,
      role_system:norm(x.role).toLowerCase()||null,
      status_active:['aktif','active'].includes(norm(x.status).toLowerCase()),
      raos_id:norm(x.auth_user_id)||null
    }
  })

  const sourceResult=await serviceFetch('/rest/v1/rpc/raos_sync_staff_ssot_records',{method:'POST',body:JSON.stringify({p_records:records})})
  const ssot=await serviceFetch('/rest/v1/raos_staff_ssot_records?select=staff_id,full_name,email,phone,legacy_branch_name,branch_id,resolved_role,status_active,conflict_status&order=staff_id.asc&limit=5000')
  const empById=new Map((employees||[]).map(x=>[norm(x.employee_id).toUpperCase(),x]))
  const defaultsSet=new Set((defaults||[]).map(x=>norm(x.staff_id).toUpperCase()).filter(Boolean))
  const eligible=(ssot||[]).filter(x=>x.status_active===true&&x.conflict_status==='none')
  let added=0,updated=0,unchanged=0,missingDefaults=0
  const upsert=[]

  for(const x of eligible){
    const id=norm(x.staff_id).toUpperCase()
    if(!id)continue
    const old=empById.get(id)
    const desired={
      employee_id:id,
      full_name:norm(x.full_name),
      email:norm(x.email)||null,
      phone:norm(x.phone)||null,
      branch:norm(x.legacy_branch_name),
      position:norm(x.resolved_role),
      status:x.status_active?'AKTIF':'NONAKTIF'
    }
    if(!old){
      if(!defaultsSet.has(id)){missingDefaults++;continue}
      added++;upsert.push(desired);continue
    }
    const changed=!same(old.full_name,desired.full_name)||!same(old.email,desired.email)||!same(old.phone,desired.phone)||!same(old.branch,desired.branch)||!same(old.position,desired.position)||!same(old.status,desired.status)
    if(changed){updated++;upsert.push(desired)}else unchanged++
  }

  let hrisResult={inserted:0,updated:0,skipped:0,errors:[]}
  if(upsert.length){
    hrisResult=await serviceFetch('/rest/v1/rpc/raos_hris_upsert_employees',{method:'POST',body:JSON.stringify({p_records:upsert})})
  }

  const inactive=(ssot||[]).filter(x=>x.status_active!==true||x.conflict_status==='inactive').length
  const conflicts=(ssot||[]).filter(x=>!['none','inactive'].includes(String(x.conflict_status||''))).length
  const missingBranch=(ssot||[]).filter(x=>x.conflict_status==='unmapped_branch').length
  const duplicateStaff=(ssot||[]).filter(x=>x.conflict_status==='duplicate_staff_id').length
  const duplicateEmail=(ssot||[]).filter(x=>x.conflict_status==='duplicate_email').length
  const summary={
    total_source:records.length,
    added,updated,unchanged,inactive,
    conflict:conflicts,
    missing_branch:missingBranch,
    duplicate_staff_id:duplicateStaff,
    duplicate_email:duplicateEmail,
    missing_hris_defaults:missingDefaults,
    eligible:eligible.length,
    ssot:sourceResult,
    hris:hrisResult,
    synced_at:new Date().toISOString()
  }
  await audit(a,'staff_database_sync','hris',{source:'raos_staff_master'},Number(hrisResult.inserted||0)+Number(hrisResult.updated||0),true,summary)
  return{summary}
}
module.exports=async function handler(req,res){
  let a=null
  try{
    a=await actor(req)
    if(req.method!=='POST')return out(res,405,{success:false,message:'Method not allowed'})
    const b=req.body||{},mode=String(b.mode||'')
    if(mode==='activate')return out(res,200,{success:true,...await activate(a,b)})
    if(mode==='activation_reconcile_preview')return out(res,200,{success:true,...await reconcile(a,false)})
    if(mode==='activation_reconcile_apply')return out(res,200,{success:true,...await reconcile(a,true)})
    if(mode==='staff_sync')return out(res,200,{success:true,...await staffSync(a)})
    return out(res,404,{success:false,message:'Mode tidak dikenal'})
  }catch(e){
    if(a)await audit(a,'hris_operation_failed','hris',{mode:String(req.body?.mode||'')},0,false,{reason:e instanceof Error?e.message:String(e)})
    return out(res,400,{success:false,message:e instanceof Error?e.message:String(e)})
  }
}

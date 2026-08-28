const crypto=require('crypto')
function env(n){return String(process.env[n]||'').trim()}
function roleOf(v){v=String(v||'').toLowerCase();return v==='direktur'?'direksi':v==='koord'?'koordinator':v==='mgmt'?'management':v}
function out(res,s,b){res.status(s).setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(b))}
async function read(r){const t=await r.text();try{return t?JSON.parse(t):{}}catch(_){return{message:t||('HTTP '+r.status)}}}
function q(v){return encodeURIComponent(String(v==null?'':v))}
async function sb(path,opts={}){
  const url=env('SUPABASE_URL'),svc=env('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!svc)throw new Error('Supabase server env missing')
  const r=await fetch(url+path,{...opts,headers:{apikey:svc,Authorization:'Bearer '+svc,'Content-Type':'application/json',...(opts.headers||{})}})
  const b=await read(r);if(!r.ok)throw new Error(b.message||b.error||('Supabase HTTP '+r.status));return b
}
async function actor(req){
  const url=env('SUPABASE_URL'),pub=env('SUPABASE_PUBLISHABLE_KEY'),bearer=String(req.headers.authorization||'')
  if(!url||!pub)throw new Error('Supabase public env missing')
  if(!bearer.startsWith('Bearer '))throw new Error('Session required')
  const ur=await fetch(url+'/auth/v1/user',{headers:{apikey:pub,Authorization:bearer}}),u=await read(ur)
  if(!ur.ok||!u?.id)throw new Error('Session invalid')
  const rows=await sb('/rest/v1/user_profiles?id=eq.'+q(u.id)+'&select=id,email,full_name,role,staff_id,branch_id,is_active&limit=1')
  const p=rows?.[0];if(!p?.is_active)throw new Error('Profil tidak aktif');p.role=roleOf(p.role);return{user:u,profile:p}
}
async function audit(a,operation,module,scope,affected,success,detail){
  try{await sb('/rest/v1/rifim_ops_audit_log',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({
    actor_id:a.user.id,actor_role:a.profile.role,operation,module,scope:scope||{},affected_rows:Number(affected||0),success:!!success,detail:detail||{}
  })})}catch(e){console.error('[data-maintenance] audit failed:',e.message)}
}
function date(v,name){const s=String(v||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw new Error(name+' wajib YYYY-MM-DD');return s}
function allowedPreview(role){return['admin','direksi','management','koordinator'].includes(role)}
function allowedExecute(role){return role==='admin'}
function inList(ids){return ids.map(x=>String(x)).join(',')}
function chunks(a,n=100){const r=[];for(let i=0;i<a.length;i+=n)r.push(a.slice(i,i+n));return r}
function tokenFor(module,action,rows,deps){
  const stable={module,action,ids:(rows||[]).map(x=>String(x.id)).sort(),dependencies:deps||{}}
  return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex')
}
async function profilesFor(rows){
  const ids=[...new Set((rows||[]).map(x=>x.staff_id).filter(Boolean).map(String))]
  if(!ids.length)return new Map()
  let all=[]
  for(const part of chunks(ids,80)){
    const x=await sb('/rest/v1/user_profiles?id=in.('+inList(part)+')&select=id,staff_id,full_name,role,branch_id')
    all=all.concat(x||[])
  }
  return new Map(all.map(x=>[String(x.id),x]))
}
function applyPersonFilters(rows,profiles,b){
  const role=roleOf(b.role||''),staff=String(b.staff||'').trim().toLowerCase()
  return (rows||[]).filter(r=>{
    const p=profiles.get(String(r.staff_id))||{}
    if(role&&role!=='semua'&&roleOf(p.role)!==role)return false
    if(staff){
      const hay=[p.staff_id,p.full_name,r.staff_id].join(' ').toLowerCase()
      if(!hay.includes(staff))return false
    }
    return true
  })
}
async function attendanceSelection(a,b){
  const from=date(b.date_from,'Dari'),to=date(b.date_to,'Sampai');if(from>to)throw new Error('Rentang tanggal tidak valid')
  let branch=String(b.branch_id||'').trim()
  if(a.profile.role==='koordinator')branch=String(a.profile.branch_id||'')
  let path='/rest/v1/raos_attendance?date=gte.'+q(from)+'&date=lte.'+q(to)+'&select=id,staff_id,branch_id,date,status,created_at&order=date.asc&limit=10000'
  if(branch)path+='&branch_id=eq.'+q(branch)
  const status=String(b.status||'').trim();if(status&&status!=='semua')path+='&status=eq.'+q(status)
  let rows=await sb(path)
  const pm=await profilesFor(rows);rows=applyPersonFilters(rows,pm,b)
  const months=[...new Set(rows.map(x=>String(x.date||'').slice(0,7)).filter(Boolean))]
  const [payroll,raosPayroll]=await Promise.all([
    sb('/rest/v1/payroll?select=id,period_year,period_month,status,employee_id&limit=10000').catch(()=>[]),
    sb('/rest/v1/raos_payroll?select=id,effective_month,staff_id,computed_at&limit=10000').catch(()=>[])
  ])
  const payrollRows=(payroll||[]).filter(x=>months.includes(String(x.period_year)+'-'+String(x.period_month).padStart(2,'0')))
  const raosPayrollRows=(raosPayroll||[]).filter(x=>months.includes(String(x.effective_month||'').slice(0,7)))
  const deps={payroll_rows:payrollRows.length,raos_payroll_rows:raosPayrollRows.length,aist_jobs:0}
  return{rows,profiles:pm,deps,tables:['raos_attendance'],warnings:(payrollRows.length||raosPayrollRows.length)?['Payroll untuk periode yang sama sudah pernah dibuat.']:[]}
}
async function saldoSelection(a,b){
  const from=date(b.date_from,'Dari'),to=date(b.date_to,'Sampai');if(from>to)throw new Error('Rentang tanggal tidak valid')
  let branch=String(b.branch_id||'').trim()
  if(a.profile.role==='koordinator')branch=String(a.profile.branch_id||'')
  let path='/rest/v1/raos_saldo_requests?created_at=gte.'+q(from+'T00:00:00Z')+'&created_at=lte.'+q(to+'T23:59:59.999Z')+
    '&select=id,request_no,staff_id,branch_id,status,is_processed,processed_at,created_at,is_archived,nominal&order=created_at.asc&limit=10000'
  if(branch)path+='&branch_id=eq.'+q(branch)
  const status=String(b.status||'').trim().toLowerCase()
  if(status&&status!=='semua'){
    if(['paid','processed','lunas'].includes(status))path+='&is_processed=eq.true'
    else if(['unprocessed','belum_lunas'].includes(status))path+='&is_processed=eq.false'
    else path+='&status=eq.'+q(status)
  }
  if(String(b.include_archived||'')!=='true')path+='&is_archived=eq.false'
  let rows=await sb(path)
  const pm=await profilesFor(rows);rows=applyPersonFilters(rows,pm,b)
  const ids=rows.map(x=>x.id)
  let jobs=[]
  for(const part of chunks(ids,80)){
    if(!part.length)continue
    const x=await sb('/rest/v1/aist_jobs?request_id=in.('+inList(part)+')&select=id,request_id,status,completed_at&limit=10000')
    jobs=jobs.concat(x||[])
  }
  const strong=rows.filter(x=>x.is_processed===true).length+(jobs||[]).filter(x=>x.status==='success'||x.completed_at).length
  const deps={aist_jobs:jobs.length,processed_or_completed:strong,payroll_rows:0,raos_payroll_rows:0}
  const warnings=[]
  if(jobs.length)warnings.push('Terdapat riwayat AIST yang terkait.')
  if(strong)warnings.push('Sebagian data sudah diproses/selesai dan merupakan riwayat keuangan.')
  return{rows,profiles:pm,deps,tables:['raos_saldo_requests'].concat(jobs.length?['aist_jobs']:[]),warnings}
}
async function selection(a,b){
  const module=String(b.module||'')
  if(module==='attendance')return attendanceSelection(a,b)
  if(module==='finance_saldo')return saldoSelection(a,b)
  if(module==='hris_karyawan')return{rows:[],deps:{protected_identity:true},tables:['employees','raos_staff_ssot_records','raos_staff_master','raos_staff_master_hris','user_profiles'],warnings:['Identitas karyawan adalah data master yang dilindungi dan tidak dapat dihapus dari menu ini.'],protected:true}
  throw new Error('Module/Data tidak didukung')
}
async function preview(a,b){
  if(!allowedPreview(a.profile.role))throw new Error('Role tidak boleh melihat preview Bersihkan Data')
  const s=await selection(a,b)
  const action=String(b.action||((b.module==='finance_saldo')?'archive':'delete'))
  const result={
    module:b.module,action,
    affected_rows:s.rows.length,
    tables:s.tables,
    dependent_rows:s.deps,
    warnings:s.warnings,
    protected:!!s.protected,
    preview_token:tokenFor(b.module,action,s.rows,s.deps)
  }
  await audit(a,'maintenance_preview',String(b.module||''),{filters:{branch_id:b.branch_id||null,date_from:b.date_from||null,date_to:b.date_to||null,role:b.role||null,status:b.status||null,staff:b.staff||null},action},0,true,result)
  return result
}
async function execute(a,b){
  if(!allowedExecute(a.profile.role))throw new Error('Hanya Admin boleh menjalankan Bersihkan Data')
  const module=String(b.module||''),action=String(b.action||((module==='finance_saldo')?'archive':'delete'))
  const s=await selection(a,b)
  if(s.protected)throw new Error('Data master karyawan dilindungi dan tidak dapat dihapus dari menu ini.')
  const expected=tokenFor(module,action,s.rows,s.deps)
  if(!b.preview_token||String(b.preview_token)!==expected)throw new Error('Data berubah sejak preview. Tampilkan preview ulang sebelum melanjutkan.')
  const ids=s.rows.map(x=>x.id)
  if(!ids.length)return{affected_rows:0,action,module}

  if(action==='delete'){
    if(String(b.confirm_text||'')!=='HAPUS DATA')throw new Error('Ketik HAPUS DATA untuk konfirmasi.')
    if(module==='finance_saldo'&&Number(s.deps.aist_jobs||0)>0&&b.confirm_dependencies!==true){
      throw new Error('Ada riwayat AIST terkait. Konfirmasi dependency wajib sebelum Permanent Delete.')
    }
    for(const part of chunks(ids,80)){
      await sb('/rest/v1/'+(module==='attendance'?'raos_attendance':'raos_saldo_requests')+'?id=in.('+inList(part)+')',{method:'DELETE',headers:{Prefer:'return=minimal'}})
    }
  }else if(module==='finance_saldo'&&action==='archive'){
    for(const part of chunks(ids,80)){
      await sb('/rest/v1/raos_saldo_requests?id=in.('+inList(part)+')',{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({is_archived:true,archived_at:new Date().toISOString(),archived_by:a.profile.id})})
    }
  }else throw new Error('Aksi maintenance tidak didukung')

  const detail={action,module,dependencies:s.deps,warnings:s.warnings}
  await audit(a,'maintenance_'+action,module,{filters:{branch_id:b.branch_id||null,date_from:b.date_from||null,date_to:b.date_to||null,role:b.role||null,status:b.status||null,staff:b.staff||null}},ids.length,true,detail)
  return{affected_rows:ids.length,action,module,dependencies:s.deps}
}
module.exports=async function handler(req,res){
  let a=null
  try{
    a=await actor(req)
    if(req.method!=='POST')return out(res,405,{success:false,message:'Method not allowed'})
    const b=req.body||{},mode=String(b.mode||'preview')
    if(mode==='preview')return out(res,200,{success:true,preview:await preview(a,b)})
    if(mode==='execute')return out(res,200,{success:true,result:await execute(a,b)})
    return out(res,404,{success:false,message:'Mode tidak dikenal'})
  }catch(e){
    if(a)await audit(a,'maintenance_failed',String(req.body?.module||''),{mode:req.body?.mode||'',action:req.body?.action||''},0,false,{reason:e instanceof Error?e.message:String(e)})
    return out(res,400,{success:false,message:e instanceof Error?e.message:String(e)})
  }
}

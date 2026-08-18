function env(n){return String(process.env[n]||'').trim()}
async function read(res){const t=await res.text();try{return t?JSON.parse(t):{}}catch(_){return{message:t||`HTTP ${res.status}`}}}
function out(res,s,b){res.status(s).setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(b))}
function q(v){return encodeURIComponent(String(v==null?'':v))}
function roleOf(v){v=String(v||'').toLowerCase();return v==='direktur'?'direksi':v==='koord'?'koordinator':v==='mgmt'?'management':v}
function monthDate(v){const s=String(v||'').trim();if(/^\d{4}-\d{2}$/.test(s))return s+'-01';if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s.slice(0,7)+'-01';const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`}
async function sb(path,opts={}){const url=env('SUPABASE_URL'),svc=env('SUPABASE_SERVICE_ROLE_KEY');if(!url||!svc)throw new Error('Supabase server env missing');const r=await fetch(url+path,{...opts,headers:{apikey:svc,Authorization:`Bearer ${svc}`,'Content-Type':'application/json',...(opts.headers||{})}});const b=await read(r);if(!r.ok)throw new Error(b.message||b.error||`Supabase HTTP ${r.status}`);return b}
async function actor(req){const url=env('SUPABASE_URL'),pub=env('SUPABASE_PUBLISHABLE_KEY'),bearer=String(req.headers.authorization||'');if(!url||!pub)throw new Error('Supabase server env missing');if(!bearer.startsWith('Bearer '))throw new Error('Session required');const ur=await fetch(`${url}/auth/v1/user`,{headers:{apikey:pub,Authorization:bearer}}),u=await read(ur);if(!ur.ok||!u?.id)throw new Error('Session invalid');const rows=await sb(`/rest/v1/user_profiles?id=eq.${q(u.id)}&select=id,role,is_active&limit=1`),p=rows?.[0];if(!p?.is_active)throw new Error('Profil tidak aktif');p.role=roleOf(p.role);return p}

module.exports=async function handler(req,res){
  try{
    if(req.method!=='POST')return out(res,405,{success:false,message:'Method not allowed'});
    const p=await actor(req);
    if(!['admin','direksi'].includes(p.role))throw new Error('Hanya Admin/Direksi boleh menghitung payroll');
    const staffId=String(req.body?.staff_id||'').trim();
    if(!staffId)throw new Error('staff_id wajib');
    const month=monthDate(req.body?.month);
    const result=await sb('/rest/v1/rpc/raos_compute_payroll_staff',{method:'POST',body:JSON.stringify({p_month:month,p_staff_id:staffId})});
    return out(res,200,{success:true,processed:Number(result)||0,staff_id:staffId,month});
  }catch(e){return out(res,400,{success:false,message:e instanceof Error?e.message:String(e)})}
}

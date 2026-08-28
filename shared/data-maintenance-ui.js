(function(global){
'use strict';
const API='/api/internal/data-maintenance';
let currentModule='attendance', lastPreview=null;

function auth(){try{return JSON.parse(localStorage.getItem('rifim_auth')||'{}')||{}}catch(_){return{}}}
function role(){let r=String(auth().role||'').toLowerCase();return r==='direktur'?'direksi':r==='koord'?'koordinator':r==='mgmt'?'management':r}
function token(){return String(global.RifimPortalSession?.read?.()?.access_token||auth().access_token||'')}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function today(){return new Date().toISOString().slice(0,10)}
function monthStart(){const d=today();return d.slice(0,7)+'-01'}
function moduleLabel(m){return m==='attendance'?'HRIS — Absensi':m==='finance_saldo'?'Finance — Isi Saldo (RAOS)':'HRIS — Karyawan (Dilindungi)'}
function statusOptions(m){
  if(m==='attendance')return [['semua','Semua Status'],['hadir','Hadir'],['terlambat','Terlambat'],['tidak_hadir','Tidak Hadir'],['sakit','Sakit'],['izin','Izin']];
  if(m==='finance_saldo')return [['semua','Semua Status'],['pending','Pending'],['approved','Approved'],['processed','Lunas / Diproses'],['rejected','Ditolak'],['cancelled','Dibatalkan']];
  return [['semua','Semua Status']];
}
function branchSource(m){return document.getElementById(m==='finance_saldo'?'sr-branch':'filter-att-branch')}
function branchOptions(m){
  const src=branchSource(m), out=[['','Semua Cabang']];
  if(!src)return out;
  [...src.options].forEach(o=>{
    const v=String(o.value||''); if(!v||v==='ALL')return;
    if(!out.some(x=>x[0]===v))out.push([v,String(o.textContent||v)]);
  });
  return out;
}
function inject(){
  if(document.getElementById('rifim-maintenance-modal'))return;
  const style=document.createElement('style');
  style.textContent=`
#rifim-maintenance-modal{position:fixed;inset:0;background:rgba(15,23,42,.62);z-index:99999;display:none;align-items:center;justify-content:center;padding:18px}
#rifim-maintenance-modal .dm-card{width:min(760px,96vw);max-height:92vh;overflow:auto;background:#fff;color:#111827;border-radius:14px;box-shadow:0 24px 70px rgba(0,0,0,.3);padding:20px}
#rifim-maintenance-modal .dm-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
#rifim-maintenance-modal .dm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
#rifim-maintenance-modal label{font-size:12px;font-weight:700;color:#475569;display:block}
#rifim-maintenance-modal input,#rifim-maintenance-modal select{width:100%;margin-top:5px;padding:9px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#111827}
#rifim-maintenance-modal .dm-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
#rifim-maintenance-modal button{padding:9px 13px;border:0;border-radius:8px;cursor:pointer;font-weight:700}
#rifim-maintenance-modal .dm-preview{margin-top:14px;padding:12px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;font-size:13px;line-height:1.55}
#rifim-maintenance-modal .danger{background:#b91c1c;color:#fff}.primary{background:#0f766e;color:#fff}.muted{background:#e2e8f0;color:#334155}.warn{background:#f59e0b;color:#fff}
#rifim-maintenance-modal .dm-confirm{display:none;margin-top:12px;padding:12px;background:#fff7ed;border:1px solid #fdba74;border-radius:10px}
@media(max-width:680px){#rifim-maintenance-modal .dm-grid{grid-template-columns:1fr}}
`;
  document.head.appendChild(style);
  const el=document.createElement('div');
  el.id='rifim-maintenance-modal';
  el.innerHTML=`<div class="dm-card">
    <div class="dm-head"><div><h3 style="margin:0">🧹 Bersihkan Data</h3><div style="font-size:12px;color:#64748b;margin-top:3px">Preview dulu sebelum ada perubahan data.</div></div><button class="muted" data-dm-close>✕</button></div>
    <div class="dm-grid">
      <label>Module/Data<select id="dm-module"></select></label>
      <label>Branch<select id="dm-branch"></select></label>
      <label>Staff<input id="dm-staff" placeholder="ID / nama staff (opsional)"></label>
      <label>Role<select id="dm-role"><option value="">Semua</option><option value="staff">Staff</option><option value="koordinator">Koordinator</option><option value="admin">Admin</option><option value="management">Management</option><option value="direksi">Direksi</option></select></label>
      <label>Dari<input id="dm-from" type="date"></label>
      <label>Sampai<input id="dm-to" type="date"></label>
      <label>Status<select id="dm-status"></select></label>
      <label>Aksi<select id="dm-action"></select></label>
    </div>
    <div class="dm-actions"><button class="primary" id="dm-preview-btn">Tampilkan Data Terdampak</button><button class="muted" data-dm-close>Batal</button></div>
    <div id="dm-preview" class="dm-preview" style="display:none"></div>
    <div id="dm-confirm" class="dm-confirm">
      <div id="dm-dep-confirm-wrap" style="display:none;margin-bottom:10px"><label style="font-weight:600"><input type="checkbox" id="dm-confirm-deps" style="width:auto;margin-right:6px">Saya memahami riwayat AIST terkait juga akan terhapus.</label></div>
      <div id="dm-type-wrap"><div style="font-size:12px;margin-bottom:5px">Ketik <strong>HAPUS DATA</strong> untuk Permanent Delete:</div><input id="dm-confirm-text" autocomplete="off" placeholder="HAPUS DATA"></div>
      <div class="dm-actions"><button class="danger" id="dm-execute-btn">Jalankan</button></div>
    </div>
  </div>`;
  document.body.appendChild(el);
  el.querySelectorAll('[data-dm-close]').forEach(x=>x.addEventListener('click',close));
  document.getElementById('dm-module').addEventListener('change',e=>configure(e.target.value));
  document.getElementById('dm-action').addEventListener('change',()=>{lastPreview=null;hidePreview()});
  document.getElementById('dm-preview-btn').addEventListener('click',preview);
  document.getElementById('dm-execute-btn').addEventListener('click',execute);
}
function configure(m){
  currentModule=m||currentModule; lastPreview=null;
  const mod=document.getElementById('dm-module');
  mod.innerHTML=[['attendance','HRIS — Absensi'],['finance_saldo','Finance — Isi Saldo (RAOS)'],['hris_karyawan','HRIS — Karyawan']].map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('');
  mod.value=currentModule;
  const br=document.getElementById('dm-branch');br.innerHTML=branchOptions(currentModule).map(x=>'<option value="'+esc(x[0])+'">'+esc(x[1])+'</option>').join('');
  const st=document.getElementById('dm-status');st.innerHTML=statusOptions(currentModule).map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('');
  const ac=document.getElementById('dm-action');
  if(currentModule==='finance_saldo')ac.innerHTML='<option value="archive">Archive / Hide (Disarankan)</option><option value="delete">Permanent Delete</option>';
  else if(currentModule==='attendance')ac.innerHTML='<option value="delete">Permanent Delete</option>';
  else ac.innerHTML='<option value="protected">Data Master Dilindungi</option>';
  document.getElementById('dm-from').disabled=currentModule==='hris_karyawan';
  document.getElementById('dm-to').disabled=currentModule==='hris_karyawan';
  document.getElementById('dm-branch').disabled=currentModule==='hris_karyawan';
  document.getElementById('dm-staff').disabled=currentModule==='hris_karyawan';
  document.getElementById('dm-role').disabled=currentModule==='hris_karyawan';
  document.getElementById('dm-status').disabled=currentModule==='hris_karyawan';
  hidePreview();
}
function open(m){
  inject(); currentModule=m||'attendance';
  document.getElementById('dm-from').value=monthStart();document.getElementById('dm-to').value=today();
  document.getElementById('dm-staff').value='';document.getElementById('dm-role').value='';
  configure(currentModule);
  document.getElementById('rifim-maintenance-modal').style.display='flex';
}
function close(){const e=document.getElementById('rifim-maintenance-modal');if(e)e.style.display='none';lastPreview=null}
function hidePreview(){const p=document.getElementById('dm-preview'),c=document.getElementById('dm-confirm');if(p)p.style.display='none';if(c)c.style.display='none'}
function payload(mode){
  return{
    mode,module:currentModule,
    branch_id:document.getElementById('dm-branch')?.value||'',
    staff:document.getElementById('dm-staff')?.value||'',
    role:document.getElementById('dm-role')?.value||'',
    date_from:document.getElementById('dm-from')?.value||monthStart(),
    date_to:document.getElementById('dm-to')?.value||today(),
    status:document.getElementById('dm-status')?.value||'semua',
    action:document.getElementById('dm-action')?.value||'delete'
  }
}
async function call(body){
  const t=token();if(!t)throw new Error('Session tidak tersedia. Silakan login kembali.');
  const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify(body),cache:'no-store'});
  const j=await r.json().catch(()=>({}));if(!r.ok||!j?.success)throw new Error(j?.message||'Permintaan gagal.');return j
}
async function preview(){
  const btn=document.getElementById('dm-preview-btn');btn.disabled=true;btn.textContent='Memeriksa...';
  try{
    const j=await call(payload('preview'));lastPreview=j.preview;
    const p=j.preview||{}, deps=p.dependent_rows||{}, warnings=Array.isArray(p.warnings)?p.warnings:[];
    const html=[
      '<strong>Data yang akan terdampak</strong>',
      '<div>Jumlah baris: <strong>'+Number(p.affected_rows||0)+'</strong></div>',
      '<div>Tabel: '+esc((p.tables||[]).join(', ')||'-')+'</div>',
      deps.aist_jobs!=null?'<div>AIST terkait: <strong>'+Number(deps.aist_jobs||0)+'</strong></div>':'',
      deps.payroll_rows!=null?'<div>Payroll terkait: <strong>'+Number(deps.payroll_rows||0)+'</strong></div>':'',
      deps.raos_payroll_rows!=null?'<div>Payroll RAOS terkait: <strong>'+Number(deps.raos_payroll_rows||0)+'</strong></div>':'',
      warnings.length?'<div style="margin-top:8px;color:#b45309"><strong>Perhatian:</strong><br>'+warnings.map(esc).join('<br>')+'</div>':'',
      p.protected?'<div style="margin-top:8px;color:#b91c1c"><strong>Data master dilindungi. Tidak ada penghapusan yang tersedia.</strong></div>':''
    ].join('');
    const box=document.getElementById('dm-preview');box.innerHTML=html;box.style.display='block';
    const conf=document.getElementById('dm-confirm');
    const canExecute=role()==='admin'&&!p.protected&&Number(p.affected_rows||0)>0;
    if(canExecute){
      conf.style.display='block';
      const isDelete=payload('x').action==='delete';
      document.getElementById('dm-type-wrap').style.display=isDelete?'block':'none';
      document.getElementById('dm-dep-confirm-wrap').style.display=(isDelete&&currentModule==='finance_saldo'&&Number(deps.aist_jobs||0)>0)?'block':'none';
      document.getElementById('dm-execute-btn').textContent=isDelete?'Permanent Delete':'Archive / Hide';
      document.getElementById('dm-execute-btn').className=isDelete?'danger':'warn';
    }else conf.style.display='none';
  }catch(e){
    const box=document.getElementById('dm-preview');box.textContent='❌ '+e.message;box.style.display='block';
  }finally{btn.disabled=false;btn.textContent='Tampilkan Data Terdampak'}
}
function clearOperationalCaches(){
  try{Object.keys(localStorage).filter(k=>/^hris_cache_(attendance|payroll|gapok)/i.test(k)||/^rifim_finance_/i.test(k)).forEach(k=>localStorage.removeItem(k))}catch(_){}
}
async function execute(){
  if(!lastPreview)return;
  const body=payload('execute');body.preview_token=lastPreview.preview_token;
  body.confirm_text=document.getElementById('dm-confirm-text')?.value||'';
  body.confirm_dependencies=!!document.getElementById('dm-confirm-deps')?.checked;
  const btn=document.getElementById('dm-execute-btn');btn.disabled=true;const old=btn.textContent;btn.textContent='Memproses...';
  try{
    const j=await call(body);clearOperationalCaches();
    const n=Number(j.result?.affected_rows||0);
    if(typeof global.showToast==='function')global.showToast('✅ '+n+' data berhasil '+(body.action==='archive'?'diarsipkan.':'dihapus.'),'success');
    if(currentModule==='attendance'){
      if(typeof global.loadAttendance==='function')await Promise.resolve(global.loadAttendance({forceRefresh:true})).catch(()=>{});
      if(typeof global.loadPayroll==='function'&&document.querySelector('#tab-payroll.active'))Promise.resolve(global.loadPayroll()).catch(()=>{});
    }
    if(currentModule==='finance_saldo'){
      if(typeof global.loadSaldoRaos==='function')await Promise.resolve(global.loadSaldoRaos()).catch(()=>{});
      if(global.FinanceDataRouter?.refreshSummary)Promise.resolve(global.FinanceDataRouter.refreshSummary(true)).catch(()=>{});
      if(typeof global.loadTargetCabang==='function')Promise.resolve(global.loadTargetCabang()).catch(()=>{});
      if(typeof global.loadTargetStaff==='function')Promise.resolve(global.loadTargetStaff()).catch(()=>{});
    }
    close();
  }catch(e){alert(e.message||String(e))}finally{btn.disabled=false;btn.textContent=old}
}
function bindButtons(){
  document.querySelectorAll('[data-maintenance-module]').forEach(b=>{
    if(b.dataset.dmBound==='1')return;b.dataset.dmBound='1';b.addEventListener('click',()=>open(b.dataset.maintenanceModule));
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{inject();bindButtons()},{once:true});else{inject();bindButtons()}
global.RifimDataMaintenance={open,preview,close,bindButtons};
})(window);

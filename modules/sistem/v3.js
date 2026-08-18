/* RIFIM OS — System Control Center V3 overlay.
 * Canonical 2026-08-18: legacy RAOS Web API writer actions are retired from UI.
 * Driver/Staff/credential syncs are owned by the canonical RAOS GAS triggers.
 */
(function(){
  'use strict';
  try{if(typeof ALLOWED_ROLES!=='undefined'&&!ALLOWED_ROLES.includes('direktur'))ALLOWED_ROLES.push('direktur');}catch(_){ }
  const PAGE_ROLES=['admin','direksi','direktur','management'];
  const WRITE_ROLES=['admin','direksi','direktur'];
  const RETIRED_ACTIONS=new Set([
    'sync_staff','sync_driver_airport','sync_driver_external','sync_raos_credentials',
    'force_refresh_staff_auth','force_refresh_driver_auth','run_kpi','run_backup','sync_selfie_drive'
  ]);
  let profile=null,running=null;

  function addStyle(){
    const s=document.createElement('style');s.textContent=`
      body{background:linear-gradient(rgba(20,20,20,.90),rgba(35,0,0,.88)),url('/branding/backgrounds/bagroun-maxim.png') center/cover fixed no-repeat!important}
      header{backdrop-filter:blur(12px)}
      .sys-v3-health{border-color:rgba(22,163,74,.45)!important}.sys-v3-pill{display:inline-block;padding:5px 9px;border-radius:999px;font-size:10px;font-weight:800;background:rgba(22,163,74,.18);color:#86efac;margin-top:6px}.sys-v3-pill.warn{background:rgba(234,179,8,.18);color:#fde047}.sys-v3-view{margin:0 0 18px;padding:11px 14px;border:1px solid rgba(234,179,8,.35);background:rgba(234,179,8,.10);border-radius:10px;color:#fde68a;font-size:12px}.sys-v3-retired{outline:1px solid rgba(100,116,139,.28);opacity:.88}.sys-v3-retired button{background:#64748b!important}.sys-v3-canonical{color:#86efac;font-weight:700}
    `;document.head.appendChild(s);
  }

  async function loadProfile(){
    const c=typeof sb==='function'?sb():null;if(!c)return;
    const {data:{session}}=await c.auth.getSession();if(!session)return;
    const {data:p}=await c.from('user_profiles').select('id,full_name,role,is_active').eq('id',session.user.id).maybeSingle();
    if(!p||!p.is_active||!PAGE_ROLES.includes(String(p.role||'').toLowerCase()))return;
    profile=p;
  }

  function mountHealth(){
    if(document.querySelector('[data-action="system_health"]'))return;
    const main=document.querySelector('main');if(!main)return;
    const section=document.createElement('div');section.className='section';section.innerHTML=`<h2>🩺 Health & Audit V3</h2><div class="grid"><div class="card sys-v3-health" data-action="system_health"><div class="icon">🩺</div><div class="title">Audit Health Sistem</div><div class="desc">Read-only langsung ke Supabase canonical: profile, Driver RAOS, HRIS employee, dan konektivitas data. Tidak menjalankan ulang writer SSOT.</div><span id="sys-v3-health-pill" class="sys-v3-pill">Belum diperiksa</span><button onclick="runAction('system_health',this)">Periksa Health</button><div class="result hidden"></div></div></div>`;
    const first=main.querySelector('.section');main.insertBefore(section,first||null);
  }

  function retireLegacyActions(){
    RETIRED_ACTIONS.forEach(action=>{
      const card=document.querySelector(`.card[data-action="${action}"]`);if(!card)return;
      card.classList.add('sys-v3-retired');
      const btn=card.querySelector('button');if(btn){btn.disabled=true;btn.textContent='Dikelola Otomatis';btn.title='Writer manual retired. Gunakan canonical RAOS GAS trigger/SSOT.';}
      const desc=card.querySelector('.desc');
      if(desc&&!desc.dataset.canonicalNote){
        desc.dataset.canonicalNote='1';
        desc.insertAdjacentHTML('beforeend','<br><span class="sys-v3-canonical">Canonical: otomatis via SSOT/RAOS GAS — tombol manual dinonaktifkan agar tidak membuat writer kedua.</span>');
      }
    });
  }

  async function localHealth(){
    const c=typeof sb==='function'?sb():null;
    if(!c)throw new Error('Supabase client tidak tersedia');
    const checks={};const blockers=[];
    async function count(name,table,filter){
      try{
        let q=c.from(table).select('*',{count:'exact',head:true});
        if(filter)q=filter(q);
        const {count,error}=await q;if(error)throw error;
        checks[name]={ok:true,count:Number(count||0)};
      }catch(e){checks[name]={ok:false,error:e&&e.message?e.message:String(e)};blockers.push(name+': '+checks[name].error);}
    }
    await Promise.all([
      count('active_profiles','user_profiles',q=>q.eq('is_active',true)),
      count('active_raos_drivers','raos_drivers',q=>q.eq('is_active',true)),
      count('active_hris_employees','employees',q=>q.eq('status','AKTIF'))
    ]);
    return {status:blockers.length?'warning':'ok',source:'supabase_canonical',checked_at:new Date().toISOString(),checks,blockers};
  }

  window.runAction=async function(action,btn){
    if(running){if(typeof toast==='function')toast('Proses '+running+' masih berjalan.','err');return;}
    if(!profile)await loadProfile();
    const role=String(profile&&profile.role||'').toLowerCase();
    const isRead=action==='system_health'||action==='system_log_recent'||action==='ping';
    if(RETIRED_ACTIONS.has(action)){
      if(typeof toast==='function')toast('Aksi manual ini sudah retired. Sinkronisasi dijalankan oleh canonical SSOT/RAOS GAS.','ok');
      return;
    }
    if(!isRead&&!WRITE_ROLES.includes(role)){if(typeof toast==='function')toast('Role '+(role||'-')+' adalah VIEW ONLY.','err');return;}

    const card=btn&&btn.closest('.card'),box=card&&card.querySelector('.result'),old=btn&&btn.textContent;running=action;
    if(btn){btn.disabled=true;btn.textContent='Menjalankan…';}if(box){box.className='result';box.textContent='Waiting…';}
    try{
      let data;
      if(action==='system_health'){
        const health=await localHealth();
        data={ok:true,label:'System Health Canonical',health,elapsed_ms:null};
      }else{
        // Non-writer compatibility reads only. No sync/write action is allowed here.
        const r=await callRaos(action);data=r;
      }
      if(!data||!data.ok)throw new Error((data&&data.error)||'Operasi gagal');
      const result=data.result||data.health||data;
      const warning=!!(result&&((result.errors||0)>0||(result.failed||0)>0||(result.warnings&&result.warnings.length)||(result.blockers&&result.blockers.length)||['warning','partial'].includes(result.status)));
      if(box){box.classList.add(warning?'err':'ok');box.textContent=(warning?'⚠ ':'✓ ')+(data.elapsed_ms!=null?data.elapsed_ms+'ms\n':'')+(typeof result==='string'?result:JSON.stringify(result,null,2));}
      if(action==='system_health'){
        const p=document.getElementById('sys-v3-health-pill');if(p){const n=(result.blockers||[]).length;p.textContent=n?n+' blocker':'Health canonical OK';p.classList.toggle('warn',!!n);}
      }
      if(typeof toast==='function')toast((warning?'⚠️ ':'✅ ')+(data.label||action)+' selesai',warning?'err':'ok');
    }catch(e){if(box){box.classList.add('err');box.textContent='✗ '+e.message;}if(typeof toast==='function')toast('❌ '+e.message,'err');}
    finally{running=null;if(btn){btn.disabled=false;btn.textContent=old||'Jalankan';}}
  };

  function boot(){
    addStyle();mountHealth();retireLegacyActions();loadProfile().catch(()=>{});
    const sub=document.querySelector('main .sub');if(sub)sub.innerHTML='System Control Center canonical. Writer manual Driver/Staff/RAOS Credentials telah retired; sinkronisasi berjalan melalui <strong>SSOT + RAOS GAS triggers</strong>.';
    const g=document.querySelector('#gate p');if(g)g.innerHTML='Halaman ini untuk role <strong>Admin, Direksi/Direktur, Management</strong>. Management bersifat view-only.';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

/* RIFIM OS — System Control Center V3 overlay.
 * Reuses the existing System page and RAOS Web API; no second maintenance engine.
 */
(function(){
  'use strict';
  try{if(typeof ALLOWED_ROLES!=='undefined'&&!ALLOWED_ROLES.includes('direktur'))ALLOWED_ROLES.push('direktur');}catch(_){ }
  const PAGE_ROLES=['admin','direksi','direktur','management'];
  const WRITE_ROLES=['admin','direksi','direktur'];
  const RISKY=new Set(['force_refresh_staff_auth','force_refresh_driver_auth','run_kpi','run_backup']);
  let profile=null,running=null;

  function addStyle(){
    const s=document.createElement('style');s.textContent=`
      body{background:linear-gradient(rgba(20,20,20,.90),rgba(35,0,0,.88)),url('/branding/backgrounds/bagroun-maxim.png') center/cover fixed no-repeat!important}
      header{backdrop-filter:blur(12px)}
      .sys-v3-health{border-color:rgba(22,163,74,.45)!important}.sys-v3-pill{display:inline-block;padding:5px 9px;border-radius:999px;font-size:10px;font-weight:800;background:rgba(22,163,74,.18);color:#86efac;margin-top:6px}.sys-v3-pill.warn{background:rgba(234,179,8,.18);color:#fde047}.sys-v3-view{margin:0 0 18px;padding:11px 14px;border:1px solid rgba(234,179,8,.35);background:rgba(234,179,8,.10);border-radius:10px;color:#fde68a;font-size:12px}.sys-v3-risk{outline:1px solid rgba(234,179,8,.22)}
    `;document.head.appendChild(s);
  }
  async function loadProfile(){
    const c=typeof sb==='function'?sb():null;if(!c)return;
    const {data:{session}}=await c.auth.getSession();if(!session)return;
    const {data:p}=await c.from('user_profiles').select('id,full_name,role,is_active').eq('id',session.user.id).maybeSingle();
    if(!p||!p.is_active||!PAGE_ROLES.includes(String(p.role||'').toLowerCase()))return;
    profile=p;
    if(!WRITE_ROLES.includes(String(p.role||'').toLowerCase())){
      const main=document.querySelector('main');if(main&&!document.getElementById('sys-v3-view')){const b=document.createElement('div');b.id='sys-v3-view';b.className='sys-v3-view';b.innerHTML='👁️ <b>Management = VIEW ONLY.</b> Aksi sinkronisasi, recovery, KPI, dan maintenance dinonaktifkan.';main.insertBefore(b,main.firstChild);}
      document.querySelectorAll('.card button').forEach(btn=>{const card=btn.closest('.card');const a=card&&card.dataset.action;if(a&&a!=='system_health'){btn.disabled=true;btn.title='Management = view only';}});
    }
  }
  function mountHealth(){
    if(document.querySelector('[data-action="system_health"]'))return;
    const main=document.querySelector('main');if(!main)return;
    const section=document.createElement('div');section.className='section';section.innerHTML=`<h2>🩺 Health & Audit V3</h2><div class="grid"><div class="card sys-v3-health" data-action="system_health"><div class="icon">🩺</div><div class="title">Audit Health Sistem</div><div class="desc">Read-only: profile source, RAOS PIN, System Config mirror, KPI/payroll canonical, dan blocker integrasi.</div><span id="sys-v3-health-pill" class="sys-v3-pill">Belum diperiksa</span><button onclick="runAction('system_health',this)">Periksa Health</button><div class="result hidden"></div></div></div>`;
    const first=main.querySelector('.section');main.insertBefore(section,first||null);
  }
  function markRisky(){RISKY.forEach(a=>{const c=document.querySelector(`.card[data-action="${a}"]`);if(c)c.classList.add('sys-v3-risk');});}
  async function preview(action){
    if(!RISKY.has(action))return true;
    try{const r=await callRaos('action_preview',{target_action:action});const summary=r&&r.ok&&r.preview?(r.preview.summary||JSON.stringify(r.preview,null,2)):'Preview tidak tersedia.';return confirm('PREVIEW AKSI\n\n'+summary+'\n\nLanjutkan aksi?');}
    catch(e){alert('Preview aksi gagal: '+e.message);return false;}
  }
  window.runAction=async function(action,btn){
    if(running){if(typeof toast==='function')toast('Proses '+running+' masih berjalan.','err');return;}
    if(!profile)await loadProfile();
    const role=String(profile&&profile.role||'').toLowerCase();
    const isRead=action==='system_health'||action==='system_log_recent'||action==='action_preview'||action==='ping';
    if(!isRead&&!WRITE_ROLES.includes(role)){if(typeof toast==='function')toast('Role '+(role||'-')+' adalah VIEW ONLY.','err');return;}
    if(!(await preview(action)))return;
    const card=btn&&btn.closest('.card'),box=card&&card.querySelector('.result'),old=btn&&btn.textContent;running=action;
    if(btn){btn.disabled=true;btn.textContent='Menjalankan…';}if(box){box.className='result';box.textContent='Waiting…';}
    try{
      const data=await callRaos(action);if(!data||!data.ok)throw new Error((data&&data.error)||'Operasi gagal');
      const result=data.result||data.health||data;const warning=!!(result&&((result.errors||0)>0||(result.failed||0)>0||(result.warnings&&result.warnings.length)||(result.blockers&&result.blockers.length)||['warning','partial'].includes(result.status)));
      if(box){box.classList.add(warning?'err':'ok');box.textContent=(warning?'⚠ ':'✓ ')+(data.elapsed_ms!=null?data.elapsed_ms+'ms\n':'')+(typeof result==='string'?result:JSON.stringify(result,null,2));}
      if(action==='system_health'){
        const p=document.getElementById('sys-v3-health-pill');if(p){const n=(result.blockers||[]).length;p.textContent=n?n+' blocker':'Health contract OK';p.classList.toggle('warn',!!n);}
      }
      if(typeof toast==='function')toast((warning?'⚠️ ':'✅ ')+(data.label||action)+' selesai',warning?'err':'ok');
      setTimeout(()=>{try{loadLog();}catch(_){}},800);
    }catch(e){if(box){box.classList.add('err');box.textContent='✗ '+e.message;}if(typeof toast==='function')toast('❌ '+e.message,'err');}
    finally{running=null;if(btn){btn.disabled=!WRITE_ROLES.includes(role)&&!isRead;btn.textContent=old||'Jalankan';}}
  };
  function boot(){addStyle();mountHealth();markRisky();loadProfile().catch(()=>{});const g=document.querySelector('#gate p');if(g)g.innerHTML='Halaman ini untuk role <strong>Admin, Direksi/Direktur, Management</strong>. Management bersifat view-only.';}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

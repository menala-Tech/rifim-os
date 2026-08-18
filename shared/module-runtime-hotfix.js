(function(global){
'use strict';
var path=String(location.pathname||'');
var SB_URL='https://vlievtojpmrbsmzlqswl.supabase.co';
var SB_KEY='sb_publishable_8KpL6zmpt_O_x21v4Jn3Tw_J_I3y-r1';

function readAuth(){try{return JSON.parse(localStorage.getItem('rifim_auth')||'{}')||{}}catch(_){return{}}}
function normRole(v){v=String(v||'').trim().toLowerCase();if(v==='direktur'||v==='direktur utama')return'direksi';if(v==='mgmt'||v==='manajemen')return'management';if(v==='koord'||v==='coordinator')return'koordinator';return v}
function canWrite(){return ['admin','direksi'].includes(normRole(readAuth().role))}
function loadScript(src,marker){return new Promise(function(resolve,reject){if(marker&&document.querySelector('script['+marker+']')){resolve();return}var s=document.createElement('script');s.src=src;s.async=false;if(marker)s.setAttribute(marker,'1');s.onload=function(){resolve()};s.onerror=function(){reject(new Error('Gagal load '+src))};document.head.appendChild(s)})}

function installCrmCompat(){
  if(!/^\/crm(?:\/|$)/.test(path))return;
  if(typeof global._wlCurrentUserEmail!=='function')global._wlCurrentUserEmail=function(){return String(readAuth().email||'').trim()};
}

function installHrisActions(){
  if(!/^\/hris(?:\/|$)/.test(path))return;
  function decorate(){
    var tb=document.getElementById('tbody-employees');if(!tb)return;
    Array.from(tb.querySelectorAll('tr')).forEach(function(tr){
      if(!tr.cells||tr.cells.length<10||tr.querySelector('.loading,.empty-state'))return;
      var id=String(tr.cells[0].textContent||'').trim();if(!id||/MEMUAT|LOADING|GAGAL|BELUM ADA/i.test(id))return;
      var cell=tr.cells[tr.cells.length-1];if(!cell)return;
      if(!cell.querySelector('[data-hris-detail]')){
        var detail=cell.querySelector('button[onclick*="viewEmployee"]');
        if(detail){detail.dataset.hrisDetail='1';detail.textContent='Detail'}
        else{detail=document.createElement('button');detail.type='button';detail.className='btn btn-ghost btn-sm';detail.dataset.hrisDetail='1';detail.textContent='Detail';detail.onclick=function(){if(typeof global.viewEmployee==='function')global.viewEmployee(id)};cell.appendChild(detail)}
      }
      if(canWrite()&&!cell.querySelector('[data-hris-edit]')){
        var edit=document.createElement('button');edit.type='button';edit.className='btn btn-ghost btn-sm';edit.dataset.hrisEdit='1';edit.textContent='✏️ Edit';edit.style.marginLeft='5px';edit.onclick=function(){if(typeof global.viewEmployee==='function')global.viewEmployee(id);setTimeout(function(){if(typeof global.openEditModal==='function')global.openEditModal()},0)};cell.appendChild(edit)
      }
      if(canWrite()&&!cell.querySelector('[data-create-pkwt]')){
        var pk=document.createElement('button');pk.type='button';pk.className='btn btn-secondary btn-sm';pk.dataset.createPkwt=id;pk.textContent='📝 PKWT';pk.style.marginLeft='5px';pk.title='Buat PKWT dari data HRIS';pk.onclick=function(ev){ev.preventDefault();ev.stopPropagation();location.href='/smart-office?doc=PKWT&employee_id='+encodeURIComponent(id)};cell.appendChild(pk)
      }
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorate,{once:true});else decorate();
  var tries=0,t=setInterval(function(){tries++;decorate();if(tries>120)clearInterval(t)},250);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){var tb=document.getElementById('tbody-employees');if(tb)new MutationObserver(decorate).observe(tb,{childList:true,subtree:true})},{once:true});
  else{var tb=document.getElementById('tbody-employees');if(tb)new MutationObserver(decorate).observe(tb,{childList:true,subtree:true})}
}

function installSmartOfficeBridge(){
  if(!/^\/smart-office(?:\/|$)/.test(path))return;
  loadScript('/shared/smart-office-hris-sync.js?v=20260818-deeplink-2','data-smart-office-hris-sync').catch(function(e){console.warn('[SmartOffice bridge]',e.message||e)});
}

async function repairSystem(){
  if(!/^\/sistem(?:\/|$)/.test(path))return;
  try{
    if(!global.RifimMasterRolePolicy)await loadScript('/shared/master-role-policy.js?v=20260818-role-2','data-system-role-policy');
    if(!global.RifimPortalSession)await loadScript('/shared/portal-session.js?v=20260818-system-session-1','data-system-portal-session');
    var session=global.RifimPortalSession?await global.RifimPortalSession.require({allowedRoles:['admin','direksi','management'],redirect:'/portal',noRedirect:true}):readAuth();
    if(!session||!session.access_token)return;
    var gate=document.getElementById('gate'),app=document.getElementById('app'),info=document.getElementById('user-info');
    if(gate)gate.style.display='none';if(app)app.style.display='block';if(info)info.textContent=(session.full_name||session.name||session.email||'User')+' · '+normRole(session.role);

    global.callRaos=async function(action,extra){
      if(action!=='system_log_recent')return{ok:false,error:'Aksi writer legacy dinonaktifkan. Sinkronisasi SSOT → Supabase dikelola otomatis oleh pipeline canonical.'};
      var limit=Math.min(200,Math.max(1,Number(extra&&extra.limit||50)));
      var liveSession=(global.RifimPortalSession&&global.RifimPortalSession.read&&global.RifimPortalSession.read())||session;
      var token=String(liveSession.access_token||'');
      var url=SB_URL+'/rest/v1/system_logs?select=id,type,process,status,detail,created_at&order=created_at.desc&limit='+limit;
      var r=await fetch(url,{headers:{apikey:SB_KEY,Authorization:'Bearer '+token,Accept:'application/json'},cache:'no-store'});
      var rows=await r.json().catch(function(){return[]});
      if(!r.ok)throw new Error((rows&&rows.message)||('System Log HTTP '+r.status));
      return{ok:true,rows:Array.isArray(rows)?rows:[]};
    };

    document.querySelectorAll('.card[data-action] button').forEach(function(b){b.disabled=true;b.textContent='Dikelola Otomatis';b.title='Writer manual legacy dinonaktifkan; pipeline canonical berjalan otomatis'});
    var sub=document.querySelector('main .sub');if(sub)sub.innerHTML='Admin Console · session canonical Portal aktif. Writer manual legacy dinonaktifkan; monitoring membaca <code>system_logs</code> Supabase langsung.';
    if(typeof global.loadLog==='function')global.loadLog();
  }catch(e){console.warn('[System session repair]',e.message||e)}
}
function scheduleSystemRepair(){if(!/^\/sistem(?:\/|$)/.test(path))return;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',repairSystem,{once:true});else setTimeout(repairSystem,0)}

installCrmCompat();
installHrisActions();
installSmartOfficeBridge();
scheduleSystemRepair();
global.RifimModuleRuntimeHotfix={version:'1.0.1',repairSystem:repairSystem};
})(window);

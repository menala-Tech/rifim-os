(function(global){
'use strict';

function currentRole(){
  try{
    return String(global.currentUser?.role||JSON.parse(localStorage.getItem('rifim_auth')||'{}').role||'').toLowerCase();
  }catch(_){
    return '';
  }
}

function canWrite(){
  return ['admin','direksi'].includes(currentRole());
}

function isRealEmployeeRow(row){
  if(!row||!row.cells||row.cells.length<10)return false;
  if(row.querySelector('.loading,.empty-state'))return false;

  const employeeId=String(row.cells[0]?.textContent||'').trim();
  const statusText=String(row.cells[7]?.textContent||'').trim().toUpperCase();

  if(!employeeId||!statusText)return false;
  if(/MEMUAT|LOADING|BELUM ADA|GAGAL|TIDAK ADA/i.test(employeeId))return false;
  if(!['AKTIF','RESIGN','PHK','NONAKTIF','NON-AKTIF'].includes(statusText))return false;

  return true;
}

function decorateEmployeeRows(){
  if(!canWrite())return;

  document.querySelectorAll('#tbody-employees tr').forEach(row=>{
    if(!isRealEmployeeRow(row))return;

    const actionCell=row.lastElementChild;
    if(!actionCell||actionCell.querySelector('[data-activate-employee]'))return;

    const employeeId=String(row.cells[0]?.textContent||'').trim();
    const statusText=String(row.cells[7]?.textContent||'').trim().toUpperCase();
    if(statusText==='AKTIF')return;

    const btn=document.createElement('button');
    btn.type='button';
    btn.className='btn btn-success btn-sm';
    btn.dataset.activateEmployee=employeeId;
    btn.textContent='✅ Aktifkan';
    btn.addEventListener('click',()=>activateEmployee(employeeId,btn));
    actionCell.appendChild(document.createTextNode(' '));
    actionCell.appendChild(btn);
  });
}

async function activateEmployee(employeeId,btn){
  if(!employeeId||/MEMUAT|LOADING/i.test(employeeId))return;
  if(!confirm(`Aktifkan ${employeeId}?`))return;

  btn.disabled=true;
  const original=btn.textContent;
  btn.textContent='Memproses...';

  try{
    const session=global.RifimPortalSession?.read?.();
    const token=session?.access_token||'';
    if(!token)throw new Error('Session tidak tersedia. Silakan login kembali.');

    const r=await fetch('/api/internal/hris-contracts',{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
      body:JSON.stringify({mode:'hris_activate',employee_id:employeeId}),
      cache:'no-store'
    });
    const j=await r.json();
    if(!r.ok||!j?.success)throw new Error(j?.message||'Aktivasi staff gagal.');

    btn.textContent='✅ Aktif';
    const row=btn.closest('tr');
    if(row){
      const statusCell=row.cells?.[7];
      if(statusCell)statusCell.innerHTML='<span class="badge badge-aktif">AKTIF</span>';
      row.dataset.activationState='active';
    }
    if(typeof global.showToast==='function')global.showToast(j.message||'✅ Staff berhasil diaktifkan','success');

    // Refresh canonical data in background; the row has already updated immediately.
    if(typeof global.loadEmployees==='function')Promise.resolve(global.loadEmployees({forceRefresh:true})).catch(()=>{});
    return j.row;
  }catch(err){
    btn.disabled=false;
    btn.textContent=original;
    const msg=err?.message||String(err);
    if(typeof global.showToast==='function')global.showToast(msg,'error');
    else alert(msg);
  }
}

function start(){
  decorateEmployeeRows();
  new MutationObserver(decorateEmployeeRows).observe(
    document.getElementById('tbody-employees')||document.body,
    {childList:true,subtree:true}
  );
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();

global.HrisEmployeeActivationUI={decorateEmployeeRows,activateEmployee};
})(window);

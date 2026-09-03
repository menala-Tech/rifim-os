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
    if(!actionCell)return;

    const employeeId=String(row.cells[0]?.textContent||'').trim();
    const statusText=String(row.cells[7]?.textContent||'').trim().toUpperCase();

    // Row NONAKTIF/RESIGN/PHK → tombol Aktifkan (existing behavior)
    if(statusText!=='AKTIF'){
      if(actionCell.querySelector('[data-activate-employee]'))return;
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='btn btn-success btn-sm';
      btn.dataset.activateEmployee=employeeId;
      btn.textContent='✅ Aktifkan';
      btn.addEventListener('click',()=>activateEmployee(employeeId,btn));
      actionCell.appendChild(document.createTextNode(' '));
      actionCell.appendChild(btn);
      return;
    }

    // Row AKTIF → tombol Nonaktifkan (soft-delete). Sengaja pakai
    // btn-secondary (bukan btn-danger) supaya visual tidak menakutkan —
    // ini soft-delete, tinggal Aktifkan lagi kalau salah pencet.
    if(actionCell.querySelector('[data-deactivate-employee]'))return;
    const dbtn=document.createElement('button');
    dbtn.type='button';
    dbtn.className='btn btn-secondary btn-sm';
    dbtn.dataset.deactivateEmployee=employeeId;
    dbtn.textContent='🚫 Nonaktifkan';
    dbtn.title='Set is_active=false. Data absensi/payroll historis tetap aman. Bisa di-Aktifkan lagi kapan saja.';
    dbtn.addEventListener('click',()=>deactivateEmployee(employeeId,dbtn));
    actionCell.appendChild(document.createTextNode(' '));
    actionCell.appendChild(dbtn);
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

async function deactivateEmployee(employeeId,btn){
  if(!employeeId||/MEMUAT|LOADING/i.test(employeeId))return;
  if(!confirm(
    `Nonaktifkan ${employeeId}?\n\n`+
    `Status berubah jadi NONAKTIF (is_active=false). Data absensi/payroll `+
    `historis tetap aman. Anda bisa Aktifkan lagi kapan saja.`
  ))return;

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
      body:JSON.stringify({mode:'hris_deactivate',employee_id:employeeId}),
      cache:'no-store'
    });
    const j=await r.json();
    if(!r.ok||!j?.success)throw new Error(j?.message||'Nonaktifkan staff gagal.');

    btn.textContent='🚫 Nonaktif';
    const row=btn.closest('tr');
    if(row){
      const statusCell=row.cells?.[7];
      if(statusCell)statusCell.innerHTML='<span class="badge badge-nonaktif">NONAKTIF</span>';
      row.dataset.activationState='inactive';
    }
    if(typeof global.showToast==='function')global.showToast(j.message||'🚫 Staff dinonaktifkan','success');
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

global.HrisEmployeeActivationUI={decorateEmployeeRows,activateEmployee,deactivateEmployee};
})(window);

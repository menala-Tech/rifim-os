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
    btn.textContent='✓ Aktifkan';
    btn.addEventListener('click',()=>activateEmployee(employeeId,btn));
    actionCell.appendChild(document.createTextNode(' '));
    actionCell.appendChild(btn);
  });
}

async function activateEmployee(employeeId,btn){
  if(!employeeId||/MEMUAT|LOADING/i.test(employeeId))return;
  if(!confirm(`Aktifkan ${employeeId} dan mulai sinkronisasi ke modul?`))return;

  btn.disabled=true;
  const original=btn.textContent;
  btn.textContent='Memproses...';

  try{
    const sb=global.supabase?.rpc?global.supabase:global._supabase;
    if(!sb?.rpc)throw new Error('Supabase client HRIS tidak ditemukan');

    const{data,error}=await sb.rpc('hris_activate_employee',{p_employee_id:employeeId});
    if(error)throw error;

    btn.textContent='✓ Aktif';
    if(typeof global.showToast==='function')global.showToast('Karyawan aktif. Event sinkron modul dibuat.','success');
    if(typeof global.loadEmployees==='function')global.loadEmployees();
    return data;
  }catch(err){
    btn.disabled=false;
    btn.textContent=original;
    alert(err.message||String(err));
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

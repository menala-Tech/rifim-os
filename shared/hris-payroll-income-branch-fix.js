(function(global){
'use strict';
if(!/\/hris(?:\/|$)/.test(String(location.pathname||'')))return;

function session(){try{return JSON.parse(localStorage.getItem('rifim_auth')||'{}')||{}}catch(_){return{}}}
function token(){return String(session().access_token||'')}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function money(n){return 'Rp '+Number(n||0).toLocaleString('id-ID')}
function role(){var r=String((global.currentUser&&global.currentUser.role)||session().role||'').toLowerCase();return r==='direktur'?'direksi':r==='koord'?'koordinator':r==='mgmt'?'management':r}

async function api(mode,params){
  var u='/api/internal/hris-v2?mode='+encodeURIComponent(mode);
  Object.keys(params||{}).forEach(function(k){if(params[k]!=null&&params[k]!=='')u+='&'+encodeURIComponent(k)+'='+encodeURIComponent(params[k])});
  var r=await fetch(u,{headers:{Authorization:'Bearer '+token(),'Content-Type':'application/json'},cache:'no-store'});
  var j=await r.json().catch(function(){return{success:false,message:'Response API tidak valid'}});
  if(!r.ok||j.success===false)throw new Error(j.message||'API gagal');
  return j;
}

var branchesCache=null;
async function ensureBranches(selectId){
  var sel=document.getElementById(selectId);
  if(!sel||sel.dataset.branchFix==='1')return;
  try{
    var j=branchesCache||await api('branches');
    branchesCache=j;
    var rows=j.rows||[];
    if(!rows.length)return;
    var current=sel.value;
    var isKoord=role()==='koordinator';
    var html=isKoord?'':'<option value="ALL">Semua Cabang</option>';
    html+=rows.map(function(b){return '<option value="'+esc(b.id)+'">'+esc(b.name)+(b.code?' ('+esc(b.code)+')':'')+'</option>'}).join('');
    if(!isKoord&&['admin','management','direksi'].includes(role()))html+='<option value="HEAD_OFFICE">Head Office</option>';
    sel.innerHTML=html;
    if(current&&Array.from(sel.options).some(function(o){return o.value===current}))sel.value=current;
    else if(isKoord&&rows[0])sel.value=rows[0].id;
    sel.disabled=isKoord;
    sel.dataset.branchFix='1';
  }catch(e){console.warn('[HRIS payroll branch fix]',e.message)}
}

function company(r){
  var c=String(r.company_code||'RIFIM').toUpperCase();
  if(c==='MIG')return{name:'PT. MENALA INTERNASIONAL GEMILANG',logo:'/stempel%20Menala.png'};
  if(c==='LAILAN')return{name:'CV. LAILAN KALILAN INDONESIA',logo:'/stempel%20lailankalilan.png'};
  return{name:'PT. RIFIM INTERNASIONAL GEMILANG',logo:'/branding/logo/logo-rifim-transparent.png'};
}

function slipHtml(r){
  var co=company(r),month=document.getElementById('hv2-month')?.selectedOptions[0]?.text||'';
  var paket=Number(r.paket_data||0);
  var bpjs=Number(r.bpjs||0);
  var parkir=Number(r.member_parkir||0);
  return '<!doctype html><html><head><meta charset="utf-8"><title>Slip '+esc(r.employee_id)+'</title><style>@page{size:A4;margin:16mm}body{font:12px Arial;color:#111}.head{display:flex;align-items:center;gap:16px;border-bottom:3px solid #c40000;padding-bottom:10px}.head img{width:90px;max-height:70px;object-fit:contain}.head h2{margin:0}.title{text-align:center;margin:22px 0 14px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 22px}.box{margin-top:18px;border:1px solid #ddd;border-radius:8px;overflow:hidden}.box h3{margin:0;padding:8px 10px;background:#f3f4f6}.line{display:flex;justify-content:space-between;padding:6px 10px;border-top:1px solid #eee}.total{font-size:16px;font-weight:bold;background:#ecfdf5}.foot{margin-top:28px;border-top:1px solid #ddd;padding-top:10px;font-size:10px;color:#666}</style></head><body>'+
  '<div class="head"><img src="'+esc(co.logo)+'"><div><h2>'+esc(co.name)+'</h2><div>Cabang: '+esc(r.branch||'Head Office')+'</div></div></div>'+
  '<div class="title"><h2>SLIP GAJI</h2><b>'+esc(month)+'</b></div>'+
  '<div class="grid"><div>ID Karyawan: <b>'+esc(r.employee_id)+'</b></div><div>Nama: <b>'+esc(r.name)+'</b></div><div>Jabatan: '+esc(r.position||'–')+'</div><div>Cabang: '+esc(r.branch||'–')+'</div><div>No Dokumen: <b>'+esc(r.document_number||'DRAFT — belum diterbitkan')+'</b></div><div>Status: '+esc(r.status)+'</div></div>'+
  '<div class="box"><h3>Pendapatan</h3>'+
  '<div class="line"><span>Gaji Pokok</span><span>'+money(r.salary_base)+'</span></div>'+
  '<div class="line"><span>Bonus Saldo RAOS</span><span>'+money(r.bonus_saldo)+'</span></div>'+
  '<div class="line"><span>Bonus KPI</span><span>'+money(r.bonus_kpi)+'</span></div>'+
  '<div class="line"><span>Paket Data</span><span>'+money(paket)+'</span></div>'+
  '<div class="line"><span>BPJS</span><span>'+money(bpjs)+'</span></div>'+
  (parkir?'<div class="line"><span>Member Parkir</span><span>'+money(parkir)+'</span></div>':'')+
  '</div>'+
  '<div class="box"><h3>Potongan</h3>'+
  '<div class="line"><span>Terlambat ('+Number(r.late_minutes||0)+' menit)</span><span>'+money(r.late_deduction)+'</span></div>'+
  '<div class="line"><span>Kasbon</span><span>'+money(r.kasbon||0)+'</span></div>'+
  '<div class="line total"><span>TOTAL PEMBAYARAN</span><span>'+money(r.total_salary)+'</span></div></div>'+
  '<div class="foot">No Dokumen: '+esc(r.document_number||'DRAFT')+' · Generated by RIFIM OS · Data FINAL menggunakan snapshot payroll dan tidak dihitung ulang.</div><script>onload=()=>setTimeout(()=>print(),300)<\/script></body></html>';
}

async function getPayrollRows(){
  var month=document.getElementById('hv2-month')?.value||new Date().toISOString().slice(0,7);
  var branch=document.getElementById('hv2-branch')?.value||'ALL';
  var j=await api('payroll',{month:month,branch_id:branch==='ALL'?'':branch});
  return j.rows||[];
}

async function payPdf(i){
  try{
    var rows=await getPayrollRows(),r=rows[i];
    if(!r)return;
    var w=open('','_blank','width=850,height=720');
    if(!w)return alert('Popup diblokir browser.');
    w.document.write(slipHtml(r));w.document.close();
  }catch(e){alert(e.message)}
}

async function payrollAllPdf(){
  try{
    var rows=await getPayrollRows();if(!rows.length)return alert('Belum ada data payroll.');
    var w=open('','_blank','width=900,height=720');if(!w)return alert('Popup diblokir browser.');
    var pages=rows.map(function(r){return '<section style="break-after:page">'+slipHtml(r).replace(/^.*?<body>/s,'').replace(/<script>.*$/s,'')+'</section>'}).join('');
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:14mm}body{font:11px Arial}section{padding:4px}.head{display:flex;gap:12px;border-bottom:2px solid #c40000}.head img{width:75px}.line{display:flex;justify-content:space-between;padding:5px;border-bottom:1px solid #eee}.box{margin-top:10px}.total{font-weight:bold}</style></head><body>'+pages+'<script>onload=()=>setTimeout(()=>print(),350)<\/script></body></html>');w.document.close();
  }catch(e){alert(e.message)}
}

function patch(){
  ensureBranches('hv2-branch');
  ensureBranches('filter-att-branch');
  if(global.HRISV2){global.HRISV2.payPdf=payPdf;global.HRISV2.payrollAllPdf=payrollAllPdf}
  var all=document.getElementById('hv2-allpdf');if(all)all.onclick=payrollAllPdf;
}

new MutationObserver(patch).observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(patch,50)},{once:true});else setTimeout(patch,50);
})(window);

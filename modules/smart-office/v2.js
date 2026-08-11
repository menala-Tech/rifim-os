/* Smart Office V2 frontend controller — canonical doc workflow. */
(function(){
  'use strict';
  let documentId=null;
  let approvalStatus='draft';
  let lastApprovalId=null;
  const q=id=>document.getElementById(id);
  const auth=()=>typeof getPortalAuth==='function'?getPortalAuth():{};
  const normRole=()=>String(auth().role||'').toLowerCase().replace(/\s+/g,'_').replace('direktur_utama','direktur');
  const isDireksi=()=>['direksi','direktur'].includes(normRole());
  const canWrite=()=>['admin','direksi','direktur'].includes(normRole());
  const hasLegacyFallback=()=>typeof generateDoc==='function'&&typeof previewDoc==='function';

  async function post(action,extra){
    const payload=typeof buildPayload==='function'?buildPayload():{};
    Object.assign(payload,extra||{},{action});
    payload.performed_by={name:auth().full_name||auth().name||'',email:auth().email||''};
    const res=await fetch(GAS_WEB_APP_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(payload)});
    const data=await res.json();
    if(data?.success===false||data?.ok===false)throw new Error(data?.message||data?.error||'Operasi gagal');
    return data;
  }

  function render(){
    const status=q('soV2Status');
    if(status){status.textContent=String(approvalStatus||'draft').toUpperCase();status.dataset.status=String(approvalStatus||'draft').toUpperCase();}
    const submit=q('soV2Submit'); if(submit)submit.disabled=!documentId||!canWrite()||approvalStatus==='pending_approval'||approvalStatus==='approved';
    const approve=q('soV2Approve'); if(approve){approve.style.display=isDireksi()?'inline-flex':'none';approve.disabled=!lastApprovalId||approvalStatus!=='pending_approval';}
    const gen=q('soV2Generate'); if(gen)gen.disabled=!documentId||approvalStatus!=='approved';
    const chat=q('soV2Chat'); if(chat)chat.disabled=!lastResult||approvalStatus!=='approved';
    const legacy=document.querySelector('.form-actions .btn.btn-primary');
    if(legacy){legacy.disabled=true;legacy.style.display='none';}
  }

  async function ensureDraft(){
    if(documentId)return documentId;
    const r=await post('so_create_draft',{request_source:'SMART_OFFICE'});
    documentId=r.documentId;approvalStatus=r.status||'draft';render();return documentId;
  }

  window.soV2Preview=async()=>{
    try{const r=await post('so_preview',{});if(typeof _openPreviewModal==='function')_openPreviewModal(r.html,currentCode);else throw new Error('Preview modal tidak tersedia.');}
    catch(e){showToast('❌ '+e.message,false);}
  };
  window.soV2SubmitApproval=async()=>{
    try{await ensureDraft();const r=await post('so_submit',{documentId});approvalStatus=r.status||'pending_approval';render();showToast('📨 Pengajuan dikirim ke Direksi',true);}
    catch(e){showToast('❌ '+e.message,false);}
  };
  window.soV2LoadPending=async()=>{
    if(!isDireksi())return;
    try{const r=await post('so_pending_direksi',{});const a=(r.approvals||[])[0];if(a){lastApprovalId=a.id;documentId=a.document_id||documentId;approvalStatus='pending_approval';render();}}
    catch(_){/* non-blocking */}
  };
  window.soV2Approve=async()=>{
    try{if(!lastApprovalId)throw new Error('Approval pending belum dipilih.');const r=await post('so_decide',{approvalId:lastApprovalId,decision:'approved'});approvalStatus=r.documentStatus||'approved';render();showToast('✅ Dokumen disetujui Direksi',true);}
    catch(e){showToast('❌ '+e.message,false);}
  };
  window.soV2Generate=async()=>{
    try{if(!documentId)throw new Error('Draft belum dibuat.');if(approvalStatus!=='approved')throw new Error('Dokumen belum disetujui Direksi.');setLoading(true,'Generate DOC + PDF...');const r=await post('so_generate',{documentId});setLoading(false);lastResult=r;showResult(r);render();}
    catch(e){setLoading(false);showToast('❌ '+e.message,false);}
  };
  window.soV2SendChat=async()=>{
    try{if(!documentId||!lastResult)throw new Error('Generate dokumen final dulu.');const target=prompt('Kirim ke: branch atau staff','branch');if(!target)return;const extra={documentId,target_type:target};if(target==='branch')extra.branch_name=prompt('Nama cabang HRIS');else extra.employee_id=prompt('Employee ID');await post('so_send_chat',extra);showToast('💬 Dokumen dikirim ke RAOS Chat',true);}
    catch(e){showToast('❌ '+e.message,false);}
  };

  function mount(){
    const actions=document.querySelector('.form-actions');if(!actions||q('soV2Workflow')||!hasLegacyFallback())return;
    actions.querySelectorAll('button').forEach(btn=>{if(btn.textContent&&btn.textContent.includes('Preview'))btn.style.display='none';});
    const wrap=document.createElement('div');wrap.id='soV2Workflow';wrap.className='so-v2-workflow';wrap.innerHTML='\
<span id="soV2Status" class="so-v2-status" data-status="DRAFT">DRAFT</span>\
<button class="so-v2-btn so-v2-preview" onclick="soV2Preview()">👁 Preview</button>\
<button id="soV2Submit" class="so-v2-btn so-v2-submit" onclick="soV2SubmitApproval()">📨 Ajukan ke Direksi</button>\
<button id="soV2Approve" class="so-v2-btn so-v2-approve" onclick="soV2Approve()">✅ Setujui Direksi</button>\
<button id="soV2Generate" class="so-v2-btn so-v2-generate" onclick="soV2Generate()">⚡ Generate DOC + PDF</button>\
<button id="soV2Chat" class="so-v2-btn so-v2-chat" onclick="soV2SendChat()">💬 Kirim ke RAOS Chat</button>';
    actions.parentNode.insertBefore(wrap,actions.nextSibling);render();window.soV2LoadPending();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();

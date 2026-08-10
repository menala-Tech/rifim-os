/** Smart Office V2 — RAOS chat delivery via existing service-role RPC bridge. */
function soV2SendChat_(input){
  var ctx=soV2Auth_(input);soV2RequireWrite_(ctx);
  var doc=soV2GetCanonicalDocument_(input.documentId);
  if(String(doc.status||'').toLowerCase()!=='approved')throw new Error('Hanya dokumen approved yang dapat dikirim.');
  if(!doc.pdf_url)throw new Error('Dokumen final belum memiliki PDF.');
  var metadata={document_id:doc.id,document_number:doc.doc_number||'',pdf_url:doc.pdf_url,gdoc_url:doc.metadata&&doc.metadata.gdoc_url||'',company_slug:doc.company_slug||'',doc_type:doc.doc_type||''};
  var content=['📄 Dokumen Smart Office','','No: '+(doc.doc_number||'-'),'Jenis: '+(doc.doc_type||'-'),'Perihal: '+(doc.title||'-'),'PDF: '+doc.pdf_url,metadata.gdoc_url?'DOC: '+metadata.gdoc_url:'','','RIFIM OS — Smart Office'].filter(Boolean).join('\n');
  var roomId=null;
  if(input.target_type==='staff'){
    var employee=hrisGetEmployee(input.employee_id);if(!employee)throw new Error('Employee target tidak ditemukan.');
    var profiles=_sbGet(_docRestUrl_('user_profiles',['staff_id=eq.'+encodeURIComponent(employee.employee_id),'is_active=eq.true','select=id','limit=1']));
    if(!profiles||!profiles.length)throw new Error('Akun RAOS staff belum terhubung ke employee.');
    roomId=_supaRpc('raos_resolve_private_room',{p_user_id:profiles[0].id});
  }else if(input.target_type==='branch'){
    var branchId=input.branch_id||null;
    if(!branchId&&input.branch_name&&typeof BRANCH_ID_BY_NAME!=='undefined')branchId=BRANCH_ID_BY_NAME[input.branch_name]||null;
    if(!branchId&&input.branch_name){var br=_sbGet(_docRestUrl_('branches',['name=eq.'+encodeURIComponent(input.branch_name),'is_active=eq.true','select=id','limit=1']));if(br&&br.length)branchId=br[0].id;}
    if(!branchId)throw new Error('branch_id/branch_name wajib untuk room cabang.');
    // Existing Driver room is the current branch-operational room; membership already includes staff/koord/admin/mgmt/direksi.
    roomId=_supaRpc('raos_resolve_driver_room',{p_branch_id:branchId});
    metadata.branch_id=branchId;
  }else throw new Error('target_type harus staff atau branch.');
  if(!roomId)throw new Error('Room RAOS target tidak ditemukan.');
  var messageId=_chatPostSystem(roomId,content,'smart_office_document',metadata);
  return{success:true,roomId:roomId,messageId:messageId};
}

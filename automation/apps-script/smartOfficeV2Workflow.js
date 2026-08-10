/** Smart Office V2 — canonical workflow. Approval is Direksi-only and stays in canonical doc_* tables. */
function soV2EmployeeProfile_(employeeId){
  var rows=_sbGet(_docRestUrl_('employees',['employee_id=eq.'+encodeURIComponent(employeeId),'select=id,employee_id,full_name,email,branch','limit=1']));
  if(!rows||!rows.length)throw new Error('Employee tidak ditemukan: '+employeeId);
  var emp=rows[0];
  var profiles=_sbGet(_docRestUrl_('user_profiles',['staff_id=eq.'+encodeURIComponent(emp.employee_id),'select=id,staff_id,branch_id,email,role,is_active','limit=1']));
  return {employee:emp,profile:profiles&&profiles.length?profiles[0]:null};
}
function soV2AssertRequestScope_(ctx,input){
  var employeeId=input.extra&&input.extra.employee_id||input.employee_id;
  if(!employeeId)return;
  var linked=soV2EmployeeProfile_(employeeId);
  if(ctx.role==='staff'&&String(ctx.staffId||'')!==String(employeeId))throw new Error('Staff hanya boleh mengajukan dokumen untuk dirinya sendiri.');
  if(ctx.role==='koordinator'){
    if(!ctx.branchId||!linked.profile||String(linked.profile.branch_id||'')!==String(ctx.branchId))throw new Error('Koordinator hanya boleh mengajukan dokumen karyawan di cabangnya sendiri.');
  }
  input._scope_branch_id=linked.profile&&linked.profile.branch_id||ctx.branchId||null;
}
function soV2CreateCanonicalDraft_(input){
  var ctx=soV2Auth_(input);var source=String(input.request_source||'SMART_OFFICE').toUpperCase();
  if(source==='RAOS'){if(!soV2CanEmployeeRequest_(ctx.role))throw new Error('Role tidak boleh mengajukan dokumen karyawan.');soV2AssertRequestScope_(ctx,input);}else soV2RequireWrite_(ctx);
  input=soV2EnrichInputFromHris_(input);var company=soV2GetCompany_(input.company_code||'RIFIM');var docType=soV2GetDocType_(input.documentType);
  var metadata={request_source:source,employee_id:input.extra&&input.extra.employee_id||null,branch_id:input._scope_branch_id||ctx.branchId||null,branch_scope:input.extra&&(input.extra.employee_branch||input.extra.branch||input.extra.cabang)||null,company_code:company.code||input.company_code,layout_group:soV2LayoutGroup_(docType),template_version:SO_V2_VERSION};
  var payload=JSON.parse(JSON.stringify(input));payload.metadata=metadata;
  var created=_docCreateDraft_({title:input.subject||docType.label||input.documentType,companySlug:String(company.code||input.company_code||'RIFIM').toLowerCase(),docType:String(input.documentType||'').toUpperCase(),payload:payload},ctx);
  _sbPatch('doc_documents','id=eq.'+encodeURIComponent(created.documentId),{metadata:metadata,updated_at:new Date().toISOString()});
  return{success:true,documentId:created.documentId,revisionId:created.revisionId,status:'draft',metadata:metadata};
}
function soV2DireksiApprover_(){
  var rows=_sbGet(_docRestUrl_('user_profiles',['role=in.(direksi,direktur)','is_active=eq.true','select=id,email,role','order=created_at.asc','limit=1']));
  if(!rows||!rows.length)throw new Error('Direksi aktif tidak ditemukan untuk approval.');
  return rows[0];
}
function soV2SubmitCanonical_(input){
  var ctx=soV2Auth_(input);var doc=soV2GetCanonicalDocument_(input.documentId);var source=String(doc.metadata&&doc.metadata.request_source||input.request_source||'SMART_OFFICE').toUpperCase();
  if(source==='RAOS'){if(!soV2CanEmployeeRequest_(ctx.role))throw new Error('Tidak diizinkan mengajukan dokumen.');if(ctx.role==='staff'&&String(doc.created_by)!==String(ctx.userId))throw new Error('Staff hanya boleh submit draft miliknya sendiri.');if(ctx.role==='koordinator'&&String(doc.metadata&&doc.metadata.branch_id||'')!==String(ctx.branchId||''))throw new Error('Koordinator hanya boleh submit draft cabangnya.');}else soV2RequireWrite_(ctx);
  if(String(doc.status||'').toLowerCase()!=='draft')throw new Error('Hanya draft yang dapat diajukan. Status: '+doc.status);
  if(!doc.current_revision_id)throw new Error('Draft belum mempunyai revision.');
  var existing=_sbGet(_docRestUrl_('doc_approvals',['document_id=eq.'+encodeURIComponent(doc.id),'status=in.(pending,approved)','select=id,status','limit=1']));
  if(existing&&existing.length)throw new Error('Dokumen sudah mempunyai proses approval aktif.');
  var approver=soV2DireksiApprover_();var approvalId=Utilities.getUuid();
  _sbPost('doc_approvals',{id:approvalId,document_id:doc.id,revision_id:doc.current_revision_id,approver_id:approver.id,order_index:0,status:'pending'});
  _sbPatch('doc_documents','id=eq.'+encodeURIComponent(doc.id),{status:'pending_approval',updated_at:new Date().toISOString()});
  _sbPost('rpc/doc_log_event',{p_entity_type:'document',p_entity_id:doc.id,p_action:'transitioned',p_payload:{from:'draft',to:'pending_approval',action:'submit',actor:ctx.userId,approver_role:'direksi'}});
  return{success:true,status:'pending_approval',approvalId:approvalId,approverId:approver.id};
}
function soV2DecideCanonical_(input){var ctx=soV2Auth_(input);soV2RequireApprove_(ctx);var result=decideApproval({approvalId:input.approvalId,approverId:ctx.userId,decision:String(input.decision||'approved').toLowerCase(),comment:input.comment||''});if(!result.success)throw new Error(result.error||'Approval gagal.');return result;}
function soV2GetCanonicalDocument_(documentId){var rows=_sbGet(_docRestUrl_('doc_documents',['id=eq.'+encodeURIComponent(documentId),'select=id,company_slug,doc_type,doc_number,title,status,current_revision_id,pdf_drive_id,pdf_url,metadata,created_by,created_at,updated_at','limit=1']));if(!rows||!rows.length)throw new Error('Dokumen tidak ditemukan: '+documentId);return rows[0];}
function soV2GetCanonicalRevision_(revisionId){var rows=_sbGet(_docRestUrl_('doc_revisions',['id=eq.'+encodeURIComponent(revisionId),'select=id,document_id,revision_number,payload,pdf_drive_id,pdf_url,created_by,created_at','limit=1']));if(!rows||!rows.length)throw new Error('Revision tidak ditemukan: '+revisionId);return rows[0];}
function soV2RequireApprovedDocument_(documentId){var doc=soV2GetCanonicalDocument_(documentId);if(String(doc.status||'').toLowerCase()!=='approved')throw new Error('Dokumen belum disetujui Direksi. Generate final dikunci.');if(!doc.current_revision_id)throw new Error('Dokumen approved tidak memiliki current revision.');return doc;}
function soV2PendingForDireksi_(input){var ctx=soV2Auth_(input);soV2RequireApprove_(ctx);return{success:true,approvals:getPendingForApprover(ctx.userId)};}

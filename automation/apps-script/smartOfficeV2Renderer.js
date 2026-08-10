/** Smart Office V2 — renderer adapter. Extends existing HTML renderer; no third engine. */
function soV2BuildPreview_(input){input=soV2EnrichInputFromHris_(input);var config=getCompanyConfig(),company=soV2GetCompany_(input.company_code||'RIFIM'),prefix=company.doc_prefix||company.code||'RIFIM',data=buildPlaceholderData(input,config,'PREVIEW/'+prefix+'/'+input.documentType),co={name:company.name||'',address:company.address||'',phone:company.phone||'',email:company.email||'',director_name:company.director_name||'',director_title:company.director_title||''};return buildDocumentPreviewHtml(input.documentType,data,String(company.code||'RIFIM').toUpperCase(),co)}
function soV2GenerateApproved_(input){
  var ctx=soV2Auth_(input);soV2RequireWrite_(ctx);var doc=soV2RequireApprovedDocument_(input.documentId);
  // Idempotent final generate: reprint/retry must never consume a new legal number.
  if(doc.pdf_url&&doc.doc_number&&String(doc.doc_number).indexOf('DOC-')!==0){return{success:true,reused:true,documentId:doc.id,documentNumber:doc.doc_number,pdfUrl:doc.pdf_url,gdocUrl:doc.metadata&&doc.metadata.gdoc_url||'',message:'Dokumen final sudah tersedia; nomor lama digunakan kembali.'};}
  var rev=soV2GetCanonicalRevision_(doc.current_revision_id),payload=rev.payload||{};
  payload.access_token=input.access_token||input.token||'';payload.performed_by={name:ctx.email,email:ctx.email};payload.documentType=payload.documentType||doc.doc_type;payload.company_code=payload.company_code||String(doc.company_slug||'RIFIM').toUpperCase();payload.use_html_pipeline=true;payload._canonical_document_id=doc.id;payload=soV2EnrichInputFromHris_(payload);
  var result=generateDocument(payload);if(!result||!result.success)throw new Error(result&&result.message||'Generate document gagal.');
  _sbPatch('doc_documents','id=eq.'+encodeURIComponent(doc.id),{doc_number:result.documentNumber||doc.doc_number,pdf_drive_id:result.pdfFileId||null,pdf_url:result.pdfUrl||null,metadata:Object.assign({},doc.metadata||{},{gdoc_url:result.gdocUrl||'',template_version:SO_V2_VERSION}),updated_at:new Date().toISOString()});
  if(String(doc.doc_type||'').toUpperCase()==='PKWT')soV2ReconcilePkwtContract_(doc,payload,result);
  return Object.assign({documentId:doc.id},result);
}
function soV2ReconcilePkwtContract_(doc,payload,result){
  var employeeId=payload.extra&&payload.extra.employee_id;if(!employeeId)throw new Error('PKWT approved tidak memiliki employee_id.');
  var emp=hrisGetEmployee(employeeId);if(!emp)throw new Error('Employee PKWT tidak ditemukan.');
  var startDate=payload.extra&&payload.extra.contract_start;if(!startDate)throw new Error('PKWT wajib memiliki contract_start sebelum final generate.');
  var rows=_sbGet(_docRestUrl_('employee_contracts',['employee_id=eq.'+encodeURIComponent(emp.employee_id),'contract_type=eq.PKWT','order=created_at.desc','limit=1']));
  var patch={document_number:result.documentNumber||doc.doc_number,gdoc_url:result.gdocUrl||null,pdf_url:result.pdfUrl||null,start_date:startDate,end_date:payload.extra&&payload.extra.contract_end||null,status:'AKTIF',source:'smart_office',smart_office_code:'PKWT',smart_office_document_id:String(doc.id),payload_snapshot:payload,validation_status:'pending',validated_at:null,validated_by:null,updated_at:new Date().toISOString()};
  if(rows&&rows.length)_sbPatch('employee_contracts','id=eq.'+encodeURIComponent(rows[0].id),patch);
  else _sbPost('employee_contracts',Object.assign({employee_id:emp.employee_id,contract_type:'PKWT',created_at:new Date().toISOString()},patch));
}

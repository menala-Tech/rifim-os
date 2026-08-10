/** Smart Office V2 — canonical route dispatcher. All privileged actions are POST-only. */
function soV2CanReadDocument_(ctx,doc){
  var role=soV2Role_(ctx&&ctx.role);var meta=doc&&doc.metadata||{};
  if(['admin','direksi','direktur','management'].indexOf(role)>=0)return true;
  if(role==='koordinator')return !!ctx.branchId&&String(meta.branch_id||'')===String(ctx.branchId);
  if(role==='staff')return String(doc.created_by||'')===String(ctx.userId)||String(meta.employee_id||'')===String(ctx.staffId||'');
  return false;
}
function soV2Status_(input){var ctx=soV2Auth_(input);var doc=soV2GetCanonicalDocument_(input.documentId);if(!soV2CanReadDocument_(ctx,doc))throw new Error('forbidden: dokumen di luar data scope');return{success:true,document:doc};}
function soV2RoutePost(input){
  var action=String(input&&input.action||'');
  if(action.indexOf('so_')!==0)return null;
  if(action==='so_preview'){soV2Auth_(input);return{success:true,html:soV2BuildPreview_(input)};}
  if(action==='so_create_draft')return soV2CreateCanonicalDraft_(input);
  if(action==='so_submit')return soV2SubmitCanonical_(input);
  if(action==='so_decide')return soV2DecideCanonical_(input);
  if(action==='so_generate')return soV2GenerateApproved_(input);
  if(action==='so_send_chat')return soV2SendChat_(input);
  if(action==='so_pending_direksi')return soV2PendingForDireksi_(input);
  if(action==='so_status')return soV2Status_(input);
  throw new Error('Smart Office V2 action tidak dikenal: '+action);
}

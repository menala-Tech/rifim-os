/** Smart Office V2 — integration policy. Reuses existing canonical engines. */
var SO_V2_VERSION = 'v2';
var SO_V2_APPROVER_ROLES = ['direksi','direktur'];
var SO_V2_WRITE_ROLES = ['admin','direksi','direktur'];
var SO_V2_VIEW_ROLES = ['admin','direksi','direktur','management','koordinator'];
var SO_V2_EMPLOYEE_REQUEST_ROLES = ['staff','koordinator','admin','direksi','direktur'];
function soV2Role_(role){var r=String(role||'').trim().toLowerCase().replace(/\s+/g,'_');if(r==='direktur_utama')r='direktur';return r;}
function soV2CanWrite_(role){return SO_V2_WRITE_ROLES.indexOf(soV2Role_(role))>=0;}
function soV2CanApprove_(role){return SO_V2_APPROVER_ROLES.indexOf(soV2Role_(role))>=0;}
function soV2CanView_(role){return SO_V2_VIEW_ROLES.indexOf(soV2Role_(role))>=0;}
function soV2CanEmployeeRequest_(role){return SO_V2_EMPLOYEE_REQUEST_ROLES.indexOf(soV2Role_(role))>=0;}
function soV2Auth_(input){var by=input&&input.performed_by||{};var email=String(by.email||input.user||'').toLowerCase().trim();if(!email)throw new Error('unauthorized: email session tidak ditemukan');var ctx=_docAuthContext_(email);var rows=_sbGet(_docRestUrl_('user_profiles',['id=eq.'+encodeURIComponent(ctx.userId),'select=id,email,role,branch_id,staff_id,is_active','limit=1']));if(rows&&rows.length){ctx.branchId=rows[0].branch_id||null;ctx.staffId=rows[0].staff_id||null;}return ctx;}
function soV2RequireWrite_(ctx){if(!soV2CanWrite_(ctx.role))throw new Error('forbidden: role '+ctx.role+' tidak boleh mengubah Smart Office');}
function soV2RequireApprove_(ctx){if(!soV2CanApprove_(ctx.role))throw new Error('forbidden: hanya Direksi/Direktur boleh approve');}
function soV2GetCompany_(companyCode){var row=getCompanyByCode(String(companyCode||'RIFIM').toUpperCase());if(!row)throw new Error('Company tidak ditemukan: '+companyCode);return row;}
function soV2GetDocType_(code){var rows=soV2SheetObjects_('document_types');var c=String(code||'').toUpperCase();var row=rows.filter(function(r){return String(r.code||'').toUpperCase()===c;})[0];if(!row)throw new Error('Document type tidak ditemukan: '+c);return row;}
function soV2LayoutGroup_(row){var g=String(row.layout_group||'').toUpperCase();return g==='INVOICE'||g==='KONTRAK'?g:'SURAT';}
function soV2Spreadsheet_(){if(typeof getDatabaseSpreadsheet_==='function')return getDatabaseSpreadsheet_();if(typeof getSmartOfficeSpreadsheet_==='function')return getSmartOfficeSpreadsheet_();var id=PropertiesService.getScriptProperties().getProperty('SMART_OFFICE_SPREADSHEET_ID');if(id)return SpreadsheetApp.openById(id);return SpreadsheetApp.getActiveSpreadsheet();}
function soV2SheetObjects_(sheetName){var ss=soV2Spreadsheet_();var sh=ss&&ss.getSheetByName(sheetName);if(!sh)throw new Error('Sheet tidak ditemukan: '+sheetName);var values=sh.getDataRange().getValues();if(!values.length)return[];var headers=values[0].map(function(v){return String(v||'').trim();});return values.slice(1).filter(function(row){return row.some(function(v){return String(v||'').trim()!=='';});}).map(function(row){var o={};headers.forEach(function(h,i){if(h)o[h]=row[i];});return o;});}

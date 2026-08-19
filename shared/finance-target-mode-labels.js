(function(global){
  'use strict';

  if(!/\/finance(?:\/|$)/.test(String(global.location&&global.location.pathname||''))) return;

  function cloneConfig(config){
    return {
      ...config,
      fields: Array.isArray(config&&config.fields)
        ? config.fields.map(function(field){ return { ...field }; })
        : []
    };
  }

  function modeFromBranchConfig(config){
    var field=(config.fields||[]).find(function(item){ return item&&item.name==='mode'; });
    return String(field&&field.value||'saldo').toLowerCase()==='order'?'order':'saldo';
  }

  function modeFromStaffRow(staffId){
    var buttons=document.querySelectorAll('#ts-body button[onclick]');
    for(var i=0;i<buttons.length;i++){
      var raw=String(buttons[i].getAttribute('onclick')||'');
      if(raw.indexOf(String(staffId))===-1) continue;
      var row=buttons[i].closest('tr');
      if(!row) break;
      var branchCell=row.children&&row.children[1];
      var text=String(branchCell&&branchCell.textContent||'');
      return /\(order\)|\border\b/i.test(text)?'order':'saldo';
    }
    return 'saldo';
  }

  function patchBranchFields(config,mode){
    (config.fields||[]).forEach(function(field){
      if(!field) return;
      if(field.name==='target_cabang'){
        field.label=mode==='order'?'Target Cabang (Order / scan valid)':'Target Cabang (Rp bulan ini)';
        field.hint=mode==='order'
          ? 'Total target scan VALID cabang untuk bulan ini'
          : 'Total target nominal saldo cabang untuk bulan ini';
      }
      if(field.name==='target_staff_default'){
        field.label=mode==='order'?'Target Staff Default (Order / scan per staff)':'Target Staff Default (Rp per staff)';
        field.hint=mode==='order'
          ? 'Kosongkan = auto-prorate Target Cabang / jumlah staff aktif'
          : 'Kosongkan = auto-prorate Target Cabang / jumlah staff aktif';
      }
    });
  }

  function patchStaffFields(config,mode){
    (config.fields||[]).forEach(function(field){
      if(!field||field.name!=='target_saldo') return;
      field.label=mode==='order'?'Override Target Order / Scan Valid':'Override Target Saldo (Rp)';
      field.placeholder=mode==='order'?'Kosongkan = pakai target order default cabang':'Kosongkan = pakai default cabang';
      field.hint=mode==='order'
        ? 'Override target jumlah scan VALID untuk staff ini saja'
        : 'Kalau diisi, override Target Staff Default cabang untuk staff ini saja';
    });
  }

  function updateRenderedBranchLabels(config){
    var modeIndex=(config.fields||[]).findIndex(function(field){ return field&&field.name==='mode'; });
    if(modeIndex<0) return;
    var modeEl=document.getElementById('__edit_field_'+modeIndex);
    if(!modeEl) return;

    function render(){
      var mode=String(modeEl.value||'saldo').toLowerCase()==='order'?'order':'saldo';
      (config.fields||[]).forEach(function(field,index){
        if(!field) return;
        var el=document.getElementById('__edit_field_'+index);
        var label=el&&el.parentElement?el.parentElement.querySelector('label'):null;
        var hint=el&&el.parentElement?el.parentElement.querySelector('div'):null;
        if(field.name==='target_cabang'){
          if(label) label.textContent=mode==='order'?'Target Cabang (Order / scan valid) *':'Target Cabang (Rp bulan ini) *';
          if(hint) hint.textContent=mode==='order'?'Total target scan VALID cabang untuk bulan ini':'Total target nominal saldo cabang untuk bulan ini';
        }
        if(field.name==='target_staff_default'){
          if(label) label.textContent=mode==='order'?'Target Staff Default (Order / scan per staff)':'Target Staff Default (Rp per staff)';
          if(hint) hint.textContent='Kosongkan = auto-prorate Target Cabang / jumlah staff aktif';
        }
      });
    }

    modeEl.addEventListener('change',render);
    render();
  }

  function install(){
    if(typeof global.openEditModal!=='function'||typeof global.editTargetStaff!=='function'){
      global.setTimeout(install,50);
      return;
    }
    if(global.openEditModal.__financeModeAware) return;

    var originalOpen=global.openEditModal;
    var originalEditStaff=global.editTargetStaff;
    var staffModeContext='saldo';

    global.editTargetStaff=function(staffId){
      staffModeContext=modeFromStaffRow(staffId);
      try { return originalEditStaff.apply(this,arguments); }
      finally { staffModeContext='saldo'; }
    };

    function wrappedOpen(config){
      var next=cloneConfig(config||{});
      var title=String(next.title||'');
      var isBranch=/Edit Target Cabang/i.test(title);
      var isStaff=/Edit Target Staff/i.test(title);

      if(isBranch) patchBranchFields(next,modeFromBranchConfig(next));
      if(isStaff) patchStaffFields(next,staffModeContext);

      var result=originalOpen.call(this,next);
      if(isBranch) updateRenderedBranchLabels(next);
      return result;
    }
    wrappedOpen.__financeModeAware=true;
    global.openEditModal=wrappedOpen;
  }

  if(document.readyState==='complete') install();
  else global.addEventListener('load',install,{once:true});
})(window);

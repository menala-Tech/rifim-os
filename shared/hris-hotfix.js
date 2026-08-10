(function(global){
  'use strict';
  function apply(){
    if (typeof global.autofillPotonganFromAbsensi !== 'function' && typeof global.autofillPotanganFromAbsensi === 'function') {
      global.autofillPotonganFromAbsensi = function(){
        return global.autofillPotanganFromAbsensi.apply(global, arguments);
      };
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once:true });
  else apply();
})(window);

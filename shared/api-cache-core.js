/**
 * RIFIM OS - Shared API + Cache helper
 * P8: Management is read-only on central modules. Backend remains authoritative;
 * this helper also removes mutation affordances from CRM/Finance UI.
 */
(function (global) {
  'use strict';

  var GAS_URL = 'https://script.google.com/macros/s/AKfycbzzK75gxawaylaUZpoC1zp_hq5ktznlN7scIl24HkdEgR2l3cVmpUSLck0potcMZZtw/exec';
  var DEFAULT_TTL = {
    staff:3600000, employees:1800000, branches:3600000, drivers:3600000,
    attendance:3600000, payroll:1800000, saldo:900000, target:1800000,
    ledger:900000, tagihan:900000, sistem:21600000, log:60000, _default:1800000
  };

  var CENTRAL_WRITE_ACTIONS = {
    company_config_set:true,
    whitelist_add:true,
    whitelist_remove:true,
    whitelist_update:true,
    sistem_config_set:true,
    raos_users_update:true,
    raos_users_reset_pin:true,
    raos_credentials_reset_pin:true,
    raos_ssot_pin_update:true,
    contacts_upsert:true,
    contacts_delete:true,
    finance_tagihan_add:true,
    finance_tagihan_mark_paid:true,
    finance_saldo_raos_mark_paid:true,
    finance_kpi_target_branch_upsert:true,
    finance_kpi_target_staff_upsert:true,
    finance_payroll_compute:true,
    finance_driver_assign_random:true,
    hris_attendance_edit:true,
    hris_upload_employee_photo:true
  };

  function _getAuthSession() {
    try {
      var raw = localStorage.getItem('rifim_auth');
      return raw ? (JSON.parse(raw) || {}) : {};
    } catch (e) { return {}; }
  }

  function _getUserEmail() { return String(_getAuthSession().email || ''); }
  function _getAccessToken() { return String(_getAuthSession().access_token || ''); }
  function _getRole() { return String(_getAuthSession().role || '').toLowerCase(); }
  function _canCentralWrite() {
    var role = _getRole();
    return role === 'admin' || role === 'direksi' || role === 'direktur';
  }
  function _isReadOnlyRole() { return _getRole() === 'management'; }

  function _getScopeKey() {
    var s = _getAuthSession();
    var actor = String(s.id || s.user_id || s.email || 'anonymous').toLowerCase();
    var role = String(s.role || 'none').toLowerCase();
    var branch = String(s.branch_id || 'none').toLowerCase();
    var version = String(s.scope_version || s.permission_scope_version || s.access_policy_version || 'v1').toLowerCase();
    return [actor,role,branch,version].join('|').replace(/[^a-z0-9@._|:-]/g,'_');
  }

  async function _fetchJson(url, initOpts, retry) {
    if (retry == null) retry = 1;
    var lastMsg = '';
    for (var attempt = 0; attempt <= retry; attempt++) {
      try {
        var res = await fetch(url, initOpts);
        var txt = await res.text();
        if (txt.trim().startsWith('<')) {
          lastMsg = 'GAS backend throttled (HTML response)';
          if (attempt < retry) {
            await new Promise(function(r){ setTimeout(r,900); });
            continue;
          }
          return {success:false,message:'GAS backend sedang throttled. Coba lagi dalam 10 detik.'};
        }
        try { return JSON.parse(txt); }
        catch (e) { return {success:false,message:'Response bukan JSON: ' + txt.substring(0,100)}; }
      } catch (e) {
        lastMsg = e.message;
        if (attempt < retry) {
          await new Promise(function(r){ setTimeout(r,900); });
          continue;
        }
        return {success:false,message:'Koneksi gagal: ' + e.message};
      }
    }
    return {success:false,message:'Gagal setelah retry: ' + lastMsg};
  }

  function _guardWriteAction(action) {
    if (CENTRAL_WRITE_ACTIONS[String(action || '')] && !_canCentralWrite()) {
      return {
        success:false,
        code:'ROLE_READ_ONLY',
        message:'Role ' + (_getRole() || 'unknown') + ' bersifat read-only untuk aksi ini.'
      };
    }
    return null;
  }

  var RifimAPI = {
    get: async function(action, params) {
      var denied = _guardWriteAction(action);
      if (denied) return denied;
      var p = Object.assign({action:action}, params || {});
      if (!p.access_token && !p.token) p.access_token = _getAccessToken();
      delete p.user;
      delete p.performed_by;
      return _fetchJson(GAS_URL, {
        method:'POST',
        headers:{'Content-Type':'text/plain;charset=utf-8'},
        body:JSON.stringify(p)
      }, 1);
    },
    post: async function(body) {
      var b = Object.assign({}, body || {});
      var denied = _guardWriteAction(b.action);
      if (denied) return denied;
      delete b.user;
      delete b.performed_by;
      if (!b.access_token && !b.token) b.access_token = _getAccessToken();
      return _fetchJson(GAS_URL, {
        method:'POST',
        headers:{'Content-Type':'text/plain;charset=utf-8'},
        body:JSON.stringify(b)
      }, 1);
    },
    _pickTTL:function(key) {
      var prefix = String(key).split('_')[0].toLowerCase();
      return DEFAULT_TTL[prefix] || DEFAULT_TTL._default;
    },
    _gasUrl:GAS_URL,
    _getUserEmail:_getUserEmail,
    _getAccessToken:_getAccessToken,
    _getRole:_getRole,
    _canCentralWrite:_canCentralWrite,
    _getScopeKey:_getScopeKey
  };

  var CACHE_PREFIX = 'rifim_cache_';
  function _scopedCacheStorageKey(key) { return CACHE_PREFIX + _getScopeKey() + ':' + String(key); }
  function _cachePut(key, data) {
    try { localStorage.setItem(_scopedCacheStorageKey(key), JSON.stringify({at:Date.now(),data:data})); }
    catch (e) {}
  }
  function _cacheRead(key, ttl) {
    try {
      var raw = localStorage.getItem(_scopedCacheStorageKey(key));
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj.at) return null;
      var effectiveTTL = ttl || RifimAPI._pickTTL(key);
      if ((Date.now() - obj.at) > effectiveTTL) return null;
      return obj.data;
    } catch (e) { return null; }
  }

  var RifimCache = {
    get:_cacheRead,
    set:_cachePut,
    clear:function(key) {
      try { localStorage.removeItem(_scopedCacheStorageKey(key)); } catch (e) {}
    },
    clearAll:function() {
      try {
        var keys=[];
        for (var i=0;i<localStorage.length;i++) {
          var k=localStorage.key(i);
          if (k && k.indexOf(CACHE_PREFIX)===0) keys.push(k);
        }
        keys.forEach(function(k){ localStorage.removeItem(k); });
        return keys.length;
      } catch (e) { return 0; }
    },
    cacheFirst:async function(key,fetcher,opts) {
      opts=opts||{};
      var onData=opts.onData||function(){};
      var ttl=opts.ttl;
      var cached=opts.forceRefresh?null:_cacheRead(key,ttl);
      if(cached!=null){
        try{onData(cached,{fromCache:true});}catch(e){}
        _backgroundRefresh(key,fetcher,cached,onData);
        return cached;
      }
      var fresh=await fetcher();
      if(fresh&&(fresh.success==null||fresh.success===true)){
        _cachePut(key,fresh);
        try{onData(fresh,{fromCache:false});}catch(e){}
      }else{
        try{onData(fresh,{fromCache:false,error:true});}catch(e){}
      }
      return fresh;
    }
  };

  async function _backgroundRefresh(key,fetcher,prevData,onData) {
    var fresh=await fetcher();
    if(!fresh||fresh.success===false)return;
    _cachePut(key,fresh);
    try{
      if(JSON.stringify(prevData).substring(0,500)===JSON.stringify(fresh).substring(0,500))return;
      onData(fresh,{fromCache:false,backgroundUpdate:true});
    }catch(e){}
  }

  RifimCache.autoRefresh=function(intervalMs,cb,opts){
    opts=opts||{};
    return setInterval(function(){
      if(document.visibilityState!=='visible')return;
      if(opts.activeTabId){
        var el=document.getElementById(opts.activeTabId);
        if(!el||!el.classList.contains('active'))return;
      }
      try{cb();}catch(e){}
    },intervalMs);
  };

  function _applyP8ReadOnlyUi() {
    if (!_isReadOnlyRole()) return;
    var path = String(global.location && global.location.pathname || '');
    if (!/\/(crm|finance)(?:\/|$)/.test(path)) return;

    var selectors = [
      '#cc-save','#sc-save','#wl-new-email','#wl-add-btn',
      '#ru-modal-save','#ru-modal-reset-pin','#ru-modal-update-ssot-pin','#ru-modal-reset-portal-pin',
      '#ct-add-btn','#ct-modal-save','#tc-recompute','#dd-assign','#dd-rebalance',
      'button[data-edit]','button[data-remove]','button[data-edit-user]',
      'button[data-edit-ct]','button[data-del-ct]','button[data-mark-saldo]',
      '.tab[data-tab="input"]','.panel[data-panel="input"]'
    ];
    selectors.forEach(function(sel){
      document.querySelectorAll(sel).forEach(function(el){
        el.style.display='none';
        if ('disabled' in el) el.disabled=true;
      });
    });

    document.querySelectorAll('input[data-section="company"],input[data-section="system"],.panel[data-panel="target-cabang"] input[type="number"],.panel[data-panel="target-staff"] input[type="number"]').forEach(function(el){
      el.readOnly=true;
    });

    document.querySelectorAll('button').forEach(function(btn){
      var t=String(btn.textContent||'');
      if(/lunas|simpan|recompute|assign|rebalance|tagihan baru|tambah tagihan/i.test(t)){
        btn.style.display='none';
        btn.disabled=true;
      }
    });

    document.querySelectorAll('#hdr-role').forEach(function(el){
      if(String(el.textContent||'').indexOf('READ ONLY')<0) el.textContent=String(el.textContent||'MANAGEMENT')+' · READ ONLY';
    });
  }

  function _installP8RoleObserver() {
    if (!_isReadOnlyRole()) return;
    var run=function(){ _applyP8ReadOnlyUi(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',run,{once:true});
    else run();
    var root=document.documentElement;
    if(root){
      var obs=new MutationObserver(run);
      obs.observe(root,{childList:true,subtree:true});
    }
  }

  global.RifimAPI=RifimAPI;
  global.RifimCache=RifimCache;
  RifimAPI._version='1.1.0-p8-role-guard';
  RifimAPI._loadedAt=new Date().toISOString();
  _installP8RoleObserver();
})(typeof window!=='undefined'?window:globalThis);

if(typeof window!=='undefined'&&/\/finance(?:\/|$)/.test(window.location.pathname)){
  // Canonical Finance owners:
  // - finance-data-router.js: data transport + stale cache
  // - aist-finance-agent-v2.js: AIST job action
  // - built-in Finance notifier: saldo notifications
  // Legacy aist-finance.js, finance-saldo-cache-first.js and finance-p7-compat.js are intentionally not loaded.
  ['/shared/finance-light-ui.js','/shared/finance-target-cache-first.js','/shared/aist-finance-agent-v2.js','/shared/aist-agent-status.js'].forEach(function(src){
    var s=document.createElement('script');
    s.src=src;
    s.async=false;
    document.head.appendChild(s);
  });
}

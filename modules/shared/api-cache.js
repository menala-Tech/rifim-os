// Shared browser-side TTL cache for lightweight API helpers.
(function(root) {
  if (!root || !root.window) return;

  var windowObj = root.window;
  var store = {};

  function now() {
    return Date.now ? Date.now() : new Date().getTime();
  }

  windowObj.apiCache = windowObj.apiCache || {
    get: function(key) {
      var hit = store[key];
      if (!hit) return undefined;
      if (hit.expiresAt <= now()) {
        delete store[key];
        return undefined;
      }
      return hit.value;
    },
    set: function(key, value, ttlMs) {
      store[key] = {
        value: value,
        expiresAt: now() + Number(ttlMs || 0)
      };
      return value;
    },
    del: function(key) {
      delete store[key];
    },
    invalidatePrefix: function(prefix) {
      Object.keys(store).forEach(function(key) {
        if (key.indexOf(prefix) === 0) delete store[key];
      });
    },
    clear: function() {
      store = {};
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

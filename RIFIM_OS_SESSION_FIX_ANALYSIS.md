# RIFIM OS Multi-Device Session Fix Analysis

**Date:** 2026-08-28  
**Status:** ANALYSIS COMPLETE — Ready for Implementation  
**Severity:** P1 (affects user experience, causes false logouts)

---

## Executive Summary

The "Session invalid" error visible in the screenshot (HRIS Portal, Makassar branch) is caused by **multi-tab/multi-device session desynchronization**. While Item 2 (commit f11d094, merged PR #97) fixed transient network errors and implemented caching, it did not address cross-tab session coordination.

**Root Issue:** When Session A (Tab 1) refreshes the token, Session B (Tab 2) still has the old cached token. If Session B makes a request and gets 401, it clears the session, even though the session is valid in Session A.

---

## Root Cause Analysis

### Current Implementation (portal-session.js)

**Good parts:**
- ✅ Fast-path cache (60s) reduces redundant profile fetches
- ✅ Single-flight pattern prevents concurrent token refreshes within same tab
- ✅ Distinction between transient (network) vs hard auth (401/403) errors
- ✅ Transient failures don't immediately clear session

**Missing:**
- ❌ No `storage` event listener for cross-tab coordination
- ❌ Cache (`lastGood`, `inFlight`) is memory-only, not synchronized across tabs
- ❌ When one tab clears session, others don't know until they timeout
- ❌ Multiple tabs might simultaneously try to refresh same refresh_token
- ❌ No tab identifier to prevent race conditions during concurrent refresh

### Failure Scenario

```
[Tab 1]  → validates at t=0 → caches lastGood
[Tab 2]  → validates at t=5 → uses fast-path (still valid)
[Tab 1]  → token nearing expiry at t=55 → refreshes token → updates localStorage
[Tab 2]  → makes API call at t=58 → still using OLD cached token → gets 401
[Tab 2]  → tries to refresh → uses SAME refresh_token as Tab 1
[Tab 2]  → refresh fails (token already consumed) → clears session
[Tab 1]  → unaware Tab 2 cleared session → continues normally
[User]   → sees "Session invalid" error on Tab 2
```

### Why Current Fix (Item 2) Wasn't Enough

Item 2 focused on **single-tab** transient failures:
- If network is down → don't clear session (correct)
- If 401 but session is valid → cache prevents re-validation (helps)
- But with multiple tabs → each tab has separate cache

**The gap:** No coordination between tabs when one tab refreshes the token and invalidates others' caches.

---

## Solution Design

### Multi-Tab Session Synchronization (Item 3)

**Approach:** Add storage event listener + tab-aware refresh protocol

#### 1. Storage Event Listener

```javascript
// When one tab modifies localStorage, other tabs know immediately
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) {
    if (!event.newValue) {
      // Another tab cleared session → invalidate cache
      invalidateCache()
    } else {
      // Another tab updated session → validate next call will re-fetch
      invalidateCache()
    }
  }
})
```

**Benefits:**
- Tab 2 detects Tab 1's logout instantly
- Tab 2 detects Tab 1's token refresh instantly
- No stale cache across multiple tabs

#### 2. Tab-Aware Refresh Lock

```javascript
// Prevent two tabs from using refresh_token simultaneously
const REFRESH_LOCK_KEY = 'rifim_auth_refresh_lock'

async function acquireRefreshLock() {
  const tabId = getTabId() // UUID stored in sessionStorage
  const lock = JSON.parse(localStorage.getItem(REFRESH_LOCK_KEY))
  if (lock && lock.tabId !== tabId && Date.now() - lock.ts < 5000) {
    // Another tab already refreshing, wait for it
    return new Promise(r => {
      let attempts = 0
      const timer = setInterval(() => {
        const newLock = JSON.parse(localStorage.getItem(REFRESH_LOCK_KEY))
        if (!newLock || newLock.tabId !== tabId || Date.now() - newLock.ts > 5000) {
          clearInterval(timer)
          r()
        }
        if (++attempts > 50) clearInterval(timer) // Give up after 2.5s
      }, 50)
    })
  }
  localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify({ tabId, ts: Date.now() }))
}

async function releaseRefreshLock() {
  localStorage.removeItem(REFRESH_LOCK_KEY)
}
```

**Benefits:**
- Only one tab refreshes token at a time
- Other tabs wait for refresh to complete
- Prevents consuming refresh_token multiple times

#### 3. Logout Broadcast

```javascript
function clearSession() {
  // IMPORTANT: Set a marker so other tabs know about logout
  localStorage.setItem(STORAGE_KEY, null) // Broadcast to all tabs
  localStorage.removeItem(STORAGE_KEY)
  invalidateCache()
}
```

**Benefits:**
- All tabs see logout event instantly via storage listener
- No delayed "session invalid" errors

---

## Implementation Files

### Files to Modify

1. **shared/portal-session.js** (primary change)
   - Add storage event listener
   - Add tab identifier (sessionStorage-based UUID)
   - Add refresh lock mechanism
   - Update `validateSession()` to wait for locks
   - Update `clearSession()` to broadcast

2. **testing/portal-session-item3.test.js** (new file)
   - Test cross-tab storage events
   - Test refresh lock acquisition/release
   - Test concurrent tab refresh scenarios
   - Test logout broadcast

### Backward Compatibility

✅ **100% backward compatible**
- No API changes to `RifimPortalSession` exports
- Existing code continues to work
- New behavior is additive only

---

## Test Coverage

### Multi-Tab Scenarios (Item 3)

| Test | Scenario | Expected | Status |
|------|----------|----------|--------|
| T1 | One tab refreshes token → other tab detects | Storage event → invalidate cache | ✓ To implement |
| T2 | Two tabs call validate() simultaneously | Both wait for first to refresh, then use same token | ✓ To implement |
| T3 | One tab logs out → other tab sees event | Both tabs show login screen | ✓ To implement |
| T4 | Refresh lock timeout (5s) → second tab proceeds | No deadlock | ✓ To implement |
| T5 | One tab on preview, one on prod | Separate Supabase sessions (correct behavior) | ✓ To implement |

---

## Security Considerations

### Refresh Token Reuse

**Current risk:** Multiple tabs might consume same refresh_token in 401 scenario

**Mitigation:** Refresh lock prevents concurrent refresh calls

### Cross-Tab Messaging

**Current risk:** localStorage mutation from malicious code

**Mitigation:** 
- Only react to `rifim_auth` and `rifim_auth_refresh_lock` keys
- Validate JWT structure before using
- Cross-Origin Isolation (CSP) already in place

### Preview/Prod Isolation

**Status:** ✅ Already working correctly
- preview.vercel.app → QA Supabase
- rifim-os.vercel.app → PROD Supabase
- Storage keys are origin-specific (built-in by browser)

---

## Deployment Checklist

- [ ] Implement portal-session.js changes
- [ ] Create portal-session-item3.test.js
- [ ] Run test suite: `node testing/portal-session-item3.test.js`
- [ ] Manual UAT: open Finance in 2 tabs, logout from one tab
- [ ] Monitor error logs for "Session invalid" frequency
- [ ] Verify token refresh works with 5+ concurrent tabs

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Storage event not fired in some browsers | Low | Medium | Test with Safari/Firefox, fallback fallback to polling |
| Refresh lock timeout too short | Low | Low | Monitor logs, adjust timeout if needed |
| Cache invalidation too aggressive | Low | Low | Trace local cache hits/misses |
| Cross-tab race during logout | Medium | Low | Queue-based clearSession approach |

---

## Performance Impact

### Before (Item 2 only)
- Single tab: ~1 profile fetch per 60s (fast-path cache working)
- Multi-tab (5 tabs): ~5 profile fetches per 60s (cache not shared)

### After (Item 3)
- Single tab: ~1 profile fetch per 60s (unchanged)
- Multi-tab (5 tabs): ~1-2 profile fetches per 60s (cache shared via invalidation)

**Net effect:** 60-80% reduction in profile fetch calls for multi-tab users

---

## Success Metrics

After deployment, expect:
1. **0 false "Session invalid" errors** due to cache desync
2. **1-2% reduction** in Supabase API call volume (fewer profile fetches)
3. **No increase** in refresh_token exhaustion errors
4. **<50ms latency** added by refresh lock (negligible)

---

## Next Steps

1. ✅ Analysis complete (this document)
2. ⏳ Implementation
3. ⏳ Testing
4. ⏳ Manual UAT
5. ⏳ Deploy to staging
6. ⏳ Monitor for 24 hours
7. ⏳ Deploy to production

---

## References

- **Item 2 Fix:** commit f11d094, PR #97 (transient error handling)
- **Current Code:** shared/portal-session.js (lines 109-218)
- **Test Contract:** testing/portal-session-item2.test.js (Item 2 scenarios)
- **Related:** CX_SESSION_SALDO_P0_FIX.md (prior session closure work)

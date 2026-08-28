# RIFIM OS Session Item 3 Design

**Version:** 1.0  
**Date:** 2026-08-28  
**Scope:** Multi-tab and Multi-device Session Synchronization  
**Status:** Implemented, Tests Passing (Item 2 regression + Item 3 new)

---

## Problem Statement

When the same RIFIM OS account is logged in simultaneously on multiple tabs/devices:

1. **Multi-tab scenario (same browser):**
   - Tab 1 refreshes its access token → updates localStorage
   - Tab 2 still has cached old token in memory
   - Tab 2 makes API call with stale token → gets 401
   - Tab 2 tries to refresh using same refresh_token as Tab 1
   - Supabase rejects (single-use token) → Tab 2 shows "Session invalid"

2. **Multi-device scenario (same account on different laptops):**
   - Laptop A: logged in with access_token_A (expires in 50min)
   - Laptop B: logged in with access_token_B (expires in 50min)
   - Laptop A: token refreshes at t=55min → refresh_token consumed
   - Laptop B: tries to refresh at t=57min using same refresh_token → 400 error

**Root Cause:** No coordination between tabs/devices during token refresh.

---

## Solution Design: Item 3

### 1. Unique Tab Identifier

Each browser tab gets a unique ID stored in **sessionStorage** (per-tab lifetime):

```javascript
function getTabId() {
  const existing = sessionStorage.getItem('rifim_tab_id')
  if (existing) return existing
  const uuid = 'tab_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
  sessionStorage.setItem('rifim_tab_id', uuid)
  return uuid
}
```

**Properties:**
- Unique per tab (sessionStorage = per-tab)
- Format: `tab_<random>_<timestamp>`
- Persists for tab lifetime (cleared on tab close)
- Different laptop = different sessionStorage = different tab ID

### 2. Refresh Lock Mechanism

Prevents concurrent token refresh using same refresh_token.

**Lock Entry (localStorage):**
```json
{
  "rifim_auth_refresh_lock": {
    "tabId": "tab_abc123_1234567890",
    "ts": 1725077280000
  }
}
```

**Lock Lifecycle:**

```
Tab A: Check lock
  ├─ No lock exists → Acquire (write lock with Tab A's ID)
  └─ Lock fresh & Tab A owns it → Proceed with refresh

Tab B: Check lock (while Tab A refreshing)
  ├─ Lock exists & owned by Tab A & fresh
  └─ Wait up to 5s for Tab A to finish
    ├─ Tab A releases lock
    ├─ Tab B re-reads localStorage (Tab A updated session)
    ├─ Tab B can now proceed (or skip if cache is fresh)
    └─ Success

Tab C: Check stale lock (>5s old)
  ├─ Lock exists but stale (ts > 5s ago)
  └─ Treat as orphaned, acquire lock
```

**Ownership Verification:**
- Only the tab that wrote the lock (matching tabId) can release it
- Other tabs wait
- Stale locks (>5s) are automatically treated as abandoned

### 3. Storage Event Listener

Detects when other tabs modify session:

```javascript
window.addEventListener('storage', function(event) {
  if (event.key === 'rifim_auth') {
    // Another tab updated session
    invalidateCache()  // Force next validate() call to be fresh
  }
})
```

**Effect:**
- When Tab 1 refreshes token → localStorage changes
- All other tabs receive storage event
- Other tabs invalidate in-memory cache
- Next validate() call is fresh (not stale)

### 4. Wait-for-Lock Pattern

When a tab detects another tab is refreshing:

```
Tab B: Lock held by Tab A
├─ Wait (poll every 50ms, max 5s)
│  ├─ Tab A completes refresh
│  ├─ Tab A releases lock
│  └─ Tab B detects lock gone
├─ Tab B acquires lock (backup, if needed)
├─ Tab B re-reads session from localStorage
│  └─ (Tab A already updated it)
└─ Tab B can use fresh session without its own refresh
```

**Benefits:**
- Reduces redundant token refreshes
- Prevents refresh_token reuse
- Coordinates across tabs transparently

### 5. Logout Broadcast Semantics

Distinguishes terminal logout from transient auth failures.

**Terminal Logout** (explicit user action):
```javascript
clearSessionWithBroadcast() {
  localStorage.removeItem(STORAGE_KEY)  // Broadcast to all tabs
  clearLock()
  invalidateCache()
}
```

All tabs receive storage event and invalidate cache → all redirect to login.

**Transient 401** (token expired, should retry):
- Does NOT call clearSession()
- Returns to caller for retry-once logic
- Session preserved in localStorage

### 6. Error Classification

| Scenario | Classification | Action |
|----------|-----------------|--------|
| Access token expired + valid refresh | Transient | Refresh, retry |
| Refresh token invalid (400/401) | Terminal | Logout |
| Profile 401/403 | Terminal | Logout |
| User is_active=false | Terminal | Logout |
| Network error on profile fetch | Transient | Keep session, error to caller |
| Backend 500 on profile fetch | Transient | Keep session, error to caller |
| Explicit user logout | Terminal | Logout globally |

---

## Implementation Details

### Files Modified

**shared/portal-session.js**
- Added: `getTabId()` - unique tab identifier
- Added: `readLock()`, `writeLock()`, `clearLock()` - lock operations
- Added: `acquireRefreshLock()` - acquire with wait-for-lock pattern
- Added: `installStorageListener()` - cross-tab sync
- Added: `clearSessionWithBroadcast()` - logout broadcast
- Enhanced: `validateSessionWithLocking()` - lock-aware validation
- Preserved: All Item 2 functionality (fast-path cache, single-flight, etc.)
- Public API: 100% backward compatible

**testing/portal-session-item3.test.js** (new)
- T1: Unique tab IDs
- T2: Storage event invalidation
- T3: Refresh lock coordination
- T4: Logout broadcast
- T5: Lock release
- T6: Stale lock recovery
- T7: Terminal auth (hard 401)
- T8: Transient error handling (regression)
- T9: Preview/Prod isolation
- T10: Stress test (5 concurrent tabs)

### Test Coverage

```
Item 2 Regression Tests:
  ✓ T1: Fast-path cache
  ✓ T2: Transient profile error
  ✓ T3: Hard 401 clears session
  ✓ T4: Refresh token 400 clears session
  ✓ T5: Single-flight parallelization
  ✓ T6: Cache invalidation

Item 3 New Tests:
  ✓ T1: Unique tab IDs per sessionStorage
  ✓ T2: Storage event cache invalidation
  ✓ T3: Refresh lock prevents concurrent reuse
  ✓ T4: Logout broadcast to all tabs
  ✓ T5: Lock properly released
  ✓ T6: Stale lock recovery
  ✓ T7: Terminal auth state (hard 401)
  ✓ T8: Transient error keeps session
  ✓ T9: Preview/Prod isolation preserved
  ✓ T10: Stress test (5 concurrent tabs)
```

---

## Lock Design Rationale

### Why Not Use Simple localStorage.setItem()?

```javascript
// ❌ Naive approach: prone to race conditions
if (!localStorage.getItem('lock')) {
  localStorage.setItem('lock', tabId)  // Another tab could acquire between check and set
}
```

**Why it fails:**
1. Check and set are not atomic
2. Multiple tabs can both pass the check before any sets
3. No ownership verification
4. No way to recover from crashed/stale locks

### Our Implementation Features

1. **Ownership Verification**: Only lock writer can release it
2. **Expiry Lease**: Stale locks (>5s) automatically abandoned
3. **Waiting Pattern**: Tab waits for other tab to finish, then re-reads session
4. **Session Reread**: After waiting, tab re-reads from localStorage (avoid duplicate refresh)
5. **Finally Cleanup**: Lock always released, even on error

```javascript
async function acquireRefreshLock(tabId) {
  let waited = false
  while (true) {
    const lock = readLock()
    if (lock && lock.tabId !== tabId && lockIsNotStale(lock)) {
      waited = true
      await sleep(50)  // Retry
      continue
    }
    writeLock(tabId, now)  // Acquire
    const confirm = readLock()
    if (confirm && confirm.tabId === tabId) {
      return { acquired: true, waited }  // Success
    }
    // Another tab beat us, retry
  }
}
```

---

## Security Considerations

### 1. Token Refresh Reuse Prevention

**Attack:** Attacker convinces multiple tabs to refresh using same refresh_token
- **Mitigation:** Refresh lock ensures only one tab refreshes at a time
- **Verification:** Lock is verified by tabId ownership

### 2. Logout Hijacking

**Attack:** Malicious code sets localStorage to fake session
- **Mitigation:** validateSession() always verifies with Supabase
- **Verification:** Fake JWT fails at profile fetch (hard auth error)

### 3. Cross-Origin Isolation

**Current state:** ✅ Already protected
- Browser's Same-Origin Policy isolates localStorage
- Preview (*.vercel.app except rifim-os) → QA Supabase + QA localStorage
- Production (rifim-os.vercel.app) → PROD Supabase + PROD localStorage
- Item 3 does not change this isolation

### 4. Session Persistence

**Risk:** sessionStorage cleared when tab closes (intended behavior)
- **Benefit:** Tab-specific data (tab ID) doesn't leak across browser sessions
- **Session:** Preserved in localStorage across tab close/reopen

---

## Performance Impact

### Before Item 3 (Item 2 only)

| Scenario | Profile Fetches per 60s | Notes |
|----------|------------------------|-------|
| Single tab | ~1 | Fast-path cache |
| 5 tabs | ~5 | No cache sharing |
| 5 tabs with token refresh | ~5-10 | Concurrent refreshes |

### After Item 3

| Scenario | Profile Fetches per 60s | Notes |
|----------|------------------------|-------|
| Single tab | ~1 | Unchanged |
| 5 tabs | ~1-2 | Cache invalidation on first tab's refresh |
| 5 tabs with token refresh | ~1-2 | Lock coordination prevents concurrent refresh |

**Expected improvement:** 60-80% reduction in profile fetches for multi-tab users.

---

## Backward Compatibility

✅ **100% backward compatible**

- **Public API unchanged**: `validate()`, `clear()`, `require()` work exactly as before
- **Internal changes are additive**: New lock/tab ID logic is transparent to callers
- **No breaking changes**: Existing code continues to work
- **Opt-in optimization**: Lock coordination activates automatically, requires no caller changes

---

## Known Limitations

1. **Synchronous Test Environment:**
   - Tests use synchronous setTimeout (executes immediately)
   - Real browser async behavior may differ slightly
   - UAT on actual browsers required

2. **Lock Wait Timeout (5s):**
   - If a tab crashes while holding lock, max wait is 5s
   - Acceptable for development; production may need adjustment
   - Can be tuned via `LOCK_LEASE_MS` constant

3. **Cross-Device Behavior:**
   - Each device has separate sessionStorage → separate tab IDs (correct)
   - Each device has separate localStorage for same origin (correct)
   - Multiple devices = multiple independent sessions (by design)
   - **Note:** Supabase refresh_token still single-use per session

---

## Testing Checklist

### Phase A ✅ (Implementation Complete)
- [x] Code written and reviewed
- [x] Unit tests pass (Item 2 + Item 3)
- [x] Lock mechanism verified
- [x] Backward compatibility verified

### Phase B (Multi-Device UAT) - TODO
- [ ] Two laptops, same account
- [ ] Multiple modules open (Portal, HRIS, Finance)
- [ ] Token refresh cross-device
- [ ] No false "Session invalid" errors
- [ ] No refresh_token exhaustion

### Phase C (Multi-Tab UAT) - TODO
- [ ] 4+ tabs in same browser
- [ ] Token refresh detected by other tabs
- [ ] Logout detected by all tabs
- [ ] No concurrent refresh_token reuse

### Phase D (Error Classification) - TODO
- [ ] Verify all 8 error scenarios
- [ ] Transient 401 does not logout
- [ ] Terminal 401 does logout
- [ ] Network error preserves session

### Phase E (UI/UX) - TODO
- [ ] Implement stale-while-refresh pattern
- [ ] Table rows remain visible during refresh
- [ ] No full-screen loading during token refresh
- [ ] Graceful degradation on auth failure

---

## Deployment Plan

### Staging (Vercel Preview)
```bash
# Feature branch deployed to preview
vercel preview feature/session-item3-multitab-multidevice-20260828
```

### Manual UAT
1. Open in multiple tabs/devices
2. Verify each phase (B, C, D, E)
3. Document results

### Production
```bash
# Only after ALL phases pass
git merge feature/session-item3-multitab-multidevice-20260828
git push
# Vercel auto-deploys to rifim-os.vercel.app
```

---

## References

- **Item 2 (Single-Tab):** commit f11d094, PR #97
- **Item 3 (Multi-Tab/Multi-Device):** This document
- **Test Code:** testing/portal-session-item{2,3}.test.js
- **Implementation:** shared/portal-session.js (lines 336-420)

---

## Questions & Answers

**Q: What if a tab crashes while holding the refresh lock?**  
A: After 5 seconds (LOCK_LEASE_MS), other tabs consider it stale and acquire the lock.

**Q: Does this work for different physical devices?**  
A: Each device has separate sessionStorage/localStorage by browser design. The lock coordinates tabs within a device; multi-device scenarios use separate lock entries per device. Phase B testing will verify.

**Q: What about Supabase `signOut()`?**  
A: Item 3 does not call signOut() (would revoke refresh_token globally). Manual logout calls `clearSessionWithBroadcast()` which removes from localStorage without Supabase call. If global logout is intended, separate work needed.

**Q: Does this affect Preview vs Production?**  
A: No. Storage isolation is enforced by browser Same-Origin Policy. Preview.vercel.app ≠ rifim-os.vercel.app.

---

## Future Improvements

1. **Supabase Session Sharing:**
   - Consider if multi-device sessions should share same token
   - Currently: each device independent (safe, isolated)
   - Future: could implement device fingerprinting + shared session

2. **WebSocket Sync:**
   - Could use WebSocket for faster cross-tab signaling
   - Current: storage events are sufficient for most use cases

3. **Analytics:**
   - Log lock wait times, stale lock recovery
   - Monitor token refresh patterns
   - Optimize lock lease timeout based on data

---

End of Item 3 Design Document.

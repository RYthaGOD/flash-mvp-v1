# Pre-Testing Fix Plan - Complete Resolution

**Goal:** Fix all identified issues before testing to ensure perfect demo videos

**Status:** 🔄 IN PROGRESS

---

## ✅ Already Fixed (Verified)

1. ✅ **Relayer Service Database Locking** - `relayer.js` uses database as source of truth with proper locking
2. ✅ **BTC Deposit Handler** - Uses database locking, no in-memory Set
3. ✅ **Status Transition Validation** - Implemented in `bridge.js:446`

---

## 🔴 CRITICAL FIXES (Must Fix Before Testing)

### Fix 1: BitcoinService Race Condition
**File:** `backend/src/services/bitcoin.js`
**Issue:** Already fixed (no processedTransactions Set found at line 76 - already removed)

**Action:** Verify the fix is complete and checkForNewPayments uses database first

---

### Fix 2: Reserve Operations Not Atomic
**Files:** 
- `backend/src/services/btc-relayer.js:304, 379`
- `backend/src/routes/bridge.js:265`

**Issue:** Direct calls to `getCurrentReserveBTC()` and `addToReserve()` are not atomic

**Solution:** 
- `checkAndReserveBTC()` already exists and is atomic ✅
- Remove direct reserve manipulation
- Use database methods only

**Action:**
1. Fix btc-relayer.js to remove non-atomic reserve operations
2. Fix bridge.js to remove non-atomic reserve operations
3. Ensure all reserve operations go through database

---

### Fix 3: Zcash Monitor Race Condition
**File:** `backend/src/services/zcash-monitor.js:13`
**Issue:** Uses in-memory Map, checked before database

**Action:** 
1. Remove processedTransactions Map
2. Use database as source of truth
3. Add database locking

---

### Fix 4: BTC Relayer Race Condition
**File:** `backend/src/services/btc-relayer.js:16`
**Issue:** Uses in-memory Map for processedEvents

**Action:**
1. Remove processedEvents Map (or use only as cache)
2. Use database as source of truth
3. Already has database locking but need to verify it's checked first

---

## 🟡 HIGH PRIORITY FIXES

### Fix 5: Input Validation in Relayer Services
**Files:**
- `backend/src/services/relayer.js:263`
- `backend/src/services/btc-relayer.js:155`

**Action:**
1. Add validation for PublicKey format
2. Add validation for positive amounts
3. Add validation for signature format

---

### Fix 6: Transaction ID Generation
**Files:**
- `backend/src/services/relayer.js:389`
- `backend/src/services/btc-relayer.js:261`

**Issue:** Using timestamp can collide

**Action:**
1. Use signature as primary ID
2. Add random component: `${signature}_${crypto.randomBytes(8).toString('hex')}`
3. Or use database sequence

---

### Fix 7: Stuck Processing Status Timeout
**File:** `backend/src/services/btc-deposit-handler.js`

**Action:**
1. Add timeout check (5 minutes)
2. Auto-reset to previous status if timeout
3. Add monitoring/alerting

---

## 🟢 NICE TO HAVE (For Demo Quality)

### Fix 8: Rate Limiting
**Action:** Add express-rate-limit middleware

### Fix 9: Enhanced Error Messages
**Action:** Include tx IDs, addresses, amounts in all error messages

---

## Implementation Order

1. ✅ Verify BitcoinService fix
2. 🔄 Fix reserve atomicity (btc-relayer.js, bridge.js)
3. 🔄 Fix zcash-monitor race condition
4. 🔄 Fix btc-relayer race condition
5. 🔄 Add input validation
6. 🔄 Fix transaction ID generation
7. 🔄 Add stuck status timeout
8. ⏸️ Add rate limiting (optional for demo)
9. ⏸️ Improve error messages (optional for demo)

---

## Testing Checklist After Fixes

- [ ] Concurrent deposit claims (test race condition fix)
- [ ] Concurrent relayer events (test race condition fix)
- [ ] Concurrent withdrawals (test reserve atomicity)
- [ ] Server restart during processing
- [ ] Invalid input rejection
- [ ] Transaction ID uniqueness
- [ ] Stuck status recovery

---

## Timeline

**Estimated Time:** 2-3 hours for critical fixes
**Target:** Complete all critical fixes before testing


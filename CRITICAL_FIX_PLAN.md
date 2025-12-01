# Critical Fix Plan - Complete System Cleanup

**Priority:** 🔴 **URGENT** - Must fix before testnet testing

---

## 🎯 Goal

Clean, working system using **Native ZEC only** with simple transfer-based operations.

---

## Phase 1: Remove Broken Burn Operations (CRITICAL)

### Files to Fix:
1. ✅ `backend/src/services/btc-relayer.js` - Remove `BurnToBTCEvent` listener
2. ✅ `backend/src/services/solana.js` - Remove burn methods
3. ✅ `frontend/src/components/tabs/TokenManagementTab.js` - Remove burn UI
4. ✅ `backend/src/services/database.js` - Update schema references

---

## Phase 2: Implement Simple Redemption (CRITICAL)

### New Redemption Flow:
```
1. User transfers native ZEC from wallet to bridge treasury
2. User calls POST /api/bridge/redeem-for-btc with:
   - transferSignature (proof of transfer)
   - btcAddress (encrypted)
   - amount
3. Backend verifies transfer on-chain
4. Backend sends BTC to user
```

### New Files/Code:
1. ✅ `backend/src/routes/bridge.js` - Add `POST /api/bridge/redeem-for-btc` endpoint
2. ✅ `backend/src/services/redemption.js` - New service for redemption logic
3. ✅ Frontend - Update UI for redemption

---

## Phase 3: Clean Up Program Dependencies

### Fixes:
1. ✅ Remove `getProgram()` calls for bridge operations
2. ✅ Make program optional (only needed for Arcium MPC)
3. ✅ Fix IDL loading logic

---

## Phase 4: Remove Custom Token Code

### Cleanup:
1. ✅ Remove or disable `mintZenZEC()` (keep as fallback if needed)
2. ✅ Update all references to use native ZEC only
3. ✅ Clean up environment variable confusion

---

## Implementation Order

1. **First:** Remove broken burn code (prevents crashes)
2. **Second:** Implement redemption API (enables BTC redemption)
3. **Third:** Clean up program dependencies (fixes startup issues)
4. **Fourth:** Remove dead code (clean codebase)

---

## Expected Outcome

✅ Clean, simple system:
- BTC → Native ZEC (transfer from treasury) ✅
- Native ZEC → BTC (transfer back + redemption API) ✅
- No broken dependencies ✅
- All code matches actual implementation ✅


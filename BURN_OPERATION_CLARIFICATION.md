# Burn Operation Clarification

## Issue Identified

**Current Problem:** The system has "burn" operations for the reverse flow (native ZEC → BTC), but **burning is unnecessary** when using native ZEC.

## Why Burn Doesn't Make Sense

1. **Native ZEC is NOT a custom token**
   - Native ZEC is the official ZEC token on Solana
   - Burning it would destroy real ZEC, which doesn't make sense
   - Native ZEC should be transferred back to treasury, not destroyed

2. **Correct Flow Should Be:**
   ```
   User has native ZEC → Transfer back to bridge/treasury → Bridge sends BTC
   ```
   
   NOT:
   ```
   User has native ZEC → Burn (destroy) → Bridge sends BTC ❌
   ```

## Current Implementation (WRONG)

The system currently has:
- `burnForBtc()` instruction in Solana program
- `BurnToBTCEvent` that relayer listens for
- `processBurnToBTCEvent()` in btc-relayer.js
- Frontend UI for "burn zenZEC for BTC"

**This is incorrect** if using native ZEC.

## Correct Implementation

### Option 1: Simple Transfer Back (RECOMMENDED)
```
User initiates withdrawal → 
Transfer native ZEC from user to bridge treasury →
Bridge verifies transfer →
Bridge sends BTC to user
```

### Option 2: Lock/Unlock Mechanism
```
User initiates withdrawal →
Lock native ZEC in escrow →
Bridge sends BTC →
After confirmation, transfer locked ZEC to treasury
```

### Option 3: API-Based Redemption (SIMPLEST)
```
User calls API: POST /api/bridge/redeem-for-btc
{
  amount: 1.0,
  btcAddress: "bc1q...",
  solanaSignature: "proof of ownership"
}

→ Bridge verifies user owns native ZEC →
→ Bridge transfers native ZEC from user to treasury →
→ Bridge sends BTC to user
```

## What Needs to Change

### Files That Reference "Burn" (Need Review/Removal):

1. **Solana Program** (`flash-bridge-mxe/programs/...`)
   - `burnForBtc` instruction - REMOVE or REPLACE with transfer
   
2. **Backend Services:**
   - `backend/src/services/btc-relayer.js` - `processBurnToBTCEvent()` → Replace with transfer verification
   - `backend/src/services/relayer.js` - `processBurnSwapEvent()` - Keep for SOL swaps (different use case)
   - `backend/src/services/solana.js` - `burnZenZECForBTC()` → Replace with transfer method
   - `backend/src/services/solana.js` - `createBurnForBTCTransaction()` → Replace with transfer transaction

3. **Frontend:**
   - `frontend/src/components/tabs/TokenManagementTab.js` - "Burn zenZEC for BTC" UI → Change to "Redeem Native ZEC for BTC"

4. **Database:**
   - `burn_transactions` table - Keep for history, but rename concept to "redemption" or "withdrawal"

## Recommended Fix

### Replace Burn with Simple Transfer Redemption:

```javascript
// NEW METHOD: Transfer native ZEC back and get BTC
async redeemNativeZECForBTC(userAddress, amount, btcAddress, userSignature) {
  // 1. Verify user owns the native ZEC (check balance)
  // 2. Transfer native ZEC from user to bridge treasury
  // 3. Verify transfer completed
  // 4. Send BTC to user
}
```

### Updated Flow:
1. User calls API: `POST /api/bridge/redeem-for-btc`
2. Backend verifies user has sufficient native ZEC balance
3. User signs transaction to transfer native ZEC to treasury
4. Backend verifies transfer on-chain
5. Backend sends BTC to user's provided address

## Action Items

- [ ] Remove or replace `burnForBtc` Solana instruction
- [ ] Replace burn event handlers with transfer verification
- [ ] Update frontend UI to show "Redeem" instead of "Burn"
- [ ] Create new redemption API endpoint
- [ ] Update documentation to remove burn terminology

## Notes

- The **SOL swap relayer** (`processBurnSwapEvent`) is a different use case - users swap native ZEC for SOL, which is fine
- The issue is specifically with the **BTC redemption flow** using "burn"
- Native ZEC should always be transferred/locked, never destroyed


# BTC Relayer Review and Fixes

## Issues Found in Proposed Hybrid Automation Code

### 1. **CRITICAL: Incorrect getSolanaDeps Usage**
**Issue**: In `parseTokenTransfer()`, I used `require('./solana').getSolanaDeps()` but `getSolanaDeps` is a private function, not exported.

**Fix**: Use `solanaService` which is already imported, or access via the service's methods. For PublicKey and token utilities, use the already imported dependencies at the top of the file.

### 2. **getProgram() Error Handling**
**Issue**: `solanaService.getProgram()` throws an error if `programId` is null. Need graceful handling.

**Fix**: Wrap in try-catch and handle gracefully when program is not configured.

### 3. **Token Transfer Parsing Logic**
**Issue**: The `parseTokenTransfer()` logic may not correctly identify the sender from token balance changes. Token balance changes show which accounts had balance changes, but we need to identify which account decreased (sender) and which increased (receiver).

**Fix**: 
- Find the account with negative balance change (source)
- Find the account with positive balance change matching treasury (destination)
- Extract sender from transaction's accountKeys array

### 4. **Account Change Listener Too Broad**
**Issue**: `onAccountChange` fires on ANY balance change (incoming AND outgoing). This could trigger false positives when we send ZEC FROM treasury.

**Fix**: 
- Check if balance INCREASED (not just changed)
- Filter out transactions where treasury is the source
- Use transaction parsing to verify it's an incoming transfer

### 5. **Encrypted BTC Address Retrieval**
**Issue**: The `getEncryptedBTCAddress()` method doesn't actually parse the encrypted data from the account. It just returns the PDA address.

**Fix**: 
- Use Anchor program to fetch and deserialize the `EncryptedBtc` account
- Or use the program's coder to parse account data
- The `encrypted_address` field contains the actual encrypted data (Vec<u8>)

### 6. **Missing Error Handling**
**Issue**: Several async operations lack proper error handling that could cause the service to crash.

**Fix**: Add comprehensive try-catch blocks and logging.

### 7. **Database Event Processing Check**
**Issue**: When processing transfers, we should also check database to avoid reprocessing (similar to how relayer.js does it).

**Fix**: Check `databaseService.isEventProcessed()` before processing transfers.

### 8. **Transaction Parsing for Token Transfers**
**Issue**: The current approach of checking account changes then fetching transactions is inefficient and may miss transfers if multiple happen quickly.

**Better Approach**:
- Monitor treasury ZEC account for balance increases
- When increase detected, fetch recent transactions
- Parse each transaction to find token transfers TO treasury
- Verify transfer details (amount, sender)

### 9. **Missing PublicKey Import**
**Issue**: In `parseTokenTransfer`, we use `new deps.PublicKey()` but `deps` is not defined correctly.

**Fix**: Import PublicKey at the top, or use `solanaService` methods.

### 10. **Event Parser Initialization**
**Issue**: EventParser requires both programId and program coder. If getProgram() fails, eventParser won't work.

**Fix**: Handle this gracefully - event parsing is optional (nice to have) but not required for transfer-based automation.

## Corrected Implementation Plan

### Phase 1: Fix Core Issues
1. ✅ Fix getSolanaDeps usage
2. ✅ Add proper error handling for getProgram()
3. ✅ Fix token transfer parsing logic
4. ✅ Add database deduplication checks

### Phase 2: Improve Transfer Detection
1. ✅ Better balance change detection (only increases)
2. ✅ Proper transaction parsing with sender identification
3. ✅ Verify transfer destination is treasury

### Phase 3: Encrypted Address Handling
1. ✅ Properly fetch encrypted BTC address from program account
2. ✅ Handle case where encryption doesn't exist yet
3. ✅ Cache encryption data appropriately

### Phase 4: Robustness
1. ✅ Comprehensive error handling
2. ✅ Reconnection logic
3. ✅ Health checks
4. ✅ Rate limiting / throttling

## Implementation Status

- [x] Review complete
- [ ] Fixes applied
- [ ] Testing needed


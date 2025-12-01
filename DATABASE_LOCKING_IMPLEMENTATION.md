# Database-Level Locking Implementation

## Summary
Implemented database-level locking using `SELECT FOR UPDATE` and removed the in-memory Set to prevent race conditions in BTC deposit processing.

## Changes Made

### 1. Database Service (`backend/src/services/database.js`)

#### Added Methods:

**`getBTCDepositWithLock(txHash, client)`**
- Uses `SELECT FOR UPDATE` to lock the row
- Prevents concurrent access to the same deposit
- Supports transaction context via `client` parameter

**`markBTCDepositProcessing(txHash, userSolanaAddress, client)`**
- Atomically marks deposit as 'processing'
- Only updates if status is 'pending' or 'confirmed'
- Prevents status from being set to 'processing' if already 'processed' or 'processing'

#### Updated Methods:

**`updateBTCDepositStatus(txHash, status, updates, client)`**
- Added `client` parameter to support database transactions
- Now throws errors instead of returning null (for transaction safety)

### 2. BTC Deposit Handler (`backend/src/services/btc-deposit-handler.js`)

#### Removed:
- `this.processedDeposits = new Set()` - in-memory tracking removed
- All references to `processedDeposits.has()` and `processedDeposits.add()`

#### Added:
- Database transaction support with proper BEGIN/COMMIT/ROLLBACK
- Row-level locking using `SELECT FOR UPDATE`
- Input validation (Solana address format, token mint validation)
- Status check before processing (prevents duplicate processing)
- Atomic status transition: 'pending'/'confirmed' → 'processing' → 'processed'
- Proper rollback on errors (resets status if swap fails)

#### Flow:
1. **Validate inputs** - Check payment object, Solana address format, token mint
2. **Begin transaction** - Get database client and start transaction
3. **Lock row** - Use `SELECT FOR UPDATE` to lock deposit row
4. **Check status** - Verify deposit is not already processed or processing
5. **Mark as processing** - Atomically set status to 'processing'
6. **Process swap** - Execute swap (SOL or Jupiter)
7. **Mark as processed** - Only after successful swap
8. **Commit transaction** - Save all changes atomically
9. **Rollback on error** - Reset status if any step fails

## Benefits

### 1. Race Condition Prevention
- **Before**: Two concurrent requests could both pass in-memory check
- **After**: Database lock ensures only one request processes a deposit

### 2. State Consistency
- **Before**: In-memory Set could get out of sync with database
- **After**: Database is single source of truth

### 3. Crash Recovery
- **Before**: In-memory state lost on restart
- **After**: State persisted in database, can recover from crashes

### 4. Atomic Operations
- **Before**: Multiple separate database calls could fail partially
- **After**: All operations in single transaction, all-or-nothing

### 5. Error Handling
- **Before**: If swap failed, deposit marked as processed anyway
- **After**: Rollback ensures deposit can be retried if swap fails

## Testing Recommendations

### 1. Concurrency Test
```javascript
// Simulate 10 concurrent requests for same deposit
const promises = Array(10).fill(null).map(() => 
  btcDepositHandler.handleBTCDeposit(payment, userAddress)
);
const results = await Promise.allSettled(promises);
// Should have: 1 success, 9 "alreadyProcessed" or "processing"
```

### 2. Failure Recovery Test
```javascript
// Test swap failure after marking as processing
// Verify deposit status resets and can be retried
```

### 3. Database Transaction Test
```javascript
// Test that transaction rollback works correctly
// Verify no partial updates on error
```

## Migration Notes

- **No database schema changes required** - Uses existing `btc_deposits` table
- **Backward compatible** - Existing deposits continue to work
- **Status field values**: 'pending', 'confirmed', 'processing', 'processed'

## Performance Considerations

- **Lock timeout**: PostgreSQL default lock timeout applies
- **Lock contention**: Multiple deposits can be processed concurrently (different rows)
- **Transaction duration**: Should be kept short (swap operations may take time)

## Future Improvements

1. Add lock timeout handling
2. Add retry mechanism for failed swaps
3. Add monitoring/alerting for stuck 'processing' deposits
4. Consider adding 'processing' status timeout (auto-reset if stuck)


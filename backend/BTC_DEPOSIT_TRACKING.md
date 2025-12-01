# BTC Deposit Tracking & Audit System

## Overview

Complete tracking system for BTC deposits and withdrawals with full auditability and balance reconciliation. Ensures **ingoings align with outgoings** for verifiability.

## Features

### ✅ Complete Audit Trail
- **Deposits**: Tracked from detection → confirmation → processing
- **Withdrawals**: Tracked when BTC is sent out (from zenZEC burns)
- **Balance Reconciliation**: Compares database records vs actual blockchain balance
- **Status History**: Full lifecycle tracking with timestamps

### ✅ Fast Processing
- **Configurable Confirmations**: Default 1 confirmation (configurable via `BITCOIN_REQUIRED_CONFIRMATIONS`)
- **Database Persistence**: All deposits saved immediately on detection
- **Startup Restoration**: System restores state from database on restart

### ✅ Balance Reconciliation
- **Formula**: `Bootstrap + Confirmed Deposits - Confirmed Withdrawals = Expected Balance`
- **Automatic Verification**: Compares expected vs actual blockchain balance
- **Discrepancy Detection**: Flags any mismatches for investigation

## Database Schema

### `btc_deposits` Table
Tracks all incoming BTC deposits:
- `tx_hash` - Bitcoin transaction hash (unique)
- `bridge_address` - Bridge's Bitcoin address
- `amount_satoshis` / `amount_btc` - Deposit amount
- `confirmations` / `required_confirmations` - Confirmation status
- `status` - `pending` → `confirmed` → `processed`
- `solana_address` - User's Solana address (set when claimed)
- `solana_tx_signature` - Solana transaction (set when processed)
- `detected_at` / `confirmed_at` / `processed_at` - Timestamps

### `btc_withdrawals` Table
Tracks all outgoing BTC transactions:
- `tx_hash` - Bitcoin transaction hash (unique)
- `bridge_address` - Bridge's Bitcoin address
- `amount_satoshis` / `amount_btc` - Withdrawal amount
- `recipient_address` - User's Bitcoin address
- `solana_tx_signature` - Solana burn transaction that triggered this
- `solana_address` - User's Solana address
- `zen_zec_amount` - Amount of zenZEC burned
- `status` - `pending` → `confirmed` → `failed`

## Configuration

### Environment Variables

```env
# Bitcoin Configuration
BITCOIN_NETWORK=testnet  # or mainnet
BITCOIN_BRIDGE_ADDRESS=your_btc_address
BITCOIN_EXPLORER_URL=https://blockstream.info/api
BITCOIN_REQUIRED_CONFIRMATIONS=1  # Default: 1 (fast), increase for security

# Database (required for tracking)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=flash_bridge
DB_USER=postgres
DB_PASSWORD=your_password
```

## API Endpoints

### GET `/api/bridge/check-btc-deposits`
Returns detailed deposit information with balance reconciliation:

```json
{
  "success": true,
  "bridgeAddress": "tb1q...",
  "network": "testnet",
  "requiredConfirmations": 1,
  "summary": {
    "total": 2,
    "confirmed": 1,
    "pending": 1,
    "readyToProcess": 1,
    "alreadyProcessed": 0
  },
  "deposits": [...],
  "currentReserveBTC": 0.008,
  "reconciliation": {
    "reconciled": true,
    "actualBalanceBTC": 0.008,
    "expectedBalanceBTC": 0.008,
    "breakdown": {
      "bootstrapBTC": 0,
      "totalDepositsBTC": 0.008,
      "totalWithdrawalsBTC": 0,
      "netBalanceBTC": 0.008
    }
  }
}
```

### POST `/api/bridge/btc-deposit`
Claim a BTC deposit and receive tokens on Solana:

```json
{
  "solanaAddress": "YourSolanaAddress...",
  "bitcoinTxHash": "180a0ccee8b2d40e...",
  "outputTokenMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  // Optional, defaults to USDC
}
```

Response:
```json
{
  "success": true,
  "btcAmount": 0.003,
  "usdcAmount": 150,
  "outputToken": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "swapSignature": "SolanaTransactionSignature...",
  "bitcoinTxHash": "180a0ccee8b2d40e..."
}
```

## Testing the Complete Workflow

### Using the Test Script

```bash
# Check all deposits
npm run test-btc-workflow

# Test specific deposit
npm run test-btc-workflow <bitcoinTxHash> <solanaAddress>

# Example
npm run test-btc-workflow 180a0ccee8b2d40e8353fd9441ac9e35a79c8065433b0b1838883276de968578 YourSolanaAddress...
```

The test script will:
1. ✅ Check for BTC deposits
2. ✅ Wait for confirmation (if needed)
3. ✅ Claim the deposit
4. ✅ Verify Solana transaction

### Manual Testing

1. **Send BTC to bridge address** (from Cash App or any wallet)
2. **Check deposits**:
   ```bash
   curl http://localhost:3001/api/bridge/check-btc-deposits
   ```
3. **Wait for confirmation** (default: 1 confirmation, ~10 minutes on Bitcoin)
4. **Claim deposit**:
   ```bash
   curl -X POST http://localhost:3001/api/bridge/btc-deposit \
     -H "Content-Type: application/json" \
     -d '{
       "solanaAddress": "YourSolanaAddress...",
       "bitcoinTxHash": "your_btc_tx_hash"
     }'
   ```
5. **Verify Solana transaction** on Solscan or other explorer

## Balance Reconciliation

The system automatically reconciles balances using:

```
Expected Balance = Bootstrap + Confirmed Deposits - Confirmed Withdrawals
Actual Balance = Query from Bitcoin Explorer
Difference = Actual - Expected
```

### Reconciliation Status

- ✅ **Reconciled**: Difference within variance threshold (1% or 1000 satoshis)
- ⚠️ **Discrepancy**: Difference exceeds threshold (investigation needed)

### Reconciliation Breakdown

The reconciliation includes:
- **Bootstrap Amount**: Initial BTC reserve
- **Total Deposits**: Sum of all confirmed deposits
- **Total Withdrawals**: Sum of all confirmed withdrawals
- **Net Balance**: Bootstrap + Deposits - Withdrawals

## Workflow Diagram

```
User Sends BTC
    ↓
[Detection] → Saved to btc_deposits (status: pending)
    ↓
[Confirmation] → Updated in database (status: confirmed)
    ↓
[User Claims] → POST /api/bridge/btc-deposit
    ↓
[Processing] → Jupiter swap: USDC → User Token
    ↓
[Complete] → Updated in database (status: processed)
    ↓
Solana Transaction Sent ✅
```

## Audit Trail

Every BTC movement is tracked:

### Incoming (Deposits)
- Detected immediately when transaction appears
- Status updates as confirmations increase
- Marked as processed when user claims

### Outgoing (Withdrawals)
- Created when zenZEC is burned for BTC
- Linked to Solana burn transaction
- Tracks recipient address and amount

### Balance Verification
- Automatic reconciliation on every deposit check
- Flags discrepancies for manual review
- Complete breakdown of all movements

## Security Considerations

1. **Confirmation Requirements**: 
   - Default: 1 confirmation (fast, suitable for testnet/small amounts)
   - Increase to 3-6 for mainnet/large amounts
   - Configurable per environment

2. **Double-Spend Protection**:
   - Database prevents duplicate processing
   - Transaction hash uniqueness enforced
   - Status tracking prevents reprocessing

3. **Balance Verification**:
   - Regular reconciliation catches discrepancies
   - Variance threshold accounts for fees
   - Complete audit trail for investigation

## Troubleshooting

### Deposits Not Detected
- Check `BITCOIN_BRIDGE_ADDRESS` is correct
- Verify `BITCOIN_EXPLORER_URL` is accessible
- Check Bitcoin network matches (testnet vs mainnet)

### Balance Not Reconciling
- Verify database is connected
- Check for pending withdrawals
- Review reconciliation breakdown for details

### Deposit Not Processing
- Check confirmation count meets requirement
- Verify deposit status in database
- Check Solana service is configured correctly

## Next Steps

1. **Run Database Migration**: Apply schema updates
   ```bash
   npm run migrate
   ```

2. **Configure Environment**: Set `BITCOIN_REQUIRED_CONFIRMATIONS` and database credentials

3. **Test Workflow**: Use test script to verify end-to-end flow

4. **Monitor**: Check `/api/bridge/check-btc-deposits` regularly for reconciliation status


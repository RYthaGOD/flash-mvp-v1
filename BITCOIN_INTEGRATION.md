# Bitcoin Integration Guide

## Overview

The FLASH Bridge now supports direct Bitcoin payments optimized for Cash App users. This enables seamless onboarding from Cash App → Bitcoin → Solana.

## Architecture

```
Cash App User
    ↓
Buys BTC on Cash App
    ↓
Sends BTC to Bridge Address
    ↓
Bitcoin Blockchain (6+ confirmations)
    ↓
Bridge Verifies Payment
    ↓
Optional: Convert BTC → ZEC (privacy layer)
    ↓
Mint zenZEC on Solana
```

## Setup

### 1. Generate Bitcoin Address

You need a Bitcoin address where users will send BTC. You can:

**Option A: Use existing Bitcoin wallet**
- Generate address from your Bitcoin wallet
- Set `BITCOIN_BRIDGE_ADDRESS` in `.env`

**Option B: Generate programmatically** (for production)
- Use `bitcoinjs-lib` to generate addresses
- Store private keys securely (HSM/KMS)

### 2. Configure Environment Variables

```env
# Required
BITCOIN_BRIDGE_ADDRESS=bc1q...  # Your Bitcoin address
BITCOIN_NETWORK=mainnet  # or testnet

# Optional
BITCOIN_EXPLORER_URL=https://blockstream.info/api
BOOTSTRAP_BTC=0.1  # Initial reserve (in BTC)
ENABLE_BITCOIN_MONITORING=true  # Auto-detect payments
```

### 3. Bootstrap Reserve

Before users can bridge, you need initial liquidity:

```bash
# Send BTC to bridge address
# Example: Send 0.1 BTC to bc1q...
```

The bridge will track this as the initial reserve.

## Cash App User Flow

### Step 1: User Buys BTC on Cash App
- User opens Cash App
- Buys Bitcoin (e.g., $10 worth)
- BTC is in user's Cash App wallet

### Step 2: User Gets Bridge Address
- User visits your frontend
- Connects Solana wallet
- Frontend displays bridge Bitcoin address
- User copies address

### Step 3: User Sends BTC from Cash App
- User opens Cash App
- Sends BTC to bridge address
- Gets Bitcoin transaction hash

### Step 4: User Submits Bridge Request
- User enters:
  - Solana address (from connected wallet)
  - Amount (BTC amount sent)
  - Bitcoin transaction hash
- Frontend calls `POST /api/bridge`

### Step 5: Bridge Processes
- Backend verifies Bitcoin payment (6+ confirmations)
- Optional: Converts BTC → ZEC (if privacy enabled)
- Mints zenZEC to user's Solana address
- User receives zenZEC tokens

## API Usage

### Verify Bitcoin Payment

```javascript
// Frontend example
const response = await fetch('http://localhost:3001/api/bridge', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    solanaAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    amount: 0.01,  // BTC amount
    bitcoinTxHash: 'abc123...',  // From Cash App
    swapToSol: false,
    useZecPrivacy: false,  // Optional: enable ZEC privacy layer
  }),
});

const result = await response.json();
console.log('Bridge result:', result);
```

### Get Bridge Info

```javascript
const response = await fetch('http://localhost:3001/api/bridge/info');
const info = await response.json();
console.log('Bridge address:', info.bitcoin.bridgeAddress);
console.log('Current reserve:', info.bitcoin.currentReserve);
```

## Reserve Management

### How Reserves Work

1. **Bootstrap**: Initial BTC deposit (e.g., 0.1 BTC)
2. **User Deposits**: BTC from Cash App users
3. **Reserve Tracking**: Total BTC = Bootstrap + User Deposits
4. **Minting Limit**: Can only mint zenZEC up to reserve amount

### Reserve Formula

```
Total Reserve = Bootstrap BTC + User Deposits
Mintable zenZEC = Total Reserve - Already Minted
```

### Example

```
Bootstrap: 0.1 BTC
User 1 deposits: 0.01 BTC → Reserve = 0.11 BTC
User 2 deposits: 0.05 BTC → Reserve = 0.16 BTC

Total mintable: 0.16 zenZEC (1:1 ratio)
```

## Privacy Layer (Optional)

### BTC → ZEC Conversion

Enable privacy by converting BTC to ZEC:

```json
{
  "useZecPrivacy": true
}
```

**Flow:**
1. User sends BTC
2. Bridge verifies BTC payment
3. Bridge converts BTC → ZEC (via exchange)
4. ZEC held in shielded address
5. zenZEC minted (backed by ZEC)

**Benefits:**
- Privacy preserved via Zcash shielding
- Amounts not visible on Bitcoin blockchain
- Still maintains 1:1 backing

## Monitoring

### Automatic Monitoring

Enable automatic Bitcoin payment detection:

```env
ENABLE_BITCOIN_MONITORING=true
```

The service will:
- Poll Bitcoin blockchain every minute
- Detect new payments to bridge address
- Automatically trigger zenZEC minting (in production)

### Manual Verification

You can also verify payments manually:

```javascript
const bitcoinService = require('./services/bitcoin');

const verification = await bitcoinService.verifyBitcoinPayment(
  'tx_hash_here',
  0.01  // Expected amount in BTC
);

if (verification.verified) {
  console.log(`Payment verified: ${verification.amountBTC} BTC`);
  console.log(`Confirmations: ${verification.confirmations}`);
}
```

## Security Considerations

### Confirmation Requirements

- **Minimum**: 1 confirmation (for testing)
- **Recommended**: 6 confirmations (for production)
- **High Value**: 12+ confirmations

### Address Security

- **Never expose private keys**
- Use HSM/KMS for production
- Rotate addresses periodically
- Monitor for suspicious activity

### Reserve Management

- Track reserves on-chain (Solana program)
- Verify reserves match actual BTC holdings
- Implement reserve audits
- Set maximum mint limits

## Testing

### Testnet Setup

```env
BITCOIN_NETWORK=testnet
BITCOIN_BRIDGE_ADDRESS=tb1q...  # Testnet address
BITCOIN_EXPLORER_URL=https://blockstream.info/testnet/api
```

### Test Flow

1. Get testnet BTC from faucet
2. Send to testnet bridge address
3. Verify payment on testnet explorer
4. Test bridge minting

## Production Checklist

- [ ] Generate secure Bitcoin address
- [ ] Set up HSM/KMS for key management
- [ ] Bootstrap initial reserve
- [ ] Configure monitoring
- [ ] Set up alerts for large deposits
- [ ] Implement reserve audits
- [ ] Test with small amounts first
- [ ] Set maximum transaction limits
- [ ] Enable rate limiting
- [ ] Set up backup monitoring

## Troubleshooting

### Payment Not Detected

- Check Bitcoin address is correct
- Verify transaction has 6+ confirmations
- Check explorer API is accessible
- Review monitoring logs

### Verification Fails

- Ensure transaction hash is correct
- Check amount matches exactly
- Verify transaction is confirmed
- Check network (mainnet vs testnet)

### Reserve Issues

- Verify bootstrap amount is set
- Check reserve tracking is working
- Ensure on-chain reserve matches off-chain
- Review minting limits

## Support

For issues or questions:
- Check logs: `backend/src/services/bitcoin.js`
- Review API responses
- Test with small amounts first
- Contact support if needed


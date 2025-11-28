# Native ZEC Setup Guide

This guide explains how to configure and use native ZEC tokens on Solana instead of minting custom zenZEC tokens.

## Overview

Native ZEC is the official unwrapped ZEC token available on Solana. Using native ZEC provides several benefits:

- ✅ **Better Liquidity**: Native ZEC is already integrated with Jupiter, Raydium, and other DEXs
- ✅ **Standard Compliance**: Uses the official ZEC token, not a custom mint
- ✅ **Better UX**: Users receive a recognized token they can trade immediately
- ✅ **Lower Maintenance**: No need to manage custom token minting

## Configuration

### 1. Set Environment Variables

Add to your `.env` file:

```env
# Enable native ZEC (recommended)
USE_NATIVE_ZEC=true

# Set native ZEC mint address (official native ZEC on Solana)
NATIVE_ZEC_MINT=A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS

# Or use ZEC_MINT as alias
ZEC_MINT=A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS
```

### 2. Native ZEC Mint Address

The official native ZEC mint address on Solana is:

```
A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS
```

This is the unwrapped/native ZEC token available on Solana. You can verify it on:
- **Solana Explorer**: Search for the mint address
- **Jupiter**: Check if it's available for swaps
- **Raydium**: Verify liquidity pools exist

### 3. Fund Treasury with Native ZEC

The bridge needs a treasury (reserve) of native ZEC tokens to transfer to users.

#### Step 1: Get Treasury Address

Your treasury address is your **relayer keypair's public key**:

```bash
# View relayer public key
solana address -k relayer-keypair.json
```

#### Step 2: Create Token Account

Create a token account for native ZEC at the treasury address:

```bash
# Official native ZEC mint address
NATIVE_ZEC_MINT=A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS

# Create associated token account
spl-token create-account $NATIVE_ZEC_MINT \
  --owner relayer-keypair.json \
  --url devnet  # or mainnet-beta
```

#### Step 3: Transfer Native ZEC to Treasury

Transfer native ZEC tokens to the treasury token account:

```bash
# Transfer from your wallet to treasury
spl-token transfer $NATIVE_ZEC_MINT <amount> \
  <treasury-token-account-address> \
  --owner your-wallet-keypair.json \
  --url devnet
```

Or use a Solana wallet (Phantom, Solflare) to send native ZEC to the treasury token account.

### 4. Verify Treasury Balance

Check that the treasury has sufficient ZEC:

```bash
# Check balance
spl-token balance $NATIVE_ZEC_MINT \
  --owner relayer-keypair.json \
  --url devnet
```

Or use the API:

```bash
curl http://localhost:3001/api/bridge/info
```

The response will show ZEC reserve status.

## How It Works

### Bridge Flow with Native ZEC

1. **User sends ZEC** to bridge's Zcash address
2. **Bridge verifies** Zcash transaction
3. **Bridge transfers** native ZEC from treasury to user's Solana address
4. **User receives** native ZEC (can trade immediately on Jupiter/Raydium)

### Reserve Management

- The bridge checks treasury balance before each transfer
- If treasury balance is insufficient, the bridge will reject the request
- Monitor treasury balance and refill as needed
- Set up alerts for low balance

## API Behavior

### With Native ZEC Enabled (`USE_NATIVE_ZEC=true`)

```javascript
// ZEC flow uses native ZEC transfer
POST /api/bridge
{
  "solanaAddress": "user...",
  "amount": 1.0,
  "zcashTxHash": "zec_tx_hash..."
}

// Response: Native ZEC transferred to user
{
  "success": true,
  "transactionId": "...",
  "solanaTxSignature": "...",
  "amount": 1.0,
  "tokenType": "native ZEC"
}
```

### With Native ZEC Disabled (`USE_NATIVE_ZEC=false`)

```javascript
// ZEC flow uses zenZEC minting (legacy)
POST /api/bridge
{
  "solanaAddress": "user...",
  "amount": 1.0,
  "zcashTxHash": "zec_tx_hash..."
}

// Response: zenZEC minted to user
{
  "success": true,
  "transactionId": "...",
  "solanaTxSignature": "...",
  "amount": 1.0,
  "tokenType": "zenZEC"
}
```

## Troubleshooting

### Error: "Native ZEC mint not configured"

**Solution**: Set `NATIVE_ZEC_MINT` or `ZEC_MINT` in `.env`

```env
NATIVE_ZEC_MINT=YourNativeZECMintAddressHere
```

### Error: "Treasury ZEC account does not exist"

**Solution**: Create the token account for native ZEC at treasury address

```bash
spl-token create-account $NATIVE_ZEC_MINT \
  --owner relayer-keypair.json
```

### Error: "Insufficient ZEC reserves"

**Solution**: Fund the treasury with more native ZEC

```bash
spl-token transfer $NATIVE_ZEC_MINT <amount> \
  <treasury-token-account>
```

### Error: "Relayer keypair not configured"

**Solution**: Ensure relayer keypair is set up

```env
RELAYER_KEYPAIR_PATH=path/to/relayer-keypair.json
```

## Migration from zenZEC

If you're currently using zenZEC and want to switch to native ZEC:

1. **Set up native ZEC** (follow steps above)
2. **Fund treasury** with native ZEC
3. **Set `USE_NATIVE_ZEC=true`** in `.env`
4. **Test** with a small amount
5. **Monitor** treasury balance
6. **Gradually migrate** users to native ZEC

You can keep zenZEC support enabled for backward compatibility:

```env
USE_NATIVE_ZEC=true  # Use native ZEC for new transactions
ZENZEC_MINT=...      # Keep for legacy support
```

## Best Practices

1. **Monitor Treasury Balance**: Set up alerts for low balance
2. **Automated Refilling**: Consider automated treasury management
3. **Multi-Sig Treasury**: Use multi-sig for production treasury
4. **Reserve Limits**: Set minimum reserve thresholds
5. **Rate Limiting**: Implement rate limiting to prevent rapid depletion

## Security Considerations

- **Treasury Security**: Protect relayer keypair (use hardware wallet for production)
- **Balance Monitoring**: Monitor for unusual activity
- **Access Control**: Restrict who can fund/withdraw from treasury
- **Audit Trail**: Log all treasury operations

## Support

For issues or questions:
- Check logs: `backend/logs/`
- API health: `GET /health`
- Bridge info: `GET /api/bridge/info`
- Contact: [@moneybag_fin](https://twitter.com/moneybag_fin)


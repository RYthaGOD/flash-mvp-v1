# BTC Deposit Architecture - USDC Treasury + Jupiter Swaps

## Overview

The system now uses a **BTC relayer** that watches for BTC deposits and automatically swaps USDC from treasury to user's desired token via Jupiter DEX.

## Architecture Flow

```
1. User sends BTC → Bridge Address
   ↓
2. BTC Relayer detects deposit (monitoring)
   ↓
3. User calls API: POST /api/bridge/btc-deposit
   - Provides: solanaAddress, bitcoinTxHash, outputTokenMint (optional)
   ↓
4. System verifies BTC payment
   ↓
5. Calculates USDC equivalent (BTC → USDC rate)
   ↓
6. Jupiter swaps USDC → User's desired token
   ↓
7. Tokens sent directly to user's Solana address
```

## Key Components

### 1. BTC Deposit Handler (`backend/src/services/btc-deposit-handler.js`)
- Handles BTC deposit verification
- Calculates USDC equivalent
- Triggers Jupiter swap
- Manages deposit processing state

### 2. Jupiter Service (`backend/src/services/jupiter.js`)
- `swapUSDCForToken()` - Swaps USDC from treasury to user's token
- Uses treasury keypair for signing
- MEV protection built-in

### 3. Bitcoin Service (`backend/src/services/bitcoin.js`)
- Monitors bridge address for deposits
- Verifies BTC payments
- Tracks BTC reserve

## Configuration

### Required Environment Variables

```env
# Solana Network
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta

# Bitcoin Bridge Address (where users send BTC)
BITCOIN_BRIDGE_ADDRESS=bc1q...
ENABLE_BITCOIN_MONITORING=true

# Treasury (USDC)
# Uses treasury-keypair.json (already exists)
# Treasury should have USDC balance for swaps

# Exchange Rates
BTC_TO_USDC_RATE=50000  # 1 BTC = 50,000 USDC (adjust as needed)

# Jupiter DEX
JUPITER_PRIVACY_MODE=high
```

### Optional Environment Variables

```env
# Program ID (optional - not needed for BTC deposit flow)
PROGRAM_ID=...

# Relayer (for other features)
RELAYER_KEYPAIR_PATH=backend/relayer-keypair-new.json
ENABLE_RELAYER=false
```

## API Endpoints

### Claim BTC Deposit
```http
POST /api/bridge/btc-deposit
Content-Type: application/json

{
  "solanaAddress": "User's Solana wallet address",
  "bitcoinTxHash": "BTC transaction hash",
  "outputTokenMint": "Token mint address (optional, defaults to USDC)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "BTC deposit processed successfully",
  "bitcoinTxHash": "...",
  "btcAmount": 0.001,
  "usdcAmount": 50,
  "outputToken": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "swapSignature": "Solana transaction signature",
  "solanaAddress": "..."
}
```

## Setup Steps

### 1. Configure Bitcoin Bridge Address
```env
BITCOIN_BRIDGE_ADDRESS=bc1qyourbitcoinaddress
ENABLE_BITCOIN_MONITORING=true
```

### 2. Ensure Treasury Has USDC
- Treasury keypair: `backend/treasury-keypair.json`
- Treasury should have USDC balance for swaps
- Check balance: Use Jupiter service or Solana explorer

### 3. Set Exchange Rate
```env
BTC_TO_USDC_RATE=50000  # Adjust based on current BTC price
```

### 4. Start Backend
```bash
cd backend
npm start
```

## User Flow

1. **User sends BTC** to bridge address
2. **System detects deposit** (monitoring every 60 seconds)
3. **User calls API** with their Solana address and BTC tx hash
4. **System verifies** BTC payment (6+ confirmations)
5. **System calculates** USDC equivalent
6. **Jupiter swaps** USDC → User's token
7. **Tokens arrive** in user's Solana wallet

## Benefits

✅ **No zenZEC mint needed** - Direct token swaps  
✅ **User chooses token** - Any Solana token via Jupiter  
✅ **USDC treasury** - Simple wallet-based approach  
✅ **Automatic swaps** - Jupiter handles routing  
✅ **MEV protection** - Built into Jupiter service  

## Notes

- BTC deposits require 6+ confirmations for security
- Treasury must have sufficient USDC balance
- Jupiter handles all token routing automatically
- Users can specify any Solana token mint address
- Default output is USDC if no token specified


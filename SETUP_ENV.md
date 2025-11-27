# Environment Setup Instructions

## Quick Setup

### Backend .env

1. **Copy template:**
   ```powershell
   cd backend
   Copy-Item .env.template .env
   ```

2. **Edit `.env` and update these values:**
   - `BITCOIN_BRIDGE_ADDRESS=bc1qYOUR_BITCOIN_ADDRESS_HERE` → Your actual Bitcoin address
   - `BTC_TO_USDC_RATE=50000` → Current BTC price in USD

### Frontend .env

1. **Copy template:**
   ```powershell
   cd frontend
   Copy-Item .env.template .env
   ```

2. **No changes needed** - defaults are correct

## Complete .env Configuration

### backend/.env

```env
# Server
PORT=3001
NODE_ENV=production

# Solana Mainnet
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta

# Bitcoin (UPDATE THESE!)
BITCOIN_NETWORK=mainnet
BITCOIN_BRIDGE_ADDRESS=bc1qYOUR_BITCOIN_ADDRESS_HERE
BITCOIN_EXPLORER_URL=https://blockstream.info/api
ENABLE_BITCOIN_MONITORING=true
BTC_TO_USDC_RATE=50000

# Privacy
ENABLE_ARCIUM_MPC=true
ARCIUM_SIMULATED=true

# Jupiter DEX
JUPITER_PRIVACY_MODE=high

# Relayer (optional)
RELAYER_KEYPAIR_PATH=backend/relayer-keypair-new.json
ENABLE_RELAYER=false
```

### frontend/.env

```env
REACT_APP_API_URL=http://localhost:3001
```

## Required Updates

Before running, update in `backend/.env`:

1. **Bitcoin Bridge Address:**
   ```env
   BITCOIN_BRIDGE_ADDRESS=bc1qyour_actual_bitcoin_address
   ```

2. **BTC to USDC Rate:**
   ```env
   BTC_TO_USDC_RATE=50000  # Update to current BTC price
   ```

## Verification

After setup, verify configuration:

```powershell
cd backend
node check-config.js
```

## Next Steps

1. ✅ Copy `.env.template` to `.env` in both backend and frontend
2. ✅ Update `BITCOIN_BRIDGE_ADDRESS` with your Bitcoin address
3. ✅ Update `BTC_TO_USDC_RATE` with current BTC price
4. ✅ Ensure `treasury-keypair.json` has USDC balance
5. ✅ Start backend: `cd backend && npm start`
6. ✅ Start frontend: `cd frontend && npm start`


# Setup Guide - Getting the Main Workflow Working

## Overview

This guide will help you get the FLASH bridge MVP working end-to-end. The main workflow allows users to bridge tokens (BTC/ZEC → zenZEC on Solana) through a simple web interface.

## What Was Fixed

1. **Bridge Route Demo Mode**: Modified the bridge endpoint to support demo mode where transaction hashes are optional. This allows the frontend to work without requiring users to provide Bitcoin or Zcash transaction hashes.

2. **Solana Service Method Name**: Fixed the method name from `mintZenzec` to `mintZenZec` to match the Anchor program.

3. **Environment Configuration**: Created documentation for required environment variables.

## Quick Start

### 1. Prerequisites

- Node.js v18+
- Solana CLI (for localnet testing)
- Rust (for Solana program)
- Anchor CLI (optional but recommended)

### 2. Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Configure Environment Variables

#### Backend (.env)

Create `backend/.env` with the following:

```env
PORT=3001
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
ZENZEC_MINT=YourZenZECMintAddressHere

# Optional: Enable relayer for burn & swap functionality
ENABLE_RELAYER=false
RELAYER_KEYPAIR_PATH=~/.config/solana/id.json

# Optional: Zcash integration
ZCASH_NETWORK=mainnet
ZCASH_BRIDGE_ADDRESS=

# Optional: Bitcoin integration
BITCOIN_NETWORK=mainnet
BITCOIN_BRIDGE_ADDRESS=
ENABLE_BITCOIN_MONITORING=false

# Optional: Arcium MPC privacy
ENABLE_ARCIUM_MPC=false
```

#### Frontend (.env)

Create `frontend/.env` with:

```env
REACT_APP_API_URL=http://localhost:3001
```

### 4. Start the Services

#### Terminal 1: Backend Server

```bash
cd backend
npm start
```

The backend should start on `http://localhost:3001`

#### Terminal 2: Frontend

```bash
cd frontend
npm start
```

The frontend should start on `http://localhost:3000`

### 5. Test the Main Workflow

1. Open `http://localhost:3000` in your browser
2. Connect your Solana wallet (Phantom, Solflare, etc.)
3. Enter an amount (e.g., 1.5 zenZEC)
4. Optionally check "Swap to SOL after minting"
5. Click "Bridge to Solana"

**Note**: In demo mode, the bridge will work without requiring transaction hashes. The backend will simulate the bridge transaction.

## Main Workflow Details

### Demo Mode (No Transaction Hash)

The bridge now supports a demo mode where users can mint zenZEC without providing Bitcoin or Zcash transaction hashes. This is perfect for MVP demonstrations.

**Request:**
```json
{
  "solanaAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "amount": 1.5,
  "swapToSol": false
}
```

**Response:**
```json
{
  "success": true,
  "transactionId": "demo_1234567890_abc123",
  "amount": 150000000,
  "solanaAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "swapToSol": false,
  "status": "pending",
  "message": "zenZEC minting initiated (demo mode - no transaction verification)",
  "reserveAsset": "ZEC",
  "demoMode": true
}
```

### Production Mode (With Transaction Hash)

For production use, you can still provide transaction hashes:

**Bitcoin Flow:**
```json
{
  "solanaAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "amount": 0.01,
  "bitcoinTxHash": "abc123...",
  "swapToSol": false
}
```

**Zcash Flow:**
```json
{
  "solanaAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "amount": 1.5,
  "zcashTxHash": "xyz789...",
  "swapToSol": false
}
```

## API Endpoints

### Bridge Operations

- `POST /api/bridge` - Mint zenZEC (supports demo mode)
- `GET /api/bridge/info` - Get bridge configuration
- `GET /api/bridge/transaction/:txId` - Get transaction status
- `GET /api/bridge/health` - Bridge health check

### Zcash Operations

- `GET /api/zcash/info` - Zcash network info
- `POST /api/zcash/verify-transaction` - Verify Zcash transaction
- `GET /api/zcash/price` - Get ZEC price
- `POST /api/zcash/validate-address` - Validate Zcash address
- `GET /api/zcash/bridge-address` - Get bridge deposit address

### Arcium MPC Operations

- `GET /api/arcium/status` - MPC network status
- `POST /api/arcium/encrypt-amount` - Encrypt amount
- `POST /api/arcium/random` - Generate trustless random
- `POST /api/arcium/bridge/private` - Create private bridge transaction

## Troubleshooting

### Backend won't start

- Check that port 3001 is not in use
- Verify all dependencies are installed: `npm install`
- Check `.env` file exists and has required variables

### Frontend won't connect to backend

- Verify `REACT_APP_API_URL` in `frontend/.env` points to backend URL
- Check backend is running on the correct port
- Check CORS is enabled (should be by default)

### Wallet connection issues

- Make sure you have a Solana wallet extension installed (Phantom, Solflare)
- Check you're on the correct network (devnet/mainnet)
- Try refreshing the page

### Bridge transaction fails

- Check backend logs for error messages
- Verify Solana RPC URL is correct and accessible
- For production mode, ensure transaction hashes are valid

## Next Steps

1. **Deploy Solana Program**: Build and deploy the Solana program to devnet/mainnet
2. **Initialize Bridge Config**: Set up the bridge configuration on-chain
3. **Create zenZEC Mint**: Create the SPL token mint for zenZEC
4. **Enable Relayer**: Set up the relayer service for burn & swap functionality
5. **Test End-to-End**: Test the complete workflow with real transactions

## Additional Resources

- See `README.md` for full project documentation
- See `HACKATHON_DEMO.md` for demo scripts
- See `PRODUCTION_READINESS.md` for production deployment guide


# FLASH Bridge Integration Guide

## Overview

This document describes how all components of the FLASH bridge system work together as a cohesive whole.

## System Architecture - Integrated Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    FLASH BRIDGE SYSTEM                       │
│                     (Unified Components)                      │
└──────────────────────────────────────────────────────────────┘

1. USER INITIATES BRIDGE
   ├─> Frontend (React)
   │   ├─> Connects Solana Wallet (Phantom/Solflare)
   │   ├─> (Optional) Connects Zcash Wallet (WebZjs)
   │   └─> Enters amount and destination
   │
2. ZCASH SHIELDING (if using real ZEC)
   ├─> User sends ZEC to bridge address
   ├─> Frontend monitors transaction via WebZjs
   ├─> Backend verifies via Zcash Explorer
   └─> Transaction confirmed on Zcash blockchain
   │
3. BACKEND PROCESSING
   ├─> POST /api/bridge
   │   ├─> Validates Zcash tx (if provided)
   │   ├─> Verifies shielded amount
   │   └─> Generates bridge transaction ID
   │
4. SOLANA MINTING
   ├─> Backend calls Solana program
   ├─> mint_zenzec instruction executed
   ├─> zenZEC tokens minted to user's wallet
   └─> Transaction confirmed on Solana
   │
5. USER OPTIONS
   ├─> HOLD zenZEC
   │   └─> Keep tokens in Solana wallet
   │
   └─> SWAP TO SOL
       ├─> Call burn_and_emit instruction
       ├─> BurnSwapEvent emitted
       ├─> Relayer detects event
       └─> SOL transferred to user
```

## Component Integration

### 1. Frontend ↔ Backend Integration

**Frontend Components:**
- `BridgeInterface.js` - Main UI component
- `App.js` - Wallet provider setup
- Solana Wallet Adapter - Wallet connection
- WebZjs (integrated) - Zcash wallet functionality

**API Endpoints Used:**
```javascript
// Bridge operations
POST /api/bridge
  Body: { 
    solanaAddress, 
    amount, 
    swapToSol, 
    zcashTxHash // Optional
  }

GET /api/bridge/info
GET /api/bridge/transaction/:txId

// Zcash operations
GET /api/zcash/info
GET /api/zcash/bridge-address
POST /api/zcash/verify-transaction
GET /api/zcash/price
```

### 2. Backend ↔ Solana Integration

**Services:**
- `solana.js` - Connection and program interaction
- `relayer.js` - Event monitoring

**Flow:**
```javascript
// Minting flow
Backend → Solana Program
  ├─> Get Config PDA
  ├─> Get user token account
  ├─> Call mint_zenzec(amount)
  └─> Return transaction signature

// Burning flow (user-initiated)
User Wallet → Solana Program
  ├─> Call burn_and_emit(amount)
  ├─> Emit BurnSwapEvent
  └─> Relayer → Transfer SOL to user
```

### 3. Backend ↔ Zcash Integration

**Services:**
- `zcash.js` - Transaction verification

**Integration Points:**
```javascript
// Verify shielded transaction
POST /api/zcash/verify-transaction
  ├─> Query lightwalletd
  ├─> Check confirmation status
  ├─> Verify shielded amount
  └─> Return verification result

// Monitor bridge address
zcashService.monitorShieldedTransactions(bridgeAddress, callback)
  ├─> Connect to lightwalletd stream
  ├─> Filter incoming transactions
  └─> Trigger minting when confirmed
```

### 4. Zcash Explorer Integration

**Purpose:** Transaction verification and monitoring

**Integration:**
- Backend queries zcash-explorer API for transaction details
- Can be self-hosted or use public instance
- Provides block height, confirmations, and transaction data

**Setup (Optional):**
```bash
# Clone and run zcash-explorer (Elixir/Phoenix)
git clone https://github.com/nighthawk-apps/zcash-explorer.git
cd zcash-explorer
mix deps.get
mix phx.server
```

## Configuration

### Environment Variables

**Backend (.env):**
```env
# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PROGRAM_ID=<your_program_id>
ZENZEC_MINT=<your_mint_address>
ENABLE_RELAYER=true
RELAYER_KEYPAIR_PATH=~/.config/solana/id.json

# Zcash Configuration
ZCASH_NETWORK=mainnet
ZCASH_LIGHTWALLETD_URL=https://zcash-mainnet.chainsafe.dev
ZCASH_EXPLORER_URL=https://zcashblockexplorer.com
ZCASH_BRIDGE_ADDRESS=<your_shielded_address>
```

**Frontend (.env):**
```env
REACT_APP_API_URL=http://localhost:3001
REACT_APP_SOLANA_NETWORK=devnet
REACT_APP_ZCASH_NETWORK=mainnet
```

## Unified Deployment

### Local Development (All Components)

```bash
# 1. Start Solana local validator
solana-test-validator --reset

# 2. Build and deploy Solana program
anchor build
anchor deploy

# 3. Start backend
cd backend
npm install
npm start
# Running on http://localhost:3001

# 4. Start frontend
cd frontend
npm install
npm start
# Running on http://localhost:3000
```

### Testing the Integrated System

#### Test 1: Mock Bridge (No Real ZEC)
```bash
# Frontend: http://localhost:3000
1. Connect Solana wallet
2. Enter amount (e.g., 1.0 zenZEC)
3. Leave "Swap to SOL" unchecked
4. Click "Bridge to Solana"
5. Verify transaction status
```

#### Test 2: With Zcash Transaction
```bash
# 1. Get bridge address
curl http://localhost:3001/api/zcash/bridge-address

# 2. Send ZEC to bridge address (testnet)
# Use Zcash wallet or CLI

# 3. Wait for confirmation

# 4. Bridge with tx hash
# Frontend:
1. Connect Solana wallet
2. Enter amount
3. Enter Zcash tx hash (optional field)
4. Click "Bridge to Solana"
```

#### Test 3: Burn and Swap to SOL
```bash
# 1. Ensure you have zenZEC tokens
# 2. Enable relayer: ENABLE_RELAYER=true
# 3. Frontend:
   - Check "Swap to SOL after minting"
   - Submit bridge request
# 4. After minting, burn instruction is called
# 5. Relayer detects event and sends SOL
```

## Data Flow

### Complete Bridge Transaction Flow

```
User Action → Frontend → Backend → Blockchain → Confirmation
    ↓            ↓          ↓          ↓            ↓
1. Enter      Validate   Verify     Execute      Update
   amount     inputs     Zcash      Solana       status
   
2. Submit     API call   Check      Mint         Emit
   request               tx hash    zenZEC       event
   
3. Confirm    Return     Generate   Confirm      Notify
              txId       bridge ID  on-chain     user
```

## API Integration Examples

### JavaScript/TypeScript (Frontend)

```javascript
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

// Bridge with Zcash verification
async function bridgeWithZcash(solanaAddress, amount, zcashTxHash) {
  const response = await axios.post(`${API_URL}/api/bridge`, {
    solanaAddress,
    amount,
    zcashTxHash,
    swapToSol: false,
  });
  
  return response.data;
}

// Get Zcash bridge address
async function getZcashBridgeAddress() {
  const response = await axios.get(`${API_URL}/api/zcash/bridge-address`);
  return response.data.address;
}

// Verify Zcash transaction
async function verifyZcashTx(txHash) {
  const response = await axios.post(`${API_URL}/api/zcash/verify-transaction`, {
    txHash,
  });
  return response.data;
}
```

### Node.js (Backend)

```javascript
const solanaService = require('./services/solana');
const zcashService = require('./services/zcash');

// Complete bridge operation
async function processBridgeRequest(req) {
  const { solanaAddress, amount, zcashTxHash } = req.body;
  
  // 1. Verify Zcash if provided
  if (zcashTxHash) {
    const zcashTx = await zcashService.verifyShieldedTransaction(zcashTxHash);
    if (!zcashTx.verified) {
      throw new Error('Zcash verification failed');
    }
  }
  
  // 2. Mint on Solana
  const txId = await solanaService.mintZenZEC(solanaAddress, amount);
  
  return { success: true, txId };
}
```

## Monitoring and Observability

### Health Checks

```bash
# Overall system health
curl http://localhost:3001/health

# Bridge health
curl http://localhost:3001/api/bridge/health

# Zcash integration health
curl http://localhost:3001/api/zcash/info
```

### Logs

**Backend logs show:**
- Bridge requests received
- Zcash verification results
- Solana minting operations
- Relayer event detections
- Error conditions

**Monitor with:**
```bash
# Backend logs
cd backend && npm run dev

# Watch relayer
tail -f backend/logs/relayer.log
```

## Security Considerations (Integrated System)

1. **Zcash Verification**
   - Verify transaction confirmations (6+ blocks recommended)
   - Check shielded amount matches claimed amount
   - Validate bridge address is recipient

2. **Solana Program**
   - Authority-based access control
   - Pause mechanism for emergencies
   - Per-transaction limits enforced

3. **Backend Security**
   - Rate limiting on API endpoints
   - Input validation on all requests
   - Secure key management for relayer

4. **End-to-End**
   - HTTPS for all API calls
   - Wallet signature verification
   - Transaction replay prevention

## Troubleshooting

### Common Integration Issues

**Issue: Frontend can't connect to backend**
```bash
# Check CORS settings
# Verify backend/.env has correct PORT
# Ensure frontend/.env has correct API_URL
```

**Issue: Zcash verification fails**
```bash
# Check lightwalletd connectivity
curl https://zcash-mainnet.chainsafe.dev

# Verify transaction hash format
# Ensure sufficient confirmations
```

**Issue: Solana minting fails**
```bash
# Check program is deployed
solana program show <PROGRAM_ID>

# Verify token mint exists
spl-token display <ZENZEC_MINT>

# Check relayer has authority
```

## Next Steps

1. **Production Deployment**
   - Set up proper infrastructure
   - Configure production endpoints
   - Enable monitoring and alerting

2. **Enhanced Integration**
   - Real ZK proof verification
   - Multi-sig authority
   - Decentralized relayer network

3. **Testing**
   - Integration test suite
   - End-to-end testing
   - Load testing

## Support

For integration issues:
- Check logs in `backend/` directory
- Review API responses
- Test individual components first
- Verify environment configuration

---

**Status:** All components integrated and ready for testing  
**Last Updated:** November 2024  
**Version:** 1.0.0 (MVP)

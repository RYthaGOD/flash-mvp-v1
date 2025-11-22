# FLASH Bridge - Complete System Overview

## Unified Architecture

The FLASH bridge is a cohesive system integrating multiple blockchain technologies to enable BTC → ZEC → Solana token bridging.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FLASH BRIDGE ECOSYSTEM                       │
└─────────────────────────────────────────────────────────────────────┘

┌────────────────┐
│  LAYER 1: UI   │
│  (Frontend)    │
├────────────────┤
│ • React App    │────┐
│ • Wallet UI    │    │
│ • Web3 Connect │    │
└────────────────┘    │
                      │
┌────────────────┐    │    ┌──────────────────┐
│  LAYER 2: API  │    │    │  EXTERNAL LIBS   │
│  (Backend)     │    │    ├──────────────────┤
├────────────────┤    ├───→│ • WebZjs         │
│ • Express API  │    │    │ • Zcash Explorer │
│ • Bridge Logic │    │    │ • Wallet Adapter │
│ • Relayer Svc  │    │    └──────────────────┘
└────────────────┘    │
       ↓              │
┌────────────────┐    │
│  LAYER 3: L1   │    │
│  (Blockchains) │    │
├────────────────┤    │
│ • Solana       │←───┘
│ • Zcash        │
│ • (BTC Mock)   │
└────────────────┘
```

## Component Integration Matrix

| Component | Integrates With | Purpose | Status |
|-----------|----------------|---------|--------|
| **Frontend** | Backend API, Solana, WebZjs | User interface | ✅ |
| **Backend** | Solana, Zcash, Database | Bridge orchestration | ✅ |
| **Solana Program** | Backend, User wallets | zenZEC token management | ✅ |
| **Zcash Service** | lightwalletd, Explorer | ZEC verification | ✅ |
| **Relayer** | Solana, Backend | Event monitoring | ✅ |
| **WebZjs** | Frontend | Zcash wallet in browser | ✅ |

## Technology Stack (Unified)

### Frontend Layer
```
React 18.2.0
├── @solana/wallet-adapter (Solana wallets)
├── @chainsafe/webzjs-wallet (Zcash wallets)
├── axios (API communication)
└── Custom CSS (Styling)
```

### Backend Layer
```
Node.js 18+
├── Express 4.18 (REST API)
├── @solana/web3.js (Solana interaction)
├── @project-serum/anchor (Program client)
├── axios (Zcash API calls)
└── dotenv (Configuration)
```

### Blockchain Layer
```
Solana
├── Anchor 0.29.0 (Framework)
├── SPL Token (Token standard)
└── Rust (Program language)

Zcash
├── lightwalletd (Node connection)
├── Zcash Explorer (Transaction info)
└── Halo2 (ZK proofs - future)
```

## Unified Data Models

### Bridge Transaction
```typescript
interface BridgeTransaction {
  id: string;                    // Unique bridge tx ID
  solanaAddress: string;         // Destination wallet
  zcashTxHash?: string;          // Optional Zcash tx
  amount: number;                // zenZEC amount
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  zcashVerification?: {
    verified: boolean;
    blockHeight: number;
    confirmations: number;
  };
  solanaTxSignature?: string;    // Mint transaction
  swapToSol: boolean;
  solSwapTxSignature?: string;   // If swapped
}
```

### Zcash Transaction
```typescript
interface ZcashTransaction {
  txHash: string;
  confirmed: boolean;
  blockHeight: number;
  timestamp: number;
  shieldedAmount: number;
  network: 'mainnet' | 'testnet';
  verified: boolean;
}
```

### Solana Program State
```rust
pub struct Config {
    pub authority: Pubkey,     // Admin key
    pub mint: Pubkey,          // zenZEC mint
    pub max_mint_per_tx: u64,  // Limit
    pub paused: bool,          // Emergency stop
    pub total_minted: u64,     // Tracking
    pub total_burned: u64,     // Tracking
}
```

## Unified API Reference

### Bridge Operations

#### POST /api/bridge
Initiate a bridge transaction (with optional Zcash verification)

**Request:**
```json
{
  "solanaAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "amount": 1.5,
  "swapToSol": false,
  "zcashTxHash": "a1b2c3d4..." // Optional
}
```

**Response:**
```json
{
  "success": true,
  "transactionId": "zec_a1b2c3d4_1699876543",
  "amount": 1.5,
  "solanaAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "status": "pending",
  "zcashVerification": {
    "verified": true,
    "txHash": "a1b2c3d4...",
    "blockHeight": 2500000
  }
}
```

### Zcash Operations

#### GET /api/zcash/bridge-address
Get the Zcash address to send funds to

**Response:**
```json
{
  "success": true,
  "address": "zs1bridge...",
  "network": "mainnet"
}
```

#### POST /api/zcash/verify-transaction
Verify a Zcash shielded transaction

**Request:**
```json
{
  "txHash": "a1b2c3d4..."
}
```

## Deployment Architecture

### Production Setup

```
┌─────────────────────────────────────────┐
│            Load Balancer                 │
│         (CloudFlare / nginx)             │
└────────────┬──────────────┬─────────────┘
             │              │
    ┌────────▼────────┐    │
    │   Frontend      │    │
    │   (Vercel/      │    │
    │    Netlify)     │    │
    └─────────────────┘    │
                           │
                  ┌────────▼────────┐
                  │   Backend       │
                  │   (AWS/GCP/     │
                  │    Railway)     │
                  └────────┬────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
    ┌───────▼──────┐  ┌───▼────┐  ┌─────▼─────┐
    │   Solana     │  │ Zcash  │  │ Database  │
    │  (devnet/    │  │lightwd │  │(Postgres) │
    │   mainnet)   │  │        │  │           │
    └──────────────┘  └────────┘  └───────────┘
```

### Local Development

```bash
# Terminal 1: Solana validator
solana-test-validator

# Terminal 2: Backend
cd backend && npm start

# Terminal 3: Frontend
cd frontend && npm start

# Access: http://localhost:3000
```

## Integration Patterns

### Pattern 1: Direct Bridge (No Zcash TX)
```
User → Frontend → Backend → Solana
     (amount)     (mock)    (mint zenZEC)
```

### Pattern 2: Verified Bridge (With Zcash TX)
```
User → Send ZEC → Zcash Blockchain
                       ↓
Frontend → Backend → Verify TX → Solana
        (tx hash)   (zcash svc) (mint zenZEC)
```

### Pattern 3: Bridge + Swap
```
User → Frontend → Backend → Solana (mint)
     (swap=true)           → Solana (burn_and_emit)
                           → Relayer detects
                           → Solana (send SOL)
```

## State Management

### Frontend State
- Wallet connection status
- User's Solana address
- User's Zcash address (if WebZjs used)
- Bridge transaction status
- Form inputs (amount, options)

### Backend State
- Active bridge transactions (in-memory or DB)
- Relayer listening status
- Zcash transaction cache
- Program configuration cache

### Blockchain State
- Solana: Config account, Token accounts
- Zcash: Shielded transactions, Confirmations

## Error Handling (System-Wide)

### Frontend Errors
```javascript
try {
  await bridgeRequest();
} catch (error) {
  if (error.response?.status === 400) {
    // Invalid input
  } else if (error.response?.status === 500) {
    // Backend error
  } else {
    // Network error
  }
}
```

### Backend Errors
```javascript
try {
  await zcashService.verify();
  await solanaService.mint();
} catch (error) {
  logger.error('Bridge failed', { error, context });
  // Rollback if needed
  // Notify user
}
```

### Blockchain Errors
- Transaction failures (insufficient funds, etc.)
- Program errors (paused, exceeds limit, etc.)
- Network timeouts

## Monitoring & Metrics

### Key Metrics
- Bridge transactions per hour
- Success rate (%)
- Average confirmation time
- Zcash verification time
- Solana minting time
- Relayer uptime

### Logging
```javascript
// Structured logging
logger.info('Bridge initiated', {
  txId,
  amount,
  solanaAddress,
  hasZcashTx: !!zcashTxHash,
});

logger.info('Zcash verified', {
  txId,
  zcashTxHash,
  blockHeight,
  confirmations,
});

logger.info('Solana minted', {
  txId,
  signature,
  amount,
});
```

## Testing Strategy

### Unit Tests
- Individual service functions
- API route handlers
- Utility functions

### Integration Tests
- Frontend ↔ Backend API
- Backend ↔ Solana
- Backend ↔ Zcash verification

### End-to-End Tests
- Complete bridge flow (mock)
- Complete bridge flow (testnet)
- Error scenarios
- Edge cases

## Security (System-Wide)

### Frontend Security
- Wallet signature verification
- Input sanitization
- HTTPS only
- No private keys in browser storage

### Backend Security
- API rate limiting
- Request validation
- Secure key management
- Environment variable protection

### Blockchain Security
- Authority-based access control
- Transaction amount limits
- Emergency pause mechanism
- Audit trail (events)

## Performance Optimization

### Caching Strategy
- Zcash transaction cache (Redis)
- Program config cache
- Price data cache (1 minute TTL)

### Async Processing
- Bridge requests handled asynchronously
- Relayer runs in separate process
- Non-blocking API responses

### Database Indexing
- Index on bridge transaction ID
- Index on Solana addresses
- Index on timestamps

## Maintenance

### Regular Tasks
- Monitor relayer uptime
- Check Zcash lightwalletd connectivity
- Verify Solana RPC health
- Review error logs
- Update dependencies

### Backup & Recovery
- Backup relayer keypair
- Backup bridge transaction database
- Document recovery procedures

---

**System Status:** All components integrated and operational  
**Integration Level:** Complete  
**Ready For:** Hackathon demo and testnet deployment  
**Version:** 1.0.0

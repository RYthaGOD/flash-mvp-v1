# FLASH Bridge Architecture

## Overview

The FLASH Bridge is a demonstration of a cross-chain bridge that conceptually moves value from Bitcoin → Zcash (shielded) → Solana. This MVP focuses on the Solana side of the bridge.

## High-Level Flow

```
┌──────────────┐
│  1. BTC Pay  │  User pays with Bitcoin (Cash App / Lightning)
│  (Mocked)    │
└──────┬───────┘
       │
       v
┌──────────────┐
│  2. Shield   │  Off-chain service shields BTC into ZEC
│     ZEC      │  (Conceptual - uses Zcash privacy features)
└──────┬───────┘
       │
       v
┌──────────────────────┐
│  3. Mint zenZEC      │  Backend calls Solana program
│     on Solana        │  Mints wrapped ZEC tokens
│  POST /api/bridge    │
└──────┬───────────────┘
       │
       v
┌──────────────────────┐
│  4a. Hold zenZEC     │  User keeps tokens in wallet
│   OR                 │
│  4b. Burn & Swap     │  User burns zenZEC for SOL
└──────┬───────────────┘
       │ (if 4b)
       v
┌──────────────────────┐
│  5. Relayer          │  Off-chain relayer detects burn
│     Sends SOL        │  Transfers SOL to user
└──────────────────────┘
```

## Component Architecture

### 1. Solana Program (`programs/zenz_bridge/`)

**Technology**: Rust, Anchor Framework

**Purpose**: On-chain logic for the zenZEC token bridge

**Key Accounts**:
- `Config`: Global configuration
  - `authority`: Admin/relayer public key
  - `mint`: zenZEC SPL token mint address
  - `max_mint_per_tx`: Maximum tokens per transaction
  - `paused`: Emergency pause flag
  - `total_minted`: Total tokens minted
  - `total_burned`: Total tokens burned

**Instructions**:

1. **`initialize_config`**
   - Creates the Config account
   - Sets up bridge parameters
   - Only called once during deployment

2. **`mint_zenzec`**
   - Mints zenZEC tokens to user's account
   - Called by authorized relayer
   - Checks: not paused, valid amount, within limits

3. **`burn_zenzec`**
   - Burns zenZEC from user's account
   - User-initiated
   - Updates total_burned counter

4. **`burn_and_emit`**
   - Burns zenZEC and emits BurnSwapEvent
   - Triggers off-chain relayer to send SOL
   - Event includes: user pubkey, amount, timestamp

5. **`set_paused`** (admin)
   - Emergency pause/unpause

6. **`set_max_mint`** (admin)
   - Update minting limits

**Events**:
- `BurnSwapEvent`: Emitted when user burns for SOL swap

### 2. Backend (`backend/`)

**Technology**: Node.js, Express, @solana/web3.js, Anchor client

**Purpose**: 
- API gateway for bridge operations
- Off-chain relayer for SOL swaps
- Mock BTC/ZEC shielding logic

**Services**:

**`solana.js`**
- Solana connection management
- Program interaction helpers
- Keypair loading for relayer

**`relayer.js`**
- Listens for on-chain events
- Processes BurnSwapEvent
- Sends SOL to users (in production)

**API Endpoints**:

```
GET /
- API information

GET /health
- Health check

GET /api/bridge/info
- Bridge configuration
- Solana version
- Network info

POST /api/bridge
Body: { solanaAddress, amount, swapToSol }
- Mint zenZEC tokens
- In production: verify BTC payment + ZEC shielding

GET /api/bridge/transaction/:txId
- Query transaction status

GET /api/bridge/health
- Bridge-specific health check
```

**Environment Configuration**:
```env
PORT=3001
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PROGRAM_ID=<deployed_program_id>
ZENZEC_MINT=<spl_token_mint>
ENABLE_RELAYER=true
RELAYER_KEYPAIR_PATH=~/.config/solana/id.json
```

### 3. Frontend (`frontend/`)

**Technology**: React, Solana Wallet Adapter, Axios

**Purpose**: User interface for bridge operations

**Components**:

**`App.js`**
- Wallet adapter setup
- Connection provider
- Wallet modal provider

**`BridgeInterface.js`**
- Main UI component
- Wallet connection
- Amount input
- Swap option checkbox
- Transaction submission
- Status display

**Features**:
- Connect Phantom/Solflare wallet
- Enter zenZEC amount
- Toggle "Swap to SOL" option
- Submit bridge request
- View transaction status
- Responsive design

### 4. CI/CD (`.github/workflows/`)

**Jobs**:
1. **solana-program**: Build Anchor program
2. **backend**: Install deps, run tests
3. **frontend**: Build React app, run tests
4. **lint**: Code quality checks

## Data Flow

### Minting Flow

```
User Request (Frontend)
    ↓
POST /api/bridge (Backend)
    ↓
[Verify BTC payment] (Mocked)
    ↓
[Verify ZEC shielding] (Mocked)
    ↓
Call mint_zenzec instruction
    ↓
Solana Program mints tokens
    ↓
Return transaction ID
    ↓
Display success (Frontend)
```

### Burning/Swap Flow

```
User calls burn_and_emit (Wallet)
    ↓
Solana Program burns tokens
    ↓
Emit BurnSwapEvent
    ↓
Relayer detects event (Backend)
    ↓
Calculate SOL amount
    ↓
Send SOL to user (Backend)
    ↓
User receives SOL
```

## Security Considerations

### Current MVP Limitations

⚠️ **This is a demonstration MVP, NOT production-ready**

Missing security features:
- No BTC payment verification
- No ZEC shielding proof verification
- No multi-sig authority
- No rate limiting
- No price oracle
- No insurance/reserve fund
- Single point of failure (relayer)
- No formal verification

### Production Requirements

For mainnet deployment, implement:

1. **Smart Contract Security**
   - Professional audit
   - Formal verification
   - Extensive testing
   - Bug bounty program

2. **Authority Management**
   - Multi-signature authority
   - Timelock for config changes
   - Emergency shutdown mechanism

3. **Verification System**
   - BTC payment verification (Lightning proofs)
   - ZK proofs for ZEC shielding
   - Oracle for price feeds

4. **Operational Security**
   - Secure key management (HSM)
   - Distributed relayer network
   - Reserve fund management
   - Insurance pool

5. **Monitoring**
   - Transaction monitoring
   - Anomaly detection
   - Rate limiting
   - Circuit breakers

## Scalability

### Current Limitations
- Single relayer
- No batching
- Simple event listening

### Future Improvements
- Multiple relayers with consensus
- Transaction batching
- Optimistic verification
- Layer 2 integration

## Testing Strategy

### Unit Tests
- Solana program instructions
- Backend API endpoints
- Frontend components

### Integration Tests
- End-to-end bridge flow
- Relayer event processing
- Error handling

### Security Tests
- Access control
- Input validation
- Overflow checks
- Reentrancy protection

## Deployment

### Localnet
```bash
./scripts/setup-localnet.sh
```

### Devnet
1. Build program: `anchor build`
2. Deploy: `anchor deploy --provider.cluster devnet`
3. Update backend .env with program ID
4. Deploy backend to cloud service
5. Deploy frontend to hosting service

### Mainnet
⚠️ Not recommended without full security audit

## Future Enhancements

1. **Real BTC Integration**
   - Lightning Network integration
   - Cash App API integration
   - Payment verification

2. **ZK Proof System**
   - Halo2 integration
   - Shielding verification
   - Privacy preservation

3. **Cross-chain Oracle**
   - Chainlink/Pyth integration
   - Price feeds
   - Exchange rate calculation

4. **Enhanced Relayer**
   - Distributed network
   - Byzantine fault tolerance
   - Automated market making

5. **Governance**
   - DAO for parameter changes
   - Community proposals
   - Treasury management

---

**Document Version**: 1.0  
**Last Updated**: November 2024  
**Status**: MVP/Demonstration

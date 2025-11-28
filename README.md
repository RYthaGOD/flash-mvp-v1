# 🔒 FLASH Bridge

**BTC → ZEC (Shielded) → Solana Cross-Chain Bridge**

*Built with cryptographic proofs and custom MXE for Arcium MPC integration*

---

## 🚀 Overview

FLASH Bridge is a cross-chain bridge connecting Bitcoin, Zcash, and Solana blockchains. It implements cryptographic proofs for transaction verification and includes a complete custom MXE implementation ready for Arcium MPC deployment.

### ✨ Features

🛡️ **Privacy & Security**
- Cryptographic proofs for transaction verification
- HMAC-SHA256 signatures with institutional key management
- Merkle tree proofs for transaction inclusion
- Chain of custody tracking for audit trails

⚡ **Production Ready**
- Crash prevention with comprehensive error handling
- Database persistence with PostgreSQL
- Circuit breaker protection against external API failures
- Health monitoring and automatic recovery

🔗 **Multi-Chain Bridge**
- BTC → ZEC (Shielded) → SOL bridge operations
- Reverse flows: SOL → zenZEC → BTC
- Zcash shielded addresses support
- Solana SPL token minting and burning

---

## 🏗️ **Architecture Overview**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Bitcoin       │ -> │   Zcash         │ -> │   Solana        │
│   (BTC)         │    │   (Shielded)    │    │   (zenZEC)      │
│                 │    │   MPC Privacy   │    │                 │
│  Payment TX     │    │   Encryption    │    │  SPL Token      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
       ↓                        ↓                        ↓
   User Choice:           DEX Trading              Auto-Swap
   Hold zenZEC         or Auto-Swap                    ↓
       ↓                 to SOL                   SOL Transfer
   DEX Trading ──────────────────────────────────────────┘
```

### 🔐 **Custom MXE Operations**

| Operation | Privacy Benefit | Use Case |
|-----------|----------------|----------|
| `encrypt_bridge_amount` | Hide transaction amounts | Cross-chain transfers |
| `verify_bridge_transaction` | Private compliance checks | Institutional verification |
| `calculate_swap_amount` | Prevent front-running | DEX integrations |
| `encrypt_btc_address` | Address privacy | Withdrawal protection |

---

## 🚀 **Quick Start**

### Prerequisites
- **Node.js 18+**
- **Git**
- **For Real MPC**: Arcium API key (contact team with our MXE)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd flash-bridge

# Setup backend with simulation mode
cd backend
cp .env.example.txt .env
npm install
npm start

# Setup frontend (new terminal)
cd ../frontend
npm install
npm start
```

### Access Points
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **MXE Documentation:** `flash-bridge-mxe/README.md`

---

## 🎮 **Bridge Flows**

### **Privacy Bridge (BTC → ZEC → zenZEC)**
```
User BTC Payment → Zcash Shielding → Arcium MPC Encryption → Solana zenZEC Mint
                     ↑                    ↑                          ↑
                Privacy Layer       Real MPC Operations      SPL Token
```

### **Auto-Swap (zenZEC → SOL)**
```
zenZEC Token → Encrypted Amount → MPC Swap Calculation → SOL Transfer
```

### **Reverse Bridge (SOL → zenZEC → BTC)**
```
SOL Payment → zenZEC Burn → Encrypted BTC Address → BTC Withdrawal
```

---

## 🏗️ **System Components**

### **Custom MXE (`flash-bridge-mxe/`)**
- **Bridge-specific MPC operations** using Arcis framework
- **Encrypted instructions** for privacy-preserving computations
- **Arcium program integration** with Solana blockchain

### **Backend API (`backend/`)**
**19 API endpoints** including:
- **Bridge Operations**: Mint zenZEC, transaction status, bridge info
- **Zcash Integration**: Transaction verification, price fetching
- **Arcium MPC Privacy**: Encrypted operations, private verification
- **Relayer Service**: Event monitoring, automatic SOL swaps

### **Frontend (`frontend/`)**
- **React/TypeScript** with wallet integration
- **Solana Wallet Adapter** (Phantom, Solflare)
- **WebZjs integration** for Zcash wallet support
- **Real-time transaction status** and responsive design

---

## 🔌 **API Endpoints**

### Bridge Operations
```http
POST /api/bridge              # Mint zenZEC tokens
GET  /api/bridge/info         # Bridge configuration
GET  /api/bridge/transaction/:txId  # Transaction status
```

### Zcash Integration
```http
GET  /api/zcash/verify        # Verify Zcash transaction
GET  /api/zcash/price         # Get ZEC price
POST /api/zcash/validate      # Validate Zcash address
```

### Arcium MPC Privacy
```http
POST /api/arcium/encrypt      # Encrypt bridge amount
POST /api/arcium/verify       # Private verification
POST /api/arcium/random       # Trustless random generation
```

---

## 🛠️ **Quick Start**

### Prerequisites
- **Node.js 18+**
- **Git**
- **For Real MPC**: Arcium API key (contact team with our MXE)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd flash-bridge

# Setup backend with simulation mode
cd backend
cp .env.example.txt .env
npm install
npm start

# Setup frontend (new terminal)
cd ../frontend
npm install
npm start
```

### Access Points
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **MXE Documentation:** `flash-bridge-mxe/README.md`

---

## ⚙️ **Environment Configuration**

### Backend `.env`
```env
PORT=3001
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PROGRAM_ID=YourProgramIdHere
ZENZEC_MINT=YourZenZECMintHere
ENABLE_RELAYER=false
RELAYER_KEYPAIR_PATH=~/.config/solana/id.json

# Arcium MPC (for real privacy)
ENABLE_ARCIUM_MPC=true
ARCIUM_SIMULATED=true          # Set false for real MPC
ARCIUM_USE_REAL_SDK=false      # Set true with API key
ARCIUM_API_KEY=your_key_here   # From Arcium
```

### Frontend `.env`
```env
REACT_APP_API_URL=http://localhost:3001
```

---

## 🧪 **Testing & Demo**

### Automated Testing
```bash
# Test all workflows automatically
./scripts/demo-test.sh

# Expected: All tests pass ✓
# Tests 19+ endpoints across all services
```

### Demo Workflows
1. **Basic Bridge** (2 min) - Simple zenZEC minting
2. **Zcash Verification** (3 min) - Real ZEC transaction verification
3. **Full Privacy** (4 min) - Arcium MPC encrypted transactions
4. **Burn & Swap** (3 min) - Complete bridge lifecycle
5. **API Integration** (2 min) - Developer experience

### Manual Testing
See [`HACKATHON_DEMO.md`](./HACKATHON_DEMO.md) for complete 10-minute demo script.

---

## 📊 **Current Status**

### ✅ **MVP Complete - Demo Ready**
- **Core Features:** Bridge transactions with cryptographic proofs
- **Privacy:** Arcium MPC encryption implemented
- **Crash Prevention:** Enterprise-grade stability features
- **Documentation:** Comprehensive setup and architecture guides

### 🚧 **Production Roadmap**
- **Phase 1:** Security audit & mainnet deployment
- **Phase 2:** Mobile app & additional chains
- **Phase 3:** Enterprise features & API marketplace
- **Phase 4:** Decentralized relayer network

---

## 🔑 **MPC Integration Status**

### **Current: Enhanced Simulation**
- ✅ **Privacy Features:** All MPC operations simulated
- ✅ **Bridge Functionality:** Full cross-chain transfers
- ✅ **Institutional Proofs:** Cryptographic verification ready
- ✅ **Enterprise Stability:** Crash prevention implemented

### **Next: Real Arcium MPC**
- 🔄 **Custom MXE:** Complete implementation ready (`flash-bridge-mxe/`)
- 🔄 **API Key:** Contact Arcium with our MXE for access
- 🔄 **Deployment:** Launch custom operations on Arcium network
- 🔄 **Migration:** Switch from simulation to real MPC

---

## 📞 **Get Arcium API Key**

**Our custom MXE implementation demonstrates serious commitment.** Contact Arcium:

1. **Contact:** Reach out via [@moneybag_fin](https://twitter.com/moneybag_fin) or use template in `ARCIUM_CONTACT_TEMPLATE.md`
2. **Show:** Our complete MXE in `flash-bridge-mxe/`
3. **Request:** API key for custom bridge operations
4. **Deploy:** Launch real MPC privacy operations

---

## 🤝 **Contributing**

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### **Key Areas:**
- **MXE Development:** Custom MPC operations
- **Multi-chain Support:** Additional blockchain integrations
- **Privacy Research:** Advanced cryptographic techniques
- **Documentation:** Developer guides and tutorials

---

## 📋 **Project Structure**

```
flash-bridge/
├── flash-bridge-mxe/        # Custom Arcium MXE implementation
│   ├── Arcium.toml         # MXE configuration
│   ├── programs/src/lib.rs # Solana program with #[arcium_program]
│   ├── encrypted-ixs/      # MPC operations using Arcis
│   ├── tests/              # TypeScript test suite
│   └── README.md           # MXE documentation
├── backend/                # Node.js API server (19 endpoints)
│   ├── src/                # Source code
│   ├── database/           # Schema and migrations
│   └── package.json        # Dependencies
├── frontend/               # React user interface
│   ├── src/                # React components
│   └── package.json        # Dependencies
├── scripts/                # Development utilities
├── .github/                # GitHub configuration
└── docs/                   # Documentation
```

---

## ⚠️ **Important Notice**

**This is MVP software for demonstration purposes.**
- ✅ **Safe for demos** and development
- ⚠️ **Not audited** for production use
- 🚫 **Do not use** with real funds
- 📋 **Contact Arcium** for production MPC integration

---

## 📞 **Contact**

**Team FLASH Bridge**
- **🐦 Twitter:** [@moneybag_fin](https://twitter.com/moneybag_fin)
- **MXE Implementation:** `flash-bridge-mxe/` (Show to Arcium)
- **API Key Request:** Use `ARCIUM_CONTACT_TEMPLATE.md`
- **GitHub:** [Repository](https://github.com/your-org/flash-bridge)

---

## 📄 **License**


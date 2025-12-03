# ⚡ FLASH Bridge

**Privacy-Preserving BTC → SOL Bridge with Arcium MPC**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]()
[![Docker](https://img.shields.io/badge/docker-ready-blue)]()

FLASH Bridge enables trustless Bitcoin to Solana transfers with privacy-preserving Multi-Party Computation (MPC) powered by Arcium.

---

## 🎯 Features

- **🔐 Privacy-Preserving** - Arcium MPC encrypts transaction amounts and addresses
- **⚡ Fast Transfers** - BTC deposits confirmed and SOL delivered quickly
- **🛡️ Trustless** - No custodian, cryptographic proofs for every transaction
- **📊 Institutional Grade** - Full audit trail with cryptographic proofs
- **🐳 Docker Ready** - One-command deployment
- **📚 API Documentation** - OpenAPI/Swagger included

---

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Solana CLI (for keypair generation)
- Node.js 18+ (optional, for local development)

### 1. Clone & Setup

```bash
# Clone repository
git clone https://github.com/your-org/flash-bridge.git
cd flash-bridge

# Run setup script
# Windows:
.\scripts\setup.ps1

# Linux/Mac:
./scripts/setup.sh
```

### 2. Configure Environment

Edit `backend/.env` with your values:

```env
# Required
BITCOIN_BRIDGE_ADDRESS=tb1q_your_testnet_address
DB_PASSWORD=your_secure_password
ADMIN_API_KEY=your_64_char_api_key

# Arcium MPC (simulation for testing)
ENABLE_ARCIUM_MPC=true
ARCIUM_SIMULATED=true
```

### 3. Generate Keypair

```bash
solana-keygen new -o keys/relayer-keypair.json
solana airdrop 2 $(solana-keygen pubkey keys/relayer-keypair.json) --url devnet
```

### 4. Deploy

```bash
# Windows
.\scripts\deploy.ps1

# Linux/Mac
./scripts/deploy.sh
```

### 5. Access

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| API Docs | http://localhost:3001/api/v1/docs |
| Health Check | http://localhost:3001/health |

---

## 📋 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FLASH Bridge Architecture                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   Frontend   │───►│   Backend    │───►│  PostgreSQL  │          │
│  │   (React)    │    │   (Express)  │    │   Database   │          │
│  └──────────────┘    └──────┬───────┘    └──────────────┘          │
│                             │                                        │
│                    ┌────────┴────────┐                              │
│                    │                 │                              │
│              ┌─────▼─────┐    ┌──────▼──────┐                       │
│              │  Arcium   │    │   Solana    │                       │
│              │   MPC     │    │   Network   │                       │
│              └───────────┘    └─────────────┘                       │
│                                                                      │
│  External:                                                           │
│  ┌───────────────┐    ┌──────────────────┐                         │
│  │   Bitcoin     │    │     Redis        │                         │
│  │   Network     │    │  (Rate Limiting) │                         │
│  └───────────────┘    └──────────────────┘                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Bridge Workflow

### BTC → SOL Transfer

1. **Get Deposit Address** - Request unique BTC address
2. **Send BTC** - Transfer BTC to deposit address
3. **Wait for Confirmation** - BTC transaction confirmed
4. **Claim Deposit** - Initiate claim with Solana wallet
5. **Receive SOL** - SOL transferred to your wallet
6. **Get Proof** - Cryptographic proof generated

### API Flow

```bash
# 1. Allocate deposit address
POST /api/v1/bridge/btc-address
{
  "solanaAddress": "YourSolanaWalletAddress..."
}

# 2. Check deposit status
GET /api/v1/bridge/btc-deposit/{txHash}

# 3. Claim deposit
POST /api/v1/bridge/btc-deposit
{
  "solanaAddress": "YourSolanaWalletAddress...",
  "bitcoinTxHash": "your_btc_tx_hash"
}

# 4. Get proof
GET /api/v1/bridge/proof/{txId}
```

---

## 🔒 Arcium MPC

FLASH Bridge uses Arcium for privacy-preserving computation:

### Setup Options

1. **Simulation Mode** (Development)
   ```env
   ARCIUM_SIMULATED=true
   ```

2. **Local Arcium Node** (Testing)
   ```bash
   curl -sSfL https://install.arcium.com | bash
   arcium localnet
   ```

3. **Arcium Devnet/Mainnet** (Production)
   - Register at [arcium.com](https://arcium.com)
   - Configure cluster ID and node offset

See [docs/ARCIUM_SETUP.md](docs/ARCIUM_SETUP.md) for detailed instructions.

---

## 📁 Project Structure

```
flash-bridge/
├── backend/                 # Express.js API server
│   ├── src/
│   │   ├── index.js        # Main entry point
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth, validation, rate limiting
│   │   └── utils/          # Helpers
│   ├── database/           # SQL schemas
│   └── env-template.txt    # Environment template
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API client
│   │   └── contexts/       # React contexts
│   └── env-template.txt    # Environment template
├── scripts/                # Deployment scripts
├── docs/                   # Documentation
├── nginx/                  # HTTPS configuration
├── keys/                   # Keypairs (gitignored)
├── docker-compose.yml      # Docker orchestration
├── QUICK_START.md          # Quick setup guide
└── PRODUCTION_CHECKLIST.md # Production deployment checklist
```

---

## 🔧 Configuration

### Environment Variables

See `backend/env-template.txt` for all available options.

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_API_KEY` | Yes | Admin authentication |
| `BITCOIN_BRIDGE_ADDRESS` | Yes | BTC deposit address |
| `DB_PASSWORD` | Yes | PostgreSQL password |
| `SOLANA_RPC_URL` | Yes | Solana RPC endpoint |
| `FLASH_BRIDGE_MXE_PROGRAM_ID` | Yes | Deployed program ID |
| `ENABLE_ARCIUM_MPC` | Yes | Enable privacy features |

### Network Configurations

**Devnet (Testing)**
```env
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
BITCOIN_NETWORK=testnet
```

**Mainnet (Production)**
```env
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_URL=https://your-rpc-provider.com
BITCOIN_NETWORK=mainnet
BITCOIN_REQUIRED_CONFIRMATIONS=3
```

---

## 🛡️ Security

### Features

- **Rate Limiting** - IP + Wallet based (Redis for distributed)
- **Input Validation** - All inputs sanitized
- **Authentication** - API key + client signature
- **CORS** - Configurable origin whitelist
- **Security Headers** - Helmet.js configured
- **SQL Injection** - Parameterized queries

### Production Recommendations

1. **Use HTTPS** - See [docs/HTTPS_SETUP.md](docs/HTTPS_SETUP.md)
2. **Rotate API keys** - Regular rotation schedule
3. **Enable monitoring** - Log aggregation and alerts
4. **Database backups** - Automated daily backups

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [QUICK_START.md](QUICK_START.md) | 5-minute setup guide |
| [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) | Production deployment checklist |
| [docs/HTTPS_SETUP.md](docs/HTTPS_SETUP.md) | SSL/TLS configuration |
| [docs/ARCIUM_SETUP.md](docs/ARCIUM_SETUP.md) | Arcium MPC setup |
| [API Docs](http://localhost:3001/api/v1/docs) | Interactive API documentation |

---

## 🧪 Development

### Local Development

```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd frontend && npm install

# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Start backend
cd backend && npm run dev

# Start frontend
cd frontend && npm start
```

### Running Tests

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

### Pre-flight Check

```bash
cd backend && npm run preflight
```

---

## 🐳 Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Restart backend
docker-compose restart backend

# Stop all services
docker-compose down

# Full reset (removes data)
docker-compose down -v
docker-compose up -d
```

---

## 📦 Deployment

### Quick Deploy

```bash
# Windows
.\scripts\deploy.ps1 production

# Linux/Mac
./scripts/deploy.sh production
```

### Manual Deploy

1. Complete [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)
2. Configure all environment variables
3. Run `docker-compose up -d`
4. Configure HTTPS with Nginx
5. Verify health checks

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

---

## 🆘 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/flash-bridge/issues)
- **Discord**: [Join our community](#)

---

**Built with ❤️ for the Solana ecosystem**

# 🚀 FLASH Bridge - Quick Start Guide

Get the FLASH Bridge running in 5 minutes.

## Prerequisites

- **Docker** and **Docker Compose** installed
- **Solana CLI** (for generating keypairs)
- A **Bitcoin testnet address** (for receiving deposits)

## Quick Start

### Step 1: Run Setup Script

**Windows (PowerShell):**
```powershell
.\scripts\setup.ps1
```

**Linux/Mac:**
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

This creates:
- `backend/.env` from template
- `frontend/.env` from template
- `keys/` directory for keypairs
- Auto-generated `ADMIN_API_KEY`

### Step 2: Generate Relayer Keypair

```bash
# Install Solana CLI if not installed
# https://docs.solana.com/cli/install-solana-cli-tools

# Generate keypair
solana-keygen new -o keys/relayer-keypair.json

# Fund it on devnet
solana airdrop 2 $(solana-keygen pubkey keys/relayer-keypair.json) --url devnet
```

### Step 3: Configure Environment

Edit `backend/.env` and set these **required** values:

```env
# Your Bitcoin testnet address (for receiving deposits)
BITCOIN_BRIDGE_ADDRESS=tb1qyour_actual_testnet_address

# Database password (will be used by Docker PostgreSQL)
DB_PASSWORD=your_secure_password_here

# Arcium MPC settings (use defaults for devnet testing with simulation)
ENABLE_ARCIUM_MPC=true
ARCIUM_SIMULATED=true  # Set to false for real MPC
ARCIUM_CLUSTER_ID=devnet_default
ARCIUM_NODE_OFFSET=0
```

### Step 3b: (Optional) Real Arcium MPC

For real privacy-preserving MPC instead of simulation:

```bash
# Install Arcium
curl -sSfL https://install.arcium.com | bash

# Start local Arcium network
arcium localnet

# Update backend/.env
ARCIUM_SIMULATED=false
ARCIUM_USE_REAL_SDK=true
```

See `docs/ARCIUM_SETUP.md` for detailed instructions.

### Step 4: Start Everything

```bash
docker-compose up -d
```

This starts:
- ✅ PostgreSQL database
- ✅ Redis (for rate limiting)
- ✅ Backend API (port 3001)
- ✅ Frontend (port 3000)

### Step 5: Verify

```bash
# Check all services are running
docker-compose ps

# Check backend health
curl http://localhost:3001/health

# Check API docs
open http://localhost:3001/api/v1/docs
```

## Access Points

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| API Documentation | http://localhost:3001/api/v1/docs |
| Health Check | http://localhost:3001/health |

## Configuration Files

| File | Purpose |
|------|---------|
| `backend/.env` | Backend configuration |
| `frontend/.env` | Frontend configuration |
| `keys/relayer-keypair.json` | Solana relayer keypair |

## Troubleshooting

### Check Logs
```bash
# All services
docker-compose logs

# Backend only
docker-compose logs backend

# Follow logs
docker-compose logs -f backend
```

### Restart Services
```bash
docker-compose restart backend
```

### Full Reset
```bash
docker-compose down -v  # Removes volumes too
docker-compose up -d
```

### Pre-flight Check
```bash
cd backend
node src/utils/preflight-check.js
```

## Network Configurations

### Devnet (Testing)
```env
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
BITCOIN_NETWORK=testnet
```

### Mainnet (Production)
```env
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_URL=https://your-rpc-provider.com
BITCOIN_NETWORK=mainnet
BITCOIN_REQUIRED_CONFIRMATIONS=3
```

## Common Issues

### "Database connection failed"
- Ensure PostgreSQL container is running: `docker-compose ps`
- Check `DB_PASSWORD` is set in `.env`

### "Relayer keypair not found"
- Generate keypair: `solana-keygen new -o keys/relayer-keypair.json`
- Check `RELAYER_KEYPAIR_PATH` points to correct file

### "Arcium not connected"
- For local testing, ensure Arcium node is running
- Check `ARCIUM_ENDPOINT` is reachable

### "Bitcoin verification failed"
- Ensure `BITCOIN_BRIDGE_ADDRESS` is correct
- Check `BITCOIN_NETWORK` matches your address format

## Next Steps

1. **Fund the relayer** with SOL for gas fees
2. **Configure HTTPS** for production (see `docs/HTTPS_SETUP.md`)
3. **Set up monitoring** and alerts
4. **Deploy to production** using the CI/CD pipeline

---

Need help? Check the full documentation in `README.md` or open an issue on GitHub.


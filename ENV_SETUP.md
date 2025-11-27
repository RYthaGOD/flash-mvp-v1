# Environment Setup Guide

## Quick Start (MVP Demo)

Create a `.env` file in the `backend/` directory with these **minimum required settings**:

```env
# REQUIRED: Enable privacy (uses simulated MPC for MVP)
ENABLE_ARCIUM_MPC=true

# Solana (local validator)
SOLANA_RPC_URL=http://127.0.0.1:8899

# Database
DATABASE_PATH=./database/flash-bridge.db
```

That's it! The system will work in demo mode with simulated privacy.

---

## Complete Configuration Reference

### Privacy & Security (ALWAYS ON)

```env
# Arcium MPC - Complete Privacy
ENABLE_ARCIUM_MPC=true              # REQUIRED: Must be 'true' for privacy
ARCIUM_ENDPOINT=http://localhost:9090
ARCIUM_PRIVACY_LEVEL=full
```

**MVP Note:** Privacy is simulated - no real Arcium network needed for demos.

### Solana Configuration

```env
# RPC Endpoint
SOLANA_RPC_URL=http://127.0.0.1:8899

# zenZEC Token Mint (create with: npm run create-mint)
ZENZEC_MINT=YourZenZECMintAddressHere

# Relayer Keypair (auto-generated if missing)
RELAYER_KEYPAIR_PATH=./relayer-keypair.json

# Exchange Rates
SOL_TO_ZENZEC_RATE=100
ZENZEC_TO_SOL_RATE=0.001
ZENZEC_TO_BTC_RATE=0.001
```

### Bitcoin Configuration

```env
BITCOIN_NETWORK=testnet
BITCOIN_BRIDGE_ADDRESS=
BITCOIN_BRIDGE_PRIVATE_KEY=
BITCOIN_INITIAL_RESERVE_BTC=10
```

### Zcash Configuration

```env
ZCASH_NETWORK=testnet
ZCASH_LIGHTWALLETD_URL=https://testnet.zec.rocks:443
ZCASH_BRIDGE_ADDRESS=
ZCASH_VIEWING_KEY=
```

### Database

```env
DATABASE_PATH=./database/flash-bridge.db
```

---

## Privacy Modes

### MVP Mode (Current)
- ✅ **Simulated Arcium MPC** - No real network needed
- ✅ **Mock encryption** - Base64 encoding for demo
- ✅ **Always enabled** - Cannot be disabled
- ✅ **Perfect for demos** - Shows privacy UX

### Production Mode (Future)
- 🔒 **Real Arcium MPC network** required
- 🔒 **Actual encryption** with distributed nodes
- 🔒 **Hardware security** integration
- 🔒 **Enterprise-grade** privacy

---

## Startup Behavior

### ✅ Correct Setup
```bash
ENABLE_ARCIUM_MPC=true
```
**Result:** Application starts with full simulated privacy

### ❌ Missing Configuration
```bash
# No .env file or ENABLE_ARCIUM_MPC not set
```
**Result:** Application exits with clear error message

### 🎯 Error Message You'll See:
```
❌ Arcium MPC must be enabled for complete privacy.
   Set ENABLE_ARCIUM_MPC=true in your .env file
   For MVP: This enables simulated privacy (no real Arcium network needed)
   For Production: Requires actual Arcium network connection
```

---

## Troubleshooting

### "Arcium MPC must be enabled"
**Solution:** Create `.env` file with `ENABLE_ARCIUM_MPC=true`

### "Database not available"
**Solution:** Create `backend/database/` directory

### "Relayer keypair not found"
**Solution:** Auto-generated on first run, or create with `solana-keygen`

---

## Demo Mode Features

When running in MVP mode, the system automatically:
- ✅ Generates mock transaction signatures if Solana unavailable
- ✅ Simulates encryption without real Arcium network
- ✅ Works without real BTC/ZEC addresses
- ✅ Shows privacy indicators in UI
- ✅ Logs all operations clearly

**Perfect for presentations and testing!**


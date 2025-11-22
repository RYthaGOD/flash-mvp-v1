# Network Configuration Guide

## Quick Answer: What's Required?

**For Basic Demo Mode (MVP):**
- ✅ **Solana** - REQUIRED (minimal config)
- ⚠️ **Zcash** - OPTIONAL (has defaults, works without config)
- ⚠️ **Bitcoin** - OPTIONAL (has defaults, works without config)

**For Full Functionality:**
- ✅ **Solana** - REQUIRED (needs PROGRAM_ID and ZENZEC_MINT)
- ✅ **Zcash** - OPTIONAL (only if using Zcash verification)
- ✅ **Bitcoin** - OPTIONAL (only if using Bitcoin flow)

---

## Network Configuration Breakdown

### 1. Solana Network ⚠️ REQUIRED (Minimal)

**Minimum Required for Demo:**
```env
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
```

**For Actual Minting (Required):**
```env
PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
ZENZEC_MINT=YourZenZECMintAddressHere  # Must create this first
```

**Optional:**
```env
RELAYER_KEYPAIR_PATH=~/.config/solana/id.json  # Only if using relayer
ENABLE_RELAYER=false  # Set to true to enable SOL swaps
ZENZEC_TO_SOL_RATE=0.001  # Exchange rate for swaps
```

**Status:**
- ✅ Works with defaults (devnet)
- ⚠️ Needs PROGRAM_ID and ZENZEC_MINT for real minting
- ⚠️ Needs relayer keypair for SOL swaps

---

### 2. Zcash Network ⚠️ OPTIONAL

**Default Configuration (Works Out of Box):**
```env
ZCASH_NETWORK=mainnet  # Default
ZCASH_LIGHTWALLETD_URL=https://zcash-mainnet.chainsafe.dev  # Default
ZCASH_EXPLORER_URL=https://zcashblockexplorer.com  # Default
```

**Optional (Only if using Zcash verification):**
```env
ZCASH_BRIDGE_ADDRESS=zs1...  # Your Zcash shielded address
```

**When You Need It:**
- ✅ **NOT needed** for demo mode (works without)
- ✅ **NOT needed** for basic minting
- ⚠️ **Only needed** if you want to verify real Zcash transactions
- ⚠️ **Only needed** if using `zcashTxHash` in bridge requests

**Status:**
- ✅ Works with defaults (public endpoints)
- ✅ No configuration needed for demo
- ⚠️ Only configure if using real Zcash verification

---

### 3. Bitcoin Network ⚠️ OPTIONAL

**Default Configuration (Works Out of Box):**
```env
BITCOIN_NETWORK=mainnet  # Default
BITCOIN_EXPLORER_URL=https://blockstream.info/api  # Default
```

**Optional (Only if using Bitcoin flow):**
```env
BITCOIN_BRIDGE_ADDRESS=bc1q...  # Your Bitcoin address
BOOTSTRAP_BTC=0.1  # Initial reserve
ENABLE_BITCOIN_MONITORING=true  # Auto-detect payments
```

**When You Need It:**
- ✅ **NOT needed** for demo mode (works without)
- ✅ **NOT needed** for basic minting
- ⚠️ **Only needed** if you want to verify real Bitcoin transactions
- ⚠️ **Only needed** if using `bitcoinTxHash` in bridge requests
- ⚠️ **Only needed** if enabling automatic Bitcoin monitoring

**Status:**
- ✅ Works with defaults (public explorer)
- ✅ No configuration needed for demo
- ⚠️ Only configure if using real Bitcoin verification

---

## Configuration Scenarios

### Scenario 1: Quick Demo (Minimum Config)

**What Works:**
- ✅ Demo mode bridge (no transaction verification)
- ✅ Frontend UI
- ✅ Basic API endpoints
- ⚠️ Minting will fail without PROGRAM_ID and ZENZEC_MINT

**Required .env:**
```env
PORT=3001
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
```

**Result:** System runs, but minting won't work until you configure Solana program.

---

### Scenario 2: Full Demo (Recommended)

**What Works:**
- ✅ Real zenZEC minting
- ✅ Complete workflow
- ✅ Transaction tracking
- ⚠️ No Zcash/Bitcoin verification (uses demo mode)

**Required .env:**
```env
PORT=3001
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
ZENZEC_MINT=YourActualMintAddressHere
```

**Optional:**
```env
ENABLE_RELAYER=true  # For SOL swaps
RELAYER_KEYPAIR_PATH=~/.config/solana/id.json
ZENZEC_TO_SOL_RATE=0.001
```

**Result:** Full functionality except Zcash/Bitcoin verification.

---

### Scenario 3: Production (All Networks)

**What Works:**
- ✅ Everything
- ✅ Real Zcash verification
- ✅ Real Bitcoin verification
- ✅ Automatic monitoring

**Required .env:**
```env
# Solana (Required)
PORT=3001
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet
PROGRAM_ID=YourMainnetProgramID
ZENZEC_MINT=YourMainnetMintAddress

# Zcash (Optional but recommended)
ZCASH_NETWORK=mainnet
ZCASH_BRIDGE_ADDRESS=zs1...
ZCASH_LIGHTWALLETD_URL=https://zcash-mainnet.chainsafe.dev

# Bitcoin (Optional but recommended)
BITCOIN_NETWORK=mainnet
BITCOIN_BRIDGE_ADDRESS=bc1q...
BITCOIN_EXPLORER_URL=https://blockstream.info/api

# Relayer (Required for swaps)
ENABLE_RELAYER=true
RELAYER_KEYPAIR_PATH=/secure/path/to/keypair.json
ZENZEC_TO_SOL_RATE=0.001
```

**Result:** Full production system.

---

## Default Behavior

### What Happens Without Configuration?

**Solana:**
- Uses devnet by default
- Uses public RPC endpoint
- ⚠️ Minting fails without PROGRAM_ID and ZENZEC_MINT

**Zcash:**
- Uses mainnet by default
- Uses public lightwalletd endpoint
- ✅ Works for demo (mocks verification)
- ⚠️ Real verification needs bridge address

**Bitcoin:**
- Uses mainnet by default
- Uses public Blockstream API
- ✅ Works for demo (mocks verification)
- ⚠️ Real verification needs bridge address

---

## Minimum Configuration for Working System

### Absolute Minimum (Demo Mode Only):
```env
PORT=3001
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
```

**What Works:**
- ✅ Backend starts
- ✅ API endpoints respond
- ✅ Frontend connects
- ❌ Minting fails (needs PROGRAM_ID and ZENZEC_MINT)

### Recommended Minimum (Full Demo):
```env
PORT=3001
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
ZENZEC_MINT=YourMintAddressHere
```

**What Works:**
- ✅ Everything in demo mode
- ✅ Real zenZEC minting
- ✅ Complete workflow
- ⚠️ No Zcash/Bitcoin verification (uses demo mode)

---

## Network Configuration Summary

| Network | Required? | Default Works? | When Needed |
|---------|-----------|----------------|-------------|
| **Solana** | ✅ YES | ✅ Yes (devnet) | Always - core functionality |
| **Zcash** | ⚠️ NO | ✅ Yes (public endpoints) | Only for real Zcash verification |
| **Bitcoin** | ⚠️ NO | ✅ Yes (public explorer) | Only for real Bitcoin verification |
| **Arcium MPC** | ⚠️ NO | ✅ Yes (disabled) | Only for full privacy mode |

---

## Quick Start Configuration

### For Testing/Demo:
```env
# backend/.env
PORT=3001
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
ZENZEC_MINT=CreateThisFirst
```

### For Production:
Add all network configurations as shown in Scenario 3 above.

---

## Conclusion

**Answer:** You only need to configure **Solana** for the system to work. Zcash and Bitcoin have sensible defaults and work without configuration for demo purposes.

**Minimum:** Just Solana network URL and program/mint addresses.

**Recommended:** Solana + relayer configuration for full functionality.

**Relayer Setup:**
- Set `ENABLE_RELAYER=true` in backend .env
- Configure `RELAYER_KEYPAIR_PATH` to point to a keypair with SOL balance
- Set `ZENZEC_TO_SOL_RATE` for exchange rate (e.g., 0.001 = 1 zenZEC = 0.001 SOL)
- The relayer automatically monitors for `BurnSwapEvent` and sends SOL to users

**Without Relayer:**
- ✅ Minting works
- ✅ Holding tokens works
- ❌ Automatic SOL swaps don't work (users can still burn, but won't receive SOL automatically)

**Optional:** Zcash and Bitcoin only if you want real transaction verification.


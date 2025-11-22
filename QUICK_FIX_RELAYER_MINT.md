# Quick Fix: Relayer Keypair & ZENZEC_MINT Configuration

**Goal:** Fix the 2 failing backtest endpoints by configuring required settings.

---

## Step 1: Configure Relayer Keypair (5 minutes)

### Check if you have a Solana keypair:

```powershell
# Windows PowerShell
Test-Path "$env:USERPROFILE\.config\solana\id.json"
```

### If you have one:
The `update-env.ps1` script will automatically use it. Just run:
```powershell
.\update-env.ps1
```

### If you don't have one:

**Option A: Install Solana CLI and create one**
```bash
# Install Solana CLI (if not installed)
# Then create keypair
solana-keygen new

# This creates: C:\Users\YourUsername\.config\solana\id.json
```

**Option B: Use a test keypair (for development only)**
```bash
# Create a test keypair in the project
solana-keygen new --outfile ./backend/relayer-keypair.json

# Fund it with devnet SOL
solana airdrop 2 $(solana address -k ./backend/relayer-keypair.json) --url devnet
```

Then update `backend/.env`:
```bash
RELAYER_KEYPAIR_PATH=./relayer-keypair.json
```

---

## Step 2: Configure ZENZEC_MINT (10 minutes)

### Option A: Use Existing Mint (If Already Deployed)

If you've already deployed the program and created a mint, just add it to `backend/.env`:
```bash
ZENZEC_MINT=YourActualMintAddressHere
```

### Option B: Create New Mint (First Time Setup)

**Using Solana CLI:**
```bash
# Create a new SPL Token mint
spl-token create-token --decimals 8 --url devnet

# Output will show: Creating token <MINT_ADDRESS>
# Copy the MINT_ADDRESS and add to backend/.env
```

**Or programmatically via Anchor:**
The mint should be created when you initialize the bridge config. Check your deployment logs.

---

## Step 3: Update backend/.env

Run the update script:
```powershell
.\update-env.ps1
```

Or manually edit `backend/.env` and add:
```bash
# Relayer Configuration
RELAYER_KEYPAIR_PATH=C:\Users\YourUsername\.config\solana\id.json
# OR if using custom: RELAYER_KEYPAIR_PATH=./relayer-keypair.json

# Token Configuration  
ZENZEC_MINT=YourActualMintAddressHere

# Exchange Rates (optional but recommended)
SOL_TO_ZENZEC_RATE=100
ZENZEC_TO_BTC_RATE=0.001
```

---

## Step 4: Verify Configuration

### Check keypair exists:
```powershell
Test-Path (Get-Content backend\.env | Select-String "RELAYER_KEYPAIR_PATH" | ForEach-Object { $_.Line.Split('=')[1] })
```

### Check mint address is set:
```powershell
Get-Content backend\.env | Select-String "ZENZEC_MINT"
```

---

## Step 5: Restart Backend & Re-run Backtest

```powershell
# Restart backend (stop current, then start)
cd backend
npm start

# In another terminal, re-run backtest
cd backtest
npm test
```

**Expected Result:** ✅ **12/12 tests passing**

---

## Troubleshooting

### "Relayer keypair not configured"
- ✅ Check `RELAYER_KEYPAIR_PATH` points to valid file
- ✅ Verify file contains valid JSON keypair
- ✅ Ensure path uses correct format (Windows: `C:\...`, not `~/.config/...`)

### "Invalid mint address"
- ✅ Verify `ZENZEC_MINT` is a valid Solana address
- ✅ Check mint exists: `spl-token supply <MINT_ADDRESS> --url devnet`
- ✅ Ensure using correct network (devnet/mainnet)

### "Insufficient funds"
- ✅ Fund relayer keypair: `solana airdrop 2 --url devnet`
- ✅ Check balance: `solana balance --url devnet`

---

## Quick Reference

### Windows Paths:
```bash
RELAYER_KEYPAIR_PATH=C:\Users\%USERNAME%\.config\solana\id.json
```

### Environment Variables:
```bash
RELAYER_KEYPAIR_PATH    # Path to keypair JSON file
ZENZEC_MINT            # SPL Token mint address
SOL_TO_ZENZEC_RATE     # Exchange rate (default: 100)
ZENZEC_TO_BTC_RATE     # Exchange rate (default: 0.001)
```

---

**Status:** Ready to Configure → 100% Backtest Pass Rate


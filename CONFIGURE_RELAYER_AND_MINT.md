# Configure Relayer Keypair and ZENZEC_MINT

**Purpose:** Fix the 2 failing backtest endpoints by configuring required settings.

---

## Quick Setup Guide

### Step 1: Configure Relayer Keypair

The relayer needs a Solana keypair to sign transactions on behalf of users.

#### Option A: Use Existing Solana Keypair (Recommended for Dev)

```bash
# Check if you have a Solana CLI keypair
solana address

# If you have one, use its path:
# Windows: C:\Users\YourUsername\.config\solana\id.json
# Linux/Mac: ~/.config/solana/id.json
```

#### Option B: Create New Keypair for Relayer

```bash
# Generate a new keypair
solana-keygen new --outfile ./relayer-keypair.json

# Fund it with SOL (for devnet)
solana airdrop 2 $(solana address -k ./relayer-keypair.json) --url devnet
```

#### Update backend/.env

```bash
# Windows
RELAYER_KEYPAIR_PATH=C:\Users\YourUsername\.config\solana\id.json

# Or if using custom keypair
RELAYER_KEYPAIR_PATH=./relayer-keypair.json

# Linux/Mac
RELAYER_KEYPAIR_PATH=~/.config/solana/id.json
```

---

### Step 2: Configure ZENZEC_MINT Address

The mint address is the SPL Token mint for zenZEC tokens.

#### Option A: Use Existing Mint (If Already Deployed)

If you've already deployed the Solana program and created the mint:

```bash
# In backend/.env
ZENZEC_MINT=YourActualMintAddressHere
```

#### Option B: Create New Mint (For First Time Setup)

**Method 1: Using Solana CLI**

```bash
# Create a new SPL Token mint
spl-token create-token --decimals 8

# This will output: Creating token <MINT_ADDRESS>
# Copy the MINT_ADDRESS and use it in .env
```

**Method 2: Programmatic Creation (Via Backend)**

The mint should be created when you deploy the Solana program. Check your deployment logs or Anchor.toml.

**Method 3: Use Test Mint (For Development Only)**

For testing purposes, you can use a placeholder:

```bash
# In backend/.env (DEVNET ONLY - NOT FOR PRODUCTION)
ZENZEC_MINT=11111111111111111111111111111111
```

⚠️ **Warning:** Using a placeholder mint will cause transactions to fail. You need a real mint address.

---

## Complete Configuration Example

### backend/.env

```bash
# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS

# Relayer Configuration
RELAYER_KEYPAIR_PATH=~/.config/solana/id.json
ENABLE_RELAYER=false

# Token Configuration
ZENZEC_MINT=YourActualMintAddressHere

# Exchange Rates
SOL_TO_ZENZEC_RATE=100
ZENZEC_TO_BTC_RATE=0.001

# BTC Relayer
ENABLE_BTC_RELAYER=false
```

---

## Verification Steps

### 1. Verify Keypair Exists

```bash
# Check if keypair file exists
# Windows PowerShell
Test-Path $env:USERPROFILE\.config\solana\id.json

# Linux/Mac
test -f ~/.config/solana/id.json && echo "Exists" || echo "Missing"
```

### 2. Verify Keypair Has SOL

```bash
# Check balance
solana balance --url devnet

# If balance is 0, airdrop some SOL
solana airdrop 2 --url devnet
```

### 3. Verify Mint Address

```bash
# Check if mint account exists
spl-token supply <MINT_ADDRESS>

# Or using Solana CLI
solana account <MINT_ADDRESS> --url devnet
```

### 4. Test Configuration

After updating `.env`, restart the backend and re-run backtest:

```bash
# Restart backend
cd backend
npm start

# In another terminal, run backtest
cd backtest
npm test
```

---

## Troubleshooting

### Error: "Relayer keypair not configured"

**Solution:**
1. Check `RELAYER_KEYPAIR_PATH` in `.env` is correct
2. Verify the file exists at that path
3. Ensure the file contains valid JSON keypair data

### Error: "Invalid mint address"

**Solution:**
1. Verify `ZENZEC_MINT` is a valid Solana address
2. Check the mint account exists on-chain
3. Ensure you're using the correct network (devnet/mainnet)

### Error: "Insufficient funds"

**Solution:**
1. Fund the relayer keypair with SOL
2. For devnet: `solana airdrop 2 --url devnet`
3. For mainnet: Transfer SOL to the relayer address

### Error: "Program account not found"

**Solution:**
1. Deploy the Solana program first
2. Update `PROGRAM_ID` in `.env` with deployed program ID
3. Ensure program is deployed to the correct network

---

## Deployment Workflow

### For First-Time Setup:

1. **Deploy Solana Program:**
   ```bash
   anchor build
   anchor deploy --provider.cluster devnet
   ```

2. **Create zenZEC Mint:**
   ```bash
   # Option 1: Via program initialization
   # The program should create the mint during initialize_config
   
   # Option 2: Create manually
   spl-token create-token --decimals 8
   ```

3. **Initialize Bridge Config:**
   ```bash
   # Call initialize_config instruction
   # This sets up the bridge with the mint
   ```

4. **Configure Backend:**
   ```bash
   # Update backend/.env with:
   # - PROGRAM_ID (from deployment)
   # - ZENZEC_MINT (from mint creation)
   # - RELAYER_KEYPAIR_PATH (your keypair)
   ```

5. **Test:**
   ```bash
   cd backtest
   npm test
   ```

---

## Security Notes

### ⚠️ Important Security Considerations:

1. **Never Commit Keypairs:**
   - Add `*.json` keypair files to `.gitignore`
   - Never commit private keys to version control

2. **Use Separate Keypairs:**
   - Use a dedicated keypair for the relayer
   - Don't use your main wallet keypair

3. **Limit Relayer Funds:**
   - Only fund the relayer with necessary SOL
   - Monitor relayer balance regularly

4. **Environment Separation:**
   - Use different keypairs for devnet/mainnet
   - Never use mainnet keypairs in development

---

## Quick Reference

### Windows Paths:
```bash
RELAYER_KEYPAIR_PATH=C:\Users\%USERNAME%\.config\solana\id.json
```

### Linux/Mac Paths:
```bash
RELAYER_KEYPAIR_PATH=~/.config/solana/id.json
```

### Environment Variables:
```bash
RELAYER_KEYPAIR_PATH    # Path to relayer keypair JSON file
ZENZEC_MINT            # SPL Token mint address
SOL_TO_ZENZEC_RATE     # Exchange rate (default: 100)
ZENZEC_TO_BTC_RATE     # Exchange rate (default: 0.001)
ENABLE_RELAYER         # Enable SOL relayer (true/false)
ENABLE_BTC_RELAYER     # Enable BTC relayer (true/false)
```

---

## Next Steps

After configuration:

1. ✅ Restart backend server
2. ✅ Re-run backtest: `cd backtest && npm test`
3. ✅ Verify all 12 tests pass
4. ✅ Test actual workflows via frontend

---

**Status:** Ready for Configuration


# Testing Guide - How to Run the System

## Quick Start (Easiest Method)

### Option 1: Using PowerShell Script (Windows)

```powershell
# From project root
.\run.ps1
```

This will:
- Start backend on http://localhost:3001
- Start frontend on http://localhost:3000
- Open in separate windows

### Option 2: Using npm Scripts

```bash
# Terminal 1: Backend
npm run start:backend

# Terminal 2: Frontend  
npm run start:frontend
```

---

## Detailed Step-by-Step Setup

### Prerequisites

1. **Node.js v18+** installed
2. **npm** installed
3. **Solana CLI** (optional, for localnet testing)
4. **Anchor CLI** (optional, for program deployment)

### Step 1: Install Dependencies

```bash
# Install all dependencies (backend + frontend)
npm run install:all

# OR install separately:
cd backend
npm install
cd ../frontend
npm install
```

### Step 2: Configure Backend

Create `backend/.env` file:

```env
# Required for basic functionality
PORT=3001
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
ZENZEC_MINT=YourZenZECMintAddressHere

# Optional: Enable relayer for SOL swaps
ENABLE_RELAYER=false
RELAYER_KEYPAIR_PATH=~/.config/solana/id.json
ZENZEC_TO_SOL_RATE=0.001

# Optional: Zcash integration
ZCASH_NETWORK=mainnet
ZCASH_BRIDGE_ADDRESS=

# Optional: Bitcoin integration
BITCOIN_NETWORK=mainnet
BITCOIN_BRIDGE_ADDRESS=

# Optional: Arcium MPC privacy
ENABLE_ARCIUM_MPC=false
```

**Note:** For testing, you can use the default `PROGRAM_ID`. For actual minting, you'll need to:
1. Deploy the Solana program
2. Create a zenZEC mint
3. Update `PROGRAM_ID` and `ZENZEC_MINT` in `.env`

### Step 3: Configure Frontend

Create `frontend/.env` file:

```env
REACT_APP_API_URL=http://localhost:3001
REACT_APP_PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
REACT_APP_ZENZEC_MINT=YourZenZECMintAddressHere
```

### Step 4: Start Backend Server

```bash
cd backend
npm start
```

Backend will start on **http://localhost:3001**

You should see:
```
============================================================
FLASH — BTC → ZEC → Solana Bridge (MVP)
============================================================
Backend server running on port 3001
Solana Network: devnet
Program ID: Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
...
```

### Step 5: Start Frontend (New Terminal)

```bash
cd frontend
npm start
```

Frontend will start on **http://localhost:3000**

Browser should automatically open. If not, navigate to:
**http://localhost:3000**

---

## Testing Workflows

### Test 1: Basic Bridge (Demo Mode)

1. Open http://localhost:3000
2. Click "Select Wallet" → Connect Phantom/Solflare
3. Go to **Bridge** tab
4. Enter amount (e.g., `1.5`)
5. Click "Bridge to Solana"
6. ✅ Should see success message with transaction ID

**Note:** In demo mode, minting may fail if `ZENZEC_MINT` is not configured, but the API will respond.

### Test 2: Zcash Integration

1. Go to **Zcash** tab
2. Check ZEC price (should display USD price)
3. Verify a transaction:
   - Enter a Zcash transaction hash
   - Click "Verify Transaction"
4. Validate an address:
   - Enter a Zcash address (t1, t3, or zs1)
   - Click "Validate Address"

### Test 3: Privacy Features

1. Go to **Privacy** tab
2. Check Arcium MPC status
3. Encrypt an amount:
   - Enter amount
   - Click "Encrypt Amount"
4. Create private bridge:
   - Enter amount
   - Click "Create Private Bridge"

**Note:** Arcium features require `ENABLE_ARCIUM_MPC=true` in backend `.env`

### Test 4: Token Management

1. Go to **Tokens** tab
2. View balances (SOL and zenZEC)
3. Burn tokens:
   - Enter amount to burn
   - Click "Burn & Swap to SOL"
   - Sign transaction in wallet

**Note:** Requires zenZEC tokens in wallet. Bridge some first!

### Test 5: Transaction History

1. Go to **History** tab
2. View recent transactions
3. Click transaction links to view on Solscan
4. Click "Refresh" to update

---

## Testing with Real Solana Program

### Option A: Use Devnet (Recommended for Testing)

1. **Deploy Program to Devnet:**
   ```bash
   anchor build
   anchor deploy --provider.cluster devnet
   ```

2. **Create zenZEC Mint:**
   ```bash
   # Use Solana CLI or create via script
   spl-token create-token --decimals 8
   # Save the mint address
   ```

3. **Update `.env` files:**
   ```env
   # backend/.env
   PROGRAM_ID=<your_deployed_program_id>
   ZENZEC_MINT=<your_mint_address>
   
   # frontend/.env
   REACT_APP_PROGRAM_ID=<your_deployed_program_id>
   REACT_APP_ZENZEC_MINT=<your_mint_address>
   ```

4. **Restart services:**
   - Stop backend (Ctrl+C)
   - Stop frontend (Ctrl+C)
   - Restart both

### Option B: Use Localnet

1. **Start Local Validator:**
   ```bash
   solana-test-validator
   ```

2. **Deploy Program:**
   ```bash
   anchor build
   anchor deploy
   ```

3. **Update `.env`:**
   ```env
   SOLANA_RPC_URL=http://localhost:8899
   SOLANA_NETWORK=localnet
   ```

---

## Troubleshooting

### Backend Won't Start

**Error: "Cannot find module"**
```bash
cd backend
npm install
```

**Error: "Port 3001 already in use"**
- Change `PORT=3002` in `backend/.env`
- Update `REACT_APP_API_URL=http://localhost:3002` in `frontend/.env`

**Error: "PROGRAM_ID not found"**
- Use default: `Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS`
- Or deploy your own program

### Frontend Won't Start

**Error: "Cannot find module"**
```bash
cd frontend
npm install
```

**Error: "Port 3000 already in use"**
- Kill the process using port 3000
- Or set `PORT=3002` in `frontend/.env`

**Error: "Module not found: @solana/spl-token"**
```bash
cd frontend
npm install @solana/spl-token @coral-xyz/anchor
```

### Wallet Connection Issues

**Wallet not connecting:**
- Make sure Phantom/Solflare is installed
- Check browser console for errors
- Try refreshing the page

**Wrong network:**
- Make sure wallet is on Devnet (for testing)
- Settings → Developer Mode → Change Network

### API Errors

**"Failed to fetch"**
- Check backend is running on http://localhost:3001
- Check `REACT_APP_API_URL` in `frontend/.env`
- Check CORS settings in backend

**"Minting failed"**
- Check `ZENZEC_MINT` is configured
- Check program is deployed
- Check wallet has SOL for fees

---

## Quick Test Checklist

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can connect wallet
- [ ] Bridge tab loads
- [ ] Zcash tab loads
- [ ] Privacy tab loads
- [ ] Tokens tab loads
- [ ] History tab loads
- [ ] Can submit bridge request (demo mode)
- [ ] API endpoints respond

---

## Next Steps After Testing

1. **Deploy Program:** Deploy to devnet/mainnet
2. **Create Mint:** Create zenZEC SPL token mint
3. **Configure Relayer:** Set up relayer for SOL swaps
4. **Enable Features:** Enable Zcash/Bitcoin verification if needed
5. **Test Full Workflow:** Test complete bridge lifecycle

---

## Support

For issues:
1. Check browser console (F12)
2. Check backend terminal for errors
3. Check `ERROR_CHECK_SUMMARY.md` for known issues
4. Review `SETUP_GUIDE.md` for detailed setup

---

## Summary

**Easiest Way to Test:**
```powershell
.\run.ps1
```

**Manual Way:**
```bash
# Terminal 1
cd backend && npm start

# Terminal 2
cd frontend && npm start
```

**Then:**
1. Open http://localhost:3000
2. Connect wallet
3. Start testing! 🚀


# Quick Fix - "Still Not Working"

## What Error Are You Seeing?

Please tell me:
1. **Where is the error?** (Backend terminal, Frontend terminal, Browser console, Browser page)
2. **What is the exact error message?** (Copy/paste it)
3. **What were you trying to do?** (Start backend, start frontend, use a feature)

## Most Common Fixes

### Fix 1: Missing .env Files

**Create `frontend/.env` manually:**
```env
REACT_APP_API_URL=http://localhost:3001
REACT_APP_PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
REACT_APP_ZENZEC_MINT=YourZenZECMintAddressHere
```

**Create `backend/.env` manually:**
```env
PORT=3001
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
ZENZEC_MINT=YourZenZECMintAddressHere
ENABLE_RELAYER=false
```

### Fix 2: Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend  
cd ../frontend
npm install
```

### Fix 3: Missing Tab Files

If you see "Cannot find module './tabs/BridgeTab'", the tab files might be in the wrong location.

**Check:**
- Files should be in: `frontend/src/components/tabs/`
- Files needed:
  - BridgeTab.js
  - ZcashTab.js
  - ArciumTab.js
  - TokenManagementTab.js
  - TransactionHistoryTab.js
  - TabStyles.css

### Fix 4: Import Errors

If you see "Module not found: @solana/spl-token":

```bash
cd frontend
npm install @solana/spl-token @coral-xyz/anchor
```

## Step-by-Step Recovery

1. **Stop everything** (Ctrl+C in all terminals)

2. **Create .env files** (see Fix 1 above)

3. **Install dependencies:**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

4. **Start backend:**
   ```bash
   cd backend
   npm start
   ```
   Wait for "Backend server running on port 3001"

5. **Start frontend (new terminal):**
   ```bash
   cd frontend
   npm start
   ```
   Wait for "Compiled successfully!"

6. **Open browser:**
   - Go to http://localhost:3000
   - Press F12 to open console
   - Check for errors

## Still Not Working?

**Please provide:**
- Exact error message
- Where it appears (terminal/browser)
- What you were doing

This will help me diagnose the specific issue!


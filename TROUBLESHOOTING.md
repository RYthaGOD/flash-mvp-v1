# Troubleshooting Guide - "Still Not Working"

## Quick Diagnostic

Run this to check what's wrong:

```powershell
# Check if files exist
Test-Path "backend\.env"
Test-Path "frontend\.env"
Test-Path "backend\node_modules"
Test-Path "frontend\node_modules"

# Check if ports are in use
Test-NetConnection localhost -Port 3001
Test-NetConnection localhost -Port 3000
```

## Common Issues & Fixes

### Issue 1: Frontend .env Missing

**Symptom:** Frontend won't connect to backend

**Fix:**
Create `frontend/.env`:
```env
REACT_APP_API_URL=http://localhost:3001
REACT_APP_PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
REACT_APP_ZENZEC_MINT=YourZenZECMintAddressHere
```

### Issue 2: Dependencies Not Installed

**Symptom:** "Cannot find module" errors

**Fix:**
```bash
cd backend
npm install

cd ../frontend
npm install
```

### Issue 3: Import Errors

**Symptom:** "Module not found: @solana/spl-token"

**Fix:**
```bash
cd frontend
npm install @solana/spl-token @coral-xyz/anchor
```

### Issue 4: Component Import Errors

**Symptom:** "Cannot find module './tabs/BridgeTab'"

**Fix:**
Make sure these files exist:
- `frontend/src/components/tabs/BridgeTab.js`
- `frontend/src/components/tabs/ZcashTab.js`
- `frontend/src/components/tabs/ArciumTab.js`
- `frontend/src/components/tabs/TokenManagementTab.js`
- `frontend/src/components/tabs/TransactionHistoryTab.js`
- `frontend/src/components/tabs/TabStyles.css`

### Issue 5: Backend Not Starting

**Symptom:** Backend crashes or won't start

**Check:**
1. Is `backend/.env` configured?
2. Are dependencies installed? (`cd backend && npm install`)
3. Check backend terminal for error messages

**Common Errors:**
- "Cannot find module" → Run `npm install`
- "Port 3001 in use" → Change PORT in .env or kill process
- "PROGRAM_ID not found" → Use default or deploy program

### Issue 6: Frontend Not Starting

**Symptom:** Frontend crashes or shows blank page

**Check:**
1. Is `frontend/.env` configured?
2. Are dependencies installed? (`cd frontend && npm install`)
3. Check browser console (F12) for errors
4. Check frontend terminal for compilation errors

**Common Errors:**
- "Module not found" → Run `npm install`
- "Cannot find './tabs/...'" → Check tab files exist
- "Port 3000 in use" → Kill process or change port
- "Failed to fetch" → Check backend is running

### Issue 7: Blank Page / No UI

**Symptom:** Page loads but shows nothing

**Check:**
1. Browser console (F12) for JavaScript errors
2. Network tab for failed requests
3. Make sure `TabbedInterface.js` exists
4. Check `App.js` imports `TabbedInterface`

**Fix:**
```bash
# Rebuild frontend
cd frontend
rm -rf node_modules
npm install
npm start
```

### Issue 8: Wallet Won't Connect

**Symptom:** Wallet button doesn't work

**Check:**
1. Is Phantom/Solflare installed?
2. Browser console for errors
3. Try different browser
4. Check wallet is unlocked

## Step-by-Step Fix

### Step 1: Verify Files Exist

```powershell
# Check all required files
Get-ChildItem "frontend\src\components\tabs" | Select-Object Name
Get-ChildItem "backend\src" | Select-Object Name
```

### Step 2: Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Step 3: Create .env Files

**Backend (`backend/.env`):**
```env
PORT=3001
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
ZENZEC_MINT=YourZenZECMintAddressHere
ENABLE_RELAYER=false
```

**Frontend (`frontend/.env`):**
```env
REACT_APP_API_URL=http://localhost:3001
REACT_APP_PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
REACT_APP_ZENZEC_MINT=YourZenZECMintAddressHere
```

### Step 4: Start Services

```bash
# Terminal 1
cd backend
npm start

# Terminal 2
cd frontend
npm start
```

### Step 5: Check for Errors

**Backend Terminal:**
- Look for "Backend server running on port 3001"
- Check for any red error messages

**Frontend Terminal:**
- Look for "Compiled successfully!"
- Check for any compilation errors

**Browser Console (F12):**
- Check for JavaScript errors
- Check Network tab for failed requests

## Still Not Working?

**Please provide:**
1. What error message you see (exact text)
2. Where it appears (backend terminal, frontend terminal, browser console)
3. What you were trying to do
4. Screenshot if possible

**Quick Test:**
```bash
# Test backend API
curl http://localhost:3001/health

# Test frontend
# Open http://localhost:3000 in browser
# Check browser console (F12)
```

## Emergency Reset

If nothing works, try a complete reset:

```bash
# Backend
cd backend
rm -rf node_modules
npm install
npm start

# Frontend (new terminal)
cd frontend
rm -rf node_modules
npm install
npm start
```


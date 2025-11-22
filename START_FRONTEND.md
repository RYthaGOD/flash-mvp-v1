# Quick Fix: Start Frontend Server

## Problem
Frontend not accessible at http://localhost:3000 - "Connection Refused"

## Solution

### Step 1: Navigate to Frontend Directory

```powershell
cd "C:\Users\craig\OneDrive\Documents\flash-mvp-main\flash-mvp-copilot-merge-all-branches-for-demo\frontend"
```

### Step 2: Install Dependencies (if not done)

```powershell
npm install
```

### Step 3: Start Frontend Server

```powershell
npm start
```

### Step 4: Wait for Compilation

You should see:
```
Compiled successfully!

You can now view flash-mvp-frontend in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.x.x:3000
```

### Step 5: Open Browser

Open http://localhost:3000 in your browser

---

## Alternative: Use the Run Script

From project root:

```powershell
cd "C:\Users\craig\OneDrive\Documents\flash-mvp-main\flash-mvp-copilot-merge-all-branches-for-demo"
.\run.ps1 frontend
```

---

## Troubleshooting

### Error: "Cannot find module"

**Fix:**
```powershell
cd frontend
npm install
```

### Error: "Port 3000 already in use"

**Fix:**
1. Kill the process using port 3000
2. Or change port: `set PORT=3001` then `npm start`

### Error: "Module not found: @solana/spl-token"

**Fix:**
```powershell
cd frontend
npm install @solana/spl-token @coral-xyz/anchor
```

### Error: "Cannot find module './tabs/BridgeTab'"

**Fix:**
- Check that all tab files exist in `frontend/src/components/tabs/`
- Files should be: BridgeTab.js, ZcashTab.js, ArciumTab.js, TokenManagementTab.js, TransactionHistoryTab.js, TabStyles.css

### Compilation Errors

**Check:**
1. Browser console (F12) for errors
2. Terminal output for compilation errors
3. All imports are correct

---

## Quick Start Command

```powershell
cd "C:\Users\craig\OneDrive\Documents\flash-mvp-main\flash-mvp-copilot-merge-all-branches-for-demo\frontend"
npm install
npm start
```

Then open http://localhost:3000


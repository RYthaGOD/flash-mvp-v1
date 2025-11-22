# Quick Start: Frontend Access

## ✅ Dependencies Installed

Frontend dependencies have been installed successfully.

## 🚀 Start Frontend Now

### Step 1: Open New Terminal/PowerShell

**Important:** Keep this terminal open - the server needs to keep running.

### Step 2: Navigate and Start

```powershell
cd "C:\Users\craig\OneDrive\Documents\flash-mvp-main\flash-mvp-copilot-merge-all-branches-for-demo\frontend"
npm start
```

### Step 3: Wait for Compilation

You'll see output like:
```
Compiling...
Compiled successfully!

You can now view flash-mvp-frontend in the browser.

  Local:            http://localhost:3000
```

**This takes 30-60 seconds on first start.**

### Step 4: Open Browser

Once you see "Compiled successfully!", open:
**http://localhost:3000**

---

## What You Should See

✅ **FLASH Bridge** header  
✅ **Wallet Connect** button  
✅ **5 Tabs:** Bridge, Zcash, Privacy, Tokens, History  
✅ **Network Status** display  

---

## If It Doesn't Work

### Check 1: Is Backend Running?

The frontend needs the backend API. Make sure backend is running on port 3001:

```powershell
# In another terminal
cd "C:\Users\craig\OneDrive\Documents\flash-mvp-main\flash-mvp-copilot-merge-all-branches-for-demo\backend"
npm start
```

### Check 2: Check Terminal for Errors

Look at the terminal where you ran `npm start`:
- Are there red error messages?
- Does it say "Compiled successfully!"?
- What's the last line?

### Check 3: Check Browser

1. Open http://localhost:3000
2. Press F12 (Developer Tools)
3. Check Console tab for errors
4. Check Network tab - are requests failing?

---

## Alternative: Use Both Scripts

**Terminal 1 (Backend):**
```powershell
cd "C:\Users\craig\OneDrive\Documents\flash-mvp-main\flash-mvp-copilot-merge-all-branches-for-demo"
.\run.ps1 backend
```

**Terminal 2 (Frontend):**
```powershell
cd "C:\Users\craig\OneDrive\Documents\flash-mvp-main\flash-mvp-copilot-merge-all-branches-for-demo"
.\run.ps1 frontend
```

---

## Quick Command Reference

```powershell
# Start frontend
cd frontend
npm start

# Check if running
Test-NetConnection localhost -Port 3000

# Stop (Ctrl+C in the terminal running npm start)
```

---

## Expected Timeline

1. **0-30 seconds:** Compiling...
2. **30-60 seconds:** "Compiled successfully!"
3. **Browser:** http://localhost:3000 should work

**If it takes longer than 2 minutes, check for errors in the terminal.**


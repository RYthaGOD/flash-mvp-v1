# Start Frontend - Step by Step

## ✅ Dependencies Installed

All frontend dependencies have been installed successfully.

## 🚀 Start the Frontend Server

### IMPORTANT: Do This in a NEW Terminal Window

**You need to see the output to know if it's working!**

### Step 1: Open New PowerShell/Terminal

Keep this window visible - you need to see the compilation output.

### Step 2: Run These Commands

```powershell
# Navigate to frontend
cd "C:\Users\craig\OneDrive\Documents\flash-mvp-main\flash-mvp-copilot-merge-all-branches-for-demo\frontend"

# Start the server
npm start
```

### Step 3: Wait for Compilation

You should see:
```
Compiling...
Compiled successfully!

You can now view flash-mvp-frontend in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.x.x:3000

Note that the development build is not optimized.
To create a production build, use npm run build.
```

**⏱️ This takes 30-60 seconds on first start**

### Step 4: Open Browser

Once you see "Compiled successfully!", open:
**http://localhost:3000**

---

## What You Should See in Browser

✅ **FLASH Bridge** title  
✅ **Wallet Connect** button (top right)  
✅ **5 Tabs:** 🌉 Bridge | 🛡️ Zcash | 🔐 Privacy | 🪙 Tokens | 📜 History  
✅ **Network Status** (if backend is running)  

---

## Troubleshooting

### If You See "Compiling..." Forever

**Wait:** First compilation can take 1-2 minutes. Be patient.

**If it takes longer than 3 minutes:**
1. Check terminal for red error messages
2. Press Ctrl+C to stop
3. Check for specific errors
4. See FRONTEND_FIX.md for solutions

### If You See Compilation Errors

**Common errors:**

1. **"Cannot find module './tabs/BridgeTab'"**
   - Fix: All tab files should exist in `frontend/src/components/tabs/`

2. **"Module not found: @solana/spl-token"**
   - Fix: `npm install @solana/spl-token @coral-xyz/anchor --legacy-peer-deps`

3. **"Port 3000 already in use"**
   - Fix: Kill the process or use different port

### If Browser Shows Blank Page

1. **Press F12** to open Developer Tools
2. **Check Console tab** for JavaScript errors
3. **Check Network tab** for failed requests
4. **Share the error messages** for help

### If "Connection Refused"

**The server is not running!**

1. Make sure you ran `npm start` in the frontend directory
2. Check the terminal - is it still running?
3. Look for error messages in the terminal
4. The terminal must stay open for the server to run

---

## Quick Checklist

- [ ] Opened new terminal window
- [ ] Navigated to frontend directory
- [ ] Ran `npm start`
- [ ] Waited for "Compiled successfully!"
- [ ] Opened http://localhost:3000 in browser
- [ ] See FLASH Bridge interface

---

## Need Backend Too?

**Terminal 1 (Backend):**
```powershell
cd "C:\Users\craig\OneDrive\Documents\flash-mvp-main\flash-mvp-copilot-merge-all-branches-for-demo\backend"
npm start
```

**Terminal 2 (Frontend):**
```powershell
cd "C:\Users\craig\OneDrive\Documents\flash-mvp-main\flash-mvp-copilot-merge-all-branches-for-demo\frontend"
npm start
```

Both need to be running for full functionality!

---

## Still Not Working?

**Please share:**
1. What you see in the terminal (last 10 lines)
2. What you see in browser (screenshot if possible)
3. Browser console errors (F12 → Console tab)

This will help diagnose the specific issue!


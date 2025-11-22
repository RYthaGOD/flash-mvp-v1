# Clear Webpack Cache - Fix ESLint Errors

## Problem
ESLint is showing errors for `setWorkflowStep` even though it's been removed from the code. This is a **webpack cache issue**.

## Solution

### Option 1: Restart Dev Server (Easiest)
1. Stop the frontend dev server (Ctrl+C)
2. Restart it:
   ```powershell
   cd frontend
   npm start
   ```

### Option 2: Clear Webpack Cache
```powershell
cd frontend
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
npm start
```

### Option 3: Full Clean (If above doesn't work)
```powershell
cd frontend
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .eslintcache -ErrorAction SilentlyContinue
npm start
```

## Verification

After restarting, the errors should be gone. The file `BridgeTab.js` has been fixed:
- ✅ All `setWorkflowStep` calls removed
- ✅ Unused `wallet` variable removed from `TokenManagementTab.js`
- ✅ All ESLint warnings addressed

## If Errors Persist

1. **Check file is saved** - Make sure `BridgeTab.js` is saved in your editor
2. **Hard refresh browser** - Ctrl+Shift+R or Ctrl+F5
3. **Check for multiple files** - Ensure you're editing the correct file path

## Current File Status

✅ `BridgeTab.js` - No `setWorkflowStep` references  
✅ `TokenManagementTab.js` - No unused `wallet` variable  
✅ All other files - ESLint warnings fixed


# FLASH Bridge System Backtest Guide

**Date:** November 21, 2025  
**Purpose:** Comprehensive end-to-end testing of all system workflows

---

## Overview

The backtest suite verifies all components of the FLASH Bridge system, including:
- Backend API endpoints
- Service integrations
- Event flow
- Relayer functionality
- Privacy features
- Cross-chain workflows

---

## Prerequisites

1. **Backend Running:**
   ```bash
   cd backend
   npm start
   ```

2. **Dependencies Installed:**
   ```bash
   cd backtest
   npm install
   ```

3. **Environment Variables:**
   - Ensure `backend/.env` is properly configured
   - Backend must be accessible at `http://localhost:3001` (or set `API_URL`)

---

## Running the Backtest

### Quick Start

```bash
cd backtest
npm test
```

### With Custom API URL

```bash
API_URL=http://localhost:3001 node backtest.js
```

---

## Test Coverage

### 1. Backend Health Check ✅
- Verifies backend is running
- Checks relayer status (SOL and BTC)
- Verifies Arcium MPC status
- Checks Zcash monitoring status

### 2. Environment Variables ✅
- Validates required variables are present
- Warns about missing optional variables
- Checks configuration completeness

### 3. API Endpoint Availability ✅
- Tests all major endpoints are accessible
- Verifies HTTP status codes
- Checks endpoint responses

### 4. Bridge Info Endpoint ✅
- Verifies bridge configuration
- Checks network settings
- Validates program ID and mint address

### 5. Zcash Info Endpoint ✅
- Verifies Zcash integration
- Checks wallet status
- Validates network configuration

### 6. Arcium Status Endpoint ✅
- Verifies Arcium MPC integration
- Checks privacy features availability
- Validates encryption capabilities

### 7. Zcash Price Endpoint ✅
- Tests price fetching
- Verifies caching mechanism
- Handles rate limiting gracefully

### 8. Solana Connection ✅
- Tests Solana RPC connection
- Verifies program account exists
- Checks block height access

### 9. SOL → zenZEC Swap Endpoint ✅
- Tests swap transaction creation
- Verifies endpoint response format
- Validates transaction data

### 10. Create Burn for BTC Transaction ✅
- Tests `burn_for_btc` instruction creation
- Verifies transaction serialization
- Validates BTC address handling

### 11. BTC Address Validation ✅
- Tests address format validation
- Verifies multiple address types (Legacy, SegWit, P2SH)
- Validates error handling

### 12. Arcium Encryption Endpoints ✅
- Tests amount encryption
- Tests BTC address encryption
- Verifies privacy features

---

## Expected Results

### ✅ All Tests Pass
```
Total Tests: 12
Passed: 12
Failed: 0
```

### ⚠️ Warnings (Expected)
- Arcium encryption may be disabled (if `ENABLE_ARCIUM_MPC=false`)
- Zcash price may be rate limited (uses cache)
- Program account may not exist (if not deployed)

### ❌ Failures (Action Required)
- Backend not running → Start backend server
- Missing environment variables → Configure `.env` file
- Network issues → Check connectivity
- Invalid configuration → Review settings

---

## Workflow Testing

### Manual Workflow Tests

#### 1. SOL → zenZEC Workflow

**Steps:**
1. Start backend: `cd backend && npm start`
2. Start frontend: `cd frontend && npm start`
3. Open browser: `http://localhost:3000`
4. Connect Solana wallet (Phantom/Solflare)
5. Navigate to Bridge Tab
6. Enter SOL amount (e.g., 0.1)
7. Click "Swap SOL → zenZEC"
8. Approve transaction in wallet
9. Verify zenZEC balance increases

**Expected:**
- Transaction succeeds
- zenZEC tokens minted
- Balance updates in UI

#### 2. zenZEC → BTC Workflow

**Steps:**
1. Ensure you have zenZEC tokens
2. Navigate to Token Management Tab
3. Enter zenZEC amount
4. Enter Bitcoin address (e.g., `bc1qtq493cpzfu2frc2rumpm6225mafapmgl2q7auz`)
5. Optionally enable privacy
6. Click "Burn & Receive BTC"
7. Approve transaction in wallet
8. Check backend logs for `BurnToBTCEvent`
9. Verify BTC relayer processes event (if enabled)

**Expected:**
- Transaction succeeds
- `BurnToBTCEvent` emitted
- BTC relayer detects event (if enabled)
- BTC sent to address (if relayer enabled)

#### 3. BTC → zenZEC Workflow

**Steps:**
1. Send BTC to bridge address (from `.env`)
2. Backend monitors for payment
3. Verify BTC received
4. Backend mints zenZEC to user
5. Check zenZEC balance

**Expected:**
- BTC payment detected
- zenZEC tokens minted
- Balance updates

#### 4. ZEC → zenZEC Workflow

**Steps:**
1. Send ZEC to bridge address (from `.env`)
2. Backend verifies transaction
3. Backend mints zenZEC to user
4. Check zenZEC balance

**Expected:**
- ZEC payment verified
- zenZEC tokens minted
- Balance updates

---

## Event Flow Testing

### SOL Relayer (zenZEC → SOL)

**Test:**
1. Burn zenZEC with `swapToSol` flag
2. Monitor backend logs for `BurnSwapEvent`
3. Verify SOL relayer detects event
4. Check SOL sent to user

**Expected:**
- Event emitted correctly
- Relayer detects event
- SOL sent to user wallet

### BTC Relayer (zenZEC → BTC)

**Test:**
1. Burn zenZEC for BTC
2. Monitor backend logs for `BurnToBTCEvent`
3. Verify BTC relayer detects event
4. Check BTC sent to address

**Expected:**
- Event emitted correctly
- Relayer detects event
- BTC sent to address (if relayer enabled)

---

## Privacy Testing

### Arcium MPC Encryption

**Test:**
1. Enable Arcium MPC: `ENABLE_ARCIUM_MPC=true`
2. Test amount encryption
3. Test BTC address encryption
4. Verify encrypted data format

**Expected:**
- Encryption working
- Decryption working
- Privacy maintained

---

## Performance Testing

### Response Times

**Expected:**
- Health check: < 100ms
- Bridge info: < 200ms
- Price fetch: < 500ms (or cached)
- Transaction creation: < 1s

### Throughput

**Test:**
- Multiple concurrent requests
- Rate limiting handling
- Error recovery

---

## Error Handling Testing

### Network Errors
- Backend unreachable
- Solana RPC timeout
- External API failures

### Validation Errors
- Invalid addresses
- Invalid amounts
- Missing fields

### Business Logic Errors
- Insufficient balance
- Reserve limits
- Paused bridge

---

## Troubleshooting

### Backend Not Running
```bash
cd backend
npm start
```

### Missing Dependencies
```bash
cd backtest
npm install
```

### Environment Variables
```bash
# Check backend/.env exists
ls backend/.env

# Update if needed
cd ..
.\update-env.ps1
```

### Port Conflicts
- Backend: Change `PORT` in `backend/.env`
- Frontend: Change `PORT` in `frontend/.env` or use `PORT=3002 npm start`

---

## Test Results Interpretation

### ✅ All Green
System is fully operational and ready for use.

### ⚠️ Warnings Only
System is functional but some optional features are disabled. This is normal for MVP.

### ❌ Failures
Review error messages and fix issues before proceeding.

---

## Continuous Testing

### Automated Testing
```bash
# Run backtest on every commit
npm run test
```

### Integration with CI/CD
Add to your CI/CD pipeline:
```yaml
- name: Run Backtest
  run: |
    cd backtest
    npm install
    npm test
```

---

## Next Steps

After successful backtest:

1. **Deploy to Testnet:**
   - Update environment variables
   - Deploy Solana program
   - Test with real transactions

2. **Monitor Production:**
   - Set up monitoring
   - Configure alerts
   - Track metrics

3. **Security Audit:**
   - Review code
   - Test security features
   - Verify privacy

---

## Support

For issues or questions:
1. Check error messages in backtest output
2. Review `WIRING_REVIEW.md` for wiring issues
3. Check `TROUBLESHOOTING.md` for common problems
4. Review backend logs for detailed errors

---

**Status:** ✅ Backtest Suite Ready


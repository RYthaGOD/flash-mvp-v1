# FLASH Bridge Backtest Suite

Comprehensive end-to-end testing for the FLASH Bridge system.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Backend (Required)
```bash
cd ../backend
npm start
```

### 3. Run Backtest
```bash
npm test
```

## Test Coverage

- ✅ Backend Health Check
- ✅ Environment Variables
- ✅ API Endpoint Availability
- ✅ Bridge Info
- ✅ Zcash Integration
- ✅ Arcium MPC
- ✅ Solana Connection
- ✅ SOL → zenZEC Swap
- ✅ zenZEC → BTC Burn
- ✅ BTC Address Validation
- ✅ Privacy Encryption

## Expected Results

With backend running:
- **Passed:** 10-12 tests
- **Warnings:** 1-3 (optional features)
- **Failed:** 0-2 (if issues found)

## Troubleshooting

### Backend Not Running
```bash
# Start backend first
cd ../backend
npm start
```

### Port Conflicts
```bash
# Use custom API URL
API_URL=http://localhost:3002 npm test
```

### Missing Dependencies
```bash
npm install
```

## Documentation

See `../BACKTEST_GUIDE.md` for detailed testing instructions.


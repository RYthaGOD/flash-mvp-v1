# Arcium Testnet Deployment Checklist

## Pre-Deployment Configuration

### ✅ Step 1: Create .env Files

#### Backend
```bash
cd flash-mvp-copilot-merge-all-branches-for-demo/backend
cp .env.example .env
# Edit .env with your actual values
```

#### Frontend
```bash
cd flash-mvp-copilot-merge-all-branches-for-demo/frontend
cp .env.example .env
# Edit .env with your actual values
```

### ✅ Step 2: Critical Environment Variables

#### MUST SET (Backend):
- [ ] `FLASH_BRIDGE_MXE_PROGRAM_ID` - Your deployed flash-bridge-mxe program ID on Arcium testnet
- [ ] `RELAYER_KEYPAIR_PATH` - Path to treasury/relayer keypair (if using relayers)
- [ ] `DB_PASSWORD` - PostgreSQL password (if using database)

#### MUST SET (Frontend):
- [ ] `REACT_APP_FLASH_BRIDGE_MXE_PROGRAM_ID` - Must match backend program ID
- [ ] `REACT_APP_API_URL` - Backend API URL

#### RECOMMENDED:
- [ ] `NATIVE_ZEC_MINT` - Should be set to official ZEC mint: `A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS`
- [ ] `USE_NATIVE_ZEC=true` - Enable native ZEC (recommended)
- [ ] `ARCIUM_SIMULATED=false` - Set to false when using real Docker node
- [ ] `ARCIUM_USE_REAL_SDK=true` - Required when using Docker node
- [ ] `ARCIUM_ENDPOINT=http://localhost:8080` - Your Docker node endpoint
- [ ] `ENABLE_BTC_RELAYER=true` - Enable hybrid automation for BTC redemptions

### ✅ Step 2.5: Configure Arcium Docker Node Connection

#### Verify Docker Node is Running
```bash
# Check if node container is running
docker ps | grep arx-node

# View node logs
docker logs arx-node

# Check port mapping
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep arx-node

# Test endpoint connectivity
cd flash-mvp-copilot-merge-all-branches-for-demo/backend
node test-arcium-node-connection.js
```

#### Update .env Configuration
```env
# Set to match your Docker node port (typically 8080)
ARCIUM_ENDPOINT=http://localhost:8080
ARCIUM_SIMULATED=false
ARCIUM_USE_REAL_SDK=true
ARCIUM_NETWORK=testnet
ARCIUM_CLUSTER_ID=your_cluster_id
ARCIUM_NODE_OFFSET=your_node_offset
```

#### Common Docker Port Mappings
- **Default**: `-p 8080:8080` → Use `http://localhost:8080`
- **Custom**: `-p 9090:8080` → Use `http://localhost:9090` (host:container)
- **Network**: Use container IP or hostname if on Docker network

#### Troubleshooting
- If connection fails, verify Docker container port mapping
- Check Docker logs for node errors: `docker logs -f arx-node`
- Ensure node is active: `arcium arx-active <node-offset> --rpc-url https://api.devnet.solana.com`

### ✅ Step 3: Verify Configuration

#### Run Config Validator
```bash
cd flash-mvp-copilot-merge-all-branches-for-demo/backend
node check-testnet-config.js
```

#### Test Arcium Node Connection
```bash
# Test Docker node connectivity
node test-arcium-node-connection.js
```

#### Check Program Connection
```bash
node check-program-connection.js
```

#### Check Database Setup
```bash
node database/check-setup.js
```

### ✅ Step 4: Testnet-Specific Settings

#### Solana
- [x] `SOLANA_NETWORK=devnet` ✓
- [x] `SOLANA_RPC_URL=https://api.devnet.solana.com` ✓

#### Bitcoin
- [x] `BITCOIN_NETWORK=testnet` ✓
- [x] `BITCOIN_EXPLORER_URL=https://blockstream.info/testnet/api` ✓

#### Zcash
- [x] `ZCASH_NETWORK=testnet` ✓
- [x] `ZCASH_EXPLORER_URL=https://lightwalletd.testnet.z.cash` ✓

#### Arcium
- [x] `ARCIUM_NETWORK=testnet` ✓
- [x] `ARCIUM_SIMULATED=true` ✓ (set to false when using real MPC)

### ✅ Step 5: Treasury Setup

Before accepting deposits, ensure:

1. **Native ZEC Treasury Funded**
   - [ ] Relayer keypair is created and funded with SOL for fees
   - [ ] Treasury has native ZEC token account created
   - [ ] Treasury token account is funded with native ZEC
   - [ ] Verify balance: `node check-treasury-balance.js`

2. **Bitcoin Address Configured**
   - [ ] Bitcoin testnet address is set in `BITCOIN_BRIDGE_ADDRESS`
   - [ ] Address is monitored (if `ENABLE_BITCOIN_MONITORING=true`)

3. **Zcash Address Configured**
   - [ ] Zcash testnet address is set in `ZCASH_BRIDGE_ADDRESS`
   - [ ] Address is monitored (if using Zcash monitoring)

### ✅ Step 6: Service Verification

#### Start Backend
```bash
cd flash-mvp-copilot-merge-all-branches-for-demo/backend
npm start
```

Check for:
- [ ] No critical errors in startup logs
- [ ] Database connection successful (if using DB)
- [ ] Solana connection successful
- [ ] Program ID loads correctly
- [ ] IDL file found and loaded
- [ ] Relayer services start (if enabled)

#### Start Frontend
```bash
cd flash-mvp-copilot-merge-all-branches-for-demo/frontend
npm start
```

Check for:
- [ ] Frontend compiles without errors
- [ ] Can connect to backend API
- [ ] Wallet connection works

### ✅ Step 7: Functional Testing

#### Basic Bridge Flow
- [ ] Can deposit BTC → Get native ZEC
- [ ] Can deposit ZEC → Get native ZEC
- [ ] Can redeem native ZEC → BTC (hybrid automation)

#### Arcium MPC Features
- [ ] Can encrypt BTC address
- [ ] Can encrypt bridge amounts
- [ ] Privacy features work correctly

#### Relayer Services
- [ ] BTC relayer detects transfers
- [ ] BTC relayer processes redemptions automatically
- [ ] Event listeners are active

### ✅ Step 8: Security Checks

- [ ] `.env` files are in `.gitignore`
- [ ] No secrets committed to repository
- [ ] Keypair files are secured (not committed)
- [ ] Database passwords are strong
- [ ] API keys are testnet keys (not mainnet)

### ✅ Step 9: Monitoring Setup

- [ ] Logs directory exists
- [ ] Error logging is working
- [ ] Can view transaction history
- [ ] Can check service health endpoints

### ✅ Step 10: Documentation

- [ ] Read `ENVIRONMENT_SETUP.md` for full reference
- [ ] Read `ARCIUM_TESTNET_READINESS_REVIEW.md` for architecture review
- [ ] Read `NATIVE_ZEC_SETUP.md` for treasury setup

## Troubleshooting

### Common Issues

1. **Program ID not found**
   - Verify `FLASH_BRIDGE_MXE_PROGRAM_ID` is set correctly
   - Ensure program is deployed on Arcium testnet
   - Check IDL file exists at correct path

2. **IDL file not found**
   - Build the flash-bridge-mxe program: `cd flash-bridge-mxe && anchor build`
   - Verify IDL is at: `flash-bridge-mxe/target/idl/flash_bridge_mxe.json`

3. **Database connection fails**
   - Verify PostgreSQL is running
   - Check DB credentials in `.env`
   - Run `database/check-setup.js` to verify

4. **Relayer not working**
   - Ensure `RELAYER_KEYPAIR_PATH` points to valid keypair
   - Check keypair is funded with SOL
   - Verify `ENABLE_BTC_RELAYER=true`

5. **Native ZEC transfers fail**
   - Ensure treasury is funded with native ZEC
   - Verify `NATIVE_ZEC_MINT` is correct
   - Check treasury token account exists

## Quick Reference

### Required Variables Summary

**Backend:**
- `FLASH_BRIDGE_MXE_PROGRAM_ID` ⚠️ REQUIRED
- `RELAYER_KEYPAIR_PATH` ⚠️ Required for relayers
- `DB_PASSWORD` ⚠️ Required if using PostgreSQL

**Frontend:**
- `REACT_APP_FLASH_BRIDGE_MXE_PROGRAM_ID` ⚠️ REQUIRED
- `REACT_APP_API_URL` ⚠️ REQUIRED

### Testnet Defaults (Auto-set)

- `SOLANA_NETWORK=devnet`
- `BITCOIN_NETWORK=testnet`
- `ZCASH_NETWORK=testnet`
- `ARCIUM_SIMULATED=true`
- `NODE_ENV=development`

## Next Steps

After completing this checklist:

1. ✅ Deploy flash-bridge-mxe program to Arcium testnet
2. ✅ Update `FLASH_BRIDGE_MXE_PROGRAM_ID` in both .env files
3. ✅ Fund treasury with native ZEC
4. ✅ Start services and verify functionality
5. ✅ Run end-to-end tests
6. ✅ Monitor logs for errors

---

**Status**: Ready for testnet deployment ✅


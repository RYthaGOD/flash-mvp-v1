# Update Your .env Files

## ✅ Status
Your `.env` files already exist. Update them with the following configuration:

---

## 📝 Backend .env Updates

### Required Updates

Add or update these lines in `backend/.env`:

```env
# ============================================
# Mainnet Configuration
# ============================================
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta

# ============================================
# Bitcoin Configuration (REQUIRED - UPDATE!)
# ============================================
BITCOIN_NETWORK=mainnet
BITCOIN_BRIDGE_ADDRESS=bc1qYOUR_BITCOIN_ADDRESS_HERE
BITCOIN_EXPLORER_URL=https://blockstream.info/api
ENABLE_BITCOIN_MONITORING=true
BOOTSTRAP_BTC=0.1

# BTC to USDC Exchange Rate (UPDATE with current BTC price!)
BTC_TO_USDC_RATE=50000

# ============================================
# Jupiter DEX Configuration
# ============================================
JUPITER_PRIVACY_MODE=high
JUPITER_MIN_DELAY=2000
JUPITER_MAX_DELAY=8000

# ============================================
# Privacy & Security
# ============================================
ENABLE_ARCIUM_MPC=true
ARCIUM_SIMULATED=true
ARCIUM_ENDPOINT=http://localhost:9090
ARCIUM_PRIVACY_LEVEL=full

# ============================================
# Relayer (Optional)
# ============================================
RELAYER_KEYPAIR_PATH=backend/relayer-keypair-new.json
ENABLE_RELAYER=false
ENABLE_BTC_RELAYER=false
```

### Optional (Remove if not needed)

You can remove or comment out:
```env
# ZENZEC_MINT=...  # Not needed - using USDC treasury
# PROGRAM_ID=...    # Optional - not needed for BTC deposit flow
```

---

## 📝 Frontend .env Updates

Ensure `frontend/.env` has:

```env
REACT_APP_API_URL=http://localhost:3001
```

---

## 🔧 Quick Update Commands

### PowerShell (Windows)

```powershell
# View current backend .env
Get-Content backend\.env

# Edit backend .env (opens in default editor)
notepad backend\.env

# View frontend .env
Get-Content frontend\.env
```

### Manual Update Checklist

- [ ] Update `BITCOIN_BRIDGE_ADDRESS` with your Bitcoin address
- [ ] Update `BTC_TO_USDC_RATE` with current BTC price (e.g., 50000 for $50k)
- [ ] Set `SOLANA_NETWORK=mainnet-beta`
- [ ] Set `SOLANA_RPC_URL=https://api.mainnet-beta.solana.com`
- [ ] Set `ENABLE_BITCOIN_MONITORING=true`
- [ ] Verify `ENABLE_ARCIUM_MPC=true`

---

## ✅ Verification

After updating, verify configuration:

```powershell
cd backend
node check-config.js
```

Expected output should show:
- ✅ Bitcoin bridge address configured
- ✅ BTC monitoring enabled
- ✅ Solana mainnet configured
- ⚠️  ZENZEC_MINT not configured (this is OK - not needed)

---

## 📋 Complete Example

Here's what your `backend/.env` should look like:

```env
PORT=3001
NODE_ENV=production

SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta

BITCOIN_NETWORK=mainnet
BITCOIN_BRIDGE_ADDRESS=bc1qyour_actual_bitcoin_address_here
BITCOIN_EXPLORER_URL=https://blockstream.info/api
ENABLE_BITCOIN_MONITORING=true
BTC_TO_USDC_RATE=50000

JUPITER_PRIVACY_MODE=high
JUPITER_MIN_DELAY=2000
JUPITER_MAX_DELAY=8000

ENABLE_ARCIUM_MPC=true
ARCIUM_SIMULATED=true

RELAYER_KEYPAIR_PATH=backend/relayer-keypair-new.json
ENABLE_RELAYER=false
```

---

## 🚀 Next Steps

1. ✅ Update `BITCOIN_BRIDGE_ADDRESS` with your Bitcoin address
2. ✅ Update `BTC_TO_USDC_RATE` with current BTC price
3. ✅ Verify treasury has USDC balance (`treasury-keypair.json`)
4. ✅ Run `node check-config.js` to verify
5. ✅ Start backend: `npm start`

---

## 📚 Reference

- See `BTC_DEPOSIT_ARCHITECTURE.md` for architecture details
- See `ENV_SETUP_COMPLETE.md` for complete setup guide
- See `.env.template` files for reference templates


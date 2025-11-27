# 🚀 Quick Start Guide - FLASH Bridge MVP

## 1. Setup Backend (2 minutes)

### Create `.env` file
```bash
cd backend
cat > .env << 'EOF'
ENABLE_ARCIUM_MPC=true
SOLANA_RPC_URL=http://127.0.0.1:8899
DATABASE_PATH=./database/flash-bridge.db
EOF
```

### Install & Start
```bash
npm install
npm start
```

**Expected output:**
```
✅ Arcium MPC Privacy: ENABLED (Simulated for MVP)
✅ Full Privacy Mode: ACTIVE
Server running on port 3001
```

---

## 2. Setup Frontend (1 minute)

```bash
cd frontend
npm install
npm start
```

**Opens:** http://localhost:3000

---

## 3. Start Solana (Optional - for real transactions)

```bash
solana-test-validator --reset
```

**Without Solana:** System works in demo mode with mock transactions

---

## 🎯 What You Get

### ✅ Working Features
- 🔒 **Full Privacy UI** - Always-on privacy badges
- 💰 **BTC → zenZEC Bridge** - With ZEC shielding
- 🔄 **SOL ↔ zenZEC Swap** - Encrypted amounts
- 💳 **Token Management** - Burn & receive BTC
- 📊 **Transaction History** - With privacy indicators
- 🎨 **Beautiful UI** - Modern, responsive design

### 🔒 Privacy Features (All Active)
- ✅ Arcium MPC encryption (simulated)
- ✅ ZEC privacy layer
- ✅ Encrypted amounts
- ✅ Encrypted BTC addresses
- ✅ Private verification

---

## 🧪 Demo Scenarios

### Scenario 1: Bridge BTC → zenZEC
1. Click **"Bridge"** tab
2. Enter amount (e.g., 0.1)
3. Leave TX hash empty (uses demo mode)
4. Click **"Bridge & Mint"**
5. ✅ See privacy badge & encrypted confirmation

### Scenario 2: Swap SOL → zenZEC
1. Connect wallet (Phantom/Solflare)
2. Click **"Bridge"** tab, scroll to swap section
3. Enter SOL amount (e.g., 0.5)
4. Click **"Swap SOL → zenZEC"**
5. ✅ See encrypted transaction

### Scenario 3: Burn zenZEC → BTC
1. Click **"Manage Tokens"** tab
2. Enter zenZEC amount
3. Enter BTC address (any testnet address)
4. Click **"Burn & Receive BTC"**
5. ✅ See BTC address encrypted

---

## ⚡ Troubleshooting

### ❌ "Arcium MPC must be enabled"
**Fix:** Add `ENABLE_ARCIUM_MPC=true` to `.env`

### ❌ "Port 3001 in use"
**Fix:** `PORT=3002 npm start` or kill existing process

### ❌ Wallet won't connect
**Fix:** Install Phantom wallet extension

### ❌ "Database not available"
**Fix:** Create `backend/database/` directory

---

## 📁 Project Structure

```
flash-mvp-main/
├── backend/
│   ├── .env                    ← CREATE THIS!
│   ├── src/
│   │   ├── services/
│   │   │   ├── arcium.js      ← Privacy (simulated)
│   │   │   ├── solana.js      ← Solana integration
│   │   │   └── relayer.js     ← Auto SOL sender
│   │   └── routes/
│   │       └── bridge.js      ← API endpoints
│   └── database/               ← Auto-created
├── frontend/
│   └── src/
│       └── components/         ← UI with privacy badges
└── ENV_SETUP.md               ← Full config guide
```

---

## 🎓 Understanding MVP Privacy

### What's Real?
- ✅ Privacy UX/UI
- ✅ Privacy indicators
- ✅ Encryption flow logic
- ✅ Always-on enforcement

### What's Simulated?
- 🎭 Arcium MPC (uses base64 mock)
- 🎭 BTC/ZEC transactions (demo mode)

### Production Ready?
- 🚀 **UI/UX:** Yes
- 🚀 **Architecture:** Yes
- 🚀 **Privacy logic:** Yes
- ⏳ **Real MPC:** Needs Arcium network
- ⏳ **Real crypto:** Needs mainnet setup

---

## 🎯 Next Steps

### For Demo/Presentation:
✅ **You're ready!** Just follow scenarios above

### For Development:
1. Set up real Solana validator
2. Create zenZEC mint
3. Configure relayer keypair
4. Test with real wallets

### For Production:
1. Deploy real Arcium MPC network
2. Use mainnet RPC endpoints
3. Configure real BTC/ZEC services
4. Set up monitoring & alerts

---

## 💡 Key Selling Points

✨ **Privacy isn't optional** - It's always on  
✨ **Zero user confusion** - No privacy toggles  
✨ **Beautiful UX** - Clear privacy indicators  
✨ **Production-ready architecture** - Just swap mock for real MPC  
✨ **Institutional-grade** - Privacy by design  

---

## 📞 Support

- **Setup issues:** See `ENV_SETUP.md`
- **Privacy details:** See `ARCIUM_INTEGRATION.md`
- **Architecture:** See `PRIVACY_FEATURES.md`

**Ready to demo!** 🎉

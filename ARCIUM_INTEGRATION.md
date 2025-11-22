# Arcium MPC Integration - Full Privacy

## Overview

The FLASH bridge now integrates **Arcium's Multi-Party Computation (MPC)** network to provide **full transaction privacy**. All sensitive data (amounts, balances, verification) is encrypted and processed without revealing values to any single party.

## What is Arcium?

Arcium is a confidential computing network for Solana that enables:
- **Multi-Party Computation (MPC)**: Distribute computation across multiple nodes
- **Encrypted Computation**: Process encrypted data without decryption  
- **Trustless Randomness**: Generate random numbers no party can predict
- **Privacy-Preserving Verification**: Verify transactions without revealing amounts

## Privacy Features Enabled

### 1. 🔒 Encrypted Bridge Amounts
**Before:** Bridge amounts visible on-chain  
**After:** Amounts encrypted via MPC, only parties with keys can decrypt

```javascript
// Frontend encrypts amount
const encrypted = await arciumClient.encryptAmount(1.5, recipientPubkey);

// Backend processes encrypted amount
const tx = await arciumService.createEncryptedBridgeTx(
  solanaAddress,
  encrypted,
  swapToSol
);
```

### 2. 🔐 Private Transaction Verification
**Before:** Zcash amounts revealed during verification  
**After:** Verify transactions match without exposing actual values

```javascript
// Private verification via MPC
const verification = await arciumService.privateVerifyZcashTx(
  txHash,
  encryptedExpectedAmount
);
// Result: verified=true, but amounts never revealed
```

### 3. 🎲 Trustless Random Relayer Selection
**Before:** Centralized or predictable relayer selection  
**After:** Provably fair random selection via distributed entropy

```javascript
// Each MPC node contributes entropy
// No single node can predict or influence outcome
const relayer = await arciumService.selectConfidentialRelayer(relayerAddresses);
```

### 4. 🧮 Encrypted Swap Calculations
**Before:** SOL swap amounts calculated in plaintext  
**After:** Calculate on encrypted values, reveal only final result

```javascript
// Calculate swap amount on encrypted zenZEC balance
const encryptedSOL = await arciumService.calculateEncryptedSwapAmount(
  encryptedZenZEC,
  exchangeRate
);
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ARCIUM MPC LAYER                          │
│                  (Privacy & Encryption)                      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────┬────────────────┬────────────────┐
│   MPC Node 1    │   MPC Node 2   │   MPC Node N   │
│  (Secret Share) │ (Secret Share) │ (Secret Share) │
└─────────────────┴────────────────┴────────────────┘
         ↓                 ↓                ↓
┌──────────────────────────────────────────────────────┐
│           Encrypted Computation Results              │
│  • Amounts never revealed to single party           │
│  • Random numbers provably unpredictable            │
│  • Verifications without exposing data              │
└──────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────┐
│              FLASH Bridge (Enhanced)                 │
│  • Private bridge transactions                       │
│  • Confidential relayer selection                   │
│  • Encrypted balance tracking                       │
└──────────────────────────────────────────────────────┘
```

## API Endpoints

### GET /api/arcium/status
Get Arcium MPC network status

**Response:**
```json
{
  "success": true,
  "enabled": true,
  "connected": true,
  "endpoint": "http://localhost:9090",
  "features": {
    "encryptedAmounts": true,
    "privateVerification": true,
    "trustlessRandom": true,
    "confidentialRelayer": true
  }
}
```

### POST /api/arcium/encrypt-amount
Encrypt an amount using MPC

**Request:**
```json
{
  "amount": 1.5,
  "recipientPubkey": "7xKXtg2CW87d..."
}
```

**Response:**
```json
{
  "success": true,
  "encrypted": {
    "encrypted": true,
    "ciphertext": "...",
    "pubkey": "7xKXtg2CW87d...",
    "nonce": 1699876543
  }
}
```

### POST /api/arcium/bridge/private
Create fully private bridge transaction

**Request:**
```json
{
  "solanaAddress": "7xKXtg2CW87d...",
  "amount": 1.5,
  "swapToSol": false,
  "useEncryption": true
}
```

**Response:**
```json
{
  "success": true,
  "transaction": {
    "encrypted": true,
    "txId": "encrypted_tx_...",
    "privacy": "full"
  }
}
```

### POST /api/arcium/random
Generate trustless random number

**Request:**
```json
{
  "max": 10
}
```

**Response:**
```json
{
  "success": true,
  "random": 7,
  "trustless": true
}
```

### POST /api/arcium/verify-zcash-private
Privately verify Zcash transaction

**Request:**
```json
{
  "txHash": "a1b2c3d4...",
  "encryptedExpectedAmount": {...}
}
```

**Response:**
```json
{
  "success": true,
  "verification": {
    "verified": true,
    "private": true,
    "computationId": "verify_zcash_..."
  }
}
```

## Configuration

### Backend (.env)
```env
# Enable Arcium MPC for full privacy
ENABLE_ARCIUM_MPC=true

# Arcium network endpoint
ARCIUM_ENDPOINT=http://localhost:9090

# Privacy level: basic, enhanced, full
ARCIUM_PRIVACY_LEVEL=full
```

### Frontend
Arcium is automatically initialized when backend MPC is enabled.

```javascript
import arciumClient from './utils/arcium';

// Initialize
await arciumClient.initialize();

// Check if available
if (arciumClient.isAvailable()) {
  console.log('Full privacy mode enabled');
}

// Use private bridge
const result = await arciumClient.createPrivateBridgeTx(
  address,
  amount,
  swap,
  true  // useEncryption
);
```

## Setup Instructions

### 1. Install Arcium CLI

```bash
# Install Arcium CLI (requires Rust)
cargo install arcium-cli

# Verify installation
arcium --version
```

### 2. Start Arcium Localnet

```bash
# Start local MPC network with 2 nodes
arcium localnet start

# Check status
arcium localnet status
```

### 3. Configure Backend

```bash
cd backend
cp .env.example .env

# Edit .env
echo "ENABLE_ARCIUM_MPC=true" >> .env
echo "ARCIUM_ENDPOINT=http://localhost:9090" >> .env
```

### 4. Start Services

```bash
# Terminal 1: Solana validator
solana-test-validator --reset

# Terminal 2: Arcium localnet
arcium localnet start

# Terminal 3: Backend
cd backend && npm start

# Terminal 4: Frontend
cd frontend && npm start
```

## Privacy Benefits

### Without Arcium (Basic)
- ❌ Bridge amounts visible on-chain
- ❌ Anyone can see transaction values
- ❌ Centralized relayer selection
- ❌ Swap calculations public
- ⚠️ Privacy limited to Zcash shielding only

### With Arcium (Full Privacy)
- ✅ All amounts encrypted end-to-end
- ✅ Zero-knowledge verification
- ✅ Trustless random selection
- ✅ Private calculations on encrypted data
- ✅ Enhanced privacy across entire bridge flow

## Use Cases

### 1. High-Value Transfers
Large bridge transactions remain confidential, preventing front-running or targeting.

### 2. Private Trading
Bridge and swap without revealing trade sizes to competitors.

### 3. Institutional Privacy
Maintain confidentiality of institutional bridge operations.

### 4. Regulatory Compliance
Selective disclosure: Prove compliance without public exposure.

## Security Considerations

### Arcium MPC Security
- ✅ No single point of failure
- ✅ Threshold security (multiple nodes must collude)
- ✅ Cryptographic guarantees
- ✅ Audited MPC protocols

### Integration Security
- ⚠️ Requires secure key management
- ⚠️ Network security (MPC nodes)
- ⚠️ Proper nonce handling
- ⚠️ Computation verification

## Performance

### With MPC Enabled
- **Latency**: +100-500ms per encrypted operation
- **Throughput**: Depends on MPC network size
- **Trade-off**: Privacy vs Speed (configurable)

### Optimization
- Cache computation results
- Batch operations when possible
- Use appropriate privacy level per operation
- Async computation for non-critical paths

## Testing

### Unit Tests
```bash
cd backend
npm test -- arcium.test.js
```

### Integration Tests
```bash
# Start localnet
arcium localnet start

# Run integration tests
npm run test:integration
```

### Privacy Verification
```bash
# Verify amounts are encrypted
curl http://localhost:3001/api/arcium/status

# Test private transaction
curl -X POST http://localhost:3001/api/arcium/bridge/private \
  -H "Content-Type: application/json" \
  -d '{"solanaAddress":"...","amount":1.5,"useEncryption":true}'
```

## Troubleshooting

### MPC Not Connecting
```bash
# Check Arcium localnet status
arcium localnet status

# Restart localnet
arcium localnet stop
arcium localnet start
```

### Encryption Failures
- Verify ENABLE_ARCIUM_MPC=true in .env
- Check ARCIUM_ENDPOINT is correct
- Ensure MPC network is running

### Performance Issues
- Reduce number of encrypted operations
- Use basic privacy for non-sensitive data
- Increase MPC node count for better throughput

## Migration Guide

### Existing Bridge Users
1. Update backend .env with Arcium config
2. Restart backend server
3. Frontend automatically detects MPC availability
4. Users can opt-in to private transactions

### Gradual Rollout
```javascript
// Allow users to choose privacy level
if (userWantsPrivacy && arciumClient.isAvailable()) {
  await arciumClient.createPrivateBridgeTx(...);
} else {
  await regularBridge(...);
}
```

## Future Enhancements

- [ ] Distributed key generation (DKG)
- [ ] Multi-chain MPC coordination
- [ ] Hardware security module (HSM) integration
- [ ] Advanced ZK proof integration
- [ ] Decentralized MPC network
- [ ] Privacy-preserving analytics

## Resources

- [Arcium Documentation](https://docs.arcium.com/)
- [Arcium GitHub](https://github.com/arcium-hq/)
- [MPC Explainer](https://en.wikipedia.org/wiki/Secure_multi-party_computation)
- [FLASH Bridge Docs](./README.md)

---

**Status**: Integrated and ready for testing  
**Privacy Level**: Full (with MPC enabled)  
**Version**: 1.0.0

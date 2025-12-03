# FLASH Bridge MXE - Custom Privacy Operations

**Custom Multi-Party Computation (MPC) eXecution Environment for FLASH Bridge**

This MXE implements bridge-specific privacy operations using Arcium's MPC framework. Built following the [Arcium Hello World documentation](https://docs.arcium.com/developers/hello-world), this demonstrates FLASH Bridge's readiness for real MPC integration.

## 🎯 **What This MXE Does**

FLASH Bridge requires **custom privacy operations** that aren't available in generic MPC services:

- ✅ **Bridge Amount Encryption** - Encrypt cross-chain transfer amounts
- ✅ **Private Transaction Verification** - Verify deposits without revealing amounts
- ✅ **Encrypted Swap Calculations** - Calculate exchange rates on encrypted values
- ✅ **BTC Address Privacy** - Hide withdrawal addresses from relayers
- ✅ **Institutional Proofs** - Generate cryptographic proofs for compliance

## 🏗️ **Architecture Overview**

```
flash-bridge-mxe/
├── Arcium.toml                    # MXE configuration
├── programs/src/lib.rs           # Solana program with #[arcium_program]
├── encrypted-ixs/                # MPC computations using Arcis
│   └── bridge_privacy.rs         # Bridge-specific encrypted instructions
└── tests/                        # TypeScript tests with @arcium-hq/client
    └── bridge-privacy.ts
```

## 🔐 **Encrypted Instructions (MPC Operations)**

### `encrypt_bridge_amount`
Encrypts bridge transaction amounts for privacy-preserving transfers.

```rust
#[instruction]
pub fn encrypt_bridge_amount(
    input_ctxt: Enc<Shared, BridgeAmount>
) -> Enc<Shared, EncryptedBridgeTx>
```

**Privacy Benefits:**
- Amounts hidden from blockchain observers
- Only sender/receiver can decrypt
- MPC ensures no single party sees plaintext

### `verify_bridge_transaction`
Verifies deposit transactions without revealing amounts.

```rust
#[instruction]
pub fn verify_bridge_transaction(
    verification_data: Enc<Mxe, BridgeVerification>
) -> Enc<Shared, bool>
```

**Privacy Benefits:**
- Compares encrypted expected vs actual amounts
- Returns boolean result without revealing values
- Perfect for institutional compliance

### `calculate_swap_amount`
Performs exchange rate calculations on encrypted values.

```rust
#[instruction]
pub fn calculate_swap_amount(
    swap_data: Enc<Shared, SwapCalculation>
) -> Enc<Shared, u64>
```

**Privacy Benefits:**
- ZEC amount stays encrypted during SOL calculation
- Prevents front-running and MEV attacks
- Trustless price calculations

### `encrypt_btc_address`
Hides Bitcoin withdrawal addresses from relayers.

```rust
#[instruction]
pub fn encrypt_btc_address(
    btc_data: Enc<Shared, BTCAddress>
) -> Enc<Shared, Vec<u8>>
```

**Privacy Benefits:**
- Relayers process transactions without seeing addresses
- Prevents address tracking and correlation
- Essential for regulatory compliance

## 🚀 **Building & Testing**

### 🐧 WSL Quickstart
You can build and deploy the MXE entirely from Windows Subsystem for Linux (Ubuntu). Run the helper script once inside WSL to install every dependency:

```bash
# From the repo root (mounted under /mnt/c/Users/...)
chmod +x arcium-node-setup/setup-wsl.sh
./arcium-node-setup/setup-wsl.sh

# Reload shell paths for the current session
source ~/.cargo/env
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

After the bootstrap script finishes:

1. Verify toolchain versions
   ```bash
   rustc --version
   cargo --version
   anchor --version
   solana --version
   ```
2. Set your Solana config inside WSL (matches Windows config but is independent):
   ```bash
   solana config set --url https://api.devnet.solana.com
   solana config set --keypair /home/<you>/keys/flash-bridge-upgrade.json
   ```
3. Work from the repo mounted at `/mnt/c/Users/craig/OneDrive/Documents/flash-mvp-main`.

> **Tip:** If you already have the toolchain installed on Windows, keep using the same keypair files by pointing to `/mnt/c/Users/.../upgrade-keypair.json` from WSL. Solana/Anchor read them just fine.

### Prerequisites
```bash
# Install Arcium CLI (when available)
npm install -g @arcium-hq/cli

# Install dependencies
npm install
```

### Build MXE
```bash
# Build encrypted instructions and Solana program
arcium build

# Alternative: Use Anchor for Solana parts
anchor build
```

### Run Tests
```bash
# Test with local Arcium cluster
arcium test

# Alternative: Use Anchor test
anchor test
```

### Local Development
```bash
# Start local Solana validator
solana-test-validator

# Start local Arcium cluster (when available)
arcium localnet

# Run tests
npm test
```

## 🌐 **Deployment**

### Devnet Deployment
```bash
# Deploy to Solana devnet
arcium deploy --network devnet

# Initialize computation definitions
# (Scripts would be provided by Arcium)
```

### WSL Deployment Checklist
Use these commands from within your WSL session to rebuild and redeploy the program after making source changes:

```bash
# 1. Ensure you are in the MXE directory
cd /mnt/c/Users/craig/OneDrive/Documents/flash-mvp-main/flash-mvp-copilot-merge-all-branches-for-demo/flash-bridge-mxe

# 2. Build the updated binary
anchor build

# 3. Fund your upgrade authority (devnet example)
solana balance
solana airdrop 2

# 4. Deploy/upgrade the program
anchor deploy --provider.cluster devnet
# or: solana program deploy target/deploy/flash_bridge_mxe.so --program-id target/deploy/flash_bridge_mxe-keypair.json

# 5. Distribute the new IDL to downstream services
cp target/idl/flash_bridge_mxe.json <wherever your backend expects it>
```

All build artifacts land under the WSL path above and are immediately accessible from Windows because both environments share the same working tree.

### Production Deployment
```bash
# Deploy to mainnet
arcium deploy --network mainnet-beta

# Get API key from Arcium after deployment
# Update FLASH Bridge configuration
```

## 🔑 **API Key Request**

This MXE project demonstrates FLASH Bridge's **serious commitment** to MPC integration. To get an Arcium API key:

1. **Show this MXE implementation** to Arcium team
2. **Deploy to their testnet** using their tools
3. **Request production API access** for custom operations
4. **Integrate with FLASH Bridge** using real MPC

## 📊 **Privacy Comparison**

| Feature | Current Simulation | Custom MXE (This) | Generic MPC SDK |
|---------|-------------------|-------------------|------------------|
| Bridge-Specific Ops | ❌ | ✅ | ❌ |
| Amount Encryption | AES-256 | Real MPC | Generic |
| Private Verification | Mock | Real MPC | Generic |
| Address Privacy | AES-256 | Real MPC | Generic |
| Institutional Proofs | Simulated | Real MPC | Limited |
| Front-running Protection | ❌ | ✅ | Partial |
| Regulatory Compliance | Simulated | ✅ | Limited |

## 🧪 **Test Coverage**

### Bridge Amount Encryption
- ✅ Basic encryption/decryption
- ✅ Multi-chain support (ZEC→SOL, BTC→SOL)
- ✅ Privacy guarantees validation
- ✅ Institutional proof generation

### Transaction Verification
- ✅ Encrypted amount comparison
- ✅ Cross-chain verification (ZEC, BTC)
- ✅ Private result validation
- ✅ Error handling

### Swap Calculations
- ✅ Encrypted arithmetic operations
- ✅ Slippage protection
- ✅ Exchange rate privacy
- ✅ Front-running prevention

### BTC Address Privacy
- ✅ Address encryption
- ✅ Relayer isolation
- ✅ Withdrawal privacy
- ✅ Compliance validation

## 🔗 **Integration with FLASH Bridge**

Once you have the Arcium API key, update the main FLASH Bridge:

```typescript
// In backend/src/services/arcium.js
const arciumClient = new ArciumClient({
  network: 'mainnet-beta',
  apiKey: process.env.ARCIUM_API_KEY, // ← Your API key here
  endpoint: 'https://api.arcium.com'
});

// Use custom MXE operations
await arciumClient.callEncryptedInstruction({
  programId: 'FLASH_BRIDGE_MXE_PROGRAM_ID',
  instruction: 'encrypt_bridge_amount',
  // ... bridge data
});
```

## 📈 **Business Value**

### For FLASH Bridge
- **Real Privacy**: Not just "privacy claims" but actual MPC guarantees
- **Institutional Trust**: Cryptographic proofs for compliance
- **Competitive Edge**: Unique privacy features in DeFi space
- **Future-Proof**: Ready for advanced MPC features

### For Arcium Partnership
- **Serious Developer**: Complete MXE implementation ready for deployment
- **Production Intent**: Custom operations designed for real use cases
- **Community Value**: Will drive adoption of Arcium technology
- **Long-term Partner**: Committed to MPC ecosystem

## 🎯 **Next Steps**

1. **Contact Arcium**: Show them this MXE implementation
2. **Get API Access**: Request keys for devnet/mainnet deployment
3. **Deploy MXE**: Launch custom operations on their network
4. **Integrate**: Connect FLASH Bridge to real MPC operations
5. **Launch**: First bridge with institutional-grade MPC privacy

## 📞 **Contact**

**FLASH Bridge Team**
- Show this MXE to Arcium for API key access
- Ready to deploy and integrate immediately
- Serious commitment to MPC adoption

---

*Built with ❤️ using Arcium's MPC framework for institutional-grade privacy in cross-chain bridging.*

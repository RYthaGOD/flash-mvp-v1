# Arcium MXE Development Configuration Guide

⚠️ **UPDATED**: Based on official Arcium documentation, FLASH Bridge will use **custom MXE development** rather than SDK consumption.

## Current Status: Enhanced Simulation Mode

FLASH Bridge currently uses **enhanced simulation** for all MPC operations. This provides:
- ✅ Privacy feature demonstrations
- ✅ Full bridge functionality testing
- ✅ No API keys required
- ✅ Works for institutional demos

## Future: Custom MXE Development

When ready for production, we'll build a **custom MXE program** specifically for FLASH Bridge privacy operations.

### MXE Development Requirements

```bash
# Arcium CLI (for building custom MXEs)
npm install -g @arcium-hq/cli  # Install Arcium development tools

# Create custom MXE project
arcium init flash-bridge-mxe

# Build and test
arcium build
arcium test
```

### Custom MXE Structure
```
flash-bridge-mxe/
├── Arcium.toml                    # MXE configuration
├── programs/                      # Solana programs with #[arcium_program]
│   └── src/lib.rs
├── encrypted-ixs/                 # MPC computations using Arcis
│   └── bridge_privacy.rs
└── tests/                         # TypeScript tests with @arcium-hq/client
    └── bridge-privacy.ts
```

### Encrypted Instructions (Arcis)
```rust
#[encrypted]
mod bridge_circuits {
    use arcis_imports::*;

    #[instruction]
    pub fn encrypt_bridge_amount(
        input: Enc<Shared, BridgeAmount>
    ) -> Enc<Shared, EncryptedBridgeTx> {
        // Custom MPC logic for bridge privacy
    }
}
```

## Environment Configuration (Current)

```bash
# Core Arcium Settings (Simulation Mode)
ENABLE_ARCIUM_MPC=true
ARCIUM_SIMULATED=true              # Enhanced simulation (current)
ARCIUM_USE_REAL_SDK=false          # Will change to MXE in future
ARCIUM_PRIVACY_LEVEL=maximum

# Legacy settings (will be replaced by MXE)
ARCIUM_ENDPOINT=http://localhost:9090
ARCIUM_NETWORK=testnet
ARCIUM_COMPUTATION_TIMEOUT=30000
```

## Migration Path to Real MPC

### Phase 1: MXE Development (Development)
```bash
# Build custom MXE for FLASH Bridge
arcium init flash-bridge-mxe
# Implement bridge-specific encrypted instructions
# Test with local Arcium cluster
```

### Phase 2: API Key & Deployment (Production)
```bash
# Deploy MXE to Arcium network
arcium deploy

# Get API key from Arcium for your deployed MXE
ARCIUM_API_KEY=your_mxe_api_key

# Update FLASH Bridge to use custom MXE
ARCIUM_USE_REAL_SDK=true  # Now means "use our custom MXE"
```

## Important Notes

1. **Custom MXE Required**: Arcium's approach requires building custom MPC programs, not just using SDKs.

2. **API Key Timeline**: You'll get the API key **after** building and deploying your custom MXE to their network.

3. **Current Simulation**: Perfect for demos, presentations, and showing institutional-grade privacy features.

4. **Development Effort**: Building a production MXE requires Rust/Anchor expertise and MPC knowledge.

5. **Competitive Advantage**: Custom MXE allows bridge-specific privacy optimizations not available in generic MPC services.

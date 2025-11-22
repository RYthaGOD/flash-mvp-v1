# Zenz Bridge - Solana Program

This is the on-chain Solana program for the FLASH BTC→ZEC→Solana bridge.

## Features

- **Mint zenZEC**: Mint wrapped ZEC tokens on Solana
- **Burn zenZEC**: Burn tokens from user accounts
- **Burn and Emit**: Burn tokens and emit events for relayer
- **Admin Controls**: Pause mechanism and minting limits
- **Arcium Integration** (Optional): Privacy features via MPC

## Building

### Prerequisites

- Rust 1.70.0 or later
- Solana CLI 1.18.0 or later
- Anchor CLI 0.32.1 (optional, for anchor build)

### Build with Cargo

```bash
# Build without Arcium (default)
cargo build --manifest-path programs/zenz_bridge/Cargo.toml --release

# Build with Arcium MPC privacy features
cargo build --manifest-path programs/zenz_bridge/Cargo.toml --features arcium --release
```

### Build with Anchor

```bash
# From project root
anchor build
```

## Known Warnings

You may see warnings about `anchor-debug` feature not being recognized. These are harmless and don't affect compilation. They come from Anchor's derive macros checking for debug features.

## Dependencies

- **anchor-lang**: 0.32.1
- **anchor-spl**: 0.32.1
- **arcium-anchor**: 0.4.0 (optional)

## Program Features

### Default Features
- `no-entrypoint`: For CPI usage
- `no-idl`: Skip IDL generation
- `no-log-ix-name`: Skip instruction name logging
- `cpi`: Enable CPI (requires no-entrypoint)

### Optional Features
- `arcium`: Enable Arcium MPC privacy features

## Testing

Tests require a local Solana validator. To run:

```bash
# Start local validator
solana-test-validator

# Run tests
anchor test
```

## Deployment

### Localnet
```bash
anchor deploy
```

### Devnet
```bash
anchor deploy --provider.cluster devnet
```

## Program ID

Localnet: `Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS`

## License

MIT

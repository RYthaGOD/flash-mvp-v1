# Zecwallet-light-cli Integration Guide

## Overview

The FLASH bridge now supports integration with `zecwallet-light-cli` for programmatic Zcash wallet management. This enables automatic address generation, transaction monitoring, and wallet operations.

## What is zecwallet-light-cli?

[zecwallet-light-cli](https://github.com/adityapk00/zecwallet-light-cli) is a command-line Zcash light client that:
- Connects to lightwalletd servers (no full node required)
- Manages shielded Zcash addresses
- Sends and receives ZEC transactions
- Provides programmatic access via CLI commands

## Installation

### Step 1: Download zecwallet-light-cli

Download the latest binary from the [releases page](https://github.com/adityapk00/zecwallet-light-cli/releases):

**For Linux:**
```bash
wget https://github.com/adityapk00/zecwallet-light-cli/releases/download/vX.X.X/zecwallet-cli-linux
chmod +x zecwallet-cli-linux
sudo mv zecwallet-cli-linux /usr/local/bin/zecwallet-cli
```

**For macOS:**
```bash
wget https://github.com/adityapk00/zecwallet-light-cli/releases/download/vX.X.X/zecwallet-cli-macos
chmod +x zecwallet-cli-macos
sudo mv zecwallet-cli-macos /usr/local/bin/zecwallet-cli
```

**For Windows:**
- Download `zecwallet-cli-windows.exe`
- Place in a directory in your PATH
- Or specify full path in `ZECWALLET_CLI_PATH`

### Step 2: Configure Environment Variables

Add to `backend/.env`:

```env
# Enable zecwallet-light-cli integration
USE_ZECWALLET_CLI=true

# Path to zecwallet-cli binary (if not in PATH)
ZECWALLET_CLI_PATH=zecwallet-cli

# Wallet data directory (default: ~/.zcash)
ZCASH_WALLET_DIR=~/.zcash

# Lightwalletd server (default: public ChainSafe server)
ZCASH_LIGHTWALLETD_URL=https://zcash-mainnet.chainsafe.dev

# Network
ZCASH_NETWORK=mainnet
```

### Step 3: Initialize Wallet

The wallet will be automatically initialized on first use. Alternatively, you can initialize manually:

```bash
# Create new wallet
zecwallet-cli --server https://zcash-mainnet.chainsafe.dev addresses

# Or restore from seed phrase
zecwallet-cli --server https://zcash-mainnet.chainsafe.dev --seed "your 24 word seed phrase"
```

## Features

### 1. Automatic Address Generation

When `USE_ZECWALLET_CLI=true`, the bridge automatically generates a shielded address:

```javascript
// Backend automatically gets address from wallet
GET /api/zcash/bridge-address
// Returns: { address: "zs1...", source: "wallet" }
```

### 2. Wallet Balance

Check wallet balance:

```javascript
GET /api/zcash/balance
// Returns: { total: 1.5, confirmed: 1.5, unconfirmed: 0 }
```

### 3. Wallet Status

Get comprehensive wallet status:

```javascript
GET /api/zcash/wallet-status
// Returns: { initialized: true, walletExists: true, balance: 1.5, ... }
```

### 4. Transaction Monitoring

The wallet can monitor for incoming transactions (future enhancement).

## API Endpoints

### New Endpoints

- `GET /api/zcash/balance` - Get wallet balance
- `GET /api/zcash/wallet-status` - Get wallet status

### Enhanced Endpoints

- `GET /api/zcash/info` - Now includes wallet information
- `GET /api/zcash/bridge-address` - Now auto-generates from wallet if enabled

## Usage Examples

### Enable Wallet Integration

```env
USE_ZECWALLET_CLI=true
```

### Get Bridge Address (Auto-generated)

```bash
curl http://localhost:3001/api/zcash/bridge-address
```

Response:
```json
{
  "success": true,
  "address": "zs1abc123...",
  "network": "mainnet",
  "source": "wallet"
}
```

### Check Balance

```bash
curl http://localhost:3001/api/zcash/balance
```

Response:
```json
{
  "success": true,
  "total": 1.5,
  "confirmed": 1.5,
  "unconfirmed": 0
}
```

## Security Considerations

### Wallet File Location

- **Default:** `~/.zcash/zecwallet-light-wallet.dat`
- **Contains:** Private keys and wallet state
- **Security:** Must be protected!

### Best Practices

1. **Production:**
   - Use HSM/KMS for key management
   - Encrypt wallet file
   - Restrict file permissions: `chmod 600 ~/.zcash/zecwallet-light-wallet.dat`
   - Use secure backup strategy

2. **Development:**
   - Use testnet wallet
   - Never commit wallet file to git
   - Use separate wallet for testing

3. **Backup:**
   - Backup seed phrase securely
   - Backup wallet file to encrypted storage
   - Test restore procedure

## Troubleshooting

### Wallet Not Found

**Error:** "Wallet not found" or "Could not initialize wallet"

**Solutions:**
1. Check `ZECWALLET_CLI_PATH` is correct
2. Ensure binary has execute permissions
3. Run wallet initialization manually first
4. Check wallet directory exists and is writable

### Address Generation Fails

**Error:** "Could not generate shielded address"

**Solutions:**
1. Ensure wallet is initialized
2. Check lightwalletd server is accessible
3. Verify network configuration matches wallet

### Balance Not Updating

**Solutions:**
1. Sync wallet: `zecwallet-cli sync`
2. Check lightwalletd connection
3. Verify transactions are confirmed

## Fallback Mode

If `USE_ZECWALLET_CLI=false` or wallet fails to initialize:
- System falls back to manual address configuration
- Uses `ZCASH_BRIDGE_ADDRESS` from environment
- All other features work normally

## Migration from Manual Setup

If you were using manual address configuration:

1. **Backup existing address** (if you have funds)
2. **Enable wallet:**
   ```env
   USE_ZECWALLET_CLI=true
   ```
3. **Get new address:**
   ```bash
   curl http://localhost:3001/api/zcash/bridge-address
   ```
4. **Update users** with new bridge address
5. **Transfer funds** from old address to new (if needed)

## Limitations

1. **Archived Repository:** Repository is archived (read-only) as of Sep 2023
2. **CLI Dependency:** Requires external binary
3. **Process Management:** Spawns CLI processes (overhead)
4. **Platform Specific:** Different binaries for different platforms

## Future Enhancements

1. **Direct lightwalletd Integration:** Use gRPC API directly (no CLI)
2. **Transaction Monitoring:** Auto-detect incoming payments
3. **Automatic Shielding:** Auto-shield transparent funds
4. **Multi-address Support:** Support multiple bridge addresses

## References

- [zecwallet-light-cli GitHub](https://github.com/adityapk00/zecwallet-light-cli)
- [Zcash Documentation](https://zcash.readthedocs.io/)
- [Lightwalletd Protocol](https://github.com/zcash/lightwalletd)


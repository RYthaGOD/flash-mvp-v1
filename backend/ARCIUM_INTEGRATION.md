# Arcium Network Integration Guide

## Overview

This guide explains how FLASH Bridge connects to the Arcium MPC network for real privacy-preserving computations.

## Architecture

FLASH Bridge uses a custom Arcium MXE (MPC eXecution Environment) deployed on Solana Devnet. The integration follows this pattern:

1. **Backend** → Calls Solana program instruction
2. **Solana Program** → Queues MPC computation via `queue_computation()`
3. **Arcium Network** → Executes encrypted computation on MPC nodes
4. **Callback** → Returns encrypted result to Solana program
5. **Backend** → Receives result and decrypts (if authorized)

## Prerequisites

### 1. Arcium Node Setup

Ensure your Arcium node is running and connected to cluster:

```bash
# Check node status
arcium arx-active <your-node-offset> --rpc-url https://api.devnet.solana.com

# Check cluster status
arcium cluster-info <cluster-id> --rpc-url https://api.devnet.solana.com
```

### 2. MXE Deployment

Deploy the FLASH Bridge MXE to Arcium network:

```bash
cd flash-bridge-mxe
arcium deploy --network devnet
```

After deployment, note the program ID and set it in `.env`:

```env
FLASH_BRIDGE_MXE_PROGRAM_ID=<deployed-program-id>
```

### 3. Initialize Computation Definitions

The MXE requires computation definitions to be initialized once:

```bash
# This is done automatically on backend startup
# Or manually via:
node -e "require('./src/services/arcium').initialize()"
```

## Environment Configuration

### Required Variables

```env
# Arcium MPC Configuration
ENABLE_ARCIUM_MPC=true
ARCIUM_SIMULATED=false              # Set to false for real MPC
ARCIUM_USE_REAL_SDK=true            # Enable real SDK integration
ARCIUM_ENDPOINT=http://localhost:8080
ARCIUM_NETWORK=devnet
ARCIUM_CLUSTER_ID=123456789         # Your cluster ID
ARCIUM_NODE_OFFSET=                  # Optional: Your node offset
ARCIUM_API_KEY=                     # Optional: API key if required
ARCIUM_PRIVACY_LEVEL=maximum
ARCIUM_COMPUTATION_TIMEOUT=30000
ARCIUM_MAX_RETRIES=3

# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
FLASH_BRIDGE_MXE_PROGRAM_ID=<your-deployed-program-id>
```

### Optional Variables

```env
ARCIUM_CACHE_TTL=300000             # Cache TTL in milliseconds (5 minutes)
ARCIUM_MAX_POOL_SIZE=10             # Connection pool size
```

## Integration Components

### 1. Arcium Service (`src/services/arcium.js`)

Main service that handles all MPC operations:

- `encryptAmount()` - Encrypt bridge amounts
- `encryptBTCAddress()` - Encrypt Bitcoin addresses
- `verifyEncryptedAmountsMatch()` - Verify amounts without revealing
- `calculateEncryptedSwapAmount()` - Calculate swaps on encrypted values
- `generateTrustlessRandom()` - Generate trustless random numbers
- `privateVerifyZcashTx()` - Verify Zcash transactions privately

### 2. Arcium Solana Client (`src/services/arcium-solana-client.js`)

Client for interacting with the deployed MXE Solana program:

- `initialize()` - Initialize client and verify program
- `initComputationDefinition()` - Initialize computation definitions
- `queueEncryptBridgeAmount()` - Queue encryption computation
- `queueVerifyBridgeTransaction()` - Queue verification computation
- `queueCalculateSwapAmount()` - Queue swap calculation
- `queueEncryptBTCAddress()` - Queue BTC address encryption
- `waitForComputation()` - Wait for computation completion

### 3. Computation Handler (`src/services/arcium-computation-handler.js`)

Handles computation callbacks and result processing:

- `listenForComputation()` - Listen for completion events
- `parseComputationResult()` - Parse callback account data
- `handleTimeout()` - Handle computation timeouts
- `handleError()` - Handle computation errors

## Usage Examples

### Encrypt Bridge Amount

```javascript
const arciumService = require('./src/services/arcium');

const encrypted = await arciumService.encryptAmount(
  1000000,  // Amount in satoshis
  'UserPublicKey...'  // Recipient public key
);

console.log('Encrypted:', encrypted.computationId);
console.log('Simulated:', encrypted.simulated); // false for real MPC
```

### Verify Transaction Privately

```javascript
const verification = await arciumService.privateVerifyZcashTx(
  'tx_hash_here',
  encryptedExpectedAmount
);

console.log('Verified:', verification.verified);
console.log('Private:', verification.private); // true - amounts not revealed
```

### Calculate Swap on Encrypted Value

```javascript
const swapResult = await arciumService.calculateEncryptedSwapAmount(
  encryptedZenZEC,
  10  // Exchange rate
);

console.log('Encrypted SOL amount:', swapResult.ciphertext);
```

## Testing

### Run Integration Tests

```bash
npm run test-arcium
# or
node test-arcium-integration.js
```

### Test Individual Operations

```bash
# Test encryption
node -e "require('./src/services/arcium').encryptAmount(1000000, 'test').then(console.log)"

# Test random generation
node -e "require('./src/services/arcium').generateTrustlessRandom(100).then(console.log)"
```

## Troubleshooting

### Node Not Found

**Error**: `FLASH Bridge MXE program not found on Solana`

**Solution**: 
1. Verify MXE is deployed: `arcium deploy --network devnet`
2. Check `FLASH_BRIDGE_MXE_PROGRAM_ID` in `.env`
3. Verify program exists: `solana program show <program-id>`

### Computation Timeout

**Error**: `Computation timeout: <computation-id>`

**Solution**:
1. Check Arcium node is running: `docker logs arx-node`
2. Verify cluster is active: `arcium cluster-info <cluster-id>`
3. Increase timeout: `ARCIUM_COMPUTATION_TIMEOUT=60000`

### Connection Failed

**Error**: `Failed to initialize real Arcium SDK`

**Solution**:
1. Check `ARCIUM_ENDPOINT` is correct
2. Verify node is accessible: `curl http://localhost:8080/health`
3. Check firewall/network settings
4. Verify `ARCIUM_CLUSTER_ID` matches your cluster

### Simulation Mode Active

**Warning**: `Running in SIMULATION mode`

**Solution**:
1. Set `ARCIUM_SIMULATED=false` in `.env`
2. Set `ARCIUM_USE_REAL_SDK=true` in `.env`
3. Restart backend server

## Performance

### Expected Performance

- **Simulation Mode**: <100ms per operation
- **Real MPC Mode**: 1-5 seconds per operation (network dependent)
- **Cache Hit Rate**: 50-80% (depending on usage patterns)

### Optimization Tips

1. **Enable Caching**: Already enabled by default
2. **Connection Pooling**: Configured automatically
3. **Batch Operations**: Group multiple operations when possible
4. **Use Simulation for Development**: Faster iteration during development

## Security Considerations

1. **Key Management**: Arcium keypair stored in `arcium-keypair.json` (keep secure)
2. **API Keys**: Store `ARCIUM_API_KEY` securely (use environment variables)
3. **Network Security**: Use HTTPS/WSS for production endpoints
4. **Authorization**: Always verify public keys before decryption

## Next Steps

1. **Deploy MXE**: Deploy custom MXE to Arcium network
2. **Configure Environment**: Set all required environment variables
3. **Test Integration**: Run `test-arcium-integration.js`
4. **Monitor Performance**: Check metrics via `/api/arcium/status`
5. **Scale**: Add more Arcium nodes to cluster for better performance

## Additional Resources

- [Arcium Documentation](https://docs.arcium.com)
- [Arcium Node Setup Guide](../arcium-node-setup/README.md)
- [FLASH Bridge MXE README](../flash-bridge-mxe/README.md)
- [Arcium Discord](https://discord.gg/arcium)

## Support

For issues or questions:

1. Check this documentation
2. Review Arcium logs: `docker logs arx-node`
3. Check backend logs: `logs/crash.log`
4. Join Arcium Discord for community support




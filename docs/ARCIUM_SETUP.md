# 🔒 Arcium MPC Node Setup Guide

This guide covers setting up the Arcium Multi-Party Computation (MPC) node for the FLASH Bridge.

## Overview

Arcium provides privacy-preserving computation through MPC, enabling:
- **Encrypted amounts** - Transaction amounts are hidden
- **Private verification** - BTC deposits verified without exposing data
- **Trustless randomness** - Secure random number generation
- **Encrypted addresses** - Address privacy

## Setup Options

### Option 1: Simulation Mode (Development)

For development and testing, you can use simulated MPC:

```env
# backend/.env
ENABLE_ARCIUM_MPC=true
ARCIUM_SIMULATED=true
ARCIUM_USE_REAL_SDK=false
ARCIUM_ENDPOINT=http://localhost:8080
ARCIUM_CLUSTER_ID=devnet_default
ARCIUM_NODE_OFFSET=0
```

**Pros:**
- No Arcium installation required
- Works offline
- Fast for development

**Cons:**
- Not real privacy protection
- Cannot use in production

### Option 2: Local Arcium Node (Recommended for Testing)

Install and run a local Arcium node:

#### Step 1: Install Arcium Tooling

```bash
# Run the Arcium installer
curl -sSfL https://install.arcium.com | bash

# Or use the included script
cd arcium-node-setup
bash arcium-installer.sh
```

**Prerequisites:**
- Rust (rustc, cargo)
- Solana CLI
- Yarn
- Anchor framework
- Docker & Docker Compose

#### Step 2: Initialize Arcium Project

```bash
# Create new Arcium project (one-time)
arcium init my-mpc-project
cd my-mpc-project
```

#### Step 3: Start Local Network

```bash
# Start the local Arcium network
arcium localnet

# This will:
# - Start local Solana validator
# - Deploy Arcium programs
# - Start MPC nodes
# - Open port 8080 for connections
```

#### Step 4: Configure Backend

```env
# backend/.env
ENABLE_ARCIUM_MPC=true
ARCIUM_SIMULATED=false
ARCIUM_USE_REAL_SDK=true
ARCIUM_ENDPOINT=http://localhost:8080
ARCIUM_NETWORK=devnet
ARCIUM_CLUSTER_ID=localnet
ARCIUM_NODE_OFFSET=0
```

### Option 3: Arcium Devnet/Testnet

Connect to the public Arcium network:

#### Step 1: Register on Arcium

1. Visit [https://arcium.com](https://arcium.com)
2. Create an account
3. Register your node
4. Get your credentials:
   - Cluster ID
   - Node Offset
   - API Key (if required)

#### Step 2: Configure Backend

```env
# backend/.env
ENABLE_ARCIUM_MPC=true
ARCIUM_SIMULATED=false
ARCIUM_USE_REAL_SDK=true
ARCIUM_ENDPOINT=https://devnet.arcium.com
ARCIUM_NETWORK=devnet
ARCIUM_CLUSTER_ID=<your-cluster-id>
ARCIUM_NODE_OFFSET=<your-node-offset>
ARCIUM_API_KEY=<your-api-key>
```

## Docker Setup

### Using Docker Compose (Default)

The default `docker-compose.yml` includes a placeholder Arcium node:

```bash
# Start all services including Arcium placeholder
docker-compose up -d
```

This uses simulated MPC by default.

### Using Real Arcium Node with Docker

For real MPC with Docker:

#### Option A: Host Arcium Node

1. Start Arcium on host machine:
```bash
arcium localnet
```

2. Use the override file:
```bash
docker-compose -f docker-compose.yml -f docker-compose.arcium.yml up -d
```

#### Option B: Configure External Arcium

Edit `backend/.env`:
```env
ARCIUM_ENDPOINT=http://host.docker.internal:8080
ARCIUM_SIMULATED=false
ARCIUM_USE_REAL_SDK=true
```

## Configuration Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_ARCIUM_MPC` | Enable MPC features | `true` |
| `ARCIUM_ENDPOINT` | Node endpoint URL | `http://localhost:8080` |
| `ARCIUM_NETWORK` | Network (devnet/testnet/mainnet) | `devnet` |
| `ARCIUM_CLUSTER_ID` | Your cluster ID | Required |
| `ARCIUM_NODE_OFFSET` | Your node offset | `0` |
| `ARCIUM_SIMULATED` | Use simulation | `true` (dev) / `false` (prod) |
| `ARCIUM_USE_REAL_SDK` | Use real SDK | `false` (dev) / `true` (prod) |
| `ARCIUM_API_KEY` | API key (if required) | Optional |
| `ARCIUM_COMPUTATION_TIMEOUT` | Timeout (ms) | `30000` |
| `ARCIUM_MAX_RETRIES` | Max retries | `3` |
| `ARCIUM_PRIVACY_LEVEL` | Privacy level | `full` |

## Verification

### Check Arcium Status

```bash
# Via API
curl http://localhost:3001/api/v1/arcium/status

# Expected response:
{
  "enabled": true,
  "connected": true,
  "mode": "real" | "simulated",
  "features": {
    "encryptedAmounts": true,
    "privateVerification": true,
    "trustlessRandom": true,
    "encryptedAddresses": true
  }
}
```

### Check Health Endpoint

```bash
curl http://localhost:3001/health | jq .arciumMPC
# Should return: true
```

## Troubleshooting

### "Arcium MPC is not available"

1. Check if Arcium node is running:
```bash
curl http://localhost:8080/health
```

2. Verify environment variables:
```bash
echo $ARCIUM_ENDPOINT
echo $ENABLE_ARCIUM_MPC
```

3. Check logs:
```bash
docker-compose logs backend | grep -i arcium
```

### "Circuit breaker open"

The Arcium service uses a circuit breaker for reliability. If too many requests fail:

1. Wait 60 seconds for recovery
2. Check Arcium node health
3. Verify network connectivity

### "Invalid cluster ID"

Ensure your cluster ID matches your Arcium registration:
- For local: Use any consistent value
- For devnet: Get from Arcium dashboard

## Production Considerations

### Security

1. **Never use simulation in production**
   ```env
   NODE_ENV=production  # Forces ARCIUM_SIMULATED=false
   ```

2. **Secure your API key**
   - Use secrets management (Vault, AWS Secrets Manager)
   - Never commit API keys to git

3. **Network isolation**
   - Run Arcium node in private network
   - Use TLS for external connections

### Performance

1. **Connection pooling**
   ```env
   ARCIUM_MAX_POOL_SIZE=10
   ```

2. **Caching**
   ```env
   ARCIUM_CACHE_TTL=300000  # 5 minutes
   ```

3. **Timeout tuning**
   ```env
   ARCIUM_COMPUTATION_TIMEOUT=30000  # 30 seconds
   ```

## Resources

- [Arcium Documentation](https://docs.arcium.com/)
- [Arcium Examples](https://github.com/arcium-hq/examples)
- [Arcium Discord](https://discord.gg/arcium)

---

For questions, open an issue on GitHub or join the Discord community.


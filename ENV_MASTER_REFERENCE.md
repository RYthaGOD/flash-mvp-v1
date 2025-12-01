# FLASH Bridge – Unified Environment Reference

This document aggregates every environment variable found across the repo so you
can copy the right values into each runtime-specific `.env`. It pulls from:

- Workspace root `.env`
- `backend/.env`, `.env.backup`, `.env.example`, `.env.test`, `.env.tmp`
- `frontend/.env` and `.env.example`

⚠️ **Do not load this file directly**. Several keys conflict across services and
some are intentionally duplicated to document overrides.

---

## Workspace Root (`Documents/flash-mvp-main/.env`)

```
PORT=3001
NODE_ENV=development
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
BITCOIN_NETWORK=testnet
BITCOIN_BRIDGE_ADDRESS=tb1qmockbitcoinaddress1234567890
ENABLE_BITCOIN_MONITORING=true
BTC_TO_USDC_RATE=50000
JUPITER_PRIVACY_MODE=high
JUPITER_MIN_DELAY=1000
JUPITER_MAX_DELAY=3000
ENABLE_ARCIUM_MPC=true
ARCIUM_SIMULATED=true
ENABLE_RELAYER=false
ENABLE_BTC_RELAYER=false
```

---

## Backend Service (`flash-mvp-copilot-merge-all-branches-for-demo/backend`)

### Core `.env`

```
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
FRONTEND_URL=http://localhost:3000
FRONTEND_ORIGIN=http://localhost:3000

SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
FLASH_BRIDGE_MXE_PROGRAM_ID=CULoJigMJeVrmXVYPu8D9pdmfjAZnzdAwWvTqWvz1XkP
PROGRAM_ID=

USE_NATIVE_ZEC=true
NATIVE_ZEC_MINT=A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS
ZEC_MINT=A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS
ZENZEC_MINT=MockZenZecMintAddress11111111111111111111111
BOOTSTRAP_BTC=0.1

ENABLE_RELAYER=false
ENABLE_BTC_RELAYER=false
RELAYER_KEYPAIR_PATH=./relayer-keypair-new.json

ENABLE_ARCIUM_MPC=true
ARCIUM_SIMULATED=false
ARCIUM_USE_REAL_SDK=true
ARCIUM_ENDPOINT=http://localhost:8080
ARCIUM_NETWORK=testnet
ARCIUM_CLUSTER_ID=your_cluster_id_here
ARCIUM_NODE_OFFSET=your_node_offset_here
ARCIUM_MXE_ID=flash_bridge_privacy
ARCIUM_PROGRAM_ID=
# Optional secrets – provide via secure store in production
ARCIUM_API_KEY=your_arcium_api_key_here
ARCIUM_ENCRYPTION_KEY=
ARCIUM_HMAC_KEY=
ARCIUM_COMPUTATION_TIMEOUT=30000
ARCIUM_MAX_RETRIES=3
ARCIUM_CACHE_TTL=300000
ARCIUM_MAX_POOL_SIZE=10
ARCIUM_PRIVACY_LEVEL=full

ENABLE_BITCOIN_MONITORING=true
BITCOIN_NETWORK=testnet
BITCOIN_BRIDGE_ADDRESS=tb1qug4w70zdr40clj9qecy67tx58e24lk90whzy9l
BITCOIN_REQUIRED_CONFIRMATIONS=1
BITCOIN_EXPLORER_API_URL=https://blockstream.info/testnet/api
BITCOIN_EXPLORER_URL=https://blockstream.info/testnet/api

ZCASH_NETWORK=testnet
ZCASH_RPC_HOST=127.0.0.1
ZCASH_RPC_PORT=18232
ZCASH_RPC_USER=user
ZCASH_RPC_PASS=password
ZCASH_BRIDGE_ADDRESS=tm9RJL8yxehhS4XKgNn7eqrYJCJh8n3LwL
ZCASH_EXPLORER_URL=https://lightwalletd.testnet.z.cash
ZCASH_LIGHTWALLETD_URL=https://zcash-mainnet.chainsafe.dev

JUPITER_API_BASE_URL=https://quote-api.jup.ag/v6
JUPITER_PRIVACY_MODE=high
JUPITER_MIN_DELAY=1000
JUPITER_MAX_DELAY=3000

EXCHANGE_PROVIDER=coingecko
USE_EXCHANGE=false
EXCHANGE_API_KEY=your_exchange_api_key
EXCHANGE_API_SECRET=your_exchange_api_secret
SOL_TO_ZENZEC_RATE=100
BTC_TO_USDC_RATE=50000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=flash_bridge
DB_USER=postgres
DB_PASSWORD=your_postgres_password_here
DATABASE_PATH=./database/flash-bridge.db

ADMIN_API_KEY=admin_api_key_change_in_production
JWT_SECRET=your_jwt_secret_here_change_in_production
API_KEY_SECRET=your_api_key_secret_here_change_in_production
```

### `.env.backup` (Bitcoin testnet4 overrides)

```
ENABLE_BITCOIN_MONITORING=true
BITCOIN_NETWORK=testnet4
BITCOIN_EXPLORER_URL=https://mempool.space/testnet4/api
BITCOIN_BRIDGE_ADDRESS=tb1qug4w70zdr40clj9qecy67tx58e24lk90whzy9l
BTC_TEST_MODE=true
BTC_TO_SOL_RATE=0.01
FLASH_BRIDGE_MXE_PROGRAM_ID=CULoJigMJeVrmXVYPu8D9pdmfjAZnzdAwWvTqWvz1XkP
```

### `.env.test` (lightweight demo harness)

```
PORT=3001
NODE_ENV=development
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
ZENZEC_MINT=MockZenZecMintAddress11111111111111111111111

ENABLE_ARCIUM_MPC=true
ARCIUM_SIMULATED=true

BITCOIN_NETWORK=testnet
BITCOIN_EXPLORER_URL=https://blockstream.info/testnet/api
BITCOIN_BRIDGE_ADDRESS=tb1qmockbitcoinaddress1234567890

ZCASH_NETWORK=testnet
ZCASH_EXPLORER_URL=https://lightwalletd.testnet.z.cash
ZCASH_BRIDGE_ADDRESS=zs1mockzcashaddress1234567890

DATABASE_PATH=./database/flash-bridge.db
ENABLE_RELAYER=false
ENABLE_BTC_RELAYER=false
SOL_TO_ZENZEC_RATE=100
```

### `.env.tmp` (scratch overrides while debugging)

```
USE_NATIVE_ZEC=false
NATIVE_ZEC_MINT=
FRONTEND_ORIGIN=http://localhost:3000
ADMIN_API_KEY=demo-admin-key-12345
PORT=3002
USE_NATIVE_ZEC=true
NATIVE_ZEC_MINT=A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS
RELAYER_KEYPAIR_PATH=./relayer-keypair-new.json
```

---

## Frontend SPA (`flash-mvp-copilot-merge-all-branches-for-demo/frontend`)

### `.env`

```
REACT_APP_API_URL=http://localhost:3002
```

### `.env.example`

```
REACT_APP_API_URL=http://localhost:3001
REACT_APP_ZENZEC_MINT=YourZenZECMintAddressHere
REACT_APP_SOL_TO_ZENZEC_RATE=100
REACT_APP_ZENZEC_TO_BTC_RATE=0.001
```

---

## How to Use This Reference

1. Decide which runtime you are configuring (root scripts, backend server,
   frontend SPA).
2. Copy the corresponding block(s) into the service’s `.env`.
3. Adjust feature flags (`USE_NATIVE_ZEC`, `ENABLE_RELAYER`, etc.) per demo.
4. Replace placeholder secrets with real values via your preferred secret
   manager—never hard-code production keys in git.
5. When you add new variables, append them to this document so everything stays
   discoverable in one place.


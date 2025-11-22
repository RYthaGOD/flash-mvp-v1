# FLASH Bridge Backend

Node.js backend server for the FLASH BTC → ZEC → Solana Bridge.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your configuration
npm start
```

## Environment Variables

### Core Configuration
```env
PORT=3001
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
ZENZEC_MINT=YourZenZECMintAddressHere
```

### Bitcoin Configuration (Cash App Integration)
```env
# Bitcoin Network
BITCOIN_NETWORK=mainnet  # or testnet

# Bridge Bitcoin Address (where users send BTC from Cash App)
BITCOIN_BRIDGE_ADDRESS=bc1q...  # Your Bitcoin address

# Bitcoin Explorer API (for transaction verification)
BITCOIN_EXPLORER_URL=https://blockstream.info/api  # Default: Blockstream

# Bootstrap Reserve (initial BTC to start bridge)
BOOTSTRAP_BTC=0.1  # Initial BTC reserve (e.g., 0.1 BTC)

# Enable automatic Bitcoin monitoring
ENABLE_BITCOIN_MONITORING=true  # Set to true to auto-detect BTC payments
```

### Zcash Configuration (Privacy Layer)
```env
ZCASH_NETWORK=mainnet
ZCASH_BRIDGE_ADDRESS=zs1...  # Bridge's Zcash shielded address
ZCASH_LIGHTWALLETD_URL=https://zcash-mainnet.chainsafe.dev
ZCASH_EXPLORER_URL=https://zcashblockexplorer.com
```

### Exchange Configuration (BTC → ZEC Conversion)
```env
# Exchange Provider (for BTC → ZEC conversion)
EXCHANGE_PROVIDER=coingecko  # Options: coingecko, kraken, coinbase

# Exchange API Credentials (if using exchange API)
USE_EXCHANGE=false  # Set to true to enable actual exchange execution
EXCHANGE_API_KEY=your_api_key
EXCHANGE_API_SECRET=your_api_secret
```

### Relayer Configuration
```env
ENABLE_RELAYER=false
RELAYER_KEYPAIR_PATH=~/.config/solana/id.json
```

### Arcium MPC (Privacy)
```env
ENABLE_ARCIUM_MPC=false
ARCIUM_ENDPOINT=http://localhost:9090
```

## API Endpoints

### `GET /`
API information

### `GET /health`
Health check

### `GET /api/bridge/info`
Bridge configuration and status

### `POST /api/bridge`
Mint zenZEC tokens. Supports two flows:

#### Flow 1: BTC → zenZEC (Cash App flow)
**Request body:**
```json
{
  "solanaAddress": "wallet_address",
  "amount": 0.01,
  "bitcoinTxHash": "abc123...",
  "swapToSol": false,
  "useZecPrivacy": false
}
```

#### Flow 2: ZEC → zenZEC (Direct Zcash flow)
**Request body:**
```json
{
  "solanaAddress": "wallet_address",
  "amount": 1.5,
  "zcashTxHash": "xyz789...",
  "swapToSol": false
}
```

**Required fields:**
- `solanaAddress`: User's Solana wallet address
- `amount`: Amount in BTC (for Bitcoin flow) or ZEC (for Zcash flow)
- `bitcoinTxHash` OR `zcashTxHash`: Transaction hash (provide one, not both)

**Optional fields:**
- `swapToSol`: If true, user can swap zenZEC to SOL (via `burn_and_emit` instruction)
- `useZecPrivacy`: If true, convert BTC → ZEC for privacy layer (Bitcoin flow only)

**Response (Bitcoin flow):**
```json
{
  "success": true,
  "transactionId": "btc_abc123_1234567890",
  "amount": 1000000,
  "amountBTC": 0.01,
  "solanaAddress": "wallet_address",
  "status": "confirmed",
  "reserveAsset": "BTC",
  "swapToSol": false,
  "bitcoinVerification": {
    "verified": true,
    "txHash": "abc123...",
    "amount": 1000000,
    "amountBTC": 0.01,
    "confirmations": 6,
    "blockHeight": 800000
  }
}
```

**Response (Zcash flow):**
```json
{
  "success": true,
  "transactionId": "zec_xyz789_1234567890",
  "amount": 150000000,
  "amountZEC": 1.5,
  "solanaAddress": "wallet_address",
  "status": "confirmed",
  "reserveAsset": "ZEC",
  "swapToSol": false,
  "zcashVerification": {
    "verified": true,
    "txHash": "xyz789...",
    "amount": 1.5,
    "blockHeight": 2500000
  },
  "swapNote": "zenZEC will be burned and swapped to SOL via relayer. Call burn_and_emit instruction."
}
```

**Note:** When `swapToSol` is true, the user needs to call the `burn_and_emit` instruction on the Solana program to burn zenZEC and trigger the SOL swap via the relayer.

### `GET /api/bridge/transaction/:txId`
Get transaction status

## Relayer Service

The relayer listens for `BurnSwapEvent` from the Solana program and processes SOL swaps.

Enable with `ENABLE_RELAYER=true` in `.env`.

## Technology Stack

- Express.js
- @solana/web3.js
- @project-serum/anchor
- CORS, body-parser

# FLASH Bridge API Documentation

## Overview

The FLASH Bridge provides REST API endpoints for cross-chain bridge operations between Bitcoin, Zcash, and Solana. All operations use mandatory Arcium MPC privacy protection.

**Base URL:** `http://localhost:3001/api`

## Authentication

Currently no authentication required (development mode). In production, implement API key authentication.

## Rate Limiting

All endpoints are protected by rate limiting:
- **General endpoints:** 100 requests per 15 minutes per IP
- **Bridge operations:** 10 requests per minute per IP + 5 per wallet per 5 minutes
- **Admin operations:** 5 requests per minute per IP
- **Health checks:** 60 requests per minute per IP

## Error Response Format

```json
{
  "error": "Error type",
  "message": "Human readable error message",
  "field": "field_name" // Optional: which field caused the error
}
```

---

## Bridge Operations

### POST /bridge

**Mint native ZEC tokens from BTC/ZEC deposits**

**Request Body:**
```json
{
  "solanaAddress": "string (required, valid Solana public key)",
  "bitcoinTxHash": "string (optional, Bitcoin transaction hash)",
  "zcashTxHash": "string (optional, Zcash transaction hash)",
  "amount": "number (optional, amount in BTC/ZEC)",
  "useZecPrivacy": "boolean (optional, defaults to true)"
}
```

**Response (Success):**
```json
{
  "success": true,
  "transactionId": "string",
  "amount": "number",
  "solanaAddress": "string",
  "solanaTxSignature": "string",
  "status": "confirmed",
  "amountBTC": "number (if BTC flow)",
  "bitcoinVerification": {
    "verified": true,
    "txHash": "string",
    "confirmations": "number"
  }
}
```

**Error Codes:**
- `400`: Invalid input (validation failed)
- `429`: Rate limit exceeded
- `500`: Internal server error

---

### POST /bridge/mark-redemption

**Manually mark a treasury transfer as redemption (admin only)**

**Request Body:**
```json
{
  "solanaTxSignature": "string (required, valid Solana signature)",
  "userAddress": "string (required, valid Solana public key)",
  "amount": "number (required, positive amount)"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Transfer marked as redemption",
  "solanaTxSignature": "string",
  "userAddress": "string",
  "amount": "number"
}
```

---

### GET /bridge/transfer-metadata/:signature

**Get metadata for a treasury transfer**

**Path Parameters:**
- `signature`: Solana transaction signature

**Response (Success):**
```json
{
  "success": true,
  "metadata": {
    "id": "number",
    "solanaTxSignature": "string",
    "transferType": "redemption|refund|funding|admin|test",
    "userAddress": "string",
    "amount": "number",
    "metadata": "object",
    "createdBy": "string",
    "createdAt": "string"
  }
}
```

---

### GET /bridge/reserves

**Get current reserve status for all assets**

**Response (Success):**
```json
{
  "success": true,
  "reserves": {
    "btc": {
      "reserveSatoshis": "number",
      "reserveBTC": "number",
      "lastUpdated": "string",
      "bridgeAddress": "string"
    },
    "zec": {
      "balance": "bigint",
      "balanceZEC": "number",
      "lastUpdated": "string"
    },
    "timestamp": "string"
  },
  "note": "All reserve values are calculated from database as source of truth"
}
```

---

### GET /bridge/info

**Get bridge configuration and status**

**Response:**
```json
{
  "status": "active",
  "network": "devnet|testnet|mainnet",
  "programId": "string",
  "treasury": "USDC Treasury + Jupiter Swaps",
  "solanaVersion": "object",
  "bitcoin": {
    "network": "testnet|mainnet",
    "bridgeAddress": "string",
    "currentReserve": "number"
  },
  "zcash": null
}
```

---

### GET /bridge/health

**Bridge service health check**

**Response:**
```json
{
  "healthy": true,
  "blockHeight": "number",
  "timestamp": "string"
}
```

---

## Transaction Management

### PATCH /bridge/transaction/:txId/status

**Update transaction status**

**Path Parameters:**
- `txId`: Transaction ID

**Request Body:**
```json
{
  "status": "pending|confirmed|failed|processing",
  "notes": "string (optional)",
  "transactionType": "bridge|swap|burn"
}
```

**Response (Success):**
```json
{
  "success": true,
  "transaction": "object",
  "message": "Transaction status updated"
}
```

---

## Cryptographic Proofs

### GET /bridge/proof/:txId

**Get cryptographic proof for transaction**

**Query Parameters:**
- `format`: `full|audit|verification` (optional, defaults to full)

**Response (Success):**
```json
{
  "success": true,
  "transactionId": "string",
  "proof": {
    "transactionHash": "string",
    "signature": "string",
    "merkleProof": "object",
    "metadata": "object"
  },
  "compliance": "INSTITUTIONAL",
  "generatedAt": "string",
  "expiresAt": "string"
}
```

---

### POST /bridge/proof/:txId/verify

**Verify cryptographic proof**

**Request Body:**
```json
{
  "proof": "object (proof data to verify)"
}
```

**Response (Success):**
```json
{
  "success": true,
  "transactionId": "string",
  "verification": {
    "valid": true,
    "reason": "string",
    "details": "object"
  },
  "verified": true,
  "compliance": "VERIFIED"
}
```

---

## Health & Monitoring

### GET /health

**System health check**

**Response:**
```json
{
  "status": "ok",
  "relayerActive": false,
  "btcRelayerActive": true,
  "arciumMPC": true,
  "privacy": "full",
  "privacyMode": "mandatory",
  "privacySimulated": false,
  "encrypted": true,
  "zcashMonitoring": false,
  "database": true,
  "configuration": "object",
  "reserves": {
    "btc": "object",
    "zec": "object"
  },
  "timestamp": "string"
}
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (validation failed) |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

## Data Types

- **PublicKey**: 32-44 character base58-encoded Solana public key
- **Signature**: 32-88 character base58-encoded Solana transaction signature
- **Amount**: Positive number (can include decimals)
- **Timestamp**: ISO 8601 formatted date string

## Security Notes

- All bridge operations use Arcium MPC encryption
- Input validation prevents injection attacks
- Rate limiting prevents abuse
- Database transactions ensure atomicity
- All sensitive data is encrypted at rest and in transit

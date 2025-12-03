/**
 * OpenAPI Documentation Route
 * ===========================
 * Serves OpenAPI 3.0 specification and Swagger UI
 */

const express = require('express');
const router = express.Router();

// OpenAPI 3.0 Specification
const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'FLASH Bridge API',
    description: `
# FLASH Bridge API

Cross-chain bridge for BTC → SOL transfers with privacy-preserving MPC.

## Features
- **BTC Deposits**: Monitor and claim Bitcoin deposits
- **SOL Transfers**: Receive SOL from treasury
- **Cryptographic Proofs**: Institutional-grade verification
- **Arcium MPC**: Privacy-preserving computations

## Authentication

### Admin Endpoints
Require \`x-api-key\` header with your admin API key.

### Client Endpoints
Require \`x-client-signature\` header for mutation operations.

## Rate Limits

| Endpoint Type | Limit |
|--------------|-------|
| General | 100 req/min |
| Bridge | 10 req/min |
| Admin | 30 req/min |
| Wallet | 5 req/5min |
    `,
    version: '1.0.0',
    contact: {
      name: 'FLASH Bridge Team',
      url: 'https://github.com/RYthaGOD/flash-mvp',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API Version 1 (Current)',
    },
    {
      url: '/api',
      description: 'Legacy API (Deprecated)',
    },
  ],
  tags: [
    {
      name: 'Bridge',
      description: 'Bridge operations for BTC → SOL transfers',
    },
    {
      name: 'Arcium',
      description: 'Privacy-preserving MPC operations',
    },
    {
      name: 'Health',
      description: 'System health and status',
    },
    {
      name: 'Admin',
      description: 'Administrative operations (requires API key)',
    },
  ],
  paths: {
    '/bridge': {
      post: {
        tags: ['Bridge'],
        summary: 'Execute bridge transaction',
        description: 'Verify BTC deposit and receive SOL from treasury',
        operationId: 'executeBridge',
        security: [{ clientSignature: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/BridgeRequest',
              },
              example: {
                solanaAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
                amount: 0.001,
                bitcoinTxHash: 'abc123def456...',
                depositAllocationId: '550e8400-e29b-41d4-a716-446655440000',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Bridge transaction successful',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/BridgeResponse',
                },
              },
            },
          },
          400: {
            $ref: '#/components/responses/BadRequest',
          },
          429: {
            $ref: '#/components/responses/RateLimited',
          },
          503: {
            $ref: '#/components/responses/InsufficientReserves',
          },
        },
      },
    },
    '/bridge/btc-address': {
      post: {
        tags: ['Bridge'],
        summary: 'Allocate BTC deposit address',
        description: 'Get a unique Bitcoin address for deposits',
        operationId: 'allocateBtcAddress',
        security: [{ clientSignature: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['solanaAddress'],
                properties: {
                  solanaAddress: {
                    type: 'string',
                    description: 'User Solana wallet address',
                    example: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
                  },
                  sessionId: {
                    type: 'string',
                    description: 'Optional session identifier',
                  },
                  forceNew: {
                    type: 'boolean',
                    description: 'Force allocation of new address',
                    default: false,
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Address allocated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    depositAddress: {
                      type: 'string',
                      description: 'Bitcoin deposit address',
                      example: 'bc1q...',
                    },
                    allocation: {
                      type: 'object',
                      properties: {
                        allocationId: { type: 'string', format: 'uuid' },
                        expiresAt: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/bridge/btc-deposit': {
      post: {
        tags: ['Bridge'],
        summary: 'Claim BTC deposit',
        description: 'Claim a detected Bitcoin deposit',
        operationId: 'claimBtcDeposit',
        security: [{ clientSignature: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['solanaAddress', 'bitcoinTxHash'],
                properties: {
                  solanaAddress: {
                    type: 'string',
                    description: 'User Solana wallet address',
                  },
                  bitcoinTxHash: {
                    type: 'string',
                    description: 'Bitcoin transaction hash',
                  },
                  outputTokenMint: {
                    type: 'string',
                    description: 'Optional output token mint address',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Deposit claimed successfully',
          },
          400: {
            $ref: '#/components/responses/BadRequest',
          },
        },
      },
    },
    '/bridge/check-btc-deposits': {
      get: {
        tags: ['Bridge'],
        summary: 'Check BTC deposits',
        description: 'Get all BTC deposits and reconciliation info',
        operationId: 'checkBtcDeposits',
        responses: {
          200: {
            description: 'Deposit status retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    bridgeAddress: { type: 'string' },
                    deposits: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/BtcDeposit',
                      },
                    },
                    reconciliation: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/bridge/info': {
      get: {
        tags: ['Bridge'],
        summary: 'Get bridge information',
        description: 'Get current bridge status and configuration',
        operationId: 'getBridgeInfo',
        responses: {
          200: {
            description: 'Bridge info retrieved',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/BridgeInfo',
                },
              },
            },
          },
        },
      },
    },
    '/bridge/reserves': {
      get: {
        tags: ['Bridge'],
        summary: 'Get reserve status',
        description: 'Get current reserve balances for all assets',
        operationId: 'getReserves',
        responses: {
          200: {
            description: 'Reserve status retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    reserves: {
                      type: 'object',
                      properties: {
                        sol: { type: 'number' },
                        btc: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/bridge/transaction/{txId}': {
      get: {
        tags: ['Bridge'],
        summary: 'Get transaction details',
        description: 'Get details and history for a bridge transaction',
        operationId: 'getTransaction',
        parameters: [
          {
            name: 'txId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Transaction ID',
          },
        ],
        responses: {
          200: {
            description: 'Transaction details retrieved',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Transaction',
                },
              },
            },
          },
          404: {
            $ref: '#/components/responses/NotFound',
          },
        },
      },
    },
    '/bridge/proof/{txId}': {
      get: {
        tags: ['Admin'],
        summary: 'Get cryptographic proof',
        description: 'Get institutional-grade cryptographic proof for a transaction',
        operationId: 'getProof',
        security: [{ apiKey: [] }],
        parameters: [
          {
            name: 'txId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'format',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['full', 'audit', 'verification'],
              default: 'full',
            },
          },
        ],
        responses: {
          200: {
            description: 'Proof retrieved',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CryptographicProof',
                },
              },
            },
          },
          404: {
            $ref: '#/components/responses/NotFound',
          },
        },
      },
    },
    '/arcium/status': {
      get: {
        tags: ['Arcium'],
        summary: 'Get Arcium MPC status',
        description: 'Get current status of Arcium MPC service',
        operationId: 'getArciumStatus',
        responses: {
          200: {
            description: 'Arcium status retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    enabled: { type: 'boolean' },
                    connected: { type: 'boolean' },
                    mode: { type: 'string' },
                    features: {
                      type: 'object',
                      properties: {
                        encryptedAmounts: { type: 'boolean' },
                        privateVerification: { type: 'boolean' },
                        trustlessRandom: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Check system health status',
        operationId: 'healthCheck',
        responses: {
          200: {
            description: 'System healthy',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthStatus',
                },
              },
            },
          },
          503: {
            description: 'System unhealthy',
          },
        },
      },
    },
  },
  components: {
    schemas: {
      BridgeRequest: {
        type: 'object',
        required: ['solanaAddress', 'amount', 'bitcoinTxHash'],
        properties: {
          solanaAddress: {
            type: 'string',
            description: 'User Solana wallet address (base58)',
            pattern: '^[1-9A-HJ-NP-Za-km-z]{32,44}$',
          },
          amount: {
            type: 'number',
            description: 'Amount in BTC',
            minimum: 0.00001,
            maximum: 21000000,
          },
          bitcoinTxHash: {
            type: 'string',
            description: 'Bitcoin transaction hash',
            pattern: '^[a-fA-F0-9]{64}$',
          },
          depositAllocationId: {
            type: 'string',
            format: 'uuid',
            description: 'Deposit allocation ID (required when using unique addresses)',
          },
        },
      },
      BridgeResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          transactionId: { type: 'string' },
          amount: { type: 'number' },
          solanaAddress: { type: 'string' },
          status: {
            type: 'string',
            enum: ['pending', 'confirmed', 'processing', 'failed'],
          },
          solanaTxSignature: { type: 'string' },
          cryptographicProof: {
            type: 'object',
            properties: {
              transactionHash: { type: 'string' },
              signature: { type: 'string' },
              verificationUrl: { type: 'string' },
            },
          },
          bitcoinVerification: {
            type: 'object',
            properties: {
              verified: { type: 'boolean' },
              txHash: { type: 'string' },
              amount: { type: 'number' },
              confirmations: { type: 'integer' },
            },
          },
        },
      },
      BtcDeposit: {
        type: 'object',
        properties: {
          txHash: { type: 'string' },
          amountBTC: { type: 'number' },
          amountSatoshis: { type: 'integer' },
          confirmations: { type: 'integer' },
          status: {
            type: 'string',
            enum: ['pending', 'confirmed', 'processed', 'failed'],
          },
          detectedAt: { type: 'string', format: 'date-time' },
        },
      },
      BridgeInfo: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          network: { type: 'string' },
          programId: { type: 'string' },
          treasury: { type: 'string' },
          treasuryBalanceSOL: { type: 'number' },
          bitcoin: {
            type: 'object',
            properties: {
              network: { type: 'string' },
              bridgeAddress: { type: 'string' },
              currentReserve: { type: 'number' },
            },
          },
        },
      },
      Transaction: {
        type: 'object',
        properties: {
          transaction_id: { type: 'string' },
          transaction_type: { type: 'string' },
          status: { type: 'string' },
          solana_address: { type: 'string' },
          amount: { type: 'number' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      CryptographicProof: {
        type: 'object',
        properties: {
          transactionId: { type: 'string' },
          transactionHash: { type: 'string' },
          signature: {
            type: 'object',
            properties: {
              algorithm: { type: 'string' },
              value: { type: 'string' },
              publicKey: { type: 'string' },
            },
          },
          merkleProof: {
            type: 'object',
            properties: {
              merkleRoot: { type: 'string' },
              proof: { type: 'array', items: { type: 'string' } },
            },
          },
          metadata: { type: 'object' },
        },
      },
      HealthStatus: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded', 'down'] },
          relayerActive: { type: 'boolean' },
          arciumMPC: { type: 'boolean' },
          database: { type: 'boolean' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
          code: { type: 'string' },
        },
      },
    },
    securitySchemes: {
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'Admin API key for protected endpoints',
      },
      clientSignature: {
        type: 'apiKey',
        in: 'header',
        name: 'x-client-signature',
        description: 'Client signature for mutation operations',
      },
    },
    responses: {
      BadRequest: {
        description: 'Bad request - invalid input',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              error: 'Validation failed',
              message: 'solanaAddress is required',
            },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              error: 'Not found',
              message: 'Transaction not found',
            },
          },
        },
      },
      RateLimited: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              error: 'Too many requests',
              retryAfter: 60,
            },
          },
        },
      },
      InsufficientReserves: {
        description: 'Insufficient reserves',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              error: 'Insufficient SOL reserves',
              requested: 1.5,
              available: 0.5,
            },
          },
        },
      },
    },
  },
};

// Serve OpenAPI spec as JSON
router.get('/openapi.json', (req, res) => {
  res.json(openApiSpec);
});

// Serve Swagger UI HTML
router.get('/', (req, res) => {
  const swaggerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FLASH Bridge API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css">
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 30px 0; }
    .swagger-ui .info .title { color: #3b82f6; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/v1/docs/openapi.json',
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: 'BaseLayout',
        deepLinking: true,
        showExtensions: true,
        showCommonExtensions: true,
      });
    };
  </script>
</body>
</html>
  `;
  res.type('html').send(swaggerHtml);
});

module.exports = router;
module.exports.openApiSpec = openApiSpec;


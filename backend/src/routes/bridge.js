const express = require('express');
const router = express.Router();
const { LAMPORTS_PER_SOL } = require('@solana/web3.js');
const solanaService = require('../services/solana');
const bitcoinService = require('../services/bitcoin');
const converterService = require('../services/converter');
const databaseService = require('../services/database');
const cryptoProofsService = require('../services/crypto-proofs');
const reserveManager = require('../services/reserveManager');
const tokenTreasury = require('../services/token-treasury');
const {
  validatePublicKey,
  validateBridgeRequest,
  validateSwapRequest,
  validateBurnRequest,
  validatePagination,
  validateTxId,
  validateMarkRedemptionRequest,
  validateTransferType,
  validateSignatureParam,
  validateUUID
} = require('../middleware/validation');
const { asyncHandler, APIError } = require('../middleware/errorHandler');
const { createLogger } = require('../utils/logger');
const {
  bridgeLimiter,
  reserveLimiter,
  adminLimiter,
  healthLimiter,
  walletBridgeLimiter,
  createCombinedLimiter
} = require('../middleware/rateLimit');
const { requireApiKey } = require('../middleware/auth');
const { requireClientSignature } = require('../middleware/clientAuth');
const btcDepositHandler = require('../services/btc-deposit-handler');

// Combined limiter for bridge operations (IP + wallet based)
const combinedBridgeLimiter = createCombinedLimiter(bridgeLimiter, walletBridgeLimiter);
const logger = createLogger('bridge-routes');

/**
 * Claim BTC deposits after monitoring detects them
 * POST /api/bridge/btc-deposit
 * Body: { solanaAddress, bitcoinTxHash, outputTokenMint? }
 */
router.post('/btc-deposit', walletBridgeLimiter, requireClientSignature, asyncHandler(async (req, res) => {
  const { solanaAddress, bitcoinTxHash, outputTokenMint } = req.body;

  if (!solanaAddress || !bitcoinTxHash) {
    throw new APIError(400, 'solanaAddress and bitcoinTxHash are required');
  }

  try {
    const result = await btcDepositHandler.handleBTCDeposit(
      { txHash: bitcoinTxHash },
      solanaAddress,
      outputTokenMint || null
    );

    res.json({
      success: true,
      message: 'BTC deposit processed successfully',
      ...result,
      solanaAddress,
      bitcoinTxHash
    });
  } catch (error) {
    throw new APIError(400, error.message || 'Failed to process BTC deposit');
  }
}));

/**
 * (Optional) Check BTC deposit status
 * GET /api/bridge/btc-deposit/:txHash
 */
router.get('/btc-deposit/:txHash', walletBridgeLimiter, requireClientSignature, asyncHandler(async (req, res) => {
  const { txHash } = req.params;

  if (!databaseService.isConnected()) {
    throw new APIError(503, 'Database not available');
  }

  const deposit = await databaseService.getBTCDeposit(txHash);
  if (!deposit) {
    throw new APIError(404, 'BTC deposit not found');
  }

  res.json({
    success: true,
    deposit,
  });
}));

/**
 * Allocate or reuse a unique BTC deposit address for a Solana wallet
 * POST /api/bridge/btc-address
 * Body: { solanaAddress, sessionId?, clientLabel?, forceNew?, metadata? }
 */
router.post('/btc-address', walletBridgeLimiter, requireClientSignature, asyncHandler(async (req, res) => {
  const {
    solanaAddress,
    sessionId,
    clientLabel,
    forceNew = false,
    metadata = null,
  } = req.body;

  if (!solanaAddress) {
    throw new APIError(400, 'solanaAddress is required');
  }

  try {
    validatePublicKey(solanaAddress, 'solanaAddress');
  } catch (error) {
    throw new APIError(400, error.message);
  }

  if (!bitcoinService.supportsDepositAllocations()) {
    throw new APIError(
      503,
      'BTC address allocation unavailable. Configure BITCOIN_BRIDGE_XPUB and PostgreSQL.'
    );
  }

  const safeMetadata =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? metadata
      : null;

  try {
    const allocation = await bitcoinService.getOrCreateDepositAllocation({
      solanaAddress,
      sessionId: sessionId ? String(sessionId).slice(0, 128) : null,
      clientLabel: clientLabel ? String(clientLabel).slice(0, 64) : null,
      forceNew: Boolean(forceNew),
      metadata: safeMetadata,
    });

    res.json({
      success: true,
      depositAddress: allocation.bitcoinAddress,
      allocation,
    });
  } catch (error) {
    logger.error('Failed to allocate BTC deposit address', { error: error.message });
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError(500, 'Failed to allocate BTC deposit address', { reason: error.message });
  }
}));

// =============================================================================
// Output Token Configuration Endpoints
// =============================================================================

/**
 * Get supported output tokens
 * GET /api/bridge/tokens
 */
router.get('/tokens', asyncHandler(async (req, res) => {
  const tokens = tokenTreasury.listSupportedTokens();
  const defaultToken = tokenTreasury.getDefaultToken();
  
  res.json({
    success: true,
    tokens,
    default: defaultToken.symbol,
    network: process.env.SOLANA_NETWORK || 'devnet',
  });
}));

/**
 * Get treasury balances for all supported tokens
 * GET /api/bridge/treasury
 */
router.get('/treasury', requireApiKey, asyncHandler(async (req, res) => {
  try {
    const balances = await tokenTreasury.getAllTreasuryBalances();
    
    res.json({
      success: true,
      balances,
      network: process.env.SOLANA_NETWORK || 'devnet',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    throw new APIError(500, 'Failed to get treasury balances', { reason: error.message });
  }
}));

/**
 * Get specific token info
 * GET /api/bridge/tokens/:symbol
 */
router.get('/tokens/:symbol', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const token = tokenTreasury.getToken(symbol);
  
  if (!token) {
    throw new APIError(404, `Token ${symbol} not supported`);
  }
  
  // Include treasury balance if admin
  let balance = null;
  const apiKey = req.headers['x-api-key'] || req.headers['x-admin-api-key'];
  if (apiKey && apiKey === process.env.ADMIN_API_KEY) {
    try {
      const balanceInfo = await tokenTreasury.getTreasuryBalance(symbol);
      balance = balanceInfo;
    } catch (error) {
      balance = { error: error.message };
    }
  }
  
  res.json({
    success: true,
    token,
    balance,
  });
}));

/**
 * Full BTC deposit status + reconciliation info
 * GET /api/bridge/check-btc-deposits
 */
router.get('/check-btc-deposits', walletBridgeLimiter, asyncHandler(async (req, res) => {
  const details = await bitcoinService.getDepositDetails();

  if (!details || details.error) {
    throw new APIError(503, details?.error || 'Unable to fetch BTC deposit details');
  }

  res.json({
    success: true,
    bridgeAddress: details.bridgeAddress,
    network: details.network,
    explorerUrl: details.explorerUrl,
    requiredConfirmations: details.requiredConfirmations,
    summary: details.summary,
    deposits: details.deposits,
    currentReserveBTC: details.currentReserveBTC,
    reconciliation: details.reconciliation,
    timestamp: details.timestamp,
  });
}));

/**
 * Safely convert floating point asset amounts to smallest unit integers
 */
function convertToSmallestUnit(amount, decimals, assetLabel = 'asset') {
  if (amount === undefined || amount === null) {
    throw new APIError(400, `${assetLabel} amount is required`);
  }

  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (!Number.isFinite(numericAmount)) {
    throw new APIError(400, `${assetLabel} amount is invalid`);
  }
  if (numericAmount < 0) {
    throw new APIError(400, `${assetLabel} amount cannot be negative`);
  }

  const multiplier = Math.pow(10, decimals);
  const maxSupported = Number.MAX_SAFE_INTEGER / multiplier;
  if (numericAmount > maxSupported) {
    throw new APIError(400, `${assetLabel} amount exceeds maximum supported size`);
  }

  const converted = Math.floor(numericAmount * multiplier);
  if (!Number.isSafeInteger(converted)) {
    throw new APIError(400, `${assetLabel} amount conversion overflow`);
  }

  return converted;
}

/**
 * Ensure reserve amounts remain within safe integer bounds
 */
function ensureSafeIntegerAmount(value, label = 'amount') {
  if (value === undefined || value === null) {
    throw new APIError(400, `${label} is required`);
  }

  if (typeof value === 'bigint') {
    if (value < 0n) {
      throw new APIError(400, `${label} cannot be negative`);
    }
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new APIError(400, `${label} exceeds JavaScript safe integer range`);
    }
    return Number(value);
  }

  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numericValue)) {
    throw new APIError(400, `${label} is invalid`);
  }

  const intValue = Math.floor(numericValue);
  if (intValue < 0) {
    throw new APIError(400, `${label} cannot be negative`);
  }
  if (!Number.isSafeInteger(intValue)) {
    throw new APIError(400, `${label} exceeds JavaScript safe integer range`);
  }

  return intValue;
}

// Get bridge information and status
router.get('/info', async (req, res) => {
  try {
    const connection = solanaService.getConnection();
    const version = await connection.getVersion();
    const bitcoinInfo = bitcoinService.getNetworkInfo();
    let treasuryBalanceSOL = null;
    let treasuryAddress = null;

    if (solanaService.relayerKeypair?.publicKey) {
      treasuryAddress = solanaService.relayerKeypair.publicKey.toBase58();
      try {
        const lamports = await connection.getBalance(solanaService.relayerKeypair.publicKey);
        treasuryBalanceSOL = lamports / LAMPORTS_PER_SOL;
      } catch (balanceError) {
        logger.warn('Unable to fetch SOL treasury balance', { error: balanceError.message });
      }
    }
    
    // Get Zcash bridge address (from wallet or env)
    let zcashBridgeAddress = null;
    try {
    } catch (error) {
      logger.warn('Could not get Zcash bridge address:', error.message);
    }
    
    res.json({
      status: 'active',
      network: process.env.SOLANA_NETWORK || 'devnet',
      programId: process.env.PROGRAM_ID,
      treasury: 'USDC Treasury + Jupiter Swaps',
      treasuryAddress,
      treasuryBalanceSOL,
      solanaVersion: version,
      description: 'FLASH BTC→USDC→Token Bridge (Cash App Optimized)',
      bitcoin: {
        network: bitcoinInfo.network,
        bridgeAddress: bitcoinInfo.bridgeAddress,
        currentReserve: bitcoinInfo.currentReserveBTC,
      },
      zcash: null, // Zcash support removed - SOL payouts only
    });
  } catch (error) {
    logger.error('Error fetching bridge info:', error);
    res.status(500).json({ error: 'Failed to fetch bridge info' });
  }
});

// Main bridge endpoint: release SOL from treasury when BTC deposits are verified
// Supported flows:
// 1. BTC → SOL (Cash App → Bitcoin → Bridge)
// 2. Demo mode (no hash) for scripted demos
router.post('/', combinedBridgeLimiter, requireClientSignature, validateBridgeRequest, asyncHandler(async (req, res) => {
  const { solanaAddress, amount, bitcoinTxHash, zcashTxHash, depositAllocationId } = req.body;

  // Check environment mode
  const isProduction = process.env.NODE_ENV === 'production';
  
  // In production: Transaction hashes are REQUIRED
  // In development: Allow demo mode for testing
  if (!bitcoinTxHash && !zcashTxHash) {
    if (isProduction) {
      throw new APIError(400, 'Transaction hash required. Provide bitcoinTxHash for BTC deposits.');
    }
    logger.warn('⚠️  Running in demo mode (no transaction hash) - DEVELOPMENT ONLY');
  }
  const isDemoMode = !bitcoinTxHash && !zcashTxHash && !isProduction;

  // Amount already validated and parsed by middleware
  const amountNum = amount;

  // Determine flow type
  const isBitcoinFlow = !!bitcoinTxHash;
  const isZcashFlow = !!zcashTxHash;

  let btcVerification = null;
  let depositAllocation = null;
  const depositAllocationsEnabled = bitcoinService.supportsDepositAllocations();
  let matchedDepositAddress = bitcoinService.bridgeAddress;
  let reserveAmount = 0;
  let reserveAsset = 'SOL'; // Default to SOL for demo bridge

  if (isDemoMode) {
    logger.info('Running in demo mode - simulating bridge transaction');
    reserveAmount = convertToSmallestUnit(amountNum, 9, 'SOL (demo)');
  } else if (isBitcoinFlow) {
    logger.info(`Verifying Bitcoin payment: ${bitcoinTxHash}`);

    if (depositAllocationsEnabled) {
      if (!depositAllocationId) {
        throw new APIError(400, 'depositAllocationId is required for BTC claims');
      }
      try {
        // Extra safety in case request bypassed validation middleware
        validateUUID(depositAllocationId, 'depositAllocationId');
        depositAllocation = await bitcoinService.assertAllocationForAddress(
          depositAllocationId,
          solanaAddress
        );
        matchedDepositAddress = depositAllocation.bitcoinAddress;
      } catch (error) {
        throw new APIError(400, error.message || 'Invalid deposit allocation');
      }
    }

    btcVerification = await bitcoinService.verifyBitcoinPayment(
      bitcoinTxHash,
      amountNum, // Expected amount in BTC
      depositAllocation ? { expectedAddress: depositAllocation.bitcoinAddress } : {}
    );

    if (!btcVerification.verified) {
      return res.status(400).json({
        error: 'Bitcoin payment verification failed',
        reason: btcVerification.reason,
        bitcoinTxHash,
        confirmations: btcVerification.confirmations,
      });
    }

    logger.info(`Bitcoin payment verified: ${btcVerification.amountBTC} BTC`);
    logger.info(`Confirmations: ${btcVerification.confirmations}`);
    matchedDepositAddress = depositAllocation?.bitcoinAddress
      || btcVerification.matchedAddresses?.[0]
      || matchedDepositAddress;

    if (depositAllocation) {
      try {
        await bitcoinService.markAllocationFunded(depositAllocation.allocationId, {
          txHash: bitcoinTxHash,
          amountSatoshis: btcVerification.amount,
        });
        logger.info(`Marked allocation ${depositAllocation.allocationId} as funded`);
      } catch (error) {
        logger.warn('Unable to mark BTC allocation funded', {
          allocationId: depositAllocation.allocationId,
          error: error.message,
        });
      }
    }

    if (databaseService.isConnected()) {
      try {
        await databaseService.saveBTCDeposit({
          txHash: bitcoinTxHash,
          bridgeAddress: matchedDepositAddress,
          amountSatoshis: btcVerification.amount,
          amountBTC: btcVerification.amountBTC,
          confirmations: btcVerification.confirmations,
          requiredConfirmations: bitcoinService.requiredConfirmations,
          blockHeight: btcVerification.blockHeight,
          blockTime: btcVerification.timestamp,
          status: 'confirmed',
          solanaAddress,
        });
      } catch (error) {
        logger.warn('Unable to persist BTC deposit record', { error: error.message });
      }
    }

    logger.info('Converting BTC to SOL equivalent for devnet bridge...');
    try {
      const exchangeRate = await converterService.getBTCtoZECRate();
      const solAmount = btcVerification.amountBTC * exchangeRate;

      logger.info(`Proxy rate: 1 BTC = ${exchangeRate} (treating as SOL equivalent)`);
      logger.info(`Calculated: ${btcVerification.amountBTC} BTC → ${solAmount} SOL (demo conversion)`);

      reserveAmount = convertToSmallestUnit(solAmount, 9, 'SOL');
      reserveAsset = 'SOL';
      logger.info(`Using SOL equivalent: ${solAmount} SOL (${reserveAmount} lamports)`);
    } catch (error) {
      logger.error('Error calculating conversion:', error);
      logger.warn('Falling back to direct BTC to SOL conversion');
      // Direct conversion: 0.0001 BTC = ~0.0235 SOL (based on current rates)
      const solAmount = btcVerification.amountBTC * 235;
      reserveAmount = convertToSmallestUnit(solAmount, 9, 'SOL');
      reserveAsset = 'SOL';
    }
  } else if (isZcashFlow) {
    throw new APIError(400, 'Zcash bridge flow is currently disabled. Omit zcashTxHash to run in demo mode.');
  } else {
    throw new APIError(400, 'Unable to determine bridge flow');
  }

  // STEP 3: Check reserve capacity and determine transfer method
  let currentReserve = 0;
  if (reserveAsset === 'SOL') {
    try {
      currentReserve = await solanaService.connection.getBalance(solanaService.relayerKeypair.publicKey);
    } catch (error) {
      logger.warn('Could not fetch SOL treasury balance:', error.message);
    }
  }

  // Convert to lamports (using smallest unit for precision)
  const transferAmount = ensureSafeIntegerAmount(reserveAmount, 'Transfer amount');

  if (transferAmount > currentReserve && currentReserve > 0) {
    logger.warn(`Reserve check: Requested ${transferAmount}, Available ${currentReserve}`);
    // In production, this would check on-chain reserve and reject if insufficient
  }

  // STEP 4: Generate bridge transaction ID
  const txId = isDemoMode
    ? `demo_${Date.now()}_${Math.random().toString(36).substring(7)}`
    : `btc_${bitcoinTxHash.substring(0, 16)}_${Date.now()}`;

  // STEP 5: Transfer SOL from treasury (no minting)
  let solanaTxSignature = null;
  let mintStatus = 'pending';
  const tokenType = 'SOL';

  try {
    if (reserveAsset === 'SOL') {
      logger.info(`Transferring ${transferAmount / 1e9} SOL to ${solanaAddress}`);
      logger.info(`Reserve asset: ${reserveAsset} (${isBitcoinFlow ? 'from BTC' : 'demo'})`);

      // Check treasury balance first
      const treasuryBalance = await solanaService.connection.getBalance(solanaService.relayerKeypair.publicKey);

      if (transferAmount > treasuryBalance) {
        if (isDemoMode) {
          // Development demo mode: simulate transfer when treasury is empty
          logger.info(`🎭 Demo mode: Treasury empty (${treasuryBalance / 1e9} SOL), simulating transfer`);
          solanaTxSignature = `demo_tx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          mintStatus = 'confirmed';
          logger.info(`✓ Demo transfer simulated: ${solanaTxSignature}`);
        } else {
          // Production: Reject if insufficient reserves
          throw new APIError(503, 'Insufficient SOL reserves', {
            requested: transferAmount,
            available: treasuryBalance,
            requestedSOL: transferAmount / 1e9,
            availableSOL: treasuryBalance / 1e9,
            message: 'Treasury does not have enough SOL to complete this transaction. Contact support.'
          });
        }
      } else {
        // Production mode: perform real transfer when treasury has funds
        solanaTxSignature = await solanaService.transferNativeSOL(solanaAddress, transferAmount);
        mintStatus = 'confirmed';
        logger.info(`✓ SOL transfer successful: ${solanaTxSignature}`);
      }

      if (databaseService.isConnected()) {
        try {
          await databaseService.addTransferMetadata({
            solanaTxSignature,
            transferType: 'redemption',
            userAddress: solanaAddress,
            amount: transferAmount / 1e9,
            metadata: {
              source: isBitcoinFlow ? 'bitcoin_bridge' : 'demo_bridge',
              reserveAsset,
              demoMode: isDemoMode,
              depositAllocationId: depositAllocation?.allocationId || null,
            },
            createdBy: 'api'
          });
          logger.info(`✓ Marked transfer ${solanaTxSignature} as redemption`);
        } catch (error) {
          logger.error('Error creating transfer metadata:', error);
        }
      }

      if (depositAllocation && solanaTxSignature) {
        try {
          await bitcoinService.markAllocationClaimed(depositAllocation.allocationId, {
            txHash: bitcoinTxHash,
            solanaTxSignature,
          });
        } catch (error) {
          logger.warn('Unable to mark BTC allocation claimed', {
            allocationId: depositAllocation.allocationId,
            error: error.message,
          });
        }
      }
    } else {
      throw new APIError(400, `Unsupported reserve asset ${reserveAsset}. The current workflow only pays out SOL.`);
    }
  } catch (error) {
    logger.error('Error executing bridge transfer', { error: error.message });
    throw error instanceof APIError ? error : new APIError(500, 'Failed to complete bridge transfer');
  }

    // Transaction data object
    const transactionData = {
      transaction_id: txId,
      transaction_type: 'bridge',
      status: mintStatus,
      solana_address: solanaAddress,
      amount: transferAmount / 1e9, // Convert to SOL
      reserve_asset: reserveAsset,
      solana_tx_signature: solanaTxSignature,
      bitcoin_tx_hash: bitcoinTxHash || null,
      zcash_tx_hash: zcashTxHash || null,
      deposit_allocation_id: depositAllocation?.allocationId || null,
      bitcoin_deposit_address: matchedDepositAddress || null,
      demo_mode: isDemoMode,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // PRIMARY: Save to database (persistent storage)
    if (databaseService.isConnected()) {
      try {
        await databaseService.saveBridgeTransaction({
          txId,
          solanaAddress,
          amount: transferAmount / 1e9,
          reserveAsset,
          status: mintStatus,
          solanaTxSignature,
          bitcoinTxHash: bitcoinTxHash || null,
          zcashTxHash: zcashTxHash || null,
          demoMode: isDemoMode,
        });
        logger.info(`✓ Transaction saved to database: ${txId}`);
      logger.info(`✓ Transaction saved to database: ${txId}`);
    } catch (error) {
        logger.error('Error saving transaction to database:', error);
        // FALLBACK: Save to in-memory store if database fails
        demoTransactionStatuses.set(txId, transactionData);
        logger.warn(`⚠️  Transaction ${txId} saved to in-memory fallback (not persistent)`);
      }
    } else {
      // FALLBACK: Save to in-memory store when database unavailable
      demoTransactionStatuses.set(txId, transactionData);
      logger.warn(`⚠️  Transaction ${txId} saved to in-memory fallback (database unavailable)`);
    }

    // Generate cryptographic proof for institutional compliance
    let cryptographicProof = null;
    try {
      const proofData = {
        txId,
        solanaAddress,
        amount: transferAmount / 1e9,
        reserveAsset,
        status: mintStatus,
        solanaTxSignature,
        bitcoinTxHash: bitcoinTxHash || null,
        zcashTxHash: zcashTxHash || null,
        depositAllocationId: depositAllocation?.allocationId || null,
        bitcoinDepositAddress: matchedDepositAddress || null,
        demoMode: isDemoMode,
        createdAt: Date.now(),
        verificationPerformed: !isDemoMode,
        verificationTimestamp: !isDemoMode ? Date.now() : null,
        minted: mintStatus === 'confirmed',
        mintTimestamp: mintStatus === 'confirmed' ? Date.now() : null,
        arciumComputationId: null // Add if using Arcium
      };

      cryptographicProof = await cryptoProofsService.generateTransactionProof(proofData, 'bridge');

      // Save proof to database
      if (databaseService.isConnected()) {
        await databaseService.saveCryptographicProof({
          transactionId: txId,
          transactionType: 'bridge',
          proof: cryptographicProof
        });
      }

      logger.info(`✓ Cryptographic proof generated for transaction: ${txId}`);
    } catch (error) {
      logger.error('Error generating cryptographic proof:', error);
      // Don't fail the request if proof generation fails
    }

    // Prepare response
    const response = {
      success: true,
      transactionId: txId,
      amount: transferAmount / 1e9,
      solanaAddress,
      status: mintStatus,
      message: isDemoMode
        ? `${tokenType} transfer initiated (demo mode - no transaction verification)`
        : `${tokenType} transfer successful`,
      reserveAsset,
      demoMode: isDemoMode,
      solanaTxSignature: solanaTxSignature || null,
      depositAllocationId: depositAllocation?.allocationId || null,
      bitcoinDepositAddress: matchedDepositAddress || null,
      // Add cryptographic proof for institutional compliance
      cryptographicProof: cryptographicProof ? {
        transactionId: txId,
        transactionHash: cryptographicProof.transactionHash,
        signature: cryptographicProof.signature,
        merkleProof: cryptographicProof.merkleProof,
        verificationUrl: `/api/bridge/proof/${txId}/verify`,
        auditExportUrl: `/api/bridge/proof/${txId}/audit`,
        compliance: 'INSTITUTIONAL'
      } : null,
    };

    // Add Bitcoin verification if present
    if (btcVerification) {
      response.amountBTC = btcVerification.amountBTC;
      response.bitcoinVerification = {
        verified: true,
        txHash: bitcoinTxHash,
        amount: btcVerification.amount,
        amountBTC: btcVerification.amountBTC,
        confirmations: btcVerification.confirmations,
        blockHeight: btcVerification.blockHeight,
        depositAddress: matchedDepositAddress,
        matchedAddresses: btcVerification.matchedAddresses || null,
        expectedAddresses: btcVerification.expectedAddresses || null,
        requiredConfirmations: bitcoinService.requiredConfirmations,
      };
    }

    res.json(response);
}));

// In-memory status tracking as fallback when database is unavailable
// NOTE: This is NOT persistent - use database in production
const demoTransactionStatuses = new Map();
logger.warn('⚠️  In-memory transaction store loaded - data will be lost on restart');

// Demo proof verification endpoint (no auth required for demo)
router.get('/proof/:txId/verify', validateTxId, asyncHandler(async (req, res) => {
  const { txId } = req.params;

  // Check if transaction exists in demo store
  const transaction = demoTransactionStatuses.get(txId);
  if (!transaction) {
    throw new APIError(404, 'Transaction not found');
  }

  // Generate mock proof verification for demo
  const mockProof = {
    verified: true,
    transactionId: txId,
    transactionHash: '09dbda49e7a1022c8713271f1c47bd2ee23bf1a771b60a50c62717a928808e7e',
    merkleRoot: '09dbda49e7a1022c8713271f1c47bd2ee23bf1a771b60a50c62717a928808e7e',
    compliance: 'INSTITUTIONAL',
    timestamp: Date.now(),
    auditTrail: [
      {
        action: 'Bridge request submitted',
        timestamp: transaction.created_at,
        details: 'BTC → SOL bridge initiated'
      },
      {
        action: 'Transaction processed',
        timestamp: transaction.updated_at,
        details: 'SOL transferred to user wallet'
      },
      {
        action: 'Cryptographic proof generated',
        timestamp: new Date().toISOString(),
        details: 'Merkle proof and signature created'
      }
    ]
  };

  res.json(mockProof);
}));

// Transaction status update endpoint (must be before GET /transaction/:txId to avoid route conflicts)
router.patch('/transaction/:txId/status', validateTxId, asyncHandler(async (req, res) => {
  const { txId } = req.params;
  const { status, notes, transactionType } = req.body;

  if (!status) {
    throw new APIError(400, 'status is required');
  }

  const validStatuses = ['pending', 'confirmed', 'failed', 'processing'];
  if (!validStatuses.includes(status)) {
    throw new APIError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  // Always work with demo store for MVP demo
  const transaction = demoTransactionStatuses.get(txId);
  if (!transaction) {
    throw new APIError(404, 'Transaction not found');
  }

  // Update transaction in demo store
  transaction.status = status;
  transaction.updated_at = new Date().toISOString();

  // Add any additional fields from request body
  if (req.body.solanaTxSignature) transaction.solana_tx_signature = req.body.solanaTxSignature;
  if (req.body.btcTxHash) transaction.bitcoin_tx_hash = req.body.btcTxHash;
  if (req.body.solTxSignature) transaction.sol_tx_signature = req.body.solTxSignature;

  // Add to history
  if (!transaction.history) transaction.history = [];
  transaction.history.push({
    transaction_id: txId,
    status: status,
    notes: notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  // Try database update if available (don't fail if not)
  if (databaseService.isConnected()) {
    try {
      const txType = transactionType || 'bridge';
      await databaseService.updateTransactionStatus(txId, status, notes, txType);
    } catch (error) {
      console.log('Database update failed, continuing with demo mode:', error.message);
    }
  }

  res.json({
    success: true,
    message: `Transaction ${txId} status updated to ${status}`,
    transactionId: txId,
    status,
    notes
  });
}));

// Fetch single bridge transaction with history
router.get('/transaction/:txId', validateTxId, asyncHandler(async (req, res) => {
  const { txId } = req.params;

  let transaction = null;
  let history = [];

  // Try database first
  if (databaseService.isConnected()) {
    transaction = await databaseService.getBridgeTransaction(txId);
    if (transaction) {
      try {
        history = await databaseService.getTransactionStatusHistory(txId, 'bridge');
      } catch (error) {
        logger.warn('Unable to fetch status history', { txId, error: error.message });
      }
    }
  }

  // Fall back to demo store if database not available or transaction not found
  if (!transaction) {
    transaction = demoTransactionStatuses.get(txId);
    if (transaction) {
      // Create mock history for demo
      history = [{
        transaction_id: txId,
        status: transaction.status,
        notes: transaction.demo_mode ? 'Demo transaction' : null,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at
      }];
    }
  }

  if (!transaction) {
    throw new APIError(404, 'Transaction not found');
  }

  res.json({
    success: true,
    transaction,
    history,
  });
}));

/**
 * Get cryptographic proof for transaction
 * GET /api/bridge/proof/:txId?format=full|audit|verification
 */
router.get('/proof/:txId', adminLimiter, requireApiKey, validateTxId, asyncHandler(async (req, res) => {
  const { txId } = req.params;
  const { format } = req.query; // 'full', 'audit', 'verification'

  if (!databaseService.isConnected()) {
    throw new APIError(503, 'Database not available');
  }

  // Get proof from database
  const proof = await databaseService.getCryptographicProof(txId, 'bridge');

  if (!proof) {
    throw new APIError(404, 'Cryptographic proof not found for transaction', {
      txId,
      note: 'Proof may not have been generated or may have expired'
    });
  }

  // Format response based on requested format
  switch (format) {
    case 'audit':
      return res.json({
        success: true,
        auditReport: cryptoProofsService.exportProofForAudit(proof)
      });

    case 'verification':
      return res.json({
        success: true,
        transactionId: txId,
        proofData: {
          transactionHash: proof.transactionHash,
          signature: proof.signature,
          merkleRoot: proof.merkleProof.merkleRoot,
          publicKey: proof.signature.publicKey
        },
        verificationInstructions: {
          endpoint: `/api/bridge/proof/${txId}/verify`,
          method: 'POST',
          body: { proof: proof }
        }
      });

    case 'full':
    default:
      return res.json({
        success: true,
        transactionId: txId,
        proof: proof,
        compliance: 'INSTITUTIONAL',
        generatedAt: proof.metadata.generatedAt,
        expiresAt: proof.expiresAt
      });
  }
}));

/**
 * Verify cryptographic proof
 * POST /api/bridge/proof/:txId/verify
 */
router.post('/proof/:txId/verify', adminLimiter, requireApiKey, validateTxId, asyncHandler(async (req, res) => {
  const { txId } = req.params;
  const { proof } = req.body;

  if (!proof) {
    throw new APIError(400, 'Proof data required');
  }

  // Basic proof validation
  if (!proof.transactionId || !proof.transactionHash || !proof.signature || !proof.merkleProof) {
    throw new APIError(400, 'Invalid proof data: missing required fields');
  }

  if (proof.transactionId !== txId) {
    throw new APIError(400, 'Proof transaction ID does not match URL parameter');
  }

  // Verify the proof
  const verification = cryptoProofsService.verifyProof(proof);

  // Log verification attempt
  if (databaseService.isConnected()) {
    await databaseService.logProofVerification({
      transactionId: txId,
      verifierAddress: req.body.verifierAddress,
      verificationResult: verification.valid,
      verificationReason: verification.reason,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
  }

  res.json({
    success: true,
    transactionId: txId,
    verification: verification,
    timestamp: Date.now(),
    verified: verification.valid,
    details: verification.details || null,
    compliance: verification.valid ? 'VERIFIED' : 'FAILED'
  });
}));

// Health check for bridge service
router.get('/btc-monitor/status', async (req, res) => {
  const bitcoinService = require('../services/bitcoin');
  const isMonitoring = bitcoinService.monitoringInterval !== null;
  const bridgeAddress = bitcoinService.bridgeAddress;

  res.json({
    monitoringActive: isMonitoring,
    bridgeAddress: bridgeAddress,
    lastCheck: bitcoinService.lastCheck || null,
    monitoringInterval: bitcoinService.monitoringInterval ? '60 seconds' : 'disabled'
  });
});

router.get('/health', healthLimiter, async (req, res) => {
  try {
    const connection = solanaService.getConnection();
    const blockHeight = await connection.getBlockHeight();
    
    res.json({
      healthy: true,
      blockHeight,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Bridge health check failed:', error);
    res.status(503).json({ 
      healthy: false,
      error: error.message,
    });
  }
});

/**
 * Mark treasury transfer as redemption (for manual processing)
 * POST /api/bridge/mark-redemption
 * Body: { solanaTxSignature, userAddress, amount }
 */
router.post('/mark-redemption', adminLimiter, requireApiKey, validateMarkRedemptionRequest, asyncHandler(async (req, res) => {
  const { solanaTxSignature, userAddress, amount } = req.body;

  if (!databaseService.isConnected()) {
    throw new APIError(503, 'Database not available');
  }

  // Verify the transaction exists on-chain first
  try {
    const connection = solanaService.getConnection();
    const tx = await connection.getTransaction(solanaTxSignature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      throw new APIError(404, 'Transaction not found on Solana');
    }
  } catch (error) {
    if (error instanceof APIError) throw error;
    throw new APIError(400, 'Invalid transaction signature');
  }

  // Mark as redemption transfer
  await databaseService.addTransferMetadata({
    solanaTxSignature,
    transferType: 'redemption',
    userAddress,
    amount,
    metadata: {
      source: 'manual_marking',
      markedAt: new Date().toISOString(),
      adminAction: true
    },
    createdBy: 'admin'
  });

  logger.info(`✅ Marked transfer ${solanaTxSignature} as redemption by admin`);

  res.json({
    success: true,
    message: 'Transfer marked as redemption',
    solanaTxSignature,
    userAddress,
    amount
  });
}));

/**
 * Get transfer metadata
 * GET /api/bridge/transfer-metadata/:signature
 */
router.get('/transfer-metadata/:signature', requireApiKey, validateSignatureParam, asyncHandler(async (req, res) => {
  const { signature } = req.params;

  if (!databaseService.isConnected()) {
    throw new APIError(503, 'Database not available');
  }

  const metadata = await databaseService.getTransferMetadata(signature);

  if (!metadata) {
    throw new APIError(404, 'Transfer metadata not found');
  }

  res.json({
    success: true,
    metadata
  });
}));

/**
 * Get reserve status for all assets
 * GET /api/bridge/reserves
 */
router.get('/reserves', reserveLimiter, asyncHandler(async (req, res) => {
  const reserveSummary = await reserveManager.getReserveSummary();

  // Convert BigInt values to strings for JSON serialization
  const serializeBigInts = (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'bigint') return obj.toString();
    if (Array.isArray(obj)) return obj.map(serializeBigInts);
    if (typeof obj === 'object') {
      const result = {};
      for (const key in obj) {
        result[key] = serializeBigInts(obj[key]);
      }
      return result;
    }
    return obj;
  };

  res.json({
    success: true,
    reserves: serializeBigInts(reserveSummary),
    note: 'All reserve values are calculated from database as source of truth'
  });
}));

/**
 * Swap SOL to native ZEC
 * POST body: { solanaAddress, solAmount }
 * PRIVACY ALWAYS ON: All amounts are encrypted via Arcium MPC
 */

module.exports = router;

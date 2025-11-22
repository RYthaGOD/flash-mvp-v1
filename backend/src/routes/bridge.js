const express = require('express');
const router = express.Router();
const solanaService = require('../services/solana');
const zcashService = require('../services/zcash');
const bitcoinService = require('../services/bitcoin');
const converterService = require('../services/converter');
const databaseService = require('../services/database');
const {
  validateBridgeRequest,
  validateSwapRequest,
  validateBurnRequest,
  validatePagination,
  validateTxId,
} = require('../middleware/validation');
const { asyncHandler, APIError } = require('../middleware/errorHandler');

// Get bridge information and status
router.get('/info', async (req, res) => {
  try {
    const connection = solanaService.getConnection();
    const version = await connection.getVersion();
    const bitcoinInfo = bitcoinService.getNetworkInfo();
    const zcashInfo = await zcashService.getNetworkInfo();
    
    // Get Zcash bridge address (from wallet or env)
    let zcashBridgeAddress = null;
    try {
      zcashBridgeAddress = await zcashService.getBridgeAddress();
    } catch (error) {
      console.warn('Could not get Zcash bridge address:', error.message);
    }
    
    res.json({
      status: 'active',
      network: process.env.SOLANA_NETWORK || 'devnet',
      programId: process.env.PROGRAM_ID,
      zenZECMint: process.env.ZENZEC_MINT || 'Not configured',
      solanaVersion: version,
      description: 'FLASH BTC→ZEC→Solana Bridge (Cash App Optimized)',
      bitcoin: {
        network: bitcoinInfo.network,
        bridgeAddress: bitcoinInfo.bridgeAddress,
        currentReserve: bitcoinInfo.currentReserveBTC,
      },
      zcash: {
        network: zcashInfo.network,
        bridgeAddress: zcashBridgeAddress,
        walletEnabled: zcashInfo.walletEnabled || false,
        walletStatus: zcashInfo.wallet || null,
      },
    });
  } catch (error) {
    console.error('Error fetching bridge info:', error);
    res.status(500).json({ error: 'Failed to fetch bridge info' });
  }
});

// Main bridge endpoint: Mint zenZEC tokens
// Supports two flows:
// 1. BTC → zenZEC (Cash App → Bitcoin → Bridge)
// 2. ZEC → zenZEC (Direct Zcash → Bridge)
router.post('/', validateBridgeRequest, asyncHandler(async (req, res) => {
  const { solanaAddress, amount, swapToSol, bitcoinTxHash, zcashTxHash, useZecPrivacy } = req.body;

    // For MVP demo mode: transaction hashes are optional
    // If no hash provided, we'll simulate the bridge (demo mode)
    const isDemoMode = !bitcoinTxHash && !zcashTxHash;
    
    // Cannot provide both (already validated by middleware)

    // Amount already validated and parsed by middleware
    const amountNum = amount;

    // Determine flow type
    const isBitcoinFlow = !!bitcoinTxHash;
    const isZcashFlow = !!zcashTxHash;

    console.log(`Bridge request: ${amount} ${isBitcoinFlow ? 'BTC' : isZcashFlow ? 'ZEC' : 'zenZEC (demo)'} to ${solanaAddress}`);
    if (isBitcoinFlow) {
      console.log(`Bitcoin TX: ${bitcoinTxHash}`);
      console.log(`Use ZEC privacy: ${useZecPrivacy || false}`);
    } else if (isZcashFlow) {
      console.log(`Zcash TX: ${zcashTxHash}`);
    } else {
      console.log(`Demo mode: Simulating bridge without transaction verification`);
    }

    let btcVerification = null;
    let zecVerification = null;
    let reserveAmount = 0;
    let reserveAsset = 'ZEC'; // Default to ZEC for direct flow

    // DEMO MODE: No transaction hash provided (for MVP demo)
    if (isDemoMode) {
      console.log('Running in demo mode - simulating bridge transaction');
      // Convert amount to smallest unit (1:1 ratio for demo)
      reserveAmount = Math.floor(amountNum * 100000000); // Convert to smallest unit
      reserveAsset = 'ZEC'; // Default to ZEC for demo
    }
    // FLOW 1: Bitcoin → zenZEC (Cash App flow)
    else if (isBitcoinFlow) {
      // STEP 1: Verify Bitcoin payment
      console.log(`Verifying Bitcoin payment: ${bitcoinTxHash}`);
      btcVerification = await bitcoinService.verifyBitcoinPayment(
        bitcoinTxHash,
        amountNum // Expected amount in BTC
      );

      if (!btcVerification.verified) {
        return res.status(400).json({
          error: 'Bitcoin payment verification failed',
          reason: btcVerification.reason,
          bitcoinTxHash,
          confirmations: btcVerification.confirmations,
        });
      }

      console.log(`Bitcoin payment verified: ${btcVerification.amountBTC} BTC`);
      console.log(`Confirmations: ${btcVerification.confirmations}`);

      // STEP 2: Optional - Convert BTC → ZEC for privacy layer
      reserveAmount = btcVerification.amount; // Default: use BTC amount (in satoshis)
      reserveAsset = 'BTC';

      if (useZecPrivacy) {
        console.log('Converting BTC → ZEC for privacy layer...');
        try {
          const conversionResult = await converterService.convertBTCtoZEC(
            btcVerification.amountBTC
          );

          console.log(`Conversion: ${btcVerification.amountBTC} BTC → ${conversionResult.zecAmount} ZEC`);

          // If ZEC transaction hash is provided, verify it
          if (conversionResult.zecTxHash) {
            zecVerification = await zcashService.verifyShieldedTransaction(
              conversionResult.zecTxHash
            );

            if (zecVerification.verified) {
              reserveAmount = Math.floor(conversionResult.zecAmount * 100000000);
              reserveAsset = 'ZEC';
              console.log(`ZEC verification successful: ${conversionResult.zecAmount} ZEC`);
            }
          }
        } catch (error) {
          console.error('ZEC conversion error:', error);
          console.log('Continuing with BTC reserve (conversion failed)');
        }
      }
    }

    // FLOW 2: ZEC → zenZEC (Direct Zcash flow)
    if (isZcashFlow) {
      // STEP 1: Verify Zcash shielded transaction
      console.log(`Verifying Zcash transaction: ${zcashTxHash}`);
      zecVerification = await zcashService.verifyShieldedTransaction(zcashTxHash);

      if (!zcashVerification.verified) {
        return res.status(400).json({
          error: 'Zcash transaction verification failed',
          zcashTxHash,
          reason: 'Transaction not verified or not confirmed',
        });
      }

      console.log(`Zcash transaction verified: ${zecVerification.amount || amountNum} ZEC`);
      console.log(`Block height: ${zecVerification.blockHeight}`);

      // STEP 1.5: If wallet is enabled, verify transaction is to bridge address
      if (process.env.USE_ZECWALLET_CLI === 'true') {
        try {
          const bridgeAddress = await zcashService.getBridgeAddress();
          console.log(`Verifying transaction is to bridge address: ${bridgeAddress}`);
          // In production, this would verify the transaction output matches bridge address
          // For MVP, we trust the transaction hash verification
        } catch (error) {
          console.warn('Could not verify bridge address match:', error.message);
        }
      }

      // Use ZEC amount directly (1:1 with zenZEC)
      reserveAmount = Math.floor((zecVerification.amount || amountNum) * 100000000); // Convert to smallest unit
      reserveAsset = 'ZEC';
    }

    // STEP 3: Check reserve capacity
    const currentReserve = reserveAsset === 'BTC' 
      ? bitcoinService.getCurrentReserve()
      : 0; // ZEC reserve would be tracked separately (in production, query on-chain)

    // For minting, use 1:1 ratio (1 BTC/ZEC = 1 zenZEC)
    // Convert to zenZEC amount (using smallest unit for precision)
    const mintAmount = Math.floor(reserveAmount); // 1:1 ratio

    if (mintAmount > currentReserve && currentReserve > 0) {
      console.warn(`Reserve check: Requested ${mintAmount}, Available ${currentReserve}`);
      // In production, this would check on-chain reserve and reject if insufficient
    }

    // STEP 4: Generate bridge transaction ID
    const txId = isDemoMode
      ? `demo_${Date.now()}_${Math.random().toString(36).substring(7)}`
      : isBitcoinFlow
      ? `btc_${bitcoinTxHash.substring(0, 16)}_${Date.now()}`
      : `zec_${zcashTxHash.substring(0, 16)}_${Date.now()}`;

    // STEP 5: Mint zenZEC on Solana
    let solanaTxSignature = null;
    let mintStatus = 'pending';
    
    try {
      // Attempt to mint on Solana (works for both demo and verified modes)
      console.log(`Minting ${mintAmount} zenZEC to ${solanaAddress}`);
      console.log(`Reserve asset: ${reserveAsset}`);
      console.log(`Swap to SOL: ${swapToSol || false}`);
      
      solanaTxSignature = await solanaService.mintZenZEC(solanaAddress, mintAmount);
      mintStatus = 'confirmed';
      console.log(`✓ Minting successful: ${solanaTxSignature}`);
    } catch (error) {
      console.error('Error minting zenZEC on Solana:', error);
      // In demo mode, continue even if minting fails (for testing)
      if (!isDemoMode) {
        throw error;
      }
      console.warn('Continuing in demo mode despite minting error');
    }

    // Update local reserve tracking
    if (reserveAsset === 'BTC' && btcVerification) {
      bitcoinService.addToReserve(btcVerification.amount);
    }

    // Save transaction to database
    if (databaseService.isConnected()) {
      try {
        await databaseService.saveBridgeTransaction({
          txId,
          solanaAddress,
          amount: mintAmount / 1e8, // Convert from smallest unit to zenZEC
          reserveAsset,
          status: mintStatus,
          solanaTxSignature,
          bitcoinTxHash: bitcoinTxHash || null,
          zcashTxHash: zcashTxHash || null,
          demoMode: isDemoMode,
        });
        console.log(`✓ Transaction saved to database: ${txId}`);
      } catch (error) {
        console.error('Error saving transaction to database:', error);
        // Don't fail the request if database save fails
      }
    }

    // Prepare response
    const response = {
      success: true,
      transactionId: txId,
      amount: mintAmount,
      solanaAddress,
      swapToSol: swapToSol || false,
      status: mintStatus,
      message: isDemoMode 
        ? 'zenZEC minting initiated (demo mode - no transaction verification)'
        : 'zenZEC minting successful',
      reserveAsset,
      demoMode: isDemoMode,
      solanaTxSignature: solanaTxSignature || null,
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
      };
    }

    // Add Zcash verification if present
    if (zecVerification) {
      response.amountZEC = zecVerification.amount || amountNum;
      response.zcashVerification = {
        verified: true,
        txHash: zcashTxHash,
        amount: zecVerification.amount || amountNum,
        blockHeight: zecVerification.blockHeight,
      };

      // If this was BTC → ZEC conversion, include exchange rate
      if (btcVerification) {
        response.zcashVerification.exchangeRate = btcVerification.amountBTC / (zecVerification.amount || 1);
      }
    }

    // Note about swap to SOL
    if (swapToSol) {
      response.swapNote = 'zenZEC will be burned and swapped to SOL via relayer. Call burn_and_emit instruction.';
    }

    res.json(response);
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

  if (!databaseService.isConnected()) {
    throw new APIError(503, 'Database not available');
  }

  // Determine transaction type if not provided
  let txType = transactionType;
  if (!txType) {
    let tx = await databaseService.getBridgeTransaction(txId);
    if (tx) {
      txType = 'bridge';
    } else {
      tx = await databaseService.getSwapTransaction(txId);
      if (tx) {
        txType = 'swap';
      } else {
        tx = await databaseService.getBurnTransaction(txId);
        if (tx) {
          txType = 'burn';
        } else {
          throw new APIError(404, 'Transaction not found');
        }
      }
    }
  }

  const updates = {};
  if (req.body.solanaTxSignature) updates.solanaTxSignature = req.body.solanaTxSignature;
  if (req.body.btcTxHash) updates.btcTxHash = req.body.btcTxHash;
  if (req.body.solTxSignature) updates.solTxSignature = req.body.solTxSignature;

  const updated = await databaseService.updateTransactionStatus(
    txId,
    txType,
    status,
    updates
  );

  if (!updated) {
    throw new APIError(404, 'Transaction not found');
  }

  res.json({
    success: true,
    transaction: updated,
    message: 'Transaction status updated',
  });
}));

// Health check for bridge service
router.get('/health', async (req, res) => {
  try {
    const connection = solanaService.getConnection();
    const blockHeight = await connection.getBlockHeight();
    
    res.json({
      healthy: true,
      blockHeight,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Bridge health check failed:', error);
    res.status(503).json({ 
      healthy: false,
      error: error.message,
    });
  }
});

/**
 * Swap SOL to zenZEC
 * POST body: { solanaAddress, solAmount, usePrivacy }
 */
router.post('/swap-sol-to-zenzec', validateSwapRequest, asyncHandler(async (req, res) => {
  const { solanaAddress, solAmount, usePrivacy } = req.body;
  const solAmountNum = solAmount || 0;

    console.log(`SOL → zenZEC swap: ${solAmountNum} SOL for ${solanaAddress}`);

    // Optional: Encrypt amount if privacy enabled
    let encryptedAmount = null;
    if (usePrivacy && process.env.ENABLE_ARCIUM_MPC === 'true') {
      const arciumService = require('../services/arcium');
      encryptedAmount = await arciumService.encryptAmount(solAmountNum, solanaAddress);
      console.log('Amount encrypted via Arcium MPC');
    }

    // Check if we're in demo mode (missing relayer keypair or mint)
    const isDemoMode = !solanaService.relayerKeypair || 
                      !process.env.ZENZEC_MINT || 
                      process.env.ZENZEC_MINT === 'YourZenZECMintAddressHere';
    
    let txSignature;
    let zenZECAmount;

    if (isDemoMode) {
      console.log('Demo mode: Generating mock transaction signature');
      
      // Calculate zenZEC amount
      const exchangeRate = parseFloat(process.env.SOL_TO_ZENZEC_RATE || '100');
      zenZECAmount = solAmountNum * exchangeRate;
      
      // Generate a mock transaction signature (valid Solana base58 format, 88 chars)
      // Using a deterministic approach for demo consistency
      const timestamp = Date.now();
      const randomPart = Math.random().toString(36).substring(2, 15);
      const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      let mockSig = '';
      
      // Create a base58-like string that looks like a real Solana signature
      for (let i = 0; i < 88; i++) {
        const index = (timestamp + i + randomPart.charCodeAt(i % randomPart.length)) % base58Chars.length;
        mockSig += base58Chars[index];
      }
      
      txSignature = mockSig;
      
      console.log(`Demo mode: Mock transaction ${txSignature.substring(0, 16)}...`);
    } else {
      // Real mode: Actually swap SOL to zenZEC
      txSignature = await solanaService.swapSOLToZenZEC(solanaAddress, solAmountNum);
      const exchangeRate = parseFloat(process.env.SOL_TO_ZENZEC_RATE || '100');
      zenZECAmount = solAmountNum * exchangeRate;
    }

    const txId = `sol_${txSignature.substring(0, 16)}_${Date.now()}`;

    // Save swap transaction to database
    if (databaseService.isConnected()) {
      try {
        await databaseService.saveSwapTransaction({
          txId,
          solanaAddress,
          solAmount: solAmountNum,
          zenZECAmount,
          solanaTxSignature: txSignature,
          direction: 'sol_to_zenzec',
          status: 'confirmed',
          encrypted: !!encryptedAmount,
          demoMode: isDemoMode,
        });
        console.log(`✓ Swap transaction saved to database: ${txId}`);
      } catch (error) {
        console.error('Error saving swap transaction to database:', error);
        // Don't fail the request if database save fails
      }
    }

    res.json({
      success: true,
      transactionId: txId,
      solAmount: solAmountNum,
      zenZECAmount: zenZECAmount,
      solanaAddress,
      solanaTxSignature: txSignature,
      encrypted: !!encryptedAmount,
      demoMode: isDemoMode,
      message: isDemoMode 
        ? 'SOL swapped to zenZEC successfully (Demo Mode - Mock Transaction)'
        : 'SOL swapped to zenZEC successfully',
    });
}));

/**
 * Create burn_for_btc transaction (ready to sign)
 * POST body: { solanaAddress, amount, btcAddress, usePrivacy }
 * Returns: Serialized transaction that frontend can sign and send
 */
router.post('/create-burn-for-btc-tx', validateBurnRequest, asyncHandler(async (req, res) => {
  const { solanaAddress, amount, btcAddress, usePrivacy } = req.body;
  const amountNum = amount;

    console.log(`Creating burn_for_btc transaction: ${amountNum} zenZEC to ${btcAddress}`);

    // Optional: Encrypt BTC address if privacy enabled
    let encryptedBTCAddress = btcAddress;
    if (usePrivacy && process.env.ENABLE_ARCIUM_MPC === 'true') {
      const arciumService = require('../services/arcium');
      try {
        const encrypted = await arciumService.encryptBTCAddress(btcAddress, solanaAddress);
        encryptedBTCAddress = encrypted.ciphertext || Buffer.from(btcAddress).toString('base64');
        console.log('BTC address encrypted via Arcium MPC');
      } catch (err) {
        console.warn('Arcium encryption failed, using simplified encoding:', err);
        encryptedBTCAddress = Buffer.from(btcAddress).toString('base64');
      }
    }

    // Create the transaction with burn_for_btc instruction
    const { Transaction } = require('@solana/web3.js');
    const transaction = await solanaService.createBurnForBTCTransaction(
      solanaAddress,
      amountNum,
      encryptedBTCAddress,
      usePrivacy || false
    );

    // Serialize transaction (without signature - frontend will sign)
    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    res.json({
      success: true,
      transaction: serialized.toString('base64'),
      message: 'Transaction created. Sign and send from frontend.',
      instruction: {
        solanaAddress,
        amount: amountNum,
        btcAddress: encryptedBTCAddress.substring(0, 20) + '...',
        usePrivacy: !!usePrivacy,
      },
    });
}));

/**
 * Burn zenZEC for BTC (legacy endpoint - returns instruction data)
 * POST body: { solanaAddress, amount, btcAddress, usePrivacy }
 * Note: Use /create-burn-for-btc-tx instead for proper transaction creation
 */
router.post('/burn-for-btc', async (req, res) => {
  try {
    const { solanaAddress, amount, btcAddress, usePrivacy } = req.body;

    if (!solanaAddress || !amount || !btcAddress) {
      return res.status(400).json({
        error: 'Missing required fields: solanaAddress, amount, btcAddress',
      });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        error: 'Invalid amount',
      });
    }

    // Validate BTC address
    const bitcoinService = require('../services/bitcoin');
    if (!bitcoinService.isValidAddress(btcAddress)) {
      return res.status(400).json({
        error: 'Invalid Bitcoin address format',
      });
    }

    // Optional: Encrypt BTC address if privacy enabled
    let encryptedBTCAddress = btcAddress;
    if (usePrivacy && process.env.ENABLE_ARCIUM_MPC === 'true') {
      const arciumService = require('../services/arcium');
      encryptedBTCAddress = Buffer.from(btcAddress).toString('base64');
    }

    res.json({
      success: true,
      message: 'Use /create-burn-for-btc-tx endpoint for proper transaction creation',
      instruction: {
        solanaAddress,
        amount: amountNum,
        btcAddress: encryptedBTCAddress,
        usePrivacy: !!usePrivacy,
      },
      deprecated: true,
    });
  } catch (error) {
    console.error('Error preparing burn for BTC:', error);
    res.status(500).json({
      error: 'Failed to prepare burn for BTC',
      message: error.message,
    });
  }
});

/**
 * Get transactions by Solana address
 * GET /api/bridge/transactions/:address?limit=50&offset=0&type=bridge
 */
router.get('/transactions/:address', validatePagination, asyncHandler(async (req, res) => {
  const { address } = req.params;
  const { type } = req.query;
  const { limit, offset } = req.pagination;

  if (!databaseService.isConnected()) {
    throw new APIError(503, 'Database not available', {
      message: 'Transaction history requires database connection',
    });
  }

  const transactions = await databaseService.getTransactionsByAddress(address, {
    limit,
    offset,
    type,
  });

  res.json({
    success: true,
    address,
    transactions,
    pagination: {
      limit,
      offset,
    },
  });
}));

/**
 * Get transaction by ID
 * GET /api/bridge/transaction/:txId
 */
router.get('/transaction/:txId', validateTxId, asyncHandler(async (req, res) => {
  const { txId } = req.params;

  if (!databaseService.isConnected()) {
    throw new APIError(503, 'Database not available', {
      message: 'Transaction lookup requires database connection',
    });
  }

  // Try to find in bridge transactions
  let transaction = await databaseService.getBridgeTransaction(txId);
  let transactionType = 'bridge';

  // If not found, try swap transactions
  if (!transaction) {
    transaction = await databaseService.getSwapTransaction(txId);
    transactionType = 'swap';
  }

  // If still not found, try burn transactions
  if (!transaction) {
    transaction = await databaseService.getBurnTransaction(txId);
    transactionType = 'burn';
  }

  if (!transaction) {
    throw new APIError(404, 'Transaction not found', {
      txId,
    });
  }

  res.json({
    success: true,
    transactionType,
    transaction,
  });
}));

module.exports = router;

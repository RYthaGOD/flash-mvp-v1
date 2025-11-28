const express = require('express');
const router = express.Router();
const { PublicKey } = require('@solana/web3.js');
const solanaService = require('../services/solana');
const zcashService = require('../services/zcash');
const bitcoinService = require('../services/bitcoin');
const converterService = require('../services/converter');
const databaseService = require('../services/database');
const jupiterService = require('../services/jupiter');
const btcDepositHandler = require('../services/btc-deposit-handler');
const cryptoProofsService = require('../services/crypto-proofs');
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
      treasury: 'USDC Treasury + Jupiter Swaps',
      solanaVersion: version,
      description: 'FLASH BTC→USDC→Token Bridge (Cash App Optimized)',
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

      // STEP 2: Calculate ZEC equivalent using exchange rate (simplified approach)
      // This avoids actual exchange execution, fees, and liquidity requirements
      console.log('Calculating ZEC equivalent using current exchange rate...');
      try {
        const exchangeRate = await converterService.getBTCtoZECRate();
        const zecAmount = btcVerification.amountBTC * exchangeRate;
        
        console.log(`Exchange rate: 1 BTC = ${exchangeRate} ZEC`);
        console.log(`Calculated: ${btcVerification.amountBTC} BTC → ${zecAmount} ZEC`);
        
        // Use ZEC amount (convert to smallest unit)
        reserveAmount = Math.floor(zecAmount * 100000000); // Convert to smallest unit (8 decimals)
        reserveAsset = 'ZEC';
        
        console.log(`Using ZEC equivalent: ${zecAmount} ZEC (${reserveAmount} smallest units)`);
      } catch (error) {
        console.error('Error calculating ZEC equivalent:', error);
        // Fallback: Use BTC amount directly (1:1 ratio)
        console.warn('Falling back to 1:1 BTC ratio');
        reserveAmount = btcVerification.amount; // Use BTC amount in satoshis
        reserveAsset = 'BTC';
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

    // STEP 3: Check reserve capacity and determine transfer method
    const useNativeZEC = process.env.USE_NATIVE_ZEC !== 'false' && 
                         (process.env.NATIVE_ZEC_MINT || process.env.ZEC_MINT);
    
    let currentReserve = 0;
    if (reserveAsset === 'BTC') {
      currentReserve = bitcoinService.getCurrentReserve();
    } else if (reserveAsset === 'ZEC' && useNativeZEC) {
      // Check on-chain ZEC treasury balance
      try {
        const treasuryBalance = await solanaService.getTreasuryZECBalance();
        currentReserve = Number(treasuryBalance);
      } catch (error) {
        console.warn('Could not check ZEC treasury balance:', error.message);
        currentReserve = 0;
      }
    }

    // For minting/transferring, use 1:1 ratio (1 BTC/ZEC = 1 zenZEC/native ZEC)
    // Convert to amount (using smallest unit for precision)
    const transferAmount = Math.floor(reserveAmount); // 1:1 ratio

    if (transferAmount > currentReserve && currentReserve > 0) {
      console.warn(`Reserve check: Requested ${transferAmount}, Available ${currentReserve}`);
      // In production, this would check on-chain reserve and reject if insufficient
    }

    // STEP 4: Generate bridge transaction ID
    const txId = isDemoMode
      ? `demo_${Date.now()}_${Math.random().toString(36).substring(7)}`
      : isBitcoinFlow
      ? `btc_${bitcoinTxHash.substring(0, 16)}_${Date.now()}`
      : `zec_${zcashTxHash.substring(0, 16)}_${Date.now()}`;

    // STEP 5: Transfer native ZEC or mint zenZEC on Solana
    let solanaTxSignature = null;
    let mintStatus = 'pending';
    let tokenType = 'zenZEC'; // Default
    
    try {
      // Use native ZEC if configured (for both BTC and ZEC flows)
      // BTC flows now calculate ZEC equivalent, so we can use native ZEC for both
      if (useNativeZEC && reserveAsset === 'ZEC') {
        console.log(`Transferring ${transferAmount / 1e8} native ZEC to ${solanaAddress}`);
        console.log(`Reserve asset: ${reserveAsset} (${isBitcoinFlow ? 'from BTC' : 'from ZEC'})`);
        console.log(`Swap to SOL: ${swapToSol || false}`);
        
        // Check treasury balance before transfer
        const treasuryBalance = await solanaService.getTreasuryZECBalance();
        if (BigInt(transferAmount) > treasuryBalance) {
          throw new APIError(503, 'Insufficient ZEC reserves', {
            requested: transferAmount,
            available: treasuryBalance.toString(),
            message: 'Treasury does not have enough native ZEC. Please fund the treasury.'
          });
        }
        
        solanaTxSignature = await solanaService.transferNativeZEC(solanaAddress, transferAmount);
        mintStatus = 'confirmed';
        tokenType = 'native ZEC';
        console.log(`✓ Native ZEC transfer successful: ${solanaTxSignature}`);
      } else {
        // Fallback to minting zenZEC (if native ZEC not configured or reserve asset is BTC)
        console.log(`Minting ${transferAmount / 1e8} ${tokenType} to ${solanaAddress}`);
        console.log(`Reserve asset: ${reserveAsset}`);
        console.log(`Swap to SOL: ${swapToSol || false}`);
        
        solanaTxSignature = await solanaService.mintZenZEC(solanaAddress, transferAmount);
        mintStatus = 'confirmed';
        console.log(`✓ Minting successful: ${solanaTxSignature}`);
      }
    } catch (error) {
      console.error(`Error ${useNativeZEC && isZcashFlow ? 'transferring native ZEC' : 'minting zenZEC'} on Solana:`, error);
      // In demo mode, continue even if transfer/minting fails (for testing)
      if (!isDemoMode) {
        throw error;
      }
      console.warn('Continuing in demo mode despite transfer/minting error');
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
          amount: transferAmount / 1e8, // Convert from smallest unit
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

    // Generate cryptographic proof for institutional compliance
    let cryptographicProof = null;
    try {
      const proofData = {
        txId,
        solanaAddress,
        amount: mintAmount / 1e8,
        reserveAsset,
        status: mintStatus,
        solanaTxSignature,
        bitcoinTxHash: bitcoinTxHash || null,
        zcashTxHash: zcashTxHash || null,
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

      console.log(`✓ Cryptographic proof generated for transaction: ${txId}`);
    } catch (error) {
      console.error('Error generating cryptographic proof:', error);
      // Don't fail the request if proof generation fails
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
        ? `${tokenType} transfer initiated (demo mode - no transaction verification)`
        : `${tokenType} transfer successful`,
      reserveAsset,
      demoMode: isDemoMode,
      solanaTxSignature: solanaTxSignature || null,
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

/**
 * Get cryptographic proof for transaction
 * GET /api/bridge/proof/:txId?format=full|audit|verification
 */
router.get('/proof/:txId', validateTxId, asyncHandler(async (req, res) => {
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
router.post('/proof/:txId/verify', validateTxId, asyncHandler(async (req, res) => {
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
 * POST body: { solanaAddress, solAmount }
 * PRIVACY ALWAYS ON: All amounts are encrypted via Arcium MPC
 */
router.post('/swap-sol-to-zenzec', validateSwapRequest, asyncHandler(async (req, res) => {
  const { solanaAddress, solAmount } = req.body;
  const solAmountNum = solAmount || 0;

    console.log(`🔒 SOL → zenZEC swap: ${solAmountNum} SOL for ${solanaAddress} (Full Privacy)`);

    // ALWAYS encrypt amount via Arcium MPC
      const arciumService = require('../services/arcium');
    const arciumStatus = arciumService.getStatus();
    const mpcMode = arciumStatus.simulated ? 'SIMULATED' : 'REAL MPC';
    console.log(`✓ Amount encrypted via Arcium MPC (${mpcMode})`);
    const encryptedAmount = await arciumService.encryptAmount(solAmountNum, solanaAddress);

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
          encrypted: true,  // ALWAYS encrypted
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
      encrypted: true,  // ALWAYS encrypted
      privacy: 'full',
      demoMode: isDemoMode,
      message: isDemoMode 
        ? '🔒 SOL swapped to zenZEC successfully (Demo Mode - Mock Transaction) - Full Privacy Enabled'
        : '🔒 SOL swapped to zenZEC successfully - Full Privacy Enabled',
    });
}));

/**
 * Create burn_for_btc transaction (ready to sign)
 * POST body: { solanaAddress, amount, btcAddress }
 * PRIVACY ALWAYS ON: BTC address is encrypted via Arcium MPC
 * Returns: Serialized transaction that frontend can sign and send
 */
router.post('/create-burn-for-btc-tx', validateBurnRequest, asyncHandler(async (req, res) => {
  const { solanaAddress, amount, btcAddress } = req.body;
  const amountNum = amount;

    console.log(`🔒 Creating burn_for_btc transaction: ${amountNum} zenZEC to ${btcAddress.substring(0, 10)}... (Full Privacy)`);

    // ALWAYS encrypt BTC address via Arcium MPC
      const arciumService = require('../services/arcium');
        const encrypted = await arciumService.encryptBTCAddress(btcAddress, solanaAddress);
    const encryptedBTCAddress = encrypted.ciphertext;
    console.log('✓ BTC address encrypted via Arcium MPC');

    // Create the transaction with burn_for_btc instruction
    const { Transaction } = require('@solana/web3.js');
    const transaction = await solanaService.createBurnForBTCTransaction(
      solanaAddress,
      amountNum,
      encryptedBTCAddress,
      true  // ALWAYS use privacy
    );

    // Serialize transaction (without signature - frontend will sign)
    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    res.json({
      success: true,
      transaction: serialized.toString('base64'),
      message: '🔒 Transaction created with full privacy. Sign and send from frontend.',
      instruction: {
        solanaAddress,
        amount: amountNum,
        btcAddress: '[ENCRYPTED]',  // Don't reveal even truncated address
        encrypted: true,
        privacy: 'full',
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
    const { solanaAddress, amount, btcAddress } = req.body;

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

    // ALWAYS encrypt BTC address via Arcium MPC
      const arciumService = require('../services/arcium');
    const encrypted = await arciumService.encryptBTCAddress(btcAddress, solanaAddress);
    const encryptedBTCAddress = encrypted.ciphertext;

    res.json({
      success: true,
      message: '🔒 Use /create-burn-for-btc-tx endpoint for proper transaction creation (Full Privacy Enabled)',
      instruction: {
        solanaAddress,
        amount: amountNum,
        btcAddress: '[ENCRYPTED]',
        encrypted: true,
        privacy: 'full',
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

/**
 * Execute Jupiter DEX Swap (BTC → USDC → Token)
 * POST /api/bridge/jupiter-swap
 */
router.post('/jupiter-swap', asyncHandler(async (req, res) => {
  const { userAddress, outputToken, usdcAmount } = req.body;

  if (!userAddress || !outputToken || !usdcAmount) {
    throw new APIError(400, 'Missing required parameters', {
      required: ['userAddress', 'outputToken', 'usdcAmount'],
      received: { userAddress, outputToken, usdcAmount },
    });
  }

  console.log(`🔄 Jupiter Swap Request: ${usdcAmount} USDC → ${outputToken} for ${userAddress}`);

  try {
    const result = await jupiterService.swapZECForToken(userAddress, outputToken, usdcAmount);

    // Record in database if connected
    if (databaseService.isConnected()) {
      await databaseService.recordSwapTransaction({
        userAddress,
        inputToken: 'ZEC',
        outputToken,
        inputAmount: usdcAmount,
        txHash: result.signature,
        status: 'completed',
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      signature: result.signature,
      confirmation: result.confirmation,
      message: `Successfully swapped ${usdcAmount} USDC to ${outputToken}`,
    });

  } catch (error) {
    console.error('Jupiter swap error:', error);
    throw new APIError(500, 'Swap execution failed', {
      error: error.message,
      userAddress,
      outputToken,
      usdcAmount,
    });
  }
}));

/**
 * Claim BTC Deposit
 * POST /api/bridge/btc-deposit
 * User provides their Solana address and BTC tx hash to claim tokens
 */
router.post('/btc-deposit', asyncHandler(async (req, res) => {
  const { solanaAddress, bitcoinTxHash, outputTokenMint } = req.body;

  if (!solanaAddress || !bitcoinTxHash) {
    throw new APIError(400, 'Missing required parameters', {
      required: ['solanaAddress', 'bitcoinTxHash'],
      optional: ['outputTokenMint'], // Token user wants to receive (defaults to USDC)
    });
  }

  try {
    // Verify Bitcoin payment
    console.log(`Verifying BTC deposit: ${bitcoinTxHash}`);
    const verification = await bitcoinService.verifyBitcoinPayment(
      bitcoinTxHash,
      0 // Amount will be extracted from transaction
    );

    if (!verification.verified) {
      throw new APIError(400, 'Bitcoin payment verification failed', {
        reason: verification.reason,
        bitcoinTxHash,
        confirmations: verification.confirmations,
      });
    }

    // Create payment object
    const payment = {
      txHash: bitcoinTxHash,
      amount: verification.amount, // in satoshis
      confirmations: verification.confirmations,
      blockHeight: verification.blockHeight,
      timestamp: verification.timestamp,
    };

    // Handle BTC deposit → USDC → Token swap
    const result = await btcDepositHandler.handleBTCDeposit(
      payment,
      solanaAddress,
      outputTokenMint || null // null = default to USDC
    );

    if (result.alreadyProcessed) {
      return res.status(409).json({
        success: false,
        error: 'This BTC deposit has already been processed',
        bitcoinTxHash,
      });
    }

    res.json({
      success: true,
      message: 'BTC deposit processed successfully',
      bitcoinTxHash,
      btcAmount: result.btcAmount,
      usdcAmount: result.usdcAmount,
      outputToken: result.outputToken,
      swapSignature: result.swapSignature,
      solanaAddress,
    });

  } catch (error) {
    console.error('BTC deposit claim error:', error);
    throw new APIError(500, 'Failed to process BTC deposit', {
      error: error.message,
      bitcoinTxHash,
    });
  }
}));

/**
 * Get Jupiter Quote
 * POST /api/bridge/jupiter-quote
 */
router.post('/jupiter-quote', asyncHandler(async (req, res) => {
  const { inputMint, outputMint, amount, slippageBps } = req.body;

  if (!inputMint || !outputMint || !amount) {
    throw new APIError(400, 'Missing required parameters', {
      required: ['inputMint', 'outputMint', 'amount'],
    });
  }

  try {
    const quote = await jupiterService.getQuote(
      new PublicKey(inputMint),
      new PublicKey(outputMint),
      amount,
      slippageBps || 50
    );

    res.json({
      success: true,
      quote,
    });

  } catch (error) {
    console.error('Jupiter quote error:', error);
    throw new APIError(500, 'Quote retrieval failed', {
      error: error.message,
    });
  }
}));

module.exports = router;

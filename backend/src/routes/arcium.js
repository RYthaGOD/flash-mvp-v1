const express = require('express');
const router = express.Router();
const arciumService = require('../services/arcium');
const { requireClientSignature } = require('../middleware/clientAuth');

/**
 * Get Arcium MPC network status
 */
router.get('/status', (req, res) => {
  try {
    const status = arciumService.getStatus();
    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('Error fetching Arcium status:', error);
    res.status(500).json({ error: 'Failed to fetch Arcium status' });
  }
});

/**
 * Encrypt an amount using MPC
 * POST body: { amount, recipientPubkey }
 */
router.post('/encrypt-amount', requireClientSignature, async (req, res) => {
  try {
    const { amount, recipientPubkey } = req.body;

    if (!amount || !recipientPubkey) {
      return res.status(400).json({
        error: 'Missing required fields: amount, recipientPubkey',
      });
    }

    const encrypted = await arciumService.encryptAmount(amount, recipientPubkey);

    res.json({
      success: true,
      encrypted,
    });
  } catch (error) {
    console.error('Error encrypting amount:', error);
    res.status(500).json({
      error: 'Failed to encrypt amount',
      message: error.message,
    });
  }
});

/**
 * Generate trustless random number
 * POST body: { max }
 */
router.post('/random', requireClientSignature, async (req, res) => {
  try {
    const { max } = req.body;

    if (!max || max <= 0) {
      return res.status(400).json({
        error: 'Invalid max value',
      });
    }

    const random = await arciumService.generateTrustlessRandom(max);

    res.json({
      success: true,
      random,
      max,
      trustless: arciumService.mpcEnabled,
    });
  } catch (error) {
    console.error('Error generating random:', error);
    res.status(500).json({
      error: 'Failed to generate random number',
      message: error.message,
    });
  }
});

/**
 * Get computation status
 * GET /api/arcium/computation/:computationId
 */
router.get('/computation/:computationId', (req, res) => {
  try {
    const { computationId } = req.params;
    const status = arciumService.getComputationStatus(computationId);

    res.json({
      success: true,
      computationId,
      ...status,
    });
  } catch (error) {
    console.error('Error fetching computation status:', error);
    res.status(500).json({ error: 'Failed to fetch computation status' });
  }
});

/**
 * Create private bridge transaction
 * POST body: { solanaAddress, amount, swapToSol, useEncryption }
 */
router.post('/bridge/private', requireClientSignature, async (req, res) => {
  try {
    const { solanaAddress, amount, swapToSol, useEncryption } = req.body;

    if (!solanaAddress || !amount) {
      return res.status(400).json({
        error: 'Missing required fields: solanaAddress, amount',
      });
    }

    // Encrypt the amount if requested
    let encryptedAmount;
    if (useEncryption !== false && arciumService.mpcEnabled) {
      encryptedAmount = await arciumService.encryptAmount(amount, solanaAddress);
    } else {
      encryptedAmount = { encrypted: false, amount };
    }

    // Create encrypted bridge transaction
    const tx = await arciumService.createEncryptedBridgeTx(
      solanaAddress,
      encryptedAmount,
      swapToSol || false
    );

    res.json({
      success: true,
      transaction: tx,
      message: 'Private bridge transaction created',
    });
  } catch (error) {
    console.error('Error creating private bridge tx:', error);
    res.status(500).json({
      error: 'Failed to create private bridge transaction',
      message: error.message,
    });
  }
});

/**
 * Calculate encrypted swap amount
 * POST body: { encryptedZenZEC, exchangeRate }
 */
router.post('/calculate-swap', requireClientSignature, async (req, res) => {
  try {
    const { encryptedZenZEC, exchangeRate } = req.body;

    if (!encryptedZenZEC || !exchangeRate) {
      return res.status(400).json({
        error: 'Missing required fields: encryptedZenZEC, exchangeRate',
      });
    }

    const result = await arciumService.calculateEncryptedSwapAmount(
      encryptedZenZEC,
      exchangeRate
    );

    res.json({
      success: true,
      encryptedSwapAmount: result,
    });
  } catch (error) {
    console.error('Error calculating swap:', error);
    res.status(500).json({
      error: 'Failed to calculate encrypted swap amount',
      message: error.message,
    });
  }
});

/**
 * Private Zcash transaction verification
 * POST body: { txHash, encryptedExpectedAmount }
 */
router.post('/verify-zcash-private', requireClientSignature, async (req, res) => {
  try {
    const { txHash, encryptedExpectedAmount } = req.body;

    if (!txHash) {
      return res.status(400).json({
        error: 'Missing required field: txHash',
      });
    }

    const verification = await arciumService.privateVerifyZcashTx(
      txHash,
      encryptedExpectedAmount || {}
    );

    res.json({
      success: true,
      verification,
      message: 'Private verification completed',
    });
  } catch (error) {
    console.error('Error in private verification:', error);
    res.status(500).json({
      error: 'Failed to privately verify Zcash transaction',
      message: error.message,
    });
  }
});

/**
 * Select relayer confidentially
 * POST body: { relayerAddresses }
 */
router.post('/select-relayer', requireClientSignature, async (req, res) => {
  try {
    const { relayerAddresses } = req.body;

    if (!relayerAddresses || !Array.isArray(relayerAddresses)) {
      return res.status(400).json({
        error: 'Invalid relayerAddresses array',
      });
    }

    const selected = await arciumService.selectConfidentialRelayer(relayerAddresses);

    res.json({
      success: true,
      selectedRelayer: selected,
      method: arciumService.mpcEnabled ? 'trustless' : 'random',
    });
  } catch (error) {
    console.error('Error selecting relayer:', error);
    res.status(500).json({
      error: 'Failed to select relayer',
      message: error.message,
    });
  }
});

/**
 * Encrypt BTC address for privacy
 * POST body: { btcAddress, recipientPubkey }
 */
router.post('/encrypt-btc-address', requireClientSignature, async (req, res) => {
  try {
    const { btcAddress, recipientPubkey } = req.body;

    if (!btcAddress || !recipientPubkey) {
      return res.status(400).json({
        error: 'Missing required fields: btcAddress, recipientPubkey',
      });
    }

    // Validate BTC address format
    const bitcoinService = require('../services/bitcoin');
    if (!bitcoinService.isValidAddress(btcAddress)) {
      return res.status(400).json({
        error: 'Invalid Bitcoin address format',
      });
    }

    // Encrypt via Arcium
    const encrypted = await arciumService.encryptBTCAddress(btcAddress, recipientPubkey);

    res.json({
      success: true,
      encrypted,
    });
  } catch (error) {
    console.error('Error encrypting BTC address:', error);
    res.status(500).json({
      error: 'Failed to encrypt BTC address',
      message: error.message,
    });
  }
});

/**
 * Decrypt BTC address (for relayer use)
 * POST body: { encryptedAddress, recipientPubkey }
 */
router.post('/decrypt-btc-address', requireClientSignature, async (req, res) => {
  try {
    const { encryptedAddress, recipientPubkey } = req.body;

    if (!encryptedAddress || !recipientPubkey) {
      return res.status(400).json({
        error: 'Missing required fields: encryptedAddress, recipientPubkey',
      });
    }

    // Only relayer can decrypt (in production, add authentication)
    const decrypted = await arciumService.decryptBTCAddress(encryptedAddress, recipientPubkey);

    res.json({
      success: true,
      btcAddress: decrypted,
    });
  } catch (error) {
    console.error('Error decrypting BTC address:', error);
    res.status(500).json({
      error: 'Failed to decrypt BTC address',
      message: error.message,
    });
  }
});

module.exports = router;

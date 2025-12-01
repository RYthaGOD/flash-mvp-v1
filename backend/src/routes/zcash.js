const express = require('express');
const router = express.Router();
const zcashService = require('../services/zcash');
const { requireClientSignature } = require('../middleware/clientAuth');

/**
 * Get Zcash network information
 */
router.get('/info', async (req, res) => {
  try {
    const networkInfo = await zcashService.getNetworkInfo();
    res.json({
      success: true,
      ...networkInfo,
    });
  } catch (error) {
    console.error('Error fetching Zcash info:', error);
    res.status(500).json({ error: 'Failed to fetch Zcash info' });
  }
});

/**
 * Verify a Zcash transaction
 * POST body: { txHash, expectedAmount }
 */
router.post('/verify-transaction', requireClientSignature, async (req, res) => {
  try {
    const { txHash, expectedAmount } = req.body;

    if (!txHash) {
      return res.status(400).json({
        error: 'Missing required field: txHash',
      });
    }

    // Verify the transaction exists and is confirmed
    const transaction = await zcashService.verifyShieldedTransaction(txHash);
    
    if (!transaction.verified) {
      return res.status(400).json({
        error: 'Transaction not verified',
        transaction,
      });
    }

    // Get additional transaction details from explorer
    const txDetails = await zcashService.getTransaction(txHash);

    res.json({
      success: true,
      verified: true,
      transaction: {
        ...transaction,
        ...txDetails,
      },
      message: 'Zcash transaction verified successfully',
    });
  } catch (error) {
    console.error('Error verifying transaction:', error);
    res.status(500).json({
      error: 'Failed to verify transaction',
      message: error.message,
    });
  }
});

/**
 * Get current ZEC price
 * Cached for 5 minutes to avoid rate limits
 */
router.get('/price', async (req, res) => {
  try {
    const price = await zcashService.getZecPrice();
    res.json({
      success: true,
      price,
      currency: 'USD',
      timestamp: new Date().toISOString(),
      cached: zcashService.priceCache.timestamp && 
              (Date.now() - zcashService.priceCache.timestamp) < zcashService.priceCache.ttl,
    });
  } catch (error) {
    console.error('Error fetching ZEC price:', error);
    
    // Try to return cached price even on error
    if (zcashService.priceCache.price) {
      return res.json({
        success: true,
        price: zcashService.priceCache.price,
        currency: 'USD',
        timestamp: new Date(zcashService.priceCache.timestamp).toISOString(),
        cached: true,
        warning: 'Using cached price due to API error',
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch ZEC price',
      message: error.message,
    });
  }
});

/**
 * Validate a Zcash address
 * POST body: { address }
 */
router.post('/validate-address', requireClientSignature, (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        error: 'Missing required field: address',
      });
    }

    const isValid = zcashService.isValidZcashAddress(address);

    res.json({
      success: true,
      valid: isValid,
      address,
    });
  } catch (error) {
    console.error('Error validating address:', error);
    res.status(500).json({ error: 'Failed to validate address' });
  }
});

/**
 * Get bridge address for depositing ZEC
 */
router.get('/bridge-address', async (req, res) => {
  try {
    const bridgeAddress = await zcashService.getBridgeAddress();
    
    res.json({
      success: true,
      address: bridgeAddress,
      network: process.env.ZCASH_NETWORK || 'mainnet',
      message: 'Send ZEC to this address to mint zenZEC on Solana',
      source: process.env.USE_ZECWALLET_CLI === 'true' ? 'wallet' : 'config',
    });
  } catch (error) {
    console.error('Error fetching bridge address:', error);
    res.status(500).json({ error: 'Failed to fetch bridge address' });
  }
});

/**
 * Get wallet balance
 */
router.get('/balance', async (req, res) => {
  try {
    const balance = await zcashService.getWalletBalance();
    res.json({
      success: true,
      ...balance,
    });
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    res.status(500).json({ error: 'Failed to fetch wallet balance' });
  }
});

/**
 * Get wallet status
 */
router.get('/wallet-status', async (req, res) => {
  try {
    const zcashWallet = require('../services/zcash-wallet');
    const status = await zcashWallet.getStatus();
    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('Error fetching wallet status:', error);
    res.status(500).json({ error: 'Failed to fetch wallet status' });
  }
});

module.exports = router;

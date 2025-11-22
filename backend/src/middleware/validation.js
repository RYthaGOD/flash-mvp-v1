/**
 * Input Validation Middleware
 * Validates and sanitizes request inputs
 */

/**
 * Validate Solana address format
 */
function isValidSolanaAddress(address) {
  if (!address || typeof address !== 'string') return false;
  // Solana addresses are base58 encoded, typically 32-44 characters
  // Base58 alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

/**
 * Validate Bitcoin address format
 */
function isValidBitcoinAddress(address) {
  if (!address || typeof address !== 'string') return false;
  // Bitcoin addresses can be legacy, segwit, or bech32
  const btcRegex = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/;
  return btcRegex.test(address);
}

/**
 * Validate transaction hash format
 */
function isValidTxHash(hash, type = 'generic') {
  if (!hash || typeof hash !== 'string') return false;
  
  if (type === 'bitcoin') {
    // Bitcoin tx hash: 64 hex characters
    return /^[a-fA-F0-9]{64}$/.test(hash);
  } else if (type === 'solana') {
    // Solana signature: base58, 88 characters
    return /^[1-9A-HJ-NP-Za-km-z]{88}$/.test(hash);
  } else {
    // Generic: hex or base58
    return /^[a-fA-F0-9]{64}$/.test(hash) || /^[1-9A-HJ-NP-Za-km-z]{32,88}$/.test(hash);
  }
}

/**
 * Validate amount
 */
function isValidAmount(amount, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const num = parseFloat(amount);
  return !isNaN(num) && num > min && num <= max;
}

/**
 * Sanitize string input
 */
function sanitizeString(str, maxLength = 255) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

/**
 * Validate bridge transaction request
 */
function validateBridgeRequest(req, res, next) {
  const { solanaAddress, amount, bitcoinTxHash, zcashTxHash } = req.body;
  const errors = [];

  // Validate solanaAddress
  if (!solanaAddress) {
    errors.push('solanaAddress is required');
  } else if (!isValidSolanaAddress(solanaAddress)) {
    errors.push('Invalid Solana address format');
  }

  // Validate amount
  if (!amount) {
    errors.push('amount is required');
  } else if (!isValidAmount(amount, 0)) {
    errors.push('amount must be a positive number');
  }

  // Validate transaction hashes if provided
  if (bitcoinTxHash && !isValidTxHash(bitcoinTxHash, 'bitcoin')) {
    errors.push('Invalid Bitcoin transaction hash format');
  }

  if (zcashTxHash && !isValidTxHash(zcashTxHash)) {
    errors.push('Invalid Zcash transaction hash format');
  }

  if (bitcoinTxHash && zcashTxHash) {
    errors.push('Provide either bitcoinTxHash OR zcashTxHash, not both');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      errors,
    });
  }

  // Sanitize inputs
  req.body.solanaAddress = sanitizeString(solanaAddress, 44);
  if (bitcoinTxHash) req.body.bitcoinTxHash = sanitizeString(bitcoinTxHash, 64);
  if (zcashTxHash) req.body.zcashTxHash = sanitizeString(zcashTxHash, 64);
  req.body.amount = parseFloat(amount);

  next();
}

/**
 * Validate swap request
 */
function validateSwapRequest(req, res, next) {
  const { solanaAddress, solAmount } = req.body;
  const errors = [];

  if (!solanaAddress) {
    errors.push('solanaAddress is required');
  } else if (!isValidSolanaAddress(solanaAddress)) {
    errors.push('Invalid Solana address format');
  }

  if (solAmount !== undefined && !isValidAmount(solAmount, 0)) {
    errors.push('solAmount must be a positive number');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      errors,
    });
  }

  // Sanitize
  req.body.solanaAddress = sanitizeString(solanaAddress, 44);
  if (solAmount !== undefined) req.body.solAmount = parseFloat(solAmount);

  next();
}

/**
 * Validate burn request
 */
function validateBurnRequest(req, res, next) {
  const { solanaAddress, amount, targetAsset, targetAddress } = req.body;
  const errors = [];

  if (!solanaAddress) {
    errors.push('solanaAddress is required');
  } else if (!isValidSolanaAddress(solanaAddress)) {
    errors.push('Invalid Solana address format');
  }

  if (!amount) {
    errors.push('amount is required');
  } else if (!isValidAmount(amount, 0)) {
    errors.push('amount must be a positive number');
  }

  if (!targetAsset) {
    errors.push('targetAsset is required');
  } else if (!['BTC', 'SOL'].includes(targetAsset.toUpperCase())) {
    errors.push('targetAsset must be BTC or SOL');
  }

  if (targetAddress) {
    if (targetAsset.toUpperCase() === 'BTC' && !isValidBitcoinAddress(targetAddress)) {
      errors.push('Invalid Bitcoin address format');
    } else if (targetAsset.toUpperCase() === 'SOL' && !isValidSolanaAddress(targetAddress)) {
      errors.push('Invalid Solana address format');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      errors,
    });
  }

  // Sanitize
  req.body.solanaAddress = sanitizeString(solanaAddress, 44);
  req.body.amount = parseFloat(amount);
  req.body.targetAsset = targetAsset.toUpperCase();
  if (targetAddress) {
    req.body.targetAddress = sanitizeString(targetAddress, 255);
  }

  next();
}

/**
 * Validate pagination parameters
 */
function validatePagination(req, res, next) {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  if (limit < 1 || limit > 100) {
    return res.status(400).json({
      error: 'limit must be between 1 and 100',
    });
  }

  if (offset < 0) {
    return res.status(400).json({
      error: 'offset must be non-negative',
    });
  }

  req.pagination = { limit, offset };
  next();
}

/**
 * Validate transaction ID parameter
 */
function validateTxId(req, res, next) {
  const { txId } = req.params;
  
  if (!txId) {
    return res.status(400).json({
      error: 'Transaction ID is required',
    });
  }

  // Transaction IDs can be various formats, just check it's not empty
  if (txId.length > 255) {
    return res.status(400).json({
      error: 'Transaction ID is too long',
    });
  }

  req.params.txId = sanitizeString(txId, 255);
  next();
}

module.exports = {
  validateBridgeRequest,
  validateSwapRequest,
  validateBurnRequest,
  validatePagination,
  validateTxId,
  isValidSolanaAddress,
  isValidBitcoinAddress,
  isValidTxHash,
  isValidAmount,
  sanitizeString,
};


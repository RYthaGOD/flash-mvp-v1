const { PublicKey } = require('@solana/web3.js');

/**
 * Comprehensive Input Validation Middleware
 * Prevents injection attacks, malformed data, and invalid inputs
 */

/**
 * Validate Solana PublicKey format
 * @param {string} value - The value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {boolean} - True if valid
 */
function validatePublicKey(value, fieldName = 'PublicKey') {
  if (!value || typeof value !== 'string') {
    throw new Error(`${fieldName} is required and must be a string`);
  }

  if (value.length < 32 || value.length > 44) {
    throw new Error(`${fieldName} must be 32-44 characters long`);
  }

  try {
    new PublicKey(value);
    return true;
  } catch (error) {
    throw new Error(`${fieldName} is not a valid Solana PublicKey: ${value}`);
  }
}

/**
 * Validate Solana transaction signature format
 * @param {string} value - The signature to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {boolean} - True if valid
 */
function validateTransactionSignature(value, fieldName = 'signature') {
  if (!value || typeof value !== 'string') {
    throw new Error(`${fieldName} is required and must be a string`);
  }

  // Solana signatures are base58-encoded and typically 88 characters
  if (value.length < 32 || value.length > 88) {
    throw new Error(`${fieldName} must be 32-88 characters long`);
  }

  // Basic base58 validation (contains only valid base58 characters)
  const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  for (const char of value) {
    if (!base58Chars.includes(char)) {
      throw new Error(`${fieldName} contains invalid characters (must be base58): ${value}`);
    }
  }

  return true;
}

/**
 * Validate amount (positive number, reasonable range)
 * @param {number|string} value - The amount to validate
 * @param {string} fieldName - Name of the field for error messages
 * @param {Object} options - Validation options
 * @returns {number} - The validated amount
 */
function validateAmount(value, fieldName = 'amount', options = {}) {
  const {
    min = 0.000000001, // Minimum 1 satoshi / 1 lamport equivalent
    max = 1000000,     // Maximum reasonable amount
    allowZero = false
  } = options;

  if (value === null || value === undefined) {
    throw new Error(`${fieldName} is required`);
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);

  if (isNaN(numValue)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  if (!allowZero && numValue <= 0) {
    throw new Error(`${fieldName} must be positive`);
  }

  if (allowZero && numValue < 0) {
    throw new Error(`${fieldName} cannot be negative`);
  }

  if (numValue < min) {
    throw new Error(`${fieldName} must be at least ${min}`);
  }

  if (numValue > max) {
    throw new Error(`${fieldName} cannot exceed ${max}`);
  }

  return numValue;
}

/**
 * Validate string length and content
 * @param {string} value - The string to validate
 * @param {string} fieldName - Name of the field for error messages
 * @param {Object} options - Validation options
 * @returns {string} - The sanitized string
 */
function validateString(value, fieldName = 'string', options = {}) {
  const {
    minLength = 1,
    maxLength = 1000,
    allowEmpty = false,
    pattern = null,
    sanitize = true
  } = options;

  if (!allowEmpty && (!value || typeof value !== 'string')) {
    throw new Error(`${fieldName} is required and must be a string`);
  }

  if (allowEmpty && (value === null || value === undefined)) {
    return '';
  }

  const strValue = String(value);

  if (!allowEmpty && strValue.trim().length < minLength) {
    throw new Error(`${fieldName} must be at least ${minLength} characters long`);
  }

  if (strValue.length > maxLength) {
    throw new Error(`${fieldName} cannot exceed ${maxLength} characters`);
  }

  if (pattern && !pattern.test(strValue)) {
    throw new Error(`${fieldName} format is invalid`);
  }

  // Enhanced sanitization - remove potentially dangerous characters and SQL injection attempts
  if (sanitize) {
    // Remove HTML/XML tags and dangerous characters
    let sanitized = strValue.replace(/[<>'"&]/g, '');

    // Additional SQL injection protection
    sanitized = sanitized.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi, '');

    // Remove potential script injection
    sanitized = sanitized.replace(/(javascript|vbscript|onload|onerror)/gi, '');

    // Remove null bytes and other control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    return sanitized;
  }

  return strValue;
}

/**
 * Validate Bitcoin address format
 * @param {string} value - The BTC address to validate
 * @returns {boolean} - True if valid
 */
function validateBitcoinAddress(value) {
  if (!value || typeof value !== 'string') {
    throw new Error('Bitcoin address is required and must be a string');
  }

  // Basic length check for BTC addresses
  if (value.length < 26 || value.length > 62) {
    throw new Error('Bitcoin address length is invalid');
  }

  // Check for valid BTC address prefixes
  const validPrefixes = ['1', '3', 'bc1'];
  const hasValidPrefix = validPrefixes.some(prefix => value.startsWith(prefix));

  if (!hasValidPrefix) {
    throw new Error('Bitcoin address has invalid prefix');
  }

  // Basic base58/bech32 character validation
  const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const bech32Chars = '023456789acdefghjklmnpqrstuvwxyz';

  for (const char of value) {
    if (!base58Chars.includes(char) && !bech32Chars.includes(char)) {
      throw new Error('Bitcoin address contains invalid characters');
    }
  }

  return true;
}

/**
 * Validate transfer type for metadata
 * @param {string} value - The transfer type
 * @returns {boolean} - True if valid
 */
function validateTransferType(value) {
  const validTypes = ['redemption', 'refund', 'funding', 'admin', 'test'];

  if (!validTypes.includes(value)) {
    throw new Error(`Transfer type must be one of: ${validTypes.join(', ')}`);
  }

  return true;
}

/**
 * Middleware function to validate bridge request
 */
function validateBridgeRequest(req, res, next) {
  try {
    const { solanaAddress, amount, bitcoinTxHash, zcashTxHash, useZecPrivacy } = req.body;

    // Validate Solana address
    if (solanaAddress) {
      validatePublicKey(solanaAddress, 'solanaAddress');
    }

    // Validate amount
    if (amount !== undefined) {
      req.body.amount = validateAmount(amount, 'amount', {
        min: 0.000000001,
        max: 1000 // Reasonable max for bridge amounts
      });
    }

    // Validate transaction hashes
    if (bitcoinTxHash) {
      validateTransactionSignature(bitcoinTxHash, 'bitcoinTxHash');
      // Could add more specific BTC tx validation here
    }

    if (zcashTxHash) {
      validateString(zcashTxHash, 'zcashTxHash', {
        minLength: 32,
        maxLength: 128
      });
    }

    // Ensure not both transaction hashes are provided
    if (bitcoinTxHash && zcashTxHash) {
      throw new Error('Cannot provide both bitcoinTxHash and zcashTxHash');
    }

    // Validate boolean flags
    if (useZecPrivacy !== undefined && typeof useZecPrivacy !== 'boolean') {
      throw new Error('useZecPrivacy must be a boolean');
    }

    next();
  } catch (error) {
    res.status(400).json({
      error: 'Validation failed',
      message: error.message,
      field: error.message.split(' ')[0].toLowerCase()
    });
  }
}

/**
 * Middleware function to validate swap request
 */
function validateSwapRequest(req, res, next) {
  try {
    const { solanaAddress, amount, direction } = req.body;

    // Validate required fields
    validatePublicKey(solanaAddress, 'solanaAddress');
    req.body.amount = validateAmount(amount, 'amount', {
      min: 0.000000001,
      max: 1000
    });

    // Validate direction
    if (direction) {
      const validDirections = ['sol_to_zenzec', 'zenzec_to_sol'];
      if (!validDirections.includes(direction)) {
        throw new Error(`Direction must be one of: ${validDirections.join(', ')}`);
      }
    }

    next();
  } catch (error) {
    res.status(400).json({
      error: 'Validation failed',
      message: error.message
    });
  }
}

/**
 * Middleware function to validate burn request
 */
function validateBurnRequest(req, res, next) {
  try {
    const { solanaAddress, amount, targetAsset, targetAddress } = req.body;

    // Validate required fields
    validatePublicKey(solanaAddress, 'solanaAddress');
    req.body.amount = validateAmount(amount, 'amount', {
      min: 0.000000001,
      max: 1000
    });

    // Validate target asset
    if (targetAsset) {
      const validAssets = ['SOL', 'BTC'];
      if (!validAssets.includes(targetAsset.toUpperCase())) {
        throw new Error(`Target asset must be one of: ${validAssets.join(', ')}`);
      }
      req.body.targetAsset = targetAsset.toUpperCase();
    }

    // Validate target address based on asset
    if (targetAddress) {
      if (req.body.targetAsset === 'SOL') {
        validatePublicKey(targetAddress, 'targetAddress');
      } else if (req.body.targetAsset === 'BTC') {
        validateBitcoinAddress(targetAddress);
      }
    }

    next();
  } catch (error) {
    res.status(400).json({
      error: 'Validation failed',
      message: error.message
    });
  }
}

/**
 * Middleware function to validate transaction ID parameter
 */
function validateTxId(req, res, next) {
  try {
    const { txId } = req.params;

    if (!txId) {
      throw new Error('Transaction ID is required');
    }

    // Transaction IDs are typically generated strings with specific patterns
    validateString(txId, 'txId', {
      minLength: 10,
      maxLength: 100,
      pattern: /^[a-zA-Z0-9_-]+$/
    });

    next();
  } catch (error) {
    res.status(400).json({
      error: 'Validation failed',
      message: error.message
    });
  }
}

/**
 * Middleware function to validate pagination parameters
 */
function validatePagination(req, res, next) {
  try {
    const { page, limit } = req.query;

    if (page !== undefined) {
      const pageNum = parseInt(page);
      if (isNaN(pageNum) || pageNum < 1 || pageNum > 10000) {
        throw new Error('Page must be a number between 1 and 10000');
      }
      req.query.page = pageNum;
    }

    if (limit !== undefined) {
      const limitNum = parseInt(limit);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        throw new Error('Limit must be a number between 1 and 100');
      }
      req.query.limit = limitNum;
    }

    next();
  } catch (error) {
    res.status(400).json({
      error: 'Validation failed',
      message: error.message
    });
  }
}

/**
 * Middleware to validate route params containing Solana signatures
 */
function validateSignatureParam(req, res, next) {
  try {
    const { signature } = req.params;
    validateTransactionSignature(signature, 'signature');
    next();
  } catch (error) {
    res.status(400).json({
      error: 'Validation failed',
      message: error.message
    });
  }
}

/**
 * Middleware function to validate mark redemption request
 */
function validateMarkRedemptionRequest(req, res, next) {
  try {
    const { solanaTxSignature, userAddress, amount } = req.body;

    // Validate required fields
    validateTransactionSignature(solanaTxSignature, 'solanaTxSignature');
    validatePublicKey(userAddress, 'userAddress');
    req.body.amount = validateAmount(amount, 'amount', {
      min: 0.000000001,
      max: 1000
    });

    next();
  } catch (error) {
    res.status(400).json({
      error: 'Validation failed',
      message: error.message
    });
  }
}

module.exports = {
  validatePublicKey,
  validateTransactionSignature,
  validateAmount,
  validateString,
  validateBitcoinAddress,
  validateTransferType,
  validateBridgeRequest,
  validateSwapRequest,
  validateBurnRequest,
  validateTxId,
  validatePagination,
  validateSignatureParam,
  validateMarkRedemptionRequest
};
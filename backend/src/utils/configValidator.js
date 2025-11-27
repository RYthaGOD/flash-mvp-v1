/**
 * Configuration Validator
 * Validates required environment variables at startup
 */

class ConfigValidator {
  /**
   * Validate configuration
   * @param {boolean} strict - If true, throw errors on missing required vars
   * @returns {Object} Validation result with warnings and errors
   */
  static validate(strict = false) {
    const errors = [];
    const warnings = [];

    // Required for core functionality
    const required = {
      // PROGRAM_ID: 'Solana program ID', // Optional for BTC deposit flow
      // ZENZEC_MINT: 'zenZEC mint address', // Not needed - using USDC treasury + Jupiter swaps
    };

    // Optional but recommended
    const recommended = {
      SOLANA_RPC_URL: 'Solana RPC endpoint (will use default if not set)',
      RELAYER_KEYPAIR_PATH: 'Relayer keypair path (required for minting/relaying)',
      DB_HOST: 'Database host (database features disabled if not set)',
      DB_NAME: 'Database name',
      DB_USER: 'Database user',
      DB_PASSWORD: 'Database password',
    };

    // Check required variables
    for (const [key, description] of Object.entries(required)) {
      if (!process.env[key] || process.env[key] === '') {
        const error = `Missing required environment variable: ${key} (${description})`;
        if (strict) {
          errors.push(error);
        } else {
          warnings.push(error);
        }
      }
    }

    // Check recommended variables
    for (const [key, description] of Object.entries(recommended)) {
      if (!process.env[key] || process.env[key] === '') {
        warnings.push(`Missing recommended environment variable: ${key} (${description})`);
      }
    }

    // Validate specific values
    if (process.env.SOLANA_NETWORK) {
      const validNetworks = ['devnet', 'testnet', 'mainnet-beta', 'localnet'];
      if (!validNetworks.includes(process.env.SOLANA_NETWORK)) {
        warnings.push(`Invalid SOLANA_NETWORK: ${process.env.SOLANA_NETWORK}. Valid options: ${validNetworks.join(', ')}`);
      }
    }

    if (process.env.PORT) {
      const port = parseInt(process.env.PORT, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        errors.push(`Invalid PORT: ${process.env.PORT}. Must be a number between 1 and 65535`);
      }
    }

    // Validate numeric rates if set
    const rateVars = ['ZENZEC_TO_SOL_RATE', 'SOL_TO_ZENZEC_RATE', 'ZENZEC_TO_BTC_RATE'];
    for (const varName of rateVars) {
      if (process.env[varName]) {
        const rate = parseFloat(process.env[varName]);
        if (isNaN(rate) || rate <= 0) {
          warnings.push(`Invalid ${varName}: ${process.env[varName]}. Must be a positive number`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Log validation results
   * @param {Object} result - Validation result
   */
  static logResults(result) {
    if (result.errors.length > 0) {
      console.error('='.repeat(60));
      console.error('CONFIGURATION ERRORS:');
      result.errors.forEach(error => console.error(`  ❌ ${error}`));
      console.error('='.repeat(60));
    }

    if (result.warnings.length > 0) {
      console.warn('='.repeat(60));
      console.warn('CONFIGURATION WARNINGS:');
      result.warnings.forEach(warning => console.warn(`  ⚠️  ${warning}`));
      console.warn('='.repeat(60));
    }

    if (result.valid && result.warnings.length === 0) {
      console.log('✓ Configuration validated successfully');
    }
  }
}

module.exports = ConfigValidator;


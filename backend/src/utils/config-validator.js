/**
 * Configuration Validator - PRODUCTION MODE
 * Validates all required environment variables for production deployment
 * No fallbacks, no simulation - all configuration must be explicit
 */

class ConfigValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Validate required configuration
   * @returns {Object} Validation result
   */
  validate() {
    this.errors = [];
    this.warnings = [];

    // Check all required production configuration
    this.checkRequiredConfig();
    this.checkArciumConfig();
    this.checkBitcoinConfig();
    this.checkDatabaseConfig();
    this.checkSecurityConfig();

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  checkRequiredConfig() {
    const required = {
      FRONTEND_ORIGIN: 'Frontend URL for CORS',
      ADMIN_API_KEY: 'Admin API key for protected endpoints',
      FLASH_BRIDGE_MXE_PROGRAM_ID: 'Deployed Solana program ID',
      SOLANA_RPC_URL: 'Solana RPC endpoint',
      RELAYER_KEYPAIR_PATH: 'Path to relayer keypair file',
    };

    for (const [key, description] of Object.entries(required)) {
      if (!process.env[key] || process.env[key].trim() === '') {
        this.errors.push({
          key,
          message: `${description} is required`,
          solution: `Set ${key} in your .env file`,
        });
      }
    }
  }

  checkArciumConfig() {
    // Arcium MPC is always required - no simulation
    const arciumRequired = {
      ARCIUM_ENDPOINT: 'Arcium node endpoint',
      ARCIUM_CLUSTER_ID: 'Arcium cluster ID',
      ARCIUM_NODE_OFFSET: 'Arcium node offset',
    };

    for (const [key, description] of Object.entries(arciumRequired)) {
      if (!process.env[key] || process.env[key].trim() === '') {
        this.errors.push({
          key,
          message: `${description} is required for real MPC`,
          solution: `Set ${key} from your Arcium node registration`,
        });
      }
    }

    // Warn if simulation flags are set (they will be ignored)
    if (process.env.ARCIUM_SIMULATED === 'true') {
      this.warnings.push({
        key: 'ARCIUM_SIMULATED',
        message: 'Simulation mode is DISABLED in production',
        impact: 'This setting will be ignored - real MPC is always used',
      });
    }
  }

  checkBitcoinConfig() {
    const btcRequired = {
      BITCOIN_NETWORK: 'Bitcoin network (mainnet/testnet)',
      BITCOIN_BRIDGE_ADDRESS: 'Bitcoin bridge deposit address',
    };

    for (const [key, description] of Object.entries(btcRequired)) {
      if (!process.env[key] || process.env[key].trim() === '') {
        this.errors.push({
          key,
          message: `${description} is required`,
          solution: `Set ${key} in your .env file`,
        });
      }
    }

    // Validate Bitcoin address format
    const btcAddress = process.env.BITCOIN_BRIDGE_ADDRESS;
    if (btcAddress) {
      const network = process.env.BITCOIN_NETWORK;
      if (network === 'mainnet' && !btcAddress.startsWith('bc1') && !btcAddress.startsWith('1') && !btcAddress.startsWith('3')) {
        this.errors.push({
          key: 'BITCOIN_BRIDGE_ADDRESS',
          message: 'Invalid mainnet Bitcoin address format',
          solution: 'Use a valid mainnet address (starts with bc1, 1, or 3)',
        });
      }
      if (network === 'testnet' && !btcAddress.startsWith('tb1') && !btcAddress.startsWith('m') && !btcAddress.startsWith('n') && !btcAddress.startsWith('2')) {
        this.errors.push({
          key: 'BITCOIN_BRIDGE_ADDRESS',
          message: 'Invalid testnet Bitcoin address format',
          solution: 'Use a valid testnet address (starts with tb1, m, n, or 2)',
        });
      }
    }

    // Check confirmation requirement
    const confirmations = parseInt(process.env.BITCOIN_REQUIRED_CONFIRMATIONS || '1');
    if (process.env.BITCOIN_NETWORK === 'mainnet' && confirmations < 3) {
      this.warnings.push({
        key: 'BITCOIN_REQUIRED_CONFIRMATIONS',
        message: `Low confirmation requirement (${confirmations}) on mainnet`,
        impact: 'Recommend 3+ confirmations for production security',
      });
    }
  }

  checkDatabaseConfig() {
    const dbRequired = {
      DB_HOST: 'Database host',
      DB_NAME: 'Database name',
      DB_USER: 'Database user',
      DB_PASSWORD: 'Database password',
    };

    for (const [key, description] of Object.entries(dbRequired)) {
      if (!process.env[key] || process.env[key].trim() === '') {
        this.errors.push({
          key,
          message: `${description} is required for production`,
          solution: `Set ${key} with your PostgreSQL configuration`,
        });
      }
    }
  }

  checkSecurityConfig() {
    // Check admin API key strength
    const adminKey = process.env.ADMIN_API_KEY;
    if (adminKey && adminKey.length < 32) {
      this.warnings.push({
        key: 'ADMIN_API_KEY',
        message: 'Admin API key is short',
        impact: 'Recommend at least 32 characters for security',
        solution: 'Generate with: openssl rand -hex 32',
      });
    }

    // Check if running in production mode
    if (process.env.NODE_ENV !== 'production') {
      this.warnings.push({
        key: 'NODE_ENV',
        message: `Running in ${process.env.NODE_ENV || 'development'} mode`,
        impact: 'Set to production for optimal security',
      });
    }
  }

  /**
   * Print validation results to console
   */
  printResults() {
    console.log('═'.repeat(60));
    console.log('🔍 PRODUCTION Configuration Validation');
    console.log('═'.repeat(60));

    if (this.errors.length === 0) {
      console.log('✅ All required configuration present');
    } else {
      console.log(`❌ Found ${this.errors.length} CRITICAL configuration error(s):\n`);
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.key}`);
        console.log(`   ❌ ${error.message}`);
        console.log(`   💡 ${error.solution}`);
        console.log('');
      });
    }

    if (this.warnings.length > 0) {
      console.log(`⚠️  ${this.warnings.length} warning(s):\n`);
      this.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning.key}`);
        console.log(`   ⚠️  ${warning.message}`);
        if (warning.impact) {
          console.log(`   📌 ${warning.impact}`);
        }
        if (warning.solution) {
          console.log(`   💡 ${warning.solution}`);
        }
        console.log('');
      });
    }

    console.log('═'.repeat(60));
  }

  /**
   * Get summary for health endpoint
   */
  getSummary() {
    return {
      valid: this.errors.length === 0,
      mode: 'production',
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      arciumConfigured: !!process.env.ARCIUM_ENDPOINT && !!process.env.ARCIUM_CLUSTER_ID,
      bitcoinConfigured: !!process.env.BITCOIN_BRIDGE_ADDRESS,
      databaseConfigured: !!process.env.DB_HOST && !!process.env.DB_PASSWORD,
      solanaConfigured: !!process.env.SOLANA_RPC_URL && !!process.env.FLASH_BRIDGE_MXE_PROGRAM_ID,
    };
  }
}

module.exports = new ConfigValidator();

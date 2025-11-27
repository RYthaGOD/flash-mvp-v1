/**
 * Configuration Validator
 * Validates environment variables and provides helpful error messages
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

    // Check critical privacy configuration
    this.checkPrivacyConfig();
    
    // Check optional but recommended configuration
    this.checkOptionalConfig();

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  checkPrivacyConfig() {
    const arciumEnabled = process.env.ENABLE_ARCIUM_MPC;
    
    if (!arciumEnabled || arciumEnabled === 'false') {
      this.errors.push({
        key: 'ENABLE_ARCIUM_MPC',
        message: 'Privacy requires Arcium MPC',
        solution: 'Set ENABLE_ARCIUM_MPC=true in .env file',
        mvpNote: 'For MVP: Enables simulated privacy (no real network needed)',
      });
    }
  }

  checkOptionalConfig() {
    // Solana RPC
    if (!process.env.SOLANA_RPC_URL) {
      this.warnings.push({
        key: 'SOLANA_RPC_URL',
        message: 'Solana RPC not configured',
        default: 'Using http://127.0.0.1:8899',
        impact: 'Will fail if local validator not running',
      });
    }

    // zenZEC Mint
    if (!process.env.ZENZEC_MINT || process.env.ZENZEC_MINT === 'YourZenZECMintAddressHere') {
      this.warnings.push({
        key: 'ZENZEC_MINT',
        message: 'zenZEC mint not configured',
        impact: 'Demo mode: Generates mock transactions',
        solution: 'Run: npm run create-mint',
      });
    }

    // Database path
    if (!process.env.DATABASE_PATH) {
      this.warnings.push({
        key: 'DATABASE_PATH',
        message: 'Database path not configured',
        default: 'Using ./database/flash-bridge.db',
      });
    }
  }

  /**
   * Print validation results to console
   */
  printResults() {
    console.log('='.repeat(60));
    console.log('🔍 Configuration Validation');
    console.log('='.repeat(60));

    if (this.errors.length === 0) {
      console.log('✅ All critical configuration valid');
    } else {
      console.log(`❌ Found ${this.errors.length} configuration error(s):\n`);
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.key}`);
        console.log(`   ❌ ${error.message}`);
        console.log(`   💡 ${error.solution}`);
        if (error.mvpNote) {
          console.log(`   ℹ️  ${error.mvpNote}`);
        }
        console.log('');
      });
    }

    if (this.warnings.length > 0) {
      console.log(`⚠️  ${this.warnings.length} optional configuration(s):\n`);
      this.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning.key}`);
        console.log(`   ⚠️  ${warning.message}`);
        if (warning.default) {
          console.log(`   📍 ${warning.default}`);
        }
        if (warning.impact) {
          console.log(`   📌 ${warning.impact}`);
        }
        if (warning.solution) {
          console.log(`   💡 ${warning.solution}`);
        }
        console.log('');
      });
    }

    console.log('='.repeat(60));
  }

  /**
   * Get summary for health endpoint
   */
  getSummary() {
    return {
      valid: this.errors.length === 0,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      privacyConfigured: process.env.ENABLE_ARCIUM_MPC === 'true',
      databaseConfigured: !!process.env.DATABASE_PATH,
      solanaConfigured: !!process.env.SOLANA_RPC_URL,
    };
  }
}

module.exports = new ConfigValidator();


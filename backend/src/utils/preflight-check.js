#!/usr/bin/env node
/**
 * Pre-flight Configuration Checker
 * =================================
 * Validates all required configuration before starting the server
 * Run standalone: node src/utils/preflight-check.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

class PreflightChecker {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
  }

  // Check if a required env var is set
  checkRequired(key, description) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      this.errors.push({ key, message: `${description} is required` });
      return false;
    }
    return true;
  }

  // Check if an optional env var is set, warn if not
  checkOptional(key, description, defaultValue = null) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      if (defaultValue) {
        this.info.push({ key, message: `${description} not set, using default: ${defaultValue}` });
      } else {
        this.warnings.push({ key, message: `${description} not configured` });
      }
      return false;
    }
    return true;
  }

  // Check if a file exists
  checkFile(filePath, description) {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      this.errors.push({ key: filePath, message: `${description} not found at: ${resolvedPath}` });
      return false;
    }
    return true;
  }

  // Validate URL format
  checkUrl(key, description) {
    const value = process.env[key];
    if (!value) return false;
    
    try {
      new URL(value);
      return true;
    } catch {
      this.errors.push({ key, message: `${description} is not a valid URL: ${value}` });
      return false;
    }
  }

  // Validate network value
  checkNetwork(key, validValues, description) {
    const value = process.env[key];
    if (!value) return false;
    
    if (!validValues.includes(value.toLowerCase())) {
      this.errors.push({ 
        key, 
        message: `${description} must be one of: ${validValues.join(', ')}. Got: ${value}` 
      });
      return false;
    }
    return true;
  }

  // Run all checks
  async runChecks() {
    console.log(`\n${CYAN}╔═══════════════════════════════════════════════════════════════╗${RESET}`);
    console.log(`${CYAN}║           FLASH Bridge Pre-flight Configuration Check         ║${RESET}`);
    console.log(`${CYAN}╚═══════════════════════════════════════════════════════════════╝${RESET}\n`);

    // ==========================================================================
    // Server Configuration
    // ==========================================================================
    console.log(`${YELLOW}▶ Server Configuration${RESET}`);
    
    this.checkOptional('PORT', 'Server port', '3001');
    this.checkRequired('FRONTEND_ORIGIN', 'Frontend origin (CORS)');
    this.checkRequired('ADMIN_API_KEY', 'Admin API key');
    
    // Check if admin key is still the default
    if (process.env.ADMIN_API_KEY === 'change-me-generate-a-secure-key') {
      this.errors.push({ key: 'ADMIN_API_KEY', message: 'Admin API key is still the default! Generate a secure key.' });
    }

    // ==========================================================================
    // Solana Configuration
    // ==========================================================================
    console.log(`${YELLOW}▶ Solana Configuration${RESET}`);
    
    this.checkRequired('SOLANA_RPC_URL', 'Solana RPC URL');
    this.checkUrl('SOLANA_RPC_URL', 'Solana RPC URL');
    this.checkRequired('FLASH_BRIDGE_MXE_PROGRAM_ID', 'Flash Bridge program ID');
    this.checkRequired('RELAYER_KEYPAIR_PATH', 'Relayer keypair path');
    
    // Check keypair file exists
    const keypairPath = process.env.RELAYER_KEYPAIR_PATH;
    if (keypairPath) {
      this.checkFile(keypairPath, 'Relayer keypair file');
    }
    
    this.checkNetwork('SOLANA_NETWORK', ['devnet', 'testnet', 'mainnet-beta'], 'Solana network');

    // ==========================================================================
    // Arcium Configuration
    // ==========================================================================
    console.log(`${YELLOW}▶ Arcium MPC Configuration${RESET}`);
    
    this.checkRequired('ARCIUM_ENDPOINT', 'Arcium endpoint');
    this.checkUrl('ARCIUM_ENDPOINT', 'Arcium endpoint');
    this.checkRequired('ARCIUM_CLUSTER_ID', 'Arcium cluster ID');
    this.checkRequired('ARCIUM_NODE_OFFSET', 'Arcium node offset');

    // ==========================================================================
    // Bitcoin Configuration
    // ==========================================================================
    console.log(`${YELLOW}▶ Bitcoin Configuration${RESET}`);
    
    this.checkRequired('BITCOIN_BRIDGE_ADDRESS', 'Bitcoin bridge address');
    this.checkNetwork('BITCOIN_NETWORK', ['mainnet', 'testnet'], 'Bitcoin network');
    
    // Validate BTC address format
    const btcAddress = process.env.BITCOIN_BRIDGE_ADDRESS;
    const btcNetwork = process.env.BITCOIN_NETWORK;
    if (btcAddress && btcNetwork) {
      if (btcNetwork === 'mainnet' && !btcAddress.match(/^(bc1|[13])/)) {
        this.errors.push({ key: 'BITCOIN_BRIDGE_ADDRESS', message: 'Invalid mainnet address format (should start with bc1, 1, or 3)' });
      }
      if (btcNetwork === 'testnet' && !btcAddress.match(/^(tb1|[mn2])/)) {
        this.errors.push({ key: 'BITCOIN_BRIDGE_ADDRESS', message: 'Invalid testnet address format (should start with tb1, m, n, or 2)' });
      }
    }

    // ==========================================================================
    // Database Configuration
    // ==========================================================================
    console.log(`${YELLOW}▶ Database Configuration${RESET}`);
    
    this.checkRequired('DB_HOST', 'Database host');
    this.checkRequired('DB_NAME', 'Database name');
    this.checkRequired('DB_USER', 'Database user');
    this.checkRequired('DB_PASSWORD', 'Database password');
    
    // Test database connection if all config present
    if (this.errors.filter(e => e.key.startsWith('DB_')).length === 0) {
      await this.testDatabaseConnection();
    }

    // ==========================================================================
    // Redis Configuration (Optional)
    // ==========================================================================
    console.log(`${YELLOW}▶ Redis Configuration (Optional)${RESET}`);
    
    const hasRedis = this.checkOptional('REDIS_URL', 'Redis URL') || 
                     this.checkOptional('REDIS_HOST', 'Redis host');
    
    if (!hasRedis) {
      this.warnings.push({ 
        key: 'REDIS', 
        message: 'Redis not configured - rate limiting will use in-memory storage (not scalable)' 
      });
    }

    // ==========================================================================
    // Print Results
    // ==========================================================================
    this.printResults();
    
    return this.errors.length === 0;
  }

  async testDatabaseConnection() {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectionTimeoutMillis: 5000,
      });
      
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      await pool.end();
      
      this.info.push({ key: 'DATABASE', message: 'Database connection successful' });
    } catch (error) {
      this.errors.push({ key: 'DATABASE', message: `Database connection failed: ${error.message}` });
    }
  }

  printResults() {
    console.log(`\n${CYAN}═══════════════════════════════════════════════════════════════${RESET}\n`);

    // Print errors
    if (this.errors.length > 0) {
      console.log(`${RED}❌ ERRORS (${this.errors.length}) - Must fix before starting:${RESET}\n`);
      this.errors.forEach(err => {
        console.log(`   ${RED}✗${RESET} ${err.key}: ${err.message}`);
      });
      console.log('');
    }

    // Print warnings
    if (this.warnings.length > 0) {
      console.log(`${YELLOW}⚠️  WARNINGS (${this.warnings.length}):${RESET}\n`);
      this.warnings.forEach(warn => {
        console.log(`   ${YELLOW}!${RESET} ${warn.key}: ${warn.message}`);
      });
      console.log('');
    }

    // Print info
    if (this.info.length > 0) {
      console.log(`${GREEN}ℹ️  INFO:${RESET}\n`);
      this.info.forEach(info => {
        console.log(`   ${GREEN}✓${RESET} ${info.key}: ${info.message}`);
      });
      console.log('');
    }

    // Summary
    console.log(`${CYAN}═══════════════════════════════════════════════════════════════${RESET}\n`);
    
    if (this.errors.length === 0) {
      console.log(`${GREEN}✅ All pre-flight checks passed! System ready to start.${RESET}\n`);
    } else {
      console.log(`${RED}❌ Pre-flight checks failed. Please fix ${this.errors.length} error(s) above.${RESET}\n`);
      console.log(`   Edit your ${YELLOW}.env${RESET} file and run this check again:\n`);
      console.log(`   ${CYAN}node src/utils/preflight-check.js${RESET}\n`);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const checker = new PreflightChecker();
  checker.runChecks().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = PreflightChecker;


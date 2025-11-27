const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const execAsync = promisify(exec);

/**
 * Zcash Wallet Service using zecwallet-light-cli
 * Provides programmatic access to Zcash wallet operations
 */
class ZcashWalletService {
  constructor() {
    // Path to zecwallet-cli binary
    this.cliPath = process.env.ZECWALLET_CLI_PATH || 'zecwallet-cli';
    
    // Wallet data directory
    this.walletDir = process.env.ZCASH_WALLET_DIR || path.join(os.homedir(), '.zcash');
    
    // Lightwalletd server URL
    this.server = process.env.ZCASH_LIGHTWALLETD_URL || 'https://zcash-mainnet.chainsafe.dev';
    
    // Network
    this.network = process.env.ZCASH_NETWORK || 'mainnet';
    
    // Wallet file path
    this.walletFile = path.join(this.walletDir, 'zecwallet-light-wallet.dat');
    
    this.initialized = false;
  }

  /**
   * Get base command with common options
   */
  getBaseCommand() {
    return `${this.cliPath} --server ${this.server}`;
  }

  /**
   * Execute zecwallet-cli command
   * @param {string} command - Command to execute
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Command output
   */
  async executeCommand(command, options = {}) {
    try {
      const fullCommand = `${this.getBaseCommand()} ${command}`;
      console.log(`Executing: ${fullCommand}`);
      
      const { stdout, stderr } = await execAsync(fullCommand, {
        cwd: this.walletDir,
        timeout: 30000, // 30 second timeout
        ...options,
      });

      if (stderr && !stderr.includes('warning')) {
        console.warn('zecwallet-cli stderr:', stderr);
      }

      return stdout.trim();
    } catch (error) {
      console.error(`Error executing zecwallet-cli command: ${error.message}`);
      throw new Error(`Zcash wallet command failed: ${error.message}`);
    }
  }

  /**
   * Check if wallet exists
   * @returns {Promise<boolean>}
   */
  async walletExists() {
    try {
      await fs.access(this.walletFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize wallet (create if doesn't exist)
   * @param {string} seedPhrase - Optional seed phrase for restoration
   * @returns {Promise<boolean>} Success status
   */
  async initializeWallet(seedPhrase = null) {
    try {
      // Ensure wallet directory exists
      await fs.mkdir(this.walletDir, { recursive: true });

      const exists = await this.walletExists();
      
      if (exists) {
        console.log('Wallet already exists');
        this.initialized = true;
        return true;
      }

      if (seedPhrase) {
        // Restore from seed phrase
        console.log('Restoring wallet from seed phrase...');
        await this.executeCommand(`--seed "${seedPhrase}"`, {
          env: { ...process.env },
        });
      } else {
        // Create new wallet (first command will create it)
        console.log('Creating new wallet...');
        // The wallet is created on first use, so we'll just check addresses
        await this.executeCommand('addresses');
      }

      this.initialized = true;
      console.log('Wallet initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing wallet:', error);
      throw error;
    }
  }

  /**
   * Get all wallet addresses
   * @returns {Promise<Array>} Array of addresses
   */
  async getAddresses() {
    try {
      const output = await this.executeCommand('addresses');
      
      // Parse addresses from output
      // Format: "Address: zs1..."
      const addresses = [];
      const lines = output.split('\n');
      
      for (const line of lines) {
        // Look for shielded addresses (zs1...)
        const shieldedMatch = line.match(/zs1[a-z0-9]+/i);
        if (shieldedMatch) {
          addresses.push({
            address: shieldedMatch[0],
            type: 'shielded',
          });
        }
        
        // Look for transparent addresses (t1..., t3...)
        const transparentMatch = line.match(/(t1|t3)[a-zA-Z0-9]+/);
        if (transparentMatch) {
          addresses.push({
            address: transparentMatch[0],
            type: 'transparent',
          });
        }
      }

      return addresses;
    } catch (error) {
      console.error('Error getting addresses:', error);
      throw error;
    }
  }

  /**
   * Get the first shielded address (bridge address)
   * @returns {Promise<string>} Shielded address
   */
  async getBridgeAddress() {
    try {
      const addresses = await this.getAddresses();
      const shielded = addresses.find(addr => addr.type === 'shielded');
      
      if (!shielded) {
        // If no shielded address exists, create one by getting addresses
        // This will trigger wallet creation if needed
        await this.initializeWallet();
        const newAddresses = await this.getAddresses();
        const newShielded = newAddresses.find(addr => addr.type === 'shielded');
        
        if (!newShielded) {
          throw new Error('Could not generate shielded address');
        }
        
        return newShielded.address;
      }

      return shielded.address;
    } catch (error) {
      console.error('Error getting bridge address:', error);
      throw error;
    }
  }

  /**
   * Get wallet balance
   * @returns {Promise<Object>} Balance information
   */
  async getBalance() {
    try {
      const output = await this.executeCommand('balance');
      
      // Parse balance from output
      // Format varies, but typically shows "Total: X.XXXX ZEC"
      const balanceMatch = output.match(/Total:\s*([\d.]+)\s*ZEC/i);
      const confirmedMatch = output.match(/Confirmed:\s*([\d.]+)\s*ZEC/i);
      const unconfirmedMatch = output.match(/Unconfirmed:\s*([\d.]+)\s*ZEC/i);

      return {
        total: balanceMatch ? parseFloat(balanceMatch[1]) : 0,
        confirmed: confirmedMatch ? parseFloat(confirmedMatch[1]) : 0,
        unconfirmed: unconfirmedMatch ? parseFloat(unconfirmedMatch[1]) : 0,
        raw: output,
      };
    } catch (error) {
      console.error('Error getting balance:', error);
      // Return zero balance on error
      return {
        total: 0,
        confirmed: 0,
        unconfirmed: 0,
        raw: '',
      };
    }
  }

  /**
   * Send ZEC to an address
   * @param {string} toAddress - Recipient address
   * @param {number} amount - Amount in ZEC
   * @returns {Promise<string>} Transaction hash
   */
  async sendZec(toAddress, amount) {
    try {
      const output = await this.executeCommand(`send "${toAddress}" ${amount}`);
      
      // Parse transaction hash from output
      // Format: "Transaction sent: <txhash>"
      const txHashMatch = output.match(/Transaction\s+(?:sent|hash):\s*([a-f0-9]+)/i);
      
      if (txHashMatch) {
        return txHashMatch[1];
      }

      // Alternative format
      const altMatch = output.match(/([a-f0-9]{64})/i);
      if (altMatch) {
        return altMatch[1];
      }

      throw new Error('Could not parse transaction hash from output');
    } catch (error) {
      console.error('Error sending ZEC:', error);
      throw error;
    }
  }

  /**
   * Get transaction history
   * @param {number} limit - Number of transactions to retrieve
   * @returns {Promise<Array>} Array of transactions
   */
  async getTransactions(limit = 10) {
    try {
      const output = await this.executeCommand('list');
      
      // Parse transactions from output
      // Format varies by zecwallet-cli version
      const transactions = [];
      const lines = output.split('\n');
      
      for (const line of lines) {
        // Look for transaction patterns
        const txMatch = line.match(/([a-f0-9]{64})/i);
        if (txMatch) {
          transactions.push({
            txHash: txMatch[1],
            // Additional parsing would go here
          });
        }
      }

      return transactions.slice(0, limit);
    } catch (error) {
      console.error('Error getting transactions:', error);
      return [];
    }
  }

  /**
   * Sync wallet with blockchain
   * @returns {Promise<boolean>} Success status
   */
  async sync() {
    try {
      console.log('Syncing wallet...');
      await this.executeCommand('sync');
      console.log('Wallet sync completed');
      return true;
    } catch (error) {
      console.error('Error syncing wallet:', error);
      // Sync errors are often non-fatal
      return false;
    }
  }

  /**
   * Get wallet status
   * @returns {Promise<Object>} Wallet status
   */
  async getStatus() {
    try {
      const exists = await this.walletExists();
      const addresses = exists ? await this.getAddresses() : [];
      const balance = exists ? await this.getBalance() : { total: 0, confirmed: 0, unconfirmed: 0 };

      return {
        initialized: this.initialized,
        walletExists: exists,
        addressCount: addresses.length,
        shieldedAddresses: addresses.filter(a => a.type === 'shielded').length,
        transparentAddresses: addresses.filter(a => a.type === 'transparent').length,
        balance: balance.total,
        confirmedBalance: balance.confirmed,
        server: this.server,
        network: this.network,
        walletFile: this.walletFile,
      };
    } catch (error) {
      console.error('Error getting wallet status:', error);
      return {
        initialized: false,
        walletExists: false,
        error: error.message,
      };
    }
  }
}

module.exports = new ZcashWalletService();

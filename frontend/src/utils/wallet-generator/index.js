// Bitcoin Testnet Wallet Generator (Simplified for MVP)
// Focus on BTC testnet to prove bridge functionality

import BitcoinTestnetGenerator from './bitcoin-testnet.js';

class TestnetWalletGenerator {
  constructor() {
    this.generators = {
      bitcoin: new BitcoinTestnetGenerator()
    };
  }

  // Generate Bitcoin testnet wallet only
  async generateAllWallets() {
    const wallets = {};

    try {
      wallets.bitcoin = this.generators.bitcoin.generateWallet();

      return {
        success: true,
        wallets,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        wallets: null
      };
    }
  }

  // Generate wallet for specific chain
  generateWallet(chain) {
    try {
      if (chain !== 'bitcoin') {
        throw new Error('Only Bitcoin testnet supported in MVP');
      }

      return {
        success: true,
        wallet: this.generators.bitcoin.generateWallet()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        wallet: null
      };
    }
  }

  // Validate generated wallet
  validateWallet(wallet) {
    if (!wallet) return false;
    return wallet.address?.startsWith('m') || wallet.address?.startsWith('n');
  }

  // Get wallet info for display
  getWalletInfo(wallet) {
    return {
      type: wallet.type,
      network: wallet.network,
      addresses: {
        receiving: wallet.address,
        format: 'Testnet (starts with m/n)'
      }
    };
  }
}

export default TestnetWalletGenerator;

// Export Bitcoin generator for direct use
export { BitcoinTestnetGenerator };

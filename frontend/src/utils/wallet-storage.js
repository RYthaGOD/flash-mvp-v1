// Wallet Storage Utility
// Handles localStorage persistence for generated wallets

const STORAGE_KEY = 'flash_bridge_wallets';
const CURRENT_WALLET_KEY = 'flash_bridge_current_wallet';

class WalletStorage {
  /**
   * Save wallets to localStorage
   * @param {Object} wallets - Wallet object with chain keys (e.g., { bitcoin: {...} })
   */
  static saveWallets(wallets) {
    try {
      const walletsToSave = {};
      
      // CRITICAL SECURITY: DO NOT STORE PRIVATE KEYS IN BROWSER STORAGE
      // This is a temporary implementation for demo purposes only
      // In production, private keys should NEVER be stored in localStorage
      console.warn('🚨 SECURITY WARNING: Private keys are being stored in browser localStorage!');
      console.warn('   This is INSECURE and should NEVER be done in production!');

      if (wallets.bitcoin) {
        walletsToSave.bitcoin = {
          address: wallets.bitcoin.address,
          // wif: wallets.bitcoin.wif, // REMOVED: Never store private keys!
          type: wallets.bitcoin.type,
          network: wallets.bitcoin.network,
          createdAt: wallets.bitcoin.createdAt || new Date().toISOString(),
          // Store only public information
          warning: 'Private key not stored for security reasons'
        };
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(walletsToSave));
      
      // Also save as current wallet
      if (wallets.bitcoin) {
        localStorage.setItem(CURRENT_WALLET_KEY, JSON.stringify(walletsToSave.bitcoin));
      }
      
      return true;
    } catch (error) {
      console.error('Error saving wallets to localStorage:', error);
      return false;
    }
  }

  /**
   * Load wallets from localStorage
   * @returns {Object|null} Wallets object or null if not found
   */
  static loadWallets() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      
      const wallets = JSON.parse(stored);
      return wallets;
    } catch (error) {
      console.error('Error loading wallets from localStorage:', error);
      return null;
    }
  }

  /**
   * Get current active wallet
   * @returns {Object|null} Current wallet or null
   */
  static getCurrentWallet() {
    try {
      const stored = localStorage.getItem(CURRENT_WALLET_KEY);
      if (!stored) return null;
      
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error loading current wallet from localStorage:', error);
      return null;
    }
  }

  /**
   * Set current active wallet
   * @param {Object} wallet - Wallet object to set as current
   */
  static setCurrentWallet(wallet) {
    try {
      localStorage.setItem(CURRENT_WALLET_KEY, JSON.stringify(wallet));
      return true;
    } catch (error) {
      console.error('Error setting current wallet:', error);
      return false;
    }
  }

  /**
   * Clear all stored wallets
   */
  static clearWallets() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CURRENT_WALLET_KEY);
      return true;
    } catch (error) {
      console.error('Error clearing wallets:', error);
      return false;
    }
  }

  /**
   * Check if wallets exist in storage
   * @returns {boolean}
   */
  static hasWallets() {
    const wallets = this.loadWallets();
    return wallets !== null && Object.keys(wallets).length > 0;
  }
}

export default WalletStorage;


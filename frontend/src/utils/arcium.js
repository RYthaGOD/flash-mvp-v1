/**
 * Arcium Client Utilities
 * Handles client-side encryption and MPC interactions
 */

import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

class ArciumClient {
  constructor() {
    this.enabled = false;
    this.status = null;
  }

  /**
   * Initialize and check Arcium status
   */
  async initialize() {
    try {
      const response = await axios.get(`${API_URL}/api/arcium/status`);
      this.enabled = response.data.enabled && response.data.connected;
      this.status = response.data;
      return this.status;
    } catch (error) {
      console.error('Failed to initialize Arcium:', error);
      this.enabled = false;
      return null;
    }
  }

  /**
   * Check if Arcium MPC is available
   */
  isAvailable() {
    return this.enabled;
  }

  /**
   * Encrypt amount before sending to bridge
   * @param {number} amount - Amount to encrypt
   * @param {string} recipientPubkey - Recipient public key
   * @returns {Promise<Object>} Encrypted amount data
   */
  async encryptAmount(amount, recipientPubkey) {
    if (!this.enabled) {
      return { encrypted: false, amount };
    }

    try {
      const response = await axios.post(`${API_URL}/api/arcium/encrypt-amount`, {
        amount,
        recipientPubkey,
      });

      return response.data.encrypted;
    } catch (error) {
      console.error('Failed to encrypt amount:', error);
      // Fallback to unencrypted
      return { encrypted: false, amount };
    }
  }

  /**
   * Create private bridge transaction
   * @param {string} solanaAddress - Destination address
   * @param {number} amount - Amount to bridge
   * @param {boolean} swapToSol - Whether to swap
   * @param {boolean} useEncryption - Use encryption
   * @returns {Promise<Object>} Transaction result
   */
  async createPrivateBridgeTx(solanaAddress, amount, swapToSol, useEncryption = true) {
    try {
      const response = await axios.post(`${API_URL}/api/arcium/bridge/private`, {
        solanaAddress,
        amount,
        swapToSol,
        useEncryption: useEncryption && this.enabled,
      });

      return response.data;
    } catch (error) {
      console.error('Failed to create private bridge tx:', error);
      throw error;
    }
  }

  /**
   * Get computation status
   * @param {string} computationId - Computation ID
   * @returns {Promise<Object>} Status
   */
  async getComputationStatus(computationId) {
    try {
      const response = await axios.get(
        `${API_URL}/api/arcium/computation/${computationId}`
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get computation status:', error);
      return { status: 'error' };
    }
  }

  /**
   * Get Arcium status for UI display
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      enabled: this.enabled,
      ...this.status,
    };
  }

  /**
   * Format privacy level for display
   * @returns {string} Privacy level description
   */
  getPrivacyLevel() {
    if (!this.enabled) {
      return 'Basic (amounts visible on-chain)';
    }
    return 'Full (all data encrypted via MPC)';
  }
}

// Export singleton instance
const arciumClient = new ArciumClient();
export default arciumClient;

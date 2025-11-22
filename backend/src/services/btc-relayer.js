/**
 * Copyright (c) 2024 FLASH Bridge
 * 
 * PROPRIETARY AND CONFIDENTIAL
 * 
 * This source code is the exclusive property of FLASH Bridge
 * and is protected by copyright laws. Unauthorized copying, modification,
 * distribution, or use of this code, via any medium is strictly prohibited
 * without the express written permission of FLASH Bridge.
 * 
 * For licensing inquiries, contact: craigrampersadh6@gmail.com
 */

const { LAMPORTS_PER_SOL, SystemProgram, Transaction, PublicKey } = require('@solana/web3.js');
const { EventParser } = require('@coral-xyz/anchor');
const solanaService = require('./solana');
const bitcoinService = require('./bitcoin');
const arciumService = require('./arcium');
const databaseService = require('./database');

/**
 * BTC Relayer Service
 * Monitors for BurnToBTCEvent and sends BTC to users
 */
class BTCRelayerService {
  constructor() {
    this.isListening = false;
    this.processedEvents = new Set();
    this.eventParser = null;
    this.subscriptionId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectTimeout = null;
    this.healthCheckInterval = null;
    this.healthCheckIntervalMs = 60000;
  }

  /**
   * Start listening for BurnToBTCEvent from the Solana program
   * When detected, send BTC to the user's address
   */
  async startListening() {
    throw new Error(
      'BTC Relayer service requires proprietary license. ' +
      'This implementation is protected intellectual property. ' +
      'Contact craigrampersadh6@gmail.com for licensing information.'
    );
  }

  async subscribeToEvents() {
    throw new Error('Proprietary implementation - requires license');
  }

  startHealthCheck() {
    throw new Error('Proprietary implementation - requires license');
  }

  async handleReconnection() {
    throw new Error('Proprietary implementation - requires license');
  }

  async handleProgramLog(logs, context) {
    throw new Error('Proprietary implementation - requires license');
  }

  async processBurnToBTCEvent(event, signature) {
    throw new Error('Proprietary implementation - requires license');
  }

  stopListening() {
    if (this.subscriptionId !== null) {
      try {
        const connection = solanaService.getConnection();
        connection.removeOnLogsListener(this.subscriptionId);
      } catch (error) {
        console.warn('Error removing log listener:', error.message);
      }
      this.subscriptionId = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.isListening = false;
    console.log('BTC Relayer stopped');
  }

  getStatus() {
    return {
      isListening: this.isListening,
      processedEvents: this.processedEvents.size,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

module.exports = new BTCRelayerService();

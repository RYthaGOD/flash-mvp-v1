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
    // Use Map with timestamps for LRU eviction (max 10000 entries)
    this.processedEvents = new Map();
    this.maxProcessedEvents = 10000;
    this.eventParser = null;
    this.subscriptionId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectTimeout = null;
    this.healthCheckInterval = null;
    this.healthCheckIntervalMs = 60000; // Check every 60 seconds
  }

  /**
   * Add event to processed set with LRU eviction
   * @param {string} eventId - Event ID
   */
  markEventProcessed(eventId) {
    // If at capacity, remove oldest entry
    if (this.processedEvents.size >= this.maxProcessedEvents) {
      const oldestEntry = this.processedEvents.entries().next().value;
      if (oldestEntry) {
        this.processedEvents.delete(oldestEntry[0]);
      }
    }
    this.processedEvents.set(eventId, Date.now());
  }

  /**
   * Check if event was processed
   * @param {string} eventId - Event ID
   * @returns {boolean} Whether event was processed
   */
  isEventProcessed(eventId) {
    return this.processedEvents.has(eventId);
  }

  /**
   * Start listening for BurnToBTCEvent from the Solana program
   * When detected, send BTC to the user's address
   */
  async startListening() {
    if (this.isListening) {
      console.log('BTC Relayer already listening');
      return;
    }

    console.log('Starting BTC relayer listener for BurnToBTCEvent...');
    this.isListening = true;
    this.reconnectAttempts = 0;

    await this.subscribeToEvents();
  }

  async subscribeToEvents() {
    try {
      const connection = solanaService.getConnection();
      const programId = solanaService.programId;
      
      // Initialize event parser
      const program = solanaService.getProgram();
      this.eventParser = new EventParser(programId, program.coder);

      // Subscribe to program logs
      this.subscriptionId = connection.onLogs(
        programId,
        async (logs, context) => {
          try {
            await this.handleProgramLog(logs, context);
          } catch (error) {
            console.error('Error handling program log:', error);
          }
        },
        'confirmed'
      );

      console.log(`BTC Relayer listening on program: ${programId.toString()}`);
      this.reconnectAttempts = 0;
      
      // Start health check
      this.startHealthCheck();
      
    } catch (error) {
      console.error('Failed to subscribe to events:', error);
      if (this.isListening) {
        this.handleReconnection();
      }
    }
  }

  startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      if (!this.isListening) return;

      try {
        const connection = solanaService.getConnection();
        const programId = solanaService.programId;
        
        // Check if we can still query the program
        await connection.getAccountInfo(programId);
        this.reconnectAttempts = 0; // Reset on successful health check
      } catch (error) {
        console.warn('BTC Relayer health check failed:', error.message);
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.handleReconnection();
        }
      }
    }, this.healthCheckIntervalMs);
  }

  async handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('BTC Relayer: Max reconnection attempts reached. Stopping.');
      this.isListening = false;
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 60000); // Exponential backoff, max 60s

    console.log(`BTC Relayer: Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.subscribeToEvents();
      } catch (error) {
        console.error('BTC Relayer: Reconnection failed:', error);
        if (this.isListening) {
          this.handleReconnection();
        }
      }
    }, delay);
  }

  async handleProgramLog(logs, context) {
    if (!this.eventParser) return;

    try {
      const events = this.eventParser.parseLogs(logs.logs);
      
      for (const event of events) {
        if (event.name === 'BurnToBTCEvent') {
          const signature = context.signature || logs.signature;
          const eventId = `${event.data.user.toString()}_${event.data.amount}_${context.slot}`;
          
          // Check in-memory set first
          if (this.isEventProcessed(eventId)) {
            continue; // Already processed
          }

          // Check database if connected
          if (databaseService.isConnected()) {
            const isProcessed = await databaseService.isEventProcessed(signature);
            if (isProcessed) {
              console.log(`Event ${signature.substring(0, 16)}... already processed (from database)`);
              this.markEventProcessed(eventId); // Add to in-memory set
              continue;
            }
          }
          
          this.markEventProcessed(eventId);
          await this.processBurnToBTCEvent(event.data, signature);
        }
      }
    } catch (error) {
      console.error('Error parsing events:', error);
    }
  }

  async processBurnToBTCEvent(event, signature) {
    const { user, amount, btc_address_hash, encrypted } = event;
    const userPubkey = new PublicKey(user);
    
    console.log(`🔒 Processing BurnToBTCEvent: ${amount} zenZEC for ${userPubkey.toString()} (Full Privacy)`);
    console.log(`BTC Address: [ENCRYPTED]`);

    let btcAddress;
    let btcAmount;

    // ALWAYS decrypt BTC address via Arcium MPC (privacy required)
    if (!encrypted) {
      console.error('❌ Privacy violation: BTC address must be encrypted');
      throw new Error('All BTC addresses must be encrypted via Arcium MPC');
    }

    try {
      // Decrypt BTC address via Arcium MPC
      console.log('🔒 Decrypting BTC address via Arcium MPC...');
      btcAddress = await arciumService.decryptBTCAddress(btc_address_hash, userPubkey.toString());
      console.log('✓ BTC address decrypted successfully');
    } catch (error) {
      console.error('Failed to decrypt BTC address:', error);
      throw new Error('Cannot process unencrypted BTC address - privacy required');
    }

    // Validate BTC address format
    if (!bitcoinService.isValidAddress(btcAddress)) {
      console.error(`Invalid BTC address: ${btcAddress}`);
      return;
    }

    // Calculate BTC amount (using exchange rate)
    const exchangeRate = parseFloat(process.env.ZENZEC_TO_BTC_RATE || '0.001'); // 1 zenZEC = 0.001 BTC
    const zenZECAmount = amount / 1e8; // Convert from smallest unit
    btcAmount = zenZECAmount * exchangeRate;

    // Check if we have enough BTC in reserve
    const currentReserve = bitcoinService.getCurrentReserveBTC();
    if (btcAmount > currentReserve) {
      console.error(`Insufficient BTC reserve: ${currentReserve} BTC, need ${btcAmount} BTC`);
      return;
    }

    try {
      // Send BTC to user's address with retry logic
      const txHash = await this.retryOperation(async () => {
        return await bitcoinService.sendBTC(btcAddress, btcAmount);
      }, 3, 2000); // 3 retries, 2s base delay
      
      console.log(`✓ Sent ${btcAmount} BTC to ${btcAddress}`);
      console.log(`  Bitcoin TX: ${txHash}`);
      console.log(`  Solana TX: ${signature}`);
      
      // Update reserve
      bitcoinService.addToReserve(-Math.floor(btcAmount * 100000000)); // Subtract in satoshis

      // Save burn transaction to database
      if (databaseService.isConnected()) {
        try {
          const txId = `burn_btc_${signature.substring(0, 16)}_${Date.now()}`;
          await databaseService.saveBurnTransaction({
            txId,
            solanaAddress: userPubkey.toString(),
            amount: zenZECAmount,
            targetAsset: 'BTC',
            targetAddress: btcAddress,
            solanaTxSignature: signature,
            btcTxHash: txHash,
            status: 'confirmed',
            encrypted: true,  // ALWAYS encrypted
          });

          // Mark event as processed in database
          await databaseService.markEventProcessed({
            eventSignature: signature,
            eventType: 'BurnToBTCEvent',
            solanaAddress: userPubkey.toString(),
            amount: zenZECAmount,
          });
        } catch (error) {
          console.error('Error saving burn transaction to database:', error);
          // Don't fail if database save fails
        }
      }
      
    } catch (error) {
      console.error('Error sending BTC:', error);
    }
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

  /**
   * Retry wrapper for transaction operations
   * @param {Function} fn - Async function to retry
   * @param {number} maxRetries - Maximum retry attempts
   * @param {number} baseDelay - Base delay in ms for exponential backoff
   * @returns {Promise} Result of function
   */
  async retryOperation(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        // Don't retry on certain errors
        if (error.message?.includes('Insufficient') || 
            error.message?.includes('Invalid') ||
            error.message?.includes('not configured')) {
          throw error;
        }
        
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`BTC Relayer retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
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

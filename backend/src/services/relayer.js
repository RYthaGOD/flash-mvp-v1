const { LAMPORTS_PER_SOL, SystemProgram, Transaction, PublicKey } = require('@solana/web3.js');
const { EventParser } = require('@coral-xyz/anchor');
const solanaService = require('./solana');
const databaseService = require('./database');

class RelayerService {
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
    this.lastEventTime = null;
    this.healthCheckIntervalMs = 60000; // Check every 60 seconds
  }

  /**
   * Add event to processed set with LRU eviction
   * @param {string} signature - Event signature
   */
  markEventProcessed(signature) {
    // If at capacity, remove oldest entry
    if (this.processedEvents.size >= this.maxProcessedEvents) {
      const oldestEntry = this.processedEvents.entries().next().value;
      if (oldestEntry) {
        this.processedEvents.delete(oldestEntry[0]);
      }
    }
    this.processedEvents.set(signature, Date.now());
  }

  /**
   * Check if event was processed
   * @param {string} signature - Event signature
   * @returns {boolean} Whether event was processed
   */
  isEventProcessed(signature) {
    return this.processedEvents.has(signature);
  }

  /**
   * Start listening for BurnSwapEvent from the Solana program
   * When detected, send SOL to the user
   */
  async startListening() {
    if (this.isListening) {
      console.log('Relayer already listening');
      return;
    }

    console.log('Starting relayer listener for BurnSwapEvent...');
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

      console.log(`Relayer listening on program: ${programId.toString()}`);
      this.reconnectAttempts = 0; // Reset on successful connection
      
      // Start health check to detect silent disconnections
      this.startHealthCheck();
      
    } catch (error) {
      console.error('Failed to subscribe to events:', error);
      if (this.isListening) {
        this.handleReconnection();
      }
    }
  }

  startHealthCheck() {
    // Clear any existing health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Check connection health periodically
    this.healthCheckInterval = setInterval(async () => {
      if (!this.isListening) {
        return;
      }

      try {
        const connection = solanaService.getConnection();
        const programId = solanaService.programId;
        
        // Try to get program account info as a health check
        // If this fails, the connection might be down
        await connection.getAccountInfo(programId);
        
        // If we haven't received events in a while and subscription exists,
        // it might have silently disconnected
        const timeSinceLastEvent = this.lastEventTime 
          ? Date.now() - this.lastEventTime 
          : Infinity;
        
        // If no events for 5 minutes and we're supposed to be listening, reconnect
        if (timeSinceLastEvent > 300000 && this.subscriptionId !== null) {
          console.warn('No events received in 5 minutes, reconnecting...');
          await this.handleReconnection();
        }
      } catch (error) {
        console.error('Health check failed, reconnecting:', error.message);
        await this.handleReconnection();
      }
    }, this.healthCheckIntervalMs);
  }

  async handleReconnection() {
    if (!this.isListening) {
      return; // Don't reconnect if we're not supposed to be listening
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached. Stopping relayer.');
      this.isListening = false;
      return;
    }

    // Clean up old subscription before reconnecting
    if (this.subscriptionId !== null) {
      try {
        const connection = solanaService.getConnection();
        connection.removeOnLogsListener(this.subscriptionId);
      } catch (error) {
        console.warn('Error removing old subscription:', error.message);
      }
      this.subscriptionId = null;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    // Clear any existing timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.subscribeToEvents();
      } catch (error) {
        console.error('Reconnection failed:', error.message);
        await this.handleReconnection();
      }
    }, delay);
  }

  async handleProgramLog(logs, context) {
    const signature = logs.signature;
    
    // Prevent duplicate processing (check in-memory set first)
    if (this.isEventProcessed(signature)) {
      return;
    }

    // Check database if connected
    if (databaseService.isConnected()) {
      const isProcessed = await databaseService.isEventProcessed(signature);
      if (isProcessed) {
        console.log(`Event ${signature.substring(0, 16)}... already processed (from database)`);
        this.markEventProcessed(signature); // Add to in-memory set
        return;
      }
    }

    // Parse events using Anchor's event parser
    if (!this.eventParser) {
      return;
    }

    try {
      const events = this.eventParser.parseLogs(logs.logs);
      
      // Find BurnSwapEvent
      const burnEvent = events.find(e => e.name === 'BurnSwapEvent');
      
      if (burnEvent) {
        this.markEventProcessed(signature);
        this.lastEventTime = Date.now(); // Update last event time
        console.log(`Detected BurnSwapEvent in tx: ${signature}`);
        
        // Extract event data
        const eventData = {
          user: new PublicKey(burnEvent.data.user),
          amount: burnEvent.data.amount.toNumber(),
          timestamp: burnEvent.data.timestamp.toNumber(),
          signature
        };
        
        await this.processBurnSwapEvent(eventData);
      }
    } catch (error) {
      console.error('Error parsing events:', error);
    }
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
        // Don't retry on certain errors (e.g., insufficient balance, invalid address)
        if (error.message?.includes('Insufficient') || 
            error.message?.includes('Invalid') ||
            error.message?.includes('not configured')) {
          throw error;
        }
        
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  async processBurnSwapEvent(event) {
    const { user, amount, signature } = event;
    
    console.log(`Processing BurnSwapEvent: ${amount} zenZEC for ${user.toString()}`);

    const connection = solanaService.getConnection();
    const relayerKeypair = solanaService.relayerKeypair;

    if (!relayerKeypair) {
      console.error('Relayer keypair not configured, cannot send SOL');
      return;
    }

    try {
      // Calculate SOL amount (1:1 ratio for MVP, use price oracle in production)
      // For MVP: 1 zenZEC = 0.001 SOL (example rate)
      // Adjust ZENZEC_TO_SOL_RATE in .env for production
      const zenZECToSOLRate = parseFloat(process.env.ZENZEC_TO_SOL_RATE || '0.001');
      const solAmount = (amount / 100000000) * zenZECToSOLRate; // Convert from smallest unit
      
      // Check relayer balance
      const relayerBalance = await connection.getBalance(relayerKeypair.publicKey);
      const requiredLamports = Math.ceil(solAmount * LAMPORTS_PER_SOL);
      
      if (relayerBalance < requiredLamports) {
        console.error(`Insufficient relayer balance: ${relayerBalance / LAMPORTS_PER_SOL} SOL, need ${solAmount} SOL`);
        return;
      }

      // Create and send SOL transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: relayerKeypair.publicKey,
          toPubkey: user,
          lamports: requiredLamports,
        })
      );

      // Get blockhash with expiry info
      let { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      
      // Check if blockhash is still valid before sending
      const currentBlockHeight = await connection.getBlockHeight();
      if (currentBlockHeight > lastValidBlockHeight) {
        // Blockhash expired, get a new one
        const blockhashInfo = await connection.getLatestBlockhash('confirmed');
        blockhash = blockhashInfo.blockhash;
        lastValidBlockHeight = blockhashInfo.lastValidBlockHeight;
        console.log('Blockhash expired, using new blockhash');
      }
      
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = relayerKeypair.publicKey;
      
      // Sign and send with retry logic
      transaction.sign(relayerKeypair);
      
      // Retry transaction sending and confirmation
      const txSignature = await this.retryOperation(async () => {
        const sig = await connection.sendRawTransaction(
          transaction.serialize(),
          { skipPreflight: false }
        );
        
        // Wait for confirmation using blockhash-based strategy
        await connection.confirmTransaction({
          signature: sig,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed');
        
        return sig;
      }, 3, 2000); // 3 retries, 2s base delay
      
      console.log(`✓ Sent ${solAmount} SOL to ${user.toString()}`);
      console.log(`Transaction: ${txSignature}`);
      console.log(`Original burn: ${amount / 100000000} zenZEC`);

      // Save burn transaction to database
      if (databaseService.isConnected()) {
        try {
          const txId = `burn_sol_${signature.substring(0, 16)}_${Date.now()}`;
          await databaseService.saveBurnTransaction({
            txId,
            solanaAddress: user.toString(),
            amount: amount / 1e8, // Convert from smallest unit
            targetAsset: 'SOL',
            targetAddress: user.toString(),
            solanaTxSignature: signature,
            solTxSignature: txSignature,
            status: 'confirmed',
            encrypted: true,  // ALWAYS encrypted with Arcium MPC
          });

          // Mark event as processed in database
          await databaseService.markEventProcessed({
            eventSignature: signature,
            eventType: 'BurnSwapEvent',
            solanaAddress: user.toString(),
            amount: amount / 1e8,
          });
        } catch (error) {
          console.error('Error saving burn transaction to database:', error);
          // Don't fail if database save fails
        }
      }
      
    } catch (error) {
      console.error('Error processing burn swap event:', error);
      // Remove from processed set to allow retry
      this.processedEvents.delete(signature);
      throw error;
    }
  }

  stopListening() {
    this.isListening = false;
    
    // Clear reconnection timeout if active
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Remove log subscription if active
    if (this.subscriptionId !== null) {
      try {
        const connection = solanaService.getConnection();
        connection.removeOnLogsListener(this.subscriptionId);
      } catch (error) {
        console.warn('Error removing log listener:', error.message);
      }
      this.subscriptionId = null;
    }
    
    console.log('Relayer listener stopped');
  }
}

module.exports = new RelayerService();

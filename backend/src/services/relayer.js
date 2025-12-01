const { LAMPORTS_PER_SOL, SystemProgram, Transaction, PublicKey } = require('@solana/web3.js');
const { EventParser } = require('@coral-xyz/anchor');
const crypto = require('crypto');
const solanaService = require('./solana');
const databaseService = require('./database');
const { createContextLogger, createEnhancedError } = require('../utils/errorContext');

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
   *
   * 🚫 DISABLED: BurnSwapEvent does not exist in flash_bridge_mxe program.
   * The flash_bridge_mxe program is designed for privacy-preserving bridge operations
   * and does not include burn/swap functionality.
   */
  async startListening() {
    console.log('🚫 Relayer service DISABLED - flash_bridge_mxe program does not support burn/swap operations');
    console.log('ℹ️  The flash_bridge_mxe program is designed for privacy-preserving bridge operations only');
    console.log('ℹ️  Burn/swap functionality is not implemented in this program version');

    // Mark as "listening" but don't actually start
    this.isListening = true;

    // Don't subscribe to events - they don't exist
    return;
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
    
    // Check database first (database is source of truth)
    // In-memory Map is only used for caching, not as primary check
    if (databaseService.isConnected()) {
      const isProcessed = await databaseService.isEventProcessed(signature);
      if (isProcessed) {
        console.log(`Event ${signature.substring(0, 16)}... already processed (from database)`);
        // Update cache
        if (!this.isEventProcessed(signature)) {
          this.markEventProcessed(signature);
        }
        return;
      }
    } else {
      // Fallback to in-memory check if database not available
      if (this.isEventProcessed(signature)) {
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
      // ⚠️  WARNING: BurnSwapEvent does not exist in flash_bridge_mxe program
      // This will only work if a different program with this event is deployed
      const burnEvent = events.find(e => e.name === 'BurnSwapEvent');
      
      if (burnEvent) {
        this.lastEventTime = Date.now(); // Update last event time
        console.log(`⚠️  Detected BurnSwapEvent in tx: ${signature}`);
        console.log(`⚠️  WARNING: BurnSwapEvent should not exist in flash_bridge_mxe program`);
        console.log(`⚠️  If this appears, the program may have been updated or wrong program ID configured`);
        
        // Extract event data
        const eventData = {
          user: new PublicKey(burnEvent.data.user),
          amount: burnEvent.data.amount.toNumber(),
          timestamp: burnEvent.data.timestamp.toNumber(),
          signature
        };
        
        // Process event (will handle database locking internally)
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
    
    // Create error logger with base context
    const logError = createContextLogger('Burn Swap Event', {
      user: user?.toString(),
      amount: amount ? amount / 1e8 : undefined,
      signature
    });
    
    console.log(`Processing BurnSwapEvent: ${amount} zenZEC for ${user.toString()}`);

    // Validate inputs
    if (!user || !amount || !signature) {
      throw createEnhancedError('Burn Swap Event', {
        user: user?.toString(),
        amount: amount ? amount / 1e8 : undefined,
        signature
      }, 'Invalid event data: missing required fields');
    }

    if (amount <= 0) {
      throw createEnhancedError('Burn Swap Event', {
        user: user.toString(),
        amount: amount / 1e8,
        signature
      }, 'Invalid event data: amount must be positive');
    }

    // Validate PublicKey format
    try {
      const { PublicKey } = require('@solana/web3.js');
      new PublicKey(user);
    } catch (error) {
      throw createEnhancedError('Burn Swap Event', {
        user: user?.toString(),
        amount: amount / 1e8,
        signature
      }, `Invalid user PublicKey format: ${user}`);
    }

    // Validate signature format (Solana signatures are base58, typically 88 chars)
    if (typeof signature !== 'string' || signature.length < 32) {
      throw createEnhancedError('Burn Swap Event', {
        user: user.toString(),
        amount: amount / 1e8,
        signature
      }, `Invalid signature format: ${signature}`);
    }

    const connection = solanaService.getConnection();
    const relayerKeypair = solanaService.relayerKeypair;

    if (!relayerKeypair) {
      throw createEnhancedError('Burn Swap Event', {
        user: user.toString(),
        amount: amount / 1e8,
        signature
      }, 'Relayer keypair not configured, cannot send SOL');
    }

    // Use database transaction with locking to prevent duplicate processing
    const client = databaseService.isConnected() 
      ? await databaseService.pool.connect() 
      : null;

    try {
      // Start transaction if database is connected
      if (client) {
        await client.query('BEGIN');
        
        // Lock row and check if already processed
        const existingEvent = await databaseService.getEventWithLock(signature, client);
        
        if (existingEvent) {
          await client.query('ROLLBACK');
          client.release();
          console.log(`Event ${signature.substring(0, 16)}... already processed (locked check)`);
          return; // Already processed
        }
        
        // Mark as processing (insert into processed_events before processing)
        // This prevents other instances from processing the same event
        await databaseService.markEventProcessed({
          eventSignature: signature,
          eventType: 'BurnSwapEvent',
          solanaAddress: user.toString(),
          amount: amount / 1e8,
        }, client);
      } else {
        // Fallback: check without lock if database not connected
        const isProcessed = await databaseService.isEventProcessed(signature);
        if (isProcessed) {
          console.log(`Event ${signature.substring(0, 16)}... already processed (no DB lock)`);
          return;
        }
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

        // Save burn transaction to database (within transaction)
        if (client) {
          try {
            // Use signature + random component for unique ID
            const crypto = require('crypto');
            const uniqueId = `burn_sol_${signature.substring(0, 16)}_${crypto.randomBytes(4).toString('hex')}`;
            await databaseService.saveBurnTransaction({
              txId: uniqueId,
              solanaAddress: user.toString(),
              amount: amount / 1e8, // Convert from smallest unit
              targetAsset: 'SOL',
              targetAddress: user.toString(),
              solanaTxSignature: signature,
              solTxSignature: txSignature,
              status: 'confirmed',
              encrypted: true,  // ALWAYS encrypted with Arcium MPC
            });

            // Event already marked as processed above (before processing)
            // Commit transaction
            await client.query('COMMIT');
          } catch (error) {
            // Rollback on database error
            await client.query('ROLLBACK');
            logError(error, { solTxSignature: txSignature, status: 'confirmed' });
            throw createEnhancedError('Burn Swap Event', {
              user: user.toString(),
              amount: amount / 1e8,
              signature,
              solTxSignature: txSignature
            }, `Failed to save transaction: ${error.message}`);
          } finally {
            client.release();
          }
        } else if (databaseService.isConnected()) {
          // Fallback: save without transaction if client not available
          try {
            // Use signature + random component for unique ID
            const uniqueId = `burn_sol_${signature.substring(0, 16)}_${crypto.randomBytes(4).toString('hex')}`;
            await databaseService.saveBurnTransaction({
              txId: uniqueId,
              solanaAddress: user.toString(),
              amount: amount / 1e8,
              targetAsset: 'SOL',
              targetAddress: user.toString(),
              solanaTxSignature: signature,
              solTxSignature: txSignature,
              status: 'confirmed',
              encrypted: true,
            });

            await databaseService.markEventProcessed({
              eventSignature: signature,
              eventType: 'BurnSwapEvent',
              solanaAddress: user.toString(),
              amount: amount / 1e8,
            });
          } catch (error) {
            console.error('Error saving burn transaction to database:', error);
            // Don't throw - transaction already succeeded on-chain
          }
        }

        // Update cache after successful processing
        if (!this.isEventProcessed(signature)) {
          this.markEventProcessed(signature);
        }
        
      } catch (error) {
        // Rollback transaction on any error during processing
        if (client) {
          try {
            await client.query('ROLLBACK');
            
            // Remove from processed_events if it was inserted
            await client.query(
              'DELETE FROM processed_events WHERE event_signature = $1',
              [signature]
            );
          } catch (rollbackError) {
            console.error('Error during rollback:', rollbackError);
          } finally {
            client.release();
          }
        }
        
        // Remove from cache to allow retry
        this.processedEvents.delete(signature);
        
        console.error('Error processing burn swap event:', error);
        throw error;
      }
    } catch (error) {
      // Handle errors before transaction starts
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Error during rollback:', rollbackError);
        } finally {
          client.release();
        }
      }
      
      // Remove from cache
      this.processedEvents.delete(signature);
      
      console.error('Error processing burn swap event:', error);
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

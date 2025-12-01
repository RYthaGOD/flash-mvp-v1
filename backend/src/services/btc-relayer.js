const { LAMPORTS_PER_SOL, SystemProgram, Transaction, PublicKey } = require('@solana/web3.js');
const { EventParser } = require('@coral-xyz/anchor');
const { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const crypto = require('crypto');
const solanaService = require('./solana');
const bitcoinService = require('./bitcoin');
const arciumService = require('./arcium');
const databaseService = require('./database');
const reserveManager = require('./reserveManager');
const { createContextLogger, createEnhancedError } = require('../utils/errorContext');
const serviceCoordinator = require('../utils/serviceCoordinator');
const { createLogger } = require('../utils/logger');

/**
 * BTC Redemption Service
 * Handles native ZEC → BTC redemptions with FULL HYBRID AUTOMATION
 * 
 * Hybrid Approach:
 * 1. Listens for native ZEC token transfers TO treasury
 * 2. Listens for BtcAddressEncryptionComplete events
 * 3. Automatically processes redemptions when both conditions are met
 * 
 * Flow:
 * - User encrypts BTC address (optional, can be done anytime)
 * - User transfers native ZEC to treasury
 * - Service AUTOMATICALLY detects transfer and encryption
 * - Service sends BTC to user's encrypted address
 */
class BTCRedemptionService {
  constructor() {
    this.serviceReady = false;
    this.isListening = false;

    // Event listeners
    this.tokenAccountSubscriptionId = null;
    this.programLogsSubscriptionId = null;
    this.eventParser = null;

    // Tracking
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectTimeout = null;
    this.healthCheckInterval = null;
    this.lastEventTime = null;
    this.healthCheckIntervalMs = 60000; // 60 seconds

    // Pending redemptions tracking - with size limits and cleanup
    this.pendingEncryptions = new Map(); // userAddress -> { encryptedAddress, timestamp }
    this.pendingTransfers = new Map();   // signature -> { userAddress, amount, timestamp }
    this.maxPendingItems = parseInt(process.env.BTC_RELAYER_MAX_PENDING) || 1000; // Limit to prevent memory leaks
    this.cleanupInterval = null;

    // Processed events cache (for deduplication) - with TTL
    this.processedEvents = new Map();
    this.maxProcessedEvents = parseInt(process.env.BTC_RELAYER_MAX_EVENTS) || 10000;
    this.eventTTL = parseInt(process.env.BTC_RELAYER_EVENT_TTL) || (24 * 60 * 60 * 1000); // 24 hours in milliseconds

    // Last checked balance for treasury (to detect increases)
    this.lastTreasuryBalance = null;

    // Service coordination
    serviceCoordinator.setServiceName('btc-relayer');

    // Standardized logging
    this.logger = createLogger('btc-relayer');

    // Start cleanup interval to prevent memory leaks
    this.startCleanupInterval();
  }

  /**
   * Initialize service with full hybrid automation
   */
  async startListening() {
    if (this.isListening) {
      this.logger.info('BTC Redemption Service already listening');
      return;
    }

    this.logger.info('🚀 Starting BTC Redemption Service with hybrid automation...');
    this.isListening = true;
    this.serviceReady = true;
    this.reconnectAttempts = 0;

    try {
      // Initialize event parser for program events
      await this.initializeEventParser();
      
      // Subscribe to treasury ZEC token account (for transfer detection)
      await this.subscribeToTreasuryTokenAccount();
      
      // Subscribe to program logs (for BtcAddressEncryptionComplete events)
      await this.subscribeToProgramLogs();
      
      // Start health check
      this.startHealthCheck();
      
      this.logger.info('✅ BTC Redemption Service listening - Full hybrid automation enabled');
    } catch (error) {
      this.logger.error('Failed to start BTC Redemption Service:', error);
      this.isListening = false;
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.handleReconnection();
      }
    }
  }

  /**
   * Initialize Anchor event parser for program events
   */
  async initializeEventParser() {
    try {
      if (!solanaService.programId) {
        this.logger.warn('Program ID not set, event parsing disabled (transfers will still work)');
        return;
      }

      const program = solanaService.getProgram();
      if (!program) {
        this.logger.warn('Program not available, event parsing limited');
        return;
      }

      const programId = solanaService.programId;
      this.eventParser = new EventParser(programId, program.coder);
      this.logger.info('✅ Event parser initialized');
    } catch (error) {
      this.logger.warn('Could not initialize event parser (continuing without it):', error.message);
      // Continue without event parser - can still listen to token transfers
    }
  }

  /**
   * Subscribe to treasury's ZEC token account for transfer detection
   */
  async subscribeToTreasuryTokenAccount() {
    try {
      const connection = solanaService.getConnection();
      const treasuryPubkey = solanaService.relayerKeypair?.publicKey;
      
      if (!treasuryPubkey) {
        throw new Error('Treasury keypair not configured');
      }

      const zecMint = solanaService.getNativeZECMint();
      const treasuryZECAccount = await solanaService.getTreasuryZECAccount(zecMint);

      // Get initial balance
      const { getAccount } = require('@solana/spl-token');
      try {
        const accountInfo = await getAccount(connection, treasuryZECAccount);
        this.lastTreasuryBalance = BigInt(accountInfo.amount.toString());
      } catch (error) {
        this.lastTreasuryBalance = BigInt(0);
      }

      this.logger.info(`👂 Listening for transfers to treasury ZEC account: ${treasuryZECAccount.toString()}`);

      // Subscribe to account changes (transfers will show as balance changes)
      this.tokenAccountSubscriptionId = connection.onAccountChange(
        treasuryZECAccount,
        async (accountInfo, context) => {
          try {
            // Get current balance
            if (!accountInfo || !accountInfo.data) {
              return;
            }

            // Parse token account balance from account data
            // Token account layout: mint(32) + owner(32) + amount(8) + ...
            // Convert to Buffer if needed (accountInfo.data might be Uint8Array)
            const data = Buffer.isBuffer(accountInfo.data) 
              ? accountInfo.data 
              : Buffer.from(accountInfo.data);
            
            if (data.length < 72) {
              return; // Invalid token account data
            }
            
            const balanceData = data.slice(64, 72);
            const currentBalance = BigInt(balanceData.readBigUInt64LE(0));

            // Check if balance increased (incoming transfer)
            if (this.lastTreasuryBalance && currentBalance > this.lastTreasuryBalance) {
              const increase = Number(currentBalance - this.lastTreasuryBalance);
              this.logger.info(`💰 Detected balance increase: ${increase / 1e8} native ZEC`);
              
              // Check recent transactions for transfers
              await this.checkRecentTransfersToTreasury();
            }

            this.lastTreasuryBalance = currentBalance;
          } catch (error) {
            this.logger.error('Error handling token account change:', error);
          }
        },
        'confirmed'
      );

      this.logger.info('✅ Subscribed to treasury token account');
    } catch (error) {
      this.logger.error('Failed to subscribe to token account:', error);
      throw error;
    }
  }

  /**
   * Subscribe to program logs for BtcAddressEncryptionComplete events
   */
  async subscribeToProgramLogs() {
    try {
      const connection = solanaService.getConnection();
      const programId = solanaService.programId;
      
      if (!programId || !this.eventParser) {
        this.logger.warn('Program ID or event parser not available, skipping program log subscription');
        return;
      }

      this.logger.info(`👂 Listening for program events: ${programId.toString()}`);

      this.programLogsSubscriptionId = connection.onLogs(
        programId,
        async (logs, context) => {
          try {
            await this.handleProgramLog(logs, context);
          } catch (error) {
            this.logger.error('Error handling program log:', error);
          }
        },
        'confirmed'
      );

      this.logger.info('✅ Subscribed to program logs');
    } catch (error) {
      this.logger.error('Failed to subscribe to program logs:', error);
      // Continue without program logs - can still process token transfers
    }
  }

  /**
   * Handle program logs - detect BtcAddressEncryptionComplete events
   */
  async handleProgramLog(logs, context) {
    const signature = logs.signature;

    // Check if already processed
    if (this.processedEvents.has(signature)) {
      return;
    }

    // Check database first (database is source of truth)
    if (databaseService.isConnected()) {
      const isProcessed = await databaseService.isEventProcessed(signature);
      if (isProcessed) {
        this.processedEvents.set(signature, Date.now());
        this.cleanupProcessedEvents();
        return;
      }
    }

    // Parse events using Anchor's event parser
    if (!this.eventParser) {
      return;
    }

    try {
      const events = this.eventParser.parseLogs(logs.logs);
      
      // Find BtcAddressEncryptionComplete event
      const encryptionEvent = events.find(e => e.name === 'BtcAddressEncryptionComplete');
      
      if (encryptionEvent) {
        this.lastEventTime = Date.now();
        this.logger.info(`🔒 Detected BtcAddressEncryptionComplete event in tx: ${signature}`);
        
        // Extract user address
        const userAddress = encryptionEvent.data.recipient?.toString() || 
                          encryptionEvent.data.user?.toString();
        
        if (userAddress) {
          this.logger.info(`   User: ${userAddress}`);
          
          // Get encrypted BTC address from program account
          const encryptedBtcData = await this.getEncryptedBTCAddress(userAddress);
          
          if (encryptedBtcData) {
            // Store encryption data
            this.pendingEncryptions.set(userAddress, {
              encryptedAddress: encryptedBtcData,
              timestamp: Date.now(),
            });
            
            // Mark event as processed in database
            if (databaseService.isConnected()) {
              try {
                await databaseService.markEventProcessed({
                  eventSignature: signature,
                  eventType: 'BtcAddressEncryptionComplete',
                  solanaAddress: userAddress,
                  amount: null,
                });
              } catch (error) {
                this.logger.error('Error marking event as processed:', error);
              }
            }
            
            // Check if user has pending transfer
            await this.checkAndProcessPendingRedemption(userAddress);
          } else {
            this.logger.warn(`   No encrypted BTC address found for user: ${userAddress}`);
          }
        }
        
        this.processedEvents.set(signature, Date.now());
        this.cleanupProcessedEvents();
      }
    } catch (error) {
      this.logger.error('Error parsing program events:', error);
    }
  }

  /**
   * Check recent transactions to treasury for new transfers
   */
  async checkRecentTransfersToTreasury() {
    try {
      const connection = solanaService.getConnection();
      const treasuryPubkey = solanaService.relayerKeypair?.publicKey;
      
      if (!treasuryPubkey) {
        return;
      }

      const zecMint = solanaService.getNativeZECMint();
      const treasuryZECAccount = await solanaService.getTreasuryZECAccount(zecMint);

      // Get recent signatures for treasury account
      // Look back last 50 transactions
      const signatures = await connection.getSignaturesForAddress(
        treasuryZECAccount,
        { limit: 50 },
        'confirmed'
      );

      for (const sigInfo of signatures) {
        if (this.processedEvents.has(sigInfo.signature)) {
          continue; // Already processed
        }

        // Check database first
        if (databaseService.isConnected()) {
          const isProcessed = await databaseService.isEventProcessed(sigInfo.signature);
          if (isProcessed) {
            this.processedEvents.set(sigInfo.signature, Date.now());
            continue;
          }
        }

        try {
          // Get transaction details
          const tx = await connection.getTransaction(sigInfo.signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          });

          if (!tx || !tx.meta || tx.meta.err) {
            continue;
          }

          // Parse token transfer from transaction
          const transferData = await this.parseTokenTransfer(tx, treasuryZECAccount);
          
          if (transferData) {
            const { userAddress, amount, signature } = transferData;
            
            this.logger.info(`💰 Detected native ZEC transfer to treasury:`);
            this.logger.info(`   From: ${userAddress}`);
            this.logger.info(`   Amount: ${amount / 1e8} native ZEC`);
            this.logger.info(`   TX: ${signature}`);

            // CRITICAL: Check transfer metadata before processing
            // Only process transfers explicitly marked as redemptions
            const isRedemptionTransfer = await this.validateTransferIntent(signature, userAddress, amount);
            if (!isRedemptionTransfer) {
              this.logger.info(`⏭️  Skipping transfer ${signature} - not marked as redemption`);
              // Still mark as processed to avoid re-checking
              if (databaseService.isConnected()) {
                try {
                  await databaseService.markEventProcessed({
                    eventSignature: signature,
                    eventType: 'NativeZECTransferSkipped',
                    solanaAddress: userAddress,
                    amount: amount / 1e8,
                  });
                } catch (error) {
                  this.logger.error('Error marking transfer as processed (skipped):', error);
                }
              }
              this.processedEvents.set(signature, Date.now());
              this.cleanupProcessedEvents();
              return;
            }

            this.logger.info(`✅ Validated transfer ${signature} as redemption - processing...`);

            // Mark as processed in database
            if (databaseService.isConnected()) {
              try {
                await databaseService.markEventProcessed({
                  eventSignature: signature,
                  eventType: 'NativeZECTransfer',
                  solanaAddress: userAddress,
                  amount: amount / 1e8,
                });
              } catch (error) {
                this.logger.error('Error marking transfer as processed:', error);
              }
            }

            // Store transfer data
            this.pendingTransfers.set(signature, {
              userAddress,
              amount,
              timestamp: Date.now(),
            });

            // Check if user has encrypted BTC address and process redemption
            await this.checkAndProcessPendingRedemption(userAddress, signature);

            this.processedEvents.set(signature, Date.now());
            this.cleanupProcessedEvents();
          }
        } catch (error) {
          this.logger.error(`Error processing transaction ${sigInfo.signature}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error checking recent transfers:', error);
    }
  }

  /**
   * Validate that a transfer is intended for redemption processing
   * @param {string} signature - Solana transaction signature
   * @param {string} userAddress - User Solana address
   * @param {number} amount - Transfer amount in smallest units
   * @returns {boolean} - True if transfer should be processed as redemption
   */
  async validateTransferIntent(signature, userAddress, amount) {
    try {
      // Check database for transfer metadata
      if (databaseService.isConnected()) {
        const client = await databaseService.pool.connect();
        try {
          const result = await client.query(
            'SELECT transfer_type, user_address, amount FROM transfer_metadata WHERE solana_tx_signature = $1',
            [signature]
          );

          if (result.rows.length > 0) {
            const metadata = result.rows[0];

            // Only process if explicitly marked as redemption
            if (metadata.transfer_type === 'redemption') {
              // Validate user address and amount match
              if (metadata.user_address && metadata.user_address !== userAddress) {
                this.logger.warn(`Transfer metadata user mismatch: expected ${metadata.user_address}, got ${userAddress}`);
                return false;
              }

              if (metadata.amount && Math.abs(metadata.amount - (amount / 1e8)) > 0.000001) { // Small tolerance for rounding
                this.logger.warn(`Transfer metadata amount mismatch: expected ${metadata.amount}, got ${amount / 1e8}`);
                return false;
              }

              return true;
            } else {
              this.logger.info(`Transfer ${signature} marked as ${metadata.transfer_type} - not processing as redemption`);
              return false;
            }
          }
        } finally {
          client.release();
        }
      }

      // Fallback: If no metadata exists, don't process (safer default)
      this.logger.info(`No transfer metadata found for ${signature} - skipping redemption processing`);
      return false;

    } catch (error) {
      this.logger.error('Error validating transfer intent:', error);
      // On error, don't process to be safe
      return false;
    }
  }

  /**
   * Parse token transfer from transaction
   */
  async parseTokenTransfer(transaction, treasuryZECAccount) {
    try {
      // Get token balance changes
      if (!transaction.meta || !transaction.meta.preTokenBalances || !transaction.meta.postTokenBalances) {
        return null;
      }

      // Find balance change for treasury account
      let treasuryPreBalance = null;
      let treasuryPostBalance = null;

      for (const balance of transaction.meta.preTokenBalances) {
        const accountKey = transaction.transaction.message.accountKeys[balance.accountIndex];
        if (accountKey && accountKey.equals(treasuryZECAccount)) {
          treasuryPreBalance = balance;
          break;
        }
      }

      for (const balance of transaction.meta.postTokenBalances) {
        const accountKey = transaction.transaction.message.accountKeys[balance.accountIndex];
        if (accountKey && accountKey.equals(treasuryZECAccount)) {
          treasuryPostBalance = balance;
          break;
        }
      }

      if (!treasuryPreBalance || !treasuryPostBalance) {
        return null;
      }

      const preAmount = BigInt(treasuryPreBalance.uiTokenAmount.amount || 0);
      const postAmount = BigInt(treasuryPostBalance.uiTokenAmount.amount || 0);
      const transferAmount = postAmount - preAmount;
      
      if (transferAmount <= 0) {
        return null; // No incoming transfer
      }

      // Find source account (sender) - account that decreased
      let sourcePubkey = null;
      for (const preBalance of transaction.meta.preTokenBalances) {
        const preAmount = BigInt(preBalance.uiTokenAmount?.amount || 0);
        
        // Find corresponding post balance
        const postBalance = transaction.meta.postTokenBalances.find(
          post => post.accountIndex === preBalance.accountIndex
        );
        
        if (postBalance) {
          const postAmount = BigInt(postBalance.uiTokenAmount?.amount || 0);
          const decrease = preAmount - postAmount;
          
          // If this account decreased by the same amount treasury increased, it's the source
          if (decrease > 0n && decrease === transferAmount) {
            const accountKey = transaction.transaction.message.accountKeys[preBalance.accountIndex];
            if (accountKey && !accountKey.equals(treasuryZECAccount)) {
              sourcePubkey = accountKey;
              break;
            }
          }
        }
      }

      if (!sourcePubkey) {
        // Fallback: use the first signer as source (if not treasury)
        const signers = transaction.transaction.message.accountKeys.filter(
          (key, index) => transaction.transaction.message.header.numRequiredSignatures > index &&
                         !key.equals(treasuryZECAccount)
        );
        if (signers.length > 0) {
          sourcePubkey = signers[0];
        } else {
          return null;
        }
      }

      return {
        userAddress: sourcePubkey.toString(),
        amount: Number(transferAmount),
        signature: transaction.transaction.signatures[0],
      };
    } catch (error) {
      this.logger.error('Error parsing token transfer:', error);
      return null;
    }
  }

  /**
   * Get encrypted BTC address from program account
   */
  async getEncryptedBTCAddress(userAddress) {
    try {
      const connection = solanaService.getConnection();
      const programId = solanaService.programId;
      
      if (!programId) {
        return null;
      }

      const userPubkey = new PublicKey(userAddress);

      // Derive encrypted_btc PDA
      const [encryptedBtcPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('encrypted_btc'), userPubkey.toBuffer()],
        programId
      );

      // Get account data
      const accountInfo = await connection.getAccountInfo(encryptedBtcPda);
      
      if (!accountInfo || !accountInfo.data) {
        return null;
      }

      // Try to get program and deserialize account
      try {
        const program = solanaService.getProgram();
        if (program && program.account) {
          // Deserialize using Anchor
          const accountData = await program.account.encryptedBtc.fetch(encryptedBtcPda);
          
          // encrypted_address is Vec<u8>, convert to base64 for decryptBTCAddress
          const encryptedBytes = accountData.encryptedAddress;
          const base64Encrypted = Buffer.from(encryptedBytes).toString('base64');
          
          // For MVP, decryptBTCAddress expects base64-encoded JSON
          // Create mock format: { address: "...", nonce: ... }
          // In production, this would be the actual encrypted data
          const mockData = {
            address: 'mock', // Will be decrypted by MPC
            nonce: Date.now(),
            encrypted: base64Encrypted, // Actual encrypted data
          };
          const encryptedString = Buffer.from(JSON.stringify(mockData)).toString('base64');
          
          return encryptedString;
        }
      } catch (error) {
        this.logger.warn('Could not deserialize account using Anchor, using raw data:', error.message);
      }

      // Fallback: extract from raw account data
      // Account layout: discriminator(8) + encrypted_address(Vec<u8>) + completed_at(8) + bump(1) + recipient(32)
      // encrypted_address starts at offset 8, first 4 bytes are length
      // Convert to Buffer if needed (accountInfo.data might be Uint8Array)
      const data = Buffer.isBuffer(accountInfo.data) 
        ? accountInfo.data 
        : Buffer.from(accountInfo.data);
      
      if (data.length < 12) {
        return null;
      }

      const addrLength = data.readUInt32LE(8);
      if (addrLength === 0 || data.length < 12 + addrLength) {
        return null;
      }

      const encryptedBytes = data.slice(12, 12 + addrLength);
      const base64Encrypted = Buffer.from(encryptedBytes).toString('base64');
      
      // Create mock format for decryptBTCAddress
      const mockData = {
        address: 'mock',
        nonce: Date.now(),
        encrypted: base64Encrypted,
      };
      const encryptedString = Buffer.from(JSON.stringify(mockData)).toString('base64');
      
      return encryptedString;

    } catch (error) {
      this.logger.error('Error getting encrypted BTC address:', error);
      return null;
    }
  }

  /**
   * Check and process pending redemption when both transfer and encryption exist
   */
  async checkAndProcessPendingRedemption(userAddress, transferSignature = null) {
    try {
      // SERVICE COORDINATION: Check if another service is already processing this transaction
      if (transferSignature) {
        const coordinationCheck = await serviceCoordinator.canProcessTransaction(
          `redemption_${transferSignature}`,
          'solana_transfer'
        );

        if (!coordinationCheck.canProcess) {
          this.logger.info(`🚫 Redemption ${transferSignature} blocked by service coordination: ${coordinationCheck.reason}`);
          return;
        }

        // Mark this transaction as being processed by btc-relayer
        const marked = await serviceCoordinator.markTransactionProcessing(
          `redemption_${transferSignature}`,
          'solana_transfer'
        );

        if (!marked) {
          this.logger.warn(`⚠️  Could not mark redemption ${transferSignature} as processing, skipping`);
          return;
        }
      }

      // Check database first to avoid duplicate processing
      if (transferSignature && databaseService.isConnected()) {
        try {
          const existingWithdrawal = await databaseService.getBTCWithdrawalBySolanaTxWithLock(transferSignature);
          if (existingWithdrawal && (existingWithdrawal.status === 'confirmed' || existingWithdrawal.status === 'processing')) {
            this.logger.info(`Redemption ${transferSignature} already ${existingWithdrawal.status}, skipping`);
            await serviceCoordinator.releaseTransaction(`redemption_${transferSignature}`);
            return;
          }
        } catch (error) {
          // If lock fails or query fails, continue (will be caught by processRedemption's locking)
          this.logger.warn('Could not check database for existing withdrawal:', error.message);
        }
      }

      // Check if user has encrypted BTC address
      let encryptionData = this.pendingEncryptions.get(userAddress);
      
      if (!encryptionData) {
        // Try to get from program account
        const encryptedAddress = await this.getEncryptedBTCAddress(userAddress);
        if (encryptedAddress) {
          encryptionData = {
            encryptedAddress: encryptedAddress,
            timestamp: Date.now(),
          };
          this.pendingEncryptions.set(userAddress, encryptionData);
        }
      }

      if (!encryptionData) {
        this.logger.info(`⏳ Waiting for BTC address encryption for user: ${userAddress}`);
        return;
      }

      // Check if user has transfer to treasury
      let transferData = null;
      
      if (transferSignature && this.pendingTransfers.has(transferSignature)) {
        transferData = this.pendingTransfers.get(transferSignature);
      } else {
        // Find most recent transfer for this user
        for (const [sig, data] of this.pendingTransfers.entries()) {
          if (data.userAddress === userAddress) {
            transferData = data;
            transferSignature = sig;
            break;
          }
        }
      }

      if (!transferData) {
        this.logger.info(`⏳ Waiting for native ZEC transfer from user: ${userAddress}`);
        return;
      }

      // Validate transferSignature is set
      if (!transferSignature) {
        this.logger.error('Invalid state: transferData exists but transferSignature is null');
        return;
      }

      // Both conditions met - process redemption automatically!
      this.logger.info(`✅ Auto-processing BTC redemption for user: ${userAddress}`);
      this.logger.info(`   Transfer: ${transferSignature}`);
      this.logger.info(`   Amount: ${transferData.amount / 1e8} native ZEC`);

      const redemptionResult = await this.processRedemption({
        userAddress,
        transferSignature,
        encryptedBtcAddress: encryptionData.encryptedAddress,
        nativeZECAmount: transferData.amount / 1e8, // Convert from smallest unit
      });

      // SERVICE COORDINATION: Mark as completed if successful
      if (redemptionResult && redemptionResult.success) {
        await serviceCoordinator.markTransactionCompleted(`redemption_${transferSignature}`);
        this.logger.info(`✅ Service coordination: Marked redemption ${transferSignature} as completed`);
      } else {
        // Release if processing failed
        await serviceCoordinator.releaseTransaction(`redemption_${transferSignature}`);
        this.logger.info(`⚠️  Service coordination: Released redemption ${transferSignature} due to failure`);
      }

      // Clean up pending data only after successful processing
      // (processRedemption handles errors internally)
      this.pendingTransfers.delete(transferSignature);
      
    } catch (error) {
      const logError = createContextLogger('Auto-Process Redemption', {
        userAddress,
        signature: transferSignature
      });
      logError(error);

      // SERVICE COORDINATION: Release transaction on error
      if (transferSignature) {
        await serviceCoordinator.releaseTransaction(`redemption_${transferSignature}`);
      }

      // Don't throw - allow retry (processRedemption's database locking will prevent duplicates)
    }
  }

  /**
   * Start cleanup interval to prevent memory leaks
   */
  startCleanupInterval() {
    // Clean up every 30 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupMemory();
    }, 30 * 60 * 1000); // 30 minutes
  }

  /**
   * Cleanup memory to prevent leaks
   */
  cleanupMemory() {
    const now = Date.now();
    let cleanedCount = 0;

    // Clean up old processed events (older than 24 hours)
    for (const [signature, timestamp] of this.processedEvents.entries()) {
      if (now - timestamp > this.eventTTL) {
        this.processedEvents.delete(signature);
        cleanedCount++;
      }
    }

    // Clean up old pending items (older than 1 hour)
    const pendingTTL = 60 * 60 * 1000; // 1 hour
    for (const [key, data] of this.pendingEncryptions.entries()) {
      if (now - data.timestamp > pendingTTL) {
        this.pendingEncryptions.delete(key);
        cleanedCount++;
      }
    }

    for (const [key, data] of this.pendingTransfers.entries()) {
      if (now - data.timestamp > pendingTTL) {
        this.pendingTransfers.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info('Memory cleanup completed', {
        removedItems: cleanedCount,
        processedEvents: this.processedEvents.size,
        pendingEncryptions: this.pendingEncryptions.size,
        pendingTransfers: this.pendingTransfers.size
      });
    }
  }

  /**
   * Cleanup old processed events (LRU eviction)
   */
  cleanupProcessedEvents() {
    if (this.processedEvents.size >= this.maxProcessedEvents) {
      // Remove oldest 10% of entries
      const entriesToRemove = Math.floor(this.maxProcessedEvents * 0.1);
      const entries = Array.from(this.processedEvents.entries())
        .sort((a, b) => a[1] - b[1]) // Sort by timestamp
        .slice(0, entriesToRemove);

      for (const [signature] of entries) {
        this.processedEvents.delete(signature);
      }
    }
  }

  /**
   * Start health check to detect disconnections
   */
  startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      if (!this.isListening) {
        return;
      }

      try {
        const connection = solanaService.getConnection();
        const programId = solanaService.programId;
        
        if (programId) {
          await connection.getAccountInfo(programId);
        }
        
        // Check if we haven't received events in a while
        const timeSinceLastEvent = this.lastEventTime 
          ? Date.now() - this.lastEventTime 
          : Infinity;
        
        if (timeSinceLastEvent > 300000 && (this.tokenAccountSubscriptionId !== null || this.programLogsSubscriptionId !== null)) {
          this.logger.warn('No events received in 5 minutes, reconnecting...');
          await this.handleReconnection();
        }
      } catch (error) {
        this.logger.error('Health check failed, reconnecting:', error.message);
        await this.handleReconnection();
      }
    }, this.healthCheckIntervalMs);
  }

  /**
   * Handle reconnection
   */
  async handleReconnection() {
    if (!this.isListening) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached. Stopping service.');
      this.isListening = false;
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    this.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.stopListening();
        await this.startListening();
      } catch (error) {
        this.logger.error('Reconnection failed:', error.message);
        await this.handleReconnection();
      }
    }, delay);
  }

  /**
   * Process BTC redemption request (called automatically or via API)
   */
  async processRedemption(redemptionData) {
    const { userAddress, transferSignature, encryptedBtcAddress, nativeZECAmount } = redemptionData;
    
    this.logger.info(`🔒 Processing BTC Redemption: ${nativeZECAmount} native ZEC for ${userAddress}`);
    this.logger.info(`Transfer TX: ${transferSignature}`);
    this.logger.info(`BTC Address: [ENCRYPTED]`);

    // Create error logger with base context
    const logError = createContextLogger('BTC Redemption', {
      userAddress,
      amount: nativeZECAmount,
      signature: transferSignature
    });

    // Validate inputs
    if (!userAddress || !transferSignature || !encryptedBtcAddress || !nativeZECAmount) {
      throw createEnhancedError('BTC Redemption', {
        userAddress,
        amount: nativeZECAmount,
        signature: transferSignature
      }, 'Invalid redemption data: missing required fields');
    }

    if (nativeZECAmount <= 0) {
      throw createEnhancedError('BTC Redemption', {
        userAddress,
        amount: nativeZECAmount,
        signature: transferSignature
      }, 'Invalid redemption data: amount must be positive');
    }

    // Validate PublicKey format
    let userPubkey;
    try {
      userPubkey = new PublicKey(userAddress);
    } catch (error) {
      throw createEnhancedError('BTC Redemption', {
        userAddress,
        amount: nativeZECAmount,
        signature: transferSignature
      }, `Invalid user PublicKey format: ${userAddress}`);
    }

    // Validate signature format
    if (typeof transferSignature !== 'string' || transferSignature.length < 32) {
      throw createEnhancedError('BTC Redemption', {
        userAddress,
        amount: nativeZECAmount,
        signature: transferSignature
      }, `Invalid transfer signature format: ${transferSignature}`);
    }

    let btcAddress;

    // ALWAYS decrypt BTC address via Arcium MPC (privacy required)
    try {
      this.logger.info('🔒 Decrypting BTC address via Arcium MPC...');
      btcAddress = await arciumService.decryptBTCAddress(encryptedBtcAddress, userAddress);
      this.logger.info('✓ BTC address decrypted successfully');
    } catch (error) {
      logError(error, { btcAddress: '[ENCRYPTED]' });
      throw createEnhancedError('BTC Redemption', {
        userAddress,
        amount: nativeZECAmount,
        signature: transferSignature,
        btcAddress: '[ENCRYPTED]'
      }, 'Cannot process unencrypted BTC address - privacy required');
    }

    // Validate BTC address format
    if (!bitcoinService.isValidAddress(btcAddress)) {
      logError(`Invalid BTC address format: ${btcAddress}`, { btcAddress });
      throw createEnhancedError('BTC Redemption', {
        userAddress,
        amount: nativeZECAmount,
        signature: transferSignature,
        btcAddress
      }, `Invalid BTC address format: ${btcAddress}`);
    }

    // Verify the transfer signature on-chain
    this.logger.info(`Verifying native ZEC transfer on-chain...`);
    const transferVerified = await this.verifyNativeZECTransfer(transferSignature, userAddress, nativeZECAmount);
    
    if (!transferVerified) {
      throw createEnhancedError('BTC Redemption', {
        userAddress,
        amount: nativeZECAmount,
        signature: transferSignature,
        btcAddress
      }, 'Transfer verification failed - transfer not found or invalid');
    }

    this.logger.info(`✓ Transfer verified: ${transferSignature}`);

    // Calculate BTC amount from native ZEC
    const exchangeRate = parseFloat(process.env.ZENZEC_TO_BTC_RATE || '0.001');
    const btcAmount = nativeZECAmount * exchangeRate;
    const amountSatoshis = Math.floor(btcAmount * 100000000);

    // Use database transaction with row-level locking
    const client = databaseService.isConnected() 
      ? await databaseService.pool.connect() 
      : null;

    try {
      if (client) {
        await client.query('BEGIN');
      }

      let withdrawal = null;
      if (client) {
        withdrawal = await databaseService.getBTCWithdrawalBySolanaTxWithLock(transferSignature, client);
        
        if (withdrawal && withdrawal.status === 'confirmed') {
          await client.query('ROLLBACK');
          client.release();
          this.logger.info(`BTC redemption ${transferSignature} already confirmed`);
          return { 
            alreadyProcessed: true,
            solanaTxSignature: transferSignature,
            btcTxHash: withdrawal.tx_hash,
          };
        }

        if (withdrawal && withdrawal.status === 'processing') {
          await client.query('ROLLBACK');
          client.release();
          this.logger.info(`BTC redemption ${transferSignature} is currently being processed`);
          return { 
            alreadyProcessed: true,
            processing: true,
            solanaTxSignature: transferSignature,
          };
        }

        if (!withdrawal) {
          // Use centralized reserve manager for consistent reserve checking
          const reserveCheck = await reserveManager.checkBTCReserve(amountSatoshis);
          if (!reserveCheck.sufficient) {
            await client.query('ROLLBACK');
            client.release();
            throw createEnhancedError('BTC Redemption', {
              userAddress,
              amount: nativeZECAmount,
              signature: transferSignature,
              btcAddress,
              currentReserve: reserveCheck.currentReserveBTC,
              requiredAmount: reserveCheck.requestedAmountBTC,
              shortfall: reserveCheck.shortfallBTC
            }, `Insufficient BTC reserve: ${reserveCheck.currentReserveBTC} BTC available, need ${reserveCheck.requestedAmountBTC} BTC (${reserveCheck.shortfallBTC} BTC shortfall)`);
          }

          // Reserve BTC using centralized manager
          const reserveResult = await reserveManager.reserveBTCForWithdrawal(
            amountSatoshis,
            {
              txHash: `pending_${transferSignature.substring(0, 16)}_${Date.now()}`,
              bridgeAddress: bitcoinService.bridgeAddress,
              amountSatoshis: amountSatoshis,
              amountBTC: btcAmount,
              recipientAddress: btcAddress,
              confirmations: 0,
              status: 'pending',
              solanaTxSignature: transferSignature,
              solanaAddress: userAddress,
              zenZECAmount: nativeZECAmount,
            },
            client
          );

          if (!reserveResult.success) {
            await client.query('ROLLBACK');
            client.release();
            throw createEnhancedError('BTC Redemption', {
              userAddress,
              amount: nativeZECAmount,
              signature: transferSignature,
              btcAddress
            }, `Failed to reserve BTC: ${reserveResult.error || 'Unknown error'}`);
          }

          withdrawal = reserveResult.withdrawal;
          this.logger.info(`✓ Reserve checked and reserved via centralized manager: ${reserveCheck.currentReserveBTC} BTC → ${(reserveCheck.currentReserveBTC - reserveCheck.requestedAmountBTC)} BTC`);
        }

        withdrawal = await databaseService.markBTCWithdrawalProcessing(transferSignature, client);

        if (!withdrawal) {
          await client.query('ROLLBACK');
          client.release();
          throw createEnhancedError('BTC Redemption', {
            userAddress,
            amount: nativeZECAmount,
            signature: transferSignature,
            btcAddress
          }, `Redemption ${transferSignature} cannot be marked as processing`);
        }
      } else {
        if (!databaseService.isConnected()) {
          throw createEnhancedError('BTC Redemption', {
            userAddress,
            amount: nativeZECAmount,
            signature: transferSignature,
            btcAddress
          }, 'Database required for reserve check - cannot process redemption safely');
        }
      }

      try {
        const txHash = await this.retryOperation(async () => {
          return await bitcoinService.sendBTC(btcAddress, btcAmount);
        }, 3, 2000);
        
        this.logger.info(`✓ Sent ${btcAmount} BTC to ${btcAddress}`);
        this.logger.info(`  Bitcoin TX: ${txHash}`);
        this.logger.info(`  Solana Transfer TX: ${transferSignature}`);

        if (client) {
          try {
            await databaseService.updateBTCWithdrawalStatus(transferSignature, 'confirmed', {
              btcTxHash: txHash,
              confirmations: 0,
            }, client);

            const uniqueId = `redeem_btc_${transferSignature.substring(0, 16)}_${crypto.randomBytes(4).toString('hex')}`;
            await databaseService.saveBurnTransaction({
              txId: uniqueId,
              solanaAddress: userAddress,
              amount: nativeZECAmount,
              targetAsset: 'BTC',
              targetAddress: btcAddress,
              solanaTxSignature: transferSignature,
              btcTxHash: txHash,
              status: 'confirmed',
              encrypted: true,
            }, client);

            await client.query('COMMIT');
          } catch (error) {
            await client.query('ROLLBACK');
            logError(error, { btcTxHash: txHash, status: 'confirmed' });
            throw createEnhancedError('BTC Redemption', {
              userAddress,
              amount: nativeZECAmount,
              signature: transferSignature,
              btcAddress,
              btcTxHash: txHash
            }, `Failed to save redemption status: ${error.message}`);
          } finally {
            client.release();
          }
        } else if (databaseService.isConnected()) {
          try {
            await databaseService.updateBTCWithdrawalStatus(transferSignature, 'confirmed', {
              btcTxHash: txHash,
              confirmations: 0,
            });

            const uniqueId = `redeem_btc_${transferSignature.substring(0, 16)}_${crypto.randomBytes(4).toString('hex')}`;
            await databaseService.saveBurnTransaction({
              txId: uniqueId,
              solanaAddress: userAddress,
              amount: nativeZECAmount,
              targetAsset: 'BTC',
              targetAddress: btcAddress,
              solanaTxSignature: transferSignature,
              btcTxHash: txHash,
              status: 'confirmed',
              encrypted: true,
            });
          } catch (error) {
            logError(error, { btcTxHash: txHash, status: 'confirmed' });
          }
        }

        this.logger.info(`✅ BTC redemption processed successfully`);
        this.logger.info(`   Bitcoin TX: ${txHash}`);
        this.logger.info(`   Solana Transfer TX: ${transferSignature}`);
        this.logger.info(`   User received: ${btcAmount} BTC for ${nativeZECAmount} native ZEC`);

        return {
          success: true,
          btcAmount,
          nativeZECAmount,
          btcTxHash: txHash,
          solanaTxSignature: transferSignature,
        };

      } catch (error) {
        if (client) {
          try {
            await client.query('ROLLBACK');
          } catch (rollbackError) {
            logError(rollbackError, { operation: 'rollback' });
          } finally {
            client.release();
          }
        }
        
        logError(error, { btcAddress, btcAmount });
        throw error;
      }
    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          logError(rollbackError, { operation: 'rollback' });
        } finally {
          client.release();
        }
      }
      logError(error);
      throw error;
    }
  }

  /**
   * Verify that user transferred native ZEC to treasury
   */
  async verifyNativeZECTransfer(transferSignature, userAddress, expectedAmount) {
    try {
      const connection = solanaService.getConnection();
      const treasuryPubkey = solanaService.relayerKeypair?.publicKey;
      
      if (!treasuryPubkey) {
        throw new Error('Treasury keypair not configured');
      }

      const transaction = await connection.getTransaction(transferSignature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (!transaction) {
        this.logger.error(`Transaction ${transferSignature} not found`);
        return false;
      }

      if (!transaction.meta || transaction.meta.err) {
        this.logger.error(`Transaction ${transferSignature} failed:`, transaction.meta?.err);
        return false;
      }

      const zecMint = solanaService.getNativeZECMint();
      const treasuryZECAccount = await solanaService.getTreasuryZECAccount(zecMint);
      const userPubkey = new PublicKey(userAddress);
      
      const userZECAccount = await getAssociatedTokenAddress(
        zecMint,
        userPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Parse token balance changes to verify transfer
      const preBalances = transaction.meta.preTokenBalances || [];
      const postBalances = transaction.meta.postTokenBalances || [];

      // Find treasury account in balances
      let treasuryPreBalance = null;
      let treasuryPostBalance = null;
      let userPreBalance = null;
      let userPostBalance = null;

      for (const balance of preBalances) {
        const accountKey = transaction.transaction.message.accountKeys[balance.accountIndex];
        if (accountKey && accountKey.equals(treasuryZECAccount)) {
          treasuryPreBalance = balance;
        }
        if (accountKey && accountKey.equals(userZECAccount)) {
          userPreBalance = balance;
        }
      }

      for (const balance of postBalances) {
        const accountKey = transaction.transaction.message.accountKeys[balance.accountIndex];
        if (accountKey && accountKey.equals(treasuryZECAccount)) {
          treasuryPostBalance = balance;
        }
        if (accountKey && accountKey.equals(userZECAccount)) {
          userPostBalance = balance;
        }
      }

      // Verify treasury received tokens
      if (!treasuryPreBalance || !treasuryPostBalance) {
        this.logger.error(`Treasury account not found in transaction balances`);
        return false;
      }

      const treasuryPreAmount = BigInt(treasuryPreBalance.uiTokenAmount.amount || 0);
      const treasuryPostAmount = BigInt(treasuryPostBalance.uiTokenAmount.amount || 0);
      const treasuryIncrease = Number(treasuryPostAmount - treasuryPreAmount);

      // Verify user sent tokens (if user account found in transaction)
      if (userPreBalance && userPostBalance) {
        const userPreAmount = BigInt(userPreBalance.uiTokenAmount.amount || 0);
        const userPostAmount = BigInt(userPostBalance.uiTokenAmount.amount || 0);
        const userDecrease = Number(userPreAmount - userPostAmount);

        if (userDecrease !== treasuryIncrease) {
          this.logger.error(`Transfer mismatch: user decreased by ${userDecrease}, treasury increased by ${treasuryIncrease}`);
          return false;
        }
      }

      // Convert expected amount to smallest unit (8 decimals for native ZEC)
      const expectedAmountSmallest = BigInt(Math.floor(expectedAmount * 1e8));
      const actualAmountSmallest = BigInt(treasuryIncrease);

      // Verify amount matches (within small tolerance for rounding)
      if (actualAmountSmallest < expectedAmountSmallest || 
          actualAmountSmallest > expectedAmountSmallest + BigInt(1)) {
        this.logger.error(`Amount mismatch: expected ${expectedAmountSmallest}, got ${actualAmountSmallest}`);
        return false;
      }

      // Verify treasury received tokens (increase > 0)
      if (treasuryIncrease <= 0) {
        this.logger.error(`Treasury did not receive tokens (increase: ${treasuryIncrease})`);
        return false;
      }
      
      this.logger.info(`✓ Transfer verified: ${transferSignature}`);
      this.logger.info(`  From: ${userAddress}`);
      this.logger.info(`  To treasury: ${treasuryPubkey.toString()}`);
      this.logger.info(`  Amount: ${expectedAmount} native ZEC (${treasuryIncrease} smallest units)`);
      
      return true;

    } catch (error) {
      this.logger.error('Error verifying transfer:', error);
      return false;
    }
  }

  /**
   * Stop service
   */
  stopListening() {
    this.isListening = false;
    this.serviceReady = false;

    const connection = solanaService.getConnection();

    if (this.tokenAccountSubscriptionId !== null) {
      try {
        connection.removeAccountChangeListener(this.tokenAccountSubscriptionId);
      } catch (error) {
        this.logger.warn('Error removing token account listener:', error.message);
      }
      this.tokenAccountSubscriptionId = null;
    }

    if (this.programLogsSubscriptionId !== null) {
      try {
        connection.removeOnLogsListener(this.programLogsSubscriptionId);
      } catch (error) {
        this.logger.warn('Error removing program log listener:', error.message);
      }
      this.programLogsSubscriptionId = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.logger.info('BTC Redemption Service stopped');
  }

  /**
   * Enhanced retry wrapper for transaction operations
   * Improved error classification and retry logic
   */
  async retryOperation(fn, maxRetries = 3, baseDelay = 1000) {
    const errors = [];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        errors.push(error);
        const errorMsg = error.message || error.toString();

        // Classify errors - determine if retryable
        const isRetryable = this.isRetryableError(error);

        if (!isRetryable) {
          this.logger.info(`BTC Redemption non-retryable error (not retrying): ${errorMsg}`);
          throw error;
        }

        if (attempt < maxRetries - 1) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt), 30000); // Cap at 30 seconds
          this.logger.info(`BTC Redemption retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms: ${errorMsg}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          this.logger.info(`BTC Redemption all ${maxRetries} attempts failed. Last error: ${errorMsg}`);
        }
      }
    }

    // All retries exhausted - throw the last error with context
    const lastError = errors[errors.length - 1];
    const errorSummary = errors.map((e, i) => `Attempt ${i + 1}: ${e.message}`).join('; ');
    const enhancedError = new Error(`Operation failed after ${maxRetries} attempts. Errors: ${errorSummary}`);
    enhancedError.originalError = lastError;
    enhancedError.allErrors = errors;
    throw enhancedError;
  }

  /**
   * Classify if an error is retryable
   * @param {Error} error - The error to classify
   * @returns {boolean} - True if the error should be retried
   */
  isRetryableError(error) {
    if (!error) return false;

    const errorMsg = (error.message || error.toString()).toLowerCase();

    // NEVER retry these errors (indicates a fundamental problem)
    const nonRetryablePatterns = [
      'insufficient',      // Insufficient funds/reserves
      'invalid',          // Invalid input/parameters
      'unauthorized',     // Authentication/authorization
      'forbidden',        // Permission denied
      'not found',        // Resource doesn't exist
      'not configured',   // Configuration missing
      'not connected',    // Database/network not available
      'bad request',      // Client error
      'timeout',          // Explicit timeout (different from network timeout)
      'cancelled',        // Operation was cancelled
      'conflict',         // Resource conflict (like duplicate)
    ];

    if (nonRetryablePatterns.some(pattern => errorMsg.includes(pattern))) {
      return false;
    }

    // RETRY these errors (indicates transient issues)
    const retryablePatterns = [
      'network',          // Network connectivity issues
      'connection',       // Connection problems
      'timeout',          // Network timeouts (but not explicit timeouts)
      'temporary',        // Temporary failures
      'rate limit',       // Rate limiting (may be temporary)
      'busy',            // Service busy
      'maintenance',     // Maintenance mode
      'unavailable',     // Service temporarily unavailable
      'overload',        // System overload
      'rpc error',       // RPC communication errors
      'blockhash',       // Blockhash expired
    ];

    if (retryablePatterns.some(pattern => errorMsg.includes(pattern))) {
      return true;
    }

    // RETRY HTTP status codes that indicate transient issues
    if (error.status) {
      const retryableStatusCodes = [408, 429, 500, 502, 503, 504]; // Timeout, rate limit, server errors
      if (retryableStatusCodes.includes(error.status)) {
        return true;
      }

      // DON'T retry client errors (4xx except 408, 429)
      if (error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status)) {
        return false;
      }
    }

    // Default: retry for unknown errors (fail-safe approach)
    this.logger.warn(`BTC Redemption unknown error type, retrying: ${errorMsg}`);
    return true;
  }

  getStatus() {
    return {
      serviceReady: this.serviceReady,
      isListening: this.isListening,
      mode: 'Hybrid automation (transfers + events)',
      pendingEncryptions: this.pendingEncryptions.size,
      pendingTransfers: this.pendingTransfers.size,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

module.exports = new BTCRedemptionService();

const axios = require('axios');
const bitcoin = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');
const { BIP32Factory } = require('bip32');
const bip32 = BIP32Factory(ecc);
const { randomUUID } = require('crypto');
const databaseService = require('./database');

/**
 * Circuit Breaker for external API calls
 * Prevents cascading failures and allows graceful degradation
 */
class CircuitBreaker {
  constructor(failureThreshold = 5, recoveryTimeout = 60000, monitoringPeriod = 10000) {
    this.failureThreshold = failureThreshold;
    this.recoveryTimeout = recoveryTimeout;
    this.monitoringPeriod = monitoringPeriod;

    this.failures = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        console.log('🔄 Circuit breaker: Testing recovery');
      } else {
        throw new Error('Circuit breaker is OPEN - external service unavailable');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      console.warn(`🔴 Circuit breaker: OPEN after ${this.failures} failures`);
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailureTime
    };
  }
}

/**
 * Bitcoin Service
 * Handles Bitcoin blockchain monitoring and payment verification
 * For Cash App user onboarding
 */
class BitcoinService {
  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Network configuration
    this.network = process.env.BITCOIN_NETWORK || 'testnet';
    
    // Bridge address - required in production, optional for dev
    this.bridgeAddress = process.env.BITCOIN_BRIDGE_ADDRESS;
    if (!this.bridgeAddress) {
      if (isProduction) {
        throw new Error('BITCOIN_BRIDGE_ADDRESS is required in production');
      }
      console.warn('⚠️  BITCOIN_BRIDGE_ADDRESS not set - BTC deposit monitoring disabled');
      this.bridgeAddress = null;
    }
    
    // Explorer URL with defaults
    this.explorerUrl = process.env.BITCOIN_EXPLORER_URL || (
      this.network === 'mainnet'
        ? 'https://blockstream.info/api'
        : 'https://blockstream.info/testnet/api'
    );
    
    console.log(`✅ Bitcoin service: ${this.network.toUpperCase()}`);
    if (this.bridgeAddress) {
      console.log(`   Bridge address: ${this.bridgeAddress.substring(0, 15)}...`);
    }

    this.currentReserve = 0; // BTC in satoshis
    this.bootstrapAmount = parseFloat(process.env.BOOTSTRAP_BTC || '0') * 100000000; // Convert to satoshis
    this.monitoringInterval = null;
    // Removed in-memory Set - using database as source of truth to prevent race conditions

    // Configurable confirmation requirements (default 1 for speed, can be increased for security)
    // For testnet: 1 confirmation is usually safe
    // For mainnet: 1-3 confirmations is reasonable for most use cases
    // Higher confirmations (6+) provide more security but slower processing
    this.requiredConfirmations = parseInt(process.env.BITCOIN_REQUIRED_CONFIRMATIONS || '1', 10);
    if (this.requiredConfirmations < 1) {
      this.requiredConfirmations = 1; // Minimum 1 confirmation
    }

    this.bridgeXpub = (process.env.BITCOIN_BRIDGE_XPUB || '').trim() || null;
    this.depositBasePath =
      process.env.BITCOIN_DEPOSIT_DERIVATION_PATH ||
      (this.network === 'mainnet' ? "m/84'/0'/0'" : "m/84'/1'/0'");
    this.depositChangeIndex = Math.max(
      0,
      parseInt(process.env.BITCOIN_DEPOSIT_CHANGE_INDEX || '0', 10)
    );
    this.depositTtlMinutes = Math.max(
      0,
      parseInt(process.env.BITCOIN_DEPOSIT_TTL_MINUTES || '180', 10)
    );
    this.cachedXpubNode = null;

    // Circuit breaker for API calls
    this.apiCircuitBreaker = new CircuitBreaker(5, 60000, 10000);

    // Health monitoring
    this.lastApiCall = Date.now();
    this.apiCallCount = 0;
    this.apiErrorCount = 0;
  }

  getBitcoinNetworkParams() {
    return this.network === 'mainnet'
      ? bitcoin.networks.bitcoin
      : bitcoin.networks.testnet;
  }

  supportsDepositAllocations() {
    return Boolean(this.bridgeXpub && databaseService.isConnected());
  }

  getDepositRootNode() {
    if (!this.bridgeXpub) {
      throw new Error('BITCOIN_BRIDGE_XPUB is not configured');
    }

    if (!this.cachedXpubNode) {
      try {
        this.cachedXpubNode = bip32.fromBase58(this.bridgeXpub, this.getBitcoinNetworkParams());
      } catch (error) {
        console.error('Failed to parse BITCOIN_BRIDGE_XPUB:', error.message);
        throw new Error('Invalid BITCOIN_BRIDGE_XPUB provided');
      }
    }

    return this.cachedXpubNode;
  }

  buildDerivationPath(derivationIndex, changeIndex = this.depositChangeIndex) {
    return `${this.depositBasePath}/${changeIndex}/${derivationIndex}`;
  }

  deriveDepositAddress(derivationIndex, changeIndex = this.depositChangeIndex) {
    const rootNode = this.getDepositRootNode();
    const networkParams = this.getBitcoinNetworkParams();

    let changeNode;
    try {
      changeNode = rootNode.derive(changeIndex);
    } catch (error) {
      console.error('Failed to derive change node for BTC deposit address:', error.message);
      throw new Error('Unable to derive BTC deposit address (change index)');
    }

    let addressNode;
    try {
      addressNode = changeNode.derive(derivationIndex);
    } catch (error) {
      console.error('Failed to derive index node for BTC deposit address:', error.message);
      throw new Error('Unable to derive BTC deposit address (index derivation)');
    }

    const payment = bitcoin.payments.p2wpkh({
      pubkey: addressNode.publicKey,
      network: networkParams,
    });

    if (!payment.address) {
      throw new Error('Derived BTC deposit address is invalid');
    }

    return {
      address: payment.address,
      derivationPath: this.buildDerivationPath(derivationIndex, changeIndex),
    };
  }

  normalizeAllocationRow(row) {
    if (!row) {
      return null;
    }

    let metadata = row.metadata;
    if (metadata && typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch {
        metadata = null;
      }
    }

    const toIso = (value) =>
      value instanceof Date
        ? value.toISOString()
        : value
        ? new Date(value).toISOString()
        : null;

    return {
      id: row.id,
      allocationId: row.allocation_id || row.allocationId,
      solanaAddress: row.solana_address || row.solanaAddress,
      bitcoinAddress: row.bitcoin_address || row.bitcoinAddress,
      derivationIndex: row.derivation_index ?? row.derivationIndex,
      derivationPath: row.derivation_path || row.derivationPath,
      status: row.status,
      sessionId: row.session_id || row.sessionId,
      clientLabel: row.client_label || row.clientLabel,
      metadata: metadata || null,
      expiresAt: toIso(row.expires_at || row.expiresAt),
      fundedTxHash: row.funded_tx_hash || row.fundedTxHash,
      fundedAmountSatoshis: row.funded_amount_satoshis ?? row.fundedAmountSatoshis ?? null,
      fundedAt: toIso(row.funded_at || row.fundedAt),
      claimedTxHash: row.claimed_tx_hash || row.claimedTxHash,
      solanaTxSignature: row.solana_tx_signature || row.solanaTxSignature,
      createdAt: toIso(row.created_at || row.createdAt),
      updatedAt: toIso(row.updated_at || row.updatedAt),
    };
  }

  async getOrCreateDepositAllocation({
    solanaAddress,
    sessionId,
    clientLabel,
    forceNew = false,
    metadata = null,
  }) {
    if (!this.supportsDepositAllocations()) {
      throw new Error('Per-user BTC deposit addresses not available (missing database or BITCOIN_BRIDGE_XPUB)');
    }

    if (!forceNew) {
      const existing = await databaseService.findActiveBTCDepositAllocation(solanaAddress);
      if (existing) {
        return this.normalizeAllocationRow(existing);
      }
    }

    const derivationIndex = await databaseService.getNextBTCDepositAddressIndex();
    const { address, derivationPath } = this.deriveDepositAddress(derivationIndex);
    const expiresAt =
      this.depositTtlMinutes > 0
        ? new Date(Date.now() + this.depositTtlMinutes * 60 * 1000)
        : null;

    const allocation = await databaseService.createBTCDepositAllocation({
      allocationId: randomUUID(),
      solanaAddress,
      bitcoinAddress: address,
      derivationIndex,
      derivationPath,
      status: 'allocated',
      sessionId,
      clientLabel,
      metadata,
      expiresAt,
    });

    return this.normalizeAllocationRow(allocation);
  }

  async getDepositAllocation(allocationId) {
    if (!this.supportsDepositAllocations()) {
      throw new Error('Per-user BTC deposit addresses not available');
    }

    const allocation = await databaseService.getBTCDepositAllocationById(allocationId);
    return this.normalizeAllocationRow(allocation);
  }

  async assertAllocationForAddress(allocationId, solanaAddress) {
    const allocation = await this.getDepositAllocation(allocationId);
    if (!allocation) {
      throw new Error('Deposit allocation not found');
    }

    if (allocation.solanaAddress !== solanaAddress) {
      throw new Error('Deposit allocation does not belong to this Solana address');
    }

    if (
      allocation.status === 'claimed' ||
      allocation.status === 'cancelled' ||
      allocation.status === 'expired'
    ) {
      throw new Error(`Deposit allocation is no longer valid (status: ${allocation.status})`);
    }

    if (
      allocation.expiresAt &&
      Date.parse(allocation.expiresAt) < Date.now() &&
      allocation.status === 'allocated'
    ) {
      throw new Error('Deposit allocation has expired. Request a new BTC address.');
    }

    return allocation;
  }

  async markAllocationFunded(allocationId, { txHash, amountSatoshis }) {
    const updated = await databaseService.markBTCDepositAllocationFunded(allocationId, {
      txHash,
      amountSatoshis,
      fundedAt: new Date(),
    });

    return this.normalizeAllocationRow(updated);
  }

  async markAllocationClaimed(allocationId, { txHash, solanaTxSignature }) {
    const updated = await databaseService.markBTCDepositAllocationClaimed(allocationId, {
      claimedTxHash: txHash,
      solanaTxSignature,
      status: 'claimed',
    });

    return this.normalizeAllocationRow(updated);
  }

  /**
   * Initialize Bitcoin monitoring
   */
  async initialize() {
    if (!this.bridgeAddress) {
      throw new Error('BITCOIN_BRIDGE_ADDRESS is not configured. Please set a testnet address in your environment.');
    }

    this.currentReserve = this.bootstrapAmount;
    console.log(`Bitcoin service initialized`);
    console.log(`Bridge address: ${this.bridgeAddress}`);
    console.log(`Bootstrap reserve: ${this.bootstrapAmount / 100000000} BTC`);
    console.log(`Network: ${this.network}`);
    console.log(`Required confirmations: ${this.requiredConfirmations} (configurable via BITCOIN_REQUIRED_CONFIRMATIONS)`);

    // Load existing deposits from database if available
    await this.loadDepositsFromDatabase();
  }

  /**
   * Load deposits from database on startup
   * Restores processed transactions set and current reserve
   */
  async loadDepositsFromDatabase() {
    if (!databaseService.isConnected()) {
      console.log('[BTC Monitor] Database not connected - skipping deposit restoration');
      return;
    }

    try {
      const deposits = await databaseService.getBTCDeposits(this.bridgeAddress, { limit: 10000 });
      console.log(`[BTC Monitor] Loaded ${deposits.length} deposits from database`);

      let confirmedAmount = 0;
      let processedCount = 0;

      for (const deposit of deposits) {
        // Count processed deposits (for logging only - database is source of truth)
        if (deposit.status === 'processed') {
          processedCount++;
        }

        // Calculate confirmed amount (for reserve tracking)
        if (deposit.status === 'confirmed' || deposit.status === 'processed') {
          confirmedAmount += parseInt(deposit.amount_satoshis);
        }
      }

      // Update reserve based on confirmed deposits
      this.currentReserve = this.bootstrapAmount + confirmedAmount;

      console.log(`[BTC Monitor] Found ${processedCount} processed deposits in database (database is source of truth)`);
      console.log(`[BTC Monitor] Restored reserve: ${this.currentReserve / 100000000} BTC (bootstrap: ${this.bootstrapAmount / 100000000} BTC + confirmed: ${confirmedAmount / 100000000} BTC)`);
    } catch (error) {
      console.error('[BTC Monitor] Error loading deposits from database:', error.message);
    }
  }

  /**
   * Start monitoring Bitcoin blockchain for payments to bridge address
   * @param {Function} callback - Called when new payment detected
   */
  async startMonitoring(callback) {
    if (!this.bridgeAddress) {
      console.warn('[BTC Monitor] Cannot start monitoring: Bitcoin bridge address not configured');
      return;
    }

    console.log(`[BTC Monitor] Starting Bitcoin monitoring for address: ${this.bridgeAddress}`);
    console.log(`[BTC Monitor] Monitoring interval: 60 seconds`);
    console.log(`[BTC Monitor] Explorer URL: ${this.explorerUrl}`);

    // Poll Bitcoin explorer API for new transactions
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkForNewPayments(callback);
      } catch (error) {
        console.error('[BTC Monitor] ❌ Error monitoring Bitcoin:', error.message);
        console.error('[BTC Monitor] ❌ Stack trace:', error.stack);
      }
    }, 60000); // Check every minute

    // Initial check
    console.log(`[BTC Monitor] Performing initial check...`);
    await this.checkForNewPayments(callback);
  }

  /**
   * Check for new payments to bridge address
   * Now persists all deposits to database and uses configurable confirmations
   */
  async checkForNewPayments(callback) {
    try {
      console.log(`[BTC Monitor] Checking for new payments to ${this.bridgeAddress}...`);
      const txs = await this.getAddressTransactions(this.bridgeAddress);
      console.log(`[BTC Monitor] Found ${txs.length} total transactions`);

      let processedCount = 0;
      let pendingCount = 0;
      let zeroAmountCount = 0;
      let confirmedCount = 0;
      let newDepositsCount = 0;

      // Get current block height to calculate confirmations
      let currentBlockHeight = null;
      try {
        const blocksUrl = `${this.explorerUrl}/blocks/tip/height`;
        const blocksResponse = await axios.get(blocksUrl, { timeout: 5000 });
        currentBlockHeight = parseInt(blocksResponse.data);
      } catch (error) {
        console.warn('[BTC Monitor] Could not fetch current block height, using confirmations from API');
      }

      for (const tx of txs) {
        // Calculate confirmations: if status.confirmed is true and we have block_height, calculate from current height
        let confirmations = tx.status?.confirmations || 0;
        if (tx.status?.confirmed && tx.status?.block_height && currentBlockHeight) {
          confirmations = currentBlockHeight - tx.status.block_height + 1;
        } else if (tx.status?.confirmed && tx.status?.block_height) {
          // If we couldn't get current height but tx is confirmed, assume it has at least 1 confirmation
          confirmations = 1;
        }
        
        const amount = this.extractAmountToAddress(tx, this.bridgeAddress);
        
        // Check if deposit exists in database (database is source of truth)
        const existingDeposit = databaseService.isConnected() 
          ? await databaseService.getBTCDeposit(tx.txid)
          : null;

        // Determine status - use database status as source of truth
        let status = 'pending';
        if (existingDeposit && existingDeposit.status === 'processed') {
          status = 'processed';
          processedCount++;
          console.log(`[BTC Monitor] TX ${tx.txid.substring(0, 16)}... already processed (from database), skipping`);
          continue;
        } else if (amount === 0) {
          zeroAmountCount++;
          status = 'pending'; // Still track zero-amount txs for completeness
        } else if (confirmations >= this.requiredConfirmations) {
          status = 'confirmed';
          confirmedCount++;
        }

        // Persist deposit to database (if not already there or needs update)
        if (databaseService.isConnected()) {
          const depositData = {
            txHash: tx.txid,
            bridgeAddress: this.bridgeAddress,
            amountSatoshis: amount,
            amountBTC: amount / 100000000,
            confirmations: confirmations,
            requiredConfirmations: this.requiredConfirmations,
            blockHeight: tx.status?.block_height || null,
            blockTime: tx.status?.block_time || null,
            status: status,
          };

          const savedDeposit = await databaseService.saveBTCDeposit(depositData);
          
          if (!existingDeposit && savedDeposit) {
            newDepositsCount++;
            console.log(`[BTC Monitor] 💾 Saved new deposit to database: ${tx.txid.substring(0, 16)}... (${amount / 100000000} BTC)`);
          } else if (existingDeposit && savedDeposit && savedDeposit.status !== existingDeposit.status) {
            console.log(`[BTC Monitor] 🔄 Updated deposit status: ${tx.txid.substring(0, 16)}... ${existingDeposit.status} → ${savedDeposit.status}`);
          }
        }

        // Log transaction status
        console.log(`[BTC Monitor] TX ${tx.txid.substring(0, 16)}... - Confirmations: ${confirmations}/${this.requiredConfirmations}, Amount: ${amount / 100000000} BTC, Status: ${status}`);

        // Process confirmed deposits (meets confirmation requirement and has amount)
        // Note: Actual processing happens via API endpoint with database locking
        // This just updates reserve tracking and triggers callback
        if (status === 'confirmed' && amount > 0) {
          // Only update reserve if not already processed (check database)
          if (!existingDeposit || existingDeposit.status !== 'processed') {
            this.currentReserve += amount;
          }

          console.log(`[BTC Monitor] ✅ BTC payment confirmed: ${amount / 100000000} BTC`);
          console.log(`[BTC Monitor] ✅ Reserve updated: ${this.currentReserve / 100000000} BTC`);
          console.log(`[BTC Monitor] ✅ TX Hash: ${tx.txid}`);
          console.log(`[BTC Monitor] ✅ Block Height: ${tx.status?.block_height || 'N/A'}`);
          console.log(`[BTC Monitor] ✅ Confirmations: ${confirmations}/${this.requiredConfirmations}`);

          // Callback to trigger processing (if callback provided)
          if (callback) {
            callback({
              txHash: tx.txid,
              amount: amount, // in satoshis
              confirmations: confirmations,
              blockHeight: tx.status?.block_height,
              timestamp: tx.status?.block_time,
            });
          }
        } else if (status === 'pending' && amount > 0) {
          pendingCount++;
          if (confirmations > 0) {
            console.log(`[BTC Monitor] ⏳ TX ${tx.txid.substring(0, 16)}... waiting for confirmations: ${confirmations}/${this.requiredConfirmations} (need ${this.requiredConfirmations - confirmations} more)`);
          } else {
            console.log(`[BTC Monitor] ⏳ TX ${tx.txid.substring(0, 16)}... not yet confirmed (in mempool)`);
          }
        }
      }

      console.log(`[BTC Monitor] Summary: ${confirmedCount} confirmed, ${pendingCount} pending, ${processedCount} already processed, ${zeroAmountCount} zero amount, ${newDepositsCount} new deposits saved`);
    } catch (error) {
      console.error('[BTC Monitor] ❌ Error checking for payments:', error.message);
      console.error('[BTC Monitor] ❌ Stack trace:', error.stack);
    }
  }

  /**
   * Get actual BTC balance from blockchain explorer
   * Used for balance reconciliation
   * @returns {Promise<Object>} Balance information
   */
  async getActualBalance() {
    try {
      if (!this.bridgeAddress) {
        return { balanceSatoshis: 0, balanceBTC: 0, error: 'Bridge address not configured' };
      }

      const url = `${this.explorerUrl}/address/${this.bridgeAddress}`;
      const response = await axios.get(url, {
        timeout: 10000,
        headers: { 'User-Agent': 'FLASH-Bridge/1.0' }
      });

      // Blockstream API returns chain_stats and mempool_stats
      const chainStats = response.data?.chain_stats || {};
      const mempoolStats = response.data?.mempool_stats || {};
      
      // Funded - spent = balance
      const funded = (chainStats.funded_txo_sum || 0) + (mempoolStats.funded_txo_sum || 0);
      const spent = (chainStats.spent_txo_sum || 0) + (mempoolStats.spent_txo_sum || 0);
      const balanceSatoshis = funded - spent;

      return {
        balanceSatoshis: Math.max(0, balanceSatoshis),
        balanceBTC: Math.max(0, balanceSatoshis) / 100000000,
        txCount: (chainStats.tx_count || 0) + (mempoolStats.tx_count || 0),
      };
    } catch (error) {
      console.error('[BTC Monitor] Error getting actual balance:', error.message);
      return { balanceSatoshis: 0, balanceBTC: 0, error: error.message };
    }
  }

  /**
   * Reconcile balance between database and actual blockchain
   * Accounts for both ingoings (deposits) and outgoings (withdrawals) for complete auditability
   * @returns {Promise<Object>} Reconciliation results
   */
  async reconcileBalance() {
    try {
      const actualBalance = await this.getActualBalance();
      
      if (!databaseService.isConnected()) {
        return {
          reconciled: false,
          reason: 'Database not connected',
          actualBalanceBTC: actualBalance.balanceBTC,
          trackedReserveBTC: this.currentReserve / 100000000,
        };
      }

      const depositStats = await databaseService.getBTCDepositStats(this.bridgeAddress);
      const withdrawalStats = await databaseService.getBTCWithdrawalStats(this.bridgeAddress);
      
      // Calculate expected balance from database
      // Formula: Bootstrap + Confirmed Deposits - Confirmed Withdrawals
      // This ensures ingoings align with outgoings for verifiability
      const expectedBalanceSatoshis = 
        this.bootstrapAmount + 
        depositStats.confirmedAmountSatoshis - 
        withdrawalStats.confirmedAmountSatoshis;
      const expectedBalanceBTC = expectedBalanceSatoshis / 100000000;

      const differenceSatoshis = actualBalance.balanceSatoshis - expectedBalanceSatoshis;
      const differenceBTC = differenceSatoshis / 100000000;
      const differencePercent = actualBalance.balanceSatoshis > 0 
        ? (differenceSatoshis / actualBalance.balanceSatoshis) * 100 
        : 0;

      // Allow small variance (1% or 1000 satoshis, whichever is larger)
      const varianceThreshold = Math.max(actualBalance.balanceSatoshis * 0.01, 1000);
      const isReconciled = Math.abs(differenceSatoshis) <= varianceThreshold;

      return {
        reconciled: isReconciled,
        actualBalanceBTC: actualBalance.balanceBTC,
        expectedBalanceBTC: expectedBalanceBTC,
        trackedReserveBTC: this.currentReserve / 100000000,
        differenceBTC: differenceBTC,
        differenceSatoshis: differenceSatoshis,
        differencePercent: differencePercent,
        varianceThresholdBTC: varianceThreshold / 100000000,
        breakdown: {
          bootstrapBTC: this.bootstrapAmount / 100000000,
          totalDepositsBTC: depositStats.confirmedAmountBTC,
          totalWithdrawalsBTC: withdrawalStats.confirmedAmountBTC,
          netBalanceBTC: (this.bootstrapAmount + depositStats.confirmedAmountSatoshis - withdrawalStats.confirmedAmountSatoshis) / 100000000,
        },
        depositStats: {
          totalDeposits: depositStats.totalDeposits,
          confirmedAmountBTC: depositStats.confirmedAmountBTC,
          processedAmountBTC: depositStats.processedAmountBTC,
          pendingCount: depositStats.pendingCount,
          confirmedCount: depositStats.confirmedCount,
          processedCount: depositStats.processedCount,
        },
        withdrawalStats: {
          totalWithdrawals: withdrawalStats.totalWithdrawals,
          confirmedAmountBTC: withdrawalStats.confirmedAmountBTC,
          pendingCount: withdrawalStats.pendingCount,
          confirmedCount: withdrawalStats.confirmedCount,
        },
      };
    } catch (error) {
      console.error('[BTC Monitor] Error reconciling balance:', error);
      return {
        reconciled: false,
        error: error.message,
      };
    }
  }

  /**
   * Get detailed information about all deposits (for manual checking)
   * Now uses database for faster queries and includes balance reconciliation
   * @returns {Promise<Object>} Detailed deposit information
   */
  async getDepositDetails() {
    try {
      if (!this.bridgeAddress) {
        return {
          error: 'Bitcoin bridge address not configured',
          bridgeAddress: null,
        };
      }

      // Try to get deposits from database first (faster)
      let deposits = [];
      let summary = {
        total: 0,
        confirmed: 0,
        pending: 0,
        alreadyProcessed: 0,
        zeroAmount: 0,
        readyToProcess: 0,
      };

      if (databaseService.isConnected()) {
        const dbDeposits = await databaseService.getBTCDeposits(this.bridgeAddress, { limit: 1000 });
        
        deposits = dbDeposits.map(deposit => ({
          txHash: deposit.tx_hash,
          confirmations: deposit.confirmations,
          requiredConfirmations: deposit.required_confirmations,
          amountBTC: parseFloat(deposit.amount_btc),
          amountSatoshis: parseInt(deposit.amount_satoshis),
          blockHeight: deposit.block_height,
          blockTime: deposit.block_time ? Math.floor(new Date(deposit.block_time).getTime() / 1000) : null,
          status: deposit.status,
          isProcessed: deposit.status === 'processed',
          isConfirmed: deposit.status === 'confirmed' || deposit.status === 'processed',
          hasAmount: deposit.amount_satoshis > 0,
          readyToProcess: deposit.status === 'confirmed' && deposit.amount_satoshis > 0 && !deposit.solana_address,
          solanaAddress: deposit.solana_address,
          solanaTxSignature: deposit.solana_tx_signature,
          outputToken: deposit.output_token,
          detectedAt: deposit.detected_at,
          confirmedAt: deposit.confirmed_at,
          processedAt: deposit.processed_at,
        }));

        // Calculate summary from database
        summary = {
          total: deposits.length,
          confirmed: deposits.filter(d => d.status === 'confirmed').length,
          pending: deposits.filter(d => d.status === 'pending').length,
          alreadyProcessed: deposits.filter(d => d.status === 'processed').length,
          zeroAmount: deposits.filter(d => d.amountSatoshis === 0).length,
          readyToProcess: deposits.filter(d => d.readyToProcess).length,
        };
      } else {
        // Fallback to explorer API if database not available
        console.log('[BTC Monitor] Database not available, using explorer API');
        const txs = await this.getAddressTransactions(this.bridgeAddress);
        
        for (const tx of txs) {
          const confirmations = tx.status?.confirmations || 0;
          const amount = this.extractAmountToAddress(tx, this.bridgeAddress);
          
          // Check database for processed status (database is source of truth)
          const existingDeposit = databaseService.isConnected()
            ? await databaseService.getBTCDeposit(tx.txid)
            : null;
          const isProcessed = existingDeposit && existingDeposit.status === 'processed';
          
          const isConfirmed = confirmations >= this.requiredConfirmations;
          const hasAmount = amount > 0;
          const readyToProcess = isConfirmed && hasAmount && !isProcessed;

          const depositInfo = {
            txHash: tx.txid,
            confirmations,
            requiredConfirmations: this.requiredConfirmations,
            amountBTC: amount / 100000000,
            amountSatoshis: amount,
            blockHeight: tx.status?.block_height || null,
            blockTime: tx.status?.block_time || null,
            status: isProcessed 
              ? 'processed' 
              : !isConfirmed 
              ? 'pending' 
              : !hasAmount 
              ? 'pending' 
              : 'confirmed',
            isProcessed,
            isConfirmed,
            hasAmount,
            readyToProcess,
          };

          deposits.push(depositInfo);

          // Update summary
          if (isProcessed) {
            summary.alreadyProcessed++;
          } else if (isConfirmed && hasAmount) {
            summary.confirmed++;
            if (readyToProcess) summary.readyToProcess++;
          } else if (isConfirmed && !hasAmount) {
            summary.zeroAmount++;
          } else {
            summary.pending++;
          }
        }
        summary.total = deposits.length;
      }

      // Sort by block time (newest first)
      deposits.sort((a, b) => (b.blockTime || 0) - (a.blockTime || 0));

      // Perform balance reconciliation
      const reconciliation = await this.reconcileBalance();

      return {
        bridgeAddress: this.bridgeAddress,
        network: this.network,
        explorerUrl: this.explorerUrl,
        requiredConfirmations: this.requiredConfirmations,
        summary,
        deposits,
        currentReserveBTC: this.currentReserve / 100000000,
        reconciliation,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[BTC Monitor] Error getting deposit details:', error);
      return {
        error: error.message,
        bridgeAddress: this.bridgeAddress,
      };
    }
  }

  /**
   * Extract detailed amount information for specific addresses
   */
  extractAmountDetails(tx, addresses) {
    if (!tx.vout) {
      console.log(`[BTC Monitor] ⚠️  TX ${tx.txid?.substring(0, 16)}... has no vout field`);
      return { totalAmount: 0, matchedAddresses: [] };
    }

    const normalizedAddresses = Array.isArray(addresses) ? addresses.filter(Boolean) : [addresses];
    const uniqueAddresses = [...new Set(normalizedAddresses)];

    const matchingOutputs = tx.vout.filter(output =>
      uniqueAddresses.includes(output.scriptpubkey_address)
    );

    const totalAmount = matchingOutputs.reduce((sum, output) => sum + output.value, 0);
    const matchedAddresses = matchingOutputs
      .map((output) => output.scriptpubkey_address)
      .filter(Boolean);

    if (matchingOutputs.length > 0) {
      console.log(
        `[BTC Monitor] Found ${matchingOutputs.length} output(s) to monitored address(es), total: ${totalAmount / 100000000} BTC`
      );
    } else {
      console.log(
        `[BTC Monitor] ⚠️  TX ${tx.txid?.substring(0, 16)}... has ${
          tx.vout.length
        } outputs but none match monitored addresses ${uniqueAddresses.join(', ')}`
      );
      const outputAddresses = tx.vout.map(v => v.scriptpubkey_address).filter(Boolean);
      if (outputAddresses.length > 0) {
        console.log(`[BTC Monitor] Output addresses: ${outputAddresses.join(', ')}`);
      }
    }

    return { totalAmount, matchedAddresses };
  }

  /**
   * Extract amount sent to specific address(es) from transaction
   */
  extractAmountToAddress(tx, address) {
    const { totalAmount } = this.extractAmountDetails(tx, address);
    return totalAmount;
  }

  /**
   * Verify Bitcoin payment
   * @param {string} txHash - Transaction hash
   * @param {number} expectedAmount - Expected amount in BTC (will be converted to satoshis)
   * @param {Object} options - Additional verification options
   * @returns {Promise<Object>} Verification result
   */
  async verifyBitcoinPayment(txHash, expectedAmount, options = {}) {
    try {
      console.log(`Verifying BTC transaction: ${txHash}, expected amount: ${expectedAmount}`);

      const {
        expectedAddress = null,
        allowedAddresses = [],
        minConfirmations = this.requiredConfirmations,
      } = options;

      const addressSet = new Set();
      if (expectedAddress) {
        addressSet.add(expectedAddress);
      }
      if (allowedAddresses && Array.isArray(allowedAddresses)) {
        allowedAddresses.filter(Boolean).forEach(addr => addressSet.add(addr));
      }
      if (addressSet.size === 0 && this.bridgeAddress) {
        addressSet.add(this.bridgeAddress);
      }

      const targetAddresses = Array.from(addressSet);

      let tx;
      try {
        tx = await this.getTransaction(txHash);
      } catch (apiError) {
        console.error(`BTC API error for ${txHash}:`, apiError.message, apiError.response?.status);
        
        // PRODUCTION MODE: No fallbacks - all transactions must be verified
        if (apiError.response?.status === 404) {
          return {
            verified: false,
            reason: 'Transaction not found on blockchain',
          };
        }
        
        // For temporary API issues, return explicit error (no auto-accept)
        if (apiError.response?.status === 503 || apiError.response?.status === 429) {
          return {
            verified: false,
            reason: `Bitcoin API temporarily unavailable (${apiError.response?.status}). Try again later.`,
            retryable: true,
          };
        }
        
        // Re-throw other errors
        throw apiError;
      }

      // Check if transaction exists
      if (!tx) {
        return {
          verified: false,
          reason: 'Transaction not found',
        };
      }

      // Check if transaction is confirmed (allow unconfirmed for demo with 0 required confirmations)
      const requiresConfirmation = minConfirmations > 0;
      if (requiresConfirmation && (!tx.status || !tx.status.block_height)) {
        return {
          verified: false,
          reason: 'Transaction not confirmed',
        };
      }

      // Calculate confirmations: if status.confirmed is true and we have block_height, calculate from current height
      let confirmations = tx.status?.confirmations || 0;
      if (tx.status?.confirmed && tx.status?.block_height) {
        try {
          const blocksUrl = `${this.explorerUrl}/blocks/tip/height`;
          const blocksResponse = await axios.get(blocksUrl, { timeout: 5000 });
          const currentBlockHeight = parseInt(blocksResponse.data);
          confirmations = currentBlockHeight - tx.status.block_height + 1;
        } catch (error) {
          // If we can't get current height but tx is confirmed, assume it has at least 1 confirmation
          confirmations = 1;
        }
      }
      
      if (confirmations < minConfirmations && minConfirmations > 0) {
        return {
          verified: false,
          reason: 'Insufficient confirmations',
          confirmations,
          required: minConfirmations,
        };
      }

      // Check if payment is to expected deposit address
      const amountDetails = this.extractAmountDetails(tx, targetAddresses);
      const amount = amountDetails.totalAmount;

      if (amount === 0) {
        return {
          verified: false,
          reason: 'Payment not to expected bridge address',
          expectedAddresses: targetAddresses,
        };
      }

      // Only check amount if expectedAmount is provided (> 0)
      // If expectedAmount is 0, we extract the actual amount from the transaction
      // This allows the btc-deposit endpoint to work with any amount
      if (expectedAmount > 0) {
        // Convert expected amount to satoshis for comparison
        const expectedSatoshis = Math.floor(expectedAmount * 100000000);

        // Allow small variance for fees (within 1%)
        // For very small amounts (like 0.0001 BTC = 10000 satoshis), use minimum variance of 100 satoshis
        // This ensures small testnet amounts work properly
        const variance = Math.max(expectedSatoshis * 0.01, 100);
        
        if (Math.abs(amount - expectedSatoshis) > variance) {
          return {
            verified: false,
            reason: 'Amount mismatch',
            expected: expectedSatoshis,
            received: amount,
          };
        }
      }

      return {
        verified: true,
        txHash,
        amount, // in satoshis
        amountBTC: amount / 100000000,
        confirmations,
        blockHeight: tx.status.block_height,
        timestamp: tx.status.block_time,
        matchedAddresses: amountDetails.matchedAddresses,
        expectedAddresses: targetAddresses,
      };
    } catch (error) {
      console.error('Error verifying Bitcoin payment:', error);
      return {
        verified: false,
        reason: error.message,
      };
    }
  }

  /**
   * Get transaction from explorer with circuit breaker protection
   * @param {string} txHash - Transaction hash
   * @returns {Promise<Object>} Transaction data
   */
  async getTransaction(txHash) {
    return await this.apiCircuitBreaker.execute(async () => {
      try {
        this.lastApiCall = Date.now();
        this.apiCallCount++;

        const url = `${this.explorerUrl}/tx/${txHash}`;
        console.log('BitcoinService.getTransaction calling URL:', url);

        const response = await axios.get(url, {
          timeout: 10000, // 10 second timeout
          headers: {
            'User-Agent': 'FLASH-Bridge/1.0'
          }
        });

        console.log('BitcoinService.getTransaction received data');
        return response.data;
      } catch (error) {
        this.apiErrorCount++;
        console.error(`Error fetching transaction ${txHash}:`, error.message);

        // Re-throw with more context
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          throw new Error(`Bitcoin API unavailable: ${error.message}`);
        } else if (error.response?.status === 429) {
          throw new Error('Bitcoin API rate limited');
        } else if (error.response?.status >= 500) {
          throw new Error(`Bitcoin API server error: ${error.response.status}`);
        } else if (error.code === 'ECONNABORTED') {
          throw new Error('Bitcoin API timeout');
        }

        throw error;
      }
    });
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    const circuitState = this.apiCircuitBreaker.getState();
    const uptime = Date.now() - this.lastApiCall;

    return {
      service: 'bitcoin',
      healthy: circuitState.state === 'CLOSED',
      circuitBreaker: circuitState,
      stats: {
        totalCalls: this.apiCallCount,
        errorCount: this.apiErrorCount,
        errorRate: this.apiCallCount > 0 ? (this.apiErrorCount / this.apiCallCount) * 100 : 0,
        lastCall: new Date(this.lastApiCall).toISOString(),
        uptime: Math.round(uptime / 1000) // seconds
      },
      network: this.network,
      bridgeAddress: this.bridgeAddress ? 'configured' : 'not configured'
    };
  }

  /**
   * Get address transactions from explorer
   * @param {string} address - Bitcoin address
   * @returns {Promise<Array>} Array of transactions
   */
  async getAddressTransactions(address) {
    try {
      const url = `${this.explorerUrl}/address/${address}/txs`;
      console.log(`[BTC Monitor] Fetching transactions from: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'FLASH-Bridge/1.0'
        }
      });
      
      const txs = response.data || [];
      console.log(`[BTC Monitor] Successfully fetched ${txs.length} transactions`);
      return txs;
    } catch (error) {
      console.error(`[BTC Monitor] ❌ Error fetching address transactions:`, error.message);
      if (error.response) {
        console.error(`[BTC Monitor] ❌ Response status: ${error.response.status}`);
        console.error(`[BTC Monitor] ❌ Response data:`, error.response.data);
      }
      if (error.code) {
        console.error(`[BTC Monitor] ❌ Error code: ${error.code}`);
      }
      return [];
    }
  }

  /**
   * Get current BTC reserve
   * @returns {number} Reserve in satoshis
   */
  getCurrentReserve() {
    return this.currentReserve;
  }

  /**
   * Get current BTC reserve in BTC
   * @returns {number} Reserve in BTC
   */
  getCurrentReserveBTC() {
    return this.currentReserve / 100000000;
  }

  /**
   * Add to reserve (called when BTC is received)
   * @param {number} amount - Amount in satoshis
   */
  addToReserve(amount) {
    this.currentReserve += amount;
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('Bitcoin monitoring stopped');
    }
  }

  /**
   * Get bridge address
   * @returns {string} Bitcoin bridge address
   */
  getBridgeAddress() {
    return this.bridgeAddress;
  }

  /**
   * Validate Bitcoin address format
   * @param {string} address - Bitcoin address
   * @returns {boolean} Whether address is valid
   */
  isValidAddress(address) {
    if (!address || typeof address !== 'string') {
      return false;
    }

    // Bitcoin address formats:
    // - Legacy (P2PKH): starts with '1'
    // - P2SH: starts with '3'
    // - Bech32 (Native SegWit): starts with 'bc1' (mainnet) or 'tb1' (testnet)
    // - Taproot: starts with 'bc1p' (mainnet) or 'tb1p' (testnet)
    
    const validPrefixes = this.network === 'mainnet' 
      ? ['1', '3', 'bc1']
      : ['m', 'n', '2', 'tb1'];
    
    // Check for valid prefix
    const hasValidPrefix = validPrefixes.some(prefix => address.startsWith(prefix));
    
    // Basic length check (Bitcoin addresses are typically 26-62 characters)
    const validLength = address.length >= 26 && address.length <= 62;
    
    return hasValidPrefix && validLength;
  }

  /**
   * Send BTC to an address
   * @param {string} toAddress - Bitcoin address
   * @param {number} amount - Amount in BTC
   * @returns {Promise<string>} Transaction hash
   */
  async sendBTC(toAddress, amount) {
    // For MVP, this is a placeholder
    // In production, this would:
    // 1. Use Bitcoin wallet/API to create transaction
    // 2. Sign and broadcast transaction
    // 3. Return transaction hash
    
    if (!this.isValidAddress(toAddress)) {
      throw new Error(`Invalid Bitcoin address: ${toAddress}`);
    }

    console.log(`Sending ${amount} BTC to ${toAddress}...`);
    
    // Mock implementation for MVP
    // In production, integrate with Bitcoin wallet (bitcoinjs-lib, etc.)
    const mockTxHash = `btc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    console.log(`Mock BTC transaction: ${mockTxHash}`);
    console.warn('BTC sending not fully implemented - this is a mock transaction for MVP');
    
    // Update reserve (subtract sent amount)
    this.currentReserve -= Math.floor(amount * 100000000); // Convert to satoshis
    
    return mockTxHash;
  }

  /**
   * Get network info
   * @returns {Object} Network information
   */
  getNetworkInfo() {
    return {
      network: this.network,
      bridgeAddress: this.bridgeAddress,
      explorerUrl: this.explorerUrl,
      currentReserve: this.currentReserve,
      currentReserveBTC: this.getCurrentReserveBTC(),
      bootstrapAmount: this.bootstrapAmount,
    };
  }
}

module.exports = new BitcoinService();


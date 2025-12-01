const { Pool } = require('pg');
require('dotenv').config();

/**
 * Database Service
 * Handles all database operations for transaction persistence
 */
class DatabaseService {
  constructor() {
    // Ensure password is always a string
    const dbPassword = process.env.DB_PASSWORD;
    const passwordString = dbPassword !== undefined && dbPassword !== null 
      ? String(dbPassword) 
      : '';
    
    // Initialize connection pool with configurable settings
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'flash_bridge',
      user: process.env.DB_USER || 'postgres',
      password: passwordString,
      max: parseInt(process.env.DB_POOL_MAX || '20', 10), // Configurable pool size
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),   // Minimum pool size
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10), // Increased timeout
      acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000', 10),
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    this.connected = false;

    // Health monitoring and reconnection
    this.healthCheckInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.healthCheckIntervalMs = 30000; // 30 seconds

    // Start health monitoring
    this.startHealthMonitoring();

    // Start transaction cleanup
    this.startTransactionCleanup();
  }

  /**
   * Initialize database connection with retry logic
   * @param {number} maxRetries - Maximum retry attempts
   * @param {number} retryDelay - Delay between retries in ms
   */
  async initialize(maxRetries = 3, retryDelay = 2000) {
    // Check if database is configured - if not, skip initialization
    const hasDbConfig = process.env.DB_HOST || process.env.DB_NAME || process.env.DB_USER;
    
    if (!hasDbConfig) {
      console.log('ℹ️  Database not configured - running without database (transactions will not be persisted)');
      this.connected = false;
      return false;
    }
    
    // Check for password issues
    const dbPassword = process.env.DB_PASSWORD;
    if (dbPassword === undefined || dbPassword === null) {
      console.log('ℹ️  Database password not set - skipping database connection');
      console.log('   Set DB_PASSWORD in .env to enable database features');
      this.connected = false;
      return false;
    }
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Test connection with timeout
        const client = await Promise.race([
          this.pool.connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), 5000)
          )
        ]);
        
        await client.query('SELECT NOW()');
        client.release();
        this.connected = true;
        console.log('✓ Database connected successfully');
        return true;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries - 1;
        
        if (isLastAttempt) {
          // Don't treat as error if password is the issue - just skip database
          if (error.message && error.message.includes('password')) {
            console.log('ℹ️  Database password issue - running without database');
            console.log('   Set DB_PASSWORD in .env to enable database features');
          } else {
            console.error(`Failed to connect to database after ${maxRetries} attempts:`, error.message);
          }
          this.connected = false;
          return false;
        }
        
        // Only log warnings for non-password errors
        if (!error.message || !error.message.includes('password')) {
          console.warn(`Database connection attempt ${attempt + 1}/${maxRetries} failed: ${error.message}`);
          console.warn(`Retrying in ${retryDelay}ms...`);
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    this.connected = false;
    return false;
  }

  /**
   * Save bridge transaction
   * @param {Object} transaction - Transaction data
   * @returns {Promise<Object>} Saved transaction
   */
  async saveBridgeTransaction(transaction) {
    const {
      txId,
      solanaAddress,
      amount,
      reserveAsset,
      status = 'pending',
      solanaTxSignature,
      bitcoinTxHash,
      zcashTxHash,
      demoMode = false,
      outputToken,
    } = transaction;

    const query = `
      INSERT INTO bridge_transactions (
        tx_id, solana_address, amount, reserve_asset, status,
        solana_tx_signature, bitcoin_tx_hash, zcash_tx_hash, demo_mode, output_token
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (tx_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        solana_tx_signature = COALESCE(EXCLUDED.solana_tx_signature, bridge_transactions.solana_tx_signature),
        output_token = COALESCE(EXCLUDED.output_token, bridge_transactions.output_token),
        updated_at = NOW()
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [
        txId,
        solanaAddress,
        amount,
        reserveAsset,
        status,
        solanaTxSignature || null,
        bitcoinTxHash || null,
        zcashTxHash || null,
        demoMode,
        outputToken || null,
      ]);

      // Log status change
      if (result.rows[0]) {
        await this.logStatusChange(txId, 'bridge', status);
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error saving bridge transaction:', error);
      throw error;
    }
  }

  /**
   * Save swap transaction
   * @param {Object} transaction - Swap transaction data
   * @returns {Promise<Object>} Saved transaction
   */
  async saveSwapTransaction(transaction) {
    const {
      txId,
      solanaAddress,
      solAmount,
      zenZECAmount,
      solanaTxSignature,
      direction,
      status = 'pending',
      encrypted = false,
      demoMode = false,
    } = transaction;

    const query = `
      INSERT INTO swap_transactions (
        tx_id, solana_address, sol_amount, zenzec_amount,
        solana_tx_signature, direction, status, encrypted, demo_mode
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (tx_id) 
      DO UPDATE SET
        status = EXCLUDED.status,
        solana_tx_signature = COALESCE(EXCLUDED.solana_tx_signature, swap_transactions.solana_tx_signature),
        updated_at = NOW()
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [
        txId,
        solanaAddress,
        solAmount || null,
        zenZECAmount || null,
        solanaTxSignature || null,
        direction,
        status,
        encrypted,
        demoMode,
      ]);

      // Log status change
      if (result.rows[0]) {
        await this.logStatusChange(txId, 'swap', status);
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error saving swap transaction:', error);
      throw error;
    }
  }

  /**
   * Save burn transaction
   * @param {Object} transaction - Burn transaction data
   * @returns {Promise<Object>} Saved transaction
   */
  async saveBurnTransaction(transaction) {
    const {
      txId,
      solanaAddress,
      amount,
      targetAsset,
      targetAddress,
      solanaTxSignature,
      btcTxHash,
      solTxSignature,
      status = 'pending',
      encrypted = false,
    } = transaction;

    const query = `
      INSERT INTO burn_transactions (
        tx_id, solana_address, amount, target_asset, target_address,
        solana_tx_signature, btc_tx_hash, sol_tx_signature, status, encrypted
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (tx_id) 
      DO UPDATE SET
        status = EXCLUDED.status,
        solana_tx_signature = COALESCE(EXCLUDED.solana_tx_signature, burn_transactions.solana_tx_signature),
        btc_tx_hash = COALESCE(EXCLUDED.btc_tx_hash, burn_transactions.btc_tx_hash),
        sol_tx_signature = COALESCE(EXCLUDED.sol_tx_signature, burn_transactions.sol_tx_signature),
        updated_at = NOW()
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [
        txId,
        solanaAddress,
        amount,
        targetAsset,
        targetAddress || null,
        solanaTxSignature || null,
        btcTxHash || null,
        solTxSignature || null,
        status,
        encrypted,
      ]);

      // Log status change
      if (result.rows[0]) {
        await this.logStatusChange(txId, 'burn', status);
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error saving burn transaction:', error);
      throw error;
    }
  }

  /**
   * Check if event has been processed
   * @param {string} eventSignature - Event signature
   * @returns {Promise<boolean>} Whether event was processed
   */
  async isEventProcessed(eventSignature) {
    const query = 'SELECT id FROM processed_events WHERE event_signature = $1';
    
    try {
      const result = await this.pool.query(query, [eventSignature]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking processed event:', error);
      return false; // On error, assume not processed to allow retry
    }
  }

  /**
   * Check if event is processed with lock (for transaction context)
   * @param {string} eventSignature - Event signature
   * @param {Object} client - Database client (for transaction)
   * @returns {Promise<Object|null>} Event record or null
   */
  async getEventWithLock(eventSignature, client = null) {
    if (!this.isConnected()) {
      return null;
    }

    const query = 'SELECT * FROM processed_events WHERE event_signature = $1 FOR UPDATE';
    const queryClient = client || this.pool;
    
    try {
      const result = await queryClient.query(query, [eventSignature]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting event with lock:', error);
      throw error;
    }
  }

  /**
   * Mark event as processed
   * @param {Object} event - Event data
   * @param {Object} client - Database client (for transaction)
   * @returns {Promise<Object>} Saved event record
   */
  async markEventProcessed(event, client = null) {
    const {
      eventSignature,
      eventType,
      solanaAddress,
      amount,
    } = event;

    const query = `
      INSERT INTO processed_events (event_signature, event_type, solana_address, amount)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (event_signature) DO NOTHING
      RETURNING *
    `;

    const queryClient = client || this.pool;

    try {
      const result = await queryClient.query(query, [
        eventSignature,
        eventType,
        solanaAddress || null,
        amount || null,
      ]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error marking event as processed:', error);
      throw error;
    }
  }

  /**
   * Get bridge transaction by ID
   * @param {string} txId - Transaction ID
   * @returns {Promise<Object|null>} Transaction data
   */
  async getBridgeTransaction(txId) {
    const query = 'SELECT * FROM bridge_transactions WHERE tx_id = $1';
    
    try {
      const result = await this.pool.query(query, [txId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting bridge transaction:', error);
      throw error;
    }
  }

  /**
   * Get swap transaction by ID
   * @param {string} txId - Transaction ID
   * @returns {Promise<Object|null>} Transaction data
   */
  async getSwapTransaction(txId) {
    const query = 'SELECT * FROM swap_transactions WHERE tx_id = $1';
    
    try {
      const result = await this.pool.query(query, [txId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting swap transaction:', error);
      throw error;
    }
  }

  /**
   * Get burn transaction by ID
   * @param {string} txId - Transaction ID
   * @returns {Promise<Object|null>} Transaction data
   */
  async getBurnTransaction(txId) {
    const query = 'SELECT * FROM burn_transactions WHERE tx_id = $1';
    
    try {
      const result = await this.pool.query(query, [txId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting burn transaction:', error);
      throw error;
    }
  }

  /**
   * Get transactions by Solana address
   * @param {string} solanaAddress - Solana address
   * @param {Object} options - Query options (limit, offset, type)
   * @returns {Promise<Object>} Transactions grouped by type
   */
  async getTransactionsByAddress(solanaAddress, options = {}) {
    const { limit = 50, offset = 0, type } = options;
    
    const results = {
      bridge: [],
      swap: [],
      burn: [],
    };

    try {
      if (!type || type === 'bridge') {
        const bridgeQuery = `
          SELECT * FROM bridge_transactions 
          WHERE solana_address = $1 
          ORDER BY created_at DESC 
          LIMIT $2 OFFSET $3
        `;
        const bridgeResult = await this.pool.query(bridgeQuery, [solanaAddress, limit, offset]);
        results.bridge = bridgeResult.rows;
      }

      if (!type || type === 'swap') {
        const swapQuery = `
          SELECT * FROM swap_transactions 
          WHERE solana_address = $1 
          ORDER BY created_at DESC 
          LIMIT $2 OFFSET $3
        `;
        const swapResult = await this.pool.query(swapQuery, [solanaAddress, limit, offset]);
        results.swap = swapResult.rows;
      }

      if (!type || type === 'burn') {
        const burnQuery = `
          SELECT * FROM burn_transactions 
          WHERE solana_address = $1 
          ORDER BY created_at DESC 
          LIMIT $2 OFFSET $3
        `;
        const burnResult = await this.pool.query(burnQuery, [solanaAddress, limit, offset]);
        results.burn = burnResult.rows;
      }

      return results;
    } catch (error) {
      console.error('Error getting transactions by address:', error);
      throw error;
    }
  }

  /**
   * Validate status transition
   * @param {string} currentStatus - Current status
   * @param {string} newStatus - New status
   * @returns {boolean} Whether transition is valid
   */
  isValidStatusTransition(currentStatus, newStatus) {
    // Can always transition to 'failed' from any state
    if (newStatus === 'failed') {
      return true;
    }

    // Can't transition backwards
    if (currentStatus === 'processed' && newStatus !== 'failed') {
      return false;
    }

    if (currentStatus === 'confirmed' && (newStatus === 'pending' || newStatus === 'processing')) {
      return false;
    }

    if (currentStatus === 'processing' && newStatus === 'pending') {
      return false;
    }

    // Valid forward transitions
    const validTransitions = {
      'pending': ['confirmed', 'processing', 'failed'],
      'processing': ['processed', 'failed'],
      'confirmed': ['processed', 'failed'],
      'processed': ['failed'], // Can only fail from processed (for retry scenarios)
      'failed': ['pending', 'processing'], // Can retry from failed
    };

    const allowed = validTransitions[currentStatus] || [];
    return allowed.includes(newStatus);
  }

  /**
   * Get valid transitions from a status
   * @param {string} status - Current status
   * @returns {Array<string>} Valid next statuses
   */
  getValidTransitions(status) {
    const validTransitions = {
      'pending': ['confirmed', 'processing', 'failed'],
      'processing': ['processed', 'failed'],
      'confirmed': ['processed', 'failed'],
      'processed': ['failed'],
      'failed': ['pending', 'processing'],
    };
    return validTransitions[status] || [];
  }

  /**
   * Update transaction status
   * @param {string} txId - Transaction ID
   * @param {string} type - Transaction type ('bridge', 'swap', 'burn')
   * @param {string} status - New status
   * @param {Object} updates - Additional fields to update
   * @returns {Promise<Object>} Updated transaction
   */
  async updateTransactionStatus(txId, type, status, updates = {}) {
    // First, get current transaction to validate transition
    let currentTx = null;
    try {
      if (type === 'bridge') {
        currentTx = await this.getBridgeTransaction(txId);
      } else if (type === 'swap') {
        currentTx = await this.getSwapTransaction(txId);
      } else if (type === 'burn') {
        currentTx = await this.getBurnTransaction(txId);
      }

      if (!currentTx) {
        return null;
      }

      // Validate status transition
      const currentStatus = currentTx.status;
      if (!this.isValidStatusTransition(currentStatus, status)) {
        throw new Error(
          `Invalid status transition: ${currentStatus} → ${status}. ` +
          `Valid transitions from ${currentStatus}: ${this.getValidTransitions(currentStatus).join(', ')}`
        );
      }
    } catch (error) {
      if (error.message.includes('Invalid status transition')) {
        throw error;
      }
      // If error getting transaction, continue (might be new transaction)
    }

    let query;
    const params = [status, txId];
    let paramIndex = 3;

    // Build dynamic update query based on type
    if (type === 'bridge') {
      const updateFields = [];
      if (updates.solanaTxSignature) {
        updateFields.push(`solana_tx_signature = $${paramIndex++}`);
        params.push(updates.solanaTxSignature);
      }
      const setClause = updateFields.length > 0 
        ? `status = $1, ${updateFields.join(', ')}`
        : 'status = $1';
      
      query = `UPDATE bridge_transactions SET ${setClause} WHERE tx_id = $2 RETURNING *`;
    } else if (type === 'swap') {
      const updateFields = [];
      if (updates.solanaTxSignature) {
        updateFields.push(`solana_tx_signature = $${paramIndex++}`);
        params.push(updates.solanaTxSignature);
      }
      const setClause = updateFields.length > 0 
        ? `status = $1, ${updateFields.join(', ')}`
        : 'status = $1';
      
      query = `UPDATE swap_transactions SET ${setClause} WHERE tx_id = $2 RETURNING *`;
    } else if (type === 'burn') {
      const updateFields = [];
      if (updates.solanaTxSignature) {
        updateFields.push(`solana_tx_signature = $${paramIndex++}`);
        params.push(updates.solanaTxSignature);
      }
      if (updates.btcTxHash) {
        updateFields.push(`btc_tx_hash = $${paramIndex++}`);
        params.push(updates.btcTxHash);
      }
      if (updates.solTxSignature) {
        updateFields.push(`sol_tx_signature = $${paramIndex++}`);
        params.push(updates.solTxSignature);
      }
      const setClause = updateFields.length > 0 
        ? `status = $1, ${updateFields.join(', ')}`
        : 'status = $1';
      
      query = `UPDATE burn_transactions SET ${setClause} WHERE tx_id = $2 RETURNING *`;
    } else {
      throw new Error(`Unknown transaction type: ${type}`);
    }

    try {
      const result = await this.pool.query(query, params);
      
      if (result.rows[0]) {
        await this.logStatusChange(txId, type, status);
      }
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating transaction status:', error);
      throw error;
    }
  }

  /**
   * Log status change for audit trail
   * @param {string} txId - Transaction ID
   * @param {string} type - Transaction type
   * @param {string} status - New status
   * @param {string} previousStatus - Previous status
   * @param {string} notes - Optional notes
   */
  async logStatusChange(txId, type, status, previousStatus = null, notes = null) {
    const query = `
      INSERT INTO transaction_status_history 
      (transaction_id, transaction_type, status, previous_status, notes)
      VALUES ($1, $2, $3, $4, $5)
    `;

    try {
      await this.pool.query(query, [txId, type, status, previousStatus, notes]);
    } catch (error) {
      console.error('Error logging status change:', error);
      // Don't throw - this is non-critical
    }
  }

  /**
   * Retrieve chronological status history for a transaction
   * @param {string} txId - Transaction ID
   * @param {string|null} type - Optional transaction type filter
   * @returns {Promise<Array>} Ordered status entries
   */
  async getTransactionStatusHistory(txId, type = null) {
    if (!this.isConnected()) {
      return [];
    }

    if (!txId) {
      throw new Error('Transaction ID is required to fetch status history');
    }

    let query = `
      SELECT transaction_id, transaction_type, status, previous_status, notes, created_at
      FROM transaction_status_history
      WHERE transaction_id = $1
    `;
    const params = [txId];

    if (type) {
      query += ' AND transaction_type = $2';
      params.push(type);
    }

    query += ' ORDER BY created_at ASC';

    try {
      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error fetching transaction status history:', error);
      throw error;
    }
  }

  /**
   * Get database statistics
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    try {
      const [bridgeStats, swapStats, burnStats] = await Promise.all([
        this.pool.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
            COUNT(*) FILTER (WHERE status = 'pending') as pending,
            COUNT(*) FILTER (WHERE status = 'failed') as failed,
            SUM(amount) as total_amount
          FROM bridge_transactions
        `),
        this.pool.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
            COUNT(*) FILTER (WHERE status = 'pending') as pending,
            COUNT(*) FILTER (WHERE status = 'failed') as failed
          FROM swap_transactions
        `),
        this.pool.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
            COUNT(*) FILTER (WHERE status = 'pending') as pending,
            COUNT(*) FILTER (WHERE status = 'failed') as failed
          FROM burn_transactions
        `),
      ]);

      return {
        bridge: bridgeStats.rows[0],
        swap: swapStats.rows[0],
        burn: burnStats.rows[0],
      };
    } catch (error) {
      console.error('Error getting statistics:', error);
      throw error;
    }
  }

  /**
   * Save cryptographic proof to database
   */
  async saveCryptographicProof({ transactionId, transactionType, proof }) {
    if (!this.isConnected()) {
      throw new Error('Database not connected');
    }

    // Input validation
    if (!transactionId || typeof transactionId !== 'string') {
      throw new Error('Invalid transactionId: must be a non-empty string');
    }

    if (!['bridge', 'swap', 'burn'].includes(transactionType)) {
      throw new Error('Invalid transactionType: must be bridge, swap, or burn');
    }

    if (!proof || typeof proof !== 'object') {
      throw new Error('Invalid proof: must be an object');
    }

    if (!proof.transactionHash || !proof.signature || !proof.merkleProof || !proof.chainOfCustody) {
      throw new Error('Invalid proof: missing required fields');
    }

    const expiresAt = new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)); // 1 year expiry

    const query = `
      INSERT INTO cryptographic_proofs
      (transaction_id, transaction_type, proof_version, transaction_hash, signature, merkle_proof, zk_proof, chain_of_custody, metadata, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (transaction_id, transaction_type)
      DO UPDATE SET
        transaction_hash = EXCLUDED.transaction_hash,
        signature = EXCLUDED.signature,
        merkle_proof = EXCLUDED.merkle_proof,
        zk_proof = EXCLUDED.zk_proof,
        chain_of_custody = EXCLUDED.chain_of_custody,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `;

    const values = [
      transactionId,
      transactionType,
      proof.version || '1.0.0',
      proof.transactionHash,
      JSON.stringify(proof.signature),
      JSON.stringify(proof.merkleProof),
      proof.zkProof ? JSON.stringify(proof.zkProof) : null,
      JSON.stringify(proof.chainOfCustody),
      JSON.stringify(proof.metadata || {}),
      expiresAt
    ];

    try {
      await this.queryWithRetry(query, values);
    } catch (error) {
      console.error('Database error saving cryptographic proof:', error);
      throw new Error(`Failed to save cryptographic proof: ${error.message}`);
    }
  }

  /**
   * Get cryptographic proof from database
   */
  async getCryptographicProof(transactionId, transactionType) {
    if (!this.isConnected()) {
      throw new Error('Database not connected');
    }

    // Input validation
    if (!transactionId || typeof transactionId !== 'string') {
      throw new Error('Invalid transactionId: must be a non-empty string');
    }

    if (!['bridge', 'swap', 'burn'].includes(transactionType)) {
      throw new Error('Invalid transactionType: must be bridge, swap, or burn');
    }

    const query = `
      SELECT * FROM cryptographic_proofs
      WHERE transaction_id = $1 AND transaction_type = $2
      AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC LIMIT 1
    `;

    try {
      const result = await this.queryWithRetry(query, [transactionId, transactionType]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      // Parse JSON fields with error handling
      let signature, merkleProof, zkProof, chainOfCustody, metadata;

      try {
        signature = JSON.parse(row.signature);
        merkleProof = JSON.parse(row.merkle_proof);
        zkProof = row.zk_proof ? JSON.parse(row.zk_proof) : null;
        chainOfCustody = JSON.parse(row.chain_of_custody);
        metadata = JSON.parse(row.metadata);
      } catch (parseError) {
        console.error('Error parsing JSON fields from database:', parseError);
        throw new Error('Corrupted proof data in database');
      }

      return {
        ...row,
        signature,
        merkleProof,
        zkProof,
        chainOfCustody,
        metadata
      };
    } catch (error) {
      console.error('Database error retrieving cryptographic proof:', error);
      throw new Error(`Failed to retrieve cryptographic proof: ${error.message}`);
    }
  }

  /**
   * Log proof verification attempt
   */
  async logProofVerification({ transactionId, verifierAddress, verificationResult, verificationReason, ipAddress, userAgent }) {
    if (!this.isConnected()) {
      return; // Don't throw error for logging failures
    }

    // Input validation
    if (!transactionId || typeof transactionId !== 'string') {
      console.warn('Invalid transactionId for verification logging, skipping');
      return;
    }

    if (typeof verificationResult !== 'boolean') {
      console.warn('Invalid verificationResult for verification logging, skipping');
      return;
    }

    const query = `
      INSERT INTO proof_verifications
      (transaction_id, verifier_address, verification_result, verification_reason, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    const values = [
      transactionId,
      verifierAddress || null,
      verificationResult,
      verificationReason || null,
      ipAddress || null,
      userAgent || null
    ];

    try {
      await this.pool.query(query, values);
    } catch (error) {
      console.warn('Failed to log proof verification:', error.message);
    }
  }

  /**
   * Close database connection pool
   */
  async close() {
    await this.pool.end();
    this.connected = false;
    console.log('Database connection pool closed');
  }

  /**
   * Start database health monitoring
   */
  startHealthMonitoring() {
    // Skip health monitoring if database is not configured
    const hasDbConfig = process.env.DB_HOST || process.env.DB_NAME || process.env.DB_USER;
    if (!hasDbConfig || !process.env.DB_PASSWORD) {
      console.log('ℹ️  Database health monitoring disabled (database not configured)');
      return;
    }
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error) {
        // Don't spam logs for password errors - database is optional
        if (error.message && error.message.includes('password')) {
          // Stop trying if it's a password issue
          if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
            console.log('ℹ️  Database health monitoring stopped (password configuration issue)');
          }
          return;
        }
        
        console.warn('Database health check failed:', error.message);

        // Attempt reconnection if disconnected (but not for password errors)
        if (!this.connected && this.reconnectAttempts < this.maxReconnectAttempts) {
          console.log('🔄 Attempting database reconnection...');
          this.reconnectAttempts++;

          try {
            const reconnected = await this.initialize(1, 1000);
            if (reconnected) {
              console.log('✅ Database reconnected successfully');
              this.reconnectAttempts = 0;
            } else {
              // Stop retrying if password is the issue
              if (error.message && error.message.includes('password')) {
                if (this.healthCheckInterval) {
                  clearInterval(this.healthCheckInterval);
                  this.healthCheckInterval = null;
                }
              }
            }
          } catch (reconnectError) {
            // Stop retrying if password is the issue
            if (reconnectError.message && reconnectError.message.includes('password')) {
              if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = null;
                console.log('ℹ️  Database reconnection stopped (password configuration issue)');
              }
            } else {
              console.warn(`Database reconnection attempt ${this.reconnectAttempts} failed:`, reconnectError.message);
            }
          }
        }
      }
    }, this.healthCheckIntervalMs);
  }

  /**
   * Perform database health check
   */
  async healthCheck() {
    if (!this.pool) {
      this.connected = false;
      return;
    }

    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      if (!this.connected) {
        console.log('✅ Database connection restored');
        this.connected = true;
      }
    } catch (error) {
      if (this.connected) {
        console.warn('❌ Database connection lost:', error.message);
        this.connected = false;
      }
      throw error;
    }
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Enhanced query method with connection resilience
   */
  async queryWithRetry(sql, params = [], maxRetries = 2) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (!this.connected && attempt > 0) {
          // Wait a bit for potential reconnection
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return await this.pool.query(sql, params);
      } catch (error) {
        lastError = error;

        // Check if it's a connection error that might be recoverable
        if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED' ||
            error.code === '57P01' || error.message.includes('connection')) {

          console.warn(`Database query failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);

          if (attempt < maxRetries) {
            // Mark as disconnected and wait before retry
            this.connected = false;
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
        }

        // For non-connection errors, don't retry
        break;
      }
    }

    throw lastError;
  }

  /**
   * Save or update BTC deposit
   * @param {Object} deposit - BTC deposit data
   * @returns {Promise<Object>} Saved deposit
   */
  async saveBTCDeposit(deposit) {
    if (!this.isConnected()) {
      return null; // Silently fail if DB not connected
    }

    const {
      txHash,
      bridgeAddress,
      amountSatoshis,
      amountBTC,
      confirmations = 0,
      requiredConfirmations = 1,
      blockHeight,
      blockTime,
      status = 'pending',
      solanaAddress,
      solanaTxSignature,
      outputToken,
    } = deposit;

    const query = `
      INSERT INTO btc_deposits (
        tx_hash, bridge_address, amount_satoshis, amount_btc,
        confirmations, required_confirmations, block_height, block_time,
        status, solana_address, solana_tx_signature, output_token,
        confirmed_at, processed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (tx_hash)
      DO UPDATE SET
        confirmations = EXCLUDED.confirmations,
        block_height = COALESCE(EXCLUDED.block_height, btc_deposits.block_height),
        block_time = COALESCE(EXCLUDED.block_time, btc_deposits.block_time),
        status = CASE 
          WHEN EXCLUDED.status = 'confirmed' AND btc_deposits.status = 'pending' THEN 'confirmed'
          WHEN EXCLUDED.status = 'processed' THEN 'processed'
          ELSE btc_deposits.status
        END,
        confirmed_at = CASE 
          WHEN EXCLUDED.status = 'confirmed' AND btc_deposits.confirmed_at IS NULL 
          THEN NOW() 
          ELSE btc_deposits.confirmed_at 
        END,
        processed_at = CASE 
          WHEN EXCLUDED.status = 'processed' AND btc_deposits.processed_at IS NULL 
          THEN NOW() 
          ELSE btc_deposits.processed_at 
        END,
        solana_address = COALESCE(EXCLUDED.solana_address, btc_deposits.solana_address),
        solana_tx_signature = COALESCE(EXCLUDED.solana_tx_signature, btc_deposits.solana_tx_signature),
        output_token = COALESCE(EXCLUDED.output_token, btc_deposits.output_token),
        updated_at = NOW()
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [
        txHash,
        bridgeAddress,
        amountSatoshis,
        amountBTC,
        confirmations,
        requiredConfirmations,
        blockHeight || null,
        blockTime ? new Date(blockTime * 1000) : null,
        status,
        solanaAddress || null,
        solanaTxSignature || null,
        outputToken || null,
        status === 'confirmed' ? new Date() : null,
        status === 'processed' ? new Date() : null,
      ]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error saving BTC deposit:', error);
      return null; // Don't throw - allow system to continue without DB
    }
  }

  /**
   * Get BTC deposit by transaction hash
   * @param {string} txHash - Transaction hash
   * @returns {Promise<Object|null>} Deposit data
   */
  async getBTCDeposit(txHash) {
    if (!this.isConnected()) {
      return null;
    }

    const query = 'SELECT * FROM btc_deposits WHERE tx_hash = $1';
    
    try {
      const result = await this.pool.query(query, [txHash]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting BTC deposit:', error);
      return null;
    }
  }

  /**
   * Get BTC deposit with row-level lock for processing
   * Uses SELECT FOR UPDATE to prevent concurrent processing
   * @param {string} txHash - Transaction hash
   * @param {Object} client - Database client (for transaction)
   * @returns {Promise<Object|null>} Deposit data or null
   */
  async getBTCDepositWithLock(txHash, client = null) {
    if (!this.isConnected()) {
      return null;
    }

    const query = 'SELECT * FROM btc_deposits WHERE tx_hash = $1 FOR UPDATE';
    const queryClient = client || this.pool;
    
    try {
      const result = await queryClient.query(query, [txHash]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting BTC deposit with lock:', error);
      throw error;
    }
  }

  /**
   * Mark BTC deposit as processing (with lock)
   * Used to atomically check and mark deposit as being processed
   * @param {string} txHash - Transaction hash
   * @param {string} userSolanaAddress - User's Solana address
   * @param {Object} client - Database client (for transaction)
   * @returns {Promise<Object|null>} Updated deposit or null if already processed
   */
  async markBTCDepositProcessing(txHash, userSolanaAddress, client = null) {
    if (!this.isConnected()) {
      return null;
    }

    const query = `
      UPDATE btc_deposits 
      SET status = 'processing',
          solana_address = $1,
          updated_at = NOW()
      WHERE tx_hash = $2
        AND status IN ('pending', 'confirmed')
        AND status != 'processed'
        AND status != 'processing'
      RETURNING *
    `;
    const queryClient = client || this.pool;
    
    try {
      const result = await queryClient.query(query, [userSolanaAddress, txHash]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error marking BTC deposit as processing:', error);
      throw error;
    }
  }

  /**
   * Get all BTC deposits for a bridge address
   * @param {string} bridgeAddress - Bridge address
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Deposits
   */
  async getBTCDeposits(bridgeAddress, options = {}) {
    if (!this.isConnected()) {
      return [];
    }

    const { status, limit = 100, offset = 0 } = options;
    
    let query = 'SELECT * FROM btc_deposits WHERE bridge_address = $1';
    const params = [bridgeAddress];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    query += ' ORDER BY detected_at DESC LIMIT $' + paramIndex++ + ' OFFSET $' + paramIndex;
    params.push(limit, offset);

    try {
      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting BTC deposits:', error);
      return [];
    }
  }

  /**
   * Get BTC deposits ready to process (confirmed but not processed)
   * @param {string} bridgeAddress - Bridge address
   * @returns {Promise<Array>} Ready deposits
   */
  async getReadyBTCDeposits(bridgeAddress) {
    if (!this.isConnected()) {
      return [];
    }

    const query = `
      SELECT * FROM btc_deposits 
      WHERE bridge_address = $1 
        AND status = 'confirmed'
        AND confirmations >= required_confirmations
        AND solana_address IS NULL
      ORDER BY confirmed_at ASC
    `;

    try {
      const result = await this.pool.query(query, [bridgeAddress]);
      return result.rows;
    } catch (error) {
      console.error('Error getting ready BTC deposits:', error);
      return [];
    }
  }

  /**
   * Update BTC deposit status
   * @param {string} txHash - Transaction hash
   * @param {string} status - New status
   * @param {Object} updates - Additional fields to update
   * @returns {Promise<Object|null>} Updated deposit
   */
  async updateBTCDepositStatus(txHash, status, updates = {}, client = null) {
    if (!this.isConnected()) {
      return null;
    }

    const updateFields = ['status = $1'];
    const params = [status, txHash];
    let paramIndex = 3;
    const queryClient = client || this.pool;

    if (updates.confirmations !== undefined) {
      updateFields.push(`confirmations = $${paramIndex++}`);
      params.push(updates.confirmations);
    }

    if (updates.blockHeight !== undefined) {
      updateFields.push(`block_height = $${paramIndex++}`);
      params.push(updates.blockHeight);
    }

    if (updates.blockTime !== undefined) {
      updateFields.push(`block_time = $${paramIndex++}`);
      params.push(new Date(updates.blockTime * 1000));
    }

    if (updates.solanaAddress) {
      updateFields.push(`solana_address = $${paramIndex++}`);
      params.push(updates.solanaAddress);
    }

    if (updates.solanaTxSignature) {
      updateFields.push(`solana_tx_signature = $${paramIndex++}`);
      params.push(updates.solanaTxSignature);
    }

    if (updates.outputToken) {
      updateFields.push(`output_token = $${paramIndex++}`);
      params.push(updates.outputToken);
    }

    if (status === 'confirmed' && !updates.skipConfirmedAt) {
      updateFields.push(`confirmed_at = COALESCE(confirmed_at, NOW())`);
    }

    if (status === 'processed') {
      updateFields.push(`processed_at = COALESCE(processed_at, NOW())`);
    }

    const query = `
      UPDATE btc_deposits 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE tx_hash = $2
      RETURNING *
    `;

    try {
      const result = await queryClient.query(query, params);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating BTC deposit status:', error);
      throw error; // Throw instead of returning null for transaction safety
    }
  }

  /**
   * Get BTC deposit statistics for balance reconciliation
   * @param {string} bridgeAddress - Bridge address
   * @returns {Promise<Object>} Statistics
   */
  async getBTCDepositStats(bridgeAddress) {
    if (!this.isConnected()) {
      return {
        totalDeposits: 0,
        totalAmountSatoshis: 0,
        totalAmountBTC: 0,
        confirmedAmountSatoshis: 0,
        confirmedAmountBTC: 0,
        processedAmountSatoshis: 0,
        processedAmountBTC: 0,
        pendingCount: 0,
        confirmedCount: 0,
        processedCount: 0,
      };
    }

    const query = `
      SELECT 
        COUNT(*) as total_deposits,
        SUM(amount_satoshis) as total_amount_satoshis,
        SUM(amount_btc) as total_amount_btc,
        SUM(CASE WHEN status IN ('confirmed', 'processed') THEN amount_satoshis ELSE 0 END) as confirmed_amount_satoshis,
        SUM(CASE WHEN status IN ('confirmed', 'processed') THEN amount_btc ELSE 0 END) as confirmed_amount_btc,
        SUM(CASE WHEN status = 'processed' THEN amount_satoshis ELSE 0 END) as processed_amount_satoshis,
        SUM(CASE WHEN status = 'processed' THEN amount_btc ELSE 0 END) as processed_amount_btc,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
        COUNT(*) FILTER (WHERE status = 'processed') as processed_count
      FROM btc_deposits
      WHERE bridge_address = $1
    `;

    try {
      const result = await this.pool.query(query, [bridgeAddress]);
      const row = result.rows[0];
      
      return {
        totalDeposits: parseInt(row.total_deposits) || 0,
        totalAmountSatoshis: parseInt(row.total_amount_satoshis) || 0,
        totalAmountBTC: parseFloat(row.total_amount_btc) || 0,
        confirmedAmountSatoshis: parseInt(row.confirmed_amount_satoshis) || 0,
        confirmedAmountBTC: parseFloat(row.confirmed_amount_btc) || 0,
        processedAmountSatoshis: parseInt(row.processed_amount_satoshis) || 0,
        processedAmountBTC: parseFloat(row.processed_amount_btc) || 0,
        pendingCount: parseInt(row.pending_count) || 0,
        confirmedCount: parseInt(row.confirmed_count) || 0,
        processedCount: parseInt(row.processed_count) || 0,
      };
    } catch (error) {
      console.error('Error getting BTC deposit stats:', error);
      return {
        totalDeposits: 0,
        totalAmountSatoshis: 0,
        totalAmountBTC: 0,
        confirmedAmountSatoshis: 0,
        confirmedAmountBTC: 0,
        processedAmountSatoshis: 0,
        processedAmountBTC: 0,
        pendingCount: 0,
        confirmedCount: 0,
        processedCount: 0,
      };
    }
  }

  /**
   * Save BTC withdrawal transaction
   * @param {Object} withdrawal - Withdrawal data
   * @returns {Promise<Object>} Saved withdrawal
   */
  async saveBTCWithdrawal(withdrawal, client = null) {
    if (!this.isConnected()) {
      return null;
    }

    const {
      txHash,
      bridgeAddress,
      amountSatoshis,
      amountBTC,
      recipientAddress,
      confirmations = 0,
      blockHeight,
      blockTime,
      status = 'pending',
      solanaTxSignature,
      solanaAddress,
      zenZECAmount,
    } = withdrawal;

    const query = `
      INSERT INTO btc_withdrawals (
        tx_hash, bridge_address, amount_satoshis, amount_btc,
        recipient_address, confirmations, block_height, block_time,
        status, solana_tx_signature, solana_address, zen_zec_amount,
        confirmed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (tx_hash)
      DO UPDATE SET
        confirmations = EXCLUDED.confirmations,
        block_height = COALESCE(EXCLUDED.block_height, btc_withdrawals.block_height),
        block_time = COALESCE(EXCLUDED.block_time, btc_withdrawals.block_time),
        status = CASE 
          WHEN EXCLUDED.status = 'confirmed' AND btc_withdrawals.status = 'pending' THEN 'confirmed'
          WHEN EXCLUDED.status = 'failed' THEN 'failed'
          ELSE btc_withdrawals.status
        END,
        confirmed_at = CASE 
          WHEN EXCLUDED.status = 'confirmed' AND btc_withdrawals.confirmed_at IS NULL 
          THEN NOW() 
          ELSE btc_withdrawals.confirmed_at 
        END,
        updated_at = NOW()
      RETURNING *
    `;

    const queryClient = client || this.pool;

    try {
      const result = await queryClient.query(query, [
        txHash,
        bridgeAddress,
        amountSatoshis,
        amountBTC,
        recipientAddress,
        confirmations,
        blockHeight || null,
        blockTime ? new Date(blockTime * 1000) : null,
        status,
        solanaTxSignature || null,
        solanaAddress || null,
        zenZECAmount || null,
        status === 'confirmed' ? new Date() : null,
      ]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error saving BTC withdrawal:', error);
      throw error; // Throw instead of returning null for transaction safety
    }
  }

  /**
   * Atomically check and reserve BTC amount for withdrawal
   * Uses database transaction with locking to prevent race conditions
   * @param {string} bridgeAddress - Bridge address
   * @param {number} bootstrapAmount - Bootstrap amount in satoshis
   * @param {number} requestedAmountSatoshis - Amount to withdraw in satoshis
   * @param {Object} withdrawalData - Withdrawal data to save if check passes
   * @param {Object} client - Database client (for transaction)
   * @returns {Promise<Object>} { success: boolean, currentReserve: number, withdrawal: Object|null }
   */
  async checkAndReserveBTC(bridgeAddress, bootstrapAmount, requestedAmountSatoshis, withdrawalData, client = null) {
    if (!this.isConnected()) {
      return {
        success: false,
        reason: 'Database not connected',
        currentReserve: 0,
        withdrawal: null,
      };
    }

    const queryClient = client || this.pool;
    const useTransaction = !client; // If no client provided, we'll create our own transaction
    let ownClient = null;

    try {
      if (useTransaction) {
        ownClient = await this.pool.connect();
        await ownClient.query('BEGIN');
      }

      const queryClient = client || ownClient;

      // Calculate current reserve atomically within transaction
      // Lock deposits and withdrawals to prevent concurrent modifications
      const reserveQuery = `
        WITH deposit_sum AS (
          SELECT COALESCE(SUM(amount_satoshis), 0) as total
          FROM btc_deposits
          WHERE bridge_address = $1 
            AND status IN ('confirmed', 'processed')
          FOR UPDATE
        ),
        withdrawal_sum AS (
          SELECT COALESCE(SUM(amount_satoshis), 0) as total
          FROM btc_withdrawals
          WHERE bridge_address = $1 
            AND status IN ('pending', 'confirmed')
          FOR UPDATE
        )
        SELECT 
          ($2::BIGINT + deposit_sum.total - withdrawal_sum.total) as current_reserve
        FROM deposit_sum, withdrawal_sum
      `;

      const reserveResult = await queryClient.query(reserveQuery, [bridgeAddress, bootstrapAmount]);
      const currentReserve = parseInt(reserveResult.rows[0].current_reserve) || 0;

      // Check if sufficient reserve
      if (currentReserve < requestedAmountSatoshis) {
        if (useTransaction && ownClient) {
          await ownClient.query('ROLLBACK');
          ownClient.release();
        }
        return {
          success: false,
          reason: 'Insufficient reserve',
          currentReserve: currentReserve / 100000000, // Convert to BTC
          requestedAmount: requestedAmountSatoshis / 100000000,
          withdrawal: null,
        };
      }

      // Reserve is sufficient - record withdrawal
      const withdrawal = await this.saveBTCWithdrawal(withdrawalData, queryClient);

      if (useTransaction && ownClient) {
        await ownClient.query('COMMIT');
        ownClient.release();
      }

      return {
        success: true,
        currentReserve: currentReserve / 100000000, // Convert to BTC
        newReserve: (currentReserve - requestedAmountSatoshis) / 100000000,
        withdrawal: withdrawal,
      };

    } catch (error) {
      if (useTransaction && ownClient) {
        try {
          await ownClient.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Error during rollback:', rollbackError);
        } finally {
          ownClient.release();
        }
      }
      console.error('Error checking and reserving BTC:', error);
      throw error;
    }
  }

  /**
   * Get BTC withdrawal by transaction hash
   * @param {string} txHash - Transaction hash
   * @returns {Promise<Object|null>} Withdrawal data
   */
  async getBTCWithdrawal(txHash) {
    if (!this.isConnected()) {
      return null;
    }

    const query = 'SELECT * FROM btc_withdrawals WHERE tx_hash = $1';
    
    try {
      const result = await this.pool.query(query, [txHash]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting BTC withdrawal:', error);
      return null;
    }
  }

  /**
   * Get BTC withdrawal by Solana transaction signature with lock
   * Used to check if withdrawal already exists and lock it for processing
   * @param {string} solanaTxSignature - Solana transaction signature (the burn tx)
   * @param {Object} client - Database client (for transaction, optional - if null, no lock)
   * @returns {Promise<Object|null>} Withdrawal data or null
   */
  async getBTCWithdrawalBySolanaTxWithLock(solanaTxSignature, client = null) {
    if (!this.isConnected()) {
      return null;
    }

    // If client is provided, use FOR UPDATE lock; otherwise just SELECT
    const query = client 
      ? 'SELECT * FROM btc_withdrawals WHERE solana_tx_signature = $1 FOR UPDATE'
      : 'SELECT * FROM btc_withdrawals WHERE solana_tx_signature = $1';
    const queryClient = client || this.pool;
    
    try {
      const result = await queryClient.query(query, [solanaTxSignature]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting BTC withdrawal by Solana tx:', error);
      throw error;
    }
  }

  /**
   * Mark BTC withdrawal as processing (with lock)
   * Used to atomically check and mark withdrawal as being processed
   * @param {string} solanaTxSignature - Solana transaction signature
   * @param {Object} client - Database client (for transaction)
   * @returns {Promise<Object|null>} Updated withdrawal or null if cannot be processed
   */
  async markBTCWithdrawalProcessing(solanaTxSignature, client = null) {
    if (!this.isConnected()) {
      return null;
    }

    const query = `
      UPDATE btc_withdrawals 
      SET status = 'processing',
          updated_at = NOW()
      WHERE solana_tx_signature = $1
        AND status = 'pending'
      RETURNING *
    `;
    const queryClient = client || this.pool;
    
    try {
      const result = await queryClient.query(query, [solanaTxSignature]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error marking BTC withdrawal as processing:', error);
      throw error;
    }
  }

  /**
   * Update BTC withdrawal status by Solana transaction signature
   * @param {string} solanaTxSignature - Solana transaction signature
   * @param {string} status - New status
   * @param {Object} updates - Additional fields to update
   * @param {Object} client - Database client (for transaction)
   * @returns {Promise<Object|null>} Updated withdrawal
   */
  async updateBTCWithdrawalStatus(solanaTxSignature, status, updates = {}, client = null) {
    if (!this.isConnected()) {
      return null;
    }

    const updateFields = ['status = $1'];
    const params = [status, solanaTxSignature];
    let paramIndex = 3;
    const queryClient = client || this.pool;

    if (updates.btcTxHash) {
      updateFields.push(`tx_hash = $${paramIndex++}`);
      params.push(updates.btcTxHash);
    }

    if (updates.confirmations !== undefined) {
      updateFields.push(`confirmations = $${paramIndex++}`);
      params.push(updates.confirmations);
    }

    if (updates.blockHeight !== undefined) {
      updateFields.push(`block_height = $${paramIndex++}`);
      params.push(updates.blockHeight);
    }

    if (updates.blockTime !== undefined) {
      updateFields.push(`block_time = $${paramIndex++}`);
      params.push(new Date(updates.blockTime * 1000));
    }

    if (status === 'confirmed' && !updates.skipConfirmedAt) {
      updateFields.push(`confirmed_at = COALESCE(confirmed_at, NOW())`);
    }

    const query = `
      UPDATE btc_withdrawals 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE solana_tx_signature = $2
      RETURNING *
    `;

    try {
      const result = await queryClient.query(query, params);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating BTC withdrawal status:', error);
      throw error; // Throw instead of returning null for transaction safety
    }
  }

  /**
   * Get all BTC withdrawals for a bridge address
   * @param {string} bridgeAddress - Bridge address
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Withdrawals
   */
  async getBTCWithdrawals(bridgeAddress, options = {}) {
    if (!this.isConnected()) {
      return [];
    }

    const { status, limit = 100, offset = 0 } = options;
    
    let query = 'SELECT * FROM btc_withdrawals WHERE bridge_address = $1';
    const params = [bridgeAddress];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + paramIndex++ + ' OFFSET $' + paramIndex;
    params.push(limit, offset);

    try {
      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting BTC withdrawals:', error);
      return [];
    }
  }

  /**
   * Get BTC withdrawal statistics
   * @param {string} bridgeAddress - Bridge address
   * @returns {Promise<Object>} Statistics
   */
  async getBTCWithdrawalStats(bridgeAddress) {
    if (!this.isConnected()) {
      return {
        totalWithdrawals: 0,
        totalAmountSatoshis: 0,
        totalAmountBTC: 0,
        confirmedAmountSatoshis: 0,
        confirmedAmountBTC: 0,
        pendingCount: 0,
        confirmedCount: 0,
      };
    }

    const query = `
      SELECT 
        COUNT(*) as total_withdrawals,
        SUM(amount_satoshis) as total_amount_satoshis,
        SUM(amount_btc) as total_amount_btc,
        SUM(CASE WHEN status = 'confirmed' THEN amount_satoshis ELSE 0 END) as confirmed_amount_satoshis,
        SUM(CASE WHEN status = 'confirmed' THEN amount_btc ELSE 0 END) as confirmed_amount_btc,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count
      FROM btc_withdrawals
      WHERE bridge_address = $1
    `;

    try {
      const result = await this.pool.query(query, [bridgeAddress]);
      const row = result.rows[0];
      
      return {
        totalWithdrawals: parseInt(row.total_withdrawals) || 0,
        totalAmountSatoshis: parseInt(row.total_amount_satoshis) || 0,
        totalAmountBTC: parseFloat(row.total_amount_btc) || 0,
        confirmedAmountSatoshis: parseInt(row.confirmed_amount_satoshis) || 0,
        confirmedAmountBTC: parseFloat(row.confirmed_amount_btc) || 0,
        pendingCount: parseInt(row.pending_count) || 0,
        confirmedCount: parseInt(row.confirmed_count) || 0,
      };
    } catch (error) {
      console.error('Error getting BTC withdrawal stats:', error);
      return {
        totalWithdrawals: 0,
        totalAmountSatoshis: 0,
        totalAmountBTC: 0,
        confirmedAmountSatoshis: 0,
        confirmedAmountBTC: 0,
        pendingCount: 0,
        confirmedCount: 0,
      };
    }
  }

  /**
   * Get connection status
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Transfer Metadata Management
   * Prevents btc-relayer from processing non-redemption transfers
   */

  /**
   * Add transfer metadata to classify a treasury transfer
   * @param {Object} metadata - Transfer metadata
   * @param {string} metadata.solanaTxSignature - Transaction signature
   * @param {string} metadata.transferType - 'redemption', 'refund', 'funding', 'admin', 'test'
   * @param {string} metadata.userAddress - User Solana address (for redemptions)
   * @param {number} metadata.amount - Amount in native units
   * @param {Object} metadata.metadata - Additional JSON metadata
   * @param {string} metadata.createdBy - Who created this ('system', 'admin', 'api', 'relayer')
   */
  async addTransferMetadata(metadata) {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO transfer_metadata (
          solana_tx_signature, transfer_type, user_address, amount, metadata, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (solana_tx_signature) DO UPDATE SET
          transfer_type = EXCLUDED.transfer_type,
          user_address = EXCLUDED.user_address,
          amount = EXCLUDED.amount,
          metadata = EXCLUDED.metadata,
          created_by = EXCLUDED.created_by
      `;

      await client.query(query, [
        metadata.solanaTxSignature,
        metadata.transferType,
        metadata.userAddress,
        metadata.amount,
        JSON.stringify(metadata.metadata || {}),
        metadata.createdBy || 'system'
      ]);

      console.log(`✅ Added transfer metadata: ${metadata.solanaTxSignature} (${metadata.transferType})`);
    } finally {
      client.release();
    }
  }

  /**
   * Get transfer metadata for a transaction
   * @param {string} signature - Solana transaction signature
   * @returns {Object|null} - Transfer metadata or null if not found
   */
  async getTransferMetadata(signature) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM transfer_metadata WHERE solana_tx_signature = $1',
        [signature]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          id: row.id,
          solanaTxSignature: row.solana_tx_signature,
          transferType: row.transfer_type,
          userAddress: row.user_address,
          amount: row.amount,
          metadata: row.metadata,
          createdBy: row.created_by,
          createdAt: row.created_at
        };
      }
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Check if a transfer is marked as redemption
   * @param {string} signature - Solana transaction signature
   * @returns {boolean} - True if transfer is marked as redemption
   */
  async isRedemptionTransfer(signature) {
    const metadata = await this.getTransferMetadata(signature);
    return metadata && metadata.transferType === 'redemption';
  }

  /**
   * Transaction Timeout Management
   * Automatically fail transactions stuck in processing status
   */

  /**
   * Clean up stuck transactions (timeout mechanism)
   * @param {number} timeoutMinutes - Minutes after which to timeout transactions
   * @returns {Promise<Object>} - { processed: number, failed: number, timedOut: number }
   */
  async cleanupStuckTransactions(timeoutMinutes = 30) {
    const client = await this.pool.connect();

    try {
      const results = {
        processed: 0,
        failed: 0,
        timedOut: 0
      };

      // Timeout stuck service coordination records
      const coordTimeoutQuery = `
        UPDATE service_coordination
        SET status = 'timed_out', completed_at = NOW()
        WHERE status = 'processing'
          AND started_at < NOW() - INTERVAL '${timeoutMinutes} minutes'
        RETURNING transaction_id, processing_service
      `;

      const coordResult = await client.query(coordTimeoutQuery);
      results.timedOut += coordResult.rowCount;

      for (const row of coordResult.rows) {
        console.log(`⏰ Service coordination timeout: ${row.transaction_id} (${row.processing_service})`);
      }

      // Timeout stuck bridge transactions
      const bridgeTimeoutQuery = `
        UPDATE bridge_transactions
        SET status = 'failed', updated_at = NOW()
        WHERE status = 'processing'
          AND created_at < NOW() - INTERVAL '${timeoutMinutes} minutes'
        RETURNING tx_id
      `;

      const bridgeResult = await client.query(bridgeTimeoutQuery);
      results.failed += bridgeResult.rowCount;

      for (const row of bridgeResult.rows) {
        console.log(`⏰ Bridge transaction timeout: ${row.tx_id}`);
      }

      // Timeout stuck burn transactions
      const burnTimeoutQuery = `
        UPDATE burn_transactions
        SET status = 'failed', updated_at = NOW()
        WHERE status = 'processing'
          AND created_at < NOW() - INTERVAL '${timeoutMinutes} minutes'
        RETURNING tx_id
      `;

      const burnResult = await client.query(burnTimeoutQuery);
      results.failed += burnResult.rowCount;

      for (const row of burnResult.rows) {
        console.log(`⏰ Burn transaction timeout: ${row.tx_id}`);
      }

      // Timeout stuck swap transactions
      const swapTimeoutQuery = `
        UPDATE swap_transactions
        SET status = 'failed', updated_at = NOW()
        WHERE status = 'processing'
          AND created_at < NOW() - INTERVAL '${timeoutMinutes} minutes'
        RETURNING tx_id
      `;

      const swapResult = await client.query(swapTimeoutQuery);
      results.failed += swapResult.rowCount;

      for (const row of swapResult.rows) {
        console.log(`⏰ Swap transaction timeout: ${row.tx_id}`);
      }

      if (results.timedOut > 0 || results.failed > 0) {
        console.log(`🧹 Transaction cleanup: ${results.timedOut} timed out, ${results.failed} failed`);
      }

      return results;

    } catch (error) {
      console.error('Error during transaction cleanup:', error);
      return { processed: 0, failed: 0, timedOut: 0, error: error.message };
    } finally {
      client.release();
    }
  }

  /**
   * Start transaction cleanup interval
   * @param {number} intervalMinutes - How often to run cleanup (configurable)
   */
  startTransactionCleanup(intervalMinutes = null) {
    // Use environment variable or default
    const cleanupIntervalMinutes = intervalMinutes ||
      parseInt(process.env.DB_TRANSACTION_CLEANUP_INTERVAL_MINUTES) || 10;

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupStuckTransactions();
      } catch (error) {
        console.error('Transaction cleanup interval error:', error);
      }
    }, cleanupIntervalMinutes * 60 * 1000);

    console.log(`🧹 Transaction cleanup started (every ${cleanupIntervalMinutes} minutes)`);
  }

  /**
   * Stop transaction cleanup interval
   */
  stopTransactionCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('🧹 Transaction cleanup stopped');
    }
  }

  /**
   * Enhanced close method with cleanup
   */
  async close() {
    console.log('Database: Stopping transaction cleanup...');
    this.stopTransactionCleanup();

    console.log('Database: Stopping health monitoring...');
    this.stopHealthMonitoring();

    console.log('Database: Closing connection pool...');
    await this.pool.end();
    this.connected = false;
    console.log('Database: Connection pool closed');
  }
}

module.exports = new DatabaseService();


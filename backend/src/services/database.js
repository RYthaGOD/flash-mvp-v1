const { Pool } = require('pg');
require('dotenv').config();

/**
 * Database Service
 * Handles all database operations for transaction persistence
 */
class DatabaseService {
  constructor() {
    // Initialize connection pool
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'flash_bridge',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
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
  }

  /**
   * Initialize database connection with retry logic
   * @param {number} maxRetries - Maximum retry attempts
   * @param {number} retryDelay - Delay between retries in ms
   */
  async initialize(maxRetries = 3, retryDelay = 2000) {
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
          console.error(`Failed to connect to database after ${maxRetries} attempts:`, error.message);
          this.connected = false;
          return false;
        }
        
        console.warn(`Database connection attempt ${attempt + 1}/${maxRetries} failed: ${error.message}`);
        console.warn(`Retrying in ${retryDelay}ms...`);
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
   * Mark event as processed
   * @param {Object} event - Event data
   * @returns {Promise<Object>} Saved event record
   */
  async markEventProcessed(event) {
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

    try {
      const result = await this.pool.query(query, [
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
   * Update transaction status
   * @param {string} txId - Transaction ID
   * @param {string} type - Transaction type ('bridge', 'swap', 'burn')
   * @param {string} status - New status
   * @param {Object} updates - Additional fields to update
   * @returns {Promise<Object>} Updated transaction
   */
  async updateTransactionStatus(txId, type, status, updates = {}) {
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
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error) {
        console.warn('Database health check failed:', error.message);

        // Attempt reconnection if disconnected
        if (!this.connected && this.reconnectAttempts < this.maxReconnectAttempts) {
          console.log('🔄 Attempting database reconnection...');
          this.reconnectAttempts++;

          try {
            const reconnected = await this.initialize(1, 1000);
            if (reconnected) {
              console.log('✅ Database reconnected successfully');
              this.reconnectAttempts = 0;
            }
          } catch (reconnectError) {
            console.warn(`Database reconnection attempt ${this.reconnectAttempts} failed:`, reconnectError.message);
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
   * Get connection status
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Enhanced close method with cleanup
   */
  async close() {
    console.log('Database: Stopping health monitoring...');
    this.stopHealthMonitoring();

    console.log('Database: Closing connection pool...');
    await this.pool.end();
    this.connected = false;
    console.log('Database: Connection pool closed');
  }
}

module.exports = new DatabaseService();


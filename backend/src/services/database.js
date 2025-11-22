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
  }

  /**
   * Initialize database connection
   */
  async initialize() {
    try {
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      this.connected = true;
      console.log('✓ Database connected successfully');
      return true;
    } catch (error) {
      console.error('Failed to connect to database:', error.message);
      this.connected = false;
      return false;
    }
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
    } = transaction;

    const query = `
      INSERT INTO bridge_transactions (
        tx_id, solana_address, amount, reserve_asset, status,
        solana_tx_signature, bitcoin_tx_hash, zcash_tx_hash, demo_mode
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (tx_id) 
      DO UPDATE SET
        status = EXCLUDED.status,
        solana_tx_signature = COALESCE(EXCLUDED.solana_tx_signature, bridge_transactions.solana_tx_signature),
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
   * Close database connection pool
   */
  async close() {
    await this.pool.end();
    this.connected = false;
    console.log('Database connection pool closed');
  }

  /**
   * Get connection status
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.connected;
  }
}

module.exports = new DatabaseService();


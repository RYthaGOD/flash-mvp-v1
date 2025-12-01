const databaseService = require('../services/database');

const FAILED_RETRY_INTERVAL_MS = parseInt(
  process.env.SERVICE_COORDINATOR_RETRY_INTERVAL_MS || `${5 * 60 * 1000}`,
  10
);
const COMPLETED_CLEANUP_HOURS = parseInt(
  process.env.SERVICE_COORDINATOR_CLEANUP_HOURS || '24',
  10
);
const PROCESSING_STALE_MINUTES = parseInt(
  process.env.SERVICE_COORDINATOR_STALE_MINUTES || '60',
  10
);
const CLEANUP_INTERVAL_MS = parseInt(
  process.env.SERVICE_COORDINATOR_CLEANUP_INTERVAL_MS || `${60 * 60 * 1000}`,
  10
);

/**
 * Service Coordinator
 * Prevents multiple services from processing the same transaction
 * Uses database as single source of truth for coordination
 */
class ServiceCoordinator {
  constructor() {
    this.serviceName = 'unknown';
  }

  /**
   * Set the service name for this coordinator instance
   * @param {string} serviceName - Name of the service using this coordinator
   */
  setServiceName(serviceName) {
    this.serviceName = serviceName;
  }

  /**
   * Check if a transaction can be processed by this service
   * Uses database locking to prevent race conditions
   * @param {string} transactionId - Unique transaction identifier
   * @param {string} transactionType - Type of transaction ('btc_deposit', 'zec_deposit', 'solana_transfer', etc.)
   * @param {Object} client - Optional database client for transactions
   * @returns {Object} - { canProcess: boolean, reason: string, existingService?: string }
   */
  async canProcessTransaction(transactionId, transactionType, client = null) {
    const useClient = client || await databaseService.pool.connect();

    try {
      // Use database-level locking to prevent race conditions
      // First, try to insert a processing record with conflict resolution
      const insertQuery = `
        INSERT INTO service_coordination (
          transaction_id, transaction_type, processing_service, status, started_at
        ) VALUES ($1, $2, $3, 'processing', NOW())
        ON CONFLICT (transaction_id) DO NOTHING
        RETURNING id
      `;

      const insertResult = await useClient.query(insertQuery, [
        transactionId,
        transactionType,
        this.serviceName
      ]);

      if (insertResult.rows.length === 0) {
        // Insert failed due to conflict - check who is processing it
        const statusQuery = `
          SELECT processing_service, status, completed_at
          FROM service_coordination
          WHERE transaction_id = $1
          FOR UPDATE
        `;

        const statusResult = await useClient.query(statusQuery, [transactionId]);

        if (statusResult.rows.length > 0) {
          const row = statusResult.rows[0];

          if (row.status === 'processing') {
            return {
              canProcess: false,
              reason: `Transaction already being processed by ${row.processing_service}`,
              existingService: row.processing_service
            };
          } else if (row.status === 'failed') {
            const completedAt = row.completed_at ? new Date(row.completed_at).getTime() : 0;
            const elapsed = completedAt ? Date.now() - completedAt : 0;

            if (completedAt && elapsed >= FAILED_RETRY_INTERVAL_MS) {
              await useClient.query(
                'DELETE FROM service_coordination WHERE transaction_id = $1',
                [transactionId]
              );

              const retryInsert = await useClient.query(insertQuery, [
                transactionId,
                transactionType,
                this.serviceName
              ]);

              if (retryInsert.rows.length > 0) {
                return {
                  canProcess: true,
                  reason: 'Recovered from previous failure and reacquired lock'
                };
              }
            }

            return {
              canProcess: false,
              reason: `Transaction previously failed by ${row.processing_service}`,
              existingService: row.processing_service,
              retryAfterMs: Math.max(FAILED_RETRY_INTERVAL_MS - elapsed, 0)
            };
          } else if (row.status === 'completed') {
            return {
              canProcess: false,
              reason: `Transaction already ${row.status} by ${row.processing_service}`,
              existingService: row.processing_service
            };
          }
        }

        // Should not reach here, but allow processing as fallback
        console.warn(`ServiceCoordinator: Unexpected state for ${transactionId}`);
      }

      // Successfully acquired processing lock
      return {
        canProcess: true,
        reason: 'Successfully acquired processing lock'
      };

    } catch (error) {
      console.error(`ServiceCoordinator error checking ${transactionId}:`, error);
      // CRITICAL: Fail-closed for race condition prevention
      // If we can't check the database, we must assume the worst and block processing
      console.error(`🚨 BLOCKING ${transactionId} due to database unavailability - preventing race conditions`);
      return {
        canProcess: false,
        reason: `Database unavailable for coordination check: ${error.message}`,
        databaseError: true
      };
    } finally {
      if (!client) {
        useClient.release();
      }
    }
  }

  /**
   * Mark a transaction as being processed by this service
   * NOTE: This is now redundant with canProcessTransaction() which atomically acquires the lock
   * @param {string} transactionId - Unique transaction identifier
   * @param {string} transactionType - Type of transaction
   * @param {Object} client - Optional database client for transactions
   * @returns {boolean} - True if successfully marked
   */
  async markTransactionProcessing(transactionId, transactionType, client = null) {
    try {
      const useClient = client || await databaseService.pool.connect();
      try {
        const query = `
          UPDATE service_coordination
          SET status = 'processing', processing_service = $2, started_at = NOW()
          WHERE transaction_id = $1
        `;

        const result = await useClient.query(query, [
          transactionId,
          this.serviceName
        ]);

        return result.rowCount > 0;
      } finally {
        if (!client) {
          useClient.release();
        }
      }
    } catch (error) {
      console.error(`ServiceCoordinator error marking ${transactionId} as processing:`, error);
      return false;
    }
  }

  /**
   * Mark a transaction as completed by this service
   * @param {string} transactionId - Unique transaction identifier
   * @param {Object} client - Optional database client for transactions
   * @returns {boolean} - True if successfully marked
   */
  async markTransactionCompleted(transactionId, client = null) {
    try {
      const useClient = client || await databaseService.pool.connect();

      try {
        // Update status to completed
        const query = `
          UPDATE service_coordination
          SET status = 'completed', completed_at = NOW()
          WHERE transaction_id = $1 AND processing_service = $2
        `;

        const result = await useClient.query(query, [transactionId, this.serviceName]);

        if (result.rowCount > 0) {
          console.log(`✅ ${this.serviceName} marked ${transactionId} as completed`);
          return true;
        } else {
          console.warn(`⚠️  ${this.serviceName} could not mark ${transactionId} as completed (not found or wrong service)`);
          return false;
        }

      } finally {
        if (!client) {
          useClient.release();
        }
      }

    } catch (error) {
      console.error(`ServiceCoordinator error marking ${transactionId} as completed:`, error);
      return false;
    }
  }

  /**
   * Release a transaction if processing failed
   * @param {string} transactionId - Unique transaction identifier
   * @param {Object} client - Optional database client for transactions
   */
  async releaseTransaction(transactionId, client = null) {
    try {
      const useClient = client || await databaseService.pool.connect();

      try {
        // Remove processing status or mark as failed
        const query = `
          DELETE FROM service_coordination
          WHERE transaction_id = $1 AND processing_service = $2
        `;

        const result = await useClient.query(query, [transactionId, this.serviceName]);

        if (result.rowCount > 0) {
          console.log(`🔄 ${this.serviceName} released ${transactionId}`);
        }

      } finally {
        if (!client) {
          useClient.release();
        }
      }

    } catch (error) {
      console.error(`ServiceCoordinator error releasing ${transactionId}:`, error);
    }
  }

  /**
   * Get processing status of a transaction
   * @param {string} transactionId - Unique transaction identifier
   * @param {Object} client - Optional database client for transactions
   * @returns {Object} - { isProcessing: boolean, isCompleted: boolean, processingService?: string, completedService?: string }
   */
  async getTransactionProcessingStatus(transactionId, client = null) {
    try {
      const useClient = client || await databaseService.pool.connect();

      try {
        const query = `
          SELECT processing_service, status, started_at, completed_at
          FROM service_coordination
          WHERE transaction_id = $1
          ORDER BY started_at DESC
          LIMIT 1
        `;

        const result = await useClient.query(query, [transactionId]);

        if (result.rows.length === 0) {
          return { isProcessing: false, isCompleted: false };
        }

        const row = result.rows[0];
        const isProcessing = row.status === 'processing';
        const isCompleted = row.status === 'completed' || row.status === 'failed';

        return {
          isProcessing,
          isCompleted,
          processingService: isProcessing ? row.processing_service : null,
          completedService: isCompleted ? row.processing_service : null
        };

      } finally {
        if (!client) {
          useClient.release();
        }
      }

    } catch (error) {
      console.error(`ServiceCoordinator error getting status for ${transactionId}:`, error);
      // On error, assume not processing to avoid blocking
      return { isProcessing: false, isCompleted: false };
    }
  }

  /**
   * Clean up old processing records (older than specified hours)
   * @param {number} olderThanHours - Remove records older than this many hours
   */
  async cleanupOldRecords(
    completedOlderThanHours = COMPLETED_CLEANUP_HOURS,
    processingOlderThanMinutes = PROCESSING_STALE_MINUTES
  ) {
    try {
      const query = `
        DELETE FROM service_coordination
        WHERE
          (status IN ('completed', 'failed') AND completed_at IS NOT NULL
            AND completed_at < NOW() - make_interval(hours => $1))
          OR
          (status = 'processing'
            AND started_at < NOW() - make_interval(mins => $2))
      `;

      const result = await databaseService.pool.query(query, [
        completedOlderThanHours,
        processingOlderThanMinutes,
      ]);

      if (result.rowCount > 0) {
        console.log(
          `🧹 ServiceCoordinator cleanup removed ${result.rowCount} stale records`
        );
      }
    } catch (error) {
      console.error('Error cleaning up service coordination records:', error);
    }
  }
}

const serviceCoordinator = new ServiceCoordinator();

if (CLEANUP_INTERVAL_MS > 0) {
  const interval = setInterval(() => {
    serviceCoordinator
      .cleanupOldRecords()
      .catch((error) =>
        console.error('ServiceCoordinator cleanup interval error:', error)
      );
  }, CLEANUP_INTERVAL_MS);

  if (typeof interval.unref === 'function') {
    interval.unref();
  }
}

module.exports = serviceCoordinator;

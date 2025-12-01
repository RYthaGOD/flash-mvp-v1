/**
 * Error Context Utility
 * Provides structured error logging with full context (tx IDs, addresses, amounts)
 */

/**
 * Format error message with context
 * @param {string} operation - Name of the operation (e.g., "BTC Redemption", "Burn Swap")
 * @param {Object} context - Context object with relevant fields
 * @param {Error|string} error - Original error or error message
 * @returns {string} Formatted error message
 */
function formatErrorWithContext(operation, context, error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  const contextParts = [];
  
  // Add context fields in priority order
  if (context.userAddress || context.user) {
    contextParts.push(`user=${context.userAddress || context.user}`);
  }
  if (context.amount !== undefined && context.amount !== null) {
    contextParts.push(`amount=${context.amount}`);
  }
  if (context.signature || context.txId || context.transferSignature) {
    contextParts.push(`tx=${context.signature || context.txId || context.transferSignature}`);
  }
  if (context.btcAddress || context.address) {
    contextParts.push(`btcAddress=${context.btcAddress || context.address}`);
  }
  if (context.solanaAddress) {
    contextParts.push(`solanaAddress=${context.solanaAddress}`);
  }
  if (context.fromStatus) {
    contextParts.push(`from=${context.fromStatus}`);
  }
  if (context.toStatus) {
    contextParts.push(`to=${context.toStatus}`);
  }
  if (context.reserveAmount !== undefined) {
    contextParts.push(`reserve=${context.reserveAmount}`);
  }
  if (context.requiredAmount !== undefined) {
    contextParts.push(`required=${context.requiredAmount}`);
  }
  
  const contextStr = contextParts.length > 0 
    ? ` [${contextParts.join(', ')}]` 
    : '';
  
  return `${operation} failed${contextStr}: ${errorMessage}`;
}

/**
 * Create error logger with context
 * @param {string} operation - Operation name
 * @param {Object} baseContext - Base context that applies to all logs
 * @returns {Function} Logger function that accepts (error, additionalContext)
 */
function createContextLogger(operation, baseContext = {}) {
  return function logError(error, additionalContext = {}) {
    const fullContext = { ...baseContext, ...additionalContext };
    const message = formatErrorWithContext(operation, fullContext, error);
    
    // Log structured error
    const logEntry = {
      timestamp: new Date().toISOString(),
      operation,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : { message: String(error) },
      context: fullContext
    };
    
    // Console error with formatted message
    console.error(message);
    
    // Log structured entry for better parsing
    if (process.env.NODE_ENV === 'development') {
      console.error('Error details:', JSON.stringify(logEntry, null, 2));
    }
    
    return logEntry;
  };
}

/**
 * Wrap async function with error context
 * @param {string} operation - Operation name
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
function withErrorContext(operation, fn) {
  return async function(...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      // Try to extract context from arguments
      const context = extractContextFromArgs(args);
      createContextLogger(operation, context)(error);
      throw error;
    }
  };
}

/**
 * Extract context from function arguments (heuristic)
 * @param {Array} args - Function arguments
 * @returns {Object} Extracted context
 */
function extractContextFromArgs(args) {
  const context = {};
  
  for (const arg of args) {
    if (typeof arg === 'string') {
      // Could be address, tx ID, etc.
      if (arg.length > 30 && !context.signature) {
        context.signature = arg;
      }
    } else if (typeof arg === 'object' && arg !== null) {
      // Merge object properties that look like context
      if (arg.user || arg.userAddress) {
        context.userAddress = arg.user || arg.userAddress;
      }
      if (arg.amount !== undefined) {
        context.amount = arg.amount;
      }
      if (arg.signature || arg.txId || arg.transferSignature) {
        context.signature = arg.signature || arg.txId || arg.transferSignature;
      }
      if (arg.btcAddress || arg.address) {
        context.btcAddress = arg.btcAddress || arg.address;
      }
    }
  }
  
  return context;
}

/**
 * Create enhanced error with context
 * @param {string} operation - Operation name
 * @param {Object} context - Context object
 * @param {Error|string} originalError - Original error
 * @returns {Error} Enhanced error
 */
function createEnhancedError(operation, context, originalError) {
  const errorMessage = formatErrorWithContext(operation, context, originalError);
  const error = originalError instanceof Error 
    ? new Error(errorMessage)
    : new Error(errorMessage);
  
  // Preserve stack trace if original error has one
  if (originalError instanceof Error && originalError.stack) {
    error.stack = originalError.stack;
  }
  
  // Attach context to error object for programmatic access
  error.context = context;
  error.operation = operation;
  
  return error;
}

module.exports = {
  formatErrorWithContext,
  createContextLogger,
  withErrorContext,
  createEnhancedError,
  extractContextFromArgs
};


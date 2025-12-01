/**
 * Standardized Logging Utility
 * Provides consistent logging format across all services
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor(serviceName = 'unknown') {
    this.serviceName = serviceName;
    this.logLevel = this.getLogLevel();
  }

  getLogLevel() {
    const level = (process.env.LOG_LEVEL || 'info').toUpperCase();
    return LOG_LEVELS[level] || LOG_LEVELS.INFO;
  }

  formatMessage(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const service = this.serviceName;

    let formattedMessage = `[${timestamp}] ${service} ${level}: ${message}`;

    // Add context if provided
    if (Object.keys(context).length > 0) {
      formattedMessage += ` | ${JSON.stringify(context)}`;
    }

    return formattedMessage;
  }

  error(message, context = {}) {
    if (this.logLevel >= LOG_LEVELS.ERROR) {
      console.error(this.formatMessage('ERROR', message, context));
    }
  }

  warn(message, context = {}) {
    if (this.logLevel >= LOG_LEVELS.WARN) {
      console.warn(this.formatMessage('WARN', message, context));
    }
  }

  info(message, context = {}) {
    if (this.logLevel >= LOG_LEVELS.INFO) {
      console.log(this.formatMessage('INFO', message, context));
    }
  }

  debug(message, context = {}) {
    if (this.logLevel >= LOG_LEVELS.DEBUG) {
      console.log(this.formatMessage('DEBUG', message, context));
    }
  }

  // Specialized logging methods
  operation(operation, status, details = {}) {
    this.info(`Operation: ${operation} - ${status}`, details);
  }

  transaction(txId, action, details = {}) {
    this.info(`Transaction ${txId}: ${action}`, details);
  }

  security(event, details = {}) {
    this.warn(`Security: ${event}`, details);
  }

  performance(operation, duration, details = {}) {
    this.debug(`Performance: ${operation} took ${duration}ms`, details);
  }
}

// Create service-specific loggers
const createLogger = (serviceName) => {
  return new Logger(serviceName);
};

// Export both the class and factory function
module.exports = {
  Logger,
  createLogger
};

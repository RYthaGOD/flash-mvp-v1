import { useState, useCallback } from 'react';

const ERROR_TYPES = {
  NETWORK: 'network',
  WALLET: 'wallet',
  BRIDGE: 'bridge',
  SYSTEM: 'system',
  VALIDATION: 'validation'
};

const ERROR_MESSAGES = {
  [ERROR_TYPES.NETWORK]: {
    title: 'Connection Error',
    message: 'Unable to connect to the bridge service. Please check your internet connection.',
    action: 'Try Again',
    severity: 'error'
  },
  [ERROR_TYPES.WALLET]: {
    title: 'Wallet Error',
    message: 'There was an issue with your wallet connection.',
    action: 'Reconnect Wallet',
    severity: 'warning'
  },
  [ERROR_TYPES.BRIDGE]: {
    title: 'Bridge Error',
    message: 'The bridge transaction failed. Please try again.',
    action: 'Retry Transaction',
    severity: 'error'
  },
  [ERROR_TYPES.SYSTEM]: {
    title: 'System Error',
    message: 'A system error occurred. The team has been notified.',
    action: 'Refresh Page',
    severity: 'error'
  },
  [ERROR_TYPES.VALIDATION]: {
    title: 'Input Error',
    message: 'Please check your input and try again.',
    action: 'Fix Input',
    severity: 'info'
  }
};

export const useErrorHandler = () => {
  const [errors, setErrors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const addError = useCallback((type, customMessage = null, customAction = null) => {
    const errorConfig = ERROR_MESSAGES[type];
    if (!errorConfig) return;

    const error = {
      id: Date.now() + Math.random(),
      type,
      title: errorConfig.title,
      message: customMessage || errorConfig.message,
      action: customAction || errorConfig.action,
      severity: errorConfig.severity,
      timestamp: new Date(),
      autoRemove: type !== ERROR_TYPES.SYSTEM // Auto-remove non-critical errors
    };

    setErrors(prev => [...prev, error]);

    // Auto-remove non-critical errors after 5 seconds
    if (error.autoRemove) {
      setTimeout(() => {
        removeError(error.id);
      }, 5000);
    }

    return error.id;
  }, []);

  const removeError = useCallback((errorId) => {
    setErrors(prev => prev.filter(error => error.id !== errorId));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const handleApiError = useCallback((error) => {
    console.error('API Error:', error);

    // Network errors
    if (!error.response) {
      return addError(ERROR_TYPES.NETWORK);
    }

    // HTTP status based errors
    const status = error.response.status;
    const data = error.response.data;

    if (status === 429) {
      return addError(ERROR_TYPES.NETWORK, 'Rate limit exceeded. Please wait before trying again.');
    }

    if (status >= 500) {
      return addError(ERROR_TYPES.SYSTEM, 'Server error occurred. Please try again later.');
    }

    if (status === 400) {
      if (data?.error?.includes('wallet') || data?.error?.includes('address')) {
        return addError(ERROR_TYPES.WALLET, data.error);
      }
      if (data?.error?.includes('bridge') || data?.error?.includes('transaction')) {
        return addError(ERROR_TYPES.BRIDGE, data.error);
      }
      return addError(ERROR_TYPES.VALIDATION, data.error);
    }

    // Default error
    return addError(ERROR_TYPES.SYSTEM, data?.error || 'An unexpected error occurred.');
  }, [addError]);

  const withErrorHandling = useCallback(async (operation, options = {}) => {
    const { loadingMessage = 'Processing...', successMessage = null } = options;

    setIsLoading(true);
    try {
      const result = await operation();

      if (successMessage) {
        // Could add success notifications here
        console.log('Success:', successMessage);
      }

      return result;
    } catch (error) {
      handleApiError(error);
      throw error; // Re-throw for component handling
    } finally {
      setIsLoading(false);
    }
  }, [handleApiError]);

  const getErrorSummary = useCallback(() => {
    const errorCount = errors.length;
    const criticalErrors = errors.filter(e => e.severity === 'error').length;
    const warningErrors = errors.filter(e => e.severity === 'warning').length;

    return {
      total: errorCount,
      critical: criticalErrors,
      warnings: warningErrors,
      hasErrors: errorCount > 0
    };
  }, [errors]);

  return {
    errors,
    isLoading,
    addError,
    removeError,
    clearErrors,
    handleApiError,
    withErrorHandling,
    getErrorSummary
  };
};

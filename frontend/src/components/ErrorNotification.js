import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useErrorHandler } from '../hooks/useErrorHandler';

const ErrorNotification = () => {
  const { errors, removeError } = useErrorHandler();

  const getSeverityStyles = (severity) => {
    switch (severity) {
      case 'error':
        return {
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05))',
          borderColor: 'rgba(239, 68, 68, 0.3)',
          icon: '❌',
          color: '#fca5a5'
        };
      case 'warning':
        return {
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05))',
          borderColor: 'rgba(245, 158, 11, 0.3)',
          icon: '⚠️',
          color: '#fcd34d'
        };
      case 'info':
        return {
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05))',
          borderColor: 'rgba(59, 130, 246, 0.3)',
          icon: 'ℹ️',
          color: '#93c5fd'
        };
      default:
        return {
          background: 'linear-gradient(135deg, rgba(107, 114, 128, 0.1), rgba(107, 114, 128, 0.05))',
          borderColor: 'rgba(107, 114, 128, 0.3)',
          icon: '🔔',
          color: '#d1d5db'
        };
    }
  };

  return (
    <div className="error-notifications">
      <AnimatePresence>
        {errors.map((error) => {
          const styles = getSeverityStyles(error.severity);

          return (
            <motion.div
              key={error.id}
              className="error-notification"
              style={{
                background: styles.background,
                borderColor: styles.borderColor,
                color: styles.color
              }}
              initial={{ opacity: 0, x: 300, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 300, scale: 0.8 }}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 30,
                exit: { duration: 0.2 }
              }}
            >
              <div className="error-icon">
                {styles.icon}
              </div>

              <div className="error-content">
                <div className="error-title">{error.title}</div>
                <div className="error-message">{error.message}</div>
                {error.action && (
                  <div className="error-action">
                    <button
                      className="error-action-btn"
                      onClick={() => {
                        // Handle action based on error type
                        removeError(error.id);
                      }}
                    >
                      {error.action}
                    </button>
                  </div>
                )}
              </div>

              <motion.button
                className="error-close"
                onClick={() => removeError(error.id)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                ✕
              </motion.button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default ErrorNotification;

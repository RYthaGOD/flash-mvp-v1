/**
 * Error Handling Middleware
 * Centralized error handling for API responses
 */

/**
 * Custom API Error class
 */
class APIError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'APIError';
  }
}

/**
 * Error handler middleware
 */
function errorHandler(err, req, res, next) {
  // Log error
  console.error('API Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    body: req.body,
  });

  // Handle known error types
  if (err instanceof APIError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
      timestamp: new Date().toISOString(),
    });
  }

  // Handle database errors
  if (err.code && err.code.startsWith('23')) {
    // PostgreSQL constraint violations
    return res.status(409).json({
      error: 'Database constraint violation',
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  }

  // Handle validation errors from express-validator or similar
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    error: message,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * 404 handler
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  APIError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
};


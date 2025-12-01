const { APIError } = require('./errorHandler');

/**
 * Simple API key middleware for sensitive endpoints
 * Requires header: x-api-key
 */
function requireApiKey(req, res, next) {
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey || adminKey.trim() === '') {
    console.error('ADMIN_API_KEY is not configured - blocking admin request');
    return res.status(503).json({
      error: 'Admin API key not configured',
      message: 'Set ADMIN_API_KEY in environment to access this endpoint',
    });
  }

  const providedKey =
    req.headers['x-api-key'] ||
    req.headers['x-admin-api-key'] ||
    req.query.apiKey;

  if (!providedKey || providedKey !== adminKey) {
    return next(new APIError(401, 'Invalid or missing admin API key'));
  }

  return next();
}

module.exports = {
  requireApiKey,
};


const { APIError } = require('./errorHandler');

/**
 * Optional client signature middleware.
 * If CLIENT_API_KEY is set, require requests to send x-client-id header.
 */
function requireClientSignature(req, res, next) {
  const clientKey = process.env.CLIENT_API_KEY;

  if (!clientKey || clientKey.trim() === '') {
    return next();
  }

  const provided =
    req.headers['x-client-id'] ||
    req.headers['x-client-key'] ||
    req.headers['x-api-client'];

  if (!provided || provided !== clientKey) {
    return next(new APIError(401, 'Invalid client signature'));
  }

  return next();
}

module.exports = {
  requireClientSignature,
};


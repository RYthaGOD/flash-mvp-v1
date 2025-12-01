const rateLimit = require('express-rate-limit');

/**
 * Rate Limiting Middleware
 * Protects against abuse and DoS attacks
 */

// General API rate limit (per IP)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests from this IP',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000),
      limit: req.rateLimit.limit,
      remaining: Math.max(0, req.rateLimit.remaining - 1)
    });
  }
});

// Strict rate limit for bridge operations (most critical)
const bridgeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 bridge requests per minute
  message: {
    error: 'Bridge rate limit exceeded',
    message: 'Too many bridge requests. Maximum 10 per minute allowed.',
    retryAfter: '60 seconds'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Bridge rate limit exceeded',
      message: 'Maximum 10 bridge requests per minute allowed',
      retryAfter: 60,
      limit: 10,
      windowMs: 60000
    });
  }
});

// Reserve operations rate limit
const reserveLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 reserve requests per minute
  message: {
    error: 'Reserve rate limit exceeded',
    message: 'Too many reserve requests. Maximum 30 per minute allowed.',
    retryAfter: '60 seconds'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Admin operations rate limit (stricter)
const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 admin requests per minute
  message: {
    error: 'Admin rate limit exceeded',
    message: 'Too many admin requests. Maximum 5 per minute allowed.',
    retryAfter: '60 seconds'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Health check rate limit (more permissive)
const healthLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Allow 60 health checks per minute
  message: {
    error: 'Health check rate limit exceeded',
    message: 'Too many health checks'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for internal requests (e.g., from load balancer health checks)
    return req.headers['user-agent']?.includes('HealthChecker') ||
           req.headers['x-forwarded-for'] === '127.0.0.1';
  }
});

// Wallet-specific rate limiting (per wallet address instead of IP)
const createWalletLimiter = (windowMs, maxRequests, message) => {
  // Simple in-memory store for wallet-based rate limiting
  const walletRequests = new Map();

  return (req, res, next) => {
    const walletAddress = req.body?.solanaAddress || req.query?.wallet;

    if (!walletAddress) {
      return next(); // No wallet address, use IP-based limiting
    }

    const now = Date.now();
    const key = `wallet_${walletAddress}`;

    if (!walletRequests.has(key)) {
      walletRequests.set(key, { count: 0, resetTime: now + windowMs });
    }

    const walletData = walletRequests.get(key);

    // Reset if window has passed
    if (now > walletData.resetTime) {
      walletData.count = 0;
      walletData.resetTime = now + windowMs;
    }

    // Check limit
    if (walletData.count >= maxRequests) {
      return res.status(429).json({
        error: 'Wallet rate limit exceeded',
        message,
        retryAfter: Math.ceil((walletData.resetTime - now) / 1000)
      });
    }

    // Increment counter
    walletData.count++;

    // Clean up old entries periodically (aggressive cleanup to prevent memory leaks)
    if (Math.random() < 0.1) { // 10% chance to cleanup (increased from 1%)
      for (const [k, v] of walletRequests.entries()) {
        if (now > v.resetTime) {
          walletRequests.delete(k);
        }
      }
    }

    // Emergency cleanup: if map gets too large, clean it entirely
    if (walletRequests.size > 10000) {
      console.warn('Wallet rate limit map too large, performing emergency cleanup');
      for (const [k, v] of walletRequests.entries()) {
        if (now > v.resetTime) {
          walletRequests.delete(k);
        }
      }
      // If still too large after cleanup, clear all expired entries more aggressively
      if (walletRequests.size > 5000) {
        console.error('Emergency: Clearing entire wallet rate limit cache');
        walletRequests.clear();
      }
    }

    next();
  };
};

// Wallet-based rate limiting for bridge operations
const walletBridgeLimiter = createWalletLimiter(
  5 * 60 * 1000, // 5 minutes
  5, // 5 bridge requests per wallet per 5 minutes
  'Too many bridge requests from this wallet. Maximum 5 per 5 minutes allowed.'
);

// Combined rate limiter (IP + wallet based)
const createCombinedLimiter = (ipLimiter, walletLimiter) => {
  return (req, res, next) => {
    // Apply IP-based limiting first
    ipLimiter(req, res, (err) => {
      if (err) return next(err);

      // Then apply wallet-based limiting if applicable
      walletLimiter(req, res, next);
    });
  };
};

// Export rate limiters
module.exports = {
  generalLimiter,
  bridgeLimiter,
  reserveLimiter,
  adminLimiter,
  healthLimiter,
  walletBridgeLimiter,
  createCombinedLimiter,
  createWalletLimiter
};

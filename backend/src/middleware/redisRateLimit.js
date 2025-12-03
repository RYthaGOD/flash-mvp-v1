/**
 * Redis-based Rate Limiting for Production
 * =========================================
 * Distributed rate limiting that scales across multiple instances.
 * Falls back to in-memory if Redis is unavailable.
 */

const rateLimit = require('express-rate-limit');
const { createLogger } = require('../utils/logger');

const logger = createLogger('redis-rate-limit');

// Redis client singleton
let redisClient = null;
let redisAvailable = false;

/**
 * Initialize Redis connection for rate limiting
 * @param {Object} options - Redis connection options
 */
async function initializeRedis(options = {}) {
  // Only initialize if Redis URL is configured
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST;
  
  if (!redisUrl) {
    logger.warn('⚠️  REDIS_URL not configured - using in-memory rate limiting (not scalable)');
    return false;
  }

  try {
    // Dynamic import to avoid requiring redis when not used
    const { createClient } = await import('redis');
    
    redisClient = createClient({
      url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
      password: process.env.REDIS_PASSWORD || undefined,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection failed after 10 attempts');
            return new Error('Redis reconnection limit reached');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error:', err.message);
      redisAvailable = false;
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis connected for rate limiting');
      redisAvailable = true;
    });

    redisClient.on('reconnecting', () => {
      logger.warn('🔄 Redis reconnecting...');
    });

    await redisClient.connect();
    redisAvailable = true;
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize Redis:', error.message);
    logger.warn('⚠️  Falling back to in-memory rate limiting');
    redisAvailable = false;
    return false;
  }
}

/**
 * Redis store for rate limiting
 */
class RedisStore {
  constructor(options = {}) {
    this.prefix = options.prefix || 'rl:';
    this.windowMs = options.windowMs || 60000;
  }

  async increment(key) {
    if (!redisAvailable || !redisClient) {
      throw new Error('Redis not available');
    }

    const redisKey = `${this.prefix}${key}`;
    
    try {
      const multi = redisClient.multi();
      multi.incr(redisKey);
      multi.pExpire(redisKey, this.windowMs);
      const results = await multi.exec();
      
      const totalHits = results[0];
      const ttl = await redisClient.pTTL(redisKey);
      
      return {
        totalHits,
        resetTime: new Date(Date.now() + ttl),
      };
    } catch (error) {
      logger.error('Redis increment error:', error.message);
      throw error;
    }
  }

  async decrement(key) {
    if (!redisAvailable || !redisClient) return;

    const redisKey = `${this.prefix}${key}`;
    
    try {
      await redisClient.decr(redisKey);
    } catch (error) {
      logger.error('Redis decrement error:', error.message);
    }
  }

  async resetKey(key) {
    if (!redisAvailable || !redisClient) return;

    const redisKey = `${this.prefix}${key}`;
    
    try {
      await redisClient.del(redisKey);
    } catch (error) {
      logger.error('Redis reset error:', error.message);
    }
  }

  async get(key) {
    if (!redisAvailable || !redisClient) return null;

    const redisKey = `${this.prefix}${key}`;
    
    try {
      const [count, ttl] = await Promise.all([
        redisClient.get(redisKey),
        redisClient.pTTL(redisKey),
      ]);
      
      if (count === null) return null;
      
      return {
        totalHits: parseInt(count, 10),
        resetTime: new Date(Date.now() + ttl),
      };
    } catch (error) {
      logger.error('Redis get error:', error.message);
      return null;
    }
  }
}

/**
 * In-memory fallback store
 */
class MemoryStore {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000;
    this.store = new Map();
    
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.store.entries()) {
        if (value.resetTime <= now) {
          this.store.delete(key);
        }
      }
    }, 60000);
  }

  async increment(key) {
    const now = Date.now();
    let record = this.store.get(key);
    
    if (!record || record.resetTime <= now) {
      record = {
        totalHits: 0,
        resetTime: now + this.windowMs,
      };
    }
    
    record.totalHits++;
    this.store.set(key, record);
    
    return {
      totalHits: record.totalHits,
      resetTime: new Date(record.resetTime),
    };
  }

  async decrement(key) {
    const record = this.store.get(key);
    if (record && record.totalHits > 0) {
      record.totalHits--;
    }
  }

  async resetKey(key) {
    this.store.delete(key);
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

/**
 * Create a hybrid store that uses Redis when available, falls back to memory
 */
function createHybridStore(options = {}) {
  const redisStore = new RedisStore(options);
  const memoryStore = new MemoryStore(options);

  return {
    async increment(key) {
      if (redisAvailable) {
        try {
          return await redisStore.increment(key);
        } catch (error) {
          logger.warn('Redis failed, using memory store');
        }
      }
      return await memoryStore.increment(key);
    },

    async decrement(key) {
      if (redisAvailable) {
        try {
          return await redisStore.decrement(key);
        } catch (error) {
          // Ignore
        }
      }
      return await memoryStore.decrement(key);
    },

    async resetKey(key) {
      if (redisAvailable) {
        try {
          return await redisStore.resetKey(key);
        } catch (error) {
          // Ignore
        }
      }
      return await memoryStore.resetKey(key);
    },

    async get(key) {
      if (redisAvailable) {
        try {
          return await redisStore.get(key);
        } catch (error) {
          // Fall through to memory
        }
      }
      return await memoryStore.get(key);
    },

    init: async () => {}, // No-op for compatibility
    shutdown: () => memoryStore.shutdown(),
  };
}

/**
 * Key generator that combines IP and wallet address
 */
function walletKeyGenerator(req) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const wallet = req.body?.solanaAddress || req.query?.wallet || 'anonymous';
  return `${ip}:${wallet}`;
}

/**
 * Create rate limiter with Redis support
 */
function createRedisRateLimiter(options = {}) {
  const {
    windowMs = 60 * 1000, // 1 minute
    max = 100, // 100 requests per window
    message = 'Too many requests, please try again later.',
    keyGenerator = (req) => req.ip,
    prefix = 'rl:',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  const store = createHybridStore({ windowMs, prefix });

  return rateLimit({
    windowMs,
    max,
    message: { error: message, retryAfter: Math.ceil(windowMs / 1000) },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    skip: (req) => {
      // Skip health checks
      if (req.path === '/health' || req.path.endsWith('/health')) {
        return true;
      }
      return false;
    },
    handler: (req, res, next, options) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        key: keyGenerator(req),
      });
      res.status(429).json({
        error: options.message.error,
        retryAfter: options.message.retryAfter,
      });
    },
    store,
    skipSuccessfulRequests,
    skipFailedRequests,
  });
}

// =============================================================================
// Pre-configured Rate Limiters
// =============================================================================

/**
 * General API rate limiter
 * 100 requests per minute
 */
const generalLimiter = createRedisRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  prefix: 'rl:general:',
  message: 'Too many requests. Please slow down.',
});

/**
 * Bridge operations rate limiter (stricter)
 * 10 requests per minute per IP+wallet combination
 */
const bridgeLimiter = createRedisRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  prefix: 'rl:bridge:',
  keyGenerator: walletKeyGenerator,
  message: 'Bridge rate limit exceeded. Please wait before making another bridge request.',
});

/**
 * Admin endpoints rate limiter
 * 30 requests per minute
 */
const adminLimiter = createRedisRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  prefix: 'rl:admin:',
  message: 'Admin rate limit exceeded.',
});

/**
 * Reserve/info endpoints rate limiter
 * 60 requests per minute
 */
const reserveLimiter = createRedisRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  prefix: 'rl:reserve:',
  message: 'Info rate limit exceeded.',
});

/**
 * Wallet-based rate limiter for bridge operations
 * 5 requests per 5 minutes per wallet
 */
const walletBridgeLimiter = createRedisRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 5,
  prefix: 'rl:wallet:bridge:',
  keyGenerator: walletKeyGenerator,
  message: 'Wallet bridge rate limit exceeded. Maximum 5 bridge requests per 5 minutes.',
});

/**
 * Strict rate limiter for sensitive operations
 * 3 requests per 10 minutes
 */
const strictLimiter = createRedisRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 3,
  prefix: 'rl:strict:',
  keyGenerator: walletKeyGenerator,
  message: 'This operation is rate limited. Please try again later.',
});

// =============================================================================
// Exports
// =============================================================================

module.exports = {
  initializeRedis,
  createRedisRateLimiter,
  createHybridStore,
  walletKeyGenerator,
  isRedisAvailable: () => redisAvailable,
  getRedisClient: () => redisClient,
  
  // Pre-configured limiters
  generalLimiter,
  bridgeLimiter,
  adminLimiter,
  reserveLimiter,
  walletBridgeLimiter,
  strictLimiter,
};


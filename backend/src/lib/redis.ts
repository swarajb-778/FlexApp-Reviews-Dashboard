import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

// Redis client instance
let redisClient: RedisClientType | null = null;

/**
 * Create and configure Redis client
 */
const createRedisClient = (): RedisClientType => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  const client = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: 5000,
      lazyConnect: true,
      reconnectStrategy: (retries) => {
        const maxRetries = 10;
        if (retries > maxRetries) {
          logger.error(`Redis connection failed after ${maxRetries} retries`);
          return new Error('Max retries reached');
        }
        
        const delay = Math.min(retries * 100, 3000);
        logger.warn(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
        return delay;
      },
    },
  }) as RedisClientType;

  // Event handlers
  client.on('error', (error) => {
    logger.error('Redis client error:', error);
  });

  client.on('connect', () => {
    logger.info('Redis client connected');
  });

  client.on('ready', () => {
    logger.info('Redis client ready');
  });

  client.on('end', () => {
    logger.info('Redis client connection ended');
  });

  client.on('reconnecting', () => {
    logger.info('Redis client reconnecting');
  });

  return client;
};

/**
 * Get Redis client instance (singleton)
 */
export const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
};

/**
 * Connect to Redis
 */
export const connectRedis = async (): Promise<void> => {
  try {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
      logger.info('Connected to Redis successfully');
    }
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
};

/**
 * Disconnect from Redis
 */
export const disconnectRedis = async (): Promise<void> => {
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
      logger.info('Disconnected from Redis successfully');
    }
    redisClient = null;
  } catch (error) {
    logger.error('Error disconnecting from Redis:', error);
  }
};

/**
 * Test Redis connection
 */
export const testRedisConnection = async (): Promise<boolean> => {
  try {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    
    const pong = await client.ping();
    const isHealthy = pong === 'PONG';
    
    if (isHealthy) {
      logger.info('Redis connection test successful');
    } else {
      logger.warn('Redis connection test failed: unexpected ping response');
    }
    
    return isHealthy;
  } catch (error) {
    logger.error('Redis connection test failed:', error);
    return false;
  }
};

/**
 * Redis health check
 */
export const getRedisHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  latency: number;
  error?: string;
}> => {
  const startTime = Date.now();
  
  try {
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }
    
    await client.ping();
    const latency = Date.now() - startTime;
    
    return {
      status: 'healthy',
      latency,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      status: 'unhealthy',
      latency,
      error: errorMessage,
    };
  }
};

/**
 * Clear keys matching a pattern using SCAN (non-blocking, production-safe)
 */
export const clearByPattern = async (pattern: string): Promise<number> => {
  try {
    const client = getRedisClient();
    let deletedCount = 0;
    const batchSize = 500; // Batch size for pipelined deletions
    let keysBatch: string[] = [];

    // Use SCAN iterator to find keys matching the pattern
    for await (const key of client.scanIterator({ 
      MATCH: pattern, 
      COUNT: 100 // Number of keys to scan per iteration
    })) {
      keysBatch.push(key);

      // Process in batches to avoid overwhelming Redis
      if (keysBatch.length >= batchSize) {
        const pipeline = client.multi();
        keysBatch.forEach(k => pipeline.del(k));
        await pipeline.exec();
        
        deletedCount += keysBatch.length;
        logger.debug(`Deleted batch of ${keysBatch.length} keys matching pattern ${pattern}`);
        keysBatch = [];
      }
    }

    // Process remaining keys
    if (keysBatch.length > 0) {
      const pipeline = client.multi();
      keysBatch.forEach(k => pipeline.del(k));
      await pipeline.exec();
      
      deletedCount += keysBatch.length;
      logger.debug(`Deleted final batch of ${keysBatch.length} keys matching pattern ${pattern}`);
    }

    logger.info(`Successfully cleared ${deletedCount} keys matching pattern: ${pattern}`, {
      pattern,
      deletedCount,
      operation: 'scan_based_clear'
    });

    return deletedCount;
  } catch (error) {
    logger.error(`Failed to clear keys by pattern ${pattern}:`, error);
    return 0;
  }
};

/**
 * Cache utility functions
 */
export const cacheUtils = {
  /**
   * Get value from cache
   */
  get: async <T>(key: string): Promise<T | null> => {
    try {
      const client = getRedisClient();
      const value = await client.get(key);
      return value ? JSON.parse(value) as T : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  },

  /**
   * Set value in cache
   */
  set: async <T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> => {
    try {
      const client = getRedisClient();
      const serialized = JSON.stringify(value);
      
      if (ttlSeconds) {
        await client.setEx(key, ttlSeconds, serialized);
      } else {
        await client.set(key, serialized);
      }
      
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Delete value from cache
   */
  del: async (key: string): Promise<boolean> => {
    try {
      const client = getRedisClient();
      const deleted = await client.del(key);
      return deleted > 0;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Check if key exists in cache
   */
  exists: async (key: string): Promise<boolean> => {
    try {
      const client = getRedisClient();
      const exists = await client.exists(key);
      return exists > 0;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Clear all cache
   */
  flush: async (): Promise<boolean> => {
    try {
      const client = getRedisClient();
      await client.flushAll();
      logger.info('Cache flushed successfully');
      return true;
    } catch (error) {
      logger.error('Cache flush error:', error);
      return false;
    }
  },

  /**
   * Clear keys by pattern using SCAN (production-safe)
   */
  clearByPattern: clearByPattern,
};


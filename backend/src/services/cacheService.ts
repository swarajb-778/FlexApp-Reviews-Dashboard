/**
 * Cache service for high-level caching operations specifically for the reviews API
 * Provides cache key generation, TTL management, invalidation strategies, and metrics
 * Built upon the existing Redis client utilities
 */

import { redisClient, setCache, getCache, deleteCache, clearByPattern } from '../lib/redis';
import { logger } from '../lib/logger';
import {
  ReviewsQueryParams,
  ReviewsApiResponse,
  CacheMetadata,
  CacheOptions,
  NormalizedReview,
  CacheConfig
} from '../types/reviews';

// Get configurable TTL from environment, bounded to 120-300 seconds
function getConfigurableTTL(): number {
  // Use CACHE_DEFAULT_TTL only, no legacy CACHE_TTL support
  const envTtl = parseInt(process.env.CACHE_DEFAULT_TTL || '300');
  return Math.max(120, Math.min(300, envTtl)); // Bound to [120, 300] seconds
}

// Default cache configuration
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttl: getConfigurableTTL(), // Configurable TTL within 2-5 minute requirement
  keyPrefix: process.env.CACHE_PREFIX || 'reviews', // Configurable key prefix
  enabled: true,
  refreshThreshold: 0.8 // Refresh when 80% of TTL has passed
};

// Cache metrics tracking
interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  totalRequests: number;
  lastReset: Date;
}

let cacheMetrics: CacheMetrics = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  errors: 0,
  totalRequests: 0,
  lastReset: new Date()
};

/**
 * Generates a consistent cache key based on query parameters
 */
export function generateCacheKey(
  endpoint: string,
  queryParams: ReviewsQueryParams,
  keyPrefix: string = DEFAULT_CACHE_CONFIG.keyPrefix
): string {
  // Sort parameters for consistent key generation
  const sortedParams = Object.keys(queryParams)
    .filter(key => queryParams[key as keyof ReviewsQueryParams] !== undefined)
    .sort()
    .map(key => {
      const value = queryParams[key as keyof ReviewsQueryParams];
      return `${key}=${encodeURIComponent(String(value))}`;
    })
    .join('&');

  const baseKey = `${keyPrefix}:${endpoint}`;
  return sortedParams ? `${baseKey}:${sortedParams}` : baseKey;
}

/**
 * Stores normalized reviews API response in cache
 */
export async function cacheReviewsResponse(
  cacheKey: string,
  response: ReviewsApiResponse,
  options: CacheOptions = {}
): Promise<boolean> {
  try {
    if (!DEFAULT_CACHE_CONFIG.enabled) {
      logger.debug('Caching disabled, skipping cache set');
      return false;
    }

    // Apply jitter if no TTL was explicitly provided
    let ttl = options.ttl || DEFAULT_CACHE_CONFIG.ttl;
    if (!options.ttl) {
      // Add random jitter of 0-30 seconds to prevent thundering herd
      const jitter = Math.floor(Math.random() * 30);
      ttl = ttl + jitter;
      logger.debug('Applied TTL jitter', { baseTtl: DEFAULT_CACHE_CONFIG.ttl, jitter, finalTtl: ttl });
    }
    
    // Create cache metadata
    const metadata: CacheMetadata = {
      key: cacheKey,
      ttl,
      createdAt: new Date().toISOString(),
      source: response.data.meta.source,
      queryParams: response.data.filters as ReviewsQueryParams
    };

    // Store both response and metadata
    const cacheData = {
      response,
      metadata,
      cachedAt: new Date().toISOString()
    };

    const success = await setCache(cacheKey, JSON.stringify(cacheData), ttl);
    
    if (success) {
      cacheMetrics.sets++;
      logger.debug('Successfully cached reviews response', {
        cacheKey,
        ttl,
        reviewCount: response.data.reviews.length
      });
    } else {
      cacheMetrics.errors++;
      logger.error('Failed to cache reviews response', { cacheKey });
    }

    return success;
  } catch (error) {
    cacheMetrics.errors++;
    logger.error('Error caching reviews response', {
      cacheKey,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Retrieves cached reviews API response
 */
export async function getCachedReviewsResponse(
  cacheKey: string
): Promise<{ response: ReviewsApiResponse; metadata: CacheMetadata } | null> {
  try {
    cacheMetrics.totalRequests++;

    if (!DEFAULT_CACHE_CONFIG.enabled) {
      logger.debug('Caching disabled, skipping cache get');
      cacheMetrics.misses++;
      return null;
    }

    const cachedData = await getCache(cacheKey);
    
    if (!cachedData) {
      cacheMetrics.misses++;
      logger.debug('Cache miss', { cacheKey });
      return null;
    }

    const parsedData = JSON.parse(cachedData);
    const { response, metadata } = parsedData;

    // Update response metadata to indicate it came from cache
    if (response && response.data && response.data.meta) {
      response.data.meta.cached = true;
      response.data.meta.cacheKey = cacheKey;
      response.data.meta.processedAt = new Date().toISOString();
    }

    cacheMetrics.hits++;
    logger.debug('Cache hit', {
      cacheKey,
      reviewCount: response?.data?.reviews?.length || 0
    });

    return { response, metadata };
  } catch (error) {
    cacheMetrics.errors++;
    cacheMetrics.misses++;
    logger.error('Error retrieving cached reviews response', {
      cacheKey,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Invalidates cache entries based on patterns or specific keys
 */
export async function invalidateCache(
  pattern?: string,
  specificKey?: string
): Promise<number> {
  try {
    let deletedCount = 0;

    if (specificKey) {
      // Delete specific cache key
      const success = await deleteCache(specificKey);
      deletedCount = success ? 1 : 0;
      logger.debug('Invalidated specific cache key', { specificKey, success });
    }

    if (pattern) {
      // Delete all keys matching pattern using SCAN-based approach
      deletedCount += await clearByPattern(pattern);
      logger.debug('Invalidated cache pattern', { pattern, deletedCount });
    }

    if (!specificKey && !pattern) {
      // Clear all review cache entries using SCAN-based approach
      const reviewPattern = `${DEFAULT_CACHE_CONFIG.keyPrefix}:*`;
      deletedCount = await clearByPattern(reviewPattern);
      logger.info('Cleared all review cache entries', { deletedCount });
    }

    cacheMetrics.deletes += deletedCount;
    return deletedCount;
  } catch (error) {
    cacheMetrics.errors++;
    logger.error('Error invalidating cache', {
      pattern,
      specificKey,
      error: error instanceof Error ? error.message : String(error)
    });
    return 0;
  }
}

/**
 * Invalidates cache for a specific listing when reviews are approved/unapproved
 */
export async function invalidateListingCache(listingId: number): Promise<number> {
  try {
    const pattern = `${DEFAULT_CACHE_CONFIG.keyPrefix}:*listingId=${listingId}*`;
    const deletedCount = await invalidateCache(pattern);
    
    logger.info('Invalidated listing cache', { listingId, deletedCount });
    return deletedCount;
  } catch (error) {
    logger.error('Error invalidating listing cache', {
      listingId,
      error: error instanceof Error ? error.message : String(error)
    });
    return 0;
  }
}

/**
 * Invalidates all review list caches when reviews are modified
 * This includes all paginated review lists and filtered results
 */
export async function invalidateReviewListCaches(): Promise<number> {
  try {
    // Invalidate all review management response caches
    const pattern = `${DEFAULT_CACHE_CONFIG.keyPrefix}:reviews*`;
    const deletedCount = await invalidateCache(pattern);
    
    logger.info('Invalidated review list caches', { deletedCount, pattern });
    return deletedCount;
  } catch (error) {
    logger.error('Error invalidating review list caches', {
      error: error instanceof Error ? error.message : String(error)
    });
    return 0;
  }
}

/**
 * Determines if cache entry should be refreshed based on age and threshold
 */
export async function shouldRefreshCache(
  cacheKey: string,
  refreshThreshold: number = DEFAULT_CACHE_CONFIG.refreshThreshold
): Promise<boolean> {
  try {
    const cachedData = await getCachedReviewsResponse(cacheKey);
    
    if (!cachedData) {
      return true; // No cache entry, needs refresh
    }

    const { metadata } = cachedData;
    const cacheAge = Date.now() - new Date(metadata.createdAt).getTime();
    const maxAge = metadata.ttl * 1000; // Convert TTL to milliseconds
    const refreshAge = maxAge * refreshThreshold;

    const shouldRefresh = cacheAge > refreshAge;
    
    logger.debug('Cache refresh check', {
      cacheKey,
      cacheAge,
      maxAge,
      refreshAge,
      shouldRefresh
    });

    return shouldRefresh;
  } catch (error) {
    logger.error('Error checking cache refresh status', {
      cacheKey,
      error: error instanceof Error ? error.message : String(error)
    });
    return true; // Err on the side of refreshing
  }
}

/**
 * Preloads cache with popular queries to improve performance
 */
export async function preloadCache(
  popularQueries: ReviewsQueryParams[],
  dataFetcher: (params: ReviewsQueryParams) => Promise<ReviewsApiResponse>
): Promise<void> {
  logger.info('Starting cache preloading', { queryCount: popularQueries.length });

  const preloadPromises = popularQueries.map(async (queryParams) => {
    try {
      const cacheKey = generateCacheKey('hostaway', queryParams);
      const existingCache = await getCachedReviewsResponse(cacheKey);

      // Only preload if not already cached or needs refresh
      if (!existingCache || await shouldRefreshCache(cacheKey)) {
        const response = await dataFetcher(queryParams);
        await cacheReviewsResponse(cacheKey, response);
        logger.debug('Preloaded cache entry', { cacheKey });
      }
    } catch (error) {
      logger.error('Error preloading cache entry', {
        queryParams,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  await Promise.allSettled(preloadPromises);
  logger.info('Cache preloading completed');
}

/**
 * Gets current cache metrics
 */
export function getCacheMetrics(): CacheMetrics & { hitRate: number; errorRate: number } {
  const hitRate = cacheMetrics.totalRequests > 0 
    ? Math.round((cacheMetrics.hits / cacheMetrics.totalRequests) * 100) / 100
    : 0;
  
  const errorRate = cacheMetrics.totalRequests > 0
    ? Math.round((cacheMetrics.errors / cacheMetrics.totalRequests) * 100) / 100
    : 0;

  return {
    ...cacheMetrics,
    hitRate,
    errorRate
  };
}

/**
 * Resets cache metrics
 */
export function resetCacheMetrics(): void {
  cacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    totalRequests: 0,
    lastReset: new Date()
  };
  
  logger.info('Cache metrics reset');
}

/**
 * Gets detailed information about a specific cache entry
 */
export async function getCacheInfo(cacheKey: string): Promise<{
  exists: boolean;
  metadata?: CacheMetadata;
  size?: number;
  ttl?: number;
  age?: number;
} | null> {
  try {
    const cachedData = await getCachedReviewsResponse(cacheKey);
    
    if (!cachedData) {
      return { exists: false };
    }

    const { metadata } = cachedData;
    const age = Date.now() - new Date(metadata.createdAt).getTime();
    const remainingTtl = Math.max(0, (metadata.ttl * 1000) - age);

    // Get approximate size (this is an estimation)
    const dataSize = JSON.stringify(cachedData).length;

    return {
      exists: true,
      metadata,
      size: dataSize,
      ttl: Math.round(remainingTtl / 1000),
      age: Math.round(age / 1000)
    };
  } catch (error) {
    logger.error('Error getting cache info', {
      cacheKey,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Bulk cache operations for multiple keys
 */
export async function bulkCacheOperations(operations: {
  type: 'set' | 'get' | 'delete';
  key: string;
  value?: any;
  ttl?: number;
}[]): Promise<{ success: number; failed: number; results: any[] }> {
  const results: any[] = [];
  let success = 0;
  let failed = 0;

  for (const op of operations) {
    try {
      let result;
      
      switch (op.type) {
        case 'set':
          result = await setCache(op.key, JSON.stringify(op.value), op.ttl || DEFAULT_CACHE_CONFIG.ttl);
          if (result) success++;
          else failed++;
          break;
          
        case 'get':
          result = await getCache(op.key);
          result = result ? JSON.parse(result) : null;
          success++;
          break;
          
        case 'delete':
          result = await deleteCache(op.key);
          if (result) success++;
          else failed++;
          break;
          
        default:
          failed++;
          result = null;
      }
      
      results.push(result);
    } catch (error) {
      failed++;
      results.push(null);
      logger.error('Bulk cache operation failed', {
        operation: op,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  logger.debug('Bulk cache operations completed', {
    total: operations.length,
    success,
    failed
  });

  return { success, failed, results };
}

/**
 * Health check for cache service
 */
export async function cacheHealthCheck(): Promise<{
  healthy: boolean;
  details: {
    redis_connected: boolean;
    cache_enabled: boolean;
    metrics: ReturnType<typeof getCacheMetrics>;
    test_operation: boolean;
  };
}> {
  try {
    // Check Redis connection
    const redisConnected = redisClient.isReady;
    
    // Test basic cache operations
    const testKey = `${DEFAULT_CACHE_CONFIG.keyPrefix}:health:${Date.now()}`;
    const testValue = { test: true, timestamp: new Date().toISOString() };
    
    let testOperationSuccess = false;
    try {
      await setCache(testKey, JSON.stringify(testValue), 10); // 10 second TTL
      const retrieved = await getCache(testKey);
      testOperationSuccess = retrieved === JSON.stringify(testValue);
      await deleteCache(testKey); // Cleanup
    } catch {
      testOperationSuccess = false;
    }

    const metrics = getCacheMetrics();
    const healthy = redisConnected && testOperationSuccess;

    return {
      healthy,
      details: {
        redis_connected: redisConnected,
        cache_enabled: DEFAULT_CACHE_CONFIG.enabled,
        metrics,
        test_operation: testOperationSuccess
      }
    };
  } catch (error) {
    logger.error('Cache health check failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      healthy: false,
      details: {
        redis_connected: false,
        cache_enabled: DEFAULT_CACHE_CONFIG.enabled,
        metrics: getCacheMetrics(),
        test_operation: false
      }
    };
  }
}

/**
 * Configures cache settings at runtime
 */
export function configureCacheService(config: Partial<CacheConfig>): void {
  Object.assign(DEFAULT_CACHE_CONFIG, config);
  logger.info('Cache service configuration updated', { config: DEFAULT_CACHE_CONFIG });
}

/**
 * Gets current cache configuration
 */
export function getCacheConfiguration(): CacheConfig {
  return { ...DEFAULT_CACHE_CONFIG };
}

/**
 * Generic cache response functions that can be used for any API response type
 */
export async function getCachedResponse<T>(
  cacheKey: string
): Promise<{ response: T; metadata: CacheMetadata } | null> {
  try {
    cacheMetrics.totalRequests++;

    if (!DEFAULT_CACHE_CONFIG.enabled) {
      logger.debug('Caching disabled, skipping cache get');
      cacheMetrics.misses++;
      return null;
    }

    const cachedData = await getCache(cacheKey);
    
    if (!cachedData) {
      cacheMetrics.misses++;
      logger.debug('Cache miss', { cacheKey });
      return null;
    }

    const parsedData = JSON.parse(cachedData);
    const { response, metadata } = parsedData;

    // Update response metadata to indicate it came from cache if it has meta field
    if (response && response.data && response.data.meta) {
      response.data.meta.cached = true;
      response.data.meta.cacheKey = cacheKey;
      response.data.meta.processedAt = new Date().toISOString();
    }

    cacheMetrics.hits++;
    logger.debug('Cache hit', {
      cacheKey,
      dataType: typeof response
    });

    return { response, metadata };
  } catch (error) {
    cacheMetrics.errors++;
    cacheMetrics.misses++;
    logger.error('Error retrieving cached response', {
      cacheKey,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Retrieves cached ReviewManagementResponse
 */
export async function getCachedReviewManagementResponse(
  cacheKey: string
): Promise<{ response: any; metadata: CacheMetadata } | null> {
  try {
    cacheMetrics.totalRequests++;

    if (!DEFAULT_CACHE_CONFIG.enabled) {
      logger.debug('Caching disabled, skipping cache get');
      cacheMetrics.misses++;
      return null;
    }

    const cachedData = await getCache(cacheKey);
    
    if (!cachedData) {
      cacheMetrics.misses++;
      logger.debug('Cache miss', { cacheKey });
      return null;
    }

    const parsedData = JSON.parse(cachedData);
    const { response, metadata } = parsedData;

    // Update response metadata to indicate it came from cache
    if (response && response.data && response.data.meta) {
      response.data.meta.cached = true;
      response.data.meta.cacheKey = cacheKey;
      response.data.meta.processedAt = new Date().toISOString();
    }

    cacheMetrics.hits++;
    logger.debug('Cache hit', {
      cacheKey,
      reviewCount: response?.data?.reviews?.length || 0
    });

    return { response, metadata };
  } catch (error) {
    cacheMetrics.errors++;
    cacheMetrics.misses++;
    logger.error('Error retrieving cached review management response', {
      cacheKey,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Stores ReviewManagementResponse in cache
 */
export async function cacheReviewManagementResponse(
  cacheKey: string,
  response: any,
  options: CacheOptions = {}
): Promise<boolean> {
  try {
    if (!DEFAULT_CACHE_CONFIG.enabled) {
      logger.debug('Caching disabled, skipping cache set');
      return false;
    }

    // Apply jitter if no TTL was explicitly provided
    let ttl = options.ttl || DEFAULT_CACHE_CONFIG.ttl;
    if (!options.ttl) {
      // Add random jitter of 0-30 seconds to prevent thundering herd
      const jitter = Math.floor(Math.random() * 30);
      ttl = ttl + jitter;
      logger.debug('Applied TTL jitter', { baseTtl: DEFAULT_CACHE_CONFIG.ttl, jitter, finalTtl: ttl });
    }
    
    // Create cache metadata
    const metadata: CacheMetadata = {
      key: cacheKey,
      ttl,
      createdAt: new Date().toISOString(),
      source: response.data.meta.source || 'database',
      queryParams: response.data.filters as any
    };

    // Store both response and metadata
    const cacheData = {
      response,
      metadata,
      cachedAt: new Date().toISOString()
    };

    const success = await setCache(cacheKey, JSON.stringify(cacheData), ttl);
    
    if (success) {
      cacheMetrics.sets++;
      logger.debug('Successfully cached review management response', {
        cacheKey,
        ttl,
        reviewCount: response.data.reviews?.length || 0
      });
    } else {
      cacheMetrics.errors++;
      logger.error('Failed to cache review management response', { cacheKey });
    }

    return success;
  } catch (error) {
    cacheMetrics.errors++;
    logger.error('Error caching review management response', {
      cacheKey,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

export async function cacheResponse<T>(
  cacheKey: string,
  response: T,
  options: CacheOptions = {}
): Promise<boolean> {
  try {
    if (!DEFAULT_CACHE_CONFIG.enabled) {
      logger.debug('Caching disabled, skipping cache set');
      return false;
    }

    // Apply jitter if no TTL was explicitly provided
    let ttl = options.ttl || DEFAULT_CACHE_CONFIG.ttl;
    if (!options.ttl) {
      // Add random jitter of 0-30 seconds to prevent thundering herd
      const jitter = Math.floor(Math.random() * 30);
      ttl = ttl + jitter;
      logger.debug('Applied TTL jitter', { baseTtl: DEFAULT_CACHE_CONFIG.ttl, jitter, finalTtl: ttl });
    }
    
    // Create cache metadata
    const metadata: CacheMetadata = {
      key: cacheKey,
      ttl,
      createdAt: new Date().toISOString(),
      source: 'database', // Default source for generic responses
      queryParams: {} // Empty for generic responses
    };

    // Store both response and metadata
    const cacheData = {
      response,
      metadata,
      cachedAt: new Date().toISOString()
    };

    const success = await setCache(cacheKey, JSON.stringify(cacheData), ttl);
    
    if (success) {
      cacheMetrics.sets++;
      logger.debug('Successfully cached response', {
        cacheKey,
        ttl,
        dataType: typeof response
      });
    } else {
      cacheMetrics.errors++;
      logger.error('Failed to cache response', { cacheKey });
    }

    return success;
  } catch (error) {
    cacheMetrics.errors++;
    logger.error('Error caching response', {
      cacheKey,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

// Export all cache service functions
export {
  generateCacheKey,
  cacheReviewsResponse,
  getCachedReviewsResponse,
  getCachedReviewManagementResponse,
  cacheReviewManagementResponse,
  getCachedResponse,
  cacheResponse,
  invalidateCache,
  invalidateListingCache,
  invalidateReviewListCaches,
  shouldRefreshCache,
  preloadCache,
  getCacheMetrics,
  resetCacheMetrics,
  getCacheInfo,
  bulkCacheOperations,
  cacheHealthCheck,
  configureCacheService,
  getCacheConfiguration
};

/**
 * Unit tests for the cache service
 * Tests caching logic, TTL behavior, cache key generation, and invalidation
 */

import {
  generateCacheKey,
  cacheReviewsResponse,
  getCachedReviewsResponse,
  invalidateCache,
  invalidateListingCache,
  shouldRefreshCache,
  getCacheMetrics,
  resetCacheMetrics,
  getCacheInfo,
  cacheHealthCheck,
  configureCacheService,
  getCacheConfiguration
} from '../services/cacheService';
import { setCache, getCache, deleteCache, deletePattern } from '../lib/redis';
import {
  ReviewsQueryParams,
  ReviewsApiResponse,
  NormalizedReview
} from '../types/reviews';

// Mock Redis functions
jest.mock('../lib/redis', () => ({
  redisClient: {
    isReady: true
  },
  setCache: jest.fn(),
  getCache: jest.fn(),
  deleteCache: jest.fn(),
  deletePattern: jest.fn()
}));

const mockedSetCache = setCache as jest.MockedFunction<typeof setCache>;
const mockedGetCache = getCache as jest.MockedFunction<typeof getCache>;
const mockedDeleteCache = deleteCache as jest.MockedFunction<typeof deleteCache>;
const mockedDeletePattern = deletePattern as jest.MockedFunction<typeof deletePattern>;

describe('Cache Service', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    resetCacheMetrics();
  });

  describe('generateCacheKey', () => {
    it('should generate consistent cache keys', () => {
      const params: ReviewsQueryParams = {
        listingId: 123,
        page: 1,
        limit: 20,
        approved: true
      };

      const key1 = generateCacheKey('hostaway', params);
      const key2 = generateCacheKey('hostaway', params);

      expect(key1).toBe(key2);
      expect(key1).toContain('reviews:hostaway');
      expect(key1).toContain('listingId=123');
      expect(key1).toContain('approved=true');
    });

    it('should generate different keys for different parameters', () => {
      const params1: ReviewsQueryParams = { listingId: 123, page: 1 };
      const params2: ReviewsQueryParams = { listingId: 456, page: 1 };

      const key1 = generateCacheKey('hostaway', params1);
      const key2 = generateCacheKey('hostaway', params2);

      expect(key1).not.toBe(key2);
    });

    it('should handle empty parameters', () => {
      const key = generateCacheKey('hostaway', {});
      expect(key).toBe('reviews:hostaway');
    });

    it('should sort parameters for consistency', () => {
      const params1: ReviewsQueryParams = { listingId: 123, page: 1, approved: true };
      const params2: ReviewsQueryParams = { approved: true, page: 1, listingId: 123 };

      const key1 = generateCacheKey('hostaway', params1);
      const key2 = generateCacheKey('hostaway', params2);

      expect(key1).toBe(key2);
    });

    it('should encode URL-unsafe characters', () => {
      const params: ReviewsQueryParams = { from: '2024-01-01T00:00:00Z' };
      const key = generateCacheKey('hostaway', params);

      expect(key).toContain('from=2024-01-01T00%3A00%3A00Z');
    });
  });

  describe('cacheReviewsResponse', () => {
    const sampleResponse: ReviewsApiResponse = {
      status: 'success',
      data: {
        reviews: [] as NormalizedReview[],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        },
        filters: {},
        meta: {
          cached: false,
          processedAt: '2024-01-15T14:30:00.000Z',
          source: 'hostaway'
        }
      }
    };

    it('should cache response successfully', async () => {
      mockedSetCache.mockResolvedValue(true);

      const result = await cacheReviewsResponse('test-key', sampleResponse);

      expect(result).toBe(true);
      expect(mockedSetCache).toHaveBeenCalledWith(
        'test-key',
        expect.any(String),
        300 // Default TTL
      );

      const metrics = getCacheMetrics();
      expect(metrics.sets).toBe(1);
    });

    it('should handle cache failure gracefully', async () => {
      mockedSetCache.mockResolvedValue(false);

      const result = await cacheReviewsResponse('test-key', sampleResponse);

      expect(result).toBe(false);

      const metrics = getCacheMetrics();
      expect(metrics.errors).toBe(1);
    });

    it('should use custom TTL when provided', async () => {
      mockedSetCache.mockResolvedValue(true);

      await cacheReviewsResponse('test-key', sampleResponse, { ttl: 600 });

      expect(mockedSetCache).toHaveBeenCalledWith(
        'test-key',
        expect.any(String),
        600
      );
    });

    it('should include metadata in cached data', async () => {
      mockedSetCache.mockResolvedValue(true);

      await cacheReviewsResponse('test-key', sampleResponse);

      const cachedData = JSON.parse(mockedSetCache.mock.calls[0][1]);
      expect(cachedData.response).toBeDefined();
      expect(cachedData.metadata).toBeDefined();
      expect(cachedData.cachedAt).toBeDefined();
      expect(cachedData.metadata.key).toBe('test-key');
      expect(cachedData.metadata.source).toBe('hostaway');
    });
  });

  describe('getCachedReviewsResponse', () => {
    it('should retrieve cached response successfully', async () => {
      const cachedData = {
        response: {
          status: 'success',
          data: {
            reviews: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
            filters: {},
            meta: { cached: false, processedAt: '2024-01-15T14:30:00.000Z', source: 'hostaway' }
          }
        },
        metadata: {
          key: 'test-key',
          ttl: 300,
          createdAt: '2024-01-15T14:30:00.000Z',
          source: 'hostaway',
          queryParams: {}
        },
        cachedAt: '2024-01-15T14:30:00.000Z'
      };

      mockedGetCache.mockResolvedValue(JSON.stringify(cachedData));

      const result = await getCachedReviewsResponse('test-key');

      expect(result).toBeTruthy();
      expect(result!.response.data.meta.cached).toBe(true);
      expect(result!.response.data.meta.cacheKey).toBe('test-key');
      expect(result!.metadata).toEqual(cachedData.metadata);

      const metrics = getCacheMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.totalRequests).toBe(1);
    });

    it('should handle cache miss', async () => {
      mockedGetCache.mockResolvedValue(null);

      const result = await getCachedReviewsResponse('test-key');

      expect(result).toBeNull();

      const metrics = getCacheMetrics();
      expect(metrics.misses).toBe(1);
      expect(metrics.totalRequests).toBe(1);
    });

    it('should handle corrupted cache data', async () => {
      mockedGetCache.mockResolvedValue('invalid-json');

      const result = await getCachedReviewsResponse('test-key');

      expect(result).toBeNull();

      const metrics = getCacheMetrics();
      expect(metrics.errors).toBe(1);
      expect(metrics.misses).toBe(1);
    });

    it('should handle Redis errors gracefully', async () => {
      mockedGetCache.mockRejectedValue(new Error('Redis connection failed'));

      const result = await getCachedReviewsResponse('test-key');

      expect(result).toBeNull();

      const metrics = getCacheMetrics();
      expect(metrics.errors).toBe(1);
      expect(metrics.misses).toBe(1);
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate specific cache key', async () => {
      mockedDeleteCache.mockResolvedValue(true);

      const result = await invalidateCache(undefined, 'test-key');

      expect(result).toBe(1);
      expect(mockedDeleteCache).toHaveBeenCalledWith('test-key');

      const metrics = getCacheMetrics();
      expect(metrics.deletes).toBe(1);
    });

    it('should invalidate cache pattern', async () => {
      mockedDeletePattern.mockResolvedValue(5);

      const result = await invalidateCache('test-pattern*');

      expect(result).toBe(5);
      expect(mockedDeletePattern).toHaveBeenCalledWith('test-pattern*');

      const metrics = getCacheMetrics();
      expect(metrics.deletes).toBe(5);
    });

    it('should clear all review cache entries when no parameters provided', async () => {
      mockedDeletePattern.mockResolvedValue(10);

      const result = await invalidateCache();

      expect(result).toBe(10);
      expect(mockedDeletePattern).toHaveBeenCalledWith('reviews:*');

      const metrics = getCacheMetrics();
      expect(metrics.deletes).toBe(10);
    });

    it('should handle invalidation errors', async () => {
      mockedDeleteCache.mockRejectedValue(new Error('Redis error'));

      const result = await invalidateCache(undefined, 'test-key');

      expect(result).toBe(0);

      const metrics = getCacheMetrics();
      expect(metrics.errors).toBe(1);
    });
  });

  describe('invalidateListingCache', () => {
    it('should invalidate cache for specific listing', async () => {
      mockedDeletePattern.mockResolvedValue(3);

      const result = await invalidateListingCache(123);

      expect(result).toBe(3);
      expect(mockedDeletePattern).toHaveBeenCalledWith('reviews:*listingId=123*');
    });
  });

  describe('shouldRefreshCache', () => {
    it('should suggest refresh when cache is old enough', async () => {
      const oldCacheData = {
        response: {
          status: 'success',
          data: {
            reviews: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
            filters: {},
            meta: { cached: false, processedAt: '2024-01-15T14:30:00.000Z', source: 'hostaway' }
          }
        },
        metadata: {
          key: 'test-key',
          ttl: 300, // 5 minutes
          createdAt: new Date(Date.now() - 250000).toISOString(), // 4 minutes 10 seconds ago
          source: 'hostaway',
          queryParams: {}
        }
      };

      mockedGetCache.mockResolvedValue(JSON.stringify(oldCacheData));

      // With default threshold of 0.8 (80%), should refresh after 4 minutes
      const shouldRefresh = await shouldRefreshCache('test-key');

      expect(shouldRefresh).toBe(true);
    });

    it('should not suggest refresh when cache is still fresh', async () => {
      const freshCacheData = {
        response: {
          status: 'success',
          data: {
            reviews: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
            filters: {},
            meta: { cached: false, processedAt: '2024-01-15T14:30:00.000Z', source: 'hostaway' }
          }
        },
        metadata: {
          key: 'test-key',
          ttl: 300,
          createdAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
          source: 'hostaway',
          queryParams: {}
        }
      };

      mockedGetCache.mockResolvedValue(JSON.stringify(freshCacheData));

      const shouldRefresh = await shouldRefreshCache('test-key');

      expect(shouldRefresh).toBe(false);
    });

    it('should suggest refresh when no cache exists', async () => {
      mockedGetCache.mockResolvedValue(null);

      const shouldRefresh = await shouldRefreshCache('test-key');

      expect(shouldRefresh).toBe(true);
    });

    it('should use custom refresh threshold', async () => {
      const cacheData = {
        response: {
          status: 'success',
          data: {
            reviews: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
            filters: {},
            meta: { cached: false, processedAt: '2024-01-15T14:30:00.000Z', source: 'hostaway' }
          }
        },
        metadata: {
          key: 'test-key',
          ttl: 300,
          createdAt: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
          source: 'hostaway',
          queryParams: {}
        }
      };

      mockedGetCache.mockResolvedValue(JSON.stringify(cacheData));

      // With threshold of 0.3 (30%), should refresh after 1.5 minutes
      const shouldRefresh = await shouldRefreshCache('test-key', 0.3);

      expect(shouldRefresh).toBe(true);
    });
  });

  describe('getCacheMetrics', () => {
    it('should return cache metrics with calculated rates', () => {
      // Simulate some cache operations
      resetCacheMetrics();
      
      // Manually trigger some operations to test metrics
      const testOperations = async () => {
        mockedGetCache.mockResolvedValue('test-data');
        await getCachedReviewsResponse('test1'); // hit
        
        mockedGetCache.mockResolvedValue(null);
        await getCachedReviewsResponse('test2'); // miss
        
        mockedSetCache.mockResolvedValue(false);
        await cacheReviewsResponse('test3', {} as any); // error
      };

      return testOperations().then(() => {
        const metrics = getCacheMetrics();
        
        expect(metrics.totalRequests).toBe(2); // Only GET operations count
        expect(metrics.hits).toBe(1);
        expect(metrics.misses).toBe(1);
        expect(metrics.errors).toBe(1);
        expect(metrics.hitRate).toBe(0.5); // 1/2
        expect(metrics.errorRate).toBe(0.5); // 1/2
      });
    });

    it('should handle zero requests gracefully', () => {
      resetCacheMetrics();
      
      const metrics = getCacheMetrics();
      
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.hitRate).toBe(0);
      expect(metrics.errorRate).toBe(0);
    });
  });

  describe('getCacheInfo', () => {
    it('should return detailed cache information', async () => {
      const cacheData = {
        response: {
          status: 'success',
          data: {
            reviews: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
            filters: {},
            meta: { cached: false, processedAt: '2024-01-15T14:30:00.000Z', source: 'hostaway' }
          }
        },
        metadata: {
          key: 'test-key',
          ttl: 300,
          createdAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
          source: 'hostaway',
          queryParams: {}
        }
      };

      mockedGetCache.mockResolvedValue(JSON.stringify(cacheData));

      const info = await getCacheInfo('test-key');

      expect(info).toBeTruthy();
      expect(info!.exists).toBe(true);
      expect(info!.metadata).toEqual(cacheData.metadata);
      expect(info!.size).toBeGreaterThan(0);
      expect(info!.ttl).toBeLessThan(300);
      expect(info!.age).toBeGreaterThan(0);
    });

    it('should handle non-existent cache key', async () => {
      mockedGetCache.mockResolvedValue(null);

      const info = await getCacheInfo('non-existent');

      expect(info).toEqual({ exists: false });
    });
  });

  describe('cacheHealthCheck', () => {
    it('should return healthy status when everything works', async () => {
      mockedSetCache.mockResolvedValue(true);
      mockedGetCache.mockResolvedValue('{"test":true,"timestamp":"2024-01-15T14:30:00.000Z"}');
      mockedDeleteCache.mockResolvedValue(true);

      const health = await cacheHealthCheck();

      expect(health.healthy).toBe(true);
      expect(health.details.redis_connected).toBe(true);
      expect(health.details.cache_enabled).toBe(true);
      expect(health.details.test_operation).toBe(true);
    });

    it('should return unhealthy status when test operation fails', async () => {
      mockedSetCache.mockResolvedValue(false);

      const health = await cacheHealthCheck();

      expect(health.healthy).toBe(false);
      expect(health.details.test_operation).toBe(false);
    });
  });

  describe('configureCacheService', () => {
    it('should update cache configuration', () => {
      const originalConfig = getCacheConfiguration();
      
      configureCacheService({
        ttl: 600,
        enabled: false
      });

      const newConfig = getCacheConfiguration();
      expect(newConfig.ttl).toBe(600);
      expect(newConfig.enabled).toBe(false);
      expect(newConfig.keyPrefix).toBe(originalConfig.keyPrefix); // Should remain unchanged
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete cache workflow', async () => {
      const params: ReviewsQueryParams = { listingId: 123, page: 1 };
      const response: ReviewsApiResponse = {
        status: 'success',
        data: {
          reviews: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
          filters: { listingId: 123 },
          meta: { cached: false, processedAt: '2024-01-15T14:30:00.000Z', source: 'hostaway' }
        }
      };

      // Generate cache key
      const cacheKey = generateCacheKey('hostaway', params);
      expect(cacheKey).toContain('listingId=123');

      // Cache miss
      mockedGetCache.mockResolvedValue(null);
      const cached1 = await getCachedReviewsResponse(cacheKey);
      expect(cached1).toBeNull();

      // Cache the response
      mockedSetCache.mockResolvedValue(true);
      const cacheResult = await cacheReviewsResponse(cacheKey, response);
      expect(cacheResult).toBe(true);

      // Cache hit
      const cachedData = {
        response,
        metadata: {
          key: cacheKey,
          ttl: 300,
          createdAt: new Date().toISOString(),
          source: 'hostaway',
          queryParams: params
        }
      };
      mockedGetCache.mockResolvedValue(JSON.stringify(cachedData));
      
      const cached2 = await getCachedReviewsResponse(cacheKey);
      expect(cached2).toBeTruthy();
      expect(cached2!.response.data.meta.cached).toBe(true);

      // Invalidate cache
      mockedDeletePattern.mockResolvedValue(1);
      const invalidated = await invalidateListingCache(123);
      expect(invalidated).toBe(1);

      // Check metrics
      const metrics = getCacheMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
      expect(metrics.sets).toBe(1);
      expect(metrics.deletes).toBe(1);
    });
  });
});

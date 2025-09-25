/**
 * Integration tests for the Hostaway API endpoint
 * Tests the complete API flow including caching, filtering, pagination, and error handling
 */

import request from 'supertest';
import app from '../app';
import {
  setCache,
  getCache,
  deleteCache,
  connectRedis,
  disconnectRedis
} from '../lib/redis';
import * as hostawayClient from '../services/hostawayClient';
import * as cacheService from '../services/cacheService';
import { HostawayApiResponse } from '../types/reviews';

// Mock the Redis functions
jest.mock('../lib/redis', () => ({
  redisClient: { isReady: true },
  connectRedis: jest.fn(),
  disconnectRedis: jest.fn(),
  testRedisConnection: jest.fn().mockResolvedValue(true),
  setCache: jest.fn(),
  getCache: jest.fn(),
  deleteCache: jest.fn(),
  deletePattern: jest.fn()
}));

// Mock the Hostaway client
jest.mock('../services/hostawayClient');

const mockedSetCache = setCache as jest.MockedFunction<typeof setCache>;
const mockedGetCache = getCache as jest.MockedFunction<typeof getCache>;
const mockedDeleteCache = deleteCache as jest.MockedFunction<typeof deleteCache>;
const mockedFetchHostawayReviews = hostawayClient.fetchHostawayReviews as jest.MockedFunction<typeof hostawayClient.fetchHostawayReviews>;
const mockedFetchReviewsWithSource = hostawayClient.fetchReviewsWithSource as jest.MockedFunction<typeof hostawayClient.fetchReviewsWithSource>;
const mockedGetHostawayApiMetrics = hostawayClient.getHostawayApiMetrics as jest.MockedFunction<typeof hostawayClient.getHostawayApiMetrics>;
const mockedHostawayHealthCheck = hostawayClient.hostawayHealthCheck as jest.MockedFunction<typeof hostawayClient.hostawayHealthCheck>;

describe('Hostaway API Integration Tests', () => {
  beforeAll(async () => {
    // Mock Redis connection
    (connectRedis as jest.Mock).mockResolvedValue(undefined);
  });

  afterAll(async () => {
    // Mock Redis disconnection
    (disconnectRedis as jest.Mock).mockResolvedValue(undefined);
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Reset cache service metrics
    cacheService.resetCacheMetrics();
  });

  describe('GET /api/reviews/hostaway', () => {
    it('should return requirement simple format when format=simple is used', async () => {
      mockedGetCache.mockResolvedValue(null);
      mockedFetchReviewsWithSource.mockResolvedValue({
        response: mockHostawayResponse,
        source: 'hostaway'
      });
      mockedSetCache.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ format: 'simple', page: 1, limit: 5 })
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(Array.isArray(response.body.data)).toBe(true);
      if (response.body.data.length > 0) {
        const item = response.body.data[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('hostawayId');
        expect(item).toHaveProperty('listingName');
        expect(item).toHaveProperty('listingId');
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('channel');
        expect(item).toHaveProperty('rating');
        expect(item).toHaveProperty('categories');
        expect(item).toHaveProperty('publicReview');
        expect(item).toHaveProperty('guestName');
        expect(item).toHaveProperty('submittedAt');
        expect(item).toHaveProperty('approved');
      }
    });
    const mockHostawayResponse: HostawayApiResponse = {
      status: 'success',
      result: [
        {
          id: 12345,
          listingId: 789,
          guestName: 'John Doe',
          comment: 'Great stay! Clean and comfortable.',
          rating: 9.2,
          reviewCategories: [
            { id: 1, name: 'Cleanliness', rating: 9.5, max_rating: 10 },
            { id: 2, name: 'Location', rating: 9.0, max_rating: 10 }
          ],
          createdAt: '2024-01-15T14:30:00Z',
          updatedAt: '2024-01-15T14:30:00Z',
          checkInDate: '2024-01-10T15:00:00Z',
          checkOutDate: '2024-01-14T11:00:00Z',
          reviewType: 'guest_review',
          channel: 'airbnb',
          approved: true,
          response: 'Thank you for your review!',
          responseDate: '2024-01-16T09:00:00Z',
          guestId: 456789,
          reservationId: 987654,
          language: 'en',
          source: 'airbnb_api'
        }
      ],
      count: 1,
      limit: 20,
      page: 1,
      total: 1
    };

    it('should return normalized reviews successfully', async () => {
      // Mock cache miss
      mockedGetCache.mockResolvedValue(null);
      
      // Mock successful fetchReviewsWithSource response
      mockedFetchReviewsWithSource.mockResolvedValue({
        response: mockHostawayResponse,
        source: 'hostaway'
      });
      
      // Mock successful cache set
      mockedSetCache.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ listingId: 789, page: 1, limit: 20 })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.reviews).toHaveLength(1);
      expect(response.body.data.reviews[0].id).toBe(12345);
      expect(response.body.data.reviews[0].rating).toBe(9.2);
      expect(response.body.data.reviews[0].categories).toEqual({
        'cleanliness': 9.5,
        'location': 9.0
      });
      expect(response.body.data.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      });
      expect(response.body.data.meta.source).toBe('hostaway');
      expect(response.body.data.meta.cached).toBe(false);

      // Verify headers
      expect(response.headers['x-cache-status']).toBe('MISS');
      expect(response.headers['x-source']).toBe('hostaway');
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-response-time']).toBeDefined();
    });

    it('should return cached response when available', async () => {
      const cachedResponse = {
        response: {
          status: 'success',
          data: {
            reviews: [
              {
                id: 12345,
                listingId: 789,
                guestName: 'John Doe',
                comment: 'Cached review',
                rating: 8.5,
                categories: { cleanliness: 8.5 },
                createdAt: '2024-01-15T14:30:00.000Z',
                updatedAt: '2024-01-15T14:30:00.000Z',
                reviewType: 'guest_review',
                channel: 'airbnb',
                approved: true,
                rawJson: {}
              }
            ],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
            filters: { listingId: 789 },
            meta: { cached: true, processedAt: '2024-01-15T14:30:00.000Z', source: 'hostaway' }
          }
        },
        metadata: {
          key: 'test-key',
          ttl: 300,
          createdAt: new Date().toISOString(),
          source: 'hostaway',
          queryParams: { listingId: 789 }
        }
      };

      // Mock cache hit
      mockedGetCache.mockResolvedValue(JSON.stringify(cachedResponse));

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ listingId: 789 })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.meta.cached).toBe(true);
      expect(response.headers['x-cache-status']).toBe('HIT');

      // Verify fetchReviewsWithSource was not called
      expect(mockedFetchReviewsWithSource).not.toHaveBeenCalled();
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ 
          listingId: 'invalid',
          page: -1,
          limit: 150,
          minRating: 15
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Invalid query parameters');
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.details).toBeDefined();
    });

    it('should handle filtering parameters correctly', async () => {
      mockedGetCache.mockResolvedValue(null);
      mockedFetchReviewsWithSource.mockResolvedValue({
        response: mockHostawayResponse,
        source: 'hostaway'
      });
      mockedSetCache.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({
          listingId: 789,
          from: '2024-01-01',
          to: '2024-01-31',
          channel: 'airbnb',
          approved: true,
          minRating: 8,
          hasResponse: true
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.filters).toEqual({
        listingId: 789,
        from: '2024-01-01',
        to: '2024-01-31',
        channel: 'airbnb',
        approved: true
      });

      // Verify fetchReviewsWithSource was called with correct parameters
      expect(mockedFetchReviewsWithSource).toHaveBeenCalledWith({
        listingId: 789,
        from: '2024-01-01',
        to: '2024-01-31',
        channel: 'airbnb',
        approved: true,
        minRating: 8,
        hasResponse: true,
        page: 1,
        limit: 20
      });
    });

    it('should handle pagination correctly', async () => {
      const largeResponse = {
        ...mockHostawayResponse,
        result: Array(25).fill(null).map((_, index) => ({
          ...mockHostawayResponse.result[0],
          id: 12345 + index
        })),
        count: 25,
        total: 50
      };

      mockedGetCache.mockResolvedValue(null);
      mockedFetchReviewsWithSource.mockResolvedValue({
        response: largeResponse,
        source: 'hostaway'
      });
      mockedSetCache.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ page: 2, limit: 10 })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.reviews).toHaveLength(10);
      expect(response.body.data.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: true
      });
    });

    it('should handle Hostaway API errors gracefully', async () => {
      mockedGetCache.mockResolvedValue(null);
      mockedFetchReviewsWithSource.mockRejectedValue(new Error('Hostaway API unavailable'));

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ listingId: 789 })
        .expect(503);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('should handle normalization errors', async () => {
      const invalidResponse = {
        ...mockHostawayResponse,
        result: [
          {
            id: 0, // Invalid ID
            listingId: 0, // Invalid listing ID
            guestName: '', // Empty name
            comment: '',
            createdAt: 'invalid-date',
            updatedAt: '2024-01-15T14:30:00Z',
            reviewType: 'guest_review',
            channel: 'airbnb',
            approved: true
          }
        ]
      };

      mockedGetCache.mockResolvedValue(null);
      mockedFetchReviewsWithSource.mockResolvedValue({
        response: invalidResponse,
        source: 'hostaway'
      });

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ listingId: 789 })
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('NORMALIZATION_ERROR');
    });

    it('should handle network timeouts', async () => {
      mockedGetCache.mockResolvedValue(null);
      mockedFetchReviewsWithSource.mockRejectedValue(new Error('Network timeout'));

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ listingId: 789 })
        .expect(503);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('should limit page size to maximum allowed', async () => {
      mockedGetCache.mockResolvedValue(null);
      mockedFetchReviewsWithSource.mockResolvedValue({
        response: mockHostawayResponse,
        source: 'hostaway'
      });
      mockedSetCache.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ limit: 200 }) // Above maximum
        .expect(200);

      expect(response.body.data.pagination.limit).toBe(100); // Should be capped
    });

    it('should default pagination parameters', async () => {
      mockedGetCache.mockResolvedValue(null);
      mockedFetchReviewsWithSource.mockResolvedValue({
        response: mockHostawayResponse,
        source: 'hostaway'
      });
      mockedSetCache.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .expect(200);

      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(20);
    });

    it('should handle date range validation', async () => {
      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({
          from: '2024-01-31',
          to: '2024-01-01' // to date before from date
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Invalid query parameters');
    });

    it('should handle rating range validation', async () => {
      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({
          minRating: 8,
          maxRating: 6 // max less than min
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Invalid query parameters');
    });
  });

  describe('GET /api/reviews/hostaway/metrics', () => {
    it('should return API and cache metrics', async () => {
      const mockHostawayMetrics = {
        totalRequests: 10,
        successfulRequests: 8,
        failedRequests: 2,
        mockRequests: 5,
        averageResponseTime: 250,
        successRate: 0.8,
        errorRate: 0.2,
        mockUsageRate: 0.5
      };

      const mockCacheMetrics = {
        hits: 5,
        misses: 3,
        sets: 3,
        deletes: 1,
        errors: 0,
        totalRequests: 8,
        hitRate: 0.625,
        errorRate: 0
      };

      mockedGetHostawayApiMetrics.mockReturnValue(mockHostawayMetrics);
      jest.spyOn(cacheService, 'getCacheMetrics').mockReturnValue(mockCacheMetrics);

      const response = await request(app)
        .get('/api/reviews/hostaway/metrics')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.hostaway_api).toEqual(mockHostawayMetrics);
      expect(response.body.data.cache).toEqual(mockCacheMetrics);
      expect(response.body.data.timestamp).toBeDefined();
    });

    it('should handle metrics errors gracefully', async () => {
      mockedGetHostawayApiMetrics.mockImplementation(() => {
        throw new Error('Metrics unavailable');
      });

      const response = await request(app)
        .get('/api/reviews/hostaway/metrics')
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('METRICS_ERROR');
    });
  });

  describe('GET /api/reviews/hostaway/health', () => {
    it('should return healthy status', async () => {
      const mockHealthStatus = {
        healthy: true,
        details: {
          api_configured: true,
          mock_mode: false,
          mock_data_available: true,
          last_request: new Date(),
          metrics: {
            totalRequests: 5,
            successfulRequests: 5,
            failedRequests: 0,
            mockRequests: 0,
            averageResponseTime: 200,
            successRate: 1.0,
            errorRate: 0.0,
            mockUsageRate: 0.0
          }
        }
      };

      mockedHostawayHealthCheck.mockResolvedValue(mockHealthStatus);

      const response = await request(app)
        .get('/api/reviews/hostaway/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('hostaway-reviews');
      expect(response.body.details).toEqual(mockHealthStatus.details);
      expect(response.body.timestamp).toBeDefined();
    });

    it('should return unhealthy status', async () => {
      const mockHealthStatus = {
        healthy: false,
        details: {
          api_configured: false,
          mock_mode: true,
          mock_data_available: false,
          metrics: {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            mockRequests: 0,
            averageResponseTime: 0,
            successRate: 0,
            errorRate: 0,
            mockUsageRate: 0
          }
        }
      };

      mockedHostawayHealthCheck.mockResolvedValue(mockHealthStatus);

      const response = await request(app)
        .get('/api/reviews/hostaway/health')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.service).toBe('hostaway-reviews');
      expect(response.body.details).toEqual(mockHealthStatus.details);
    });

    it('should handle health check errors', async () => {
      mockedHostawayHealthCheck.mockRejectedValue(new Error('Health check failed'));

      const response = await request(app)
        .get('/api/reviews/hostaway/health')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.error).toBe('Health check failed');
    });
  });

  describe('POST /api/reviews/hostaway/cache/invalidate', () => {
    it('should invalidate cache for specific listing', async () => {
      jest.spyOn(cacheService, 'invalidateListingCache').mockResolvedValue(3);

      const response = await request(app)
        .post('/api/reviews/hostaway/cache/invalidate')
        .send({ listingId: 123 })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.deletedCount).toBe(3);
      expect(response.body.message).toContain('Successfully invalidated 3 cache entries');
    });

    it('should require invalidation parameters', async () => {
      const response = await request(app)
        .post('/api/reviews/hostaway/cache/invalidate')
        .send({})
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('Must provide listingId, pattern, or key');
    });

    it('should handle cache invalidation errors', async () => {
      jest.spyOn(cacheService, 'invalidateListingCache').mockRejectedValue(new Error('Redis error'));

      const response = await request(app)
        .post('/api/reviews/hostaway/cache/invalidate')
        .send({ listingId: 123 })
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('CACHE_ERROR');
    });
  });

  describe('GET /api/reviews/hostaway/cache/stats', () => {
    it('should return cache statistics', async () => {
      const mockCacheMetrics = {
        hits: 10,
        misses: 5,
        sets: 5,
        deletes: 2,
        errors: 1,
        totalRequests: 15,
        hitRate: 0.667,
        errorRate: 0.067
      };

      jest.spyOn(cacheService, 'getCacheMetrics').mockReturnValue(mockCacheMetrics);

      const response = await request(app)
        .get('/api/reviews/hostaway/cache/stats')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.metrics).toEqual(mockCacheMetrics);
      expect(response.body.data.config).toEqual({
        enabled: true,
        defaultTtl: 300,
        keyPrefix: 'reviews'
      });
      expect(response.body.data.timestamp).toBeDefined();
    });

    it('should handle cache stats errors', async () => {
      jest.spyOn(cacheService, 'getCacheMetrics').mockImplementation(() => {
        throw new Error('Cache stats unavailable');
      });

      const response = await request(app)
        .get('/api/reviews/hostaway/cache/stats')
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('CACHE_ERROR');
    });
  });

  describe('Error handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/reviews/nonexistent')
        .expect(404);

      expect(response.body.error).toBeDefined();
    });

    it('should set proper security headers', async () => {
      mockedGetCache.mockResolvedValue(null);
      mockedFetchReviewsWithSource.mockResolvedValue({
        response: mockHostawayResponse,
        source: 'hostaway'
      });
      mockedSetCache.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('0');
    });

    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/api/reviews/hostaway/cache/invalidate')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle request timeout', async () => {
      mockedGetCache.mockResolvedValue(null);
      mockedFetchReviewsWithSource.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ listingId: 789 })
        .expect(503);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent requests', async () => {
      mockedGetCache.mockResolvedValue(null);
      mockedFetchReviewsWithSource.mockResolvedValue({
        response: mockHostawayResponse,
        source: 'hostaway'
      });
      mockedSetCache.mockResolvedValue(true);

      const requests = Array(10).fill(null).map((_, index) => 
        request(app)
          .get('/api/reviews/hostaway')
          .query({ listingId: 789, page: index + 1 })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
      });
    });

    it('should respond within acceptable time limits', async () => {
      const cachedResponse = {
        response: {
          status: 'success',
          data: {
            reviews: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
            filters: {},
            meta: { cached: true, processedAt: '2024-01-15T14:30:00.000Z', source: 'hostaway' }
          }
        },
        metadata: { key: 'test', ttl: 300, createdAt: new Date().toISOString(), source: 'hostaway', queryParams: {} }
      };

      mockedGetCache.mockResolvedValue(JSON.stringify(cachedResponse));

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ listingId: 789 })
        .expect(200);
      const endTime = Date.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second for cached data
      expect(response.headers['x-response-time']).toBeDefined();
    });
  });

  describe('Source Tracking and Fallback Tests', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockedGetCache.mockResolvedValue(null); // Ensure cache miss
      mockedSetCache.mockResolvedValue(true);
    });

    it('should return correct source when using mock data in mock mode', async () => {
      const mockResponse: HostawayApiResponse = {
        status: 'success',
        result: [{
          id: 1,
          listingId: 789,
          guestName: 'Mock Guest',
          comment: 'Mock review',
          rating: 8.5,
          createdAt: '2024-01-15T14:30:00Z',
          updatedAt: '2024-01-15T14:30:00Z',
          reviewType: 'guest_review',
          channel: 'airbnb',
          approved: true
        }],
        count: 1,
        limit: 20,
        page: 1,
        total: 1,
        message: 'Mock data'
      };

      // Mock fetchReviewsWithSource to return mock source
      mockedFetchReviewsWithSource.mockResolvedValue({
        response: mockResponse,
        source: 'mock'
      });

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ listingId: 789 })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.meta.source).toBe('mock');
      expect(response.headers['x-source']).toBe('mock');
    });

    it('should return correct source when using hostaway data', async () => {
      mockedFetchReviewsWithSource.mockResolvedValue({
        response: mockHostawayResponse,
        source: 'hostaway'
      });

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ listingId: 789 })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.meta.source).toBe('hostaway');
      expect(response.headers['x-source']).toBe('hostaway');
    });

    it('should cache response with correct source metadata', async () => {
      mockedFetchReviewsWithSource.mockResolvedValue({
        response: mockHostawayResponse,
        source: 'mock'
      });

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ listingId: 789 })
        .expect(200);

      expect(response.body.data.meta.source).toBe('mock');
      
      // Verify that cacheReviewsResponse was called with the correct source
      expect(mockedSetCache).toHaveBeenCalled();
      
      // The cached data should have the correct source
      const cachedResponseCall = mockedSetCache.mock.calls[0];
      const cachedData = JSON.parse(cachedResponseCall[1]);
      expect(cachedData.response.data.meta.source).toBe('mock');
      expect(cachedData.metadata.source).toBe('mock');
    });

    it('should fallback to mock data when hostaway returns empty results', async () => {
      const emptyHostawayResponse: HostawayApiResponse = {
        status: 'success',
        result: [], // Empty results
        count: 0,
        limit: 20,
        page: 1,
        total: 0,
        message: 'No reviews found'
      };

      const mockFallbackResponse: HostawayApiResponse = {
        status: 'success',
        result: [{
          id: 1,
          listingId: 789,
          guestName: 'Fallback Guest',
          comment: 'Mock fallback review',
          rating: 7.0,
          createdAt: '2024-01-15T14:30:00Z',
          updatedAt: '2024-01-15T14:30:00Z',
          reviewType: 'guest_review',
          channel: 'booking.com',
          approved: true
        }],
        count: 1,
        limit: 20,
        page: 1,
        total: 1,
        message: 'Mock fallback data'
      };

      // Mock fetchReviewsWithSource to simulate empty result fallback
      mockedFetchReviewsWithSource.mockResolvedValue({
        response: mockFallbackResponse,
        source: 'mock'
      });

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ listingId: 789 })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.reviews).toHaveLength(1);
      expect(response.body.data.meta.source).toBe('mock');
      expect(response.headers['x-source']).toBe('mock');
    });

    it('should handle error fallback to mock data with correct source', async () => {
      const mockFallbackResponse: HostawayApiResponse = {
        status: 'success',
        result: [{
          id: 1,
          listingId: 789,
          guestName: 'Error Fallback Guest',
          comment: 'Mock error fallback review',
          rating: 6.5,
          createdAt: '2024-01-15T14:30:00Z',
          updatedAt: '2024-01-15T14:30:00Z',
          reviewType: 'guest_review',
          channel: 'direct',
          approved: true
        }],
        count: 1,
        limit: 20,
        page: 1,
        total: 1,
        message: 'Mock error fallback data'
      };

      // Mock fetchReviewsWithSource to simulate error fallback
      mockedFetchReviewsWithSource.mockResolvedValue({
        response: mockFallbackResponse,
        source: 'mock'
      });

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ listingId: 789 })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.meta.source).toBe('mock');
      expect(response.headers['x-source']).toBe('mock');
    });

    it('should handle OAuth2 token acquisition and requests', async () => {
      const mockFallbackResponse: HostawayApiResponse = {
        status: 'success',
        result: [{
          id: 1,
          listingId: 789,
          guestName: 'OAuth Test Guest',
          comment: 'OAuth token test review',
          rating: 8.5,
          createdAt: '2024-01-15T14:30:00Z',
          updatedAt: '2024-01-15T14:30:00Z',
          reviewType: 'guest_review',
          channel: 'booking.com',
          approved: true
        }],
        count: 1,
        limit: 20,
        page: 1,
        total: 1,
        message: 'OAuth token test data'
      };

      mockedGetCache.mockResolvedValue(null);
      mockedFetchReviewsWithSource.mockResolvedValue({
        response: mockFallbackResponse,
        source: 'hostaway'
      });
      mockedSetCache.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ listingId: 789 })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.meta.source).toBe('hostaway');
      expect(response.headers['x-source']).toBe('hostaway');
      expect(response.body.data.reviews).toHaveLength(1);
      expect(response.body.data.reviews[0].guestName).toBe('OAuth Test Guest');
    });

    it('should handle 401 authentication error and fallback to mock when mock mode off but auth invalid', async () => {
      const mockFallbackResponse: HostawayApiResponse = {
        status: 'success',
        result: [{
          id: 1,
          listingId: 789,
          guestName: 'Auth Fallback Guest',
          comment: 'Mock auth fallback review',
          rating: 7.5,
          createdAt: '2024-01-15T14:30:00Z',
          updatedAt: '2024-01-15T14:30:00Z',
          reviewType: 'guest_review',
          channel: 'booking.com',
          approved: true
        }],
        count: 1,
        limit: 20,
        page: 1,
        total: 1,
        message: 'Mock auth fallback data'
      };

      mockedGetCache.mockResolvedValue(null);
      
      // First, simulate a 401 error from fetchReviewsWithSource, then successful fallback
      mockedFetchReviewsWithSource.mockResolvedValue({
        response: mockFallbackResponse,
        source: 'mock'
      });

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ listingId: 789 })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.meta.source).toBe('mock');
      expect(response.headers['x-source']).toBe('mock');
      expect(response.body.data.reviews).toHaveLength(1);
      expect(response.body.data.reviews[0].guestName).toBe('Auth Fallback Guest');
    });

    it('should map host_review type correctly in simple format', async () => {
      const mockResponse: HostawayApiResponse = {
        status: 'success',
        result: [{
          id: 1,
          listingId: 789,
          guestName: 'Host User',
          comment: 'Great guest!',
          rating: 9.0,
          createdAt: '2024-01-15T14:30:00Z',
          updatedAt: '2024-01-15T14:30:00Z',
          reviewType: 'host_review',
          channel: 'airbnb',
          approved: true
        }],
        count: 1,
        limit: 20,
        page: 1,
        total: 1
      };

      mockedGetCache.mockResolvedValue(null);
      mockedFetchReviewsWithSource.mockResolvedValue({
        response: mockResponse,
        source: 'hostaway'
      });
      mockedSetCache.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ format: 'simple' })
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].type).toBe('host-to-guest');
    });

    it('should map guest_review type correctly in simple format', async () => {
      const mockResponse: HostawayApiResponse = {
        status: 'success',
        result: [{
          id: 2,
          listingId: 789,
          guestName: 'Guest User',
          comment: 'Amazing stay!',
          rating: 8.5,
          createdAt: '2024-01-15T14:30:00Z',
          updatedAt: '2024-01-15T14:30:00Z',
          reviewType: 'guest_review',
          channel: 'booking.com',
          approved: true
        }],
        count: 1,
        limit: 20,
        page: 1,
        total: 1
      };

      mockedGetCache.mockResolvedValue(null);
      mockedFetchReviewsWithSource.mockResolvedValue({
        response: mockResponse,
        source: 'hostaway'
      });
      mockedSetCache.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ format: 'simple' })
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].type).toBe('guest-to-host');
    });

    it('should map unexpected review type correctly in simple format', async () => {
      const mockResponse: HostawayApiResponse = {
        status: 'success',
        result: [{
          id: 3,
          listingId: 789,
          guestName: 'System User',
          comment: 'Auto generated review',
          rating: 7.0,
          createdAt: '2024-01-15T14:30:00Z',
          updatedAt: '2024-01-15T14:30:00Z',
          reviewType: 'system_automated_review',
          channel: 'direct',
          approved: true
        }],
        count: 1,
        limit: 20,
        page: 1,
        total: 1
      };

      mockedGetCache.mockResolvedValue(null);
      mockedFetchReviewsWithSource.mockResolvedValue({
        response: mockResponse,
        source: 'hostaway'
      });
      mockedSetCache.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ format: 'simple' })
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].type).toBe('system-automated-review');
    });

    it('should bypass cache when cache=false parameter is provided', async () => {
      const mockResponse: HostawayApiResponse = {
        status: 'success',
        result: [{
          id: 1,
          listingId: 789,
          guestName: 'Bypass Test User',
          comment: 'Cache bypass test',
          rating: 8.0,
          createdAt: '2024-01-15T14:30:00Z',
          updatedAt: '2024-01-15T14:30:00Z',
          reviewType: 'guest_review',
          channel: 'airbnb',
          approved: true
        }],
        count: 1,
        limit: 20,
        page: 1,
        total: 1
      };

      // Mock getCachedReviewsResponse to return cached data - but should be bypassed
      mockedGetCache.mockResolvedValue(JSON.stringify({
        response: { status: 'success', data: { reviews: [], meta: { source: 'cached' } } },
        metadata: { key: 'test', ttl: 300, createdAt: new Date().toISOString(), source: 'hostaway', queryParams: {} }
      }));

      mockedFetchReviewsWithSource.mockResolvedValue({
        response: mockResponse,
        source: 'hostaway'
      });
      
      // Cache set should not be called when bypassing
      mockedSetCache.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/reviews/hostaway')
        .query({ listingId: 789, cache: 'false' })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.reviews).toHaveLength(1);
      expect(response.body.data.reviews[0].guestName).toBe('Bypass Test User');
      expect(response.headers['x-cache-status']).toBe('BYPASS');
      expect(response.body.data.meta.source).toBe('hostaway');

      // Verify that fetchReviewsWithSource was called (not using cache)
      expect(mockedFetchReviewsWithSource).toHaveBeenCalled();
      
      // Verify cache set was not called due to bypass
      expect(mockedSetCache).not.toHaveBeenCalled();
    });
  });
});

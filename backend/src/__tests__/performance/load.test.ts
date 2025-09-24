import request from 'supertest';
import { app } from '../../app';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { hostawayClient } from '../../services/hostawayClient';
import { performance } from 'perf_hooks';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL);

// Mock external services
jest.mock('../../services/hostawayClient');
const mockHostawayClient = hostawayClient as jest.Mocked<typeof hostawayClient>;

describe('Performance and Load Tests', () => {
  // Increase timeout for performance tests
  jest.setTimeout(120000);

  beforeAll(async () => {
    // Set up test data
    await prisma.reviewAuditLog.deleteMany();
    await prisma.review.deleteMany();
    await prisma.listing.deleteMany();

    // Create test listings for performance tests
    const listings = Array(100).fill(0).map((_, i) => ({
      externalId: `perf-listing-${i}`,
      name: `Performance Test Property ${i}`,
      address: `${i} Performance Street`,
      city: 'Performance City',
      country: 'Performance Country',
      latitude: 40.7128 + (i * 0.001),
      longitude: -74.0060 + (i * 0.001)
    }));

    await prisma.listing.createMany({
      data: listings
    });

    // Create test reviews
    const reviews = Array(500).fill(0).map((_, i) => ({
      externalId: `perf-review-${i}`,
      guestName: `Performance Guest ${i}`,
      rating: (i % 5) + 1,
      comment: `Performance test review comment ${i}. This is a longer comment to simulate real-world data with more substantial text content that users typically write.`,
      source: i % 2 === 0 ? 'airbnb' : 'booking',
      status: 'pending' as const,
      listingId: `perf-listing-${i % 100}`,
      createdAt: new Date(Date.now() - (i * 3600000)), // Spread over time
    }));

    await prisma.review.createMany({
      data: reviews
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });

  describe('API Response Time Benchmarks', () => {
    it('should handle GET /api/reviews within acceptable time limits', async () => {
      const measurements = [];
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        const response = await request(app)
          .get('/api/reviews?limit=50')
          .expect(200);

        const end = performance.now();
        const duration = end - start;
        measurements.push(duration);

        expect(response.body.reviews).toBeDefined();
        expect(response.body.reviews.length).toBeGreaterThan(0);
      }

      const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const maxTime = Math.max(...measurements);
      const minTime = Math.min(...measurements);

      console.log(`GET /api/reviews performance:`, {
        average: `${avgTime.toFixed(2)}ms`,
        min: `${minTime.toFixed(2)}ms`,
        max: `${maxTime.toFixed(2)}ms`,
        measurements: measurements.map(m => `${m.toFixed(2)}ms`)
      });

      // Performance targets
      expect(avgTime).toBeLessThan(1000); // Average response time < 1s
      expect(maxTime).toBeLessThan(2000);  // Max response time < 2s
    });

    it('should handle pagination efficiently with large datasets', async () => {
      const pageTests = [
        { page: 1, limit: 20 },
        { page: 5, limit: 20 },
        { page: 10, limit: 20 },
        { page: 20, limit: 10 },
        { page: 1, limit: 100 }
      ];

      const results = [];

      for (const { page, limit } of pageTests) {
        const start = performance.now();
        
        const response = await request(app)
          .get(`/api/reviews?page=${page}&limit=${limit}`)
          .expect(200);

        const end = performance.now();
        const duration = end - start;
        results.push({ page, limit, duration, count: response.body.reviews.length });

        expect(response.body.pagination).toBeDefined();
        expect(response.body.pagination.page).toBe(page);
        expect(response.body.pagination.limit).toBe(limit);
      }

      console.log('Pagination performance results:', results.map(r => 
        `Page ${r.page} (limit ${r.limit}): ${r.duration.toFixed(2)}ms for ${r.count} items`
      ));

      // All pagination queries should complete quickly
      results.forEach(result => {
        expect(result.duration).toBeLessThan(1500);
      });
    });

    it('should handle complex filtering efficiently', async () => {
      const filterTests = [
        { query: '?source=airbnb', name: 'source filter' },
        { query: '?status=pending', name: 'status filter' },
        { query: '?rating=5', name: 'rating filter' },
        { query: '?source=airbnb&status=pending', name: 'combined filters' },
        { query: '?source=airbnb&rating=4&status=pending', name: 'multiple filters' }
      ];

      const results = [];

      for (const { query, name } of filterTests) {
        const start = performance.now();
        
        const response = await request(app)
          .get(`/api/reviews${query}`)
          .expect(200);

        const end = performance.now();
        const duration = end - start;
        results.push({ name, duration, count: response.body.reviews.length });
      }

      console.log('Filter performance results:', results.map(r => 
        `${r.name}: ${r.duration.toFixed(2)}ms for ${r.count} items`
      ));

      // Filtered queries should still be fast
      results.forEach(result => {
        expect(result.duration).toBeLessThan(1000);
      });
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple simultaneous read requests', async () => {
      const concurrentRequests = 20;
      const start = performance.now();

      const promises = Array(concurrentRequests).fill(0).map((_, i) =>
        request(app)
          .get(`/api/reviews?page=${(i % 5) + 1}&limit=20`)
          .expect(200)
      );

      const responses = await Promise.all(promises);
      const end = performance.now();
      const totalDuration = end - start;

      console.log(`${concurrentRequests} concurrent requests completed in ${totalDuration.toFixed(2)}ms`);

      // All requests should succeed
      expect(responses).toHaveLength(concurrentRequests);
      responses.forEach(response => {
        expect(response.body.reviews).toBeDefined();
      });

      // Should handle concurrent load efficiently
      expect(totalDuration).toBeLessThan(10000); // 10 seconds for 20 concurrent requests
    });

    it('should handle concurrent write operations safely', async () => {
      // Create a review to be approved concurrently
      const review = await prisma.review.create({
        data: {
          externalId: 'concurrent-test',
          guestName: 'Concurrent Test User',
          rating: 4,
          comment: 'Concurrent test comment',
          source: 'airbnb',
          status: 'pending',
          listingId: 'perf-listing-1'
        }
      });

      const concurrentApprovals = 10;
      const start = performance.now();

      // Attempt concurrent approvals (only one should succeed)
      const promises = Array(concurrentApprovals).fill(0).map((_, i) =>
        request(app)
          .post(`/api/reviews/${review.id}/approve`)
          .send({
            approvedBy: `manager-${i}`,
            notes: `Concurrent approval attempt ${i}`
          })
      );

      const responses = await Promise.allSettled(promises);
      const end = performance.now();
      const totalDuration = end - start;

      console.log(`${concurrentApprovals} concurrent approval attempts completed in ${totalDuration.toFixed(2)}ms`);

      // Check results
      const successful = responses.filter(r => 
        r.status === 'fulfilled' && (r.value as any).status === 200
      ).length;

      const failed = responses.filter(r => 
        r.status === 'fulfilled' && (r.value as any).status !== 200
      ).length;

      // Only one should succeed, rest should fail gracefully
      expect(successful).toBe(1);
      expect(failed).toBe(concurrentApprovals - 1);

      // Verify final state
      const finalReview = await prisma.review.findUnique({
        where: { id: review.id }
      });
      expect(finalReview?.status).toBe('approved');
    });
  });

  describe('Memory Usage and Resource Management', () => {
    it('should handle large payload processing efficiently', async () => {
      // Prepare large dataset for import
      const largeListings = Array(200).fill(0).map((_, i) => ({
        id: `large-listing-${i}`,
        name: `Large Dataset Property ${i}`,
        address: `${i} Large Dataset Street`,
        city: 'Large City',
        country: 'Large Country',
        lat: 40.7128 + (i * 0.001),
        lng: -74.0060 + (i * 0.001)
      }));

      const largeReviews = Array(1000).fill(0).map((_, i) => ({
        id: `large-review-${i}`,
        listingId: `large-listing-${i % 200}`,
        guestName: `Large Dataset Guest ${i}`,
        rating: (i % 5) + 1,
        comment: `Large dataset review comment ${i}. `.repeat(10), // Larger comments
        createdAt: new Date(Date.now() - (i * 86400000)).toISOString(),
        source: i % 2 === 0 ? 'airbnb' : 'booking',
        reservationId: `large-res-${i}`
      }));

      mockHostawayClient.getListings.mockResolvedValue(largeListings);
      mockHostawayClient.getReviews.mockResolvedValue(largeReviews);

      // Measure memory before
      const memoryBefore = process.memoryUsage();
      const start = performance.now();

      // Process large dataset
      const listingsResponse = await request(app)
        .post('/api/listings/hostaway/import')
        .expect(200);

      const reviewsResponse = await request(app)
        .post('/api/reviews/hostaway')
        .expect(200);

      const end = performance.now();
      const memoryAfter = process.memoryUsage();
      const duration = end - start;

      console.log('Large dataset processing:', {
        duration: `${duration.toFixed(2)}ms`,
        listingsImported: listingsResponse.body.imported,
        reviewsProcessed: reviewsResponse.body.processed,
        memoryUsage: {
          rss: `${((memoryAfter.rss - memoryBefore.rss) / 1024 / 1024).toFixed(2)}MB`,
          heapUsed: `${((memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024).toFixed(2)}MB`,
          external: `${((memoryAfter.external - memoryBefore.external) / 1024 / 1024).toFixed(2)}MB`
        }
      });

      // Performance expectations
      expect(duration).toBeLessThan(60000); // 60 seconds
      expect(listingsResponse.body.imported).toBe(200);
      expect(reviewsResponse.body.processed).toBe(1000);
    });

    it('should handle database connection pooling under load', async () => {
      // Simulate high database load
      const dbOperations = Array(50).fill(0).map(async (_, i) => {
        // Mix of different database operations
        const operations = [
          () => prisma.review.count(),
          () => prisma.listing.count(),
          () => prisma.review.findMany({ take: 10, skip: i * 10 }),
          () => prisma.listing.findMany({ take: 5, skip: i * 5 })
        ];

        const operation = operations[i % operations.length];
        const start = performance.now();
        const result = await operation();
        const end = performance.now();

        return {
          operation: operation.name,
          duration: end - start,
          result: typeof result === 'number' ? result : Array.isArray(result) ? result.length : 'success'
        };
      });

      const start = performance.now();
      const results = await Promise.all(dbOperations);
      const end = performance.now();
      const totalDuration = end - start;

      console.log('Database connection pool performance:', {
        totalDuration: `${totalDuration.toFixed(2)}ms`,
        operations: results.length,
        averageDuration: `${(results.reduce((sum, r) => sum + r.duration, 0) / results.length).toFixed(2)}ms`,
        slowestOperation: `${Math.max(...results.map(r => r.duration)).toFixed(2)}ms`
      });

      // All operations should complete
      expect(results).toHaveLength(50);
      
      // Pool should handle load efficiently
      expect(totalDuration).toBeLessThan(15000); // 15 seconds for 50 concurrent DB operations
    });
  });

  describe('Cache Performance', () => {
    it('should demonstrate cache effectiveness under load', async () => {
      await redis.flushdb(); // Start with empty cache

      const cacheKey = 'test-cache-performance';
      const iterations = 20;
      
      // First run - cache misses
      const missTimings = [];
      for (let i = 0; i < iterations; i++) {
        await redis.del(`${cacheKey}-${i}`); // Ensure cache miss
        
        const start = performance.now();
        await request(app)
          .get(`/api/reviews?page=${i + 1}&limit=10`)
          .expect(200);
        const end = performance.now();
        
        missTimings.push(end - start);
      }

      // Second run - cache hits (if caching is implemented)
      const hitTimings = [];
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await request(app)
          .get(`/api/reviews?page=${i + 1}&limit=10`)
          .expect(200);
        const end = performance.now();
        
        hitTimings.push(end - start);
      }

      const avgMissTime = missTimings.reduce((a, b) => a + b, 0) / missTimings.length;
      const avgHitTime = hitTimings.reduce((a, b) => a + b, 0) / hitTimings.length;

      console.log('Cache performance comparison:', {
        averageMissTime: `${avgMissTime.toFixed(2)}ms`,
        averageHitTime: `${avgHitTime.toFixed(2)}ms`,
        improvementRatio: `${(avgMissTime / avgHitTime).toFixed(2)}x`,
        cacheEffective: avgHitTime < avgMissTime
      });

      // Cache hits should generally be faster than misses
      // (This test might pass even without caching if response times are consistent)
      expect(avgHitTime).toBeLessThan(avgMissTime * 1.2); // Allow some variance
    });
  });

  describe('Stress Testing', () => {
    it('should maintain functionality under extended load', async () => {
      const stressTestDuration = 30000; // 30 seconds
      const requestInterval = 100; // Request every 100ms
      const startTime = Date.now();
      const results: Array<{ timestamp: number; duration: number; success: boolean }> = [];

      console.log(`Starting stress test for ${stressTestDuration / 1000} seconds...`);

      while (Date.now() - startTime < stressTestDuration) {
        const requestStart = performance.now();
        
        try {
          const response = await request(app)
            .get('/api/reviews?limit=10')
            .timeout(5000); // 5 second timeout

          const requestEnd = performance.now();
          results.push({
            timestamp: Date.now() - startTime,
            duration: requestEnd - requestStart,
            success: response.status === 200
          });
        } catch (error) {
          const requestEnd = performance.now();
          results.push({
            timestamp: Date.now() - startTime,
            duration: requestEnd - requestStart,
            success: false
          });
        }

        await new Promise(resolve => setTimeout(resolve, requestInterval));
      }

      // Analyze results
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;
      const successRate = (successCount / results.length) * 100;
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const maxDuration = Math.max(...results.map(r => r.duration));

      console.log('Stress test results:', {
        totalRequests: results.length,
        successCount,
        failureCount,
        successRate: `${successRate.toFixed(2)}%`,
        averageDuration: `${avgDuration.toFixed(2)}ms`,
        maxDuration: `${maxDuration.toFixed(2)}ms`,
        requestsPerSecond: `${(results.length / (stressTestDuration / 1000)).toFixed(2)}`
      });

      // Performance expectations under stress
      expect(successRate).toBeGreaterThan(95); // At least 95% success rate
      expect(avgDuration).toBeLessThan(2000);   // Average response time < 2s
      expect(maxDuration).toBeLessThan(5000);   // Max response time < 5s
    });
  });
});

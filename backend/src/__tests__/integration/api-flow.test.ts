import request from 'supertest';
import { app } from '../../app';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { hostawayClient } from '../../services/hostawayClient';
import { reviewService } from '../../services/reviewService';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL);

// Mock external services
jest.mock('../../services/hostawayClient');
jest.mock('../../lib/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    flushdb: jest.fn(),
  }
}));

const mockHostawayClient = hostawayClient as jest.Mocked<typeof hostawayClient>;

describe('API Flow Integration Tests', () => {
  beforeAll(async () => {
    // Ensure test database is clean
    await prisma.reviewAuditLog.deleteMany();
    await prisma.review.deleteMany();
    await prisma.listing.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });

  beforeEach(async () => {
    // Clear Redis cache before each test
    await redis.flushdb();
    jest.clearAllMocks();
  });

  describe('Complete Review Workflow', () => {
    it('should handle complete flow from Hostaway import to approval', async () => {
      // 1. Mock Hostaway API responses
      const mockListings = [{
        id: '12345',
        name: 'Test Property',
        address: '123 Test Street',
        city: 'Test City',
        country: 'Test Country',
        lat: 40.7128,
        lng: -74.0060
      }];

      const mockReviews = [{
        id: '67890',
        listingId: '12345',
        guestName: 'John Doe',
        rating: 5,
        comment: 'Great stay! Loved the property.',
        createdAt: '2024-01-15T10:00:00Z',
        source: 'airbnb',
        reservationId: 'res123'
      }];

      mockHostawayClient.getListings.mockResolvedValue(mockListings);
      mockHostawayClient.getReviews.mockResolvedValue(mockReviews);

      // 2. Import listings from Hostaway
      const listingsResponse = await request(app)
        .post('/api/listings/hostaway/import')
        .expect(200);

      expect(listingsResponse.body.success).toBe(true);
      expect(listingsResponse.body.imported).toBe(1);

      // 3. Import reviews from Hostaway
      const reviewsResponse = await request(app)
        .post('/api/reviews/hostaway')
        .expect(200);

      expect(reviewsResponse.body.success).toBe(true);
      expect(reviewsResponse.body.processed).toBe(1);

      // 4. Verify review was created and normalized
      const createdReviews = await prisma.review.findMany({
        include: { listing: true }
      });

      expect(createdReviews).toHaveLength(1);
      expect(createdReviews[0]).toMatchObject({
        externalId: '67890',
        guestName: 'John Doe',
        rating: 5,
        comment: 'Great stay! Loved the property.',
        source: 'airbnb',
        status: 'pending'
      });

      // 5. Get reviews via API
      const getReviewsResponse = await request(app)
        .get('/api/reviews')
        .expect(200);

      expect(getReviewsResponse.body.reviews).toHaveLength(1);
      expect(getReviewsResponse.body.reviews[0].id).toBe(createdReviews[0].id);

      // 6. Approve the review
      const approvalResponse = await request(app)
        .post(`/api/reviews/${createdReviews[0].id}/approve`)
        .send({
          approvedBy: 'test-manager',
          notes: 'Approved after review'
        })
        .expect(200);

      expect(approvalResponse.body.success).toBe(true);

      // 7. Verify review status updated
      const updatedReview = await prisma.review.findUnique({
        where: { id: createdReviews[0].id }
      });

      expect(updatedReview?.status).toBe('approved');

      // 8. Verify audit log entry created
      const auditLogs = await prisma.reviewAuditLog.findMany({
        where: { reviewId: createdReviews[0].id }
      });

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0]).toMatchObject({
        action: 'approved',
        performedBy: 'test-manager',
        notes: 'Approved after review'
      });
    });

    it('should handle cache invalidation across workflow', async () => {
      const mockGetSpy = jest.spyOn(redis, 'get');
      const mockSetSpy = jest.spyOn(redis, 'set');
      const mockDelSpy = jest.spyOn(redis, 'del');

      // Mock cache miss initially
      mockGetSpy.mockResolvedValue(null);

      // 1. Get reviews (should cache results)
      await request(app)
        .get('/api/reviews')
        .expect(200);

      expect(mockSetSpy).toHaveBeenCalledWith(
        expect.stringContaining('reviews:'),
        expect.any(String),
        'EX',
        300
      );

      // 2. Import new reviews (should invalidate cache)
      mockHostawayClient.getListings.mockResolvedValue([]);
      mockHostawayClient.getReviews.mockResolvedValue([]);

      await request(app)
        .post('/api/reviews/hostaway')
        .expect(200);

      expect(mockDelSpy).toHaveBeenCalledWith(
        expect.stringContaining('reviews:')
      );
    });

    it('should handle error recovery scenarios', async () => {
      // Test database connection failure recovery
      const originalQuery = prisma.review.findMany;
      let callCount = 0;

      // @ts-ignore
      prisma.review.findMany = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Database connection lost');
        }
        return originalQuery.call(prisma.review);
      });

      const response = await request(app)
        .get('/api/reviews')
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Internal server error',
        message: expect.any(String)
      });

      // Restore original method
      // @ts-ignore
      prisma.review.findMany = originalQuery;
    });

    it('should handle data consistency across concurrent operations', async () => {
      // Create initial review
      const listing = await prisma.listing.create({
        data: {
          hostawayListingId: 'listing-123',
          name: 'Test Listing',
          slug: 'test-listing',
          address: '123 Test St',
          city: 'Test City',
          country: 'Test Country',
          latitude: 40.7128,
          longitude: -74.0060
        }
      });

      const review = await prisma.review.create({
        data: {
          hostawayReviewId: 'test-123',
          listingId: listing.id,
          reviewType: 'GUEST_REVIEW',
          channel: 'AIRBNB',
          rating: 4,
          publicReview: 'Test comment',
          guestName: 'Test User',
          submittedAt: new Date(),
          approved: false,
          rawJson: {}
        }
      });

      // Simulate concurrent approval attempts
      const approvalPromises = Array(5).fill(0).map(() =>
        request(app)
          .patch(`/api/reviews/${review.id}/approve`)
          .send({
            approved: true
          })
      );

      const results = await Promise.allSettled(approvalPromises);

      // Only one should succeed (200), others should fail with 400 or 409
      const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).status === 200);
      const failed = results.filter(r => r.status === 'fulfilled' && (r.value as any).status !== 200);

      expect(successful).toHaveLength(1);
      expect(failed.length).toBeGreaterThan(0);

      // All failed requests should return 400 status (already in requested state)
      failed.forEach(result => {
        if (result.status === 'fulfilled') {
          expect((result.value as any).status).toBe(400);
          expect((result.value as any).body.code).toBe('NO_CHANGE_REQUIRED');
        }
      });

      // Verify final state
      const finalReview = await prisma.review.findUnique({
        where: { id: review.id }
      });

      expect(finalReview?.approved).toBe(true);

      // Should have exactly one audit log entry for approval
      const auditLogs = await prisma.reviewAuditLog.findMany({
        where: { reviewId: review.id, action: 'APPROVED' }
      });

      expect(auditLogs).toHaveLength(1);
    });

    it('should enforce approval idempotency with conditional updates', async () => {
      // Create initial review
      const listing = await prisma.listing.create({
        data: {
          hostawayListingId: 'listing-456',
          name: 'Test Listing 2',
          slug: 'test-listing-2',
          address: '456 Test Ave',
          city: 'Test City',
          country: 'Test Country',
          latitude: 40.7200,
          longitude: -74.0100
        }
      });

      const review = await prisma.review.create({
        data: {
          hostawayReviewId: 'test-456',
          listingId: listing.id,
          reviewType: 'GUEST_REVIEW',
          channel: 'BOOKING_COM',
          rating: 5,
          publicReview: 'Excellent stay!',
          guestName: 'Jane Doe',
          submittedAt: new Date(),
          approved: false,
          rawJson: {}
        }
      });

      // First approval should succeed
      const firstApproval = await request(app)
        .patch(`/api/reviews/${review.id}/approve`)
        .send({
          approved: true,
          response: 'Thank you for your review!'
        })
        .expect(200);

      expect(firstApproval.body.status).toBe('success');

      // Second identical approval should fail with proper error
      const secondApproval = await request(app)
        .patch(`/api/reviews/${review.id}/approve`)
        .send({
          approved: true,
          response: 'Different response'
        })
        .expect(400);

      expect(secondApproval.body.code).toBe('NO_CHANGE_REQUIRED');
      expect(secondApproval.body.message).toContain('already approved');

      // Verify only one audit log entry exists
      const auditLogs = await prisma.reviewAuditLog.findMany({
        where: { reviewId: review.id }
      });

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].action).toBe('APPROVED');
    });

    it('should handle large dataset operations efficiently', async () => {
      // Create large dataset
      const largeListings = Array(50).fill(0).map((_, i) => ({
        id: `listing-${i}`,
        name: `Test Property ${i}`,
        address: `${i} Test Street`,
        city: 'Test City',
        country: 'Test Country',
        lat: 40.7128 + (i * 0.001),
        lng: -74.0060 + (i * 0.001)
      }));

      const largeReviews = Array(200).fill(0).map((_, i) => ({
        id: `review-${i}`,
        listingId: `listing-${i % 50}`,
        guestName: `Guest ${i}`,
        rating: (i % 5) + 1,
        comment: `Review comment ${i}`,
        createdAt: new Date(Date.now() - (i * 86400000)).toISOString(),
        source: i % 2 === 0 ? 'airbnb' : 'booking',
        reservationId: `res-${i}`
      }));

      mockHostawayClient.getListings.mockResolvedValue(largeListings);
      mockHostawayClient.getReviews.mockResolvedValue(largeReviews);

      // Measure performance
      const startTime = Date.now();

      // Import listings
      await request(app)
        .post('/api/listings/hostaway/import')
        .expect(200);

      // Import reviews
      const reviewsResponse = await request(app)
        .post('/api/reviews/hostaway')
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust based on requirements)
      expect(duration).toBeLessThan(30000); // 30 seconds
      expect(reviewsResponse.body.processed).toBe(200);

      // Verify pagination works with large dataset
      const paginatedResponse = await request(app)
        .get('/api/reviews?page=1&limit=20')
        .expect(200);

      expect(paginatedResponse.body.reviews).toHaveLength(20);
      expect(paginatedResponse.body.pagination.total).toBe(200);
      expect(paginatedResponse.body.pagination.pages).toBe(10);
    });
  });

  describe('API Error Handling', () => {
    it('should handle Hostaway API failures gracefully', async () => {
      mockHostawayClient.getListings.mockRejectedValue(new Error('Hostaway API timeout'));

      const response = await request(app)
        .post('/api/listings/hostaway/import')
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Failed to import listings',
        details: expect.stringContaining('Hostaway API timeout')
      });
    });

    it('should handle invalid review data', async () => {
      mockHostawayClient.getListings.mockResolvedValue([]);
      mockHostawayClient.getReviews.mockResolvedValue([
        {
          id: 'invalid-review',
          listingId: 'non-existent-listing',
          guestName: '',  // Invalid: empty name
          rating: 6,      // Invalid: rating > 5
          comment: '',
          createdAt: 'invalid-date',
          source: 'unknown-source',
          reservationId: null
        }
      ]);

      const response = await request(app)
        .post('/api/reviews/hostaway')
        .expect(200);

      // Should handle errors gracefully and report them
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.length).toBeGreaterThan(0);
      expect(response.body.processed).toBe(0);
    });

    it('should validate API input parameters', async () => {
      // Test invalid review ID format
      await request(app)
        .post('/api/reviews/invalid-id/approve')
        .expect(400);

      // Test missing required fields
      await request(app)
        .post('/api/reviews/123/approve')
        .send({
          // Missing approvedBy field
          notes: 'Test approval'
        })
        .expect(400);

      // Test invalid pagination parameters
      await request(app)
        .get('/api/reviews?page=-1&limit=1000')
        .expect(400);
    });
  });
});

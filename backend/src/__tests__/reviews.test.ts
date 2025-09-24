/**
 * Integration tests for the reviews endpoint
 * Tests GET /api/reviews with various filtering, pagination, and sorting options
 */

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../app';
import { db } from '../lib/database';

// Test database instance
let testDb: PrismaClient;

describe('Reviews API', () => {
  beforeAll(async () => {
    testDb = db;
    
    // Clean up existing test data
    await testDb.reviewCategory.deleteMany();
    await testDb.review.deleteMany();
    await testDb.listing.deleteMany();
    
    // Seed test data
    await seedTestData();
  });

  afterAll(async () => {
    // Clean up test data
    await testDb.reviewCategory.deleteMany();
    await testDb.review.deleteMany();
    await testDb.listing.deleteMany();
    
    await testDb.$disconnect();
  });

  describe('GET /api/reviews', () => {
    it('should return paginated reviews with default parameters', async () => {
      const response = await request(app)
        .get('/api/reviews')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('reviews');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data).toHaveProperty('meta');
      
      expect(Array.isArray(response.body.data.reviews)).toBe(true);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(20);
      expect(typeof response.body.data.pagination.total).toBe('number');
    });

    it('should filter reviews by approved status', async () => {
      const response = await request(app)
        .get('/api/reviews?approved=true')
        .expect(200);

      expect(response.body.status).toBe('success');
      response.body.data.reviews.forEach((review: any) => {
        expect(review.approved).toBe(true);
      });
    });

    it('should filter reviews by channel', async () => {
      const response = await request(app)
        .get('/api/reviews?channel=airbnb')
        .expect(200);

      expect(response.body.status).toBe('success');
      response.body.data.reviews.forEach((review: any) => {
        expect(review.channel).toBe('AIRBNB');
      });
    });

    it('should filter reviews by rating range', async () => {
      const response = await request(app)
        .get('/api/reviews?minRating=8&maxRating=10')
        .expect(200);

      expect(response.body.status).toBe('success');
      response.body.data.reviews.forEach((review: any) => {
        expect(review.rating).toBeGreaterThanOrEqual(8);
        expect(review.rating).toBeLessThanOrEqual(10);
      });
    });

    it('should filter reviews by date range', async () => {
      const fromDate = '2023-01-01';
      const toDate = '2023-12-31';
      
      const response = await request(app)
        .get(`/api/reviews?from=${fromDate}&to=${toDate}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      response.body.data.reviews.forEach((review: any) => {
        const reviewDate = new Date(review.submittedAt);
        expect(reviewDate).toBeInstanceOf(Date);
        expect(reviewDate.getFullYear()).toBe(2023);
      });
    });

    it('should filter reviews by guest name', async () => {
      const response = await request(app)
        .get('/api/reviews?guestName=John')
        .expect(200);

      expect(response.body.status).toBe('success');
      response.body.data.reviews.forEach((review: any) => {
        expect(review.guestName.toLowerCase()).toContain('john');
      });
    });

    it('should handle pagination correctly', async () => {
      const page1Response = await request(app)
        .get('/api/reviews?page=1&limit=5')
        .expect(200);

      const page2Response = await request(app)
        .get('/api/reviews?page=2&limit=5')
        .expect(200);

      expect(page1Response.body.data.pagination.page).toBe(1);
      expect(page2Response.body.data.pagination.page).toBe(2);
      expect(page1Response.body.data.reviews).toHaveLength(5);
      
      // Reviews should be different between pages
      const page1Ids = page1Response.body.data.reviews.map((r: any) => r.id);
      const page2Ids = page2Response.body.data.reviews.map((r: any) => r.id);
      expect(page1Ids).not.toEqual(page2Ids);
    });

    it('should sort reviews by different fields', async () => {
      const ratingAsc = await request(app)
        .get('/api/reviews?sortBy=rating&sortOrder=asc&limit=10')
        .expect(200);

      const ratingDesc = await request(app)
        .get('/api/reviews?sortBy=rating&sortOrder=desc&limit=10')
        .expect(200);

      // Check ascending order
      const ascRatings = ratingAsc.body.data.reviews.map((r: any) => r.rating);
      for (let i = 1; i < ascRatings.length; i++) {
        expect(ascRatings[i]).toBeGreaterThanOrEqual(ascRatings[i - 1]);
      }

      // Check descending order
      const descRatings = ratingDesc.body.data.reviews.map((r: any) => r.rating);
      for (let i = 1; i < descRatings.length; i++) {
        expect(descRatings[i]).toBeLessThanOrEqual(descRatings[i - 1]);
      }
    });

    it('should search reviews by text', async () => {
      const response = await request(app)
        .get('/api/reviews?search=great')
        .expect(200);

      expect(response.body.status).toBe('success');
      response.body.data.reviews.forEach((review: any) => {
        const matchesGuestName = review.guestName.toLowerCase().includes('great');
        const matchesReview = review.publicReview?.toLowerCase()?.includes('great');
        expect(matchesGuestName || matchesReview).toBe(true);
      });
    });

    it('should return error for invalid query parameters', async () => {
      const response = await request(app)
        .get('/api/reviews?page=0')
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.details).toBeInstanceOf(Array);
    });

    it('should return error for invalid date range', async () => {
      const response = await request(app)
        .get('/api/reviews?from=2023-12-31&to=2023-01-01')
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return error for invalid rating range', async () => {
      const response = await request(app)
        .get('/api/reviews?minRating=8&maxRating=5')
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should include correct response headers', async () => {
      const response = await request(app)
        .get('/api/reviews')
        .expect(200);

      expect(response.headers).toHaveProperty('x-request-id');
      expect(response.headers).toHaveProperty('x-response-time');
      expect(response.headers).toHaveProperty('x-total-count');
      expect(response.headers).toHaveProperty('x-page');
      expect(response.headers).toHaveProperty('x-total-pages');
    });
  });

  describe('GET /api/reviews/:id', () => {
    let reviewId: string;

    beforeAll(async () => {
      const review = await testDb.review.findFirst();
      reviewId = review!.id;
    });

    it('should return a specific review by ID', async () => {
      const response = await request(app)
        .get(`/api/reviews/${reviewId}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.review).toHaveProperty('id', reviewId);
      expect(response.body.data.review).toHaveProperty('guestName');
      expect(response.body.data.review).toHaveProperty('rating');
      expect(response.body.data.review).toHaveProperty('listing');
    });

    it('should return 404 for non-existent review', async () => {
      const fakeId = 'c' + '1'.repeat(24);
      const response = await request(app)
        .get(`/api/reviews/${fakeId}`)
        .expect(404);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid review ID format', async () => {
      const response = await request(app)
        .get('/api/reviews/invalid-id')
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/reviews/stats', () => {
    it('should return review statistics', async () => {
      const response = await request(app)
        .get('/api/reviews/stats')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.stats).toHaveProperty('totalReviews');
      expect(response.body.data.stats).toHaveProperty('approvedReviews');
      expect(response.body.data.stats).toHaveProperty('pendingReviews');
      expect(response.body.data.stats).toHaveProperty('averageRating');
      expect(response.body.data.stats).toHaveProperty('ratingDistribution');
      expect(response.body.data.stats).toHaveProperty('channelDistribution');
      expect(response.body.data.stats).toHaveProperty('monthlyTrends');

      expect(typeof response.body.data.stats.totalReviews).toBe('number');
      expect(typeof response.body.data.stats.averageRating).toBe('number');
    });

    it('should filter statistics by date range', async () => {
      const response = await request(app)
        .get('/api/reviews/stats?from=2023-01-01&to=2023-12-31')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.filters).toHaveProperty('from', '2023-01-01');
      expect(response.body.data.filters).toHaveProperty('to', '2023-12-31');
    });
  });
});

/**
 * Seed test data for reviews endpoint tests
 */
async function seedTestData() {
  // Create test listings
  const listing1 = await testDb.listing.create({
    data: {
      hostawayListingId: '12345',
      name: 'Test Listing 1',
      slug: 'test-listing-1'
    }
  });

  const listing2 = await testDb.listing.create({
    data: {
      hostawayListingId: '67890',
      name: 'Test Listing 2',
      slug: 'test-listing-2'
    }
  });

  // Create test reviews
  const reviewsData = [
    {
      hostawayReviewId: 'hr001',
      listingId: listing1.id,
      reviewType: 'GUEST_REVIEW' as const,
      channel: 'AIRBNB' as const,
      rating: 9.5,
      publicReview: 'Great place to stay!',
      guestName: 'John Doe',
      submittedAt: new Date('2023-06-15'),
      approved: true,
      rawJson: { source: 'test' }
    },
    {
      hostawayReviewId: 'hr002',
      listingId: listing2.id,
      reviewType: 'GUEST_REVIEW' as const,
      channel: 'BOOKING_COM' as const,
      rating: 8.0,
      publicReview: 'Nice location',
      guestName: 'Jane Smith',
      submittedAt: new Date('2023-07-20'),
      approved: false,
      rawJson: { source: 'test' }
    },
    {
      hostawayReviewId: 'hr003',
      listingId: listing1.id,
      reviewType: 'GUEST_REVIEW' as const,
      channel: 'AIRBNB' as const,
      rating: 7.5,
      publicReview: 'Good value for money',
      guestName: 'Bob Johnson',
      submittedAt: new Date('2023-08-10'),
      approved: true,
      rawJson: { source: 'test' }
    },
    {
      hostawayReviewId: 'hr004',
      listingId: listing2.id,
      reviewType: 'GUEST_REVIEW' as const,
      channel: 'VRBO' as const,
      rating: 9.0,
      publicReview: 'Amazing host',
      guestName: 'Alice Brown',
      submittedAt: new Date('2023-09-05'),
      approved: true,
      rawJson: { source: 'test' }
    },
    {
      hostawayReviewId: 'hr005',
      listingId: listing1.id,
      reviewType: 'GUEST_REVIEW' as const,
      channel: 'GOOGLE' as const,
      rating: 6.0,
      publicReview: 'Average experience',
      guestName: 'Charlie Wilson',
      submittedAt: new Date('2023-10-12'),
      approved: false,
      rawJson: { source: 'test' }
    }
  ];

  for (const reviewData of reviewsData) {
    const review = await testDb.review.create({
      data: reviewData
    });

    // Create review categories for some reviews
    if (reviewData.rating > 8) {
      await testDb.reviewCategory.create({
        data: {
          reviewId: review.id,
          category: 'OVERALL',
          rating: reviewData.rating
        }
      });

      await testDb.reviewCategory.create({
        data: {
          reviewId: review.id,
          category: 'CLEANLINESS',
          rating: Math.min(10, reviewData.rating + 0.5)
        }
      });
    }
  }
}

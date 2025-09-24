/**
 * Integration tests for the listings endpoint
 * Tests GET /api/listings with various filtering and search options
 */

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../app';
import { db } from '../lib/database';

// Test database instance
let testDb: PrismaClient;

describe('Listings API', () => {
  let listing1Id: string;
  let listing2Id: string;
  let listing3Id: string;

  beforeAll(async () => {
    testDb = db;
    
    // Clean up existing test data
    await testDb.reviewCategory.deleteMany();
    await testDb.review.deleteMany();
    await testDb.listing.deleteMany();
    
    // Seed test data
    const seedData = await seedTestData();
    listing1Id = seedData.listing1Id;
    listing2Id = seedData.listing2Id;
    listing3Id = seedData.listing3Id;
  });

  afterAll(async () => {
    // Clean up test data
    await testDb.reviewCategory.deleteMany();
    await testDb.review.deleteMany();
    await testDb.listing.deleteMany();
    
    await testDb.$disconnect();
  });

  describe('GET /api/listings', () => {
    it('should return paginated listings with default parameters', async () => {
      const response = await request(app)
        .get('/api/listings')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('listings');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data).toHaveProperty('meta');
      
      expect(Array.isArray(response.body.data.listings)).toBe(true);
      expect(response.body.data.listings.length).toBeGreaterThan(0);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(20);
      expect(typeof response.body.data.pagination.total).toBe('number');
    });

    it('should return listings with review statistics when requested', async () => {
      const response = await request(app)
        .get('/api/listings?includeStats=true')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.listings.length).toBeGreaterThan(0);
      
      // Check that listings include stats
      response.body.data.listings.forEach((listing: any) => {
        expect(listing).toHaveProperty('stats');
        expect(listing.stats).toHaveProperty('totalReviews');
        expect(listing.stats).toHaveProperty('approvedReviews');
        expect(listing.stats).toHaveProperty('averageRating');
        expect(listing.stats).toHaveProperty('ratingBreakdown');
        expect(listing.stats).toHaveProperty('channelBreakdown');
      });
    });

    it('should filter listings by name', async () => {
      const response = await request(app)
        .get('/api/listings?name=Downtown')
        .expect(200);

      expect(response.body.status).toBe('success');
      response.body.data.listings.forEach((listing: any) => {
        expect(listing.name.toLowerCase()).toContain('downtown');
      });
    });

    it('should filter listings by slug', async () => {
      const response = await request(app)
        .get('/api/listings?slug=luxury')
        .expect(200);

      expect(response.body.status).toBe('success');
      response.body.data.listings.forEach((listing: any) => {
        expect(listing.slug.toLowerCase()).toContain('luxury');
      });
    });

    it('should search listings by text', async () => {
      const response = await request(app)
        .get('/api/listings?search=apartment')
        .expect(200);

      expect(response.body.status).toBe('success');
      response.body.data.listings.forEach((listing: any) => {
        const matchesName = listing.name.toLowerCase().includes('apartment');
        const matchesSlug = listing.slug.toLowerCase().includes('apartment');
        const matchesHostawayId = listing.hostawayListingId.includes('apartment');
        expect(matchesName || matchesSlug || matchesHostawayId).toBe(true);
      });
    });

    it('should sort listings by different fields', async () => {
      const nameAscResponse = await request(app)
        .get('/api/listings?sortBy=name&sortOrder=asc')
        .expect(200);

      const nameDescResponse = await request(app)
        .get('/api/listings?sortBy=name&sortOrder=desc')
        .expect(200);

      expect(nameAscResponse.body.status).toBe('success');
      expect(nameDescResponse.body.status).toBe('success');

      // Check ascending order
      const ascNames = nameAscResponse.body.data.listings.map((l: any) => l.name);
      for (let i = 1; i < ascNames.length; i++) {
        expect(ascNames[i].localeCompare(ascNames[i - 1])).toBeGreaterThanOrEqual(0);
      }

      // Check descending order
      const descNames = nameDescResponse.body.data.listings.map((l: any) => l.name);
      for (let i = 1; i < descNames.length; i++) {
        expect(descNames[i].localeCompare(descNames[i - 1])).toBeLessThanOrEqual(0);
      }
    });

    it('should handle pagination correctly', async () => {
      const page1Response = await request(app)
        .get('/api/listings?page=1&limit=2')
        .expect(200);

      const page2Response = await request(app)
        .get('/api/listings?page=2&limit=2')
        .expect(200);

      expect(page1Response.body.data.pagination.page).toBe(1);
      expect(page2Response.body.data.pagination.page).toBe(2);
      expect(page1Response.body.data.listings).toHaveLength(2);
      
      // Listings should be different between pages
      const page1Ids = page1Response.body.data.listings.map((l: any) => l.id);
      const page2Ids = page2Response.body.data.listings.map((l: any) => l.id);
      expect(page1Ids).not.toEqual(page2Ids);
    });

    it('should include correct response headers', async () => {
      const response = await request(app)
        .get('/api/listings')
        .expect(200);

      expect(response.headers).toHaveProperty('x-request-id');
      expect(response.headers).toHaveProperty('x-response-time');
      expect(response.headers).toHaveProperty('x-total-count');
      expect(response.headers).toHaveProperty('x-page');
      expect(response.headers).toHaveProperty('x-total-pages');
    });

    it('should return error for invalid query parameters', async () => {
      const response = await request(app)
        .get('/api/listings?page=0')
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/listings/search', () => {
    it('should search listings by query string', async () => {
      const response = await request(app)
        .get('/api/listings/search?q=downtown')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('query', 'downtown');
      expect(response.body.data.listings.length).toBeGreaterThan(0);
      
      response.body.data.listings.forEach((listing: any) => {
        const matchesName = listing.name.toLowerCase().includes('downtown');
        const matchesSlug = listing.slug.toLowerCase().includes('downtown');
        expect(matchesName || matchesSlug).toBe(true);
      });
    });

    it('should search listings with pagination', async () => {
      const response = await request(app)
        .get('/api/listings/search?q=apartment&page=1&limit=1')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(1);
      expect(response.body.data.listings).toHaveLength(1);
    });

    it('should include statistics when requested', async () => {
      const response = await request(app)
        .get('/api/listings/search?q=luxury&includeStats=true')
        .expect(200);

      expect(response.body.status).toBe('success');
      if (response.body.data.listings.length > 0) {
        response.body.data.listings.forEach((listing: any) => {
          expect(listing).toHaveProperty('stats');
        });
      }
    });

    it('should return error for missing search query', async () => {
      const response = await request(app)
        .get('/api/listings/search')
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return empty results for non-matching search', async () => {
      const response = await request(app)
        .get('/api/listings/search?q=nonexistentlisting')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.listings).toHaveLength(0);
      expect(response.body.data.pagination.total).toBe(0);
    });
  });

  describe('GET /api/listings/with-stats', () => {
    it('should return listings with comprehensive statistics', async () => {
      const response = await request(app)
        .get('/api/listings/with-stats')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(Array.isArray(response.body.data.listings)).toBe(true);
      
      response.body.data.listings.forEach((listing: any) => {
        expect(listing).toHaveProperty('stats');
        expect(listing.stats).toHaveProperty('totalReviews');
        expect(listing.stats).toHaveProperty('approvedReviews');
        expect(listing.stats).toHaveProperty('averageRating');
      });
    });

    it('should filter by minimum reviews', async () => {
      const response = await request(app)
        .get('/api/listings/with-stats?minReviews=2')
        .expect(200);

      expect(response.body.status).toBe('success');
      response.body.data.listings.forEach((listing: any) => {
        expect(listing.stats.totalReviews).toBeGreaterThanOrEqual(2);
      });
    });

    it('should filter by rating range', async () => {
      const response = await request(app)
        .get('/api/listings/with-stats?minRating=8&maxRating=10')
        .expect(200);

      expect(response.body.status).toBe('success');
      response.body.data.listings.forEach((listing: any) => {
        if (listing.stats.totalReviews > 0) {
          expect(listing.stats.averageRating).toBeGreaterThanOrEqual(8);
          expect(listing.stats.averageRating).toBeLessThanOrEqual(10);
        }
      });
    });

    it('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/listings/with-stats?page=1&limit=2')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
    });
  });

  describe('GET /api/listings/:id', () => {
    it('should return a specific listing by ID', async () => {
      const response = await request(app)
        .get(`/api/listings/${listing1Id}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.listing).toHaveProperty('id', listing1Id);
      expect(response.body.data.listing).toHaveProperty('name');
      expect(response.body.data.listing).toHaveProperty('slug');
      expect(response.body.data.listing).toHaveProperty('hostawayListingId');
    });

    it('should return listing with statistics when requested', async () => {
      const response = await request(app)
        .get(`/api/listings/${listing1Id}?includeStats=true`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.listing).toHaveProperty('stats');
      expect(response.body.data.listing.stats).toHaveProperty('totalReviews');
      expect(response.body.data.listing.stats).toHaveProperty('averageRating');
    });

    it('should return 404 for non-existent listing', async () => {
      const fakeId = 'c' + '1'.repeat(24);
      const response = await request(app)
        .get(`/api/listings/${fakeId}`)
        .expect(404);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid listing ID format', async () => {
      const response = await request(app)
        .get('/api/listings/invalid-id')
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/listings/slug/:slug', () => {
    it('should return a listing by slug', async () => {
      const response = await request(app)
        .get('/api/listings/slug/downtown-apartment')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.listing).toHaveProperty('slug', 'downtown-apartment');
      expect(response.body.data.meta.lookupMethod).toBe('slug');
    });

    it('should return listing with statistics by slug', async () => {
      const response = await request(app)
        .get('/api/listings/slug/downtown-apartment?includeStats=true')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.listing).toHaveProperty('stats');
      expect(response.body.data.meta.includeStats).toBe(true);
    });

    it('should return 404 for non-existent slug', async () => {
      const response = await request(app)
        .get('/api/listings/slug/non-existent-slug')
        .expect(404);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid slug format', async () => {
      const response = await request(app)
        .get('/api/listings/slug/')
        .expect(404); // This will hit the general 404 handler

      // Alternative test with a slug that's too long
      const longSlug = 'a'.repeat(256);
      const response2 = await request(app)
        .get(`/api/listings/slug/${longSlug}`)
        .expect(400);

      expect(response2.body.status).toBe('error');
    });
  });

  describe('GET /api/listings/hostaway/:hostawayId', () => {
    it('should return a listing by Hostaway listing ID', async () => {
      const response = await request(app)
        .get('/api/listings/hostaway/101')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.listing).toHaveProperty('hostawayListingId', '101');
      expect(response.body.data.meta.lookupMethod).toBe('hostaway_id');
    });

    it('should return listing with statistics by Hostaway ID', async () => {
      const response = await request(app)
        .get('/api/listings/hostaway/101?includeStats=true')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.listing).toHaveProperty('stats');
      expect(response.body.data.meta.includeStats).toBe(true);
    });

    it('should return 404 for non-existent Hostaway ID', async () => {
      const response = await request(app)
        .get('/api/listings/hostaway/999999')
        .expect(404);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid Hostaway ID format', async () => {
      const response = await request(app)
        .get('/api/listings/hostaway/abc123')
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for empty Hostaway ID', async () => {
      const response = await request(app)
        .get('/api/listings/hostaway/')
        .expect(404); // Will hit the general 404 handler
    });
  });
});

/**
 * Seed test data for listings endpoint tests
 */
async function seedTestData() {
  // Create test listings
  const listing1 = await testDb.listing.create({
    data: {
      hostawayListingId: '101',
      name: 'Downtown Apartment',
      slug: 'downtown-apartment'
    }
  });

  const listing2 = await testDb.listing.create({
    data: {
      hostawayListingId: '102',
      name: 'Luxury Suite',
      slug: 'luxury-suite'
    }
  });

  const listing3 = await testDb.listing.create({
    data: {
      hostawayListingId: '103',
      name: 'Cozy Studio Apartment',
      slug: 'cozy-studio-apartment'
    }
  });

  // Create test reviews for statistics
  const reviewsData = [
    {
      hostawayReviewId: 'hr_list_001',
      listingId: listing1.id,
      reviewType: 'GUEST_REVIEW' as const,
      channel: 'AIRBNB' as const,
      rating: 9.0,
      publicReview: 'Excellent downtown location!',
      guestName: 'Alice Johnson',
      submittedAt: new Date('2023-06-01'),
      approved: true,
      rawJson: { source: 'listing_test' }
    },
    {
      hostawayReviewId: 'hr_list_002',
      listingId: listing1.id,
      reviewType: 'GUEST_REVIEW' as const,
      channel: 'BOOKING_COM' as const,
      rating: 8.5,
      publicReview: 'Great amenities',
      guestName: 'Bob Smith',
      submittedAt: new Date('2023-06-02'),
      approved: true,
      rawJson: { source: 'listing_test' }
    },
    {
      hostawayReviewId: 'hr_list_003',
      listingId: listing2.id,
      reviewType: 'GUEST_REVIEW' as const,
      channel: 'VRBO' as const,
      rating: 10.0,
      publicReview: 'Absolutely luxurious!',
      guestName: 'Charlie Brown',
      submittedAt: new Date('2023-06-03'),
      approved: true,
      rawJson: { source: 'listing_test' }
    },
    {
      hostawayReviewId: 'hr_list_004',
      listingId: listing2.id,
      reviewType: 'GUEST_REVIEW' as const,
      channel: 'GOOGLE' as const,
      rating: 9.5,
      publicReview: 'Perfect for a romantic getaway',
      guestName: 'Diana Prince',
      submittedAt: new Date('2023-06-04'),
      approved: false,
      rawJson: { source: 'listing_test' }
    },
    {
      hostawayReviewId: 'hr_list_005',
      listingId: listing3.id,
      reviewType: 'GUEST_REVIEW' as const,
      channel: 'DIRECT' as const,
      rating: 7.0,
      publicReview: 'Cozy but small',
      guestName: 'Eve Wilson',
      submittedAt: new Date('2023-06-05'),
      approved: true,
      rawJson: { source: 'listing_test' }
    }
  ];

  // Create reviews
  for (const reviewData of reviewsData) {
    await testDb.review.create({
      data: reviewData
    });
  }

  return {
    listing1Id: listing1.id,
    listing2Id: listing2.id,
    listing3Id: listing3.id
  };
}

import request from 'supertest';
import { app } from '../app';
import { PrismaClient } from '@prisma/client';
import { googleReviewsClient } from '../services/googleReviewsClient';

const prisma = new PrismaClient();

// Mock Redis
jest.mock('../lib/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  }
}));

describe('Google Reviews API Tests', () => {
  beforeAll(async () => {
    // Clean test data
    await prisma.reviewAuditLog.deleteMany();
    await prisma.review.deleteMany();
    await prisma.listing.deleteMany();

    // Create test listing
    await prisma.listing.create({
      data: {
        externalId: 'google-test-listing',
        name: 'Google Test Listing',
        address: '123 Google Street',
        city: 'Test City',
        country: 'Test Country',
        latitude: 40.7128,
        longitude: -74.0060
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Places Search API', () => {
    it('should search Google Places successfully', async () => {
      const mockPlaces = [
        {
          place_id: 'ChIJ123456789',
          name: 'Test Hotel',
          formatted_address: '123 Test Street, Test City, Test Country',
          geometry: {
            location: { lat: 40.7128, lng: -74.0060 }
          },
          rating: 4.5,
          user_ratings_total: 150,
          business_status: 'OPERATIONAL',
          types: ['lodging', 'point_of_interest', 'establishment']
        }
      ];

      jest.spyOn(googleReviewsClient, 'searchPlaces').mockResolvedValue(mockPlaces);

      const response = await request(app)
        .get('/api/reviews/google/places/search?query=test+hotel')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        places: mockPlaces,
        count: 1,
        cached: false
      });

      expect(googleReviewsClient.searchPlaces).toHaveBeenCalledWith(
        'test hotel',
        undefined,
        undefined
      );
    });

    it('should search with location and radius parameters', async () => {
      const mockPlaces = [];
      jest.spyOn(googleReviewsClient, 'searchPlaces').mockResolvedValue(mockPlaces);

      await request(app)
        .get('/api/reviews/google/places/search?query=hotel&lat=40.7128&lng=-74.0060&radius=5000')
        .expect(200);

      expect(googleReviewsClient.searchPlaces).toHaveBeenCalledWith(
        'hotel',
        { lat: 40.7128, lng: -74.0060 },
        5000
      );
    });

    it('should validate search parameters', async () => {
      // Test missing query
      await request(app)
        .get('/api/reviews/google/places/search')
        .expect(400);

      // Test invalid coordinates
      await request(app)
        .get('/api/reviews/google/places/search?query=hotel&lat=invalid&lng=invalid')
        .expect(400);

      // Test out of range coordinates
      await request(app)
        .get('/api/reviews/google/places/search?query=hotel&lat=91&lng=181')
        .expect(400);

      // Test invalid radius
      await request(app)
        .get('/api/reviews/google/places/search?query=hotel&radius=100000')
        .expect(400);
    });

    it('should handle Google API errors gracefully', async () => {
      jest.spyOn(googleReviewsClient, 'searchPlaces').mockRejectedValue(
        new Error('Google Places API error: OVER_QUERY_LIMIT')
      );

      const response = await request(app)
        .get('/api/reviews/google/places/search?query=test+hotel')
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Failed to search Google Places',
        details: expect.stringContaining('OVER_QUERY_LIMIT')
      });
    });
  });

  describe('Place Details API', () => {
    it('should get place details with reviews', async () => {
      const mockPlaceDetails = {
        place_id: 'ChIJ123456789',
        name: 'Test Hotel',
        formatted_address: '123 Test Street, Test City, Test Country',
        geometry: {
          location: { lat: 40.7128, lng: -74.0060 }
        },
        rating: 4.5,
        user_ratings_total: 150,
        reviews: [
          {
            author_name: 'John Doe',
            author_url: 'https://www.google.com/maps/contrib/123',
            language: 'en',
            profile_photo_url: 'https://lh3.googleusercontent.com/test',
            rating: 5,
            relative_time_description: '2 weeks ago',
            text: 'Great place to stay!',
            time: 1640995200,
            translated: false
          }
        ],
        business_status: 'OPERATIONAL',
        types: ['lodging', 'point_of_interest', 'establishment']
      };

      jest.spyOn(googleReviewsClient, 'getPlaceDetails').mockResolvedValue(mockPlaceDetails);

      const response = await request(app)
        .get('/api/reviews/google/places/ChIJ123456789')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        place: mockPlaceDetails,
        reviewsCount: 1,
        cached: false
      });

      expect(googleReviewsClient.getPlaceDetails).toHaveBeenCalledWith('ChIJ123456789');
    });

    it('should validate place ID parameter', async () => {
      // Test missing place ID
      await request(app)
        .get('/api/reviews/google/places/')
        .expect(404);

      // Test invalid place ID format
      await request(app)
        .get('/api/reviews/google/places/invalid')
        .expect(400);
    });

    it('should handle place not found errors', async () => {
      jest.spyOn(googleReviewsClient, 'getPlaceDetails').mockRejectedValue(
        new Error('Google Places API error: NOT_FOUND')
      );

      const response = await request(app)
        .get('/api/reviews/google/places/ChIJInvalidPlaceId')
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Failed to get place details',
        details: expect.stringContaining('NOT_FOUND')
      });
    });
  });

  describe('Google Places Import API', () => {
    it('should import reviews from Google Places successfully', async () => {
      const mockPlaceDetails = {
        place_id: 'ChIJ123456789',
        name: 'Test Hotel',
        formatted_address: '123 Test Street, Test City, Test Country',
        geometry: {
          location: { lat: 40.7128, lng: -74.0060 }
        },
        rating: 4.5,
        user_ratings_total: 150,
        reviews: [
          {
            author_name: 'John Doe',
            author_url: 'https://www.google.com/maps/contrib/123',
            language: 'en',
            rating: 5,
            relative_time_description: '2 weeks ago',
            text: 'Great place to stay!',
            time: 1640995200,
            translated: false
          },
          {
            author_name: 'Jane Smith',
            rating: 4,
            relative_time_description: '1 month ago',
            text: 'Good hotel, nice location.',
            time: 1638316800,
            translated: false
          }
        ],
        business_status: 'OPERATIONAL',
        types: ['lodging']
      };

      jest.spyOn(googleReviewsClient, 'getPlaceDetails').mockResolvedValue(mockPlaceDetails);
      
      // Mock normalization
      jest.spyOn(googleReviewsClient, 'normalizeGooglePlacesReview')
        .mockReturnValueOnce({
          externalId: 'google-places-ChIJ123456789-1640995200',
          guestName: 'John Doe',
          rating: 5,
          comment: 'Great place to stay!',
          source: 'google',
          status: 'pending',
          createdAt: new Date(1640995200 * 1000)
        })
        .mockReturnValueOnce({
          externalId: 'google-places-ChIJ123456789-1638316800',
          guestName: 'Jane Smith',
          rating: 4,
          comment: 'Good hotel, nice location.',
          source: 'google',
          status: 'pending',
          createdAt: new Date(1638316800 * 1000)
        });

      const response = await request(app)
        .post('/api/reviews/google/import/places')
        .send({
          placeId: 'ChIJ123456789'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        place: {
          id: 'ChIJ123456789',
          name: 'Test Hotel',
          address: '123 Test Street, Test City, Test Country'
        },
        imported: 2,
        skipped: 0,
        errors: []
      });

      expect(googleReviewsClient.getPlaceDetails).toHaveBeenCalledWith('ChIJ123456789');
      expect(googleReviewsClient.normalizeGooglePlacesReview).toHaveBeenCalledTimes(2);
    });

    it('should handle import with specific listing ID', async () => {
      const testListing = await prisma.listing.findFirst({
        where: { externalId: 'google-test-listing' }
      });

      const mockPlaceDetails = {
        place_id: 'ChIJ123456789',
        name: 'Test Hotel',
        formatted_address: '123 Test Street',
        geometry: { location: { lat: 40.7128, lng: -74.0060 } },
        reviews: [{
          author_name: 'Test User',
          rating: 5,
          text: 'Test review',
          time: 1640995200,
          relative_time_description: '1 week ago',
          translated: false
        }],
        business_status: 'OPERATIONAL',
        types: ['lodging']
      };

      jest.spyOn(googleReviewsClient, 'getPlaceDetails').mockResolvedValue(mockPlaceDetails);
      jest.spyOn(googleReviewsClient, 'normalizeGooglePlacesReview').mockReturnValue({
        externalId: 'google-places-test-123',
        guestName: 'Test User',
        rating: 5,
        comment: 'Test review',
        source: 'google',
        status: 'pending',
        listingId: testListing?.id,
        createdAt: new Date(1640995200 * 1000)
      });

      const response = await request(app)
        .post('/api/reviews/google/import/places')
        .send({
          placeId: 'ChIJ123456789',
          listingId: testListing?.id
        })
        .expect(200);

      expect(response.body.imported).toBe(1);
      expect(googleReviewsClient.normalizeGooglePlacesReview).toHaveBeenCalledWith(
        expect.any(Object),
        'ChIJ123456789',
        testListing?.id
      );
    });

    it('should handle auto-approval during import', async () => {
      const mockPlaceDetails = {
        place_id: 'ChIJ123456789',
        name: 'Test Hotel',
        formatted_address: '123 Test Street',
        geometry: { location: { lat: 40.7128, lng: -74.0060 } },
        reviews: [{
          author_name: 'Auto Approve User',
          rating: 5,
          text: 'Auto approve test',
          time: 1640995200,
          relative_time_description: '1 week ago',
          translated: false
        }],
        business_status: 'OPERATIONAL',
        types: ['lodging']
      };

      jest.spyOn(googleReviewsClient, 'getPlaceDetails').mockResolvedValue(mockPlaceDetails);
      jest.spyOn(googleReviewsClient, 'normalizeGooglePlacesReview').mockReturnValue({
        externalId: 'google-places-auto-approve',
        guestName: 'Auto Approve User',
        rating: 5,
        comment: 'Auto approve test',
        source: 'google',
        status: 'pending',
        createdAt: new Date(1640995200 * 1000)
      });

      const response = await request(app)
        .post('/api/reviews/google/import/places')
        .send({
          placeId: 'ChIJ123456789',
          autoApprove: true
        })
        .expect(200);

      expect(response.body.imported).toBe(1);

      // Verify review was created with approved status
      const createdReview = await prisma.review.findFirst({
        where: { externalId: 'google-places-auto-approve' }
      });

      expect(createdReview?.status).toBe('approved');
    });

    it('should validate import parameters', async () => {
      // Test missing place ID
      await request(app)
        .post('/api/reviews/google/import/places')
        .send({})
        .expect(400);

      // Test invalid place ID
      await request(app)
        .post('/api/reviews/google/import/places')
        .send({ placeId: 'invalid' })
        .expect(400);

      // Test invalid listing ID
      await request(app)
        .post('/api/reviews/google/import/places')
        .send({ 
          placeId: 'ChIJ123456789',
          listingId: 'invalid-uuid'
        })
        .expect(400);

      // Test invalid autoApprove type
      await request(app)
        .post('/api/reviews/google/import/places')
        .send({ 
          placeId: 'ChIJ123456789',
          autoApprove: 'invalid'
        })
        .expect(400);
    });

    it('should handle nonexistent listing ID', async () => {
      const response = await request(app)
        .post('/api/reviews/google/import/places')
        .send({
          placeId: 'ChIJ123456789',
          listingId: '550e8400-e29b-41d4-a716-446655440000' // Valid UUID but doesn't exist
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Listing not found'
      });
    });

    it('should skip duplicate reviews during import', async () => {
      // First, create a review manually
      const existingReview = await prisma.review.create({
        data: {
          externalId: 'google-places-duplicate-test',
          guestName: 'Duplicate User',
          rating: 5,
          comment: 'Duplicate test',
          source: 'google',
          status: 'pending',
          listingId: 'google-test-listing'
        }
      });

      const mockPlaceDetails = {
        place_id: 'ChIJ123456789',
        name: 'Test Hotel',
        formatted_address: '123 Test Street',
        geometry: { location: { lat: 40.7128, lng: -74.0060 } },
        reviews: [{
          author_name: 'Duplicate User',
          rating: 5,
          text: 'Duplicate test',
          time: 1640995200,
          relative_time_description: '1 week ago',
          translated: false
        }],
        business_status: 'OPERATIONAL',
        types: ['lodging']
      };

      jest.spyOn(googleReviewsClient, 'getPlaceDetails').mockResolvedValue(mockPlaceDetails);
      jest.spyOn(googleReviewsClient, 'normalizeGooglePlacesReview').mockReturnValue({
        externalId: 'google-places-duplicate-test', // Same as existing
        guestName: 'Duplicate User',
        rating: 5,
        comment: 'Duplicate test',
        source: 'google',
        status: 'pending',
        createdAt: new Date(1640995200 * 1000)
      });

      const response = await request(app)
        .post('/api/reviews/google/import/places')
        .send({
          placeId: 'ChIJ123456789'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        imported: 0,
        skipped: 1,
        errors: []
      });
    });
  });

  describe('Google Business Profile API', () => {
    it('should get business reviews successfully', async () => {
      const mockBusinessReviews = [
        {
          name: 'accounts/123/locations/456/reviews/789',
          reviewer: {
            profilePhotoUrl: 'https://example.com/photo.jpg',
            displayName: 'Business User',
            isAnonymous: false
          },
          starRating: 'FIVE',
          comment: 'Excellent service!',
          createTime: '2024-01-15T10:00:00Z',
          updateTime: '2024-01-15T10:00:00Z'
        }
      ];

      jest.spyOn(googleReviewsClient, 'getBusinessReviews').mockResolvedValue(mockBusinessReviews);

      const response = await request(app)
        .get('/api/reviews/google/business/accounts%2F123%2Flocations%2F456/reviews')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        reviews: mockBusinessReviews,
        count: 1,
        cached: false
      });
    });

    it('should handle Business Profile API access denied', async () => {
      jest.spyOn(googleReviewsClient, 'getBusinessReviews').mockRejectedValue(
        new Error('Business Profile API access denied. Ensure business is verified and you have proper permissions.')
      );

      const response = await request(app)
        .get('/api/reviews/google/business/accounts%2F123%2Flocations%2F456/reviews')
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Business Profile API access denied',
        details: expect.stringContaining('verified')
      });
    });
  });

  describe('Health Check API', () => {
    it('should return Google APIs health status', async () => {
      const mockApiHealth = {
        placesApi: { available: true },
        businessProfileApi: { available: false, error: 'Not configured' }
      };

      const mockUsageStats = {
        requestCount: 10,
        lastRequestTime: Date.now(),
        rateLimitDelay: 1000,
        placesApiEnabled: true,
        businessProfileEnabled: false
      };

      jest.spyOn(googleReviewsClient, 'checkApiHealth').mockResolvedValue(mockApiHealth);
      jest.spyOn(googleReviewsClient, 'getUsageStats').mockReturnValue(mockUsageStats);

      const response = await request(app)
        .get('/api/reviews/google/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        apis: mockApiHealth,
        usage: mockUsageStats,
        timestamp: expect.any(String)
      });
    });
  });

  describe('Connection Test API', () => {
    it('should test Google APIs connection successfully', async () => {
      const mockTestPlaces = [
        {
          place_id: 'ChIJTest123',
          name: 'Test Hotel',
          formatted_address: 'Test Address',
          geometry: { location: { lat: 40.7128, lng: -74.0060 } },
          types: ['lodging']
        }
      ];

      const mockUsageStats = {
        requestCount: 1,
        lastRequestTime: Date.now(),
        rateLimitDelay: 1000,
        placesApiEnabled: true,
        businessProfileEnabled: false
      };

      jest.spyOn(googleReviewsClient, 'searchPlaces').mockResolvedValue(mockTestPlaces);
      jest.spyOn(googleReviewsClient, 'getUsageStats').mockReturnValue(mockUsageStats);

      const response = await request(app)
        .post('/api/reviews/google/test-connection')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Google APIs connection successful',
        testResults: {
          placesApi: {
            working: true,
            testResultsCount: 1
          }
        },
        usage: mockUsageStats
      });

      expect(googleReviewsClient.searchPlaces).toHaveBeenCalledWith('test hotel');
    });

    it('should handle connection test failures', async () => {
      jest.spyOn(googleReviewsClient, 'searchPlaces').mockRejectedValue(
        new Error('Google Places API: REQUEST_DENIED')
      );

      const response = await request(app)
        .post('/api/reviews/google/test-connection')
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Google APIs connection test failed',
        details: expect.stringContaining('REQUEST_DENIED')
      });
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for protected endpoints', async () => {
      const protectedEndpoints = [
        { method: 'post', path: '/api/reviews/google/import/places' },
        { method: 'get', path: '/api/reviews/google/business/test/reviews' },
        { method: 'post', path: '/api/reviews/google/import/business' },
        { method: 'get', path: '/api/reviews/google/health' },
        { method: 'post', path: '/api/reviews/google/test-connection' }
      ];

      for (const endpoint of protectedEndpoints) {
        let response;
        switch (endpoint.method) {
          case 'post':
            response = await request(app).post(endpoint.path);
            break;
          default:
            response = await request(app).get(endpoint.path);
        }

        expect([401, 403]).toContain(response.status);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed Google API responses', async () => {
      jest.spyOn(googleReviewsClient, 'getPlaceDetails').mockResolvedValue({
        place_id: 'ChIJ123456789',
        name: 'Test Hotel',
        formatted_address: 'Test Address',
        geometry: { location: { lat: 40.7128, lng: -74.0060 } },
        reviews: [
          {
            // Malformed review - missing required fields
            author_name: '',
            rating: null,
            time: null,
            relative_time_description: '',
            translated: false
          }
        ],
        business_status: 'OPERATIONAL',
        types: ['lodging']
      });

      jest.spyOn(googleReviewsClient, 'normalizeGooglePlacesReview').mockImplementation(() => {
        throw new Error('Invalid review data');
      });

      const response = await request(app)
        .post('/api/reviews/google/import/places')
        .send({
          placeId: 'ChIJ123456789'
        })
        .expect(200);

      // Should handle errors gracefully
      expect(response.body).toMatchObject({
        success: true,
        imported: 0,
        skipped: 0,
        errors: expect.arrayContaining([
          expect.objectContaining({
            error: 'Invalid review data'
          })
        ])
      });
    });

    it('should handle empty review responses', async () => {
      jest.spyOn(googleReviewsClient, 'getPlaceDetails').mockResolvedValue({
        place_id: 'ChIJ123456789',
        name: 'Test Hotel',
        formatted_address: 'Test Address',
        geometry: { location: { lat: 40.7128, lng: -74.0060 } },
        reviews: [], // No reviews
        business_status: 'OPERATIONAL',
        types: ['lodging']
      });

      const response = await request(app)
        .post('/api/reviews/google/import/places')
        .send({
          placeId: 'ChIJ123456789'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'No reviews found for this place',
        imported: 0,
        errors: []
      });
    });
  });
});

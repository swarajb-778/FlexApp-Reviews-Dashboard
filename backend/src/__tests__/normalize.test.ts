/**
 * Unit tests for the normalization service
 * Tests all edge cases and normalization rules as specified in requirements
 */

import {
  normalizeReviews,
  normalizeReview,
  validateNormalizedReview,
  filterNormalizedReviews,
  sortNormalizedReviews
} from '../services/normalize';
import {
  HostawayReviewRaw,
  NormalizedReview,
  ReviewChannel,
  ReviewType
} from '../types/reviews';

describe('Normalize Service', () => {
  describe('normalizeReview', () => {
    it('should normalize a complete review with all fields', async () => {
      const rawReview: HostawayReviewRaw = {
        id: 12345,
        listingId: 789,
        guestName: 'John Doe',
        comment: 'Great place to stay!',
        rating: 8.5,
        reviewCategories: [
          { id: 1, name: 'Cleanliness', rating: 9, max_rating: 10 },
          { id: 2, name: 'Location', rating: 8, max_rating: 10 }
        ],
        createdAt: '2024-01-15T14:30:00Z',
        updatedAt: '2024-01-15T14:30:00Z',
        checkInDate: '2024-01-10T15:00:00Z',
        checkOutDate: '2024-01-14T11:00:00Z',
        reviewType: 'guest_review',
        channel: 'airbnb',
        approved: true,
        response: 'Thank you for staying with us!',
        responseDate: '2024-01-16T09:00:00Z',
        guestId: 456789,
        reservationId: 987654,
        language: 'en',
        source: 'airbnb_api'
      };

      const normalized = await normalizeReview(rawReview);

      expect(normalized).toBeTruthy();
      expect(normalized!.id).toBe(12345);
      expect(normalized!.listingId).toBe(789);
      expect(normalized!.guestName).toBe('John Doe');
      expect(normalized!.comment).toBe('Great place to stay!');
      expect(normalized!.rating).toBe(8.5);
      expect(normalized!.createdAt).toBe('2024-01-15T14:30:00.000Z');
      expect(normalized!.updatedAt).toBe('2024-01-15T14:30:00.000Z');
      expect(normalized!.checkInDate).toBe('2024-01-10T15:00:00.000Z');
      expect(normalized!.checkOutDate).toBe('2024-01-14T11:00:00.000Z');
      expect(normalized!.reviewType).toBe('guest_review');
      expect(normalized!.channel).toBe('airbnb');
      expect(normalized!.approved).toBe(true);
      expect(normalized!.response).toBe('Thank you for staying with us!');
      expect(normalized!.responseDate).toBe('2024-01-16T09:00:00.000Z');
      expect(normalized!.categories).toEqual({
        'cleanliness': 9.0,
        'location': 8.0
      });
      expect(normalized!.rawJson).toEqual(rawReview);
    });

    it('should calculate rating from categories when no direct rating', async () => {
      const rawReview: HostawayReviewRaw = {
        id: 12346,
        listingId: 789,
        guestName: 'Jane Smith',
        comment: 'Nice apartment',
        reviewCategories: [
          { id: 1, name: 'Cleanliness', rating: 8, max_rating: 10 },
          { id: 2, name: 'Location', rating: 9, max_rating: 10 },
          { id: 3, name: 'Value', rating: 7, max_rating: 10 }
        ],
        createdAt: '2024-01-15T14:30:00Z',
        updatedAt: '2024-01-15T14:30:00Z',
        reviewType: 'guest_review',
        channel: 'booking.com',
        approved: true
      };

      const normalized = await normalizeReview(rawReview);
      
      expect(normalized).toBeTruthy();
      expect(normalized!.rating).toBe(8.0); // Average of 8, 9, 7
    });

    it('should handle categories with different max_rating scales', async () => {
      const rawReview: HostawayReviewRaw = {
        id: 12347,
        listingId: 789,
        guestName: 'Bob Wilson',
        comment: 'Good stay overall',
        reviewCategories: [
          { id: 1, name: 'Cleanliness', rating: 4, max_rating: 5 }, // 8.0 on 10-scale
          { id: 2, name: 'Location', rating: 9, max_rating: 10 }    // 9.0 on 10-scale
        ],
        createdAt: '2024-01-15T14:30:00Z',
        updatedAt: '2024-01-15T14:30:00Z',
        reviewType: 'guest_review',
        channel: 'google',
        approved: true
      };

      const normalized = await normalizeReview(rawReview);
      
      expect(normalized).toBeTruthy();
      expect(normalized!.rating).toBe(8.5); // Average of 8.0 and 9.0
      expect(normalized!.categories).toEqual({
        'cleanliness': 8.0,
        'location': 9.0
      });
    });

    it('should use default rating when no rating or categories available', async () => {
      const rawReview: HostawayReviewRaw = {
        id: 12348,
        listingId: 789,
        guestName: 'Alice Brown',
        comment: 'Enjoyed the stay',
        createdAt: '2024-01-15T14:30:00Z',
        updatedAt: '2024-01-15T14:30:00Z',
        reviewType: 'guest_review',
        channel: 'direct',
        approved: true
      };

      const normalized = await normalizeReview(rawReview, { defaultRating: 7.0 });
      
      expect(normalized).toBeTruthy();
      expect(normalized!.rating).toBe(7.0);
    });

    it('should handle missing rating gracefully', async () => {
      const rawReview: HostawayReviewRaw = {
        id: 12349,
        listingId: 789,
        guestName: 'Charlie Green',
        comment: 'Pleasant experience',
        createdAt: '2024-01-15T14:30:00Z',
        updatedAt: '2024-01-15T14:30:00Z',
        reviewType: 'guest_review',
        channel: 'other',
        approved: true
      };

      const normalized = await normalizeReview(rawReview);
      
      expect(normalized).toBeNull(); // Should return null when no rating available
    });

    it('should normalize various date formats to ISO 8601 UTC', async () => {
      const testDates = [
        '2024-01-15T14:30:00Z',
        '2024-01-15T14:30:00.000Z',
        '2024-01-15 14:30:00',
        '2024-01-15T14:30:00+02:00'
      ];

      for (const dateStr of testDates) {
        const rawReview: HostawayReviewRaw = {
          id: 12350,
          listingId: 789,
          guestName: 'Date Test',
          comment: 'Testing dates',
          rating: 8.0,
          createdAt: dateStr,
          updatedAt: dateStr,
          reviewType: 'guest_review',
          channel: 'airbnb',
          approved: true
        };

        const normalized = await normalizeReview(rawReview);
        
        expect(normalized).toBeTruthy();
        expect(normalized!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(normalized!.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      }
    });

    it('should map review types correctly', async () => {
      const testCases = [
        { input: 'guest_review', expected: 'guest_review' },
        { input: 'guest', expected: 'guest_review' },
        { input: 'host_review', expected: 'host_review' },
        { input: 'host', expected: 'host_review' },
        { input: 'auto_review', expected: 'auto_review' },
        { input: 'automatic', expected: 'auto_review' },
        { input: 'system_review', expected: 'system_review' },
        { input: 'unknown_type', expected: 'guest_review' } // fallback
      ];

      for (const testCase of testCases) {
        const rawReview: HostawayReviewRaw = {
          id: 12351,
          listingId: 789,
          guestName: 'Type Test',
          comment: 'Testing types',
          rating: 8.0,
          createdAt: '2024-01-15T14:30:00Z',
          updatedAt: '2024-01-15T14:30:00Z',
          reviewType: testCase.input,
          channel: 'airbnb',
          approved: true
        };

        const normalized = await normalizeReview(rawReview);
        
        expect(normalized).toBeTruthy();
        expect(normalized!.reviewType).toBe(testCase.expected);
      }
    });

    it('should map channels correctly', async () => {
      const testCases = [
        { input: 'booking.com', expected: 'booking.com' },
        { input: 'bookingcom', expected: 'booking.com' },
        { input: 'booking', expected: 'booking.com' },
        { input: 'airbnb', expected: 'airbnb' },
        { input: 'google', expected: 'google' },
        { input: 'googlemaps', expected: 'google' },
        { input: 'direct', expected: 'direct' },
        { input: 'directbooking', expected: 'direct' },
        { input: 'unknown_channel', expected: 'other' } // fallback
      ];

      for (const testCase of testCases) {
        const rawReview: HostawayReviewRaw = {
          id: 12352,
          listingId: 789,
          guestName: 'Channel Test',
          comment: 'Testing channels',
          rating: 8.0,
          createdAt: '2024-01-15T14:30:00Z',
          updatedAt: '2024-01-15T14:30:00Z',
          reviewType: 'guest_review',
          channel: testCase.input,
          approved: true
        };

        const normalized = await normalizeReview(rawReview);
        
        expect(normalized).toBeTruthy();
        expect(normalized!.channel).toBe(testCase.expected);
      }
    });

    it('should sanitize guest names and comments', async () => {
      const rawReview: HostawayReviewRaw = {
        id: 12353,
        listingId: 789,
        guestName: '<script>alert("xss")</script>John Doe',
        comment: '<p>Great place!</p><script>alert("hack")</script>',
        rating: 8.0,
        createdAt: '2024-01-15T14:30:00Z',
        updatedAt: '2024-01-15T14:30:00Z',
        reviewType: 'guest_review',
        channel: 'airbnb',
        approved: true
      };

      const normalized = await normalizeReview(rawReview);
      
      expect(normalized).toBeTruthy();
      expect(normalized!.guestName).toBe('scriptalert(xss)/scriptJohn Doe');
      expect(normalized!.comment).toBe('pGreat place!/pscriptalert(hack)/script');
    });

    it('should handle empty or invalid guest names', async () => {
      const testCases = ['', null, undefined, '   ', '<>'];

      for (const guestName of testCases) {
        const rawReview: HostawayReviewRaw = {
          id: 12354,
          listingId: 789,
          guestName: guestName as any,
          comment: 'Test comment',
          rating: 8.0,
          createdAt: '2024-01-15T14:30:00Z',
          updatedAt: '2024-01-15T14:30:00Z',
          reviewType: 'guest_review',
          channel: 'airbnb',
          approved: true
        };

        const normalized = await normalizeReview(rawReview);
        
        expect(normalized).toBeTruthy();
        expect(normalized!.guestName).toBe('Anonymous Guest');
      }
    });

    it('should handle completely missing guestName field', async () => {
      const rawReview = {
        id: 12355,
        listingId: 789,
        // guestName field completely missing
        comment: 'Review without guest name',
        rating: 7.5,
        createdAt: '2024-01-15T14:30:00Z',
        updatedAt: '2024-01-15T14:30:00Z',
        reviewType: 'guest_review',
        channel: 'booking.com',
        approved: true
      } as HostawayReviewRaw;

      const normalized = await normalizeReview(rawReview);
      
      expect(normalized).toBeTruthy();
      expect(normalized!.guestName).toBe('Anonymous Guest');
    });

    it('should handle empty categories array and still normalize', async () => {
      const rawReview: HostawayReviewRaw = {
        id: 60001,
        listingId: 111,
        guestName: 'No Cats',
        comment: 'No categories provided',
        rating: 7.5,
        reviewCategories: [],
        createdAt: '2021/02/03 08:15:00',
        updatedAt: '2021/02/03 08:15:00',
        reviewType: 'guest_review',
        channel: 'booking.com',
        approved: true
      };

      const normalized = await normalizeReview(rawReview);
      expect(normalized).toBeTruthy();
      expect(normalized!.rating).toBe(7.5);
      expect(normalized!.categories).toEqual({});
      expect(normalized!.createdAt).toMatch(/Z$/);
    });

    it('should compute rating from categories when rating missing', async () => {
      const rawReview: HostawayReviewRaw = {
        id: 60002,
        listingId: 111,
        guestName: 'Missing Rating',
        comment: 'Categories present',
        reviewCategories: [
          { id: 1, name: 'cleanliness', rating: 8, max_rating: 10 },
          { id: 2, name: 'communication', rating: 9, max_rating: 10 }
        ],
        createdAt: '2021-03-01 10:00:00',
        updatedAt: '2021-03-01 10:00:00',
        reviewType: 'guest_review',
        channel: 'airbnb',
        approved: false
      } as any;

      const normalized = await normalizeReview(rawReview);
      expect(normalized).toBeTruthy();
      expect(normalized!.rating).toBe(8.5);
      expect(normalized!.categories).toEqual({ cleanliness: 8, communication: 9 });
    });
  });

  describe('normalizeReviews', () => {
    it('should normalize multiple reviews successfully', async () => {
      const rawReviews: HostawayReviewRaw[] = [
        {
          id: 1,
          listingId: 789,
          guestName: 'Alice',
          comment: 'Great!',
          rating: 9.0,
          createdAt: '2024-01-15T14:30:00Z',
          updatedAt: '2024-01-15T14:30:00Z',
          reviewType: 'guest_review',
          channel: 'airbnb',
          approved: true
        },
        {
          id: 2,
          listingId: 789,
          guestName: 'Bob',
          comment: 'Good!',
          rating: 8.0,
          createdAt: '2024-01-16T14:30:00Z',
          updatedAt: '2024-01-16T14:30:00Z',
          reviewType: 'guest_review',
          channel: 'booking.com',
          approved: true
        }
      ];

      const result = await normalizeReviews(rawReviews);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.processedCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle mixed valid and invalid reviews', async () => {
      const rawReviews: HostawayReviewRaw[] = [
        {
          id: 1,
          listingId: 789,
          guestName: 'Alice',
          comment: 'Great!',
          rating: 9.0,
          createdAt: '2024-01-15T14:30:00Z',
          updatedAt: '2024-01-15T14:30:00Z',
          reviewType: 'guest_review',
          channel: 'airbnb',
          approved: true
        },
        {
          // Missing required fields
          id: 2,
          listingId: 0, // Invalid listing ID
          guestName: '',
          comment: 'Invalid review',
          createdAt: 'invalid-date',
          updatedAt: '2024-01-16T14:30:00Z',
          reviewType: 'guest_review',
          channel: 'booking.com',
          approved: true
        } as any
      ];

      const result = await normalizeReviews(rawReviews, { strict: false });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.processedCount).toBe(1);
      expect(result.skippedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should fail in strict mode when encountering invalid reviews', async () => {
      const rawReviews: HostawayReviewRaw[] = [
        {
          id: 1,
          listingId: 789,
          guestName: 'Alice',
          comment: 'Great!',
          rating: 9.0,
          createdAt: '2024-01-15T14:30:00Z',
          updatedAt: '2024-01-15T14:30:00Z',
          reviewType: 'guest_review',
          channel: 'airbnb',
          approved: true
        },
        {
          // Invalid review
          id: 0, // Invalid ID
          listingId: 789,
          guestName: '',
          comment: '',
          createdAt: 'invalid-date',
          updatedAt: '2024-01-16T14:30:00Z',
          reviewType: 'guest_review',
          channel: 'booking.com',
          approved: true
        } as any
      ];

      const result = await normalizeReviews(rawReviews, { strict: true });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateNormalizedReview', () => {
    it('should validate a correct normalized review', () => {
      const review: NormalizedReview = {
        id: 123,
        listingId: 456,
        guestName: 'John Doe',
        comment: 'Great stay!',
        rating: 8.5,
        categories: { cleanliness: 9.0, location: 8.0 },
        createdAt: '2024-01-15T14:30:00.000Z',
        updatedAt: '2024-01-15T14:30:00.000Z',
        reviewType: 'guest_review',
        channel: 'airbnb',
        approved: true,
        rawJson: {} as any
      };

      expect(validateNormalizedReview(review)).toBe(true);
    });

    it('should reject reviews with invalid ratings', () => {
      const review: NormalizedReview = {
        id: 123,
        listingId: 456,
        guestName: 'John Doe',
        comment: 'Great stay!',
        rating: 15.0, // Invalid rating > 10
        categories: {},
        createdAt: '2024-01-15T14:30:00.000Z',
        updatedAt: '2024-01-15T14:30:00.000Z',
        reviewType: 'guest_review',
        channel: 'airbnb',
        approved: true,
        rawJson: {} as any
      };

      expect(validateNormalizedReview(review)).toBe(false);
    });

    it('should reject reviews with invalid dates', () => {
      const review: NormalizedReview = {
        id: 123,
        listingId: 456,
        guestName: 'John Doe',
        comment: 'Great stay!',
        rating: 8.5,
        categories: {},
        createdAt: 'invalid-date',
        updatedAt: '2024-01-15T14:30:00.000Z',
        reviewType: 'guest_review',
        channel: 'airbnb',
        approved: true,
        rawJson: {} as any
      };

      expect(validateNormalizedReview(review)).toBe(false);
    });
  });

  describe('filterNormalizedReviews', () => {
    const sampleReviews: NormalizedReview[] = [
      {
        id: 1,
        listingId: 123,
        guestName: 'Alice',
        comment: 'Great!',
        rating: 9.0,
        categories: {},
        createdAt: '2024-01-15T14:30:00.000Z',
        updatedAt: '2024-01-15T14:30:00.000Z',
        reviewType: 'guest_review',
        channel: 'airbnb',
        approved: true,
        rawJson: {} as any
      },
      {
        id: 2,
        listingId: 456,
        guestName: 'Bob',
        comment: 'Good!',
        rating: 7.5,
        categories: {},
        createdAt: '2024-01-16T14:30:00.000Z',
        updatedAt: '2024-01-16T14:30:00.000Z',
        reviewType: 'guest_review',
        channel: 'booking.com',
        approved: false,
        response: 'Thanks!',
        rawJson: {} as any
      }
    ];

    it('should filter by listing ID', () => {
      const filtered = filterNormalizedReviews(sampleReviews, { listingId: 123 });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].listingId).toBe(123);
    });

    it('should filter by approval status', () => {
      const approved = filterNormalizedReviews(sampleReviews, { approved: true });
      const unapproved = filterNormalizedReviews(sampleReviews, { approved: false });
      
      expect(approved).toHaveLength(1);
      expect(approved[0].approved).toBe(true);
      expect(unapproved).toHaveLength(1);
      expect(unapproved[0].approved).toBe(false);
    });

    it('should filter by rating range', () => {
      const highRated = filterNormalizedReviews(sampleReviews, { minRating: 8.0 });
      const lowRated = filterNormalizedReviews(sampleReviews, { maxRating: 8.0 });
      
      expect(highRated).toHaveLength(1);
      expect(highRated[0].rating).toBeGreaterThanOrEqual(8.0);
      expect(lowRated).toHaveLength(1);
      expect(lowRated[0].rating).toBeLessThanOrEqual(8.0);
    });

    it('should filter by response presence', () => {
      const withResponse = filterNormalizedReviews(sampleReviews, { hasResponse: true });
      const withoutResponse = filterNormalizedReviews(sampleReviews, { hasResponse: false });
      
      expect(withResponse).toHaveLength(1);
      expect(withResponse[0].response).toBeTruthy();
      expect(withoutResponse).toHaveLength(1);
      expect(withoutResponse[0].response).toBeFalsy();
    });
  });

  describe('sortNormalizedReviews', () => {
    const sampleReviews: NormalizedReview[] = [
      {
        id: 1,
        listingId: 123,
        guestName: 'Charlie',
        comment: 'Great!',
        rating: 9.0,
        categories: {},
        createdAt: '2024-01-17T14:30:00.000Z',
        updatedAt: '2024-01-17T14:30:00.000Z',
        reviewType: 'guest_review',
        channel: 'airbnb',
        approved: true,
        rawJson: {} as any
      },
      {
        id: 2,
        listingId: 456,
        guestName: 'Alice',
        comment: 'Good!',
        rating: 7.5,
        categories: {},
        createdAt: '2024-01-15T14:30:00.000Z',
        updatedAt: '2024-01-15T14:30:00.000Z',
        reviewType: 'guest_review',
        channel: 'booking.com',
        approved: true,
        rawJson: {} as any
      },
      {
        id: 3,
        listingId: 789,
        guestName: 'Bob',
        comment: 'Okay',
        rating: 6.0,
        categories: {},
        createdAt: '2024-01-16T14:30:00.000Z',
        updatedAt: '2024-01-16T14:30:00.000Z',
        reviewType: 'guest_review',
        channel: 'google',
        approved: true,
        rawJson: {} as any
      }
    ];

    it('should sort by creation date descending (newest first)', () => {
      const sorted = sortNormalizedReviews(sampleReviews, 'createdAt', 'desc');
      
      expect(sorted[0].createdAt).toBe('2024-01-17T14:30:00.000Z');
      expect(sorted[1].createdAt).toBe('2024-01-16T14:30:00.000Z');
      expect(sorted[2].createdAt).toBe('2024-01-15T14:30:00.000Z');
    });

    it('should sort by rating ascending', () => {
      const sorted = sortNormalizedReviews(sampleReviews, 'rating', 'asc');
      
      expect(sorted[0].rating).toBe(6.0);
      expect(sorted[1].rating).toBe(7.5);
      expect(sorted[2].rating).toBe(9.0);
    });

    it('should sort by guest name alphabetically', () => {
      const sorted = sortNormalizedReviews(sampleReviews, 'guestName', 'asc');
      
      expect(sorted[0].guestName).toBe('Alice');
      expect(sorted[1].guestName).toBe('Bob');
      expect(sorted[2].guestName).toBe('Charlie');
    });
  });
});

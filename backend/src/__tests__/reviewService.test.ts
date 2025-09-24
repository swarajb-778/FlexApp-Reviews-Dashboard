/**
 * Unit tests for the review service
 * Tests service functions in isolation with mocked dependencies
 */

import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

// Mock the database
jest.mock('../lib/database');
jest.mock('../lib/logger');
jest.mock('../services/cacheService');

import { db } from '../lib/database';
import { logger } from '../lib/logger';
import { invalidateListingCache } from '../services/cacheService';
import {
  getReviews,
  getReviewById,
  updateReview,
  approveReview,
  bulkUpdateReviews,
  getReviewStats
} from '../services/reviewService';

const prismaMock = mockDeep<PrismaClient>();
const loggerMock = logger as jest.Mocked<typeof logger>;
const invalidateCacheMock = invalidateListingCache as jest.MockedFunction<typeof invalidateListingCache>;

// Mock the database
(db as any) = prismaMock;

describe('Review Service', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
  });

  describe('getReviews', () => {
    it('should return paginated reviews with stats', async () => {
      // Mock data
      const mockListing = { id: 'listing1', hostawayListingId: '123' };
      const mockReviews = [
        {
          id: 'review1',
          hostawayReviewId: 'hr1',
          listingId: 'listing1',
          reviewType: 'GUEST_REVIEW',
          channel: 'AIRBNB',
          rating: 9.0,
          publicReview: 'Great place!',
          guestName: 'John Doe',
          submittedAt: new Date('2023-06-01'),
          approved: true,
          rawJson: null,
          createdAt: new Date('2023-06-01'),
          updatedAt: new Date('2023-06-01')
        }
      ];

      // Setup mocks
      prismaMock.listing.findFirst.mockResolvedValue(mockListing as any);
      prismaMock.review.findMany.mockResolvedValue(mockReviews as any);
      prismaMock.review.count.mockResolvedValue(1);
      prismaMock.review.aggregate.mockResolvedValue({ _avg: { rating: 9.0 }, _count: { approved: 1 } } as any);

      const filters = { listingId: 123 };
      const pagination = { page: 1, limit: 20 };
      const sort = { field: 'submittedAt' as const, order: 'desc' as const };

      const result = await getReviews(filters, pagination, sort);

      expect(result.reviews).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.stats.approved).toBe(1);
      expect(result.stats.averageRating).toBe(9.0);

      expect(prismaMock.listing.findFirst).toHaveBeenCalledWith({
        where: { hostawayListingId: '123' }
      });
      expect(prismaMock.review.findMany).toHaveBeenCalled();
      expect(prismaMock.review.count).toHaveBeenCalled();
    });

    it('should return empty results when listing not found', async () => {
      prismaMock.listing.findFirst.mockResolvedValue(null);

      const filters = { listingId: 999 };
      const result = await getReviews(filters);

      expect(result.reviews).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.stats.approved).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      const error = new Error('Database connection failed');
      prismaMock.review.findMany.mockRejectedValue(error);

      const filters = {};
      await expect(getReviews(filters)).rejects.toThrow('Failed to retrieve reviews');

      expect(loggerMock.error).toHaveBeenCalledWith(
        'Failed to get reviews',
        expect.objectContaining({
          error: 'Database connection failed'
        })
      );
    });

    it('should apply filtering correctly', async () => {
      prismaMock.review.findMany.mockResolvedValue([]);
      prismaMock.review.count.mockResolvedValue(0);
      prismaMock.review.aggregate.mockResolvedValue({ _avg: { rating: null }, _count: { approved: 0 } } as any);

      const filters = {
        approved: true,
        channel: 'airbnb' as const,
        minRating: 8,
        maxRating: 10,
        from: '2023-01-01',
        to: '2023-12-31'
      };

      await getReviews(filters);

      expect(prismaMock.review.findMany).toHaveBeenCalledWith({
        where: {
          approved: true,
          channel: 'AIRBNB',
          rating: { gte: 8, lte: 10 },
          submittedAt: {
            gte: new Date('2023-01-01'),
            lte: new Date('2023-12-31')
          }
        },
        include: {},
        orderBy: { submittedAt: 'desc' },
        skip: 0,
        take: 20
      });
    });
  });

  describe('getReviewById', () => {
    it('should return a review by ID', async () => {
      const mockReview = {
        id: 'review1',
        hostawayReviewId: 'hr1',
        listingId: 'listing1',
        reviewType: 'GUEST_REVIEW',
        channel: 'AIRBNB',
        rating: 9.0,
        publicReview: 'Great place!',
        guestName: 'John Doe',
        submittedAt: new Date('2023-06-01'),
        approved: true,
        rawJson: null,
        createdAt: new Date('2023-06-01'),
        updatedAt: new Date('2023-06-01')
      };

      prismaMock.review.findUnique.mockResolvedValue(mockReview as any);

      const result = await getReviewById('review1');

      expect(result).toEqual(expect.objectContaining({
        id: 'review1',
        guestName: 'John Doe',
        rating: 9.0
      }));
      expect(prismaMock.review.findUnique).toHaveBeenCalledWith({
        where: { id: 'review1' },
        include: {}
      });
    });

    it('should return null for non-existent review', async () => {
      prismaMock.review.findUnique.mockResolvedValue(null);

      const result = await getReviewById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      prismaMock.review.findUnique.mockRejectedValue(error);

      await expect(getReviewById('review1')).rejects.toThrow('Failed to retrieve review');
      expect(loggerMock.error).toHaveBeenCalled();
    });
  });

  describe('updateReview', () => {
    it('should update a review successfully', async () => {
      const mockExistingReview = {
        id: 'review1',
        listingId: 'listing1',
        approved: false,
        listing: { hostawayListingId: '123' }
      };

      const mockUpdatedReview = {
        ...mockExistingReview,
        approved: true,
        publicReview: 'Updated review text'
      };

      prismaMock.review.findUnique.mockResolvedValue(mockExistingReview as any);
      prismaMock.review.update.mockResolvedValue(mockUpdatedReview as any);
      invalidateCacheMock.mockResolvedValue(1);

      const updateData = { approved: true, publicReview: 'Updated review text' };
      const result = await updateReview('review1', updateData);

      expect(result.approved).toBe(true);
      expect(prismaMock.review.update).toHaveBeenCalledWith({
        where: { id: 'review1' },
        data: updateData,
        include: {
          listing: true,
          reviewCategories: true
        }
      });
      expect(invalidateCacheMock).toHaveBeenCalledWith(123);
      expect(loggerMock.info).toHaveBeenCalled();
    });

    it('should throw error for non-existent review', async () => {
      prismaMock.review.findUnique.mockResolvedValue(null);

      await expect(updateReview('nonexistent', { approved: true })).rejects.toThrow('Review not found');
    });

    it('should handle database errors', async () => {
      const error = new Error('Update failed');
      prismaMock.review.findUnique.mockRejectedValue(error);

      await expect(updateReview('review1', { approved: true })).rejects.toThrow('Failed to update review');
      expect(loggerMock.error).toHaveBeenCalled();
    });
  });

  describe('approveReview', () => {
    it('should approve a review with response', async () => {
      const mockExistingReview = {
        id: 'review1',
        listingId: 'listing1',
        approved: false,
        rawJson: { source: 'test' },
        listing: { hostawayListingId: '123' }
      };

      const mockUpdatedReview = {
        ...mockExistingReview,
        approved: true,
        rawJson: {
          source: 'test',
          response: 'Thank you!',
          responseDate: expect.any(String)
        }
      };

      prismaMock.review.findUnique.mockResolvedValue(mockExistingReview as any);
      prismaMock.review.update.mockResolvedValue(mockUpdatedReview as any);
      invalidateCacheMock.mockResolvedValue(1);

      const result = await approveReview('review1', true, 'Thank you!');

      expect(result.approved).toBe(true);
      expect(prismaMock.review.update).toHaveBeenCalledWith({
        where: { id: 'review1' },
        data: {
          approved: true,
          rawJson: expect.objectContaining({
            source: 'test',
            response: 'Thank you!',
            responseDate: expect.any(String)
          })
        },
        include: {
          listing: true,
          reviewCategories: true
        }
      });
      expect(invalidateCacheMock).toHaveBeenCalledWith(123);
      expect(loggerMock.info).toHaveBeenCalledWith(
        'Review approval status updated',
        expect.objectContaining({
          reviewId: 'review1',
          approved: true,
          previousApproval: false
        })
      );
    });

    it('should unapprove a review', async () => {
      const mockExistingReview = {
        id: 'review1',
        approved: true,
        listing: { hostawayListingId: '123' }
      };

      prismaMock.review.findUnique.mockResolvedValue(mockExistingReview as any);
      prismaMock.review.update.mockResolvedValue({ ...mockExistingReview, approved: false } as any);
      invalidateCacheMock.mockResolvedValue(1);

      const result = await approveReview('review1', false);

      expect(result.approved).toBe(false);
      expect(prismaMock.review.update).toHaveBeenCalledWith({
        where: { id: 'review1' },
        data: { approved: false },
        include: {
          listing: true,
          reviewCategories: true
        }
      });
    });

    it('should throw error for non-existent review', async () => {
      prismaMock.review.findUnique.mockResolvedValue(null);

      await expect(approveReview('nonexistent', true)).rejects.toThrow('Review not found');
    });
  });

  describe('bulkUpdateReviews', () => {
    it('should bulk update reviews successfully', async () => {
      const reviewIds = ['review1', 'review2', 'review3'];
      let callCount = 0;
      
      // Mock approveReview to succeed for all reviews
      jest.doMock('../services/reviewService', () => ({
        ...jest.requireActual('../services/reviewService'),
        approveReview: jest.fn().mockImplementation(async (id) => {
          callCount++;
          return { id, approved: true };
        })
      }));

      const mockExistingReviews = reviewIds.map(id => ({
        id,
        approved: false,
        listing: { hostawayListingId: '123' }
      }));

      const mockUpdatedReviews = reviewIds.map(id => ({
        id,
        approved: true,
        listing: { hostawayListingId: '123' }
      }));

      // Mock the findUnique calls for each review
      prismaMock.review.findUnique
        .mockResolvedValueOnce(mockExistingReviews[0] as any)
        .mockResolvedValueOnce(mockExistingReviews[1] as any)
        .mockResolvedValueOnce(mockExistingReviews[2] as any);

      // Mock the update calls
      prismaMock.review.update
        .mockResolvedValueOnce(mockUpdatedReviews[0] as any)
        .mockResolvedValueOnce(mockUpdatedReviews[1] as any)
        .mockResolvedValueOnce(mockUpdatedReviews[2] as any);

      invalidateCacheMock.mockResolvedValue(1);

      const request = {
        reviewIds,
        approved: true,
        response: 'Bulk approval'
      };

      const result = await bulkUpdateReviews(request);

      expect(result.success).toBe(true);
      expect(result.updated).toBe(3);
      expect(result.failed).toBe(0);
      expect(loggerMock.info).toHaveBeenCalledWith(
        'Bulk update completed',
        expect.objectContaining({
          requested: 3,
          updated: 3,
          failed: 0
        })
      );
    });

    it('should handle partial failures in bulk update', async () => {
      const reviewIds = ['review1', 'invalid', 'review3'];

      // Mock findUnique to succeed for valid reviews and fail for invalid
      prismaMock.review.findUnique
        .mockResolvedValueOnce({ id: 'review1', approved: false, listing: { hostawayListingId: '123' } } as any)
        .mockResolvedValueOnce(null) // Invalid review
        .mockResolvedValueOnce({ id: 'review3', approved: false, listing: { hostawayListingId: '123' } } as any);

      prismaMock.review.update
        .mockResolvedValueOnce({ id: 'review1', approved: true } as any)
        .mockResolvedValueOnce({ id: 'review3', approved: true } as any);

      invalidateCacheMock.mockResolvedValue(1);

      const request = {
        reviewIds,
        approved: true
      };

      const result = await bulkUpdateReviews(request);

      expect(result.success).toBe(false);
      expect(result.updated).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].error).toContain('Review not found');
    });
  });

  describe('getReviewStats', () => {
    it('should return comprehensive review statistics', async () => {
      // Mock the count queries
      prismaMock.review.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80)  // approved
        .mockResolvedValueOnce(20); // pending

      // Mock the aggregate query
      prismaMock.review.aggregate.mockResolvedValue({
        _avg: { rating: 8.5 }
      } as any);

      // Mock groupBy queries
      prismaMock.review.groupBy
        .mockResolvedValueOnce([ // Rating distribution
          { rating: 8, _count: { rating: 30 } },
          { rating: 9, _count: { rating: 40 } },
          { rating: 10, _count: { rating: 30 } }
        ] as any)
        .mockResolvedValueOnce([ // Channel distribution
          { channel: 'AIRBNB', _count: { channel: 60 } },
          { channel: 'BOOKING_COM', _count: { channel: 40 } }
        ] as any);

      // Mock the raw query for monthly trends
      prismaMock.$queryRaw.mockResolvedValue([
        { month: '2023-06', count: BigInt(20), avg_rating: 8.5 },
        { month: '2023-05', count: BigInt(25), avg_rating: 8.3 }
      ]);

      const result = await getReviewStats();

      expect(result.totalReviews).toBe(100);
      expect(result.approvedReviews).toBe(80);
      expect(result.pendingReviews).toBe(20);
      expect(result.averageRating).toBe(8.5);
      expect(result.ratingDistribution).toEqual({
        '8': 30,
        '9': 40,
        '10': 30
      });
      expect(result.channelDistribution).toEqual({
        'AIRBNB': 60,
        'BOOKING_COM': 40
      });
      expect(result.monthlyTrends).toHaveLength(2);
      expect(result.monthlyTrends[0]).toEqual({
        month: '2023-06',
        count: 20,
        averageRating: 8.5
      });
    });

    it('should handle empty statistics', async () => {
      prismaMock.review.count.mockResolvedValue(0);
      prismaMock.review.aggregate.mockResolvedValue({ _avg: { rating: null } } as any);
      prismaMock.review.groupBy.mockResolvedValue([]);
      prismaMock.$queryRaw.mockResolvedValue([]);

      const result = await getReviewStats();

      expect(result.totalReviews).toBe(0);
      expect(result.averageRating).toBe(0);
      expect(result.ratingDistribution).toEqual({});
      expect(result.channelDistribution).toEqual({});
      expect(result.monthlyTrends).toEqual([]);
    });

    it('should handle database errors', async () => {
      const error = new Error('Stats query failed');
      prismaMock.review.count.mockRejectedValue(error);

      await expect(getReviewStats()).rejects.toThrow('Failed to retrieve review statistics');
      expect(loggerMock.error).toHaveBeenCalled();
    });
  });
});

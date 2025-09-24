/**
 * Unit tests for the listing service
 * Tests service functions in isolation with mocked dependencies
 */

import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

// Mock the database
jest.mock('../lib/database');
jest.mock('../lib/logger');

import { db } from '../lib/database';
import { logger } from '../lib/logger';
import {
  getListings,
  getListingById,
  getListingBySlug,
  getListingByHostawayId,
  searchListings,
  getListingsWithReviewStats,
  createListing,
  updateListing
} from '../services/listingService';

const prismaMock = mockDeep<PrismaClient>();
const loggerMock = logger as jest.Mocked<typeof logger>;

// Mock the database
(db as any) = prismaMock;

describe('Listing Service', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
  });

  describe('getListings', () => {
    it('should return paginated listings', async () => {
      const mockListings = [
        {
          id: 'listing1',
          hostawayListingId: '101',
          name: 'Test Listing 1',
          slug: 'test-listing-1',
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01')
        },
        {
          id: 'listing2',
          hostawayListingId: '102',
          name: 'Test Listing 2',
          slug: 'test-listing-2',
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02')
        }
      ];

      prismaMock.listing.findMany.mockResolvedValue(mockListings as any);
      prismaMock.listing.count.mockResolvedValue(2);

      const queryParams = { page: 1, limit: 20 };
      const result = await getListings(queryParams);

      expect(result.listings).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(prismaMock.listing.findMany).toHaveBeenCalledWith({
        where: {},
        include: {},
        orderBy: { name: 'asc' },
        skip: 0,
        take: 20
      });
    });

    it('should return listings with review statistics', async () => {
      const mockListings = [
        {
          id: 'listing1',
          hostawayListingId: '101',
          name: 'Test Listing',
          slug: 'test-listing',
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          reviews: [
            { id: 'review1', rating: 9.0, approved: true, submittedAt: new Date(), channel: 'AIRBNB' },
            { id: 'review2', rating: 8.5, approved: true, submittedAt: new Date(), channel: 'BOOKING_COM' }
          ]
        }
      ];

      prismaMock.listing.findMany.mockResolvedValue(mockListings as any);
      prismaMock.listing.count.mockResolvedValue(1);

      const queryParams = { page: 1, limit: 20, includeStats: true };
      const result = await getListings(queryParams);

      expect(result.listings).toHaveLength(1);
      expect(result.listings[0].stats).toBeDefined();
      expect(result.listings[0].stats?.totalReviews).toBe(2);
      expect(result.listings[0].stats?.averageRating).toBe(8.75);
      expect(result.listings[0].stats?.ratingBreakdown).toBeDefined();
      expect(result.listings[0].stats?.channelBreakdown).toBeDefined();
    });

    it('should filter listings by name', async () => {
      prismaMock.listing.findMany.mockResolvedValue([]);
      prismaMock.listing.count.mockResolvedValue(0);

      const queryParams = { name: 'downtown' };
      await getListings(queryParams);

      expect(prismaMock.listing.findMany).toHaveBeenCalledWith({
        where: {
          name: { contains: 'downtown', mode: 'insensitive' }
        },
        include: {},
        orderBy: { name: 'asc' },
        skip: 0,
        take: 20
      });
    });

    it('should search listings', async () => {
      prismaMock.listing.findMany.mockResolvedValue([]);
      prismaMock.listing.count.mockResolvedValue(0);

      const queryParams = { search: 'luxury apartment' };
      await getListings(queryParams);

      expect(prismaMock.listing.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'luxury apartment', mode: 'insensitive' } },
            { slug: { contains: 'luxury apartment', mode: 'insensitive' } },
            { hostawayListingId: { contains: 'luxury apartment', mode: 'insensitive' } }
          ]
        },
        include: {},
        orderBy: { name: 'asc' },
        skip: 0,
        take: 20
      });
    });

    it('should handle database errors gracefully', async () => {
      const error = new Error('Database connection failed');
      prismaMock.listing.findMany.mockRejectedValue(error);

      await expect(getListings()).rejects.toThrow('Failed to retrieve listings');
      expect(loggerMock.error).toHaveBeenCalledWith(
        'Failed to get listings',
        expect.objectContaining({
          error: 'Database connection failed'
        })
      );
    });
  });

  describe('getListingById', () => {
    it('should return a listing by ID', async () => {
      const mockListing = {
        id: 'listing1',
        hostawayListingId: '101',
        name: 'Test Listing',
        slug: 'test-listing',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01')
      };

      prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);

      const result = await getListingById('listing1');

      expect(result).toEqual(expect.objectContaining({
        id: 'listing1',
        name: 'Test Listing',
        slug: 'test-listing'
      }));
      expect(prismaMock.listing.findUnique).toHaveBeenCalledWith({
        where: { id: 'listing1' },
        include: {}
      });
    });

    it('should return null for non-existent listing', async () => {
      prismaMock.listing.findUnique.mockResolvedValue(null);

      const result = await getListingById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      prismaMock.listing.findUnique.mockRejectedValue(error);

      await expect(getListingById('listing1')).rejects.toThrow('Failed to retrieve listing');
      expect(loggerMock.error).toHaveBeenCalled();
    });
  });

  describe('getListingBySlug', () => {
    it('should return a listing by slug', async () => {
      const mockListing = {
        id: 'listing1',
        hostawayListingId: '101',
        name: 'Test Listing',
        slug: 'test-listing',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01')
      };

      prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);

      const result = await getListingBySlug('test-listing');

      expect(result?.slug).toBe('test-listing');
      expect(prismaMock.listing.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test-listing' },
        include: {}
      });
    });

    it('should return null for non-existent slug', async () => {
      prismaMock.listing.findUnique.mockResolvedValue(null);

      const result = await getListingBySlug('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getListingByHostawayId', () => {
    it('should return a listing by Hostaway ID', async () => {
      const mockListing = {
        id: 'listing1',
        hostawayListingId: '101',
        name: 'Test Listing',
        slug: 'test-listing',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01')
      };

      prismaMock.listing.findUnique.mockResolvedValue(mockListing as any);

      const result = await getListingByHostawayId('101');

      expect(result?.hostawayListingId).toBe('101');
      expect(prismaMock.listing.findUnique).toHaveBeenCalledWith({
        where: { hostawayListingId: '101' },
        include: {}
      });
    });

    it('should return null for non-existent Hostaway ID', async () => {
      prismaMock.listing.findUnique.mockResolvedValue(null);

      const result = await getListingByHostawayId('999');

      expect(result).toBeNull();
    });
  });

  describe('searchListings', () => {
    it('should search listings by term', async () => {
      const mockListings = [
        {
          id: 'listing1',
          hostawayListingId: '101',
          name: 'Downtown Apartment',
          slug: 'downtown-apartment',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      prismaMock.listing.findMany.mockResolvedValue(mockListings as any);
      prismaMock.listing.count.mockResolvedValue(1);

      const result = await searchListings('downtown', { page: 1, limit: 20 });

      expect(result.listings).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prismaMock.listing.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'downtown', mode: 'insensitive' } },
            { slug: { contains: 'downtown', mode: 'insensitive' } },
            { hostawayListingId: { contains: 'downtown', mode: 'insensitive' } }
          ]
        },
        include: {},
        orderBy: { name: 'asc' },
        skip: 0,
        take: 20
      });
    });

    it('should handle empty search results', async () => {
      prismaMock.listing.findMany.mockResolvedValue([]);
      prismaMock.listing.count.mockResolvedValue(0);

      const result = await searchListings('nonexistent');

      expect(result.listings).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getListingsWithReviewStats', () => {
    it('should return listings with comprehensive statistics', async () => {
      const mockQueryResult = [
        {
          id: 'listing1',
          hostaway_listing_id: '101',
          name: 'Test Listing',
          slug: 'test-listing',
          created_at: new Date(),
          updated_at: new Date(),
          review_count: BigInt(5),
          approved_count: BigInt(4),
          avg_rating: 8.5,
          last_review_date: new Date()
        }
      ];

      const mockCountResult = [{ count: BigInt(1) }];

      prismaMock.$queryRaw
        .mockResolvedValueOnce(mockQueryResult)  // Main query
        .mockResolvedValueOnce(mockCountResult); // Count query

      const result = await getListingsWithReviewStats();

      expect(result.listings).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.listings[0].stats?.totalReviews).toBe(5);
      expect(result.listings[0].stats?.approvedReviews).toBe(4);
      expect(result.listings[0].stats?.averageRating).toBe(8.5);
    });

    it('should filter by minimum reviews', async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);

      const filters = { minReviews: 5 };
      await getListingsWithReviewStats(filters);

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      // Verify the raw query contains the filter logic
    });

    it('should handle database errors', async () => {
      const error = new Error('Query failed');
      prismaMock.$queryRaw.mockRejectedValue(error);

      await expect(getListingsWithReviewStats()).rejects.toThrow('Failed to retrieve listings with stats');
      expect(loggerMock.error).toHaveBeenCalled();
    });
  });

  describe('createListing', () => {
    it('should create a new listing', async () => {
      const mockListing = {
        id: 'listing1',
        hostawayListingId: '101',
        name: 'New Listing',
        slug: 'new-listing',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock slug uniqueness check
      prismaMock.listing.findUnique.mockResolvedValue(null);
      prismaMock.listing.create.mockResolvedValue(mockListing as any);

      const listingData = {
        hostawayListingId: '101',
        name: 'New Listing'
      };

      const result = await createListing(listingData);

      expect(result.name).toBe('New Listing');
      expect(result.slug).toBe('new-listing');
      expect(prismaMock.listing.create).toHaveBeenCalledWith({
        data: {
          hostawayListingId: '101',
          name: 'New Listing',
          slug: 'new-listing'
        }
      });
      expect(loggerMock.info).toHaveBeenCalled();
    });

    it('should generate unique slug when collision occurs', async () => {
      const mockExistingListing = { id: 'existing', slug: 'new-listing' };
      const mockCreatedListing = {
        id: 'listing1',
        hostawayListingId: '101',
        name: 'New Listing',
        slug: 'new-listing-1',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock slug collision
      prismaMock.listing.findUnique
        .mockResolvedValueOnce(mockExistingListing as any) // First check - collision
        .mockResolvedValueOnce(null); // Second check - unique

      prismaMock.listing.create.mockResolvedValue(mockCreatedListing as any);

      const listingData = {
        hostawayListingId: '101',
        name: 'New Listing'
      };

      const result = await createListing(listingData);

      expect(result.slug).toBe('new-listing-1');
    });

    it('should handle database errors', async () => {
      const error = new Error('Create failed');
      prismaMock.listing.findUnique.mockResolvedValue(null);
      prismaMock.listing.create.mockRejectedValue(error);

      const listingData = {
        hostawayListingId: '101',
        name: 'New Listing'
      };

      await expect(createListing(listingData)).rejects.toThrow('Failed to create listing');
      expect(loggerMock.error).toHaveBeenCalled();
    });
  });

  describe('updateListing', () => {
    it('should update an existing listing', async () => {
      const mockUpdatedListing = {
        id: 'listing1',
        hostawayListingId: '101',
        name: 'Updated Listing',
        slug: 'updated-listing',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      prismaMock.listing.findFirst.mockResolvedValue(null); // No slug collision
      prismaMock.listing.update.mockResolvedValue(mockUpdatedListing as any);

      const updateData = {
        name: 'Updated Listing',
        slug: 'updated-listing'
      };

      const result = await updateListing('listing1', updateData);

      expect(result.name).toBe('Updated Listing');
      expect(prismaMock.listing.update).toHaveBeenCalledWith({
        where: { id: 'listing1' },
        data: updateData
      });
      expect(loggerMock.info).toHaveBeenCalled();
    });

    it('should throw error for slug collision', async () => {
      const mockExistingListing = { id: 'other-listing', slug: 'taken-slug' };
      prismaMock.listing.findFirst.mockResolvedValue(mockExistingListing as any);

      const updateData = { slug: 'taken-slug' };

      await expect(updateListing('listing1', updateData)).rejects.toThrow('Slug already exists');
      expect(prismaMock.listing.update).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const error = new Error('Update failed');
      prismaMock.listing.findFirst.mockResolvedValue(null);
      prismaMock.listing.update.mockRejectedValue(error);

      const updateData = { name: 'Updated Name' };

      await expect(updateListing('listing1', updateData)).rejects.toThrow('Failed to update listing');
      expect(loggerMock.error).toHaveBeenCalled();
    });
  });
});

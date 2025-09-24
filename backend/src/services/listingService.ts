/**
 * Listing service for managing property metadata and statistics
 * Handles database interactions for listings with review aggregation
 */

import { PrismaClient, Prisma, Listing, Review } from '@prisma/client';
import { db } from '../lib/database';
import { logger } from '../lib/logger';
import {
  ListingWithStats,
  ListingQueryParams,
  ServiceOptions
} from '../types/reviews';

// Type for database listing with relations
type ListingWithRelations = Listing & {
  reviews?: Review[];
  _count?: {
    reviews: number;
  };
};

/**
 * Get listings with filtering, sorting, and pagination
 */
export async function getListings(
  queryParams: ListingQueryParams = {},
  options: ServiceOptions = {}
): Promise<{
  listings: ListingWithStats[];
  total: number;
}> {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      name,
      slug,
      includeStats = false,
      sortBy = 'name',
      sortOrder = 'asc'
    } = queryParams;

    const offset = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ListingWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { hostawayListingId: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (name) {
      where.name = { contains: name, mode: 'insensitive' };
    }

    if (slug) {
      where.slug = { contains: slug, mode: 'insensitive' };
    }

    // Handle averageRating sorting separately with raw SQL since it requires aggregation
    if (sortBy === 'averageRating' && includeStats) {
      return await getListingsWithRatingSortFromDB(where, offset, limit, sortOrder, includeStats);
    }

    // Build order by clause for non-rating sorts
    const orderBy: Prisma.ListingOrderByWithRelationInput = {};
    switch (sortBy) {
      case 'name':
        orderBy.name = sortOrder;
        break;
      case 'createdAt':
        orderBy.createdAt = sortOrder;
        break;
      case 'reviewCount':
        orderBy.reviews = { _count: sortOrder };
        break;
      default:
        orderBy.name = 'asc';
    }

    // Build include clause
    const include: Prisma.ListingInclude = {};
    if (includeStats) {
      include.reviews = {
        select: {
          id: true,
          rating: true,
          approved: true,
          submittedAt: true,
          channel: true
        }
      };
      include._count = {
        select: {
          reviews: true
        }
      };
    }

    // Execute queries
    const [listings, total] = await Promise.all([
      db.listing.findMany({
        where,
        include,
        orderBy,
        skip: offset,
        take: limit
      }),
      db.listing.count({ where })
    ]);

    // Transform to API format
    const transformedListings: ListingWithStats[] = await Promise.all(
      listings.map(async (listing) => await transformListingToAPI(listing, includeStats))
    );

    logger.info('Retrieved listings successfully', {
      total,
      returned: listings.length,
      includeStats,
      sortBy,
      sortOrder
    });

    return {
      listings: transformedListings,
      total
    };

  } catch (error) {
    logger.error('Failed to get listings', {
      error: error instanceof Error ? error.message : String(error),
      queryParams
    });
    throw new Error(`Failed to retrieve listings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a single listing by ID
 */
export async function getListingById(
  listingId: string,
  includeStats: boolean = false
): Promise<ListingWithStats | null> {
  try {
    const include: Prisma.ListingInclude = {};
    if (includeStats) {
      include.reviews = {
        select: {
          id: true,
          rating: true,
          approved: true,
          submittedAt: true,
          channel: true
        }
      };
      include._count = {
        select: {
          reviews: true
        }
      };
    }

    const listing = await db.listing.findUnique({
      where: { id: listingId },
      include
    });

    if (!listing) {
      return null;
    }

    return await transformListingToAPI(listing, includeStats);

  } catch (error) {
    logger.error('Failed to get listing by ID', {
      listingId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error(`Failed to retrieve listing: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a listing by slug
 */
export async function getListingBySlug(
  slug: string,
  includeStats: boolean = false
): Promise<ListingWithStats | null> {
  try {
    const include: Prisma.ListingInclude = {};
    if (includeStats) {
      include.reviews = {
        select: {
          id: true,
          rating: true,
          approved: true,
          submittedAt: true,
          channel: true
        }
      };
      include._count = {
        select: {
          reviews: true
        }
      };
    }

    const listing = await db.listing.findUnique({
      where: { slug },
      include
    });

    if (!listing) {
      return null;
    }

    return await transformListingToAPI(listing, includeStats);

  } catch (error) {
    logger.error('Failed to get listing by slug', {
      slug,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error(`Failed to retrieve listing: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a listing by Hostaway listing ID
 */
export async function getListingByHostawayId(
  hostawayListingId: string,
  includeStats: boolean = false
): Promise<ListingWithStats | null> {
  try {
    const include: Prisma.ListingInclude = {};
    if (includeStats) {
      include.reviews = {
        select: {
          id: true,
          rating: true,
          approved: true,
          submittedAt: true,
          channel: true
        }
      };
      include._count = {
        select: {
          reviews: true
        }
      };
    }

    const listing = await db.listing.findUnique({
      where: { hostawayListingId },
      include
    });

    if (!listing) {
      return null;
    }

    return await transformListingToAPI(listing, includeStats);

  } catch (error) {
    logger.error('Failed to get listing by Hostaway ID', {
      hostawayListingId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error(`Failed to retrieve listing: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Search listings by text
 */
export async function searchListings(
  searchTerm: string,
  pagination: { page: number; limit: number } = { page: 1, limit: 20 },
  includeStats: boolean = false
): Promise<{
  listings: ListingWithStats[];
  total: number;
}> {
  try {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    const where: Prisma.ListingWhereInput = {
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { slug: { contains: searchTerm, mode: 'insensitive' } },
        { hostawayListingId: { contains: searchTerm, mode: 'insensitive' } }
      ]
    };

    const include: Prisma.ListingInclude = {};
    if (includeStats) {
      include.reviews = {
        select: {
          id: true,
          rating: true,
          approved: true,
          submittedAt: true,
          channel: true
        }
      };
      include._count = {
        select: {
          reviews: true
        }
      };
    }

    const [listings, total] = await Promise.all([
      db.listing.findMany({
        where,
        include,
        orderBy: { name: 'asc' },
        skip: offset,
        take: limit
      }),
      db.listing.count({ where })
    ]);

    const transformedListings = await Promise.all(
      listings.map(async (listing) => await transformListingToAPI(listing, includeStats))
    );

    logger.info('Search completed successfully', {
      searchTerm,
      total,
      returned: listings.length
    });

    return {
      listings: transformedListings,
      total
    };

  } catch (error) {
    logger.error('Failed to search listings', {
      searchTerm,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error(`Failed to search listings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get listings with comprehensive review statistics
 */
export async function getListingsWithReviewStats(
  filters: {
    minReviews?: number;
    minRating?: number;
    maxRating?: number;
    channels?: string[];
  } = {},
  pagination: { page: number; limit: number } = { page: 1, limit: 20 }
): Promise<{
  listings: ListingWithStats[];
  total: number;
}> {
  try {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    // Map channel names to database values if channels filter is provided
    let channelFilter = Prisma.empty;
    if (filters.channels && filters.channels.length > 0) {
      const channelMapping: Record<string, string> = {
        'airbnb': 'AIRBNB',
        'booking.com': 'BOOKING_COM', 
        'google': 'GOOGLE',
        'direct': 'DIRECT',
        'vrbo': 'VRBO',
        'other': 'OTHER'
      };
      
      const mappedChannels = filters.channels
        .map(channel => channelMapping[channel.toLowerCase()])
        .filter(Boolean);
      
      if (mappedChannels.length > 0) {
        channelFilter = Prisma.sql`AND r.channel = ANY(${mappedChannels})`;
      }
    }

    // Use raw query for complex aggregation with proper parameter binding
    const listingsWithStats = await db.$queryRaw<Array<{
      id: string;
      hostaway_listing_id: string;
      name: string;
      slug: string;
      created_at: Date;
      updated_at: Date;
      review_count: bigint;
      approved_count: bigint;
      avg_rating: number;
      last_review_date: Date | null;
    }>>`
      SELECT 
        l.id,
        l.hostaway_listing_id,
        l.name,
        l.slug,
        l.created_at,
        l.updated_at,
        COUNT(r.id)::bigint as review_count,
        COUNT(CASE WHEN r.approved = true THEN 1 END)::bigint as approved_count,
        AVG(r.rating)::float as avg_rating,
        MAX(r.submitted_at) as last_review_date
      FROM listings l
      LEFT JOIN reviews r ON l.id = r.listing_id ${channelFilter}
      GROUP BY l.id, l.hostaway_listing_id, l.name, l.slug, l.created_at, l.updated_at
      HAVING COUNT(r.id) >= ${filters.minReviews || 0}
        ${filters.minRating !== undefined ? Prisma.sql`AND AVG(r.rating) >= ${filters.minRating}` : Prisma.empty}
        ${filters.maxRating !== undefined ? Prisma.sql`AND AVG(r.rating) <= ${filters.maxRating}` : Prisma.empty}
      ORDER BY avg_rating DESC NULLS LAST, review_count DESC
      OFFSET ${offset}
      LIMIT ${limit}
    `;

    // Get total count with the same filters
    const totalResult = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint as count
      FROM (
        SELECT l.id
        FROM listings l
        LEFT JOIN reviews r ON l.id = r.listing_id ${channelFilter}
        GROUP BY l.id
        HAVING COUNT(r.id) >= ${filters.minReviews || 0}
          ${filters.minRating !== undefined ? Prisma.sql`AND AVG(r.rating) >= ${filters.minRating}` : Prisma.empty}
          ${filters.maxRating !== undefined ? Prisma.sql`AND AVG(r.rating) <= ${filters.maxRating}` : Prisma.empty}
      ) subquery
    `;

    const total = Number(totalResult[0]?.count || 0);

    // Transform to API format
    const transformedListings: ListingWithStats[] = listingsWithStats.map(listing => ({
      id: listing.id,
      hostawayListingId: listing.hostaway_listing_id,
      name: listing.name,
      slug: listing.slug,
      createdAt: listing.created_at.toISOString(),
      updatedAt: listing.updated_at.toISOString(),
      stats: {
        totalReviews: Number(listing.review_count),
        approvedReviews: Number(listing.approved_count),
        averageRating: listing.avg_rating || 0,
        ratingBreakdown: {}, // Would need additional query for breakdown
        channelBreakdown: {}, // Would need additional query for breakdown
        lastReviewDate: listing.last_review_date?.toISOString()
      }
    }));

    logger.info('Retrieved listings with stats successfully', {
      total,
      returned: listingsWithStats.length,
      filters
    });

    return {
      listings: transformedListings,
      total
    };

  } catch (error) {
    logger.error('Failed to get listings with stats', {
      error: error instanceof Error ? error.message : String(error),
      filters
    });
    throw new Error(`Failed to retrieve listings with stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get listings sorted by average rating using database-level sorting
 */
async function getListingsWithRatingSortFromDB(
  where: any,
  offset: number,
  limit: number,
  sortOrder: 'asc' | 'desc',
  includeStats: boolean
): Promise<{ listings: ListingWithStats[]; total: number }> {
  try {
    // Build WHERE conditions for raw SQL
    const whereConditions = [];
    
    if (where.name?.contains) {
      whereConditions.push(`l.name ILIKE '%${where.name.contains}%'`);
    }
    if (where.slug?.contains) {
      whereConditions.push(`l.slug ILIKE '%${where.slug.contains}%'`);
    }
    if (where.OR) {
      // Handle search OR condition
      const searchTerms = where.OR.map((condition: any) => {
        const terms = [];
        if (condition.name?.contains) {
          terms.push(`l.name ILIKE '%${condition.name.contains}%'`);
        }
        if (condition.slug?.contains) {
          terms.push(`l.slug ILIKE '%${condition.slug.contains}%'`);
        }
        if (condition.hostawayListingId?.contains) {
          terms.push(`l.hostaway_listing_id ILIKE '%${condition.hostawayListingId.contains}%'`);
        }
        return terms;
      }).flat();
      if (searchTerms.length > 0) {
        whereConditions.push(`(${searchTerms.join(' OR ')})`);
      }
    }

    const whereClause = whereConditions.length > 0 ? 
      `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get listings with average rating calculated at database level
    const listingsWithRatings = await db.$queryRaw<Array<{
      id: string;
      hostaway_listing_id: string;
      name: string;
      slug: string;
      created_at: Date;
      updated_at: Date;
      review_count: bigint;
      approved_count: bigint;
      avg_rating: number;
      last_review_date: Date | null;
    }>>`
      SELECT 
        l.id,
        l.hostaway_listing_id,
        l.name,
        l.slug,
        l.created_at,
        l.updated_at,
        COUNT(r.id)::bigint as review_count,
        COUNT(CASE WHEN r.approved = true THEN 1 END)::bigint as approved_count,
        COALESCE(AVG(r.rating), 0)::float as avg_rating,
        MAX(r.submitted_at) as last_review_date
      FROM listings l
      LEFT JOIN reviews r ON l.id = r.listing_id
      ${whereClause ? Prisma.raw(whereClause) : Prisma.empty}
      GROUP BY l.id, l.hostaway_listing_id, l.name, l.slug, l.created_at, l.updated_at
      ORDER BY avg_rating ${sortOrder === 'desc' ? Prisma.raw('DESC') : Prisma.raw('ASC')} NULLS LAST, l.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get total count with same filters
    const totalResult = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT l.id)::bigint as count
      FROM listings l
      LEFT JOIN reviews r ON l.id = r.listing_id
      ${whereClause ? Prisma.raw(whereClause) : Prisma.empty}
    `;

    const total = Number(totalResult[0]?.count || 0);

    // Transform to API format with pre-calculated stats
    const transformedListings: ListingWithStats[] = listingsWithRatings.map(listing => ({
      id: listing.id,
      hostawayListingId: listing.hostaway_listing_id,
      name: listing.name,
      slug: listing.slug,
      createdAt: listing.created_at.toISOString(),
      updatedAt: listing.updated_at.toISOString(),
      stats: includeStats ? {
        totalReviews: Number(listing.review_count),
        approvedReviews: Number(listing.approved_count),
        averageRating: listing.avg_rating || 0,
        ratingBreakdown: {}, // Would need additional query for detailed breakdown
        channelBreakdown: {}, // Would need additional query for detailed breakdown
        lastReviewDate: listing.last_review_date?.toISOString()
      } : undefined
    }));

    logger.info('Retrieved listings with rating sort successfully', {
      total,
      returned: transformedListings.length,
      sortOrder,
      includeStats
    });

    return {
      listings: transformedListings,
      total
    };

  } catch (error) {
    logger.error('Failed to get listings with rating sort', {
      error: error instanceof Error ? error.message : String(error),
      where,
      sortOrder
    });
    throw new Error(`Failed to retrieve listings with rating sort: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Transform database listing to API format
 */
async function transformListingToAPI(
  listing: ListingWithRelations,
  includeStats: boolean = false
): Promise<ListingWithStats> {
  const base: ListingWithStats = {
    id: listing.id,
    hostawayListingId: listing.hostawayListingId,
    name: listing.name,
    slug: listing.slug,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString()
  };

  if (includeStats && listing.reviews) {
    const reviews = listing.reviews;
    const approvedReviews = reviews.filter(r => r.approved);
    const totalReviews = reviews.length;
    
    // Calculate rating breakdown
    const ratingBreakdown: { [rating: string]: number } = {};
    for (let i = 1; i <= 10; i++) {
      ratingBreakdown[i.toString()] = reviews.filter(r => Math.floor(r.rating) === i).length;
    }

    // Calculate channel breakdown
    const channelBreakdown: { [channel: string]: number } = {};
    reviews.forEach(review => {
      channelBreakdown[review.channel] = (channelBreakdown[review.channel] || 0) + 1;
    });

    // Calculate average rating
    const avgRating = reviews.length > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
      : 0;

    // Find last review date
    const lastReviewDate = reviews.length > 0
      ? reviews.reduce((latest, r) => r.submittedAt > latest ? r.submittedAt : latest, new Date(0))
      : null;

    base.stats = {
      totalReviews,
      approvedReviews: approvedReviews.length,
      averageRating: avgRating,
      ratingBreakdown,
      channelBreakdown,
      lastReviewDate: lastReviewDate?.toISOString()
    };
  }

  return base;
}

/**
 * Create a new listing (for data migration or API integration)
 */
export async function createListing(
  listingData: {
    hostawayListingId: string;
    name: string;
    slug?: string;
  }
): Promise<ListingWithStats> {
  try {
    // Generate slug if not provided
    const slug = listingData.slug || 
      listingData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    // Ensure slug is unique
    let uniqueSlug = slug;
    let counter = 1;
    while (await db.listing.findUnique({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    const listing = await db.listing.create({
      data: {
        hostawayListingId: listingData.hostawayListingId,
        name: listingData.name,
        slug: uniqueSlug
      }
    });

    logger.info('Listing created successfully', {
      listingId: listing.id,
      hostawayListingId: listing.hostawayListingId,
      name: listing.name,
      slug: listing.slug
    });

    return await transformListingToAPI(listing, false);

  } catch (error) {
    logger.error('Failed to create listing', {
      error: error instanceof Error ? error.message : String(error),
      listingData
    });
    throw new Error(`Failed to create listing: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update an existing listing
 */
export async function updateListing(
  listingId: string,
  updateData: {
    name?: string;
    slug?: string;
  }
): Promise<ListingWithStats> {
  try {
    // If updating slug, ensure it's unique
    if (updateData.slug) {
      const existingWithSlug = await db.listing.findFirst({
        where: { 
          slug: updateData.slug,
          NOT: { id: listingId }
        }
      });
      
      if (existingWithSlug) {
        throw new Error('Slug already exists');
      }
    }

    const listing = await db.listing.update({
      where: { id: listingId },
      data: updateData
    });

    logger.info('Listing updated successfully', {
      listingId,
      updateData
    });

    return await transformListingToAPI(listing, false);

  } catch (error) {
    logger.error('Failed to update listing', {
      listingId,
      updateData,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error(`Failed to update listing: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

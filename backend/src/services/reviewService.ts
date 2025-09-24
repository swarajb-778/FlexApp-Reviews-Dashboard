/**
 * Review service for managing review CRUD operations
 * Handles database interactions, filtering, sorting, and approval workflow
 */

import { PrismaClient, Prisma, Review, Listing, ReviewCategory, AuditAction } from '@prisma/client';
import { db } from '../lib/database';
import { logger } from '../lib/logger';
import { invalidateListingCache, invalidateReviewListCaches, invalidateCache } from './cacheService';
import {
  DatabaseReview,
  ReviewFilterOptions,
  ReviewSortOptions,
  ReviewUpdateData,
  BulkUpdateRequest,
  BulkUpdateResult,
  ReviewStats,
  ServiceOptions,
  AuditLogEntry
} from '../types/reviews';

// Type for database review with relations
type ReviewWithRelations = Review & {
  listing?: Listing;
  reviewCategories?: ReviewCategory[];
};

/**
 * Create an audit log entry for review changes
 */
async function createAuditLog(
  reviewId: string,
  action: AuditAction,
  previousValue: any,
  newValue: any,
  options: { userId?: string; ip?: string; userAgent?: string } = {}
): Promise<void> {
  try {
    await db.reviewAuditLog.create({
      data: {
        reviewId,
        action,
        userId: options.userId || null,
        previousValue: previousValue ? JSON.parse(JSON.stringify(previousValue)) : null,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
        ipAddress: options.ip || null,
        userAgent: options.userAgent || null,
        metadata: {
          source: 'review_service',
          timestamp: new Date().toISOString()
        }
      }
    });

    logger.debug('Audit log entry created', {
      reviewId,
      action,
      userId: options.userId
    });
  } catch (error) {
    // Log the error but don't throw it - audit logging shouldn't break the main functionality
    logger.error('Failed to create audit log entry', {
      reviewId,
      action,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Get reviews with comprehensive filtering, sorting, and pagination
 */
export async function getReviews(
  filters: ReviewFilterOptions = {},
  pagination: { page: number; limit: number } = { page: 1, limit: 20 },
  sort: ReviewSortOptions = { field: 'submittedAt', order: 'desc' },
  options: ServiceOptions = {}
): Promise<{
  reviews: DatabaseReview[];
  total: number;
  stats: { approved: number; pending: number; rejected: number; averageRating: number };
}> {
  try {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    // Build where clause from filters
    const where: Prisma.ReviewWhereInput = {};

    if (filters.listingId) {
      // Find listing by hostaway listing ID (number)
      const listing = await db.listing.findFirst({
        where: { hostawayListingId: filters.listingId.toString() }
      });
      if (listing) {
        where.listingId = listing.id;
      } else {
        // Return empty result if listing not found
        return { reviews: [], total: 0, stats: { approved: 0, pending: 0, rejected: 0, averageRating: 0 } };
      }
    }

    if (filters.approved !== undefined) {
      where.approved = filters.approved;
    }

    if (filters.channel) {
      const channelMapping: Record<string, string> = {
        'airbnb': 'AIRBNB',
        'booking.com': 'BOOKING_COM', 
        'google': 'GOOGLE',
        'direct': 'DIRECT',
        'vrbo': 'VRBO',
        'other': 'OTHER'
      };
      
      const mappedChannel = channelMapping[filters.channel.toLowerCase()];
      if (mappedChannel) {
        where.channel = mappedChannel as any;
      }
    }

    if (filters.reviewType) {
      where.reviewType = filters.reviewType === 'guest_review' ? 'GUEST_REVIEW' : 'HOST_REVIEW';
    }

    if (filters.minRating !== undefined || filters.maxRating !== undefined) {
      where.rating = {};
      if (filters.minRating !== undefined) where.rating.gte = filters.minRating;
      if (filters.maxRating !== undefined) where.rating.lte = filters.maxRating;
    }

    if (filters.from || filters.to) {
      where.submittedAt = {};
      if (filters.from) where.submittedAt.gte = new Date(filters.from);
      if (filters.to) where.submittedAt.lte = new Date(filters.to);
    }

    if (filters.guestName) {
      where.guestName = {
        contains: filters.guestName,
        mode: 'insensitive'
      };
    }

    if (filters.search) {
      where.OR = [
        { guestName: { contains: filters.search, mode: 'insensitive' } },
        { publicReview: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    // Handle hasResponse filter separately with raw SQL for reliability
    let hasResponseCondition = '';
    if (filters.hasResponse !== undefined) {
      if (filters.hasResponse) {
        // Filter for reviews that have a non-empty response in rawJson
        hasResponseCondition = `AND raw_json->>'response' IS NOT NULL AND raw_json->>'response' != ''`;
      } else {
        // Filter for reviews that don't have a response or have empty response
        hasResponseCondition = `AND (raw_json IS NULL OR raw_json->>'response' IS NULL OR raw_json->>'response' = '')`;
      }
    }

    // Build order by clause
    const orderBy: Prisma.ReviewOrderByWithRelationInput = {};
    switch (sort.field) {
      case 'rating':
        orderBy.rating = sort.order;
        break;
      case 'submittedAt':
        orderBy.submittedAt = sort.order;
        break;
      case 'createdAt':
        orderBy.createdAt = sort.order;
        break;
      case 'guestName':
        orderBy.guestName = sort.order;
        break;
      case 'channel':
        orderBy.channel = sort.order;
        break;
      default:
        orderBy.submittedAt = 'desc';
    }

    // Build include clause
    const include: Prisma.ReviewInclude = {};
    if (options.includeListing) {
      include.listing = true;
    }
    if (options.includeCategories) {
      include.reviewCategories = true;
    }

    // Execute queries - use raw SQL if hasResponse filter is applied for better reliability
    let reviews, total, stats;
    
    if (filters.hasResponse !== undefined) {
      // Use raw SQL for hasResponse filtering
      const whereConditions = [];
      
      // Convert Prisma where conditions to SQL
      if (where.listingId) {
        whereConditions.push(`listing_id = '${where.listingId}'`);
      }
      if (where.approved !== undefined) {
        whereConditions.push(`approved = ${where.approved}`);
      }
      if (where.channel) {
        whereConditions.push(`channel = '${where.channel}'`);
      }
      if (where.reviewType) {
        whereConditions.push(`review_type = '${where.reviewType}'`);
      }
      if (where.rating?.gte !== undefined) {
        whereConditions.push(`rating >= ${where.rating.gte}`);
      }
      if (where.rating?.lte !== undefined) {
        whereConditions.push(`rating <= ${where.rating.lte}`);
      }
      if (where.submittedAt?.gte) {
        whereConditions.push(`submitted_at >= '${where.submittedAt.gte.toISOString()}'`);
      }
      if (where.submittedAt?.lte) {
        whereConditions.push(`submitted_at <= '${where.submittedAt.lte.toISOString()}'`);
      }
      if (where.guestName?.contains) {
        whereConditions.push(`guest_name ILIKE '%${where.guestName.contains}%'`);
      }
      if (where.OR) {
        // Handle search OR condition
        const searchTerms = where.OR.map(condition => {
          if (condition.guestName?.contains) {
            return `guest_name ILIKE '%${condition.guestName.contains}%'`;
          }
          if (condition.publicReview?.contains) {
            return `public_review ILIKE '%${condition.publicReview.contains}%'`;
          }
          return '';
        }).filter(Boolean);
        if (searchTerms.length > 0) {
          whereConditions.push(`(${searchTerms.join(' OR ')})`);
        }
      }
      
      const whereClause = whereConditions.length > 0 ? 
        `WHERE ${whereConditions.join(' AND ')} ${hasResponseCondition}` : 
        (hasResponseCondition ? `WHERE ${hasResponseCondition.substring(4)}` : ''); // Remove 'AND ' prefix
      
      const orderByClause = `ORDER BY ${sort.field === 'submittedAt' ? 'submitted_at' : 
        sort.field === 'createdAt' ? 'created_at' : 
        sort.field === 'guestName' ? 'guest_name' : 
        sort.field} ${sort.order}`;
      
      // Execute raw SQL queries
      [reviews, total] = await Promise.all([
        db.$queryRaw`
          SELECT r.*, l.name as listing_name, l.slug as listing_slug, l.hostaway_listing_id
          FROM reviews r
          LEFT JOIN listings l ON r.listing_id = l.id
          ${Prisma.raw(whereClause)}
          ${Prisma.raw(orderByClause)}
          LIMIT ${limit} OFFSET ${offset}
        `,
        db.$queryRaw`
          SELECT COUNT(*)::int as count
          FROM reviews r
          ${Prisma.raw(whereClause)}
        `
      ]);
      
      // Convert raw results to expected format
      reviews = (reviews as any[]).map(row => ({
        id: row.id,
        hostawayReviewId: row.hostaway_review_id,
        listingId: row.listing_id,
        reviewType: row.review_type,
        channel: row.channel,
        rating: row.rating,
        publicReview: row.public_review,
        guestName: row.guest_name,
        submittedAt: row.submitted_at,
        approved: row.approved,
        rawJson: row.raw_json,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        listing: options.includeListing && row.listing_name ? {
          id: row.listing_id,
          name: row.listing_name,
          slug: row.listing_slug,
          hostawayListingId: row.hostaway_listing_id
        } : undefined
      }));
      
      total = (total as any[])[0]?.count || 0;
      
      // Get stats with same filter
      stats = await db.$queryRaw`
        SELECT approved, COUNT(*)::int as count, AVG(rating)::float as avg_rating
        FROM reviews r
        ${Prisma.raw(whereClause)}
        GROUP BY approved
      `;
      
      stats = (stats as any[]).map(s => ({
        approved: s.approved,
        _count: { approved: s.count },
        _avg: { rating: s.avg_rating }
      }));
    } else {
      // Use regular Prisma queries when no hasResponse filter
      [reviews, total, stats] = await Promise.all([
        db.review.findMany({
          where,
          include,
          orderBy,
          skip: offset,
          take: limit
        }),
        db.review.count({ where }),
        // Optimize stats calculation with a single aggregate query
        db.review.groupBy({
          by: ['approved'],
          where,
          _count: {
            approved: true
          },
          _avg: {
            rating: true
          }
        })
      ]);
    }

    // Process aggregated stats to get individual counts
    const approvedCount = stats.find(s => s.approved === true)?._count.approved || 0;
    const pendingCount = stats.find(s => s.approved === false)?._count.approved || 0;
    
    // Get average rating with a direct aggregate query for simplicity and accuracy
    let averageRating = 0;
    if (filters.hasResponse !== undefined) {
      // For raw SQL path, calculate average from the stats we already have
      averageRating = stats.length > 0 && stats[0]._avg?.rating ? stats[0]._avg.rating : 0;
    } else {
      // For Prisma path, use a separate aggregate query for accuracy
      const ratingAggregate = await db.review.aggregate({
        where,
        _avg: {
          rating: true
        }
      });
      averageRating = ratingAggregate._avg.rating || 0;
    }

    // Transform to API format
    const transformedReviews: DatabaseReview[] = reviews.map(transformReviewToAPI);

    logger.info('Retrieved reviews successfully', {
      total,
      returned: reviews.length,
      filters,
      sort
    });

    return {
      reviews: transformedReviews,
      total,
      stats: {
        approved: approvedCount,
        pending: pendingCount,
        rejected: 0, // Not implemented in current schema
        averageRating: averageRating
      }
    };

  } catch (error) {
    logger.error('Failed to get reviews', {
      error: error instanceof Error ? error.message : String(error),
      filters,
      pagination,
      sort
    });
    throw new Error(`Failed to retrieve reviews: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a single review by ID
 */
export async function getReviewById(
  reviewId: string,
  options: ServiceOptions = {}
): Promise<DatabaseReview | null> {
  try {
    const include: Prisma.ReviewInclude = {};
    if (options.includeListing) {
      include.listing = true;
    }
    if (options.includeCategories) {
      include.reviewCategories = true;
    }

    const review = await db.review.findUnique({
      where: { id: reviewId },
      include
    });

    if (!review) {
      return null;
    }

    return transformReviewToAPI(review);

  } catch (error) {
    logger.error('Failed to get review by ID', {
      reviewId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error(`Failed to retrieve review: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update a review
 */
export async function updateReview(
  reviewId: string,
  updateData: ReviewUpdateData,
  options: { userId?: string; ip?: string; userAgent?: string } = {}
): Promise<DatabaseReview> {
  try {
    // First get the existing review for audit trail
    const existingReview = await db.review.findUnique({
      where: { id: reviewId },
      include: { listing: true }
    });

    if (!existingReview) {
      throw new Error('Review not found');
    }

    // Build explicit data object and handle response field mapping
    const data: any = {};
    
    // Handle standard fields
    if (updateData.approved !== undefined) {
      data.approved = updateData.approved;
    }
    if (updateData.publicReview !== undefined) {
      data.publicReview = updateData.publicReview;
    }
    
    // Handle response field mapping to rawJson
    if (updateData.response !== undefined) {
      const existingRawJson = existingReview.rawJson as any || {};
      data.rawJson = {
        ...existingRawJson,
        response: updateData.response,
        responseDate: new Date().toISOString()
      };
    }

    // Update the review
    const updatedReview = await db.review.update({
      where: { id: reviewId },
      data,
      include: {
        listing: true,
        reviewCategories: true
      }
    });

    // Create audit log entry
    await createAuditLog(
      reviewId,
      'UPDATED',
      {
        approved: existingReview.approved,
        rawJson: existingReview.rawJson,
        publicReview: existingReview.publicReview
      },
      {
        approved: updatedReview.approved,
        rawJson: updatedReview.rawJson,
        publicReview: updatedReview.publicReview,
        response: updateData.response || null
      },
      options
    );

    // Invalidate caches
    const cacheInvalidationPromises = [];
    
    // Invalidate listing-specific cache
    if (existingReview.listing) {
      cacheInvalidationPromises.push(
        invalidateListingCache(parseInt(existingReview.listing.hostawayListingId))
      );
    }
    
    // Invalidate review list caches
    cacheInvalidationPromises.push(invalidateReviewListCaches());
    
    // Execute cache invalidations in parallel
    await Promise.all(cacheInvalidationPromises);

    // Log the update
    logger.info('Review updated successfully', {
      reviewId,
      updateData,
      userId: options.userId,
      listingId: existingReview.listingId
    });

    return transformReviewToAPI(updatedReview);

  } catch (error) {
    logger.error('Failed to update review', {
      reviewId,
      updateData,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error(`Failed to update review: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Approve or unapprove a review with idempotency under concurrency
 */
export async function approveReview(
  reviewId: string,
  approved: boolean,
  response?: string,
  options: { userId?: string; ip?: string; userAgent?: string } = {}
): Promise<DatabaseReview> {
  return await db.$transaction(async (tx) => {
    try {
      // Get existing review for audit and cache invalidation
      const existingReview = await tx.review.findUnique({
        where: { id: reviewId },
        include: { listing: true }
      });

      if (!existingReview) {
        throw new Error('Review not found');
      }

      // Prepare update data with response if provided
      const updateData: any = { approved };
      let newRawJson = existingReview.rawJson;
      
      if (response !== undefined) {
        // Store response in rawJson for now since there's no dedicated response field
        const existingRawJson = existingReview.rawJson as any || {};
        newRawJson = {
          ...existingRawJson,
          response,
          responseDate: new Date().toISOString()
        };
        updateData.rawJson = newRawJson;
      }

      // Perform conditional update - only update if the approval status is different
      const { count } = await tx.review.updateMany({
        where: { 
          id: reviewId, 
          approved: { not: approved } 
        },
        data: updateData
      });

      // If no rows were updated, the review is already in the requested state
      if (count !== 1) {
        const action = approved ? 'approved' : 'unapproved';
        throw new Error(`Already in requested state: Review is already ${action}`);
      }

      // Get the updated review with all relations
      const updatedReview = await tx.review.findUnique({
        where: { id: reviewId },
        include: {
          listing: true,
          reviewCategories: true
        }
      });

      if (!updatedReview) {
        throw new Error('Failed to retrieve updated review');
      }

      // Create audit log entry only when the update actually happened
      const auditAction = approved ? 'APPROVED' : 'UNAPPROVED';
      await createAuditLog(
        reviewId,
        auditAction,
        {
          approved: existingReview.approved,
          rawJson: existingReview.rawJson
        },
        {
          approved: updatedReview.approved,
          rawJson: updatedReview.rawJson,
          response: response || null
        },
        options
      );

      // Note: Cache invalidation will happen after transaction commits
      // Store cache invalidation data for later
      const cacheInvalidationData = {
        listingId: existingReview.listing ? parseInt(existingReview.listing.hostawayListingId) : null,
        reviewId
      };

      // Log the approval action
      logger.info('Review approval status updated', {
        reviewId,
        approved,
        previousApproval: existingReview.approved,
        hasResponse: !!response,
        userId: options.userId,
        listingId: existingReview.listingId,
        transactionMode: 'conditional_update'
      });

      // Store cache data for post-transaction invalidation
      (updatedReview as any)._cacheInvalidationData = cacheInvalidationData;
      
      return updatedReview;

    } catch (error) {
      logger.error('Failed to approve/unapprove review in transaction', {
        reviewId,
        approved,
        error: error instanceof Error ? error.message : String(error)
      });
      // Re-throw the error to rollback the transaction
      throw error;
    }
  }).then(async (updatedReview) => {
    // Perform cache invalidation after successful transaction commit
    try {
      const cacheData = (updatedReview as any)._cacheInvalidationData;
      const cacheInvalidationPromises = [];
      
      // Invalidate listing-specific cache
      if (cacheData.listingId) {
        cacheInvalidationPromises.push(
          invalidateListingCache(cacheData.listingId)
        );
      }
      
      // Invalidate review list caches
      cacheInvalidationPromises.push(invalidateReviewListCaches());
      
      // Execute cache invalidations in parallel
      await Promise.all(cacheInvalidationPromises);

      // Clean up the cache data
      delete (updatedReview as any)._cacheInvalidationData;

    } catch (cacheError) {
      // Log cache invalidation errors but don't fail the operation
      logger.error('Cache invalidation failed after review approval', {
        reviewId,
        error: cacheError instanceof Error ? cacheError.message : String(cacheError)
      });
    }

    return transformReviewToAPI(updatedReview);
  }).catch((error) => {
    logger.error('Failed to approve/unapprove review', {
      reviewId,
      approved,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error(`Failed to update review approval: ${error instanceof Error ? error.message : 'Unknown error'}`);
  });
}

/**
 * Bulk update multiple reviews
 */
export async function bulkUpdateReviews(
  request: BulkUpdateRequest,
  options: { userId?: string; ip?: string; userAgent?: string } = {}
): Promise<BulkUpdateResult> {
  const results: BulkUpdateResult = {
    success: true,
    updated: 0,
    failed: 0,
    errors: []
  };

  try {
    // Process reviews in batches to avoid overwhelming the database
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < request.reviewIds.length; i += batchSize) {
      const batch = request.reviewIds.slice(i, i + batchSize);
      batches.push(batch);
    }

    for (const batch of batches) {
      const promises = batch.map(async (reviewId) => {
        try {
          await approveReview(reviewId, request.approved, request.response, options);
          return { reviewId, success: true };
        } catch (error) {
          return {
            reviewId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      const batchResults = await Promise.allSettled(promises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            results.updated++;
          } else {
            results.failed++;
            results.errors?.push({
              reviewId: result.value.reviewId,
              error: result.value.error || 'Unknown error'
            });
          }
        } else {
          results.failed++;
          results.errors?.push({
            reviewId: 'unknown',
            error: result.reason
          });
        }
      }
    }

    results.success = results.failed === 0;

    logger.info('Bulk update completed', {
      requested: request.reviewIds.length,
      updated: results.updated,
      failed: results.failed,
      userId: options.userId
    });

    return results;

  } catch (error) {
    logger.error('Bulk update failed', {
      error: error instanceof Error ? error.message : String(error),
      requestedCount: request.reviewIds.length
    });
    
    return {
      success: false,
      updated: results.updated,
      failed: request.reviewIds.length - results.updated,
      errors: [{
        reviewId: 'all',
        error: error instanceof Error ? error.message : 'Unknown error'
      }]
    };
  }
}

/**
 * Get review statistics
 */
export async function getReviewStats(
  filters: ReviewFilterOptions = {}
): Promise<ReviewStats> {
  try {
    // Build where clause from filters
    const where: Prisma.ReviewWhereInput = {};
    
    if (filters.listingId) {
      const listing = await db.listing.findFirst({
        where: { hostawayListingId: filters.listingId.toString() }
      });
      if (listing) {
        where.listingId = listing.id;
      }
    }

    if (filters.from || filters.to) {
      where.submittedAt = {};
      if (filters.from) where.submittedAt.gte = new Date(filters.from);
      if (filters.to) where.submittedAt.lte = new Date(filters.to);
    }

    // Execute all stats queries in parallel
    const [
      totalReviews,
      approvedReviews,
      pendingReviews,
      avgRating,
      ratingDistribution,
      channelDistribution
    ] = await Promise.all([
      db.review.count({ where }),
      db.review.count({ where: { ...where, approved: true } }),
      db.review.count({ where: { ...where, approved: false } }),
      db.review.aggregate({ where, _avg: { rating: true } }),
      db.review.groupBy({
        by: ['rating'],
        where,
        _count: { rating: true },
        orderBy: { rating: 'asc' }
      }),
      db.review.groupBy({
        by: ['channel'],
        where,
        _count: { channel: true },
        orderBy: { channel: 'asc' }
      })
    ]);

    // Monthly trends for the last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyTrends = await db.$queryRaw<Array<{
      month: string;
      count: bigint;
      avg_rating: number;
    }>>`
      SELECT 
        TO_CHAR(submitted_at, 'YYYY-MM') as month,
        COUNT(*)::bigint as count,
        AVG(rating)::float as avg_rating
      FROM reviews 
      WHERE submitted_at >= ${twelveMonthsAgo}
        ${filters.listingId ? Prisma.sql`AND listing_id = (SELECT id FROM listings WHERE hostaway_listing_id = ${filters.listingId.toString()})` : Prisma.empty}
      GROUP BY TO_CHAR(submitted_at, 'YYYY-MM')
      ORDER BY month DESC
      LIMIT 12
    `;

    return {
      totalReviews,
      approvedReviews,
      pendingReviews,
      rejectedReviews: 0, // Not implemented in current schema
      averageRating: avgRating._avg.rating || 0,
      ratingDistribution: Object.fromEntries(
        ratingDistribution.map(item => [item.rating.toString(), item._count.rating])
      ),
      channelDistribution: Object.fromEntries(
        channelDistribution.map(item => [item.channel, item._count.channel])
      ),
      monthlyTrends: monthlyTrends.map(trend => ({
        month: trend.month,
        count: Number(trend.count),
        averageRating: trend.avg_rating || 0
      }))
    };

  } catch (error) {
    logger.error('Failed to get review statistics', {
      error: error instanceof Error ? error.message : String(error),
      filters
    });
    throw new Error(`Failed to retrieve review statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Transform database review to API format
 */
function transformReviewToAPI(review: ReviewWithRelations): DatabaseReview {
  return {
    id: review.id,
    hostawayReviewId: review.hostawayReviewId,
    listingId: review.listingId,
    reviewType: review.reviewType,
    channel: review.channel,
    rating: review.rating,
    publicReview: review.publicReview,
    guestName: review.guestName,
    submittedAt: review.submittedAt,
    approved: review.approved,
    rawJson: review.rawJson,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    listing: review.listing ? {
      id: review.listing.id,
      name: review.listing.name,
      slug: review.listing.slug,
      hostawayListingId: review.listing.hostawayListingId
    } : undefined,
    reviewCategories: review.reviewCategories?.map(cat => ({
      id: cat.id,
      category: cat.category,
      rating: cat.rating
    }))
  };
}

/**
 * Get approval history for a specific review
 */
export async function getReviewApprovalHistory(
  reviewId: string
): Promise<AuditLogEntry[]> {
  try {
    const auditLogs = await db.reviewAuditLog.findMany({
      where: { reviewId },
      orderBy: { timestamp: 'desc' }
    });

    return auditLogs.map(log => ({
      id: log.id,
      reviewId: log.reviewId,
      action: log.action as 'APPROVED' | 'UNAPPROVED' | 'UPDATED' | 'CREATED',
      previousValue: log.previousValue,
      newValue: log.newValue,
      userId: log.userId || undefined,
      timestamp: log.timestamp.toISOString(),
      metadata: {
        ip: log.ipAddress || undefined,
        userAgent: log.userAgent || undefined,
        source: 'review_service'
      }
    }));

  } catch (error) {
    logger.error('Failed to get review approval history', {
      reviewId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error(`Failed to retrieve approval history: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Clean up old audit logs (for maintenance)
 */
export async function cleanupOldAuditLogs(daysToKeep: number = 90): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const deletedCount = await db.reviewAuditLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate
        }
      }
    });

    logger.info('Audit log cleanup completed', { daysToKeep, cutoffDate, deletedCount: deletedCount.count });
    return deletedCount.count;

  } catch (error) {
    logger.error('Failed to cleanup audit logs', {
      error: error instanceof Error ? error.message : String(error),
      daysToKeep
    });
    throw new Error(`Failed to cleanup audit logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


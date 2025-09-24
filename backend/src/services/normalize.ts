/**
 * Core normalization service for converting raw Hostaway review data
 * into consistent JSON format required by the frontend.
 * 
 * Handles diverse review formats with comprehensive date/rating/category processing,
 * edge cases, and preserves raw data for audit purposes.
 */

import { logger } from '../lib/logger';
import { DateTime } from 'luxon';
import {
  HostawayReviewRaw,
  HostawayReviewCategory,
  NormalizedReview,
  NormalizedReviewCategory,
  ReviewChannel,
  ReviewType,
  NormalizationResult,
  NormalizationOptions
} from '../types/reviews';

/**
 * Normalizes an array of raw Hostaway reviews into the standard format
 */
export async function normalizeReviews(
  rawReviews: HostawayReviewRaw[],
  options: NormalizationOptions = {}
): Promise<NormalizationResult> {
  const startTime = Date.now();
  const normalizedReviews: NormalizedReview[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let processedCount = 0;
  let skippedCount = 0;

  logger.info(`Starting normalization of ${rawReviews.length} reviews`);

  for (const rawReview of rawReviews) {
    try {
      const normalized = await normalizeReview(rawReview, options);
      if (normalized) {
        normalizedReviews.push(normalized);
        processedCount++;
      } else {
        skippedCount++;
        warnings.push(`Skipped review ${rawReview.id}: failed validation`);
      }
    } catch (error) {
      const errorMsg = `Failed to normalize review ${rawReview.id}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      skippedCount++;

      if (options.strict) {
        logger.error('Strict mode: stopping normalization due to error', { error: errorMsg });
        break;
      }

      logger.warn('Non-strict mode: continuing after normalization error', { error: errorMsg });
    }
  }

  const processingTime = Date.now() - startTime;
  
  logger.info('Review normalization completed', {
    processed: processedCount,
    skipped: skippedCount,
    errors: errors.length,
    warnings: warnings.length,
    processingTimeMs: processingTime
  });

  return {
    success: errors.length === 0 || !options.strict,
    data: normalizedReviews,
    errors,
    warnings,
    processedCount,
    skippedCount
  };
}

/**
 * Normalizes a single raw Hostaway review
 */
export async function normalizeReview(
  rawReview: HostawayReviewRaw,
  options: NormalizationOptions = {}
): Promise<NormalizedReview | null> {
  try {
    // Validate required fields
    if (!rawReview.id || !rawReview.listingId) {
      throw new Error('Missing required fields: id or listingId');
    }

    // Normalize dates to ISO 8601 UTC format
    const createdAt = normalizeDateToISO(rawReview.createdAt, options.timezone);
    const updatedAt = normalizeDateToISO(rawReview.updatedAt, options.timezone);
    const checkInDate = rawReview.checkInDate ? normalizeDateToISO(rawReview.checkInDate, options.timezone) : undefined;
    const checkOutDate = rawReview.checkOutDate ? normalizeDateToISO(rawReview.checkOutDate, options.timezone) : undefined;
    const responseDate = rawReview.responseDate ? normalizeDateToISO(rawReview.responseDate, options.timezone) : undefined;

    // Calculate rating from direct value or category average
    const rating = calculateRating(rawReview, options.defaultRating);
    if (rating === null) {
      throw new Error('Unable to determine rating from direct value or categories');
    }

    // Flatten review categories to categories map
    const categories = flattenReviewCategories(rawReview.reviewCategories || []);

    // Map review type to controlled enum
    const reviewType = mapReviewType(rawReview.reviewType);
    const channel = mapReviewChannel(rawReview.channel);

    // Create normalized review object
    const normalizedReview: NormalizedReview = {
      id: rawReview.id,
      listingId: rawReview.listingId,
      guestName: sanitizeGuestName(rawReview.guestName || 'Anonymous Guest'),
      comment: sanitizeComment(rawReview.comment),
      rating,
      categories,
      createdAt,
      updatedAt,
      checkInDate,
      checkOutDate,
      reviewType,
      channel,
      approved: rawReview.approved,
      response: rawReview.response ? sanitizeComment(rawReview.response) : undefined,
      responseDate,
      guestId: rawReview.guestId,
      reservationId: rawReview.reservationId,
      language: rawReview.language?.toLowerCase().substring(0, 2), // Normalize to 2-letter ISO code
      source: rawReview.source,
      rawJson: rawReview // Preserve raw JSON for audit
    };

    return normalizedReview;
  } catch (error) {
    logger.error('Failed to normalize individual review', {
      reviewId: rawReview.id,
      error: error instanceof Error ? error.message : String(error)
    });

    if (options.includeInvalid) {
      // Return partial normalization with available data
      return createPartialNormalizedReview(rawReview, options);
    }

    return null;
  }
}

/**
 * Normalizes various date formats to ISO 8601 UTC with proper timezone handling
 */
function normalizeDateToISO(dateString: string, timezone?: string): string {
  try {
    let dateTime: DateTime;

    // Try to parse with luxon first, with timezone if provided
    if (timezone && timezone !== 'UTC') {
      dateTime = DateTime.fromISO(dateString, { zone: timezone });
      
      // If ISO parsing fails, try other formats
      if (!dateTime.isValid) {
        dateTime = DateTime.fromSQL(dateString, { zone: timezone });
      }
      
      if (!dateTime.isValid) {
        dateTime = DateTime.fromFormat(dateString, 'yyyy-MM-dd HH:mm:ss', { zone: timezone });
      }
      
      if (!dateTime.isValid) {
        // Fall back to JavaScript Date parsing and assume provided timezone
        const jsDate = new Date(dateString);
        if (isNaN(jsDate.getTime())) {
          throw new Error(`Invalid date format: ${dateString}`);
        }
        dateTime = DateTime.fromJSDate(jsDate, { zone: timezone });
      }
      
      // Convert to UTC
      dateTime = dateTime.toUTC();
      
      logger.debug('Date parsed with timezone conversion', { 
        originalDate: dateString, 
        timezone, 
        utcDate: dateTime.toISO() 
      });
    } else {
      // No timezone specified or UTC, parse as UTC
      dateTime = DateTime.fromISO(dateString, { zone: 'utc' });
      
      // If ISO parsing fails, try other formats
      if (!dateTime.isValid) {
        dateTime = DateTime.fromSQL(dateString, { zone: 'utc' });
      }
      
      if (!dateTime.isValid) {
        dateTime = DateTime.fromFormat(dateString, 'yyyy-MM-dd HH:mm:ss', { zone: 'utc' });
      }
      
      if (!dateTime.isValid) {
        // Fall back to JavaScript Date parsing
        const jsDate = new Date(dateString);
        if (isNaN(jsDate.getTime())) {
          throw new Error(`Invalid date format: ${dateString}`);
        }
        dateTime = DateTime.fromJSDate(jsDate, { zone: 'utc' });
      }
    }

    if (!dateTime.isValid) {
      throw new Error(`Unable to parse date with any format: ${dateString}`);
    }

    return dateTime.toISO()!;
  } catch (error) {
    logger.error('Date normalization failed', { dateString, timezone, error });
    throw new Error(`Failed to normalize date: ${dateString}`);
  }
}

/**
 * Calculates rating from direct value or category average
 */
function calculateRating(
  rawReview: HostawayReviewRaw,
  defaultRating?: number
): number | null {
  // Use direct rating if available
  if (rawReview.rating !== undefined && rawReview.rating !== null) {
    return Math.round(rawReview.rating * 10) / 10; // Round to 1 decimal place
  }

  // Calculate from category ratings if available
  if (rawReview.reviewCategories && rawReview.reviewCategories.length > 0) {
    const validCategories = rawReview.reviewCategories.filter(
      cat => cat.rating !== undefined && cat.rating !== null && !isNaN(cat.rating)
    );

    if (validCategories.length > 0) {
      const sum = validCategories.reduce((total, cat) => {
        // Normalize to 0-10 scale if max_rating is different
        const normalizedRating = cat.max_rating !== 10 
          ? (cat.rating / cat.max_rating) * 10 
          : cat.rating;
        return total + normalizedRating;
      }, 0);

      const average = sum / validCategories.length;
      return Math.round(average * 10) / 10; // Round to 1 decimal place
    }
  }

  // Use default rating if provided
  if (defaultRating !== undefined) {
    logger.warn('Using default rating', { reviewId: rawReview.id, defaultRating });
    return defaultRating;
  }

  // No rating available
  return null;
}

/**
 * Flattens review categories array to a key-value map
 */
function flattenReviewCategories(
  categories: HostawayReviewCategory[]
): NormalizedReviewCategory {
  const flattened: NormalizedReviewCategory = {};

  for (const category of categories) {
    if (category.name && category.rating !== undefined) {
      // Normalize category name to a consistent format
      const normalizedName = category.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

      // Normalize rating to 0-10 scale if max_rating is different
      const normalizedRating = category.max_rating !== 10 
        ? Math.round((category.rating / category.max_rating) * 100) / 10
        : Math.round(category.rating * 10) / 10;

      flattened[normalizedName] = normalizedRating;
    }
  }

  return flattened;
}

/**
 * Maps raw review type to controlled enum
 */
function mapReviewType(rawType: string): ReviewType {
  const normalizedType = rawType.toLowerCase().replace(/[^a-z]/g, '_');

  switch (normalizedType) {
    case 'guest_review':
    case 'guest':
      return 'guest_review';
    case 'host_review':
    case 'host':
      return 'host_review';
    case 'auto_review':
    case 'automatic':
    case 'auto':
      return 'auto_review';
    case 'system_review':
    case 'system':
      return 'system_review';
    default:
      logger.warn('Unknown review type, defaulting to guest_review', { rawType });
      return 'guest_review';
  }
}

/**
 * Maps raw channel to controlled enum
 */
function mapReviewChannel(rawChannel: string): ReviewChannel {
  const normalizedChannel = rawChannel.toLowerCase().replace(/[^a-z.]/g, '');

  switch (normalizedChannel) {
    case 'bookingcom':
    case 'booking.com':
    case 'booking':
      return 'booking.com';
    case 'airbnb':
      return 'airbnb';
    case 'google':
    case 'googlemaps':
    case 'googlereviews':
      return 'google';
    case 'direct':
    case 'directbooking':
      return 'direct';
    default:
      logger.warn('Unknown channel, defaulting to other', { rawChannel });
      return 'other';
  }
}

/**
 * Sanitizes guest name for security and consistency
 */
function sanitizeGuestName(name: string): string {
  if (!name || typeof name !== 'string') {
    return 'Anonymous Guest';
  }

  // Remove potentially harmful content and normalize
  return name
    .trim()
    .substring(0, 255) // Limit length
    .replace(/[<>\"'&]/g, '') // Remove potentially harmful characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    || 'Anonymous Guest';
}

/**
 * Sanitizes comment text for security and consistency
 */
function sanitizeComment(comment: string): string {
  if (!comment || typeof comment !== 'string') {
    return '';
  }

  // Remove potentially harmful content, preserve basic formatting
  return comment
    .trim()
    .substring(0, 5000) // Limit length
    .replace(/[<>\"'&]/g, '') // Remove potentially harmful characters
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive line breaks
    || '';
}

/**
 * Creates a partial normalized review when includeInvalid is true
 */
function createPartialNormalizedReview(
  rawReview: HostawayReviewRaw,
  options: NormalizationOptions
): NormalizedReview | null {
  try {
    // Create minimal valid review with defaults
    return {
      id: rawReview.id || 0,
      listingId: rawReview.listingId || 0,
      guestName: sanitizeGuestName(rawReview.guestName || 'Anonymous Guest'),
      comment: sanitizeComment(rawReview.comment || ''),
      rating: options.defaultRating || 5.0,
      categories: {},
      createdAt: rawReview.createdAt ? normalizeDateToISO(rawReview.createdAt) : new Date().toISOString(),
      updatedAt: rawReview.updatedAt ? normalizeDateToISO(rawReview.updatedAt) : new Date().toISOString(),
      reviewType: 'guest_review',
      channel: 'other',
      approved: false,
      rawJson: rawReview
    };
  } catch (error) {
    logger.error('Failed to create partial normalized review', { rawReview, error });
    return null;
  }
}

/**
 * Validates normalized review data
 */
export function validateNormalizedReview(review: NormalizedReview): boolean {
  try {
    // Check required fields
    if (!review.id || !review.listingId || !review.guestName) {
      return false;
    }

    // Check rating is valid
    if (review.rating < 0 || review.rating > 10) {
      return false;
    }

    // Check dates are valid ISO strings
    if (!review.createdAt || isNaN(Date.parse(review.createdAt))) {
      return false;
    }

    if (!review.updatedAt || isNaN(Date.parse(review.updatedAt))) {
      return false;
    }

    // Check optional dates if present
    if (review.checkInDate && isNaN(Date.parse(review.checkInDate))) {
      return false;
    }

    if (review.checkOutDate && isNaN(Date.parse(review.checkOutDate))) {
      return false;
    }

    if (review.responseDate && isNaN(Date.parse(review.responseDate))) {
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Review validation failed', { reviewId: review?.id, error });
    return false;
  }
}

/**
 * Filters normalized reviews based on criteria
 */
export function filterNormalizedReviews(
  reviews: NormalizedReview[],
  filters: {
    listingId?: number;
    from?: string;
    to?: string;
    channel?: ReviewChannel;
    approved?: boolean;
    reviewType?: ReviewType;
    minRating?: number;
    maxRating?: number;
    hasResponse?: boolean;
  }
): NormalizedReview[] {
  return reviews.filter(review => {
    // Filter by listing ID
    if (filters.listingId !== undefined && review.listingId !== filters.listingId) {
      return false;
    }

    // Filter by date range
    if (filters.from && new Date(review.createdAt) < new Date(filters.from)) {
      return false;
    }

    if (filters.to && new Date(review.createdAt) > new Date(filters.to)) {
      return false;
    }

    // Filter by channel
    if (filters.channel && review.channel !== filters.channel) {
      return false;
    }

    // Filter by approval status
    if (filters.approved !== undefined && review.approved !== filters.approved) {
      return false;
    }

    // Filter by review type
    if (filters.reviewType && review.reviewType !== filters.reviewType) {
      return false;
    }

    // Filter by rating range
    if (filters.minRating !== undefined && review.rating < filters.minRating) {
      return false;
    }

    if (filters.maxRating !== undefined && review.rating > filters.maxRating) {
      return false;
    }

    // Filter by response presence
    if (filters.hasResponse !== undefined) {
      const hasResponse = !!(review.response && review.response.length > 0);
      if (hasResponse !== filters.hasResponse) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sorts normalized reviews by various criteria
 */
export function sortNormalizedReviews(
  reviews: NormalizedReview[],
  sortBy: 'createdAt' | 'updatedAt' | 'rating' | 'guestName' = 'createdAt',
  order: 'asc' | 'desc' = 'desc'
): NormalizedReview[] {
  return [...reviews].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    switch (sortBy) {
      case 'createdAt':
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
      case 'updatedAt':
        aValue = new Date(a.updatedAt).getTime();
        bValue = new Date(b.updatedAt).getTime();
        break;
      case 'rating':
        aValue = a.rating;
        bValue = b.rating;
        break;
      case 'guestName':
        aValue = a.guestName.toLowerCase();
        bValue = b.guestName.toLowerCase();
        break;
      default:
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
    }

    if (aValue < bValue) {
      return order === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return order === 'asc' ? 1 : -1;
    }
    return 0;
  });
}

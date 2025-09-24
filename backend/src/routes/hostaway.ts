/**
 * Hostaway API routes for the reviews endpoint
 * Implements the mandatory GET /api/reviews/hostaway endpoint with
 * caching, normalization, filtering, pagination, and error handling
 */

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { validateQueryParams } from '../validation/reviewSchemas';
import {
  normalizeReviews,
  filterNormalizedReviews,
  sortNormalizedReviews
} from '../services/normalize';
import {
  fetchHostawayReviews,
  fetchReviewsWithSource,
  getHostawayApiMetrics,
  hostawayHealthCheck
} from '../services/hostawayClient';
import {
  generateCacheKey,
  getCachedReviewsResponse,
  cacheReviewsResponse,
  shouldRefreshCache,
  getCacheMetrics,
  invalidateListingCache,
  invalidateCache,
  getCacheConfiguration
} from '../services/cacheService';
import {
  ReviewsQueryParams,
  ReviewsApiResponse,
  ErrorResponse,
  NormalizedReview
} from '../types/reviews';

const router = Router();

/**
 * GET /api/reviews/hostaway
 * Main endpoint for fetching normalized reviews from Hostaway API
 * Supports caching, filtering, pagination, and fallback to mock data
 */
router.get('/', async (req: Request, res: Response) => {
  const requestStart = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  logger.info('Hostaway reviews request started', {
    requestId,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  try {
    // Validate query parameters
    const queryValidation = validateQueryParams(req.query);
    if (!queryValidation.success) {
      logger.warn('Invalid query parameters', {
        requestId,
        query: req.query,
        errors: queryValidation.error.issues
      });

      return res.status(400).json({
        status: 'error',
        message: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        details: queryValidation.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          value: issue.received
        }))
      } as ErrorResponse);
    }

    const queryParams = queryValidation.data as ReviewsQueryParams;

    // Generate cache key based on query parameters
    const cacheKey = generateCacheKey('hostaway', queryParams);
    
    logger.debug('Generated cache key', { requestId, cacheKey });

    // Check cache first
    let cachedResponse = await getCachedReviewsResponse(cacheKey);
    
    const needsRefresh = cachedResponse ? await shouldRefreshCache(cacheKey) : true;
    if (cachedResponse && !needsRefresh) {
      logger.info('Serving cached response', {
        requestId,
        cacheKey,
        reviewCount: cachedResponse.response.data.reviews.length
      });

      const responseTime = Date.now() - requestStart;
      cachedResponse.response.data.meta.processedAt = new Date().toISOString();
      
      res.set('X-Request-ID', requestId);
      res.set('X-Response-Time', `${responseTime}ms`);
      res.set('X-Cache-Status', 'HIT');
      res.set('X-Source', cachedResponse.response.data.meta.source);
      
      // Check if simple format is requested for cached responses too
      const useSimpleFormat = req.query.format === 'simple';
      if (useSimpleFormat) {
        return res.json({
          status: 'ok',
          data: cachedResponse.response.data.reviews
        });
      }
      
      return res.json(cachedResponse.response);
    }

    // Cache miss or needs refresh - fetch fresh data
    logger.debug('Cache miss or refresh needed, fetching from source', {
      requestId,
      cacheKey,
      cached: !!cachedResponse,
      needsRefresh
    });

    // Fetch reviews with proper source tracking and fallback handling
    const { response: hostawayResponse, source } = await fetchReviewsWithSource(queryParams);
    let rawReviews = hostawayResponse.result;
    
    logger.info('Successfully fetched reviews', {
      requestId,
      source,
      count: hostawayResponse.count,
      total: hostawayResponse.total
    });

    // Normalize the raw reviews
    logger.debug('Starting review normalization', {
      requestId,
      rawReviewCount: rawReviews.length
    });

    const normalizationResult = await normalizeReviews(rawReviews, {
      strict: false,
      includeInvalid: false,
      defaultRating: 5.0
    });

    if (!normalizationResult.success && normalizationResult.errors.length > 0) {
      logger.error('Review normalization failed', {
        requestId,
        errors: normalizationResult.errors,
        warnings: normalizationResult.warnings
      });

      return res.status(500).json({
        status: 'error',
        message: 'Failed to normalize review data',
        code: 'NORMALIZATION_ERROR',
        details: normalizationResult.errors
      } as ErrorResponse);
    }

    let normalizedReviews = normalizationResult.data || [];

    // Apply additional filters if needed (normalization may not cover all filters)
    normalizedReviews = filterNormalizedReviews(normalizedReviews, {
      listingId: queryParams.listingId,
      from: queryParams.from,
      to: queryParams.to,
      channel: queryParams.channel,
      approved: queryParams.approved,
      reviewType: queryParams.reviewType,
      minRating: queryParams.minRating,
      maxRating: queryParams.maxRating,
      hasResponse: queryParams.hasResponse
    });

    // Sort reviews
    const sortedReviews = sortNormalizedReviews(normalizedReviews, 'createdAt', 'desc');

    // Apply pagination
    const page = queryParams.page || 1;
    const limit = Math.min(queryParams.limit || 20, 100);
    const offset = (page - 1) * limit;
    const totalReviews = sortedReviews.length;
    const paginatedReviews = sortedReviews.slice(offset, offset + limit);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalReviews / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    // Build response - check if simple format is requested for compatibility
    const useSimpleFormat = req.query.format === 'simple';
    
    let apiResponse: any;
    
    if (useSimpleFormat) {
      // Simple format for compatibility with requirement.md
      apiResponse = {
        status: 'ok',
        data: paginatedReviews
      };
    } else {
      // Full format with comprehensive metadata
      apiResponse = {
        status: 'success',
        data: {
          reviews: paginatedReviews,
          pagination: {
            page,
            limit,
            total: totalReviews,
            totalPages,
            hasNext,
            hasPrev
          },
          filters: {
            listingId: queryParams.listingId,
            from: queryParams.from,
            to: queryParams.to,
            channel: queryParams.channel,
            approved: queryParams.approved,
            reviewType: queryParams.reviewType
          },
          meta: {
            cached: false,
            processedAt: new Date().toISOString(),
            source
          }
        },
        message: `Successfully retrieved ${paginatedReviews.length} reviews`
      };
    }

    // Cache the response (TTL with jitter will be applied automatically)
    const cacheSuccess = await cacheReviewsResponse(cacheKey, apiResponse);

    if (!cacheSuccess) {
      logger.warn('Failed to cache response', { requestId, cacheKey });
    }

    // Log successful request
    const responseTime = Date.now() - requestStart;
    logger.info('Hostaway reviews request completed successfully', {
      requestId,
      reviewCount: paginatedReviews.length,
      totalAvailable: totalReviews,
      page,
      source,
      cached: false,
      responseTime,
      normalizationWarnings: normalizationResult.warnings?.length || 0
    });

    // Set response headers
    res.set('X-Request-ID', requestId);
    res.set('X-Response-Time', `${responseTime}ms`);
    res.set('X-Cache-Status', 'MISS');
    res.set('X-Source', source);

    res.json(apiResponse);

  } catch (error) {
    const responseTime = Date.now() - requestStart;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error('Hostaway reviews request failed', {
      requestId,
      error: errorMessage,
      query: req.query,
      responseTime
    });

    res.set('X-Request-ID', requestId);
    res.set('X-Response-Time', `${responseTime}ms`);

    // Determine appropriate error code and status
    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';

    if (errorMessage.includes('Invalid query') || errorMessage.includes('validation')) {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
    } else if (errorMessage.includes('not found') || errorMessage.includes('Not Found')) {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
    } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
      statusCode = 503;
      errorCode = 'SERVICE_UNAVAILABLE';
    }

    res.status(statusCode).json({
      status: 'error',
      message: statusCode === 500 ? 'Internal server error' : errorMessage,
      code: errorCode,
      details: process.env.NODE_ENV === 'development' ? { originalError: errorMessage } : undefined
    } as ErrorResponse);
  }
});

/**
 * GET /api/reviews/hostaway/metrics
 * Returns API and cache metrics for monitoring
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const hostawayMetrics = getHostawayApiMetrics();
    const cacheMetrics = getCacheMetrics();

    res.json({
      status: 'success',
      data: {
        hostaway_api: hostawayMetrics,
        cache: cacheMetrics,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to retrieve metrics', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve metrics',
      code: 'METRICS_ERROR'
    } as ErrorResponse);
  }
});

/**
 * GET /api/reviews/hostaway/health
 * Health check endpoint for Hostaway service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthStatus = await hostawayHealthCheck();
    
    res.status(healthStatus.healthy ? 200 : 503).json({
      status: healthStatus.healthy ? 'healthy' : 'unhealthy',
      service: 'hostaway-reviews',
      timestamp: new Date().toISOString(),
      details: healthStatus.details
    });
  } catch (error) {
    logger.error('Health check failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(503).json({
      status: 'unhealthy',
      service: 'hostaway-reviews',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/reviews/hostaway/cache/invalidate
 * Endpoint to invalidate cache for specific listings or patterns
 */
router.post('/cache/invalidate', async (req: Request, res: Response) => {
  try {
    const { listingId, pattern, key } = req.body;

    let deletedCount = 0;

    if (listingId) {
      deletedCount = await invalidateListingCache(Number(listingId));
      logger.info('Cache invalidated for listing', { listingId, deletedCount });
    } else if (pattern) {
      deletedCount = await invalidateCache(pattern);
      logger.info('Cache invalidated by pattern', { pattern, deletedCount });
    } else if (key) {
      deletedCount = await invalidateCache(undefined, key);
      logger.info('Cache invalidated by key', { key, deletedCount });
    } else {
      return res.status(400).json({
        status: 'error',
        message: 'Must provide listingId, pattern, or key for cache invalidation',
        code: 'VALIDATION_ERROR'
      } as ErrorResponse);
    }

    res.json({
      status: 'success',
      data: {
        deletedCount,
        timestamp: new Date().toISOString()
      },
      message: `Successfully invalidated ${deletedCount} cache entries`
    });
  } catch (error) {
    logger.error('Cache invalidation failed', {
      error: error instanceof Error ? error.message : String(error),
      body: req.body
    });

    res.status(500).json({
      status: 'error',
      message: 'Failed to invalidate cache',
      code: 'CACHE_ERROR',
      details: error instanceof Error ? error.message : String(error)
    } as ErrorResponse);
  }
});

/**
 * GET /api/reviews/hostaway/cache/stats
 * Returns detailed cache statistics
 */
router.get('/cache/stats', async (req: Request, res: Response) => {
  try {
    const cacheMetrics = getCacheMetrics();
    const raw = getCacheConfiguration();
    
    // Map the cache config to the expected shape
    const config = { 
      enabled: raw.enabled, 
      defaultTtl: raw.ttl, 
      keyPrefix: raw.keyPrefix 
    };
    
    res.json({
      status: 'success',
      data: {
        metrics: cacheMetrics,
        config,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to retrieve cache stats', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve cache statistics',
      code: 'CACHE_ERROR'
    } as ErrorResponse);
  }
});

/**
 * Error handling middleware for routes
 */
router.use((error: Error, req: Request, res: Response, next: any) => {
  logger.error('Unhandled route error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    query: req.query
  });

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
    details: process.env.NODE_ENV === 'development' ? { 
      message: error.message,
      stack: error.stack 
    } : undefined
  } as ErrorResponse);
});

export default router;

/**
 * Listings routes
 * Implements GET /api/listings for property metadata retrieval
 */

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { validateQuery } from '../middleware/validation';
import { listingQueryParamsSchema } from '../validation/reviewSchemas';
import { 
  getListings, 
  getListingById, 
  getListingBySlug, 
  getListingByHostawayId, 
  searchListings,
  getListingsWithReviewStats
} from '../services/listingService';
import { 
  generateCacheKey, 
  getCachedResponse, 
  cacheResponse 
} from '../services/cacheService';
import { z } from 'zod';
import {
  ListingResponse,
  ErrorResponse,
  ListingQueryParams
} from '../types/reviews';

const router = Router();

// Schema for validating listing ID parameter
const listingIdSchema = z.object({
  id: z.string().regex(/^c[a-z0-9]{24}$/, 'Must be a valid CUID')
});

// Schema for search query
const searchQuerySchema = z.object({
  q: z.string().min(1).max(255),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  includeStats: z.coerce.boolean().default(false)
});

/**
 * GET /api/listings
 * Main endpoint for retrieving listings with optional review statistics
 */
router.get('/', 
  validateQuery(listingQueryParamsSchema),
  async (req: Request, res: Response) => {
    const requestStart = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info('Listings request started', {
      requestId,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    try {
      const queryParams = req.query as ListingQueryParams;

      // Generate cache key from validated query params
      const cacheKey = generateCacheKey('listings', queryParams);

      logger.debug('Generated cache key for listings', {
        requestId,
        cacheKey,
        queryParams
      });

      // Check cache first
      const cachedResponse = await getCachedResponse<ListingResponse>(cacheKey);
      if (cachedResponse) {
        const responseTime = Date.now() - requestStart;
        res.set('X-Request-ID', requestId);
        res.set('X-Response-Time', `${responseTime}ms`);
        res.set('X-Cache-Hit', 'true');
        res.set('X-Total-Count', cachedResponse.response.data.pagination.total.toString());
        res.set('X-Page', cachedResponse.response.data.pagination.page.toString());
        res.set('X-Total-Pages', cachedResponse.response.data.pagination.totalPages.toString());

        logger.info('Listings request completed from cache', {
          requestId,
          listingCount: cachedResponse.response.data.listings?.length || 0,
          totalAvailable: cachedResponse.response.data.pagination.total,
          page: cachedResponse.response.data.pagination.page,
          responseTime,
          cacheHit: true
        });

        return res.json(cachedResponse.response);
      }

      logger.debug('Fetching listings from service (cache miss)', {
        requestId,
        queryParams,
        cacheKey
      });

      // Get listings from service
      const { listings, total } = await getListings(queryParams);

      // Calculate pagination metadata
      const page = queryParams.page || 1;
      const limit = queryParams.limit || 20;
      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      // Build response
      const response: ListingResponse = {
        status: 'success',
        data: {
          listings,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext,
            hasPrev
          },
          meta: {
            processedAt: new Date().toISOString(),
            totalListings: total
          }
        },
        message: `Successfully retrieved ${listings.length} listings`
      };

      // Cache the response asynchronously (don't wait for it)
      cacheResponse(cacheKey, response).catch(error => {
        logger.error('Failed to cache listings response', {
          requestId,
          cacheKey,
          error: error instanceof Error ? error.message : String(error)
        });
      });

      // Set response headers
      const responseTime = Date.now() - requestStart;
      res.set('X-Request-ID', requestId);
      res.set('X-Response-Time', `${responseTime}ms`);
      res.set('X-Cache-Hit', 'false');
      res.set('X-Total-Count', total.toString());
      res.set('X-Page', page.toString());
      res.set('X-Total-Pages', totalPages.toString());

      logger.info('Listings request completed successfully', {
        requestId,
        listingCount: listings.length,
        totalAvailable: total,
        page,
        includeStats: queryParams.includeStats,
        responseTime
      });

      res.json(response);

    } catch (error) {
      const responseTime = Date.now() - requestStart;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Listings request failed', {
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
  }
);

/**
 * GET /api/listings/search
 * Search listings by text query
 */
router.get('/search',
  validateQuery(searchQuerySchema),
  async (req: Request, res: Response) => {
    const requestStart = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const { q, page, limit, includeStats } = req.query as any;
      
      logger.info('Listings search request', {
        requestId,
        searchQuery: q,
        page,
        limit,
        includeStats,
        ip: req.ip
      });

      const { listings, total } = await searchListings(
        q,
        { page, limit },
        includeStats
      );

      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      const responseTime = Date.now() - requestStart;
      res.set('X-Request-ID', requestId);
      res.set('X-Response-Time', `${responseTime}ms`);
      res.set('X-Total-Count', total.toString());

      logger.info('Listings search completed', {
        requestId,
        searchQuery: q,
        found: listings.length,
        total,
        responseTime
      });

      res.json({
        status: 'success',
        data: {
          listings,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext,
            hasPrev
          },
          query: q,
          meta: {
            processedAt: new Date().toISOString(),
            searchQuery: q,
            totalListings: total
          }
        },
        message: `Found ${listings.length} listings matching "${q}"`
      });

    } catch (error) {
      const responseTime = Date.now() - requestStart;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Listings search failed', {
        requestId,
        searchQuery: req.query.q,
        error: errorMessage,
        responseTime
      });

      res.set('X-Request-ID', requestId);
      res.set('X-Response-Time', `${responseTime}ms`);

      res.status(500).json({
        status: 'error',
        message: 'Search operation failed',
        code: 'SEARCH_ERROR',
        details: process.env.NODE_ENV === 'development' ? { originalError: errorMessage } : undefined
      } as ErrorResponse);
    }
  }
);

/**
 * GET /api/listings/with-stats
 * Get listings with comprehensive review statistics and filtering
 */
const statsFilterSchema = z.object({
  minReviews: z.coerce.number().int().min(0).optional(),
  minRating: z.coerce.number().min(0).max(10).optional(),
  maxRating: z.coerce.number().min(0).max(10).optional(),
  channels: z.array(z.string()).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

router.get('/with-stats',
  validateQuery(statsFilterSchema),
  async (req: Request, res: Response) => {
    const requestStart = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const { minReviews, minRating, maxRating, channels, page, limit } = req.query as any;
      
      const filters = {
        minReviews,
        minRating,
        maxRating,
        channels
      };

      logger.info('Listings with stats request', {
        requestId,
        filters,
        pagination: { page, limit },
        ip: req.ip
      });

      const { listings, total } = await getListingsWithReviewStats(
        filters,
        { page, limit }
      );

      const totalPages = Math.ceil(total / limit);
      const responseTime = Date.now() - requestStart;

      res.set('X-Request-ID', requestId);
      res.set('X-Response-Time', `${responseTime}ms`);
      res.set('X-Total-Count', total.toString());

      logger.info('Listings with stats completed', {
        requestId,
        returned: listings.length,
        total,
        responseTime
      });

      res.json({
        status: 'success',
        data: {
          listings,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          },
          filters,
          meta: {
            processedAt: new Date().toISOString(),
            totalListings: total
          }
        },
        message: `Retrieved ${listings.length} listings with review statistics`
      });

    } catch (error) {
      const responseTime = Date.now() - requestStart;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Listings with stats request failed', {
        requestId,
        error: errorMessage,
        responseTime
      });

      res.set('X-Request-ID', requestId);
      res.set('X-Response-Time', `${responseTime}ms`);

      res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve listings with statistics',
        code: 'STATS_ERROR',
        details: process.env.NODE_ENV === 'development' ? { originalError: errorMessage } : undefined
      } as ErrorResponse);
    }
  }
);

/**
 * GET /api/listings/slug/:slug
 * Get a listing by slug
 */
router.get('/slug/:slug',
  async (req: Request, res: Response) => {
    const requestStart = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const slug = req.params.slug;
      const includeStats = req.query.includeStats === 'true';
      
      if (!slug || slug.length < 1 || slug.length > 255) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid slug format',
          code: 'VALIDATION_ERROR',
          details: [{ field: 'slug', message: 'Must be between 1 and 255 characters', value: slug }]
        } as ErrorResponse);
      }

      logger.info('Listing by slug request', {
        requestId,
        slug,
        includeStats,
        ip: req.ip
      });

      const listing = await getListingBySlug(slug, includeStats);

      if (!listing) {
        return res.status(404).json({
          status: 'error',
          message: 'Listing not found',
          code: 'NOT_FOUND'
        } as ErrorResponse);
      }

      const responseTime = Date.now() - requestStart;
      res.set('X-Request-ID', requestId);
      res.set('X-Response-Time', `${responseTime}ms`);

      logger.info('Listing by slug request completed', {
        requestId,
        slug,
        listingId: listing.id,
        responseTime
      });

      res.json({
        status: 'success',
        data: {
          listing,
          meta: {
            processedAt: new Date().toISOString(),
            lookupMethod: 'slug',
            includeStats
          }
        }
      });

    } catch (error) {
      const responseTime = Date.now() - requestStart;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Listing by slug request failed', {
        requestId,
        slug: req.params.slug,
        error: errorMessage,
        responseTime
      });

      res.set('X-Request-ID', requestId);
      res.set('X-Response-Time', `${responseTime}ms`);

      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? { originalError: errorMessage } : undefined
      } as ErrorResponse);
    }
  }
);

/**
 * GET /api/listings/hostaway/:hostawayId
 * Get a listing by Hostaway listing ID
 */
router.get('/hostaway/:hostawayId',
  async (req: Request, res: Response) => {
    const requestStart = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const hostawayId = req.params.hostawayId;
      const includeStats = req.query.includeStats === 'true';
      
      if (!hostawayId || !/^\d+$/.test(hostawayId)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid Hostaway listing ID format',
          code: 'VALIDATION_ERROR',
          details: [{ field: 'hostawayId', message: 'Must be a numeric string', value: hostawayId }]
        } as ErrorResponse);
      }

      logger.info('Listing by Hostaway ID request', {
        requestId,
        hostawayId,
        includeStats,
        ip: req.ip
      });

      const listing = await getListingByHostawayId(hostawayId, includeStats);

      if (!listing) {
        return res.status(404).json({
          status: 'error',
          message: 'Listing not found',
          code: 'NOT_FOUND'
        } as ErrorResponse);
      }

      const responseTime = Date.now() - requestStart;
      res.set('X-Request-ID', requestId);
      res.set('X-Response-Time', `${responseTime}ms`);

      logger.info('Listing by Hostaway ID request completed', {
        requestId,
        hostawayId,
        listingId: listing.id,
        responseTime
      });

      res.json({
        status: 'success',
        data: {
          listing,
          meta: {
            processedAt: new Date().toISOString(),
            lookupMethod: 'hostaway_id',
            includeStats
          }
        }
      });

    } catch (error) {
      const responseTime = Date.now() - requestStart;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Listing by Hostaway ID request failed', {
        requestId,
        hostawayId: req.params.hostawayId,
        error: errorMessage,
        responseTime
      });

      res.set('X-Request-ID', requestId);
      res.set('X-Response-Time', `${responseTime}ms`);

      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? { originalError: errorMessage } : undefined
      } as ErrorResponse);
    }
  }
);

/**
 * GET /api/listings/:id
 * Get a specific listing by ID
 */
router.get('/:id',
  async (req: Request, res: Response) => {
    const requestStart = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const listingId = req.params.id;
      const includeStats = req.query.includeStats === 'true';
      
      // Basic CUID validation
      const cuidRegex = /^c[a-z0-9]{24}$/;
      if (!cuidRegex.test(listingId)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid listing ID format',
          code: 'VALIDATION_ERROR',
          details: [{ field: 'id', message: 'Must be a valid CUID', value: listingId }]
        } as ErrorResponse);
      }

      logger.info('Single listing request', {
        requestId,
        listingId,
        includeStats,
        ip: req.ip
      });

      const listing = await getListingById(listingId, includeStats);

      if (!listing) {
        return res.status(404).json({
          status: 'error',
          message: 'Listing not found',
          code: 'NOT_FOUND'
        } as ErrorResponse);
      }

      const responseTime = Date.now() - requestStart;
      res.set('X-Request-ID', requestId);
      res.set('X-Response-Time', `${responseTime}ms`);

      logger.info('Single listing request completed', {
        requestId,
        listingId,
        includeStats,
        responseTime
      });

      res.json({
        status: 'success',
        data: {
          listing,
          meta: {
            processedAt: new Date().toISOString(),
            includeStats
          }
        }
      });

    } catch (error) {
      const responseTime = Date.now() - requestStart;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Single listing request failed', {
        requestId,
        listingId: req.params.id,
        error: errorMessage,
        responseTime
      });

      res.set('X-Request-ID', requestId);
      res.set('X-Response-Time', `${responseTime}ms`);

      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? { originalError: errorMessage } : undefined
      } as ErrorResponse);
    }
  }
);

/**
 * Error handling middleware for this router
 */
router.use((error: Error, req: Request, res: Response, next: any) => {
  logger.error('Unhandled listings route error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    query: req.query,
    params: req.params
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

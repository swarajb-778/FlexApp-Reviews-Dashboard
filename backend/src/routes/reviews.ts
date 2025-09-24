/**
 * Review management routes
 * Implements GET /api/reviews with comprehensive filtering, pagination, and sorting
 */

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { validateQuery, validatePagination, validateSorting, validateAll } from '../middleware/validation';
import { reviewManagementQuerySchema } from '../validation/reviewSchemas';
import { getReviews, getReviewById, getReviewStats, getReviewApprovalHistory } from '../services/reviewService';
import { 
  generateCacheKey, 
  getCachedReviewManagementResponse, 
  cacheReviewManagementResponse 
} from '../services/cacheService';
import {
  ReviewManagementResponse,
  ErrorResponse,
  ReviewFilterOptions,
  ReviewSortOptions
} from '../types/reviews';

const router = Router();

/**
 * GET /api/reviews
 * Main endpoint for retrieving reviews with comprehensive filtering and pagination
 */
router.get('/', 
  validateQuery(reviewManagementQuerySchema),
  async (req: Request, res: Response) => {
    const requestStart = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info('Reviews request started', {
      requestId,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    try {
      const queryParams = req.query as any;
      
      // Build filters from query parameters
      const filters: ReviewFilterOptions = {
        listingId: queryParams.listingId,
        approved: queryParams.approved,
        channel: queryParams.channel,
        reviewType: queryParams.reviewType,
        minRating: queryParams.minRating,
        maxRating: queryParams.maxRating,
        from: queryParams.from,
        to: queryParams.to,
        guestName: queryParams.guestName,
        hasResponse: queryParams.hasResponse,
        search: queryParams.search
      };

      // Build pagination
      const pagination = {
        page: queryParams.page || 1,
        limit: queryParams.limit || 20
      };

      // Build sorting
      const sort: ReviewSortOptions = {
        field: queryParams.sortBy || 'submittedAt',
        order: queryParams.sortOrder || 'desc'
      };

      // Generate cache key from validated query params
      const cacheKey = generateCacheKey('reviews', queryParams);

      logger.debug('Generated cache key', {
        requestId,
        cacheKey,
        filters,
        pagination,
        sort
      });

      // Check cache first
      const cachedResponse = await getCachedReviewManagementResponse(cacheKey);
      if (cachedResponse) {
        const responseTime = Date.now() - requestStart;
        res.set('X-Request-ID', requestId);
        res.set('X-Response-Time', `${responseTime}ms`);
        res.set('X-Cache-Hit', 'true');
        res.set('X-Total-Count', cachedResponse.response.data.pagination.total.toString());
        res.set('X-Page', cachedResponse.response.data.pagination.page.toString());
        res.set('X-Total-Pages', cachedResponse.response.data.pagination.totalPages.toString());

        logger.info('Reviews request completed from cache', {
          requestId,
          reviewCount: cachedResponse.response.data.reviews.length,
          totalAvailable: cachedResponse.response.data.pagination.total,
          page: cachedResponse.response.data.pagination.page,
          responseTime,
          cacheHit: true
        });

        return res.json(cachedResponse.response);
      }

      // Service options
      const options = {
        includeListing: true,
        includeCategories: true
      };

      logger.debug('Fetching reviews from service (cache miss)', {
        requestId,
        filters,
        pagination,
        sort,
        cacheKey
      });

      // Get reviews from service
      const { reviews, total, stats } = await getReviews(filters, pagination, sort, options);

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / pagination.limit);
      const hasNext = pagination.page < totalPages;
      const hasPrev = pagination.page > 1;

      // Build response
      const response: ReviewManagementResponse = {
        status: 'success',
        data: {
          reviews,
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total,
            totalPages,
            hasNext,
            hasPrev
          },
          filters,
          meta: {
            processedAt: new Date().toISOString(),
            totalApproved: stats.approved,
            totalPending: stats.pending,
            totalRejected: stats.rejected,
            averageRating: stats.averageRating,
            cached: false,
            source: 'database' as const
          }
        },
        message: `Successfully retrieved ${reviews.length} reviews`
      };

      // Cache the ReviewManagementResponse directly (don't wait for it)
      cacheReviewManagementResponse(cacheKey, response).catch(error => {
        logger.error('Failed to cache review management response', {
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
      res.set('X-Page', pagination.page.toString());
      res.set('X-Total-Pages', totalPages.toString());

      logger.info('Reviews request completed successfully', {
        requestId,
        reviewCount: reviews.length,
        totalAvailable: total,
        page: pagination.page,
        responseTime,
        filters: Object.keys(filters).filter(key => filters[key as keyof ReviewFilterOptions] !== undefined)
      });

      res.json(response);

    } catch (error) {
      const responseTime = Date.now() - requestStart;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Reviews request failed', {
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
  }
);

/**
 * GET /api/reviews/stats
 * Get review statistics with optional filtering
 */
router.get('/stats',
  validateQuery(reviewManagementQuerySchema.pick({ 
    listingId: true, 
    from: true, 
    to: true,
    channel: true,
    approved: true 
  })),
  async (req: Request, res: Response) => {
    const requestStart = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const queryParams = req.query as any;
      
      // Build filters from query parameters
      const filters: ReviewFilterOptions = {
        listingId: queryParams.listingId,
        from: queryParams.from,
        to: queryParams.to,
        channel: queryParams.channel,
        approved: queryParams.approved
      };

      logger.info('Review stats request', {
        requestId,
        filters,
        ip: req.ip
      });

      const stats = await getReviewStats(filters);

      const responseTime = Date.now() - requestStart;
      res.set('X-Request-ID', requestId);
      res.set('X-Response-Time', `${responseTime}ms`);

      logger.info('Review stats request completed', {
        requestId,
        totalReviews: stats.totalReviews,
        responseTime
      });

      res.json({
        status: 'success',
        data: {
          stats,
          filters,
          meta: {
            processedAt: new Date().toISOString()
          }
        }
      });

    } catch (error) {
      const responseTime = Date.now() - requestStart;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Review stats request failed', {
        requestId,
        error: errorMessage,
        query: req.query,
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
 * GET /api/reviews/:id
 * Get a specific review by ID
 */
router.get('/:id',
  async (req: Request, res: Response) => {
    const requestStart = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const reviewId = req.params.id;
      
      // Basic CUID validation
      const cuidRegex = /^c[a-z0-9]{24}$/;
      if (!cuidRegex.test(reviewId)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid review ID format',
          code: 'VALIDATION_ERROR',
          details: [{ field: 'id', message: 'Must be a valid CUID', value: reviewId }]
        } as ErrorResponse);
      }

      logger.info('Single review request', {
        requestId,
        reviewId,
        ip: req.ip
      });

      const review = await getReviewById(reviewId, {
        includeListing: true,
        includeCategories: true
      });

      if (!review) {
        return res.status(404).json({
          status: 'error',
          message: 'Review not found',
          code: 'NOT_FOUND'
        } as ErrorResponse);
      }

      const responseTime = Date.now() - requestStart;
      res.set('X-Request-ID', requestId);
      res.set('X-Response-Time', `${responseTime}ms`);

      logger.info('Single review request completed', {
        requestId,
        reviewId,
        responseTime
      });

      res.json({
        status: 'success',
        data: {
          review,
          meta: {
            processedAt: new Date().toISOString()
          }
        }
      });

    } catch (error) {
      const responseTime = Date.now() - requestStart;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Single review request failed', {
        requestId,
        reviewId: req.params.id,
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
 * GET /api/reviews/:id/approval-history
 * Get approval history for a specific review
 */
router.get('/:id/approval-history',
  async (req: Request, res: Response) => {
    const requestStart = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const reviewId = req.params.id;
      
      // Basic CUID validation
      const cuidRegex = /^c[a-z0-9]{24}$/;
      if (!cuidRegex.test(reviewId)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid review ID format',
          code: 'VALIDATION_ERROR',
          details: [{ field: 'id', message: 'Must be a valid CUID', value: reviewId }]
        } as ErrorResponse);
      }

      logger.info('Review approval history request', {
        requestId,
        reviewId,
        ip: req.ip
      });

      // Get both the current review and its approval history
      const [review, approvalHistory] = await Promise.all([
        getReviewById(reviewId),
        getReviewApprovalHistory(reviewId)
      ]);

      if (!review) {
        return res.status(404).json({
          status: 'error',
          message: 'Review not found',
          code: 'NOT_FOUND'
        } as ErrorResponse);
      }

      const responseTime = Date.now() - requestStart;
      res.set('X-Request-ID', requestId);
      res.set('X-Response-Time', `${responseTime}ms`);

      logger.info('Review approval history request completed', {
        requestId,
        reviewId,
        historyCount: approvalHistory.length,
        responseTime
      });

      res.json({
        status: 'success',
        data: {
          reviewId,
          currentStatus: review.approved,
          history: approvalHistory,
          approvalHistory, // Backward compatibility
          meta: {
            processedAt: new Date().toISOString(),
            totalEntries: approvalHistory.length,
            note: 'Audit log implementation pending'
          }
        }
      });

    } catch (error) {
      const responseTime = Date.now() - requestStart;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Review approval history request failed', {
        requestId,
        reviewId: req.params.id,
        error: errorMessage,
        responseTime
      });

      res.set('X-Request-ID', requestId);
      res.set('X-Response-Time', `${responseTime}ms`);

      let statusCode = 500;
      if (errorMessage.includes('not found')) {
        statusCode = 404;
      }

      res.status(statusCode).json({
        status: 'error',
        message: statusCode === 500 ? 'Internal server error' : errorMessage,
        code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? { originalError: errorMessage } : undefined
      } as ErrorResponse);
    }
  }
);

/**
 * Error handling middleware for this router
 */
router.use((error: Error, req: Request, res: Response, next: any) => {
  logger.error('Unhandled reviews route error', {
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

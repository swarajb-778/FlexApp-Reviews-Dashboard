/**
 * Review approval routes
 * Implements PATCH /api/reviews/:id/approve for review approval workflow
 */

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { validateBody, validateParams } from '../middleware/validation';
import { requireAuth, requirePermission, getUserContext } from '../middleware/auth';
import { reviewApprovalSchema } from '../validation/reviewSchemas';
import { approveReview, getReviewById, bulkUpdateReviews } from '../services/reviewService';
import { z } from 'zod';
import {
  ErrorResponse,
  ReviewApprovalRequest,
  BulkUpdateRequest
} from '../types/reviews';

const router = Router();

// Schema for validating review ID parameter
const reviewIdSchema = z.object({
  id: z.string().regex(/^c[a-z0-9]{24}$/, 'Must be a valid CUID')
});

/**
 * PATCH /api/reviews/:id/approve
 * Approve or unapprove a review with optional response
 */
router.patch('/:id/approve',
  requireAuth,
  requirePermission('reviews:approve'),
  validateParams(reviewIdSchema),
  validateBody(reviewApprovalSchema),
  async (req: Request, res: Response) => {
    const requestStart = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info('Review approval request started', {
      requestId,
      reviewId: req.params.id,
      body: req.body,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    try {
      const reviewId = req.params.id;
      const approvalData = req.body as ReviewApprovalRequest;
      
      // Check if review exists first
      const existingReview = await getReviewById(reviewId);
      if (!existingReview) {
        return res.status(404).json({
          status: 'error',
          message: 'Review not found',
          code: 'NOT_FOUND'
        } as ErrorResponse);
      }

      // Check if approval status is actually changing
      if (existingReview.approved === approvalData.approved) {
        const action = approvalData.approved ? 'approved' : 'unapproved';
        return res.status(400).json({
          status: 'error',
          message: `Review is already ${action}`,
          code: 'NO_CHANGE_REQUIRED',
          details: {
            currentStatus: existingReview.approved,
            requestedStatus: approvalData.approved
          }
        } as ErrorResponse);
      }

      // Capture user context for audit logging
      const userContext = getUserContext(req);

      logger.debug('Updating review approval', {
        requestId,
        reviewId,
        previousApproval: existingReview.approved,
        newApproval: approvalData.approved,
        hasResponse: !!approvalData.response
      });

      // Update the review
      const updatedReview = await approveReview(
        reviewId,
        approvalData.approved,
        approvalData.response,
        userContext
      );

      const responseTime = Date.now() - requestStart;
      
      // Set response headers
      res.set('X-Request-ID', requestId);
      res.set('X-Response-Time', `${responseTime}ms`);

      logger.info('Review approval completed successfully', {
        requestId,
        reviewId,
        approved: approvalData.approved,
        hasResponse: !!approvalData.response,
        previousApproval: existingReview.approved,
        responseTime
      });

      const action = approvalData.approved ? 'approved' : 'unapproved';
      
      res.json({
        status: 'success',
        data: {
          review: updatedReview,
          meta: {
            processedAt: new Date().toISOString(),
            action,
            previousStatus: existingReview.approved
          }
        },
        message: `Review ${action} successfully`
      });

    } catch (error) {
      const responseTime = Date.now() - requestStart;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Review approval request failed', {
        requestId,
        reviewId: req.params.id,
        error: errorMessage,
        body: req.body,
        responseTime
      });

      res.set('X-Request-ID', requestId);
      res.set('X-Response-Time', `${responseTime}ms`);

      // Determine appropriate error code and status
      let statusCode = 500;
      let errorCode = 'INTERNAL_ERROR';

      if (errorMessage.includes('Review not found')) {
        statusCode = 404;
        errorCode = 'NOT_FOUND';
      } else if (errorMessage.includes('Invalid') || errorMessage.includes('validation')) {
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
 * PATCH /api/reviews/:id/unapprove
 * Convenience endpoint for unapproving a review
 */
router.patch('/:id/unapprove',
  requireAuth,
  requirePermission('reviews:approve'),
  validateParams(reviewIdSchema),
  async (req: Request, res: Response) => {
    const requestStart = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const reviewId = req.params.id;
      
      // Check if review exists
      const existingReview = await getReviewById(reviewId);
      if (!existingReview) {
        return res.status(404).json({
          status: 'error',
          message: 'Review not found',
          code: 'NOT_FOUND'
        } as ErrorResponse);
      }

      if (!existingReview.approved) {
        return res.status(400).json({
          status: 'error',
          message: 'Review is already unapproved',
          code: 'NO_CHANGE_REQUIRED'
        } as ErrorResponse);
      }

      const userContext = getUserContext(req);

      const updatedReview = await approveReview(reviewId, false, undefined, userContext);

      const responseTime = Date.now() - requestStart;
      res.set('X-Request-ID', requestId);
      res.set('X-Response-Time', `${responseTime}ms`);

      logger.info('Review unapproval completed', {
        requestId,
        reviewId,
        responseTime
      });

      res.json({
        status: 'success',
        data: {
          review: updatedReview,
          meta: {
            processedAt: new Date().toISOString(),
            action: 'unapproved',
            previousStatus: true
          }
        },
        message: 'Review unapproved successfully'
      });

    } catch (error) {
      const responseTime = Date.now() - requestStart;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Review unapproval failed', {
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
        code: 'INTERNAL_ERROR'
      } as ErrorResponse);
    }
  }
);

/**
 * POST /api/reviews/bulk-approve
 * Bulk approve/unapprove multiple reviews
 */
const bulkUpdateSchema = z.object({
  reviewIds: z.array(z.string().regex(/^c[a-z0-9]{24}$/, 'Must be valid CUIDs')).min(1).max(100),
  approved: z.boolean(),
  response: z.string().max(5000).optional()
});

router.post('/bulk-approve',
  requireAuth,
  requirePermission('reviews:approve'),
  validateBody(bulkUpdateSchema),
  async (req: Request, res: Response) => {
    const requestStart = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info('Bulk review approval request started', {
      requestId,
      reviewCount: req.body.reviewIds.length,
      approved: req.body.approved,
      ip: req.ip
    });

    try {
      const bulkRequest = req.body as BulkUpdateRequest;
      
      const userContext = getUserContext(req);

      const result = await bulkUpdateReviews(bulkRequest, userContext);

      const responseTime = Date.now() - requestStart;
      res.set('X-Request-ID', requestId);
      res.set('X-Response-Time', `${responseTime}ms`);

      const statusCode = result.success ? 200 : 207; // 207 for partial success

      logger.info('Bulk review approval completed', {
        requestId,
        requested: bulkRequest.reviewIds.length,
        updated: result.updated,
        failed: result.failed,
        success: result.success,
        responseTime
      });

      res.status(statusCode).json({
        status: result.success ? 'success' : 'partial_success',
        data: {
          result,
          meta: {
            processedAt: new Date().toISOString(),
            action: bulkRequest.approved ? 'approved' : 'unapproved'
          }
        },
        message: result.success 
          ? `Successfully ${bulkRequest.approved ? 'approved' : 'unapproved'} ${result.updated} reviews`
          : `Partially completed: ${result.updated} updated, ${result.failed} failed`
      });

    } catch (error) {
      const responseTime = Date.now() - requestStart;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Bulk review approval failed', {
        requestId,
        error: errorMessage,
        body: req.body,
        responseTime
      });

      res.set('X-Request-ID', requestId);
      res.set('X-Response-Time', `${responseTime}ms`);

      res.status(500).json({
        status: 'error',
        message: 'Bulk approval operation failed',
        code: 'BULK_OPERATION_FAILED',
        details: process.env.NODE_ENV === 'development' ? { originalError: errorMessage } : undefined
      } as ErrorResponse);
    }
  }
);


/**
 * Error handling middleware for this router
 */
router.use((error: Error, req: Request, res: Response, next: any) => {
  logger.error('Unhandled review approval route error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    body: req.body,
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

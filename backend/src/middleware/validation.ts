/**
 * Reusable validation middleware for request validation
 * Provides consistent validation patterns across all endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../lib/logger';
import { ErrorResponse } from '../types/reviews';

/**
 * Generic validation middleware factory
 */
export function validateSchema(schema: ZodSchema, target: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      let dataToValidate;
      
      switch (target) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        default:
          dataToValidate = req.body;
      }

      const result = schema.safeParse(dataToValidate);
      
      if (!result.success) {
        const validationErrors = result.error.issues.map(issue => ({
          field: issue.path.join('.') || 'unknown',
          message: issue.message,
          value: issue.received || issue.input,
          code: issue.code
        }));

        logger.warn('Validation failed', {
          target,
          path: req.path,
          method: req.method,
          errors: validationErrors,
          data: dataToValidate
        });

        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationErrors
        } as ErrorResponse);
      }

      // Store validated data back to request object
      switch (target) {
        case 'body':
          req.body = result.data;
          break;
        case 'query':
          req.query = result.data;
          break;
        case 'params':
          req.params = result.data;
          break;
      }

      next();
    } catch (error) {
      logger.error('Validation middleware error', {
        error: error instanceof Error ? error.message : String(error),
        target,
        path: req.path,
        method: req.method
      });

      res.status(500).json({
        status: 'error',
        message: 'Internal validation error',
        code: 'INTERNAL_ERROR'
      } as ErrorResponse);
    }
  };
}

/**
 * Validate request body
 */
export function validateBody(schema: ZodSchema) {
  return validateSchema(schema, 'body');
}

/**
 * Validate query parameters
 */
export function validateQuery(schema: ZodSchema) {
  return validateSchema(schema, 'query');
}

/**
 * Validate route parameters
 */
export function validateParams(schema: ZodSchema) {
  return validateSchema(schema, 'params');
}

/**
 * Validate pagination parameters with defaults
 */
export function validatePagination() {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      if (page < 1) {
        return res.status(400).json({
          status: 'error',
          message: 'Page must be greater than 0',
          code: 'VALIDATION_ERROR',
          details: [{ field: 'page', message: 'Page must be greater than 0', value: page }]
        } as ErrorResponse);
      }

      if (limit < 1 || limit > 100) {
        return res.status(400).json({
          status: 'error',
          message: 'Limit must be between 1 and 100',
          code: 'VALIDATION_ERROR',
          details: [{ field: 'limit', message: 'Limit must be between 1 and 100', value: limit }]
        } as ErrorResponse);
      }

      // Add validated pagination to request
      req.pagination = { page, limit };
      
      next();
    } catch (error) {
      logger.error('Pagination validation error', {
        error: error instanceof Error ? error.message : String(error),
        query: req.query
      });

      res.status(400).json({
        status: 'error',
        message: 'Invalid pagination parameters',
        code: 'VALIDATION_ERROR'
      } as ErrorResponse);
    }
  };
}

/**
 * Validate sorting parameters
 */
export function validateSorting(allowedFields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const sortBy = req.query.sortBy as string;
      const sortOrder = req.query.sortOrder as string;

      if (sortBy && !allowedFields.includes(sortBy)) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid sort field. Allowed fields: ${allowedFields.join(', ')}`,
          code: 'VALIDATION_ERROR',
          details: [{ 
            field: 'sortBy', 
            message: `Must be one of: ${allowedFields.join(', ')}`, 
            value: sortBy 
          }]
        } as ErrorResponse);
      }

      if (sortOrder && !['asc', 'desc'].includes(sortOrder)) {
        return res.status(400).json({
          status: 'error',
          message: 'Sort order must be "asc" or "desc"',
          code: 'VALIDATION_ERROR',
          details: [{ 
            field: 'sortOrder', 
            message: 'Must be "asc" or "desc"', 
            value: sortOrder 
          }]
        } as ErrorResponse);
      }

      // Add validated sorting to request
      req.sorting = {
        field: sortBy || allowedFields[0],
        order: (sortOrder as 'asc' | 'desc') || 'desc'
      };

      next();
    } catch (error) {
      logger.error('Sorting validation error', {
        error: error instanceof Error ? error.message : String(error),
        query: req.query,
        allowedFields
      });

      res.status(400).json({
        status: 'error',
        message: 'Invalid sorting parameters',
        code: 'VALIDATION_ERROR'
      } as ErrorResponse);
    }
  };
}

/**
 * Validate review ID parameter
 */
export function validateReviewId() {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const reviewId = req.params.id;

      if (!reviewId) {
        return res.status(400).json({
          status: 'error',
          message: 'Review ID is required',
          code: 'VALIDATION_ERROR',
          details: [{ field: 'id', message: 'Review ID is required', value: reviewId }]
        } as ErrorResponse);
      }

      // Basic CUID validation (Prisma's default ID format)
      const cuidRegex = /^c[a-z0-9]{24}$/;
      if (!cuidRegex.test(reviewId)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid review ID format',
          code: 'VALIDATION_ERROR',
          details: [{ field: 'id', message: 'Must be a valid CUID', value: reviewId }]
        } as ErrorResponse);
      }

      next();
    } catch (error) {
      logger.error('Review ID validation error', {
        error: error instanceof Error ? error.message : String(error),
        reviewId: req.params.id
      });

      res.status(400).json({
        status: 'error',
        message: 'Invalid review ID',
        code: 'VALIDATION_ERROR'
      } as ErrorResponse);
    }
  };
}

/**
 * Validate listing ID parameter
 */
export function validateListingId() {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const listingId = req.params.id;

      if (!listingId) {
        return res.status(400).json({
          status: 'error',
          message: 'Listing ID is required',
          code: 'VALIDATION_ERROR',
          details: [{ field: 'id', message: 'Listing ID is required', value: listingId }]
        } as ErrorResponse);
      }

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

      next();
    } catch (error) {
      logger.error('Listing ID validation error', {
        error: error instanceof Error ? error.message : String(error),
        listingId: req.params.id
      });

      res.status(400).json({
        status: 'error',
        message: 'Invalid listing ID',
        code: 'VALIDATION_ERROR'
      } as ErrorResponse);
    }
  };
}

/**
 * Validate date range parameters
 */
export function validateDateRange() {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const from = req.query.from as string;
      const to = req.query.to as string;

      if (from) {
        const fromDate = new Date(from);
        if (isNaN(fromDate.getTime())) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid "from" date format',
            code: 'VALIDATION_ERROR',
            details: [{ field: 'from', message: 'Must be a valid date', value: from }]
          } as ErrorResponse);
        }
      }

      if (to) {
        const toDate = new Date(to);
        if (isNaN(toDate.getTime())) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid "to" date format',
            code: 'VALIDATION_ERROR',
            details: [{ field: 'to', message: 'Must be a valid date', value: to }]
          } as ErrorResponse);
        }
      }

      if (from && to) {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        
        if (fromDate > toDate) {
          return res.status(400).json({
            status: 'error',
            message: 'From date must be before or equal to to date',
            code: 'VALIDATION_ERROR',
            details: [{ 
              field: 'from', 
              message: 'From date must be before or equal to to date', 
              value: from 
            }]
          } as ErrorResponse);
        }
      }

      next();
    } catch (error) {
      logger.error('Date range validation error', {
        error: error instanceof Error ? error.message : String(error),
        from: req.query.from,
        to: req.query.to
      });

      res.status(400).json({
        status: 'error',
        message: 'Invalid date range parameters',
        code: 'VALIDATION_ERROR'
      } as ErrorResponse);
    }
  };
}

/**
 * Validate rating range parameters
 */
export function validateRatingRange() {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const minRating = req.query.minRating ? parseFloat(req.query.minRating as string) : undefined;
      const maxRating = req.query.maxRating ? parseFloat(req.query.maxRating as string) : undefined;

      if (minRating !== undefined) {
        if (isNaN(minRating) || minRating < 0 || minRating > 10) {
          return res.status(400).json({
            status: 'error',
            message: 'Minimum rating must be between 0 and 10',
            code: 'VALIDATION_ERROR',
            details: [{ field: 'minRating', message: 'Must be between 0 and 10', value: minRating }]
          } as ErrorResponse);
        }
      }

      if (maxRating !== undefined) {
        if (isNaN(maxRating) || maxRating < 0 || maxRating > 10) {
          return res.status(400).json({
            status: 'error',
            message: 'Maximum rating must be between 0 and 10',
            code: 'VALIDATION_ERROR',
            details: [{ field: 'maxRating', message: 'Must be between 0 and 10', value: maxRating }]
          } as ErrorResponse);
        }
      }

      if (minRating !== undefined && maxRating !== undefined && minRating > maxRating) {
        return res.status(400).json({
          status: 'error',
          message: 'Minimum rating must be less than or equal to maximum rating',
          code: 'VALIDATION_ERROR',
          details: [{ 
            field: 'minRating', 
            message: 'Must be less than or equal to maximum rating', 
            value: minRating 
          }]
        } as ErrorResponse);
      }

      next();
    } catch (error) {
      logger.error('Rating range validation error', {
        error: error instanceof Error ? error.message : String(error),
        minRating: req.query.minRating,
        maxRating: req.query.maxRating
      });

      res.status(400).json({
        status: 'error',
        message: 'Invalid rating range parameters',
        code: 'VALIDATION_ERROR'
      } as ErrorResponse);
    }
  };
}

/**
 * Combine multiple validation middleware
 */
export function validateAll(...validators: ((req: Request, res: Response, next: NextFunction) => void)[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    let index = 0;
    
    const runNext = () => {
      if (index >= validators.length) {
        return next();
      }
      
      const validator = validators[index++];
      validator(req, res, (err?: any) => {
        if (err) {
          return next(err);
        }
        runNext();
      });
    };
    
    runNext();
  };
}

// Extend Express Request interface to include validated data
declare global {
  namespace Express {
    interface Request {
      pagination?: { page: number; limit: number };
      sorting?: { field: string; order: 'asc' | 'desc' };
      validatedBody?: any;
      validatedQuery?: any;
      validatedParams?: any;
    }
  }
}

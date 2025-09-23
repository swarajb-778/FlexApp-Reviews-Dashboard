import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';

// Custom error types
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public details: any;

  constructor(message: string, details?: any) {
    super(message, 400);
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden access') {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429);
  }
}

// Error response interface
interface ErrorResponse {
  error: {
    message: string;
    statusCode: number;
    timestamp: string;
    path: string;
    method: string;
    requestId?: string;
    details?: any;
    stack?: string;
  };
}

/**
 * Handle Prisma database errors
 */
const handlePrismaError = (error: PrismaClientKnownRequestError): AppError => {
  switch (error.code) {
    case 'P2002':
      return new ConflictError('Resource already exists with these unique values');
    case 'P2025':
      return new NotFoundError('Resource');
    case 'P2003':
      return new ValidationError('Invalid reference to related resource');
    case 'P2014':
      return new ValidationError('Invalid ID provided');
    case 'P2015':
      return new NotFoundError('Related resource');
    case 'P2016':
      return new ValidationError('Query interpretation error');
    case 'P2017':
      return new ValidationError('Records for relation are disconnected');
    case 'P2018':
      return new NotFoundError('Required connected resource');
    case 'P2019':
      return new ValidationError('Input error');
    case 'P2020':
      return new ValidationError('Value out of range');
    case 'P2021':
      return new ValidationError('Table does not exist');
    case 'P2022':
      return new ValidationError('Column does not exist');
    case 'P2023':
      return new ValidationError('Inconsistent column data');
    case 'P2024':
      return new AppError('Connection timeout', 408);
    case 'P2026':
      return new AppError('Database server error', 500);
    case 'P2027':
      return new AppError('Database connection error', 500);
    default:
      return new AppError('Database operation failed', 500);
  }
};

/**
 * Handle Prisma validation errors
 */
const handlePrismaValidationError = (error: PrismaClientValidationError): AppError => {
  return new ValidationError('Invalid data provided', {
    originalError: error.message,
  });
};

/**
 * Handle JSON parsing errors
 */
const handleJsonError = (error: SyntaxError): AppError => {
  return new ValidationError('Invalid JSON format', {
    originalError: error.message,
  });
};

/**
 * Handle Redis connection errors
 */
const handleRedisError = (error: Error): AppError => {
  if (error.message.includes('ECONNREFUSED')) {
    return new AppError('Cache service unavailable', 503);
  }
  if (error.message.includes('TIMEOUT')) {
    return new AppError('Cache service timeout', 408);
  }
  return new AppError('Cache service error', 500);
};

/**
 * Convert various error types to AppError
 */
const normalizeError = (error: any): AppError => {
  // Already an AppError
  if (error instanceof AppError) {
    return error;
  }

  // Prisma errors
  if (error instanceof PrismaClientKnownRequestError) {
    return handlePrismaError(error);
  }

  if (error instanceof PrismaClientValidationError) {
    return handlePrismaValidationError(error);
  }

  // JSON parsing errors
  if (error instanceof SyntaxError && error.message.includes('JSON')) {
    return handleJsonError(error);
  }

  // Redis errors
  if (error.name === 'RedisError' || error.message.includes('Redis')) {
    return handleRedisError(error);
  }

  // Validation errors from libraries like Zod
  if (error.name === 'ZodError') {
    return new ValidationError('Validation failed', {
      details: error.errors,
    });
  }

  // Generic errors
  return new AppError(
    error.message || 'Internal server error',
    error.statusCode || 500
  );
};

/**
 * Main error handling middleware
 */
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // If response was already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(error);
  }

  const normalizedError = normalizeError(error);
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Log the error
  logger.error('Request error', {
    message: normalizedError.message,
    statusCode: normalizedError.statusCode,
    stack: normalizedError.stack,
    path: req.path,
    method: req.method,
    requestId: (req as any).requestId,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query,
    params: req.params,
  });

  // Prepare error response
  const errorResponse: ErrorResponse = {
    error: {
      message: normalizedError.message,
      statusCode: normalizedError.statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      requestId: (req as any).requestId,
    },
  };

  // Add additional details in development
  if (isDevelopment) {
    errorResponse.error.stack = normalizedError.stack;
    if ((normalizedError as any).details) {
      errorResponse.error.details = (normalizedError as any).details;
    }
  }

  // Send error response
  res.status(normalizedError.statusCode).json(errorResponse);
};

/**
 * Handle 404 errors for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.path}`);
  
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });

  const errorResponse: ErrorResponse = {
    error: {
      message: error.message,
      statusCode: error.statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    },
  };

  res.status(404).json(errorResponse);
};

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

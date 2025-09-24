/**
 * Authentication and authorization middleware for the reviews API
 * Provides basic authentication and permission checking capabilities
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { ErrorResponse } from '../types/reviews';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        permissions?: string[];
        role?: string;
      };
    }
  }
}

/**
 * Basic authentication middleware placeholder
 * In production, this should integrate with your authentication system
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Check for Authorization header
    const authHeader = req.get('Authorization');
    
    // In development/test mode, allow requests without auth
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      // Mock user for development
      req.user = {
        id: 'dev_user_123',
        email: 'dev@example.com',
        permissions: ['reviews:read', 'reviews:approve', 'reviews:manage'],
        role: 'admin'
      };
      
      logger.debug('Auth bypassed for development', {
        requestId,
        mockUser: req.user.id,
        path: req.path
      });
      
      return next();
    }

    // Basic token validation (replace with your auth system)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Authorization header required',
        code: 'UNAUTHORIZED',
        details: {
          expected: 'Bearer <token>',
          received: authHeader ? 'Invalid format' : 'Missing header'
        }
      } as ErrorResponse);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // TODO: Implement actual token validation with your auth service
    // For now, this is a placeholder that checks for a basic token format
    if (!token || token.length < 10) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token format',
        code: 'INVALID_TOKEN'
      } as ErrorResponse);
    }

    // Mock user extraction from token (replace with actual implementation)
    // In production, you would decode JWT or validate with auth service
    req.user = {
      id: `user_${token.substring(0, 8)}`,
      email: 'user@example.com',
      permissions: ['reviews:read', 'reviews:approve'],
      role: 'moderator'
    };

    logger.debug('User authenticated', {
      requestId,
      userId: req.user.id,
      permissions: req.user.permissions,
      path: req.path
    });

    next();
  } catch (error) {
    logger.error('Authentication error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      path: req.path
    });

    res.status(500).json({
      status: 'error',
      message: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR'
    } as ErrorResponse);
  }
}

/**
 * Permission checking middleware
 * Verifies that the authenticated user has the required permission
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Ensure user is authenticated
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        } as ErrorResponse);
      }

      // Check if user has the required permission
      const userPermissions = req.user.permissions || [];
      const hasPermission = userPermissions.includes(permission) || 
                           userPermissions.includes('*') || // Admin wildcard
                           req.user.role === 'admin'; // Admin role override

      if (!hasPermission) {
        logger.warn('Permission denied', {
          requestId,
          userId: req.user.id,
          requiredPermission: permission,
          userPermissions,
          userRole: req.user.role,
          path: req.path
        });

        return res.status(403).json({
          status: 'error',
          message: 'Insufficient permissions',
          code: 'FORBIDDEN',
          details: {
            required: permission,
            userPermissions,
            userRole: req.user.role
          }
        } as ErrorResponse);
      }

      logger.debug('Permission granted', {
        requestId,
        userId: req.user.id,
        permission,
        path: req.path
      });

      next();
    } catch (error) {
      logger.error('Permission check error', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        permission,
        userId: req.user?.id,
        path: req.path
      });

      res.status(500).json({
        status: 'error',
        message: 'Permission service error',
        code: 'PERMISSION_SERVICE_ERROR'
      } as ErrorResponse);
    }
  };
}

/**
 * Role-based access control middleware
 * Checks if user has one of the required roles
 */
export function requireRole(roles: string | string[]) {
  const requiredRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Ensure user is authenticated
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        } as ErrorResponse);
      }

      // Check if user has one of the required roles
      const userRole = req.user.role;
      const hasRole = userRole && requiredRoles.includes(userRole);

      if (!hasRole) {
        logger.warn('Role access denied', {
          requestId,
          userId: req.user.id,
          requiredRoles,
          userRole,
          path: req.path
        });

        return res.status(403).json({
          status: 'error',
          message: 'Insufficient role privileges',
          code: 'INSUFFICIENT_ROLE',
          details: {
            required: requiredRoles,
            userRole
          }
        } as ErrorResponse);
      }

      logger.debug('Role access granted', {
        requestId,
        userId: req.user.id,
        userRole,
        requiredRoles,
        path: req.path
      });

      next();
    } catch (error) {
      logger.error('Role check error', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        requiredRoles,
        userId: req.user?.id,
        path: req.path
      });

      res.status(500).json({
        status: 'error',
        message: 'Role service error',
        code: 'ROLE_SERVICE_ERROR'
      } as ErrorResponse);
    }
  };
}

/**
 * Combined auth middleware for convenience
 * Combines authentication and permission checking
 */
export function requireAuthAndPermission(permission: string) {
  return [requireAuth, requirePermission(permission)];
}

/**
 * Combined auth and role middleware
 * Combines authentication and role checking
 */
export function requireAuthAndRole(roles: string | string[]) {
  return [requireAuth, requireRole(roles)];
}

/**
 * Extract user context for audit logging
 * Returns standardized user context object
 */
export function getUserContext(req: Request): {
  userId?: string;
  ip?: string;
  userAgent?: string;
  email?: string;
  role?: string;
} {
  return {
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    email: req.user?.email,
    role: req.user?.role
  };
}

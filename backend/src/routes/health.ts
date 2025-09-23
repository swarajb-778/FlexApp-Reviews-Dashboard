import { Router, Request, Response } from 'express';
import { getDatabaseHealth } from '../lib/database';
import { getRedisHealth } from '../lib/redis';
import { logger } from '../lib/logger';

const router = Router();

/**
 * Basic health check endpoint
 * Returns basic application status without dependency checks
 * Used for lightweight health monitoring
 */
router.get('/health', (_req: Request, res: Response): void => {
  const startTime = Date.now();
  
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    responseTime: Date.now() - startTime,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024),
    },
    pid: process.pid,
  };

  logger.debug('Basic health check performed', { responseTime: healthData.responseTime });
  
  res.status(200).json(healthData);
});

/**
 * Readiness probe endpoint
 * Performs comprehensive health checks including external dependencies
 * Used by container orchestrators and load balancers
 */
router.get('/health/ready', async (_req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  const checks: Record<string, any> = {};
  let overallStatus = 'healthy';
  let statusCode = 200;

  try {
    // Database health check
    logger.debug('Checking database health');
    const dbHealth = await getDatabaseHealth();
    checks.database = dbHealth;
    
    if (dbHealth.status !== 'healthy') {
      overallStatus = 'unhealthy';
      statusCode = 503;
    }

    // Redis health check
    logger.debug('Checking Redis health');
    const redisHealth = await getRedisHealth();
    checks.redis = redisHealth;
    
    if (redisHealth.status !== 'healthy') {
      overallStatus = 'unhealthy';
      statusCode = 503;
    }

    // Additional system checks
    checks.memory = {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      percentage: Math.round(
        (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
      ),
    };

    const totalResponseTime = Date.now() - startTime;

    const healthData = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      responseTime: totalResponseTime,
      checks,
      pid: process.pid,
    };

    // Log the health check result
    if (overallStatus === 'healthy') {
      logger.debug('Readiness check passed', { 
        responseTime: totalResponseTime,
        dbLatency: dbHealth.latency,
        redisLatency: redisHealth.latency,
      });
    } else {
      logger.warn('Readiness check failed', {
        responseTime: totalResponseTime,
        failedChecks: Object.entries(checks)
          .filter(([, check]) => check.status !== 'healthy')
          .map(([name]) => name),
      });
    }

    res.status(statusCode).json(healthData);
  } catch (error) {
    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Health check error:', error);

    const errorResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      responseTime: Date.now() - startTime,
      error: errorMessage,
      checks,
      pid: process.pid,
    };

    res.status(503).json(errorResponse);
  }
});

/**
 * Liveness probe endpoint
 * Minimal check to verify the application is running
 * Used by container orchestrators to restart unhealthy containers
 */
router.get('/health/live', (_req: Request, res: Response): void => {
  const healthData = {
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid,
  };

  logger.debug('Liveness check performed');
  res.status(200).json(healthData);
});

export default router;

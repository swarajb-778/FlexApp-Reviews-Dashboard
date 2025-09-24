import { Router, Request, Response } from 'express';
import { register, HealthMonitor, DatabaseMonitor, PerformanceMonitor } from '../lib/monitoring';
import { auth } from '../middleware/auth';
import { logger } from '../lib/logger';
import { PrismaClient } from '@prisma/client';
import { clearByPattern } from '../lib/redis';
import os from 'os';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /metrics
 * Prometheus metrics endpoint
 * Public endpoint for Prometheus scraping
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.status(200).send(metrics);
  } catch (error) {
    logger.error('Failed to generate metrics', error);
    res.status(500).send('Failed to generate metrics');
  }
});

/**
 * GET /health
 * Basic health check endpoint
 * Public endpoint for load balancers
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await HealthMonitor.performHealthCheck();
    
    const response = {
      status: health.overall ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      components: health.components
    };

    res.status(health.overall ? 200 : 503).json(response);
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

/**
 * GET /health/detailed
 * Detailed health information
 * Requires authentication
 */
router.get('/health/detailed', auth, async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Basic health check
    const basicHealth = await HealthMonitor.performHealthCheck();
    
    // Database detailed info
    const databaseInfo = await getDatabaseInfo();
    
    // Redis detailed info
    const redisInfo = await getRedisInfo();
    
    // System info
    const systemInfo = getSystemInfo();
    
    // Performance metrics
    const performanceMetrics = await getPerformanceMetrics();
    
    const totalCheckTime = Date.now() - startTime;

    const response = {
      status: basicHealth.overall ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checkDuration: `${totalCheckTime}ms`,
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: {
        process: Math.floor(process.uptime()),
        system: Math.floor(os.uptime())
      },
      components: {
        database: {
          status: basicHealth.components.database ? 'healthy' : 'unhealthy',
          details: databaseInfo
        },
        redis: {
          status: basicHealth.components.redis ? 'healthy' : 'unhealthy',
          details: redisInfo
        },
        externalApis: {
          hostaway: basicHealth.components.hostaway,
          google: basicHealth.components.google
        }
      },
      system: systemInfo,
      performance: performanceMetrics
    };

    res.status(basicHealth.overall ? 200 : 503).json(response);
  } catch (error) {
    logger.error('Detailed health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Detailed health check failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /admin/stats
 * Administrative statistics
 * Requires authentication
 */
router.get('/admin/stats', auth, async (req: Request, res: Response) => {
  try {
    const stats = await getAdministrativeStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get administrative stats', error);
    res.status(500).json({
      error: 'Failed to get administrative stats',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /admin/performance
 * Performance metrics and analysis
 * Requires authentication
 */
router.get('/admin/performance', auth, async (req: Request, res: Response) => {
  try {
    const performance = await getDetailedPerformanceMetrics();
    res.json(performance);
  } catch (error) {
    logger.error('Failed to get performance metrics', error);
    res.status(500).json({
      error: 'Failed to get performance metrics',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /admin/cache/clear
 * Clear application cache
 * Requires authentication
 */
router.post('/admin/cache/clear', auth, async (req: Request, res: Response) => {
  try {
    const { pattern } = req.body;
    
    if (pattern) {
      // Clear specific pattern using SCAN-based approach
      const keysCleared = await clearByPattern(pattern);
      
      logger.info('Cache cleared with pattern', { 
        pattern, 
        keysCleared,
        performedBy: req.user?.id,
        method: 'scan_based'
      });
      
      res.json({
        success: true,
        message: `Cleared ${keysCleared} cache entries matching pattern: ${pattern}`,
        keysCleared
      });
    } else {
      // Clear all cache - use flushall through cacheUtils
      const { cacheUtils } = await import('../lib/redis');
      await cacheUtils.flush();
      
      logger.info('All cache cleared', { performedBy: req.user?.id });
      
      res.json({
        success: true,
        message: 'All cache cleared',
        keysCleared: 'all'
      });
    }
  } catch (error) {
    logger.error('Failed to clear cache', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /admin/logs
 * Recent application logs
 * Requires authentication
 */
router.get('/admin/logs', auth, async (req: Request, res: Response) => {
  try {
    const { 
      level = 'info', 
      limit = 100, 
      since 
    } = req.query as {
      level?: string;
      limit?: string;
      since?: string;
    };

    // This is a simplified implementation
    // In a real application, you'd query your log storage system
    const logs = await getRecentLogs(level, parseInt(limit), since);
    
    res.json({
      logs,
      metadata: {
        level,
        limit: parseInt(limit),
        since: since || 'beginning',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get logs', error);
    res.status(500).json({
      error: 'Failed to get logs',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Helper functions

async function getDatabaseInfo() {
  try {
    // Get database connection info
    const connectionInfo = await prisma.$queryRaw<Array<{
      count: bigint;
    }>>`SELECT count(*) FROM pg_stat_activity WHERE state = 'active'`;

    const tableStats = await prisma.$queryRaw<Array<{
      table_name: string;
      row_count: bigint;
      size_pretty: string;
    }>>`
      SELECT 
        schemaname||'.'||tablename as table_name,
        n_tup_ins + n_tup_upd + n_tup_del as row_count,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size_pretty
      FROM pg_stat_user_tables 
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC 
      LIMIT 10
    `;

    return {
      activeConnections: Number(connectionInfo[0]?.count || 0),
      tables: tableStats.map(stat => ({
        name: stat.table_name,
        rowCount: Number(stat.row_count),
        size: stat.size_pretty
      }))
    };
  } catch (error) {
    logger.error('Failed to get database info', error);
    return {
      activeConnections: 0,
      tables: [],
      error: 'Failed to fetch database information'
    };
  }
}

async function getRedisInfo() {
  try {
    const { getRedisClient } = await import('../lib/redis');
    const client = getRedisClient();
    
    const info = await client.info();
    const keyspace = await client.info('keyspace');
    const memory = await client.info('memory');
    
    return {
      connected: true,
      keyspace: keyspace.split('\r\n').filter(line => line.startsWith('db')),
      memory: memory.split('\r\n')
        .filter(line => line.includes('used_memory') || line.includes('maxmemory'))
        .reduce((acc: any, line) => {
          const [key, value] = line.split(':');
          if (key) acc[key] = value;
          return acc;
        }, {})
    };
  } catch (error) {
    logger.error('Failed to get Redis info', error);
    return {
      connected: false,
      error: 'Failed to fetch Redis information'
    };
  }
}

function getSystemInfo() {
  return {
    platform: os.platform(),
    architecture: os.arch(),
    nodeVersion: process.version,
    cpus: os.cpus().length,
    memory: {
      total: Math.round(os.totalmem() / 1024 / 1024 / 1024 * 100) / 100 + ' GB',
      free: Math.round(os.freemem() / 1024 / 1024 / 1024 * 100) / 100 + ' GB',
      used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024 * 100) / 100 + ' GB',
      usage: Math.round((1 - os.freemem() / os.totalmem()) * 100) + '%'
    },
    loadAverage: os.loadavg(),
    uptime: Math.floor(os.uptime())
  };
}

async function getPerformanceMetrics() {
  const memoryUsage = process.memoryUsage();
  
  return {
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100 + ' MB',
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100 + ' MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100 + ' MB',
      external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100 + ' MB'
    },
    uptime: Math.floor(process.uptime()),
    pid: process.pid
  };
}

async function getAdministrativeStats() {
  const [
    totalReviews,
    reviewsByStatus,
    reviewsBySource,
    totalListings,
    recentActivity
  ] = await Promise.all([
    // Total reviews
    prisma.review.count(),
    
    // Reviews by status
    prisma.review.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    }),
    
    // Reviews by source
    prisma.review.groupBy({
      by: ['source'],
      _count: {
        id: true
      }
    }),
    
    // Total listings
    prisma.listing.count(),
    
    // Recent activity (last 24 hours)
    prisma.reviewAuditLog.count({
      where: {
        performedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    })
  ]);

  return {
    reviews: {
      total: totalReviews,
      byStatus: reviewsByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
      bySource: reviewsBySource.reduce((acc, item) => {
        acc[item.source] = item._count.id;
        return acc;
      }, {} as Record<string, number>)
    },
    listings: {
      total: totalListings
    },
    activity: {
      recentActions: recentActivity
    },
    timestamp: new Date().toISOString()
  };
}

async function getDetailedPerformanceMetrics() {
  return PerformanceMonitor.measureAsyncFunction('detailed_performance_metrics', async () => {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Get metrics from Prometheus registry
    const metricsData = register.getMetricsAsJSON();
    
    return {
      system: {
        memory: {
          rss: memoryUsage.rss,
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          arrayBuffers: memoryUsage.arrayBuffers
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        uptime: process.uptime(),
        version: process.version
      },
      metrics: {
        totalMetrics: metricsData.length,
        httpRequests: metricsData.find(m => m.name === 'flexliving_reviews_http_requests_total'),
        httpDuration: metricsData.find(m => m.name === 'flexliving_reviews_http_request_duration_seconds'),
        errors: metricsData.find(m => m.name === 'flexliving_reviews_errors_total'),
        cacheOperations: metricsData.find(m => m.name === 'flexliving_reviews_cache_operations_total')
      },
      timestamp: new Date().toISOString()
    };
  });
}

async function getRecentLogs(level: string, limit: number, since?: string) {
  // This is a placeholder implementation
  // In a real application, you'd query your log storage system (ELK, CloudWatch, etc.)
  
  const mockLogs = [
    {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Application started successfully',
      service: 'backend'
    },
    {
      timestamp: new Date(Date.now() - 60000).toISOString(),
      level: 'warn',
      message: 'Slow query detected',
      service: 'backend',
      meta: { duration: '1.2s', query: 'SELECT * FROM reviews' }
    }
  ];
  
  return mockLogs
    .filter(log => since ? new Date(log.timestamp) > new Date(since) : true)
    .slice(0, limit);
}

export default router;

import { Request, Response, NextFunction } from 'express';
import promClient from 'prom-client';
import { logger } from './logger';

// Create a Registry which registers the metrics
export const register = new promClient.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'flexliving-reviews-dashboard',
  version: process.env.APP_VERSION || '1.0.0'
});

// Enable the collection of default metrics
promClient.collectDefaultMetrics({
  register,
  prefix: 'flexliving_reviews_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5], // These are the default buckets.
});

// Custom metrics
export const httpRequestDuration = new promClient.Histogram({
  name: 'flexliving_reviews_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpRequestsTotal = new promClient.Counter({
  name: 'flexliving_reviews_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestsActive = new promClient.Gauge({
  name: 'flexliving_reviews_http_requests_active',
  help: 'Number of active HTTP requests',
  labelNames: ['method', 'route'],
  registers: [register],
});

// Business metrics
export const reviewsProcessedTotal = new promClient.Counter({
  name: 'flexliving_reviews_processed_total',
  help: 'Total number of reviews processed',
  labelNames: ['source', 'status', 'operation'],
  registers: [register],
});

export const reviewsImportDuration = new promClient.Histogram({
  name: 'flexliving_reviews_import_duration_seconds',
  help: 'Time spent importing reviews',
  labelNames: ['source'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

export const externalApiRequests = new promClient.Counter({
  name: 'flexliving_reviews_external_api_requests_total',
  help: 'Total external API requests',
  labelNames: ['api', 'method', 'status'],
  registers: [register],
});

export const externalApiDuration = new promClient.Histogram({
  name: 'flexliving_reviews_external_api_duration_seconds',
  help: 'External API request duration',
  labelNames: ['api', 'method'],
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const databaseConnectionsActive = new promClient.Gauge({
  name: 'flexliving_reviews_db_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

export const databaseQueryDuration = new promClient.Histogram({
  name: 'flexliving_reviews_db_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

export const cacheOperations = new promClient.Counter({
  name: 'flexliving_reviews_cache_operations_total',
  help: 'Total cache operations',
  labelNames: ['operation', 'result'],
  registers: [register],
});

export const cacheHitRatio = new promClient.Gauge({
  name: 'flexliving_reviews_cache_hit_ratio',
  help: 'Cache hit ratio',
  registers: [register],
});

// Error tracking
export const errorsTotal = new promClient.Counter({
  name: 'flexliving_reviews_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'severity', 'service'],
  registers: [register],
});

// Queue metrics (if using background jobs)
export const queueJobsTotal = new promClient.Counter({
  name: 'flexliving_reviews_queue_jobs_total',
  help: 'Total queue jobs',
  labelNames: ['queue', 'status'],
  registers: [register],
});

export const queueJobDuration = new promClient.Histogram({
  name: 'flexliving_reviews_queue_job_duration_seconds',
  help: 'Queue job processing duration',
  labelNames: ['queue', 'job_type'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300],
  registers: [register],
});

// System health metrics
export const systemHealth = new promClient.Gauge({
  name: 'flexliving_reviews_system_health',
  help: 'System health status (1 = healthy, 0 = unhealthy)',
  labelNames: ['component'],
  registers: [register],
});

// Middleware for HTTP metrics collection
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const route = req.route?.path || req.path;
  const method = req.method;

  // Increment active requests
  httpRequestsActive.inc({ method, route });

  // Track request completion
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const statusCode = res.statusCode.toString();

    // Record metrics
    httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestsActive.dec({ method, route });

    // Log slow requests
    if (duration > 2) {
      logger.warn('Slow request detected', {
        method,
        route,
        duration: `${duration}s`,
        statusCode
      });
    }
  });

  next();
};

// Database monitoring helper
export class DatabaseMonitor {
  private static hitCount = 0;
  private static missCount = 0;

  static recordQuery(operation: string, table: string, duration: number) {
    databaseQueryDuration.observe({ operation, table }, duration);
    
    if (duration > 1) {
      logger.warn('Slow database query detected', {
        operation,
        table,
        duration: `${duration}s`
      });
    }
  }

  static recordConnection(activeConnections: number) {
    databaseConnectionsActive.set(activeConnections);
  }

  static recordCacheHit() {
    this.hitCount++;
    cacheOperations.inc({ operation: 'get', result: 'hit' });
    this.updateCacheHitRatio();
  }

  static recordCacheMiss() {
    this.missCount++;
    cacheOperations.inc({ operation: 'get', result: 'miss' });
    this.updateCacheHitRatio();
  }

  static recordCacheSet() {
    cacheOperations.inc({ operation: 'set', result: 'success' });
  }

  static recordCacheDelete() {
    cacheOperations.inc({ operation: 'delete', result: 'success' });
  }

  private static updateCacheHitRatio() {
    const total = this.hitCount + this.missCount;
    if (total > 0) {
      const ratio = this.hitCount / total;
      cacheHitRatio.set(ratio);
    }
  }
}

// External API monitoring helper
export class ExternalApiMonitor {
  static async recordRequest<T>(
    apiName: string,
    method: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    let status = 'success';

    try {
      const result = await requestFn();
      return result;
    } catch (error) {
      status = 'error';
      throw error;
    } finally {
      const duration = (Date.now() - start) / 1000;
      
      externalApiRequests.inc({ api: apiName, method, status });
      externalApiDuration.observe({ api: apiName, method }, duration);

      // Log slow external API calls
      if (duration > 5) {
        logger.warn('Slow external API call detected', {
          api: apiName,
          method,
          duration: `${duration}s`,
          status
        });
      }
    }
  }
}

// Review processing monitoring helper
export class ReviewMonitor {
  static recordProcessed(source: string, status: string, operation: string) {
    reviewsProcessedTotal.inc({ source, status, operation });
  }

  static async recordImport<T>(source: string, importFn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    const timer = reviewsImportDuration.startTimer({ source });

    try {
      const result = await importFn();
      return result;
    } finally {
      timer();
      const duration = (Date.now() - start) / 1000;
      
      if (duration > 30) {
        logger.warn('Slow review import detected', {
          source,
          duration: `${duration}s`
        });
      }
    }
  }
}

// Error monitoring helper
export class ErrorMonitor {
  static recordError(error: Error, type: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium') {
    errorsTotal.inc({ type, severity, service: 'backend' });
    
    logger.error('Application error tracked', {
      type,
      severity,
      error: error.message,
      stack: error.stack
    });

    // Alert for critical errors
    if (severity === 'critical') {
      this.sendCriticalAlert(error, type);
    }
  }

  private static sendCriticalAlert(error: Error, type: string) {
    // Integration with alerting system (Slack, PagerDuty, etc.)
    logger.error('CRITICAL ERROR ALERT', {
      type,
      error: error.message,
      timestamp: new Date().toISOString(),
      service: 'flexliving-reviews-backend'
    });

    // In a real implementation, this would send alerts to external services
    // Example: Slack webhook, PagerDuty API, email alerts, etc.
  }
}

// System health monitoring
export class HealthMonitor {
  static updateComponentHealth(component: string, isHealthy: boolean) {
    systemHealth.set({ component }, isHealthy ? 1 : 0);
  }

  static async checkDatabaseHealth(): Promise<boolean> {
    try {
      // This should be implemented with your actual database client
      // Example: await prisma.$queryRaw`SELECT 1`;
      this.updateComponentHealth('database', true);
      return true;
    } catch (error) {
      this.updateComponentHealth('database', false);
      logger.error('Database health check failed', error);
      return false;
    }
  }

  static async checkRedisHealth(): Promise<boolean> {
    try {
      // This should be implemented with your actual Redis client
      // Example: await redis.ping();
      this.updateComponentHealth('redis', true);
      return true;
    } catch (error) {
      this.updateComponentHealth('redis', false);
      logger.error('Redis health check failed', error);
      return false;
    }
  }

  static async checkExternalApisHealth(): Promise<{[key: string]: boolean}> {
    const results: {[key: string]: boolean} = {};

    // Check Hostaway API
    try {
      // This should make an actual test request
      results.hostaway = true;
      this.updateComponentHealth('hostaway_api', true);
    } catch (error) {
      results.hostaway = false;
      this.updateComponentHealth('hostaway_api', false);
    }

    // Check Google APIs
    try {
      // This should make an actual test request
      results.google = true;
      this.updateComponentHealth('google_api', true);
    } catch (error) {
      results.google = false;
      this.updateComponentHealth('google_api', false);
    }

    return results;
  }

  static async performHealthCheck(): Promise<{
    overall: boolean;
    components: {[key: string]: boolean};
  }> {
    const [database, redis, externalApis] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
      this.checkExternalApisHealth()
    ]);

    const components = {
      database,
      redis,
      ...externalApis
    };

    const overall = Object.values(components).every(status => status === true);

    return { overall, components };
  }
}

// Queue monitoring (for background job processing)
export class QueueMonitor {
  static recordJobStart(queue: string, jobType: string) {
    queueJobsTotal.inc({ queue, status: 'started' });
    return Date.now();
  }

  static recordJobComplete(queue: string, jobType: string, startTime: number) {
    const duration = (Date.now() - startTime) / 1000;
    queueJobsTotal.inc({ queue, status: 'completed' });
    queueJobDuration.observe({ queue, job_type: jobType }, duration);
  }

  static recordJobFailed(queue: string, jobType: string, startTime: number) {
    const duration = (Date.now() - startTime) / 1000;
    queueJobsTotal.inc({ queue, status: 'failed' });
    queueJobDuration.observe({ queue, job_type: jobType }, duration);
  }
}

// Performance monitoring helper
export class PerformanceMonitor {
  private static performanceMarks: Map<string, number> = new Map();

  static startTimer(name: string): void {
    this.performanceMarks.set(name, Date.now());
  }

  static endTimer(name: string): number {
    const start = this.performanceMarks.get(name);
    if (!start) {
      logger.warn('Performance timer not found', { name });
      return 0;
    }

    const duration = Date.now() - start;
    this.performanceMarks.delete(name);

    return duration;
  }

  static measureFunction<T>(name: string, fn: () => T): T {
    const start = Date.now();
    try {
      const result = fn();
      const duration = (Date.now() - start) / 1000;
      
      logger.debug('Function performance measured', {
        name,
        duration: `${duration}s`
      });
      
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      logger.error('Function failed during performance measurement', {
        name,
        duration: `${duration}s`,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  static async measureAsyncFunction<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = (Date.now() - start) / 1000;
      
      logger.debug('Async function performance measured', {
        name,
        duration: `${duration}s`
      });
      
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      logger.error('Async function failed during performance measurement', {
        name,
        duration: `${duration}s`,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

// Initialize periodic health checks
export function initializeMonitoring(): void {
  logger.info('Initializing monitoring and metrics collection');

  // Perform health checks every 30 seconds
  setInterval(async () => {
    try {
      await HealthMonitor.performHealthCheck();
    } catch (error) {
      logger.error('Health check failed', error);
    }
  }, 30000);

  // Log system metrics every 5 minutes
  setInterval(() => {
    const metrics = register.getMetricsAsJSON();
    logger.info('System metrics snapshot', {
      timestamp: new Date().toISOString(),
      metricsCount: metrics.length
    });
  }, 300000);

  logger.info('Monitoring initialization completed');
}

// Graceful shutdown helper
export async function gracefulShutdown(): Promise<void> {
  logger.info('Gracefully shutting down monitoring...');
  
  // Clear intervals
  // Note: In a real implementation, you'd track interval IDs
  
  // Final metrics export
  try {
    const finalMetrics = await register.metrics();
    logger.info('Final metrics exported', {
      timestamp: new Date().toISOString(),
      size: finalMetrics.length
    });
  } catch (error) {
    logger.error('Failed to export final metrics', error);
  }

  logger.info('Monitoring shutdown completed');
}

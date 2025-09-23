import { createServer } from 'http';
import { spawn } from 'child_process';
import { promisify } from 'util';
import app from './app';
import { logger } from './lib/logger';
import { connectRedis, testRedisConnection } from './lib/redis';
import { testDatabaseConnection } from './lib/database';

// Server configuration
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

/**
 * Run Prisma migrations
 */
const runMigrations = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    logger.info('Running database migrations...');
    
    const migrationProcess = spawn('npx', ['prisma', 'migrate', 'deploy'], {
      stdio: 'pipe',
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    migrationProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    migrationProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    migrationProcess.on('close', (code) => {
      if (code === 0) {
        logger.info('Database migrations completed successfully');
        if (stdout) logger.info('Migration output:', stdout.trim());
        resolve();
      } else {
        logger.error('Database migrations failed', {
          exitCode: code,
          stderr: stderr.trim(),
          stdout: stdout.trim(),
        });
        reject(new Error(`Migration process exited with code ${code}`));
      }
    });

    migrationProcess.on('error', (error) => {
      logger.error('Failed to start migration process:', error);
      reject(error);
    });
  });
};

/**
 * Start the HTTP server
 */
const startServer = async (): Promise<void> => {
  try {
    // Test database connection
    logger.info('Testing database connection...');
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    // Run database migrations
    await runMigrations();

    // Connect to Redis
    logger.info('Connecting to Redis...');
    await connectRedis();
    
    // Test Redis connection
    const redisConnected = await testRedisConnection();
    if (!redisConnected) {
      logger.warn('Redis connection failed, but server will continue');
    }

    // Create HTTP server
    const server = createServer(app);

    // Start listening
    server.listen(PORT, HOST, () => {
      logger.info(`Server started successfully`, {
        port: PORT,
        host: HOST,
        environment: process.env.NODE_ENV || 'development',
        processId: process.pid,
        nodeVersion: process.version,
        uptime: process.uptime(),
      });

      // Log available endpoints
      logger.info('Available endpoints:', {
        health: `http://${HOST}:${PORT}/health`,
        healthReady: `http://${HOST}:${PORT}/health/ready`,
        healthLive: `http://${HOST}:${PORT}/health/live`,
      });
    });

    // Server error handling
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof PORT === 'string' ? `Pipe ${PORT}` : `Port ${PORT}`;

      switch (error.code) {
        case 'EACCES':
          logger.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          logger.error('Server error:', error);
          throw error;
      }
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string): void => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      server.close(async (error) => {
        if (error) {
          logger.error('Error closing server:', error);
          process.exit(1);
        }

        logger.info('HTTP server closed');
        
        try {
          // Close database connections
          const { disconnectDatabase } = await import('./lib/database');
          await disconnectDatabase();
          
          // Close Redis connection
          const { disconnectRedis } = await import('./lib/redis');
          await disconnectRedis();
          
          logger.info('All connections closed successfully');
          process.exit(0);
        } catch (cleanupError) {
          logger.error('Error during cleanup:', cleanupError);
          process.exit(1);
        }
      });

      // Force shutdown if graceful shutdown takes too long
      setTimeout(() => {
        logger.warn('Graceful shutdown timeout, forcing exit');
        process.exit(1);
      }, 30000); // 30 seconds timeout
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception - shutting down:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled Promise Rejection - shutting down:', {
    reason,
    promise: promise.toString(),
  });
  process.exit(1);
});

// Start the server
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Server startup failed:', error);
    process.exit(1);
  });
}

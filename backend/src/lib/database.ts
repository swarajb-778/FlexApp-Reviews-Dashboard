import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

// Global variable to store the Prisma client instance
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Create a singleton Prisma client instance
 * In development, we use a global variable to prevent multiple instances
 * In production, we create a new instance
 */
const createPrismaClient = (): PrismaClient => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  const prismaClient = new PrismaClient({
    log: isDevelopment
      ? ['query', 'info', 'warn', 'error']
      : ['error'],
    errorFormat: 'minimal',
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  // Add query logging middleware in development
  if (isDevelopment) {
    prismaClient.$use(async (params, next) => {
      const before = Date.now();
      const result = await next(params);
      const after = Date.now();
      
      logger.debug(`Query ${params.model}.${params.action} took ${after - before}ms`);
      return result;
    });
  }

  return prismaClient;
};

// Create singleton instance
export const prisma = globalThis.__prisma ?? createPrismaClient();

// In development, store the instance globally to prevent multiple connections
if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

/**
 * Test database connection
 */
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error);
    return false;
  }
};

/**
 * Gracefully disconnect from database
 */
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting from database:', error);
  }
};

/**
 * Health check for database
 */
export const getDatabaseHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  latency: number;
  error?: string;
}> => {
  const startTime = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - startTime;
    
    return {
      status: 'healthy',
      latency,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      status: 'unhealthy',
      latency,
      error: errorMessage,
    };
  }
};


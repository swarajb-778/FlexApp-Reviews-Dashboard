// Jest setup file for test configuration
import { config } from 'dotenv';

// Load environment variables from .env.test if available
config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6380';
process.env.LOG_LEVEL = 'error'; // Suppress logs during testing
process.env.PORT = '4001'; // Use different port for testing

// Mock console methods to keep test output clean
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'debug').mockImplementation(() => {});
});

afterAll(() => {
  // Restore console methods
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.debug = originalConsole.debug;
});

// Global test timeout
jest.setTimeout(30000);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Mock external dependencies that shouldn't be called during tests
jest.mock('../lib/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(undefined),
  disconnectRedis: jest.fn().mockResolvedValue(undefined),
  testRedisConnection: jest.fn().mockResolvedValue(true),
  getRedisHealth: jest.fn().mockResolvedValue({
    status: 'healthy',
    latency: 10,
  }),
  getRedisClient: jest.fn().mockReturnValue({
    isOpen: true,
    ping: jest.fn().mockResolvedValue('PONG'),
  }),
  cacheUtils: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    exists: jest.fn().mockResolvedValue(false),
    flush: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../lib/database', () => ({
  prisma: {
    $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  },
  testDatabaseConnection: jest.fn().mockResolvedValue(true),
  disconnectDatabase: jest.fn().mockResolvedValue(undefined),
  getDatabaseHealth: jest.fn().mockResolvedValue({
    status: 'healthy',
    latency: 25,
  }),
}));

export {};

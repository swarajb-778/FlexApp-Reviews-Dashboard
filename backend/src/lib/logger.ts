import winston from 'winston';
import { format } from 'winston';

// Custom log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Custom colors for log levels
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Add custom colors to winston
winston.addColors(logColors);

// Determine log level based on environment
const level = (): string => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Custom format for development (human-readable)
const developmentFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  format.colorize({ all: true }),
  format.printf((info) => {
    const { timestamp, level, message, ...args } = info;
    const ts = timestamp as string;
    return `${ts} [${level}]: ${message as string} ${
      Object.keys(args).length ? JSON.stringify(args, null, 2) : ''
    }`;
  })
);

// Custom format for production (JSON)
const productionFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
);

// Console transport for development
const developmentTransports = [
  new winston.transports.Console({
    format: developmentFormat,
  }),
];

// Console and file transports for production
const productionTransports = [
  new winston.transports.Console({
    format: productionFormat,
  }),
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: productionFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: productionFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Create logger instance
export const logger = winston.createLogger({
  level: level(),
  levels: logLevels,
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: {
    service: 'flexliving-reviews-backend',
    version: process.env.npm_package_version || '1.0.0',
  },
  transports:
    process.env.NODE_ENV === 'production'
      ? productionTransports
      : developmentTransports,
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
  exitOnError: false,
});

// Request logger middleware for Express
export const requestLogger = (
  req: any,
  res: any,
  next: () => void
): void => {
  const startTime = Date.now();
  
  // Generate request ID
  const requestId = Math.random().toString(36).substring(2, 15);
  req.requestId = requestId;

  // Log request
  logger.http(`Incoming request`, {
    requestId,
    method: req.method as string,
    url: req.url as string,
    userAgent: req.get('User-Agent') as string,
    ip: req.ip as string,
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (body: any) {
    const duration = Date.now() - startTime;
    
    logger.http(`Request completed`, {
      requestId,
      method: req.method as string,
      url: req.url as string,
      statusCode: res.statusCode as number,
      duration,
      contentLength: body ? body.length : 0,
    });

    return originalSend.call(this, body);
  };

  next();
};

// Error logger
export const logError = (error: Error, context?: Record<string, any>): void => {
  logger.error('Application error', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...context,
  });
};

// Database operation logger
export const logDatabaseOperation = (
  operation: string,
  table: string,
  duration: number,
  context?: Record<string, any>
): void => {
  logger.debug('Database operation', {
    operation,
    table,
    duration,
    ...context,
  });
};

// Cache operation logger
export const logCacheOperation = (
  operation: string,
  key: string,
  hit: boolean,
  context?: Record<string, any>
): void => {
  logger.debug('Cache operation', {
    operation,
    key,
    hit,
    ...context,
  });
};

// Create logs directory if it doesn't exist (for production)
if (process.env.NODE_ENV === 'production') {
  const fs = require('fs');
  const path = require('path');
  
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

export default logger;

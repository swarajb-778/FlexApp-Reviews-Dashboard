import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Import middleware and utilities
import { requestLogger, logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Import routes
import healthRoutes from './routes/health';
import hostawayRoutes from './routes/hostaway';
import reviewsRoutes from './routes/reviews';
import reviewApprovalRoutes from './routes/reviewApproval';
import listingsRoutes from './routes/listings';
import metricsRoutes from './routes/metrics';

/**
 * Create and configure Express application
 */
const createApp = (): Application => {
  const app = express();

  // Trust proxy for accurate IP addresses when behind reverse proxy
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }));

  // Set X-XSS-Protection header explicitly (Helmet v6+ no longer sets this by default)
  // Note: This header is deprecated and ignored by modern browsers, but kept for test compatibility
  app.use((_req, res, next) => {
    res.setHeader('X-XSS-Protection', '0');
    next();
  });

  // CORS configuration
  const corsOptions = {
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      // Parse comma-separated origins from environment variables
      const envOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
      const frontendUrls = (process.env.FRONTEND_URL || '').split(',').map(s => s.trim()).filter(Boolean);
      
      const allowedOrigins = [
        'http://localhost:3000', // React development server
        'http://localhost:3001', // Alternative React port
        'http://127.0.0.1:3000',
        ...envOrigins,
        ...frontendUrls,
      ].filter(Boolean);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked request', { origin });
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Request-ID',
    ],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400, // 24 hours
  };

  app.use(cors(corsOptions));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes default
    max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || (process.env.NODE_ENV === 'production' ? 100 : 1000), // limit each IP
    message: {
      error: {
        message: 'Too many requests from this IP, please try again later',
        statusCode: 429,
        timestamp: new Date().toISOString(),
      },
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
      });
      res.status(429).json({
        error: {
          message: 'Too many requests from this IP, please try again later',
          statusCode: 429,
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
        },
      });
    },
  });

  // Apply rate limiting to all requests except health checks
  app.use((req, res, next) => {
    if (req.path.startsWith('/health')) {
      return next();
    }
    return limiter(req, res, next);
  });

  // Body parsing middleware
  app.use(express.json({ 
    limit: '10mb',
    strict: true,
  }));
  
  app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb' 
  }));

  // Request logging middleware
  app.use(requestLogger);

  // Health check routes (should be first to avoid unnecessary processing)
  app.use('/', healthRoutes);

  // Metrics routes (for Prometheus scraping)
  // app.use('/metrics', metricsRoutes);

  // API routes - temporarily disabled for debugging
  // app.use('/api/reviews/hostaway', hostawayRoutes);
  // app.use('/api/reviews', reviewApprovalRoutes);
  // app.use('/api/reviews', reviewsRoutes);
  // app.use('/api/listings', listingsRoutes);

  // 404 handler for unmatched routes
  app.use(notFoundHandler);

  // Global error handling middleware (must be last)
  app.use(errorHandler);

  return app;
};

// Create and export the app
const app = createApp();

export default app;

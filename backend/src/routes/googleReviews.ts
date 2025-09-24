import { Router } from 'express';
import { googleReviewsClient } from '../services/googleReviewsClient';
import { reviewService } from '../services/reviewService';
import { listingService } from '../services/listingService';
import { logger } from '../lib/logger';
import { auth } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, query, param } from 'express-validator';
import { clearByPattern } from '../lib/redis';
import { cacheUtils } from '../lib/redis';

const router = Router();

/**
 * GET /api/reviews/google/places/search
 * Search for Google Places
 */
router.get('/places/search',
  [
    query('query')
      .notEmpty()
      .withMessage('Search query is required')
      .isLength({ min: 3, max: 200 })
      .withMessage('Query must be between 3 and 200 characters'),
    query('lat')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitude must be between -90 and 90'),
    query('lng')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitude must be between -180 and 180'),
    query('radius')
      .optional()
      .isInt({ min: 1, max: 50000 })
      .withMessage('Radius must be between 1 and 50000 meters'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { query: searchQuery, lat, lng, radius } = req.query as {
        query: string;
        lat?: string;
        lng?: string;
        radius?: string;
      };

      // Check cache first
      const cacheKey = `google:places:search:${searchQuery}:${lat || ''}:${lng || ''}:${radius || ''}`;
      const cached = await cacheUtils.get(cacheKey);
      
      if (cached) {
        logger.info('Google Places search result served from cache', { query: searchQuery });
        return res.json({
          success: true,
          places: cached,
          cached: true
        });
      }

      const location = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined;
      const searchRadius = radius ? parseInt(radius) : undefined;

      const places = await googleReviewsClient.searchPlaces(
        searchQuery,
        location,
        searchRadius
      );

      // Cache results for 1 hour
      await cacheUtils.set(cacheKey, places, 3600);

      res.json({
        success: true,
        places,
        count: places.length,
        cached: false
      });

    } catch (error) {
      logger.error('Google Places search failed', error);
      res.status(500).json({
        error: 'Failed to search Google Places',
        details: error.message
      });
    }
  }
);

/**
 * GET /api/reviews/google/places/:placeId
 * Get detailed information about a Google Place including reviews
 */
router.get('/places/:placeId',
  [
    param('placeId')
      .notEmpty()
      .withMessage('Place ID is required')
      .isLength({ min: 10, max: 200 })
      .withMessage('Invalid Place ID format'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { placeId } = req.params;

      // Check cache first
      const cacheKey = `google:place:details:${placeId}`;
      const cached = await cacheUtils.get(cacheKey);
      
      if (cached) {
        logger.info('Google Place details served from cache', { placeId });
        return res.json({
          success: true,
          place: cached,
          cached: true
        });
      }

      const placeDetails = await googleReviewsClient.getPlaceDetails(placeId);

      // Cache results for 2 hours (reviews change less frequently)
      await cacheUtils.set(cacheKey, placeDetails, 7200);

      res.json({
        success: true,
        place: placeDetails,
        reviewsCount: placeDetails.reviews?.length || 0,
        cached: false
      });

    } catch (error) {
      logger.error('Failed to get Google Place details', error);
      res.status(500).json({
        error: 'Failed to get place details',
        details: error.message
      });
    }
  }
);

/**
 * POST /api/reviews/google/import/places
 * Import reviews from a Google Place
 */
router.post('/import/places',
  auth,
  [
    body('placeId')
      .notEmpty()
      .withMessage('Place ID is required')
      .isLength({ min: 10, max: 200 })
      .withMessage('Invalid Place ID format'),
    body('listingId')
      .optional()
      .isUUID()
      .withMessage('Listing ID must be a valid UUID'),
    body('autoApprove')
      .optional()
      .isBoolean()
      .withMessage('Auto approve must be a boolean'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { placeId, listingId, autoApprove = false } = req.body;
      const importedBy = req.user?.id || 'system';

      logger.info('Starting Google Places reviews import', { 
        placeId, 
        listingId, 
        autoApprove,
        importedBy 
      });

      // Get place details with reviews
      const placeDetails = await googleReviewsClient.getPlaceDetails(placeId);
      
      if (!placeDetails.reviews || placeDetails.reviews.length === 0) {
        return res.json({
          success: true,
          message: 'No reviews found for this place',
          imported: 0,
          errors: []
        });
      }

      // Verify listing exists if provided
      if (listingId) {
        const listing = await listingService.getById(listingId);
        if (!listing) {
          return res.status(400).json({
            error: 'Listing not found',
            listingId
          });
        }
      }

      const importResults = {
        imported: 0,
        skipped: 0,
        errors: [] as Array<{ review: any; error: string }>
      };

      // Process each review
      for (const googleReview of placeDetails.reviews) {
        try {
          // Normalize the review
          const normalizedReview = googleReviewsClient.normalizeGooglePlacesReview(
            googleReview,
            placeId,
            listingId
          );

          // Check if review already exists
          const existingReview = await reviewService.getByExternalId(normalizedReview.externalId!);
          if (existingReview) {
            importResults.skipped++;
            continue;
          }

          // Create the review
          const createdReview = await reviewService.create({
            ...normalizedReview,
            status: autoApprove ? 'approved' : 'pending'
          });

          // Create audit log entry
          await reviewService.createAuditLogEntry({
            reviewId: createdReview.id,
            action: 'imported',
            performedBy: importedBy,
            notes: `Imported from Google Places (Place ID: ${placeId})`
          });

          // Auto-approve if requested
          if (autoApprove) {
            await reviewService.createAuditLogEntry({
              reviewId: createdReview.id,
              action: 'approved',
              performedBy: importedBy,
              notes: 'Auto-approved during Google Places import'
            });
          }

          importResults.imported++;

        } catch (error) {
          logger.error('Failed to import Google review', {
            error: error.message,
            googleReview: {
              author: googleReview.author_name,
              rating: googleReview.rating,
              time: googleReview.time
            }
          });

          importResults.errors.push({
            review: {
              author: googleReview.author_name,
              rating: googleReview.rating,
              time: googleReview.time
            },
            error: error.message
          });
        }
      }

      // Clear relevant caches using SCAN-based pattern deletion
      await clearByPattern(`reviews:*`);
      if (listingId) {
        await clearByPattern(`listing:${listingId}:reviews:*`);
      }

      logger.info('Google Places reviews import completed', {
        placeId,
        listingId,
        ...importResults
      });

      res.json({
        success: true,
        place: {
          id: placeId,
          name: placeDetails.name,
          address: placeDetails.formatted_address
        },
        ...importResults
      });

    } catch (error) {
      logger.error('Google Places reviews import failed', error);
      res.status(500).json({
        error: 'Failed to import Google Places reviews',
        details: error.message
      });
    }
  }
);

/**
 * GET /api/reviews/google/business/:locationName/reviews
 * Get reviews using Business Profile API (requires business verification)
 */
router.get('/business/:locationName/reviews',
  auth,
  [
    param('locationName')
      .notEmpty()
      .withMessage('Location name is required')
      .isLength({ min: 10, max: 500 })
      .withMessage('Invalid location name format'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { locationName } = req.params;

      // Check cache first
      const cacheKey = `google:business:reviews:${locationName}`;
      const cached = await cacheUtils.get(cacheKey);
      
      if (cached) {
        logger.info('Google Business reviews served from cache', { locationName });
        return res.json({
          success: true,
          reviews: cached,
          cached: true
        });
      }

      const reviews = await googleReviewsClient.getBusinessReviews(locationName);

      // Cache results for 1 hour
      await cacheUtils.set(cacheKey, reviews, 3600);

      res.json({
        success: true,
        reviews,
        count: reviews.length,
        cached: false
      });

    } catch (error) {
      logger.error('Failed to get Google Business reviews', error);
      
      if (error.message.includes('access denied')) {
        return res.status(403).json({
          error: 'Business Profile API access denied',
          details: 'Ensure your business is verified and you have proper permissions'
        });
      }

      res.status(500).json({
        error: 'Failed to get business reviews',
        details: error.message
      });
    }
  }
);

/**
 * POST /api/reviews/google/import/business
 * Import reviews from Google Business Profile
 */
router.post('/import/business',
  auth,
  [
    body('locationName')
      .notEmpty()
      .withMessage('Location name is required')
      .isLength({ min: 10, max: 500 })
      .withMessage('Invalid location name format'),
    body('listingId')
      .optional()
      .isUUID()
      .withMessage('Listing ID must be a valid UUID'),
    body('autoApprove')
      .optional()
      .isBoolean()
      .withMessage('Auto approve must be a boolean'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { locationName, listingId, autoApprove = false } = req.body;
      const importedBy = req.user?.id || 'system';

      logger.info('Starting Google Business reviews import', { 
        locationName, 
        listingId, 
        autoApprove,
        importedBy 
      });

      // Get business reviews
      const businessReviews = await googleReviewsClient.getBusinessReviews(locationName);
      
      if (businessReviews.length === 0) {
        return res.json({
          success: true,
          message: 'No reviews found for this business location',
          imported: 0,
          errors: []
        });
      }

      // Verify listing exists if provided
      if (listingId) {
        const listing = await listingService.getById(listingId);
        if (!listing) {
          return res.status(400).json({
            error: 'Listing not found',
            listingId
          });
        }
      }

      const importResults = {
        imported: 0,
        skipped: 0,
        errors: [] as Array<{ review: any; error: string }>
      };

      // Process each review
      for (const businessReview of businessReviews) {
        try {
          // Normalize the review
          const normalizedReview = googleReviewsClient.normalizeBusinessReview(
            businessReview,
            locationName,
            listingId
          );

          // Check if review already exists
          const existingReview = await reviewService.getByExternalId(normalizedReview.externalId!);
          if (existingReview) {
            importResults.skipped++;
            continue;
          }

          // Create the review
          const createdReview = await reviewService.create({
            ...normalizedReview,
            status: autoApprove ? 'approved' : 'pending'
          });

          // Create audit log entry
          await reviewService.createAuditLogEntry({
            reviewId: createdReview.id,
            action: 'imported',
            performedBy: importedBy,
            notes: `Imported from Google Business Profile (Location: ${locationName})`
          });

          // Auto-approve if requested
          if (autoApprove) {
            await reviewService.createAuditLogEntry({
              reviewId: createdReview.id,
              action: 'approved',
              performedBy: importedBy,
              notes: 'Auto-approved during Google Business import'
            });
          }

          importResults.imported++;

        } catch (error) {
          logger.error('Failed to import Google Business review', {
            error: error.message,
            businessReview: {
              name: businessReview.name,
              reviewer: businessReview.reviewer.displayName,
              starRating: businessReview.starRating
            }
          });

          importResults.errors.push({
            review: {
              name: businessReview.name,
              reviewer: businessReview.reviewer.displayName,
              starRating: businessReview.starRating
            },
            error: error.message
          });
        }
      }

      // Clear relevant caches using SCAN-based pattern deletion
      await clearByPattern(`reviews:*`);
      if (listingId) {
        await clearByPattern(`listing:${listingId}:reviews:*`);
      }

      logger.info('Google Business reviews import completed', {
        locationName,
        listingId,
        ...importResults
      });

      res.json({
        success: true,
        business: {
          locationName
        },
        ...importResults
      });

    } catch (error) {
      logger.error('Google Business reviews import failed', error);
      res.status(500).json({
        error: 'Failed to import Google Business reviews',
        details: error.message
      });
    }
  }
);

/**
 * GET /api/reviews/google/health
 * Check Google APIs health and quota status
 */
router.get('/health',
  auth,
  async (req, res) => {
    try {
      const [apiHealth, usageStats] = await Promise.all([
        googleReviewsClient.checkApiHealth(),
        googleReviewsClient.getUsageStats()
      ]);

      res.json({
        success: true,
        apis: apiHealth,
        usage: usageStats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Google APIs health check failed', error);
      res.status(500).json({
        error: 'Failed to check Google APIs health',
        details: error.message
      });
    }
  }
);

/**
 * POST /api/reviews/google/test-connection
 * Test Google APIs connection
 */
router.post('/test-connection',
  auth,
  async (req, res) => {
    try {
      logger.info('Testing Google APIs connection');

      // Test Places API with a simple search
      const testPlaces = await googleReviewsClient.searchPlaces('test hotel');
      
      // Get usage stats
      const usageStats = googleReviewsClient.getUsageStats();

      res.json({
        success: true,
        message: 'Google APIs connection successful',
        testResults: {
          placesApi: {
            working: true,
            testResultsCount: testPlaces.length
          }
        },
        usage: usageStats
      });

    } catch (error) {
      logger.error('Google APIs connection test failed', error);
      res.status(500).json({
        success: false,
        error: 'Google APIs connection test failed',
        details: error.message
      });
    }
  }
);

export default router;

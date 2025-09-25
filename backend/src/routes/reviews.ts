/**
 * Review management routes - Simplified for testing
 */

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';

const router = Router();

/**
 * GET /api/reviews
 * Simple test endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    logger.info('Reviews endpoint accessed');
    res.json({
      success: true,
      message: 'Reviews endpoint working',
      data: [],
      total: 0
    });
  } catch (error) {
    logger.error('Reviews endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/reviews/stats
 * Simple stats endpoint
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      stats: {
        totalReviews: 0,
        approvedReviews: 0,
        averageRating: 0
      }
    });
  } catch (error) {
    logger.error('Stats endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
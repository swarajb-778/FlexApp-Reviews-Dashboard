/**
 * Zod validation schemas for all review-related API inputs and outputs
 * Provides runtime type validation and automatic TypeScript type inference
 */

import { z } from 'zod';
import { ReviewChannel, ReviewType, ReviewStatus } from '../types/reviews';

// Base validation schemas
export const reviewChannelSchema = z.enum([
  'booking.com',
  'airbnb', 
  'google',
  'direct',
  'vrbo',
  'other'
] as const);

export const reviewTypeSchema = z.enum([
  'guest_review',
  'host_review',
  'auto_review',
  'system_review'
] as const);

export const reviewStatusSchema = z.enum([
  'approved',
  'pending',
  'rejected'
] as const);

// Date validation helpers
const isoDateSchema = z.string().refine(
  (date) => {
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    return isoRegex.test(date) && !isNaN(Date.parse(date));
  },
  { message: 'Must be a valid ISO 8601 date string' }
);

const flexibleDateSchema = z.string().refine(
  (date) => !isNaN(Date.parse(date)),
  { message: 'Must be a valid date string' }
);

// Rating validation
const ratingSchema = z.number().min(0).max(10);
const optionalRatingSchema = ratingSchema.optional();

// Query parameters validation
export const reviewsQueryParamsSchema = z.object({
  listingId: z.coerce.number().int().positive().optional(),
  listing_id: z.coerce.number().int().positive().optional(), // Support both naming conventions
  from: flexibleDateSchema.optional(),
  to: flexibleDateSchema.optional(),
  channel: reviewChannelSchema.optional(),
  approved: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  reviewType: reviewTypeSchema.optional(),
  guestName: z.string().min(1).max(255).optional(),
  minRating: z.coerce.number().min(0).max(10).optional(),
  maxRating: z.coerce.number().min(0).max(10).optional(),
  hasResponse: z.coerce.boolean().optional()
}).refine(
  (data) => {
    if (data.from && data.to) {
      return new Date(data.from) <= new Date(data.to);
    }
    return true;
  },
  {
    message: 'From date must be before or equal to to date',
    path: ['from']
  }
).refine(
  (data) => {
    if (data.minRating !== undefined && data.maxRating !== undefined) {
      return data.minRating <= data.maxRating;
    }
    return true;
  },
  {
    message: 'Minimum rating must be less than or equal to maximum rating',
    path: ['minRating']
  }
);

// Raw Hostaway API response validation
export const hostawayReviewCategorySchema = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  rating: ratingSchema,
  max_rating: ratingSchema
});

export const hostawayReviewRawSchema = z.object({
  id: z.number().int(),
  listingId: z.number().int(),
  guestName: z.string().min(1).max(255),
  comment: z.string().max(5000),
  rating: optionalRatingSchema,
  reviewCategories: z.array(hostawayReviewCategorySchema).optional(),
  createdAt: flexibleDateSchema,
  updatedAt: flexibleDateSchema,
  checkInDate: flexibleDateSchema.optional(),
  checkOutDate: flexibleDateSchema.optional(),
  reviewType: z.string().min(1),
  channel: z.string().min(1),
  approved: z.boolean(),
  response: z.string().max(5000).optional(),
  responseDate: flexibleDateSchema.optional(),
  guestId: z.number().int().optional(),
  reservationId: z.number().int().optional(),
  language: z.string().length(2).optional(), // ISO 639-1 language code
  source: z.string().optional()
}).refine(
  (data) => {
    if (data.checkInDate && data.checkOutDate) {
      return new Date(data.checkInDate) <= new Date(data.checkOutDate);
    }
    return true;
  },
  {
    message: 'Check-in date must be before or equal to check-out date',
    path: ['checkInDate']
  }
).refine(
  (data) => {
    // If no direct rating, must have categories to calculate from
    if (data.rating === undefined && (!data.reviewCategories || data.reviewCategories.length === 0)) {
      return false;
    }
    return true;
  },
  {
    message: 'Review must have either a direct rating or review categories to calculate rating from',
    path: ['rating']
  }
);

export const hostawayApiResponseSchema = z.object({
  status: z.enum(['success', 'error']),
  result: z.array(hostawayReviewRawSchema),
  count: z.number().int().min(0),
  limit: z.number().int().min(1),
  page: z.number().int().min(1),
  total: z.number().int().min(0),
  message: z.string().optional()
}).refine(
  (data) => data.result.length === data.count,
  {
    message: 'Result array length must match count',
    path: ['count']
  }
);

// Normalized review validation
export const normalizedReviewCategorySchema = z.record(z.string(), ratingSchema);

export const normalizedReviewSchema = z.object({
  id: z.number().int(),
  listingId: z.number().int(),
  guestName: z.string().min(1).max(255),
  comment: z.string().max(5000),
  rating: ratingSchema,
  categories: normalizedReviewCategorySchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  checkInDate: isoDateSchema.optional(),
  checkOutDate: isoDateSchema.optional(),
  reviewType: reviewTypeSchema,
  channel: reviewChannelSchema,
  approved: z.boolean(),
  response: z.string().max(5000).optional(),
  responseDate: isoDateSchema.optional(),
  guestId: z.number().int().optional(),
  reservationId: z.number().int().optional(),
  language: z.string().length(2).optional(),
  source: z.string().optional(),
  rawJson: hostawayReviewRawSchema
});

// API response validation
export const paginationSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  hasNext: z.boolean(),
  hasPrev: z.boolean()
});

export const filtersSchema = z.object({
  listingId: z.number().int().optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  channel: reviewChannelSchema.optional(),
  approved: z.boolean().optional(),
  reviewType: reviewTypeSchema.optional()
});

export const metaSchema = z.object({
  cached: z.boolean(),
  cacheKey: z.string().optional(),
  processedAt: isoDateSchema,
  source: z.enum(['hostaway', 'mock', 'database'])
});

export const reviewsApiResponseSchema = z.object({
  status: z.enum(['success', 'error']),
  data: z.object({
    reviews: z.array(normalizedReviewSchema),
    pagination: paginationSchema,
    filters: filtersSchema,
    meta: metaSchema
  }),
  message: z.string().optional()
});

export const errorResponseSchema = z.object({
  status: z.literal('error'),
  message: z.string().min(1),
  code: z.string().optional(),
  details: z.any().optional()
});

// Cache validation schemas
export const cacheMetadataSchema = z.object({
  key: z.string().min(1),
  ttl: z.number().int().min(0),
  createdAt: isoDateSchema,
  source: z.enum(['hostaway', 'mock', 'database']),
  queryParams: reviewsQueryParamsSchema
});

export const cacheOptionsSchema = z.object({
  ttl: z.number().int().min(0).max(3600).optional(), // Max 1 hour TTL
  invalidatePattern: z.string().optional(),
  refreshThreshold: z.number().min(0).max(1).optional() // Percentage as decimal
});

// Configuration validation schemas
export const hostawayConfigSchema = z.object({
  accountId: z.string().optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().url(),
  timeout: z.number().int().min(1000).max(60000), // 1s to 60s
  retries: z.number().int().min(0).max(5),
  mockMode: z.boolean(),
  authScope: z.string().optional()
});

export const cacheConfigSchema = z.object({
  ttl: z.number().int().min(60).max(3600), // 1 minute to 1 hour
  keyPrefix: z.string().min(1),
  enabled: z.boolean(),
  refreshThreshold: z.number().min(0).max(1)
});

export const mockDataConfigSchema = z.object({
  enabled: z.boolean(),
  filePath: z.string().min(1),
  fallbackOnError: z.boolean(),
  simulateLatency: z.boolean(),
  latencyMs: z.number().int().min(0).max(5000)
});

// Normalization options validation
export const normalizationOptionsSchema = z.object({
  strict: z.boolean().optional(),
  includeInvalid: z.boolean().optional(),
  defaultRating: ratingSchema.optional(),
  timezone: z.string().optional()
});

// Performance and metrics validation
export const apiMetricsSchema = z.object({
  requestCount: z.number().int().min(0),
  cacheHits: z.number().int().min(0),
  cacheMisses: z.number().int().min(0),
  errorCount: z.number().int().min(0),
  averageResponseTime: z.number().min(0),
  hostawayApiCalls: z.number().int().min(0),
  mockDataUsage: z.number().int().min(0)
});

export const performanceMetricsSchema = z.object({
  normalizationTimeMs: z.number().min(0),
  cacheOperationTimeMs: z.number().min(0),
  apiCallTimeMs: z.number().min(0),
  totalRequestTimeMs: z.number().min(0)
});

// Validation result schemas
export const validationErrorSchema = z.object({
  field: z.string().min(1),
  message: z.string().min(1),
  value: z.any(),
  code: z.string().min(1)
});

export const validationWarningSchema = z.object({
  field: z.string().min(1),
  message: z.string().min(1),
  value: z.any(),
  suggestion: z.string().optional()
});

export const validationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(validationErrorSchema),
  warnings: z.array(validationWarningSchema)
});

// Utility functions for validation
export const validateQueryParams = (params: unknown) => {
  return reviewsQueryParamsSchema.safeParse(params);
};

export const validateHostawayResponse = (response: unknown) => {
  return hostawayApiResponseSchema.safeParse(response);
};

export const validateNormalizedReview = (review: unknown) => {
  return normalizedReviewSchema.safeParse(review);
};

export const validateApiResponse = (response: unknown) => {
  return reviewsApiResponseSchema.safeParse(response);
};

// Type inference helpers
export type ReviewsQueryParams = z.infer<typeof reviewsQueryParamsSchema>;
export type HostawayReviewRaw = z.infer<typeof hostawayReviewRawSchema>;
export type HostawayApiResponse = z.infer<typeof hostawayApiResponseSchema>;
export type NormalizedReview = z.infer<typeof normalizedReviewSchema>;
export type ReviewsApiResponse = z.infer<typeof reviewsApiResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type CacheMetadata = z.infer<typeof cacheMetadataSchema>;
export type CacheOptions = z.infer<typeof cacheOptionsSchema>;
export type HostawayConfig = z.infer<typeof hostawayConfigSchema>;
export type CacheConfig = z.infer<typeof cacheConfigSchema>;
export type MockDataConfig = z.infer<typeof mockDataConfigSchema>;
export type NormalizationOptions = z.infer<typeof normalizationOptionsSchema>;
export type ApiMetrics = z.infer<typeof apiMetricsSchema>;
export type PerformanceMetrics = z.infer<typeof performanceMetricsSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;

// Review management API schemas
export const reviewUpdateSchema = z.object({
  approved: z.boolean().optional(),
  response: z.string().max(5000).optional(),
  publicReview: z.string().max(5000).optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  {
    message: 'At least one field must be provided for update'
  }
);

export const reviewApprovalSchema = z.object({
  approved: z.boolean(),
  response: z.string().max(5000).optional()
}).refine(
  (data) => {
    if (data.approved && data.response && data.response.trim().length === 0) {
      return false;
    }
    return true;
  },
  {
    message: 'Response cannot be empty when provided',
    path: ['response']
  }
);

export const reviewSortSchema = z.enum([
  'rating',
  'submittedAt', 
  'createdAt',
  'guestName',
  'channel'
] as const);

export const reviewFilterSchema = z.object({
  listingId: z.coerce.number().int().positive().optional(),
  approved: z.coerce.boolean().optional(),
  channel: reviewChannelSchema.optional(),
  reviewType: reviewTypeSchema.optional(),
  minRating: z.coerce.number().min(0).max(10).optional(),
  maxRating: z.coerce.number().min(0).max(10).optional(),
  from: flexibleDateSchema.optional(),
  to: flexibleDateSchema.optional(),
  guestName: z.string().min(1).max(255).optional(),
  hasResponse: z.coerce.boolean().optional(),
  sortBy: reviewSortSchema.optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
}).refine(
  (data) => {
    if (data.from && data.to) {
      return new Date(data.from) <= new Date(data.to);
    }
    return true;
  },
  {
    message: 'From date must be before or equal to to date',
    path: ['from']
  }
).refine(
  (data) => {
    if (data.minRating !== undefined && data.maxRating !== undefined) {
      return data.minRating <= data.maxRating;
    }
    return true;
  },
  {
    message: 'Minimum rating must be less than or equal to maximum rating',
    path: ['minRating']
  }
);

export const listingQueryParamsSchema = z.object({
  includeStats: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().min(1).max(255).optional(),
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).optional(),
  sortBy: z.enum(['name', 'createdAt', 'reviewCount', 'averageRating']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
});

export const bulkUpdateReviewsSchema = z.object({
  reviewIds: z.array(z.string().cuid()).min(1).max(100),
  approved: z.boolean(),
  response: z.string().max(5000).optional()
});

// Base schema without refinements for use with pick()
const reviewManagementQueryBaseSchema = z.object({
  listingId: z.coerce.number().int().positive().optional(),
  approved: z.coerce.boolean().optional(),
  channel: reviewChannelSchema.optional(),
  reviewType: reviewTypeSchema.optional(),
  minRating: z.coerce.number().min(0).max(10).optional(),
  maxRating: z.coerce.number().min(0).max(10).optional(),
  from: flexibleDateSchema.optional(),
  to: flexibleDateSchema.optional(),
  guestName: z.string().min(1).max(255).optional(),
  hasResponse: z.coerce.boolean().optional(),
  search: z.string().min(1).max(255).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: reviewSortSchema.default('submittedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Full schema with refinements
export const reviewManagementQuerySchema = reviewManagementQueryBaseSchema.refine(
  (data) => {
    if (data.from && data.to) {
      return new Date(data.from) <= new Date(data.to);
    }
    return true;
  },
  {
    message: 'From date must be before or equal to to date',
    path: ['from']
  }
).refine(
  (data) => {
    if (data.minRating !== undefined && data.maxRating !== undefined) {
      return data.minRating <= data.maxRating;
    }
    return true;
  },
  {
    message: 'Minimum rating must be less than or equal to maximum rating',
    path: ['minRating']
  }
);

// Export base schema for use with pick()
export const reviewManagementQueryBaseSchema_exported = reviewManagementQueryBaseSchema;

// Additional utility validation functions
export const validateReviewUpdate = (data: unknown) => {
  return reviewUpdateSchema.safeParse(data);
};

export const validateReviewApproval = (data: unknown) => {
  return reviewApprovalSchema.safeParse(data);
};

export const validateListingQuery = (params: unknown) => {
  return listingQueryParamsSchema.safeParse(params);
};

export const validateReviewManagementQuery = (params: unknown) => {
  return reviewManagementQuerySchema.safeParse(params);
};

export const validateBulkUpdate = (data: unknown) => {
  return bulkUpdateReviewsSchema.safeParse(data);
};

// Type inference for new schemas
export type ReviewUpdateData = z.infer<typeof reviewUpdateSchema>;
export type ReviewApprovalRequest = z.infer<typeof reviewApprovalSchema>;
export type ReviewSortField = z.infer<typeof reviewSortSchema>;
export type ReviewFilterOptions = z.infer<typeof reviewFilterSchema>;
export type ListingQueryParams = z.infer<typeof listingQueryParamsSchema>;
export type BulkUpdateRequest = z.infer<typeof bulkUpdateReviewsSchema>;
export type ReviewManagementQuery = z.infer<typeof reviewManagementQuerySchema>;

// Export commonly used validation functions
export {
  validateQueryParams,
  validateHostawayResponse,
  validateNormalizedReview,
  validateApiResponse,
  validateReviewUpdate,
  validateReviewApproval,
  validateListingQuery,
  validateReviewManagementQuery,
  validateBulkUpdate
};

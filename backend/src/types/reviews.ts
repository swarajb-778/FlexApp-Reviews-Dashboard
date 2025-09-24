/**
 * TypeScript type definitions for the reviews domain
 * Comprehensive interfaces for Hostaway API responses, normalized review objects,
 * query parameters, API responses, and related types.
 */

// Base types for reviews
export type ReviewChannel = 'booking.com' | 'airbnb' | 'google' | 'direct' | 'vrbo' | 'other';
export type ReviewType = 'guest_review' | 'host_review' | 'auto_review' | 'system_review';
export type ReviewStatus = 'approved' | 'pending' | 'rejected';

// Raw Hostaway API response structures
export interface HostawayReviewCategory {
  id: number;
  name: string;
  rating: number;
  max_rating: number;
}

export interface HostawayReviewRaw {
  id: number;
  listingId: number;
  guestName: string;
  comment: string;
  rating?: number;
  reviewCategories?: HostawayReviewCategory[];
  createdAt: string;
  updatedAt: string;
  checkInDate?: string;
  checkOutDate?: string;
  reviewType: string;
  channel: string;
  approved: boolean;
  response?: string;
  responseDate?: string;
  guestId?: number;
  reservationId?: number;
  language?: string;
  source?: string;
}

export interface HostawayApiResponse {
  status: 'success' | 'error';
  result: HostawayReviewRaw[];
  count: number;
  limit: number;
  page: number;
  total: number;
  message?: string;
}

// Normalized review objects for consistent API responses
export interface NormalizedReviewCategory {
  [key: string]: number;
}

export interface NormalizedReview {
  id: number;
  listingId: number;
  guestName: string;
  comment: string;
  rating: number;
  categories: NormalizedReviewCategory;
  createdAt: string; // ISO 8601 UTC format
  updatedAt: string; // ISO 8601 UTC format
  checkInDate?: string; // ISO 8601 UTC format
  checkOutDate?: string; // ISO 8601 UTC format
  reviewType: ReviewType;
  channel: ReviewChannel;
  approved: boolean;
  response?: string;
  responseDate?: string; // ISO 8601 UTC format
  guestId?: number;
  reservationId?: number;
  language?: string;
  source?: string;
  rawJson: HostawayReviewRaw; // Preserve original data for audit
}

// API query parameters
export interface ReviewsQueryParams {
  listingId?: number;
  from?: string; // Date string
  to?: string; // Date string
  channel?: ReviewChannel;
  approved?: boolean;
  page?: number;
  limit?: number;
  reviewType?: ReviewType;
  guestName?: string;
  minRating?: number;
  maxRating?: number;
  hasResponse?: boolean;
}

// API response structures
export interface ReviewsApiResponse {
  status: 'success' | 'error';
  data: {
    reviews: NormalizedReview[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    filters: {
      listingId?: number;
      from?: string;
      to?: string;
      channel?: ReviewChannel;
      approved?: boolean;
      reviewType?: ReviewType;
    };
    meta: {
      cached: boolean;
      cacheKey?: string;
      processedAt: string;
      source: 'hostaway' | 'mock';
    };
  };
  message?: string;
}

export interface ErrorResponse {
  status: 'error';
  message: string;
  code?: string;
  details?: any;
}

// Cache-related types
export interface CacheMetadata {
  key: string;
  ttl: number;
  createdAt: string;
  source: 'hostaway' | 'mock';
  queryParams: ReviewsQueryParams;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds (default: 2-5 minutes)
  invalidatePattern?: string;
  refreshThreshold?: number; // Percentage of TTL to trigger background refresh
}

// Utility types for filtering and pagination
export interface PaginationOptions {
  page: number;
  limit: number;
  offset?: number;
}

export interface FilterOptions {
  listingId?: number;
  dateRange?: {
    from: string;
    to: string;
  };
  channel?: ReviewChannel;
  approved?: boolean;
  reviewType?: ReviewType;
  ratingRange?: {
    min: number;
    max: number;
  };
}

// Normalization service types
export interface NormalizationResult {
  success: boolean;
  data?: NormalizedReview[];
  errors?: string[];
  warnings?: string[];
  processedCount: number;
  skippedCount: number;
}

export interface NormalizationOptions {
  strict?: boolean; // Fail on any validation error
  includeInvalid?: boolean; // Include reviews that fail validation
  defaultRating?: number; // Default rating when none provided and can't calculate
  timezone?: string; // Timezone for date parsing
}

// Service configuration types
export interface HostawayConfig {
  accountId?: string;
  apiKey?: string;
  baseUrl: string;
  timeout: number;
  retries: number;
  mockMode: boolean;
}

export interface CacheConfig {
  ttl: number; // Default TTL in seconds
  keyPrefix: string;
  enabled: boolean;
  refreshThreshold: number;
}

// Mock data types
export interface MockDataConfig {
  enabled: boolean;
  filePath: string;
  fallbackOnError: boolean;
  simulateLatency: boolean;
  latencyMs: number;
}

// Analytics and monitoring types
export interface ApiMetrics {
  requestCount: number;
  cacheHits: number;
  cacheMisses: number;
  errorCount: number;
  averageResponseTime: number;
  hostawayApiCalls: number;
  mockDataUsage: number;
}

export interface PerformanceMetrics {
  normalizationTimeMs: number;
  cacheOperationTimeMs: number;
  apiCallTimeMs: number;
  totalRequestTimeMs: number;
}

// Validation types
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  value: any;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  value: any;
  suggestion?: string;
}

// Review management API types
export interface ReviewUpdateData {
  approved?: boolean;
  response?: string;
  publicReview?: string;
}

export interface ReviewApprovalRequest {
  approved: boolean;
  response?: string;
}

export interface ReviewSortOptions {
  field: 'rating' | 'submittedAt' | 'createdAt' | 'guestName' | 'channel';
  order: 'asc' | 'desc';
}

export interface ReviewFilterOptions {
  listingId?: number;
  approved?: boolean;
  channel?: ReviewChannel;
  reviewType?: ReviewType;
  minRating?: number;
  maxRating?: number;
  from?: string;
  to?: string;
  guestName?: string;
  hasResponse?: boolean;
  search?: string;
}

export interface ListingQueryParams {
  includeStats?: boolean;
  page?: number;
  limit?: number;
  search?: string;
  name?: string;
  slug?: string;
  sortBy?: 'name' | 'createdAt' | 'reviewCount' | 'averageRating';
  sortOrder?: 'asc' | 'desc';
}

export interface ListingWithStats {
  id: string;
  hostawayListingId: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  stats?: {
    totalReviews: number;
    approvedReviews: number;
    averageRating: number;
    ratingBreakdown: {
      [rating: string]: number;
    };
    channelBreakdown: {
      [channel: string]: number;
    };
    lastReviewDate?: string;
  };
}

export interface DatabaseReview {
  id: string;
  hostawayReviewId: string;
  listingId: string;
  reviewType: 'GUEST_REVIEW' | 'HOST_REVIEW';
  channel: 'AIRBNB' | 'VRBO' | 'BOOKING_COM' | 'GOOGLE' | 'DIRECT';
  rating: number;
  publicReview?: string;
  guestName: string;
  submittedAt: Date;
  approved: boolean;
  rawJson?: any;
  createdAt: Date;
  updatedAt: Date;
  listing?: {
    id: string;
    name: string;
    slug: string;
    hostawayListingId: string;
  };
  reviewCategories?: {
    id: string;
    category: 'CLEANLINESS' | 'COMMUNICATION' | 'CHECK_IN' | 'ACCURACY' | 'LOCATION' | 'VALUE' | 'OVERALL';
    rating: number;
  }[];
}

export interface ReviewManagementResponse {
  status: 'success' | 'error';
  data: {
    reviews: DatabaseReview[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    filters: ReviewFilterOptions;
    meta: {
      processedAt: string;
      totalApproved: number;
      totalPending: number;
      totalRejected: number;
      averageRating: number;
      cached?: boolean;
      source?: 'database' | 'hostaway' | 'mock';
    };
  };
  message?: string;
}

export interface ListingResponse {
  status: 'success' | 'error';
  data: {
    listings: ListingWithStats[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    meta: {
      processedAt: string;
      totalListings: number;
    };
  };
  message?: string;
}

export interface AuditLogEntry {
  id: string;
  reviewId: string;
  action: 'APPROVED' | 'UNAPPROVED' | 'UPDATED' | 'CREATED';
  previousValue?: any;
  newValue?: any;
  userId?: string;
  timestamp: string;
  metadata?: {
    ip?: string;
    userAgent?: string;
    source?: string;
  };
}

export interface BulkUpdateRequest {
  reviewIds: string[];
  approved: boolean;
  response?: string;
}

export interface BulkUpdateResult {
  success: boolean;
  updated: number;
  failed: number;
  errors?: {
    reviewId: string;
    error: string;
  }[];
}

export interface ReviewStats {
  totalReviews: number;
  approvedReviews: number;
  pendingReviews: number;
  rejectedReviews: number;
  averageRating: number;
  ratingDistribution: {
    [key: string]: number;
  };
  channelDistribution: {
    [key: string]: number;
  };
  monthlyTrends: {
    month: string;
    count: number;
    averageRating: number;
  }[];
}

export interface ServiceOptions {
  includeCategories?: boolean;
  includeListing?: boolean;
  useCache?: boolean;
  cacheTimeout?: number;
}

// Export all types for easy importing
export type {
  // Core review types
  ReviewChannel,
  ReviewType,  
  ReviewStatus,
  
  // Hostaway types
  HostawayReviewCategory,
  HostawayReviewRaw,
  HostawayApiResponse,
  
  // Normalized types
  NormalizedReviewCategory,
  NormalizedReview,
  
  // API types
  ReviewsQueryParams,
  ReviewsApiResponse,
  ErrorResponse,
  
  // Cache types
  CacheMetadata,
  CacheOptions,
  
  // Utility types
  PaginationOptions,
  FilterOptions,
  NormalizationResult,
  NormalizationOptions,
  
  // Config types
  HostawayConfig,
  CacheConfig,
  MockDataConfig,
  
  // Metrics types
  ApiMetrics,
  PerformanceMetrics,
  
  // Validation types
  ValidationResult,
  ValidationError,
  ValidationWarning,

  // Review management types
  ReviewUpdateData,
  ReviewApprovalRequest,
  ReviewSortOptions,
  ReviewFilterOptions,
  ListingQueryParams,
  ListingWithStats,
  DatabaseReview,
  ReviewManagementResponse,
  ListingResponse,
  AuditLogEntry,
  BulkUpdateRequest,
  BulkUpdateResult,
  ReviewStats,
  ServiceOptions
};

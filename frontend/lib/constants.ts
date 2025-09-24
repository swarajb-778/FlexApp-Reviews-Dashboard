// API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'

export const API_ENDPOINTS = {
  // Reviews
  REVIEWS: '/api/reviews',
  REVIEWS_HOSTAWAY: '/api/reviews/hostaway',
  REVIEW_APPROVE: (id: string) => `/api/reviews/${id}/approve`,
  REVIEW_BULK_APPROVE: '/api/reviews/bulk-approve',
  REVIEW_STATS: '/api/reviews/stats',
  
  // Listings  
  LISTINGS: '/api/listings',
  LISTING_BY_ID: (id: string) => `/api/listings/${id}`,
  LISTING_BY_SLUG: (slug: string) => `/api/listings/slug/${slug}`,
  LISTING_STATS: '/api/listings/stats',
  
  // Health
  HEALTH: '/api/health',
} as const

// App Configuration
export const APP_CONFIG = {
  NAME: 'FlexApp',
  DESCRIPTION: 'Modern reviews management dashboard for property managers',
  VERSION: '1.0.0',
  AUTHOR: 'FlexLiving',
  GITHUB_URL: 'https://github.com/flexliving/flexapp',
} as const

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [5, 10, 20, 50, 100],
  MAX_PAGE_SIZE: 100,
} as const

// Review Configuration
export const REVIEW_CONFIG = {
  MIN_RATING: 1,
  MAX_RATING: 5,
  RATING_STEPS: 0.1,
  DEFAULT_RATING: 5,
  CATEGORIES: [
    'accuracy',
    'location', 
    'communication',
    'checkin',
    'cleanliness',
    'value'
  ],
  CATEGORY_LABELS: {
    accuracy: 'Accuracy',
    location: 'Location',
    communication: 'Communication', 
    checkin: 'Check-in',
    cleanliness: 'Cleanliness',
    value: 'Value'
  },
  APPROVAL_STATUSES: {
    PENDING: null,
    APPROVED: true,
    REJECTED: false,
  },
  STATUS_LABELS: {
    [null as any]: 'Pending',
    [true as any]: 'Approved', 
    [false as any]: 'Rejected',
  },
} as const

// Theme Configuration
export const THEME_CONFIG = {
  DEFAULT_THEME: 'system' as const,
  STORAGE_KEY: 'flexapp-theme',
  THEMES: ['light', 'dark', 'system'] as const,
} as const

// Animation Durations (in milliseconds)
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
  EXTRA_SLOW: 1000,
} as const

// Debounce Delays (in milliseconds)
export const DEBOUNCE_DELAY = {
  SEARCH: 300,
  FILTER: 500,
  AUTO_SAVE: 1000,
} as const

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  DISPLAY_WITH_TIME: 'MMM dd, yyyy HH:mm',
  INPUT: 'yyyy-MM-dd',
  INPUT_WITH_TIME: 'yyyy-MM-dd HH:mm',
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
  RELATIVE_TIME: 'relative', // Special case for formatDistanceToNow
} as const

// File Upload
export const FILE_UPLOAD = {
  MAX_SIZE_MB: 10,
  MAX_SIZE_BYTES: 10 * 1024 * 1024,
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'],
} as const

// Toast Configuration
export const TOAST_CONFIG = {
  DEFAULT_DURATION: 5000,
  ERROR_DURATION: 7000,
  SUCCESS_DURATION: 3000,
  MAX_TOASTS: 3,
} as const

// Table Configuration
export const TABLE_CONFIG = {
  DEFAULT_SORT: {
    key: 'created_at',
    direction: 'desc',
  },
  SORTABLE_COLUMNS: [
    'created_at',
    'updated_at',
    'submission_date', 
    'overall_rating',
    'guest_name',
    'listing_name',
    'channel_name',
  ],
} as const

// Form Validation
export const VALIDATION = {
  REVIEW_TEXT_MIN_LENGTH: 10,
  REVIEW_TEXT_MAX_LENGTH: 2000,
  GUEST_NAME_MAX_LENGTH: 100,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^[\+]?[\d\s\-\(\)]{8,}$/,
} as const

// Filter Options
export const FILTER_OPTIONS = {
  APPROVAL_STATUS: [
    { label: 'All Reviews', value: 'all' },
    { label: 'Pending Approval', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
  ],
  RATING_RANGES: [
    { label: 'All Ratings', value: null },
    { label: '5 Stars', value: 5 },
    { label: '4+ Stars', value: 4 },
    { label: '3+ Stars', value: 3 },
    { label: '2+ Stars', value: 2 },
    { label: '1+ Stars', value: 1 },
  ],
  DATE_RANGES: [
    { label: 'All Time', value: null },
    { label: 'Last 7 days', value: 7 },
    { label: 'Last 30 days', value: 30 },
    { label: 'Last 90 days', value: 90 },
    { label: 'Last 6 months', value: 180 },
    { label: 'Last year', value: 365 },
  ],
} as const

// Channel Information (common booking platforms)
export const CHANNELS = {
  AIRBNB: { name: 'Airbnb', id: 2001, color: '#FF5A5F' },
  BOOKING: { name: 'Booking.com', id: 2002, color: '#003580' },
  VRBO: { name: 'VRBO', id: 2003, color: '#1E3A8A' }, 
  EXPEDIA: { name: 'Expedia', id: 2004, color: '#FFD500' },
  DIRECT: { name: 'Direct Booking', id: 1000, color: '#10B981' },
} as const

// Property Types
export const PROPERTY_TYPES = [
  'Apartment',
  'House', 
  'Villa',
  'Condo',
  'Studio',
  'Loft',
  'Townhouse',
  'Guesthouse',
  'Hotel Room',
  'Other',
] as const

// Common Amenities
export const AMENITIES = [
  'WiFi',
  'Kitchen',
  'Parking',
  'Pool',
  'Gym',
  'Air Conditioning',
  'Heating',
  'TV',
  'Washer',
  'Dryer',
  'Balcony',
  'Garden',
  'Hot Tub',
  'BBQ',
  'Elevator',
  'Pet Friendly',
  'Smoking Allowed',
  'Wheelchair Accessible',
] as const

// Error Messages
export const ERROR_MESSAGES = {
  GENERIC: 'Something went wrong. Please try again.',
  NETWORK: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'Access denied.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION: 'Please check your input and try again.',
  SERVER_ERROR: 'Internal server error. Please try again later.',
  TIMEOUT: 'Request timed out. Please try again.',
} as const

// Success Messages  
export const SUCCESS_MESSAGES = {
  REVIEW_APPROVED: 'Review approved successfully',
  REVIEW_REJECTED: 'Review rejected successfully',
  BULK_ACTION_COMPLETED: 'Bulk action completed successfully',
  DATA_EXPORTED: 'Data exported successfully',
  CHANGES_SAVED: 'Changes saved successfully',
} as const

// Loading Messages
export const LOADING_MESSAGES = [
  'Loading reviews...',
  'Fetching data...',
  'Please wait...',
  'Almost there...',
  'Getting everything ready...',
] as const

// Empty State Messages
export const EMPTY_STATES = {
  NO_REVIEWS: {
    title: 'No reviews found',
    description: 'No reviews match your current filters. Try adjusting your search criteria.',
  },
  NO_LISTINGS: {
    title: 'No properties found', 
    description: 'No properties match your current filters. Try adjusting your search criteria.',
  },
  NO_RESULTS: {
    title: 'No results',
    description: 'Your search didn\'t return any results. Try different keywords.',
  },
} as const

// Local Storage Keys
export const STORAGE_KEYS = {
  THEME: 'flexapp-theme',
  FILTERS: 'flexapp-filters',
  TABLE_PREFERENCES: 'flexapp-table-preferences',
  SIDEBAR_COLLAPSED: 'flexapp-sidebar-collapsed',
} as const

// Query Keys for React Query
export const QUERY_KEYS = {
  REVIEWS: 'reviews',
  REVIEW_STATS: 'review-stats',
  LISTINGS: 'listings', 
  LISTING_STATS: 'listing-stats',
  LISTING_BY_SLUG: 'listing-by-slug',
  APPROVED_REVIEWS: 'approved-reviews',
} as const

// Cache Configuration
export const CACHE_CONFIG = {
  STALE_TIME: 5 * 60 * 1000, // 5 minutes
  CACHE_TIME: 10 * 60 * 1000, // 10 minutes
  RETRY_COUNT: 3,
  RETRY_DELAY: 1000,
} as const

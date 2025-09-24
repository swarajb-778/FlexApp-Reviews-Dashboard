// Base interfaces matching backend API contracts

export interface Review {
  id: string
  created_at: string
  updated_at: string
  
  // Hostaway fields
  hostaway_review_id?: string
  hostaway_reservation_id?: string
  hostaway_channel_id?: number
  hostaway_listing_id?: string
  
  // Listing information
  listing_id?: string
  listing_name?: string
  listing_address?: string
  
  // Guest information  
  guest_name: string
  guest_email?: string
  guest_avatar?: string
  
  // Review content
  review_text: string
  private_feedback?: string
  reply?: string
  
  // Ratings
  overall_rating: number
  accuracy_rating?: number
  location_rating?: number
  communication_rating?: number
  checkin_rating?: number  
  cleanliness_rating?: number
  value_rating?: number
  
  // Metadata
  channel_name?: string
  check_in_date?: string
  check_out_date?: string
  submission_date: string
  
  // Status
  approved?: boolean | null
  approved_at?: string
  approved_by?: string
  
  // Audit
  created_by?: string
  updated_by?: string
}

export interface Listing {
  id: string
  created_at: string
  updated_at: string
  
  // Hostaway fields
  hostaway_listing_id?: string
  hostaway_channel_id?: number
  
  // Basic info
  name: string
  description?: string
  address?: string
  city?: string
  country?: string
  
  // Property details
  property_type?: string
  bedrooms?: number
  bathrooms?: number
  max_guests?: number
  
  // Media
  images?: string[]
  thumbnail?: string
  
  // Amenities
  amenities?: string[]
  
  // Status
  active: boolean
  
  // Metadata
  slug?: string
  created_by?: string
  updated_by?: string
}

export interface ReviewAuditLog {
  id: string
  review_id: string
  action: 'created' | 'updated' | 'approved' | 'rejected' | 'deleted'
  old_values?: Record<string, any>
  new_values?: Record<string, any>
  performed_by?: string
  performed_at: string
  ip_address?: string
  user_agent?: string
  notes?: string
}

// API Response interfaces
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
  errors?: Record<string, string[]>
}

export interface PaginatedResponse<T = any> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  message?: string
}

// Query parameters
export interface ReviewsQueryParams {
  page?: number
  limit?: number
  approved?: boolean
  rating?: number
  channel?: string
  listing_id?: string
  guest_name?: string
  date_from?: string
  date_to?: string
  sort_by?: 'created_at' | 'updated_at' | 'submission_date' | 'overall_rating'
  sort_order?: 'asc' | 'desc'
  search?: string
}

export interface ListingsQueryParams {
  page?: number
  limit?: number
  active?: boolean
  property_type?: string
  city?: string
  country?: string
  search?: string
  sort_by?: 'created_at' | 'updated_at' | 'name'
  sort_order?: 'asc' | 'desc'
}

// Form interfaces
export interface ReviewFilters {
  status?: 'all' | 'pending' | 'approved' | 'rejected'
  rating?: number
  channel?: string
  dateRange?: [Date | null, Date | null]
  listing?: string
  searchQuery?: string
}

export interface ApproveReviewData {
  approved: boolean
  notes?: string
}

export interface BulkApproveData {
  review_ids: string[]
  approved: boolean
  notes?: string
}

// Statistics interfaces
export interface ReviewStats {
  total: number
  approved: number
  pending: number
  rejected: number
  averageRating: number
  totalThisMonth: number
  approvedThisMonth: number
  pendingThisMonth: number
  ratingBreakdown: {
    five_star: number
    four_star: number
    three_star: number
    two_star: number
    one_star: number
  }
  channelBreakdown: Record<string, number>
  monthlyTrend: {
    month: string
    total: number
    approved: number
    average_rating: number
  }[]
}

export interface ListingStats {
  total: number
  active: number
  inactive: number
  averageRating: number
  totalReviews: number
  propertyTypeBreakdown: Record<string, number>
  cityBreakdown: Record<string, number>
}

// Component props interfaces
export interface ReviewCardProps {
  review: Review
  showActions?: boolean
  onApprove?: (reviewId: string, approved: boolean) => void
  onEdit?: (review: Review) => void
  className?: string
}

export interface ReviewsTableProps {
  reviews?: Review[]
  loading?: boolean
  filters?: ReviewFilters
  onFiltersChange?: (filters: ReviewFilters) => void
  onBulkAction?: (action: 'approve' | 'reject', reviewIds: string[]) => void
  onSort?: (column: string, direction: 'asc' | 'desc') => void
  className?: string
}

export interface FiltersPanelProps {
  filters: ReviewFilters
  onFiltersChange: (filters: ReviewFilters) => void
  onClose?: () => void
  className?: string
}

// Hostaway API interfaces (for reference)
export interface HostawayReview {
  id: string
  reservationId: string
  channelId: number
  listingId: string
  guestName: string
  reviewText: string
  privateFeedback?: string
  overallRating: number
  accuracyRating?: number
  locationRating?: number
  communicationRating?: number
  checkinRating?: number
  cleanlinessRating?: number
  valueRating?: number
  channelName: string
  checkInDate: string
  checkOutDate: string
  submissionDate: string
  listingName: string
  listingAddress: string
}

export interface HostawayListing {
  id: string
  channelId: number
  name: string
  address: string
  city: string
  country: string
  propertyType: string
  bedrooms: number
  bathrooms: number
  maxGuests: number
  amenities: string[]
  images: string[]
  active: boolean
}

// Error types
export interface ApiError {
  message: string
  code?: string
  field?: string
  details?: any
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

// Theme types
export type Theme = 'light' | 'dark' | 'system'

// Navigation types
export interface NavItem {
  label: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
  active?: boolean
  disabled?: boolean
}

// Toast types
export interface ToastData {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
  action?: React.ReactElement
}

// Loading states
export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

// Table sorting
export interface SortConfig {
  key: string
  direction: 'asc' | 'desc'
}

// Utility types
export type Nullable<T> = T | null
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

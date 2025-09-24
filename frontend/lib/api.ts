import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { 
  Review, 
  Listing, 
  ReviewsQueryParams, 
  ListingsQueryParams,
  ApiResponse, 
  PaginatedResponse,
  ApproveReviewData,
  BulkApproveData,
  ReviewStats,
  ListingStats
} from './types'
import { API_BASE_URL, API_ENDPOINTS, ERROR_MESSAGES } from './constants'

/**
 * API Client for backend communication
 */
class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
  }

  /**
   * Setup request and response interceptors
   */
  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add authentication token if available
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }

        // Add request timestamp for caching
        config.metadata = { startTime: Date.now() }
        
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        // Calculate response time
        const responseTime = Date.now() - response.config.metadata?.startTime
        console.log(`API ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status} (${responseTime}ms)`)
        
        return response
      },
      (error) => {
        // Handle common errors
        if (error.response) {
          const { status, data } = error.response
          
          switch (status) {
            case 401:
              // Handle unauthorized
              if (typeof window !== 'undefined') {
                localStorage.removeItem('auth-token')
                window.location.href = '/login'
              }
              break
            case 403:
              error.message = ERROR_MESSAGES.FORBIDDEN
              break
            case 404:
              error.message = ERROR_MESSAGES.NOT_FOUND
              break
            case 422:
              error.message = data.message || ERROR_MESSAGES.VALIDATION
              break
            case 500:
              error.message = ERROR_MESSAGES.SERVER_ERROR
              break
            default:
              error.message = data.message || ERROR_MESSAGES.GENERIC
          }
        } else if (error.request) {
          error.message = ERROR_MESSAGES.NETWORK
        } else {
          error.message = ERROR_MESSAGES.GENERIC
        }

        console.error('API Error:', error)
        return Promise.reject(error)
      }
    )
  }

  /**
   * Generic GET request
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get(url, config)
    return response.data
  }

  /**
   * Generic POST request
   */
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post(url, data, config)
    return response.data
  }

  /**
   * Generic PUT request
   */
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put(url, data, config)
    return response.data
  }

  /**
   * Generic PATCH request
   */
  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch(url, data, config)
    return response.data
  }

  /**
   * Generic DELETE request
   */
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete(url, config)
    return response.data
  }

  // ===== REVIEW ENDPOINTS =====

  /**
   * Fetch reviews with optional query parameters
   */
  async getReviews(params?: ReviewsQueryParams): Promise<PaginatedResponse<Review>> {
    return this.get(API_ENDPOINTS.REVIEWS, { params })
  }

  /**
   * Fetch a single review by ID
   */
  async getReview(id: string): Promise<ApiResponse<Review>> {
    return this.get(`${API_ENDPOINTS.REVIEWS}/${id}`)
  }

  /**
   * Sync reviews from Hostaway
   */
  async syncHostawayReviews(): Promise<ApiResponse<{ imported: number; updated: number }>> {
    return this.post(API_ENDPOINTS.REVIEWS_HOSTAWAY)
  }

  /**
   * Approve or reject a review
   */
  async approveReview(id: string, data: ApproveReviewData): Promise<ApiResponse<Review>> {
    return this.patch(API_ENDPOINTS.REVIEW_APPROVE(id), data)
  }

  /**
   * Bulk approve/reject reviews
   */
  async bulkApproveReviews(data: BulkApproveData): Promise<ApiResponse<{ updated: number }>> {
    return this.post(API_ENDPOINTS.REVIEW_BULK_APPROVE, data)
  }

  /**
   * Get review statistics
   */
  async getReviewStats(): Promise<ApiResponse<ReviewStats>> {
    return this.get(API_ENDPOINTS.REVIEW_STATS)
  }

  /**
   * Get approved reviews for a listing
   */
  async getApprovedReviews(listingId?: string): Promise<PaginatedResponse<Review>> {
    return this.getReviews({ 
      approved: true, 
      listing_id: listingId,
      sort_by: 'submission_date',
      sort_order: 'desc'
    })
  }

  /**
   * Fetch Hostaway reviews in requirement "simple" format for compatibility checks
   */
  async getHostawaySimple(params?: Record<string, any>): Promise<{ status: 'ok'; data: any[] }> {
    const query = { format: 'simple', page: 1, limit: 20, ...(params || {}) }
    return this.get(API_ENDPOINTS.REVIEWS_HOSTAWAY, { params: query })
  }

  // ===== LISTING ENDPOINTS =====

  /**
   * Fetch listings with optional query parameters
   */
  async getListings(params?: ListingsQueryParams): Promise<PaginatedResponse<Listing>> {
    return this.get(API_ENDPOINTS.LISTINGS, { params })
  }

  /**
   * Fetch a single listing by ID
   */
  async getListing(id: string): Promise<ApiResponse<Listing>> {
    return this.get(API_ENDPOINTS.LISTING_BY_ID(id))
  }

  /**
   * Fetch a single listing by slug
   */
  async getListingBySlug(slug: string): Promise<ApiResponse<Listing>> {
    return this.get(API_ENDPOINTS.LISTING_BY_SLUG(slug))
  }

  /**
   * Get listing statistics
   */
  async getListingStats(): Promise<ApiResponse<ListingStats>> {
    return this.get(API_ENDPOINTS.LISTING_STATS)
  }

  // ===== HEALTH CHECK =====

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.get(API_ENDPOINTS.HEALTH)
  }

  // ===== UTILITY METHODS =====

  /**
   * Upload file (generic file upload)
   */
  async uploadFile(file: File, endpoint: string = '/api/upload'): Promise<ApiResponse<{ url: string }>> {
    const formData = new FormData()
    formData.append('file', file)

    return this.post(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  }

  /**
   * Export data (generic export)
   */
  async exportData(endpoint: string, params?: any): Promise<Blob> {
    const response = await this.client.get(endpoint, {
      params,
      responseType: 'blob',
    })
    return response.data
  }

  /**
   * Cancel all pending requests
   */
  cancelAllRequests() {
    // Implementation would depend on request tracking
    console.log('Cancelling all pending requests...')
  }
}

// Create and export a singleton instance
export const apiClient = new ApiClient()

// Export convenience functions
export const api = {
  // Reviews
  getReviews: (params?: ReviewsQueryParams) => apiClient.getReviews(params),
  getReview: (id: string) => apiClient.getReview(id),
  approveReview: (id: string, data: ApproveReviewData) => apiClient.approveReview(id, data),
  bulkApproveReviews: (data: BulkApproveData) => apiClient.bulkApproveReviews(data),
  syncHostawayReviews: () => apiClient.syncHostawayReviews(),
  getReviewStats: () => apiClient.getReviewStats(),
  getApprovedReviews: (listingId?: string) => apiClient.getApprovedReviews(listingId),

  // Listings
  getListings: (params?: ListingsQueryParams) => apiClient.getListings(params),
  getListing: (id: string) => apiClient.getListing(id),
  getListingBySlug: (slug: string) => apiClient.getListingBySlug(slug),
  getListingStats: () => apiClient.getListingStats(),

  // Health
  healthCheck: () => apiClient.healthCheck(),

  // Utility
  uploadFile: (file: File, endpoint?: string) => apiClient.uploadFile(file, endpoint),
  exportData: (endpoint: string, params?: any) => apiClient.exportData(endpoint, params),
}

export default api

// Error handling utility
export const handleApiError = (error: any) => {
  if (error.response?.data?.message) {
    return error.response.data.message
  }
  if (error.message) {
    return error.message
  }
  return ERROR_MESSAGES.GENERIC
}

// Request retry utility
export const retryRequest = async <T>(
  requestFn: () => Promise<T>, 
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: any

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn()
    } catch (error) {
      lastError = error
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)))
      }
    }
  }

  throw lastError
}

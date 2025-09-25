/**
 * Hostaway API client service for fetching review data
 * Handles communication with Hostaway sandbox API, implements retry logic,
 * and provides fallback to mock data when API is unavailable
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../lib/logger';
import {
  HostawayApiResponse,
  HostawayReviewRaw,
  HostawayConfig,
  ReviewsQueryParams,
  MockDataConfig
} from '../types/reviews';

// OAuth2 token management
interface OAuth2Token {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface TokenState {
  token: string;
  expiresAtMs: number;
}

// Default Hostaway configuration
const DEFAULT_HOSTAWAY_CONFIG: HostawayConfig = {
  accountId: process.env.HOSTAWAY_ACCOUNT || process.env.HOSTAWAY_ACCOUNT_ID || '',
  apiKey: process.env.HOSTAWAY_API_KEY || '',
  baseUrl: process.env.HOSTAWAY_BASE_URL || process.env.HOSTAWAY_API_URL || 'https://api.hostaway.com/v1',
  timeout: parseInt(process.env.HOSTAWAY_TIMEOUT || '30000'),
  retries: parseInt(process.env.HOSTAWAY_RETRIES || '3'),
  mockMode: (process.env.HOSTAWAY_MOCK_MODE === 'true') || (!process.env.HOSTAWAY_API_KEY && process.env.NODE_ENV === 'development'),
  authScope: process.env.HOSTAWAY_AUTH_SCOPE || 'general'
};

// Token management state
let currentToken: TokenState | null = null;
const TOKEN_REFRESH_BUFFER_MS = 60 * 1000; // Refresh token 60 seconds before expiry

// Mock data configuration
const MOCK_FILE = path.resolve(__dirname, '../../mocks/hostaway_reviews.json');
const MOCK_DATA_CONFIG: MockDataConfig = {
  enabled: true,
  filePath: MOCK_FILE,
  fallbackOnError: true,
  simulateLatency: process.env.NODE_ENV === 'development',
  latencyMs: parseInt(process.env.MOCK_LATENCY_MS || '500')
};

// API client instance
let hostawayClient: AxiosInstance | null = null;

// Performance metrics
interface ApiMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  mockRequests: number;
  averageResponseTime: number;
  lastRequestAt?: Date;
  errors: string[];
}

let apiMetrics: ApiMetrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  mockRequests: 0,
  averageResponseTime: 0,
  errors: []
};

/**
 * Fetches OAuth2 access token using client credentials flow
 */
async function getAccessToken(): Promise<TokenState> {
  try {
    const tokenUrl = `${DEFAULT_HOSTAWAY_CONFIG.baseUrl}/accessTokens`;
    const requestBody = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: DEFAULT_HOSTAWAY_CONFIG.accountId,
      client_secret: DEFAULT_HOSTAWAY_CONFIG.apiKey,
      scope: DEFAULT_HOSTAWAY_CONFIG.authScope || 'general'
    });

    logger.info('Requesting OAuth2 access token from Hostaway', {
      url: tokenUrl,
      client_id: DEFAULT_HOSTAWAY_CONFIG.accountId,
      scope: DEFAULT_HOSTAWAY_CONFIG.authScope
    });

    const response = await axios.post<OAuth2Token>(tokenUrl, requestBody.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      timeout: DEFAULT_HOSTAWAY_CONFIG.timeout
    });

    if (response.status !== 200 || !response.data.access_token) {
      throw new Error(`Failed to obtain access token: HTTP ${response.status}`);
    }

    const token = response.data;
    const expiresAtMs = Date.now() + (token.expires_in * 1000) - TOKEN_REFRESH_BUFFER_MS;

    logger.info('Successfully obtained OAuth2 access token', {
      token_type: token.token_type,
      expires_in: token.expires_in,
      scope: token.scope,
      expiresAt: new Date(expiresAtMs).toISOString()
    });

    return {
      token: token.access_token,
      expiresAtMs
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to obtain OAuth2 access token', {
      error: errorMessage,
      client_id: DEFAULT_HOSTAWAY_CONFIG.accountId,
      scope: DEFAULT_HOSTAWAY_CONFIG.authScope
    });
    throw new Error(`OAuth2 token request failed: ${errorMessage}`);
  }
}

/**
 * Ensures a valid access token is available, fetching or refreshing as needed
 */
async function ensureValidToken(): Promise<string> {
  const now = Date.now();
  
  // Check if current token is still valid
  if (currentToken && now < currentToken.expiresAtMs) {
    return currentToken.token;
  }

  // Token is expired or doesn't exist, get a new one
  if (currentToken) {
    logger.info('Access token expired, refreshing', {
      expiredAt: new Date(currentToken.expiresAtMs).toISOString()
    });
  } else {
    logger.info('No access token available, fetching initial token');
  }

  currentToken = await getAccessToken();
  return currentToken.token;
}

/**
 * Initializes the Hostaway API client with OAuth2 authentication and configuration
 */
export function initializeHostawayClient(config: Partial<HostawayConfig> = {}): void {
  const clientConfig = { ...DEFAULT_HOSTAWAY_CONFIG, ...config };
  
  hostawayClient = axios.create({
    baseURL: clientConfig.baseUrl,
    timeout: clientConfig.timeout,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    validateStatus: (status) => status < 500 // Don't throw on 4xx errors
  });

  // Basic config validation
  if (!clientConfig.mockMode) {
    if (!clientConfig.apiKey || clientConfig.apiKey.length < 20) {
      logger.warn('Hostaway API key appears invalid or missing. Falling back to mock when used.');
    }
    if (!clientConfig.accountId) {
      logger.warn('Hostaway account ID missing. Ensure HOSTAWAY_ACCOUNT_ID is set.');
    }
  }

  // Request interceptor for OAuth2 token management and metrics
  hostawayClient.interceptors.request.use(
    async (config) => {
      config.metadata = { startTime: Date.now() };
      
      // Add OAuth2 token if not in mock mode and not getting a token
      if (!clientConfig.mockMode && !config.url?.includes('/accessTokens')) {
        try {
          const token = await ensureValidToken();
          config.headers.Authorization = `Bearer ${token}`;
        } catch (error) {
          logger.error('Failed to set OAuth2 token on request', { error: error.message });
          // Continue with request - may fallback to mock if enabled
        }
      }
      
      logger.debug('Hostaway API request started', {
        method: config.method?.toUpperCase(),
        url: config.url,
        params: config.params,
        hasAuth: !!config.headers.Authorization
      });
      return config;
    },
    (error) => {
      logger.error('Hostaway API request setup failed', { error: error.message });
      return Promise.reject(error);
    }
  );

  // Response interceptor for OAuth2 token refresh and metrics
  hostawayClient.interceptors.response.use(
    (response) => {
      const duration = Date.now() - (response.config.metadata?.startTime || 0);
      updateMetrics(true, duration);
      
      logger.debug('Hostaway API request completed', {
        status: response.status,
        duration,
        dataSize: JSON.stringify(response.data).length
      });
      
      return response;
    },
    async (error) => {
      const duration = Date.now() - (error.config?.metadata?.startTime || 0);
      updateMetrics(false, duration, error.message);
      
      logger.error('Hostaway API request failed', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        duration,
        error: error.message,
        url: error.config?.url
      });
      
      const status = error.response?.status;
      
      // Handle 401 Unauthorized - attempt token refresh and retry once
      if (status === 401 && !error.config?.__tokenRefreshed && !error.config?.url?.includes('/accessTokens')) {
        logger.info('Received 401, attempting token refresh and retry', {
          url: error.config?.url
        });
        
        try {
          // Force token refresh by clearing current token
          currentToken = null;
          const newToken = await ensureValidToken();
          
          // Mark this request as having been token-refreshed to prevent infinite loops
          error.config.__tokenRefreshed = true;
          error.config.headers.Authorization = `Bearer ${newToken}`;
          
          logger.info('Token refreshed, retrying request', {
            url: error.config?.url
          });
          
          return hostawayClient!.request(error.config);
        } catch (refreshError) {
          logger.error('Token refresh failed', {
            error: refreshError instanceof Error ? refreshError.message : String(refreshError)
          });
          // Continue with original error handling below
        }
      }
      
      // Apply simple retry if network or timeout (but not for 401 after refresh attempt)
      const isNetworkError = !error.response;
      if (isNetworkError || status === 408) {
        error.config.__retryCount = (error.config.__retryCount || 0) + 1;
        if (error.config.__retryCount <= DEFAULT_HOSTAWAY_CONFIG.retries) {
          const backoff = Math.pow(2, error.config.__retryCount) * 250;
          logger.info('Retrying request due to network/timeout error', {
            attempt: error.config.__retryCount,
            backoffMs: backoff
          });
          return new Promise((resolve) => setTimeout(resolve, backoff)).then(() => hostawayClient!.request(error.config));
        }
      }
      
      return Promise.reject(error);
    }
  );

  logger.info('Hostaway API client initialized', {
    baseUrl: clientConfig.baseUrl,
    timeout: clientConfig.timeout,
    mockMode: clientConfig.mockMode,
    authScope: clientConfig.authScope,
    oauthEnabled: !clientConfig.mockMode && !!(clientConfig.accountId && clientConfig.apiKey)
  });
}

/**
 * Fetches reviews from Hostaway API with proper error handling and retries
 */
export async function fetchHostawayReviews(
  queryParams: ReviewsQueryParams,
  retryCount: number = 0
): Promise<HostawayApiResponse> {
  const startTime = Date.now();
  apiMetrics.totalRequests++;
  apiMetrics.lastRequestAt = new Date();

  try {
    // Use mock data if in mock mode or if API is not configured
    if (DEFAULT_HOSTAWAY_CONFIG.mockMode || !DEFAULT_HOSTAWAY_CONFIG.apiKey) {
      logger.info('Using mock data for Hostaway reviews', { mockMode: DEFAULT_HOSTAWAY_CONFIG.mockMode });
      return await fetchMockReviews(queryParams);
    }

    // Ensure client is initialized
    if (!hostawayClient) {
      initializeHostawayClient();
    }

    // Build API request parameters
    const apiParams = buildHostawayApiParams(queryParams);
    
    logger.info('Fetching reviews from Hostaway API', {
      params: apiParams,
      attempt: retryCount + 1,
      maxRetries: DEFAULT_HOSTAWAY_CONFIG.retries
    });

    // Make the API request
    const response: AxiosResponse<HostawayApiResponse> = await hostawayClient!.get('/reviews', {
      params: apiParams
    });

    // Handle different response statuses
    if (response.status === 200 && response.data) {
      const apiResponse = response.data;
      
      // Validate response structure
      if (validateHostawayResponse(apiResponse)) {
        logger.info('Successfully fetched reviews from Hostaway API', {
          count: apiResponse.count,
          total: apiResponse.total,
          page: apiResponse.page
        });
        
        return apiResponse;
      } else {
        throw new Error('Invalid response structure from Hostaway API');
      }
    } else {
      throw new Error(`Hostaway API returned status ${response.status}: ${response.statusText}`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error fetching reviews from Hostaway API', {
      error: errorMessage,
      attempt: retryCount + 1,
      queryParams
    });

    // Retry logic with exponential backoff
    if (retryCount < DEFAULT_HOSTAWAY_CONFIG.retries) {
      const backoffDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
      logger.info(`Retrying Hostaway API request in ${backoffDelay}ms`, {
        attempt: retryCount + 2,
        maxRetries: DEFAULT_HOSTAWAY_CONFIG.retries
      });
      
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return await fetchHostawayReviews(queryParams, retryCount + 1);
    }

    // All retries exhausted, fallback to mock data if enabled
    if (MOCK_DATA_CONFIG.fallbackOnError) {
      logger.warn('All Hostaway API retries exhausted, falling back to mock data');
      return await fetchMockReviews(queryParams);
    }

    // Re-throw error if no fallback
    throw new Error(`Hostaway API failed after ${DEFAULT_HOSTAWAY_CONFIG.retries + 1} attempts: ${errorMessage}`);
  }
}

/**
 * Fetches mock review data from JSON file
 */
export async function fetchMockReviews(
  queryParams: ReviewsQueryParams
): Promise<HostawayApiResponse> {
  try {
    apiMetrics.mockRequests++;

    // Simulate API latency in development
    if (MOCK_DATA_CONFIG.simulateLatency) {
      await new Promise(resolve => setTimeout(resolve, MOCK_DATA_CONFIG.latencyMs));
    }

    logger.debug('Loading mock reviews data', { filePath: MOCK_DATA_CONFIG.filePath });
    
    // Read mock data file
    const mockDataContent = await fs.readFile(MOCK_DATA_CONFIG.filePath, 'utf-8');
    const mockData: HostawayApiResponse = JSON.parse(mockDataContent);

    // Apply filters and pagination to mock data
    const filteredData = applyFiltersToMockData(mockData, queryParams);
    
    logger.info('Successfully loaded mock reviews data', {
      originalCount: mockData.result.length,
      filteredCount: filteredData.result.length,
      queryParams
    });

    updateMetrics(true, MOCK_DATA_CONFIG.latencyMs);
    return filteredData;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error loading mock reviews data', {
      error: errorMessage,
      filePath: MOCK_DATA_CONFIG.filePath
    });

    updateMetrics(false, 0, errorMessage);

    // Return empty result if mock data fails
    return {
      status: 'success',
      result: [],
      count: 0,
      limit: queryParams.limit || 20,
      page: queryParams.page || 1,
      total: 0,
      message: 'Mock data unavailable, returning empty result'
    };
  }
}

/**
 * Builds Hostaway API parameters from query parameters
 */
function buildHostawayApiParams(queryParams: ReviewsQueryParams): Record<string, any> {
  const apiParams: Record<string, any> = {};

  // Map query parameters to Hostaway API format
  if (queryParams.listingId) {
    apiParams.listingId = queryParams.listingId;
  }

  if (queryParams.from) {
    apiParams.created_from = new Date(queryParams.from).toISOString();
  }

  if (queryParams.to) {
    apiParams.created_to = new Date(queryParams.to).toISOString();
  }

  if (queryParams.channel) {
    apiParams.channel = queryParams.channel;
  }

  if (queryParams.approved !== undefined) {
    apiParams.approved = queryParams.approved ? 1 : 0;
  }

  if (queryParams.reviewType) {
    apiParams.review_type = queryParams.reviewType;
  }

  // Pagination
  apiParams.page = queryParams.page || 1;
  apiParams.limit = Math.min(queryParams.limit || 20, 100); // Hostaway max limit

  // Additional API parameters
  apiParams.include = 'categories,responses'; // Include related data
  apiParams.sort = '-created_at'; // Sort by newest first

  return apiParams;
}

/**
 * Applies query filters to mock data for realistic testing
 */
function applyFiltersToMockData(
  mockData: HostawayApiResponse,
  queryParams: ReviewsQueryParams
): HostawayApiResponse {
  let filteredReviews = [...mockData.result];

  // Filter by listing ID
  if (queryParams.listingId) {
    filteredReviews = filteredReviews.filter(review => review.listingId === queryParams.listingId);
  }

  // Filter by date range
  if (queryParams.from) {
    const fromDate = new Date(queryParams.from);
    filteredReviews = filteredReviews.filter(review => new Date(review.createdAt) >= fromDate);
  }

  if (queryParams.to) {
    const toDate = new Date(queryParams.to);
    filteredReviews = filteredReviews.filter(review => new Date(review.createdAt) <= toDate);
  }

  // Filter by channel
  if (queryParams.channel) {
    filteredReviews = filteredReviews.filter(review => {
      // Normalize channel comparison
      const reviewChannel = review.channel.toLowerCase().replace(/[^a-z.]/g, '');
      const queryChannel = queryParams.channel!.toLowerCase().replace(/[^a-z.]/g, '');
      return reviewChannel === queryChannel || reviewChannel.includes(queryChannel);
    });
  }

  // Filter by approval status
  if (queryParams.approved !== undefined) {
    filteredReviews = filteredReviews.filter(review => review.approved === queryParams.approved);
  }

  // Filter by review type
  if (queryParams.reviewType) {
    filteredReviews = filteredReviews.filter(review => {
      const normalizedType = review.reviewType.toLowerCase().replace(/[^a-z]/g, '_');
      return normalizedType === queryParams.reviewType || normalizedType.includes(queryParams.reviewType);
    });
  }

  // Filter by rating range
  if (queryParams.minRating !== undefined) {
    filteredReviews = filteredReviews.filter(review => {
      const rating = review.rating || calculateMockRating(review.reviewCategories || []);
      return rating >= queryParams.minRating!;
    });
  }

  if (queryParams.maxRating !== undefined) {
    filteredReviews = filteredReviews.filter(review => {
      const rating = review.rating || calculateMockRating(review.reviewCategories || []);
      return rating <= queryParams.maxRating!;
    });
  }

  // Filter by response presence
  if (queryParams.hasResponse !== undefined) {
    filteredReviews = filteredReviews.filter(review => {
      const hasResponse = !!(review.response && review.response.length > 0);
      return hasResponse === queryParams.hasResponse;
    });
  }

  // Apply pagination
  const page = queryParams.page || 1;
  const limit = Math.min(queryParams.limit || 20, 100);
  const offset = (page - 1) * limit;
  const paginatedReviews = filteredReviews.slice(offset, offset + limit);

  return {
    status: 'success',
    result: paginatedReviews,
    count: paginatedReviews.length,
    limit,
    page,
    total: filteredReviews.length,
    message: 'Mock data filtered successfully'
  };
}

/**
 * Calculates rating from mock review categories
 */
function calculateMockRating(categories: any[]): number {
  if (!categories || categories.length === 0) return 5.0;
  
  const sum = categories.reduce((total, cat) => {
    const rating = cat.max_rating !== 10 ? (cat.rating / cat.max_rating) * 10 : cat.rating;
    return total + rating;
  }, 0);
  
  return Math.round((sum / categories.length) * 10) / 10;
}

/**
 * Validates Hostaway API response structure
 */
function validateHostawayResponse(response: any): response is HostawayApiResponse {
  return (
    response &&
    typeof response === 'object' &&
    response.status === 'success' &&
    Array.isArray(response.result) &&
    typeof response.count === 'number' &&
    typeof response.page === 'number' &&
    typeof response.total === 'number'
  );
}

/**
 * Updates API performance metrics
 */
function updateMetrics(success: boolean, duration: number, error?: string): void {
  if (success) {
    apiMetrics.successfulRequests++;
  } else {
    apiMetrics.failedRequests++;
    if (error) {
      apiMetrics.errors.push(`${new Date().toISOString()}: ${error}`);
      // Keep only last 50 errors
      if (apiMetrics.errors.length > 50) {
        apiMetrics.errors = apiMetrics.errors.slice(-50);
      }
    }
  }

  // Update rolling average response time
  const totalRequests = apiMetrics.successfulRequests + apiMetrics.failedRequests;
  apiMetrics.averageResponseTime = totalRequests > 0
    ? Math.round(((apiMetrics.averageResponseTime * (totalRequests - 1)) + duration) / totalRequests)
    : duration;
}

/**
 * Gets current API metrics
 */
export function getHostawayApiMetrics(): ApiMetrics & {
  successRate: number;
  errorRate: number;
  mockUsageRate: number;
} {
  const totalRequests = apiMetrics.totalRequests;
  
  return {
    ...apiMetrics,
    successRate: totalRequests > 0 ? Math.round((apiMetrics.successfulRequests / totalRequests) * 100) / 100 : 0,
    errorRate: totalRequests > 0 ? Math.round((apiMetrics.failedRequests / totalRequests) * 100) / 100 : 0,
    mockUsageRate: totalRequests > 0 ? Math.round((apiMetrics.mockRequests / totalRequests) * 100) / 100 : 0
  };
}

/**
 * Resets API metrics
 */
export function resetHostawayApiMetrics(): void {
  apiMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    mockRequests: 0,
    averageResponseTime: 0,
    errors: []
  };
  
  logger.info('Hostaway API metrics reset');
}

/**
 * Health check for Hostaway API service
 */
export async function hostawayHealthCheck(): Promise<{
  healthy: boolean;
  details: {
    api_configured: boolean;
    mock_mode: boolean;
    mock_data_available: boolean;
    oauth_token_valid: boolean;
    token_expires_at?: string;
    last_request?: Date;
    metrics: ReturnType<typeof getHostawayApiMetrics>;
  };
}> {
  try {
    const apiConfigured = !!(DEFAULT_HOSTAWAY_CONFIG.apiKey && DEFAULT_HOSTAWAY_CONFIG.accountId);
    
    // Check if mock data is available
    let mockDataAvailable = false;
    try {
      await fs.access(MOCK_FILE);
      mockDataAvailable = true;
    } catch {
      mockDataAvailable = false;
    }

    // Check OAuth2 token status
    let oauthTokenValid = false;
    let tokenExpiresAt: string | undefined;
    
    if (!DEFAULT_HOSTAWAY_CONFIG.mockMode && apiConfigured) {
      const now = Date.now();
      oauthTokenValid = !!(currentToken && now < currentToken.expiresAtMs);
      if (currentToken) {
        tokenExpiresAt = new Date(currentToken.expiresAtMs).toISOString();
      }
    }

    const metrics = getHostawayApiMetrics();
    const healthy = (apiConfigured && !DEFAULT_HOSTAWAY_CONFIG.mockMode) || 
                   (DEFAULT_HOSTAWAY_CONFIG.mockMode && mockDataAvailable);

    return {
      healthy,
      details: {
        api_configured: apiConfigured,
        mock_mode: DEFAULT_HOSTAWAY_CONFIG.mockMode,
        mock_data_available: mockDataAvailable,
        oauth_token_valid: oauthTokenValid,
        token_expires_at: tokenExpiresAt,
        last_request: metrics.lastRequestAt,
        metrics
      }
    };
  } catch (error) {
    logger.error('Hostaway health check failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      healthy: false,
      details: {
        api_configured: false,
        mock_mode: DEFAULT_HOSTAWAY_CONFIG.mockMode,
        mock_data_available: false,
        metrics: getHostawayApiMetrics()
      }
    };
  }
}

/**
 * Configures Hostaway client at runtime
 */
export function configureHostawayClient(config: Partial<HostawayConfig>): void {
  Object.assign(DEFAULT_HOSTAWAY_CONFIG, config);
  
  // Re-initialize client with new config
  if (hostawayClient) {
    initializeHostawayClient();
  }
  
  logger.info('Hostaway client configuration updated', { config: DEFAULT_HOSTAWAY_CONFIG });
}

/**
 * Gets current Hostaway configuration
 */
export function getHostawayConfiguration(): HostawayConfig {
  return { ...DEFAULT_HOSTAWAY_CONFIG };
}

/**
 * Fetches reviews with accurate source tracking and empty result fallback
 * Combines error fallback and empty result fallback with proper source attribution
 */
export async function fetchReviewsWithSource(
  queryParams: ReviewsQueryParams
): Promise<{ response: HostawayApiResponse; source: 'hostaway' | 'mock' }> {
  try {
    // If in mock mode, return mock data directly
    if (getHostawayConfiguration().mockMode) {
      const mockResponse = await fetchMockReviews(queryParams);
      return { response: mockResponse, source: 'mock' };
    }

    // Try to fetch from Hostaway API first
    try {
      const hostawayResponse = await fetchHostawayReviews(queryParams);
      
      // Check if we have empty results and should fallback to mock
      if ((hostawayResponse.result?.length || 0) === 0) {
        logger.info('Hostaway returned empty results, attempting mock fallback');
        try {
          const mockResponse = await fetchMockReviews(queryParams);
          if (mockResponse.result.length > 0) {
            logger.info('Using mock data as fallback for empty Hostaway results', {
              mockCount: mockResponse.result.length
            });
            return { response: mockResponse, source: 'mock' };
          }
        } catch (mockError) {
          logger.warn('Mock fallback failed for empty results', {
            error: mockError instanceof Error ? mockError.message : String(mockError)
          });
        }
      }
      
      // Return Hostaway data (even if empty)
      return { response: hostawayResponse, source: 'hostaway' };
      
    } catch (apiError) {
      logger.error('Hostaway API failed, attempting fallback to mock data', {
        error: apiError instanceof Error ? apiError.message : String(apiError)
      });

      // Error fallback - try mock data if fallback is enabled
      if (MOCK_DATA_CONFIG.fallbackOnError) {
        try {
          const mockResponse = await fetchMockReviews(queryParams);
          logger.info('Successfully fell back to mock data after API error', {
            mockCount: mockResponse.result.length
          });
          return { response: mockResponse, source: 'mock' };
        } catch (mockError) {
          logger.error('Mock data fallback also failed', {
            mockError: mockError instanceof Error ? mockError.message : String(mockError)
          });
        }
      }
      
      // Re-throw original error if no fallback
      throw apiError;
    }
  } catch (error) {
    logger.error('fetchReviewsWithSource failed completely', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// Initialize client on module load
if (DEFAULT_HOSTAWAY_CONFIG.apiKey || DEFAULT_HOSTAWAY_CONFIG.mockMode) {
  initializeHostawayClient();
}

// Export all functions
export {
  initializeHostawayClient,
  fetchHostawayReviews,
  fetchMockReviews,
  fetchReviewsWithSource,
  getHostawayApiMetrics,
  resetHostawayApiMetrics,
  hostawayHealthCheck,
  configureHostawayClient,
  getHostawayConfiguration
};

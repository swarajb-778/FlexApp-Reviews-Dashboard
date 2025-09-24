import axios, { AxiosInstance } from 'axios';
import { JWT } from 'google-auth-library';
import { logger } from '../lib/logger';
import { Review } from '../types/reviews';

// Google Places API interfaces
export interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  types: string[];
}

export interface GoogleReview {
  author_name: string;
  author_url?: string;
  language: string;
  original_language?: string;
  profile_photo_url?: string;
  rating: number;
  relative_time_description: string;
  text?: string;
  time: number;
  translated?: boolean;
}

export interface GooglePlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  reviews?: GoogleReview[];
  business_status?: string;
  opening_hours?: {
    open_now: boolean;
    periods: Array<{
      close: { day: number; time: string };
      open: { day: number; time: string };
    }>;
    weekday_text: string[];
  };
  website?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  types: string[];
}

export interface GooglePlacesSearchResponse {
  results: GooglePlace[];
  status: string;
  error_message?: string;
  next_page_token?: string;
}

export interface GooglePlaceDetailsResponse {
  result: GooglePlaceDetails;
  status: string;
  error_message?: string;
}

// Business Profile API interfaces (Google My Business)
export interface BusinessLocation {
  name: string;
  locationName: string;
  primaryCategory: {
    displayName: string;
    categoryId: string;
  };
  address: {
    regionCode: string;
    administrativeArea: string;
    locality: string;
    addressLines: string[];
    postalCode: string;
  };
  primaryPhone?: string;
  websiteUri?: string;
  regularHours?: {
    periods: Array<{
      openDay: string;
      openTime: string;
      closeDay: string;
      closeTime: string;
    }>;
  };
  metadata: {
    placeId: string;
  };
}

export interface BusinessReview {
  name: string;
  reviewer: {
    profilePhotoUrl?: string;
    displayName: string;
    isAnonymous: boolean;
  };
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

export interface GoogleReviewsClientConfig {
  placesApiKey: string;
  businessProfileCredentials?: {
    type: string;
    project_id: string;
    private_key_id: string;
    private_key: string;
    client_email: string;
    client_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_x509_cert_url: string;
  };
  timeout?: number;
  retryAttempts?: number;
  rateLimitDelay?: number;
}

export class GoogleReviewsClient {
  private placesApi: AxiosInstance;
  private businessProfileApi: AxiosInstance | null = null;
  private jwtClient: JWT | null = null;
  private config: GoogleReviewsClientConfig;
  private requestCount = 0;
  private lastRequestTime = 0;

  constructor(config: GoogleReviewsClientConfig) {
    this.config = {
      timeout: 10000,
      retryAttempts: 3,
      rateLimitDelay: 1000, // 1 second between requests
      ...config
    };

    // Initialize Google Places API client
    this.placesApi = axios.create({
      baseURL: 'https://maps.googleapis.com/maps/api/place',
      timeout: this.config.timeout,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FlexLiving-Reviews-Dashboard/1.0'
      }
    });

    // Initialize Business Profile API client (if credentials provided)
    if (this.config.businessProfileCredentials) {
      this.initializeBusinessProfileApi();
    }

    logger.info('GoogleReviewsClient initialized', {
      placesApiEnabled: true,
      businessProfileEnabled: !!this.businessProfileApi
    });
  }

  private async initializeBusinessProfileApi(): Promise<void> {
    try {
      if (!this.config.businessProfileCredentials) {
        throw new Error('Business Profile credentials not provided');
      }

      // Initialize JWT client with service account credentials
      this.jwtClient = new JWT({
        email: this.config.businessProfileCredentials.client_email,
        key: this.config.businessProfileCredentials.private_key,
        scopes: ['https://www.googleapis.com/auth/business.manage']
      });

      // Get access token
      const tokens = await this.jwtClient.getAccessToken();
      
      if (!tokens.token) {
        throw new Error('Failed to obtain access token');
      }

      // Initialize Business Profile API client with proper v4 endpoint
      this.businessProfileApi = axios.create({
        baseURL: 'https://mybusiness.googleapis.com/v4',
        timeout: this.config.timeout,
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${tokens.token}`,
          'User-Agent': 'FlexLiving-Reviews-Dashboard/1.0'
        }
      });

      // Add response interceptor to refresh token if needed
      this.businessProfileApi.interceptors.response.use(
        (response) => response,
        async (error) => {
          if (error.response?.status === 401 && this.jwtClient) {
            try {
              // Refresh the token
              const newTokens = await this.jwtClient.getAccessToken();
              if (newTokens.token) {
                // Update the authorization header
                if (this.businessProfileApi) {
                  this.businessProfileApi.defaults.headers['Authorization'] = `Bearer ${newTokens.token}`;
                }
                // Retry the original request
                error.config.headers['Authorization'] = `Bearer ${newTokens.token}`;
                return axios.request(error.config);
              }
            } catch (refreshError) {
              logger.error('Failed to refresh Business Profile API token', refreshError);
            }
          }
          return Promise.reject(error);
        }
      );

      logger.info('Business Profile API client initialized with JWT authentication');
    } catch (error) {
      logger.error('Failed to initialize Business Profile API', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.businessProfileApi = null;
      this.jwtClient = null;
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.config.rateLimitDelay!) {
      const waitTime = this.config.rateLimitDelay! - timeSinceLastRequest;
      logger.debug(`Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Search for places using Google Places API Text Search
   * Note: Text Search API does not support 'fields' parameter
   */
  public async searchPlaces(query: string, location?: { lat: number; lng: number }, radius?: number): Promise<GooglePlace[]> {
    try {
      await this.enforceRateLimit();

      const params: any = {
        query,
        key: this.config.placesApiKey
      };

      if (location && radius) {
        params.location = `${location.lat},${location.lng}`;
        params.radius = radius;
      }

      logger.info('Searching Google Places', { query, location, radius });

      const response = await this.placesApi.get<GooglePlacesSearchResponse>('/textsearch/json', { params });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        const errorMsg = response.data.error_message || 'Unknown error';
        logger.error('Google Places API error', {
          status: response.data.status,
          error: errorMsg,
          query
        });
        throw new Error(`Google Places API error: ${response.data.status} - ${errorMsg}`);
      }

      logger.info('Google Places search completed', {
        query,
        resultsCount: response.data.results.length,
        status: response.data.status
      });

      return response.data.results;
    } catch (error) {
      const message = (error as any)?.response?.data?.error_message || (error as Error).message;
      logger.error('Google Places search failed', { 
        error: message,
        status: (error as any)?.response?.status,
        query,
        location,
        radius 
      });
      
      // Enhanced error handling for different API errors
      if (error.response?.status === 403) {
        throw new Error('Google Places API access denied. Check your API key and billing status.');
      } else if (error.response?.status === 429) {
        throw new Error('Google Places API quota exceeded. Please try again later.');
      } else if (error.response?.status === 400) {
        throw new Error('Google Places API request invalid. Check query parameters.');
      }
      
      throw new Error(`Failed to search Google Places: ${message || 'Unknown error'}`);
    }
  }

  /**
   * Get detailed information about a place including reviews
   */
  public async getPlaceDetails(placeId: string): Promise<GooglePlaceDetails> {
    try {
      await this.enforceRateLimit();

      const params = {
        place_id: placeId,
        key: this.config.placesApiKey,
        fields: 'place_id,name,formatted_address,geometry,rating,user_ratings_total,reviews,business_status,opening_hours,website,formatted_phone_number,international_phone_number,types'
      };

      logger.info('Fetching Google Place details', { placeId });

      const response = await this.placesApi.get<GooglePlaceDetailsResponse>('/details/json', { params });

      if (response.data.status !== 'OK') {
        throw new Error(`Google Places API error: ${response.data.status} - ${response.data.error_message}`);
      }

      logger.info('Google Place details fetched', {
        placeId,
        name: response.data.result.name,
        reviewsCount: response.data.result.reviews?.length || 0
      });

      return response.data.result;
    } catch (error) {
      const message = (error as any)?.response?.data?.error_message || (error as Error).message;
      logger.error('Failed to fetch place details', { error: message, status: (error as any)?.response?.status });
      throw new Error(`Failed to get place details: ${message}`);
    }
  }

  /**
   * Get reviews for a specific place using Business Profile API
   * Note: Requires business verification and ownership
   * LocationName format: accounts/{accountId}/locations/{locationId}
   */
  public async getBusinessReviews(locationName: string): Promise<BusinessReview[]> {
    if (!this.businessProfileApi) {
      throw new Error('Business Profile API not configured. Please provide valid service account credentials.');
    }

    try {
      await this.enforceRateLimit();

      logger.info('Fetching business reviews', { locationName });

      // Use the correct v4 endpoint for reviews
      const response = await this.businessProfileApi.get(`/${locationName}/reviews`, {
        params: {
          pageSize: 50, // Maximum allowed by API
          orderBy: 'updateTime desc'
        }
      });

      const reviews: BusinessReview[] = response.data.reviews || [];

      logger.info('Business reviews fetched', {
        locationName,
        reviewsCount: reviews.length,
        totalReviewCount: response.data.totalReviewCount || 0
      });

      // Handle pagination if there are more reviews
      if (response.data.nextPageToken && reviews.length > 0) {
        logger.info('More reviews available', { 
          locationName, 
          nextPageToken: response.data.nextPageToken 
        });
      }

      return reviews;
    } catch (error) {
      logger.error('Failed to fetch business reviews', {
        error: error instanceof Error ? error.message : String(error),
        locationName,
        responseStatus: error.response?.status,
        responseData: error.response?.data
      });
      
      // Enhanced error handling for Business Profile API
      if (error.response?.status === 401) {
        throw new Error('Business Profile API authentication failed. Check your service account credentials.');
      } else if (error.response?.status === 403) {
        throw new Error('Business Profile API access denied. Ensure business is verified, you have proper permissions, and the location belongs to your account.');
      } else if (error.response?.status === 404) {
        throw new Error(`Location not found: ${locationName}. Verify the location name format: accounts/{accountId}/locations/{locationId}`);
      } else if (error.response?.status === 429) {
        throw new Error('Business Profile API quota exceeded. Please try again later.');
      } else if (error.response?.status === 400) {
        throw new Error(`Invalid request to Business Profile API: ${error.response?.data?.error?.message || 'Bad request'}`);
      }
      
      throw new Error(`Failed to get business reviews: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Normalize Google Places review to our internal format
   */
  public normalizeGooglePlacesReview(
    googleReview: GoogleReview, 
    placeId: string, 
    listingId?: string
  ): Partial<Review> {
    return {
      externalId: `google-places-${placeId}-${googleReview.time}`,
      guestName: googleReview.author_name,
      rating: googleReview.rating,
      comment: googleReview.text || '',
      source: 'google',
      status: 'pending',
      listingId,
      createdAt: new Date(googleReview.time * 1000),
      metadata: {
        authorUrl: googleReview.author_url,
        profilePhotoUrl: googleReview.profile_photo_url,
        language: googleReview.language,
        originalLanguage: googleReview.original_language,
        relativeTimeDescription: googleReview.relative_time_description,
        translated: googleReview.translated,
        placeId
      }
    };
  }

  /**
   * Normalize Business Profile review to our internal format
   */
  public normalizeBusinessReview(
    businessReview: BusinessReview, 
    locationName: string, 
    listingId?: string
  ): Partial<Review> {
    const ratingMap = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
    
    return {
      externalId: `google-business-${businessReview.name}`,
      guestName: businessReview.reviewer.isAnonymous ? 'Anonymous' : businessReview.reviewer.displayName,
      rating: ratingMap[businessReview.starRating],
      comment: businessReview.comment || '',
      source: 'google',
      status: 'pending',
      listingId,
      createdAt: new Date(businessReview.createTime),
      updatedAt: new Date(businessReview.updateTime),
      metadata: {
        reviewerProfilePhoto: businessReview.reviewer.profilePhotoUrl,
        reviewerIsAnonymous: businessReview.reviewer.isAnonymous,
        locationName,
        reviewReply: businessReview.reviewReply ? {
          comment: businessReview.reviewReply.comment,
          updateTime: businessReview.reviewReply.updateTime
        } : undefined
      }
    };
  }

  /**
   * Get usage statistics for monitoring
   */
  public getUsageStats(): {
    requestCount: number;
    lastRequestTime: number;
    rateLimitDelay: number;
    placesApiEnabled: boolean;
    businessProfileEnabled: boolean;
  } {
    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      rateLimitDelay: this.config.rateLimitDelay!,
      placesApiEnabled: true,
      businessProfileEnabled: !!this.businessProfileApi
    };
  }

  /**
   * Reset usage statistics (useful for testing)
   */
  public resetUsageStats(): void {
    this.requestCount = 0;
    this.lastRequestTime = 0;
    logger.info('Google Reviews client usage stats reset');
  }

  /**
   * Check API quotas and availability
   */
  public async checkApiHealth(): Promise<{
    placesApi: { available: boolean; error?: string };
    businessProfileApi: { available: boolean; error?: string };
  }> {
    const result = {
      placesApi: { available: false, error: undefined as string | undefined },
      businessProfileApi: { available: false, error: undefined as string | undefined }
    };

    // Test Places API
    try {
      const testResponse = await this.placesApi.get('/textsearch/json', {
        params: {
          query: 'test',
          key: this.config.placesApiKey
        }
      });

      result.placesApi.available = testResponse.status === 200;
    } catch (error) {
      result.placesApi.error = error.message;
      logger.warn('Places API health check failed', error);
    }

    // Test Business Profile API
    if (this.businessProfileApi) {
      try {
        const testResponse = await this.businessProfileApi.get('/accounts');
        result.businessProfileApi.available = testResponse.status === 200;
      } catch (error) {
        result.businessProfileApi.error = error.message;
        logger.warn('Business Profile API health check failed', error);
      }
    }

    return result;
  }
}

// Export singleton instance
export const googleReviewsClient = new GoogleReviewsClient({
  placesApiKey: process.env.GOOGLE_PLACES_API_KEY!,
  businessProfileCredentials: process.env.GOOGLE_BUSINESS_PROFILE_CREDENTIALS 
    ? JSON.parse(process.env.GOOGLE_BUSINESS_PROFILE_CREDENTIALS)
    : undefined,
  timeout: parseInt(process.env.GOOGLE_API_TIMEOUT || '10000'),
  retryAttempts: parseInt(process.env.GOOGLE_API_RETRY_ATTEMPTS || '3'),
  rateLimitDelay: parseInt(process.env.GOOGLE_API_RATE_LIMIT_DELAY || '1000')
});

'use client';

import { 
  useQuery, 
  useMutation, 
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import { useState, useCallback, useEffect, useRef } from 'react';
import { api, handleApiError } from './api';
import { 
  Review, 
  Listing, 
  ReviewsQueryParams, 
  ListingsQueryParams,
  ApproveReviewData,
  BulkApproveData,
  ReviewStats,
  ListingStats,
  PaginatedResponse,
  ApiResponse,
} from './types';
import { 
  QUERY_KEYS, 
  CACHE_CONFIG, 
  SUCCESS_MESSAGES 
} from './constants';
import { toast } from './use-toast';
import { 
  OptimisticUpdateManager,
  WebSocketManager,
  createOptimisticUpdateManager,
  createWebSocketManager,
  OfflineManager,
  createOfflineManager
} from './optimistic-updates';
import { trackUserAction, trackAPIRequest } from './analytics';

// ===== REVIEW HOOKS =====

/**
 * Hook to fetch reviews with pagination and filtering
 * Returns normalized data with reviews array and pagination info separately
 */
export function useReviews(
  params?: ReviewsQueryParams,
  options?: Omit<UseQueryOptions<PaginatedResponse<Review>>, 'queryKey' | 'queryFn'>
) {
  const query = useQuery({
    queryKey: [QUERY_KEYS.REVIEWS, params],
    queryFn: () => api.getReviews(params),
    staleTime: CACHE_CONFIG.STALE_TIME,
    gcTime: CACHE_CONFIG.CACHE_TIME,
    retry: CACHE_CONFIG.RETRY_COUNT,
    retryDelay: CACHE_CONFIG.RETRY_DELAY,
    ...options,
  });

  return {
    ...query,
    data: query.data?.data || [], // Extract the reviews array
    pagination: query.data ? {
      total: query.data.total,
      page: query.data.page,
      totalPages: query.data.totalPages,
      limit: query.data.limit,
    } : undefined,
  };
}

/**
 * Hook to fetch a single review
 * Returns normalized data with review object directly
 */
export function useReview(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<Review>>, 'queryKey' | 'queryFn'>
) {
  const query = useQuery({
    queryKey: [QUERY_KEYS.REVIEWS, id],
    queryFn: () => api.getReview(id),
    enabled: !!id,
    staleTime: CACHE_CONFIG.STALE_TIME,
    gcTime: CACHE_CONFIG.CACHE_TIME,
    ...options,
  });

  return {
    ...query,
    data: query.data?.data, // Extract the review object
  };
}

/**
 * Hook to get approved reviews for a listing
 * Returns normalized data with reviews array and pagination info separately
 */
export function useApprovedReviews(
  params?: { listingId?: string },
  options?: Omit<UseQueryOptions<PaginatedResponse<Review>>, 'queryKey' | 'queryFn'>
) {
  const query = useQuery({
    queryKey: [QUERY_KEYS.APPROVED_REVIEWS, params?.listingId],
    queryFn: () => api.getApprovedReviews(params?.listingId),
    enabled: !!params?.listingId,
    staleTime: CACHE_CONFIG.STALE_TIME,
    gcTime: CACHE_CONFIG.CACHE_TIME,
    ...options,
  });

  return {
    ...query,
    data: query.data?.data || [], // Extract the reviews array
    pagination: query.data ? {
      total: query.data.total,
      page: query.data.page,
      totalPages: query.data.totalPages,
      limit: query.data.limit,
    } : undefined,
  };
}

/**
 * Hook to fetch review statistics
 * Returns normalized data with stats object directly
 */
export function useReviewStats(
  options?: Omit<UseQueryOptions<ApiResponse<ReviewStats>>, 'queryKey' | 'queryFn'>
) {
  const query = useQuery({
    queryKey: [QUERY_KEYS.REVIEW_STATS],
    queryFn: () => api.getReviewStats(),
    staleTime: CACHE_CONFIG.STALE_TIME,
    gcTime: CACHE_CONFIG.CACHE_TIME,
    ...options,
  });

  return {
    ...query,
    data: query.data?.data, // Extract the stats object
  };
}

/**
 * Mutation hook to approve/reject a review
 */
export function useApproveReview(
  options?: UseMutationOptions<
    ApiResponse<Review>, 
    Error, 
    { id: string; data: ApproveReviewData }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => api.approveReview(id, data),
    onSuccess: (data, variables) => {
      // Invalidate and refetch review queries
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.REVIEWS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.REVIEW_STATS] });
      
      // Update specific review cache
      queryClient.setQueryData(
        [QUERY_KEYS.REVIEWS, variables.id], 
        data
      );

      // Show success toast
      toast({
        title: variables.data.approved 
          ? SUCCESS_MESSAGES.REVIEW_APPROVED
          : SUCCESS_MESSAGES.REVIEW_REJECTED,
        variant: 'default',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
    ...options,
  });
}

/**
 * Mutation hook for bulk approve/reject reviews
 */
export function useBulkApproveReviews(
  options?: UseMutationOptions<
    ApiResponse<{ updated: number }>, 
    Error, 
    BulkApproveData
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => api.bulkApproveReviews(data),
    onSuccess: (data, variables) => {
      // Invalidate review queries
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.REVIEWS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.REVIEW_STATS] });

      toast({
        title: SUCCESS_MESSAGES.BULK_ACTION_COMPLETED,
        description: `${data.data?.updated} reviews updated`,
        variant: 'default',
      });
    },
    onError: (error) => {
      toast({
        title: 'Bulk Action Failed',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
    ...options,
  });
}

/**
 * Mutation hook to sync Hostaway reviews
 */
export function useSyncHostawayReviews(
  options?: UseMutationOptions<
    ApiResponse<{ imported: number; updated: number }>, 
    Error, 
    void
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.syncHostawayReviews(),
    onSuccess: (data) => {
      // Invalidate all review-related queries
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.REVIEWS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.REVIEW_STATS] });

      toast({
        title: 'Sync Complete',
        description: `${data.data?.imported} new reviews imported, ${data.data?.updated} existing reviews updated`,
        variant: 'default',
      });
    },
    onError: (error) => {
      toast({
        title: 'Sync Failed',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
    ...options,
  });
}

// ===== LISTING HOOKS =====

/**
 * Hook to fetch listings with pagination and filtering
 * Returns normalized data with listings array and pagination info separately
 */
export function useListings(
  params?: ListingsQueryParams,
  options?: Omit<UseQueryOptions<PaginatedResponse<Listing>>, 'queryKey' | 'queryFn'>
) {
  const query = useQuery({
    queryKey: [QUERY_KEYS.LISTINGS, params],
    queryFn: () => api.getListings(params),
    staleTime: CACHE_CONFIG.STALE_TIME,
    gcTime: CACHE_CONFIG.CACHE_TIME,
    ...options,
  });

  return {
    ...query,
    data: query.data?.data || [], // Extract the listings array
    pagination: query.data ? {
      total: query.data.total,
      page: query.data.page,
      totalPages: query.data.totalPages,
      limit: query.data.limit,
    } : undefined,
  };
}

/**
 * Hook to fetch a single listing by ID
 * Returns normalized data with listing object directly
 */
export function useListingById(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<Listing>>, 'queryKey' | 'queryFn'>
) {
  const query = useQuery({
    queryKey: [QUERY_KEYS.LISTINGS, id],
    queryFn: () => api.getListing(id),
    enabled: !!id,
    staleTime: CACHE_CONFIG.STALE_TIME,
    gcTime: CACHE_CONFIG.CACHE_TIME,
    ...options,
  });

  return {
    ...query,
    data: query.data?.data, // Extract the listing object
  };
}

/**
 * Hook to fetch a single listing by slug
 * Returns normalized data with listing object directly
 */
export function useListing(
  slug: string,
  options?: Omit<UseQueryOptions<ApiResponse<Listing>>, 'queryKey' | 'queryFn'>
) {
  const query = useQuery({
    queryKey: [QUERY_KEYS.LISTING_BY_SLUG, slug],
    queryFn: () => api.getListingBySlug(slug),
    enabled: !!slug,
    staleTime: CACHE_CONFIG.STALE_TIME,
    gcTime: CACHE_CONFIG.CACHE_TIME,
    ...options,
  });

  return {
    ...query,
    data: query.data?.data, // Extract the listing object
  };
}

/**
 * Hook to fetch listing statistics
 * Returns normalized data with stats object directly
 */
export function useListingStats(
  options?: Omit<UseQueryOptions<ApiResponse<ListingStats>>, 'queryKey' | 'queryFn'>
) {
  const query = useQuery({
    queryKey: [QUERY_KEYS.LISTING_STATS],
    queryFn: () => api.getListingStats(),
    staleTime: CACHE_CONFIG.STALE_TIME,
    gcTime: CACHE_CONFIG.CACHE_TIME,
    ...options,
  });

  return {
    ...query,
    data: query.data?.data, // Extract the stats object
  };
}

// ===== UTILITY HOOKS =====

/**
 * Hook to prefetch reviews
 */
export function usePrefetchReviews() {
  const queryClient = useQueryClient();

  return (params?: ReviewsQueryParams) => {
    queryClient.prefetchQuery({
      queryKey: [QUERY_KEYS.REVIEWS, params],
      queryFn: () => api.getReviews(params),
      staleTime: CACHE_CONFIG.STALE_TIME,
    });
  };
}

/**
 * Hook to prefetch listings
 */
export function usePrefetchListings() {
  const queryClient = useQueryClient();

  return (params?: ListingsQueryParams) => {
    queryClient.prefetchQuery({
      queryKey: [QUERY_KEYS.LISTINGS, params],
      queryFn: () => api.getListings(params),
      staleTime: CACHE_CONFIG.STALE_TIME,
    });
  };
}

/**
 * Hook to invalidate all queries (useful for global refresh)
 */
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return {
    invalidateReviews: () => 
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.REVIEWS] }),
    invalidateListings: () => 
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LISTINGS] }),
    invalidateStats: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.REVIEW_STATS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LISTING_STATS] });
    },
    invalidateAll: () => queryClient.invalidateQueries(),
  };
}

/**
 * Hook for optimistic updates
 */
export function useOptimisticUpdate() {
  const queryClient = useQueryClient();

  return {
    updateReview: (reviewId: string, updates: Partial<Review>) => {
      queryClient.setQueryData(
        [QUERY_KEYS.REVIEWS, reviewId],
        (oldData: ApiResponse<Review> | undefined) => {
          if (!oldData) return undefined;
          return {
            ...oldData,
            data: oldData.data ? { ...oldData.data, ...updates } : undefined,
          };
        }
      );

      // Also update reviews list cache
      queryClient.setQueriesData(
        { queryKey: [QUERY_KEYS.REVIEWS] },
        (oldData: PaginatedResponse<Review> | undefined) => {
          if (!oldData) return undefined;
          return {
            ...oldData,
            data: oldData.data.map(review => 
              review.id === reviewId ? { ...review, ...updates } : review
            ),
          };
        }
      );
    },
  };
}

/**
 * Hook to manage loading states across multiple queries
 */
export function useLoadingState(queries: Array<{ isLoading: boolean; error: any }>) {
  const isLoading = queries.some(query => query.isLoading);
  const hasError = queries.some(query => query.error);
  const allSuccess = queries.every(query => !query.isLoading && !query.error);

  return {
    isLoading,
    hasError,
    allSuccess,
    errors: queries.filter(query => query.error).map(query => query.error),
  };
}

// Export all hooks for easy imports
export * from './use-toast';

// ===== ADVANCED HOOKS WITH OPTIMISTIC UPDATES =====

/**
 * Enhanced hook for optimistic review approval with rollback
 */
export function useOptimisticApprovalMutation(
  options?: UseMutationOptions<
    ApiResponse<Review>, 
    Error, 
    { id: string; data: ApproveReviewData }
  >
) {
  const queryClient = useQueryClient();
  const optimisticManager = useRef<OptimisticUpdateManager | null>(null);

  // Initialize optimistic update manager
  useEffect(() => {
    if (!optimisticManager.current) {
      optimisticManager.current = createOptimisticUpdateManager(queryClient);
    }
  }, [queryClient]);

  return useMutation({
    mutationFn: async ({ id, data }) => {
      if (!optimisticManager.current) {
        throw new Error('Optimistic update manager not initialized');
      }

      // Track API call start
      const apiStartTime = Date.now();
      
      try {
        const result = await optimisticManager.current.updateReview(
          id,
          { 
            approved: data.approved,
            approved_at: new Date().toISOString(),
            approved_by: 'current_user', // Replace with actual user ID
          },
          () => api.approveReview(id, data)
        );

        // Track successful API call
        trackAPIRequest({
          method: 'PATCH',
          url: `/api/reviews/${id}/approve`,
          status: 200,
          duration: Date.now() - apiStartTime,
        });

        return result;
      } catch (error) {
        // Track failed API call
        trackAPIRequest({
          method: 'PATCH',
          url: `/api/reviews/${id}/approve`,
          status: (error as any).response?.status || 500,
          duration: Date.now() - apiStartTime,
          error: (error as Error).message,
        });

        throw error;
      }
    },
    onSuccess: (data, variables) => {
      // Track successful approval
      trackUserAction('review_approved_optimistic', 'approval_workflow', {
        reviewId: variables.id,
        approved: variables.data.approved,
      });
      
      toast({
        title: variables.data.approved 
          ? SUCCESS_MESSAGES.REVIEW_APPROVED
          : SUCCESS_MESSAGES.REVIEW_REJECTED,
        variant: 'default',
      });
    },
    onError: (error, variables) => {
      toast({
        title: 'Approval Failed',
        description: handleApiError(error),
        variant: 'destructive',
      });
    },
    ...options,
  });
}

/**
 * Enhanced bulk approval with progress tracking and rollback
 */
export function useOptimisticBulkApprovalMutation(
  options?: UseMutationOptions<
    ApiResponse<{ updated: number }>, 
    Error, 
    BulkApproveData & { onProgress?: (processed: number, total: number) => void }
  >
) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<{ processed: number; total: number }>({ processed: 0, total: 0 });

  return useMutation({
    mutationFn: async ({ review_ids, approved, notes, onProgress }) => {
      const apiStartTime = Date.now();
      
      // Update progress
      setProgress({ processed: 0, total: review_ids.length });

      // Optimistically update all reviews
      review_ids.forEach((reviewId, index) => {
        queryClient.setQueriesData(
          { queryKey: [QUERY_KEYS.REVIEWS] },
          (oldData: PaginatedResponse<Review> | undefined) => {
            if (!oldData?.data) return oldData;
            return {
              ...oldData,
              data: oldData.data.map(review =>
                review.id === reviewId 
                  ? { 
                      ...review, 
                      approved,
                      approved_at: new Date().toISOString(),
                      approved_by: 'current_user',
                      _optimistic: true // Flag for optimistic update
                    } 
                  : review
              )
            }
          }
        );

        // Update progress
        setProgress({ processed: index + 1, total: review_ids.length });
        onProgress?.(index + 1, review_ids.length);
      });

      try {
        const result = await api.bulkApproveReviews({ review_ids, approved, notes });

        // Track successful bulk API call
        trackAPIRequest({
          method: 'POST',
          url: '/api/reviews/bulk-approve',
          status: 200,
          duration: Date.now() - apiStartTime,
        });

        return result;
      } catch (error) {
        // Rollback optimistic updates on error
        review_ids.forEach(reviewId => {
          queryClient.setQueriesData(
            { queryKey: [QUERY_KEYS.REVIEWS] },
            (oldData: PaginatedResponse<Review> | undefined) => {
              if (!oldData?.data) return oldData;
              return {
                ...oldData,
                data: oldData.data.map(review =>
                  review.id === reviewId && (review as any)._optimistic
                    ? { ...review, approved: null, approved_at: null, approved_by: null }
                    : review
                )
              }
            }
          );
        });

        // Track failed bulk API call
        trackAPIRequest({
          method: 'POST',
          url: '/api/reviews/bulk-approve',
          status: (error as any).response?.status || 500,
          duration: Date.now() - apiStartTime,
          error: (error as Error).message,
        });

        throw error;
      }
    },
    onSuccess: (data, variables) => {
      // Remove optimistic flags
      queryClient.setQueriesData(
        { queryKey: [QUERY_KEYS.REVIEWS] },
        (oldData: PaginatedResponse<Review> | undefined) => {
          if (!oldData?.data) return oldData;
          return {
            ...oldData,
            data: oldData.data.map(review => {
              const { _optimistic, ...cleanReview } = review as any;
              return cleanReview;
            })
          }
        }
      );

      // Invalidate to refresh from server
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.REVIEW_STATS] });
      
      trackUserAction('bulk_approval_completed_optimistic', 'approval_workflow', {
        count: variables.review_ids.length,
        approved: variables.approved,
      });

      toast({
        title: SUCCESS_MESSAGES.BULK_ACTION_COMPLETED,
        description: `${data.data?.updated} reviews updated`,
        variant: 'default',
      });
    },
    ...options,
  });
}

/**
 * Real-time WebSocket hook for live updates
 */
export function useRealtimeUpdates(options?: {
  enabled?: boolean;
  onReviewUpdate?: (review: Review) => void;
  onBulkActionComplete?: (data: { updated: number; action: string }) => void;
}) {
  const queryClient = useQueryClient();
  const wsManager = useRef<WebSocketManager | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  useEffect(() => {
    if (options?.enabled === false) return;

    // Initialize WebSocket manager
    wsManager.current = createWebSocketManager(queryClient);

    // Connect to WebSocket
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    wsManager.current.connect(wsUrl);

    // Set up event handlers
    wsManager.current.subscribe('review_updated', (reviewData: Review) => {
      options?.onReviewUpdate?.(reviewData);
    });

    wsManager.current.subscribe('bulk_action_completed', (data) => {
      options?.onBulkActionComplete?.(data);
    });

    // Monitor connection status
    const checkConnection = () => {
      const status = (wsManager.current as any)?.ws?.readyState;
      setConnectionStatus(
        status === WebSocket.CONNECTING ? 'connecting' :
        status === WebSocket.OPEN ? 'connected' : 'disconnected'
      );
    };

    const statusInterval = setInterval(checkConnection, 2000);
    checkConnection(); // Initial check

    return () => {
      clearInterval(statusInterval);
      wsManager.current?.disconnect();
    };
  }, [options?.enabled, options?.onReviewUpdate, options?.onBulkActionComplete, queryClient]);

  const sendMessage = useCallback((message: any) => {
    wsManager.current?.send(message);
  }, []);

  return {
    connectionStatus,
    sendMessage,
    isConnected: connectionStatus === 'connected',
  };
}

/**
 * Advanced search hook with debounced search and caching
 */
export function useAdvancedSearch<T>(
  searchFn: (query: string) => Promise<T>,
  options: {
    debounceMs?: number;
    minQueryLength?: number;
    cacheKey?: string;
  } = {}
) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  const {
    debounceMs = 300,
    minQueryLength = 2,
    cacheKey = 'search',
  } = options;

  // Debounce the search query
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, debounceMs]);

  // Perform search using React Query
  const searchResults = useQuery({
    queryKey: [cacheKey, debouncedQuery],
    queryFn: () => searchFn(debouncedQuery),
    enabled: debouncedQuery.length >= minQueryLength,
    staleTime: 5 * 60 * 1000, // 5 minutes
    onSettled: () => setIsSearching(false),
  });

  // Track search when query changes
  useEffect(() => {
    if (debouncedQuery && debouncedQuery.length >= minQueryLength) {
      setIsSearching(true);
      trackUserAction('search_performed', 'search_input', {
        queryLength: debouncedQuery.length,
        cacheKey,
      });
    }
  }, [debouncedQuery, minQueryLength, cacheKey]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
  }, []);

  return {
    query,
    setQuery,
    debouncedQuery,
    isSearching: isSearching || searchResults.isLoading,
    results: searchResults.data,
    error: searchResults.error,
    clearSearch,
  };
}

/**
 * Offline queue management hook
 */
export function useOfflineQueue() {
  const queryClient = useQueryClient();
  const offlineManager = useRef<OfflineManager | null>(null);
  const [isOnline, setIsOnline] = useState(navigator?.onLine ?? true);
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    offlineManager.current = createOfflineManager(queryClient);

    const handleOnline = () => {
      setIsOnline(true);
      // Process offline queue when connection is restored
      offlineManager.current?.processOfflineQueue();
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check queue size periodically
    const queueCheckInterval = setInterval(() => {
      const queue = offlineManager.current?.getOfflineQueue() || [];
      setQueueSize(queue.length);
    }, 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(queueCheckInterval);
    };
  }, [queryClient]);

  const queueAction = useCallback((action: {
    id: string;
    type: string;
    data: any;
  }) => {
    if (!isOnline && offlineManager.current) {
      offlineManager.current.queueOfflineAction({
        ...action,
        timestamp: Date.now(),
      });
    }
  }, [isOnline]);

  return {
    isOnline,
    queueSize,
    queueAction,
  };
}

/**
 * Performance monitoring hook
 */
export function usePerformanceMonitoring() {
  const [metrics, setMetrics] = useState<{
    renderCount: number;
    averageRenderTime: number;
    slowRenders: number;
  }>({
    renderCount: 0,
    averageRenderTime: 0,
    slowRenders: 0,
  });

  const renderTimes = useRef<number[]>([]);
  const renderStartTime = useRef<number>(0);

  useEffect(() => {
    renderStartTime.current = performance.now();
  });

  useEffect(() => {
    const renderTime = performance.now() - renderStartTime.current;
    renderTimes.current.push(renderTime);

    // Keep only last 50 render times
    if (renderTimes.current.length > 50) {
      renderTimes.current.shift();
    }

    const renderCount = renderTimes.current.length;
    const averageRenderTime = renderTimes.current.reduce((sum, time) => sum + time, 0) / renderCount;
    const slowRenders = renderTimes.current.filter(time => time > 16).length; // > 16ms is slow

    setMetrics({
      renderCount,
      averageRenderTime,
      slowRenders,
    });

    // Log slow renders in development
    if (process.env.NODE_ENV === 'development' && renderTime > 16) {
      console.warn(`Slow render detected: ${renderTime.toFixed(2)}ms`);
    }
  });

  return metrics;
}

/**
 * Advanced pagination hook with prefetching
 */
export function useAdvancedPagination(
  totalItems: number,
  pageSize: number = 10,
  prefetchPages: number = 2
) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(totalItems / pageSize);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      
      trackUserAction('pagination_navigate', 'pagination', {
        page,
        totalPages,
      });
    }
  }, [totalPages]);

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const previousPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  // Calculate pagination info
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  // Generate page numbers for pagination UI
  const getPageNumbers = useCallback(() => {
    const pages: (number | 'ellipsis')[] = [];
    const showPages = 5; // Show 5 page numbers
    const halfShow = Math.floor(showPages / 2);

    let startPage = Math.max(1, currentPage - halfShow);
    let endPage = Math.min(totalPages, currentPage + halfShow);

    // Adjust if we're near the beginning or end
    if (endPage - startPage + 1 < showPages) {
      if (startPage === 1) {
        endPage = Math.min(totalPages, startPage + showPages - 1);
      } else {
        startPage = Math.max(1, endPage - showPages + 1);
      }
    }

    // Add ellipsis and first page
    if (startPage > 2) {
      pages.push(1, 'ellipsis');
    } else if (startPage === 2) {
      pages.push(1);
    }

    // Add page numbers
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    // Add ellipsis and last page
    if (endPage < totalPages - 1) {
      pages.push('ellipsis', totalPages);
    } else if (endPage === totalPages - 1) {
      pages.push(totalPages);
    }

    return pages;
  }, [currentPage, totalPages]);

  return {
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    startIndex,
    endIndex,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    goToPage,
    nextPage,
    previousPage,
    getPageNumbers,
  };
}

/**
 * Local storage sync hook
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue] as const;
}

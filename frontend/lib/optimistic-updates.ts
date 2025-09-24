/**
 * Advanced Optimistic Updates and Real-time Features
 * Provides utilities for sophisticated optimistic updates with rollback mechanisms,
 * WebSocket integration, and data synchronization
 */

import { QueryClient } from '@tanstack/react-query'
import { Review, ApiResponse, PaginatedResponse } from './types'
import { QUERY_KEYS } from './constants'
import { toast } from './use-toast'

// Types for optimistic updates
export interface OptimisticUpdateConfig<T = any> {
  queryKey: string[]
  updater: (oldData: T | undefined) => T | undefined
  rollbackData?: T
  onSuccess?: (data: T) => void
  onError?: (error: Error, rollbackData: T) => void
  timeout?: number
}

export interface OptimisticAction {
  id: string
  timestamp: number
  queryKey: string[]
  originalData: any
  rollbackFn: () => void
}

export interface WebSocketMessage {
  type: 'review_updated' | 'review_approved' | 'review_rejected' | 'bulk_action_completed'
  data: any
  timestamp: number
  userId?: string
}

export interface ConflictResolutionStrategy {
  strategy: 'server_wins' | 'client_wins' | 'merge' | 'prompt_user'
  mergeFunction?: (serverData: any, clientData: any) => any
}

/**
 * Optimistic Update Manager
 * Handles sophisticated optimistic updates with rollback capabilities
 */
export class OptimisticUpdateManager {
  private queryClient: QueryClient
  private pendingActions: Map<string, OptimisticAction> = new Map()
  private rollbackTimeouts: Map<string, NodeJS.Timeout> = new Map()

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient
  }

  /**
   * Perform optimistic update with automatic rollback on failure
   */
  async performOptimisticUpdate<T>(
    config: OptimisticUpdateConfig<T>,
    asyncAction: () => Promise<any>
  ): Promise<T | undefined> {
    const actionId = `optimistic_${Date.now()}_${Math.random()}`
    
    // Store original data for rollback
    const originalData = this.queryClient.getQueryData<T>(config.queryKey)
    
    try {
      // Apply optimistic update immediately
      this.queryClient.setQueryData<T>(config.queryKey, config.updater)
      
      // Store rollback info
      const rollbackFn = () => {
        this.queryClient.setQueryData<T>(config.queryKey, originalData)
      }
      
      const action: OptimisticAction = {
        id: actionId,
        timestamp: Date.now(),
        queryKey: config.queryKey,
        originalData,
        rollbackFn,
      }
      
      this.pendingActions.set(actionId, action)
      
      // Set timeout for automatic rollback if no response
      if (config.timeout) {
        const timeoutId = setTimeout(() => {
          this.rollbackAction(actionId, new Error('Action timeout'))
        }, config.timeout)
        this.rollbackTimeouts.set(actionId, timeoutId)
      }
      
      // Perform the actual async action
      const result = await asyncAction()
      
      // Success - clean up and call success handler
      this.cleanupAction(actionId)
      config.onSuccess?.(result)
      
      // Update with server response
      if (result) {
        this.queryClient.setQueryData<T>(config.queryKey, result)
      }
      
      return result
    } catch (error) {
      // Error - rollback and call error handler
      this.rollbackAction(actionId, error as Error)
      config.onError?.(error as Error, originalData!)
      throw error
    }
  }

  /**
   * Optimistically update a single review
   */
  async updateReview(
    reviewId: string,
    updates: Partial<Review>,
    asyncAction: () => Promise<ApiResponse<Review>>
  ) {
    return this.performOptimisticUpdate(
      {
        queryKey: [QUERY_KEYS.REVIEWS, reviewId],
        updater: (oldData: ApiResponse<Review> | undefined) => {
          if (!oldData?.data) return oldData
          return {
            ...oldData,
            data: { ...oldData.data, ...updates }
          }
        },
        timeout: 10000, // 10 second timeout
        onError: (error) => {
          toast({
            title: 'Update Failed',
            description: error.message,
            variant: 'destructive',
          })
        }
      },
      asyncAction
    )
  }

  /**
   * Optimistically update reviews list
   */
  async updateReviewsList(
    filters: any,
    reviewId: string,
    updates: Partial<Review>,
    asyncAction: () => Promise<any>
  ) {
    return this.performOptimisticUpdate(
      {
        queryKey: [QUERY_KEYS.REVIEWS, filters],
        updater: (oldData: PaginatedResponse<Review> | undefined) => {
          if (!oldData?.data) return oldData
          return {
            ...oldData,
            data: oldData.data.map(review =>
              review.id === reviewId ? { ...review, ...updates } : review
            )
          }
        },
        timeout: 10000,
      },
      asyncAction
    )
  }

  /**
   * Optimistically perform bulk actions
   */
  async bulkUpdateReviews(
    filters: any,
    reviewIds: string[],
    updates: Partial<Review>,
    asyncAction: () => Promise<any>
  ) {
    const actionId = `bulk_${Date.now()}`
    const originalData = this.queryClient.getQueryData([QUERY_KEYS.REVIEWS, filters])

    try {
      // Apply optimistic updates to all selected reviews
      this.queryClient.setQueryData(
        [QUERY_KEYS.REVIEWS, filters],
        (oldData: PaginatedResponse<Review> | undefined) => {
          if (!oldData?.data) return oldData
          return {
            ...oldData,
            data: oldData.data.map(review =>
              reviewIds.includes(review.id) ? { ...review, ...updates } : review
            )
          }
        }
      )

      // Show progress notification
      toast({
        title: 'Processing...',
        description: `Updating ${reviewIds.length} reviews`,
      })

      const result = await asyncAction()

      // Success
      toast({
        title: 'Success',
        description: `${reviewIds.length} reviews updated successfully`,
        variant: 'default',
      })

      return result
    } catch (error) {
      // Rollback
      this.queryClient.setQueryData([QUERY_KEYS.REVIEWS, filters], originalData)
      
      toast({
        title: 'Bulk Action Failed',
        description: (error as Error).message,
        variant: 'destructive',
      })
      
      throw error
    }
  }

  /**
   * Rollback a specific action
   */
  private rollbackAction(actionId: string, error: Error) {
    const action = this.pendingActions.get(actionId)
    if (action) {
      action.rollbackFn()
      this.cleanupAction(actionId)
      
      console.warn(`Rolled back optimistic action ${actionId}:`, error)
    }
  }

  /**
   * Clean up action tracking
   */
  private cleanupAction(actionId: string) {
    this.pendingActions.delete(actionId)
    
    const timeoutId = this.rollbackTimeouts.get(actionId)
    if (timeoutId) {
      clearTimeout(timeoutId)
      this.rollbackTimeouts.delete(actionId)
    }
  }

  /**
   * Get pending actions count
   */
  getPendingActionsCount(): number {
    return this.pendingActions.size
  }

  /**
   * Clear all pending actions (useful for cleanup)
   */
  clearAllPendingActions() {
    this.rollbackTimeouts.forEach(timeout => clearTimeout(timeout))
    this.rollbackTimeouts.clear()
    this.pendingActions.clear()
  }
}

/**
 * WebSocket Manager for Real-time Updates
 */
export class WebSocketManager {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private messageHandlers: Map<string, ((data: any) => void)[]> = new Map()
  private queryClient: QueryClient

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient
  }

  /**
   * Connect to WebSocket server
   */
  connect(url: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return // Already connected
    }

    try {
      this.ws = new WebSocket(url)
      
      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.reconnectAttempts = 0
        
        toast({
          title: 'Real-time Updates',
          description: 'Connected to live updates',
        })
      }

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      this.ws.onclose = () => {
        console.log('WebSocket disconnected')
        this.attemptReconnect(url)
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
      this.attemptReconnect(url)
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  /**
   * Subscribe to message type
   */
  subscribe(messageType: string, handler: (data: any) => void) {
    const handlers = this.messageHandlers.get(messageType) || []
    handlers.push(handler)
    this.messageHandlers.set(messageType, handlers)
  }

  /**
   * Unsubscribe from message type
   */
  unsubscribe(messageType: string, handler: (data: any) => void) {
    const handlers = this.messageHandlers.get(messageType) || []
    const index = handlers.indexOf(handler)
    if (index > -1) {
      handlers.splice(index, 1)
      this.messageHandlers.set(messageType, handlers)
    }
  }

  /**
   * Send message via WebSocket
   */
  send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket not connected, cannot send message')
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: WebSocketMessage) {
    // Call registered handlers
    const handlers = this.messageHandlers.get(message.type) || []
    handlers.forEach(handler => {
      try {
        handler(message.data)
      } catch (error) {
        console.error('Error in message handler:', error)
      }
    })

    // Handle built-in message types
    switch (message.type) {
      case 'review_updated':
      case 'review_approved':
      case 'review_rejected':
        this.handleReviewUpdate(message.data)
        break
      
      case 'bulk_action_completed':
        this.handleBulkActionComplete(message.data)
        break
    }
  }

  /**
   * Handle review update messages
   */
  private handleReviewUpdate(reviewData: Review) {
    // Update specific review cache
    this.queryClient.setQueryData(
      [QUERY_KEYS.REVIEWS, reviewData.id],
      (oldData: ApiResponse<Review> | undefined) => {
        if (!oldData) return { success: true, data: reviewData }
        return { ...oldData, data: reviewData }
      }
    )

    // Update reviews list caches
    this.queryClient.setQueriesData(
      { queryKey: [QUERY_KEYS.REVIEWS] },
      (oldData: PaginatedResponse<Review> | undefined) => {
        if (!oldData?.data) return oldData
        return {
          ...oldData,
          data: oldData.data.map(review =>
            review.id === reviewData.id ? reviewData : review
          )
        }
      }
    )

    // Invalidate stats to refresh
    this.queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.REVIEW_STATS] })

    // Show notification for other users
    if (reviewData.approved !== null) {
      toast({
        title: 'Review Updated',
        description: `Review by ${reviewData.guest_name} was ${reviewData.approved ? 'approved' : 'rejected'}`,
      })
    }
  }

  /**
   * Handle bulk action completion messages
   */
  private handleBulkActionComplete(data: { updated: number, action: string }) {
    // Invalidate all review queries to refresh
    this.queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.REVIEWS] })
    this.queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.REVIEW_STATS] })

    toast({
      title: 'Bulk Action Complete',
      description: `${data.updated} reviews ${data.action}`,
    })
  }

  /**
   * Attempt to reconnect WebSocket
   */
  private attemptReconnect(url: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      toast({
        title: 'Connection Lost',
        description: 'Unable to maintain real-time connection',
        variant: 'destructive',
      })
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

    setTimeout(() => {
      console.log(`Attempting WebSocket reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
      this.connect(url)
    }, delay)
  }
}

/**
 * Conflict Resolution Utilities
 */
export class ConflictResolver {
  /**
   * Resolve conflicts between server and client data
   */
  static resolve<T>(
    serverData: T,
    clientData: T,
    strategy: ConflictResolutionStrategy
  ): T {
    switch (strategy.strategy) {
      case 'server_wins':
        return serverData
      
      case 'client_wins':
        return clientData
      
      case 'merge':
        if (strategy.mergeFunction) {
          return strategy.mergeFunction(serverData, clientData)
        }
        return { ...clientData, ...serverData } // Default merge
      
      case 'prompt_user':
        // In a real app, this would show a user dialog
        console.warn('Conflict detected, prompting user:', { serverData, clientData })
        return serverData // Fallback to server wins
      
      default:
        return serverData
    }
  }

  /**
   * Default merge strategy for review data
   */
  static mergeReviewData(serverReview: Review, clientReview: Review): Review {
    // Server wins for critical fields, client wins for UI state
    return {
      ...clientReview,
      ...serverReview,
      // Keep any client-side UI flags
      _optimistic: (clientReview as any)._optimistic,
      _pendingAction: (clientReview as any)._pendingAction,
    }
  }
}

/**
 * Offline State Management
 */
export class OfflineManager {
  private static STORAGE_KEY = 'flexapp_offline_actions'
  private queryClient: QueryClient

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient
  }

  /**
   * Queue action for when connection is restored
   */
  queueOfflineAction(action: {
    id: string
    type: string
    data: any
    timestamp: number
  }) {
    if (typeof localStorage === 'undefined') return

    const queue = this.getOfflineQueue()
    queue.push(action)
    localStorage.setItem(OfflineManager.STORAGE_KEY, JSON.stringify(queue))
  }

  /**
   * Get offline action queue
   */
  getOfflineQueue() {
    if (typeof localStorage === 'undefined') return []
    
    try {
      const stored = localStorage.getItem(OfflineManager.STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  /**
   * Process offline action queue when connection is restored
   */
  async processOfflineQueue() {
    const queue = this.getOfflineQueue()
    if (queue.length === 0) return

    console.log(`Processing ${queue.length} offline actions`)

    for (const action of queue) {
      try {
        // Process each action based on type
        await this.processOfflineAction(action)
      } catch (error) {
        console.error('Failed to process offline action:', action, error)
      }
    }

    // Clear the queue
    localStorage.removeItem(OfflineManager.STORAGE_KEY)
  }

  /**
   * Process individual offline action
   */
  private async processOfflineAction(action: any) {
    switch (action.type) {
      case 'approve_review':
        // Re-attempt review approval
        break
      
      case 'bulk_approve':
        // Re-attempt bulk approval
        break
      
      default:
        console.warn('Unknown offline action type:', action.type)
    }
  }

  /**
   * Clear offline queue
   */
  clearOfflineQueue() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(OfflineManager.STORAGE_KEY)
    }
  }
}

/**
 * Performance Monitoring for Optimistic Updates
 */
export class OptimisticUpdateMonitor {
  private metrics: Map<string, {
    startTime: number
    endTime?: number
    success: boolean
    rollbacks: number
  }> = new Map()

  /**
   * Start tracking an optimistic update
   */
  startTracking(actionId: string) {
    this.metrics.set(actionId, {
      startTime: Date.now(),
      success: false,
      rollbacks: 0,
    })
  }

  /**
   * Mark action as successful
   */
  markSuccess(actionId: string) {
    const metric = this.metrics.get(actionId)
    if (metric) {
      metric.endTime = Date.now()
      metric.success = true
    }
  }

  /**
   * Mark action as rolled back
   */
  markRollback(actionId: string) {
    const metric = this.metrics.get(actionId)
    if (metric) {
      metric.rollbacks++
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const metrics = Array.from(this.metrics.values())
    return {
      totalActions: metrics.length,
      successfulActions: metrics.filter(m => m.success).length,
      totalRollbacks: metrics.reduce((sum, m) => sum + m.rollbacks, 0),
      averageResponseTime: metrics
        .filter(m => m.endTime)
        .reduce((sum, m) => sum + (m.endTime! - m.startTime), 0) / 
        metrics.filter(m => m.endTime).length || 0,
    }
  }

  /**
   * Clear metrics
   */
  clearMetrics() {
    this.metrics.clear()
  }
}

// Export convenience functions
export const createOptimisticUpdateManager = (queryClient: QueryClient) => 
  new OptimisticUpdateManager(queryClient)

export const createWebSocketManager = (queryClient: QueryClient) => 
  new WebSocketManager(queryClient)

export const createOfflineManager = (queryClient: QueryClient) => 
  new OfflineManager(queryClient)

export const createOptimisticUpdateMonitor = () => 
  new OptimisticUpdateMonitor()

// Debug utilities for development
export const debugOptimisticUpdates = {
  logPendingActions: (manager: OptimisticUpdateManager) => {
    console.log('Pending optimistic actions:', manager.getPendingActionsCount())
  },
  
  logWebSocketStatus: (manager: WebSocketManager) => {
    console.log('WebSocket status:', (manager as any).ws?.readyState)
  },
  
  logOfflineQueue: (manager: OfflineManager) => {
    console.log('Offline queue:', manager.getOfflineQueue())
  },
}

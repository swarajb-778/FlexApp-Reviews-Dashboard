/**
 * Performance Monitoring and Analytics System
 * Provides comprehensive tracking of Core Web Vitals, user interactions,
 * API performance, and business metrics for the FlexLiving reviews dashboard
 */

import { APP_CONFIG } from './constants'

// Types for analytics events
export interface AnalyticsEvent {
  name: string
  properties?: Record<string, any>
  timestamp?: number
  userId?: string
  sessionId?: string
}

export interface PerformanceMetric {
  name: string
  value: number
  unit: 'ms' | 'bytes' | 'count' | 'percent'
  timestamp: number
  metadata?: Record<string, any>
}

export interface UserInteraction {
  action: string
  element: string
  page: string
  timestamp: number
  metadata?: Record<string, any>
}

export interface APIPerformanceData {
  method: string
  url: string
  status: number
  duration: number
  size?: number
  timestamp: number
  error?: string
}

export interface CoreWebVitals {
  fcp: number // First Contentful Paint
  lcp: number // Largest Contentful Paint
  fid: number // First Input Delay
  cls: number // Cumulative Layout Shift
  ttfb: number // Time to First Byte
  inp?: number // Interaction to Next Paint (new metric)
}

/**
 * Core Web Vitals Tracker
 */
export class CoreWebVitalsTracker {
  private observer: PerformanceObserver | null = null
  private metrics: Partial<CoreWebVitals> = {}
  private callbacks: ((metrics: Partial<CoreWebVitals>) => void)[] = []

  constructor() {
    this.initializeTracking()
  }

  /**
   * Initialize Core Web Vitals tracking
   */
  private initializeTracking() {
    if (typeof window === 'undefined') return

    // Track FCP (First Contentful Paint)
    this.trackFCP()
    
    // Track LCP (Largest Contentful Paint)
    this.trackLCP()
    
    // Track FID (First Input Delay)
    this.trackFID()
    
    // Track CLS (Cumulative Layout Shift)
    this.trackCLS()
    
    // Track TTFB (Time to First Byte)
    this.trackTTFB()
    
    // Track INP (Interaction to Next Paint) - newer metric
    this.trackINP()
  }

  /**
   * Subscribe to metrics updates
   */
  subscribe(callback: (metrics: Partial<CoreWebVitals>) => void) {
    this.callbacks.push(callback)
    return () => {
      const index = this.callbacks.indexOf(callback)
      if (index > -1) this.callbacks.splice(index, 1)
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): Partial<CoreWebVitals> {
    return { ...this.metrics }
  }

  /**
   * Track First Contentful Paint
   */
  private trackFCP() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntriesByName('first-contentful-paint')
      if (entries.length > 0) {
        this.updateMetric('fcp', entries[0].startTime)
        observer.disconnect()
      }
    })
    observer.observe({ entryTypes: ['paint'] })
  }

  /**
   * Track Largest Contentful Paint
   */
  private trackLCP() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      if (entries.length > 0) {
        const lastEntry = entries[entries.length - 1]
        this.updateMetric('lcp', lastEntry.startTime)
      }
    })
    observer.observe({ entryTypes: ['largest-contentful-paint'] })
    
    // Also track on page visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        observer.takeRecords()
        observer.disconnect()
      }
    })
  }

  /**
   * Track First Input Delay
   */
  private trackFID() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry: any) => {
        if (entry.name === 'first-input') {
          this.updateMetric('fid', entry.processingStart - entry.startTime)
        }
      })
    })
    observer.observe({ entryTypes: ['first-input'] })
  }

  /**
   * Track Cumulative Layout Shift
   */
  private trackCLS() {
    let clsValue = 0
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value
          this.updateMetric('cls', clsValue)
        }
      })
    })
    observer.observe({ entryTypes: ['layout-shift'] })
  }

  /**
   * Track Time to First Byte
   */
  private trackTTFB() {
    const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (navigationTiming) {
      const ttfb = navigationTiming.responseStart - navigationTiming.requestStart
      this.updateMetric('ttfb', ttfb)
    }
  }

  /**
   * Track Interaction to Next Paint (newer metric)
   */
  private trackINP() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry: any) => {
        if (entry.interactionId) {
          this.updateMetric('inp', entry.duration)
        }
      })
    })
    
    try {
      observer.observe({ entryTypes: ['event'] })
    } catch (e) {
      // INP might not be supported yet
      console.debug('INP tracking not supported')
    }
  }

  /**
   * Update a metric and notify subscribers
   */
  private updateMetric(name: keyof CoreWebVitals, value: number) {
    this.metrics[name] = value
    this.callbacks.forEach(callback => callback(this.metrics))
    
    // Log performance budget violations
    this.checkPerformanceBudget(name, value)
  }

  /**
   * Check performance budgets
   */
  private checkPerformanceBudget(metric: keyof CoreWebVitals, value: number) {
    const budgets = {
      fcp: 1800, // 1.8s
      lcp: 2500, // 2.5s
      fid: 100,  // 100ms
      cls: 0.1,  // 0.1
      ttfb: 800, // 800ms
      inp: 200,  // 200ms
    }

    if (value > budgets[metric]) {
      console.warn(`Performance budget exceeded for ${metric}: ${value} > ${budgets[metric]}`)
      
      // Send alert to monitoring service
      this.sendPerformanceAlert(metric, value, budgets[metric])
    }
  }

  /**
   * Send performance alert
   */
  private sendPerformanceAlert(metric: string, value: number, budget: number) {
    // In production, this would send to your monitoring service
    const alert = {
      type: 'performance_budget_exceeded',
      metric,
      value,
      budget,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    }
    
    console.warn('Performance Alert:', alert)
  }
}

/**
 * User Interaction Analytics
 */
export class UserInteractionTracker {
  private interactions: UserInteraction[] = []
  private sessionId: string
  private userId?: string

  constructor() {
    this.sessionId = this.generateSessionId()
    this.initializeTracking()
  }

  /**
   * Set user ID for tracking
   */
  setUserId(userId: string) {
    this.userId = userId
  }

  /**
   * Track user interaction
   */
  track(action: string, element: string, metadata?: Record<string, any>) {
    const interaction: UserInteraction = {
      action,
      element,
      page: window.location.pathname,
      timestamp: Date.now(),
      metadata: {
        ...metadata,
        userId: this.userId,
        sessionId: this.sessionId,
      },
    }

    this.interactions.push(interaction)
    this.sendInteraction(interaction)

    // Keep only last 100 interactions in memory
    if (this.interactions.length > 100) {
      this.interactions.shift()
    }
  }

  /**
   * Track review approval action
   */
  trackReviewApproval(reviewId: string, approved: boolean, method: 'single' | 'bulk' = 'single') {
    this.track('review_approval', 'approval_button', {
      reviewId,
      approved,
      method,
      value: approved ? 1 : 0,
    })
  }

  /**
   * Track filter usage
   */
  trackFilterUsage(filterType: string, filterValue: any) {
    this.track('filter_applied', 'filter_panel', {
      filterType,
      filterValue,
    })
  }

  /**
   * Track search usage
   */
  trackSearch(query: string, resultsCount: number) {
    this.track('search_performed', 'search_input', {
      query: query.length, // Don't store actual query for privacy
      resultsCount,
    })
  }

  /**
   * Track page view
   */
  trackPageView(page: string, metadata?: Record<string, any>) {
    this.track('page_view', 'navigation', {
      page,
      referrer: document.referrer,
      ...metadata,
    })
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(feature: string, metadata?: Record<string, any>) {
    this.track('feature_used', feature, metadata)
  }

  /**
   * Get interaction history
   */
  getInteractions(): UserInteraction[] {
    return [...this.interactions]
  }

  /**
   * Get user session summary
   */
  getSessionSummary() {
    const interactions = this.getInteractions()
    const actions = interactions.reduce((acc, interaction) => {
      acc[interaction.action] = (acc[interaction.action] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const pages = [...new Set(interactions.map(i => i.page))]
    const sessionDuration = interactions.length > 0 
      ? Date.now() - interactions[0].timestamp
      : 0

    return {
      sessionId: this.sessionId,
      userId: this.userId,
      duration: sessionDuration,
      interactions: interactions.length,
      actions,
      pages,
    }
  }

  /**
   * Initialize automatic tracking
   */
  private initializeTracking() {
    if (typeof window === 'undefined') return

    // Track clicks on important elements
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      if (target.matches('[data-analytics]')) {
        const action = target.getAttribute('data-analytics') || 'click'
        const element = target.tagName.toLowerCase()
        this.track(action, element, {
          text: target.textContent?.slice(0, 50),
          className: target.className,
        })
      }
    })

    // Track form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement
      if (form.matches('[data-analytics]')) {
        this.track('form_submit', 'form', {
          formId: form.id,
          action: form.action,
        })
      }
    })

    // Track scroll depth
    this.trackScrollDepth()

    // Track time on page
    this.trackTimeOnPage()
  }

  /**
   * Track scroll depth
   */
  private trackScrollDepth() {
    let maxScroll = 0
    const trackingPoints = [25, 50, 75, 90, 100]
    const tracked = new Set<number>()

    const handleScroll = () => {
      const scrollPercent = Math.round(
        (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
      )
      maxScroll = Math.max(maxScroll, scrollPercent)

      trackingPoints.forEach(point => {
        if (scrollPercent >= point && !tracked.has(point)) {
          tracked.add(point)
          this.track('scroll_depth', 'page', { depth: point })
        }
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
  }

  /**
   * Track time on page
   */
  private trackTimeOnPage() {
    const startTime = Date.now()
    
    const sendTimeOnPage = () => {
      const timeSpent = Date.now() - startTime
      this.track('time_on_page', 'page', { 
        duration: timeSpent,
        url: window.location.href,
      })
    }

    window.addEventListener('beforeunload', sendTimeOnPage)
    
    // Also send periodically for long sessions
    setInterval(sendTimeOnPage, 30000) // Every 30 seconds
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Send interaction to analytics service
   */
  private sendInteraction(interaction: UserInteraction) {
    // In production, send to your analytics service
    if (process.env.NODE_ENV === 'development') {
      console.debug('User Interaction:', interaction)
    }
  }
}

/**
 * API Performance Tracker
 */
export class APIPerformanceTracker {
  private requests: APIPerformanceData[] = []
  private slowRequestThreshold = 1000 // 1 second

  /**
   * Track API request performance
   */
  trackRequest(data: APIPerformanceData) {
    this.requests.push(data)
    
    // Keep only last 100 requests in memory
    if (this.requests.length > 100) {
      this.requests.shift()
    }

    // Check for slow requests
    if (data.duration > this.slowRequestThreshold) {
      this.handleSlowRequest(data)
    }

    // Check for errors
    if (data.status >= 400) {
      this.handleErrorRequest(data)
    }
  }

  /**
   * Get request performance metrics
   */
  getMetrics() {
    const requests = this.requests
    if (requests.length === 0) return null

    const successful = requests.filter(r => r.status < 400)
    const errors = requests.filter(r => r.status >= 400)
    
    const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length
    const slowRequests = requests.filter(r => r.duration > this.slowRequestThreshold)

    return {
      totalRequests: requests.length,
      successfulRequests: successful.length,
      errorRequests: errors.length,
      averageDuration: avgDuration,
      slowRequests: slowRequests.length,
      errorRate: (errors.length / requests.length) * 100,
      slowRequestRate: (slowRequests.length / requests.length) * 100,
    }
  }

  /**
   * Get requests by endpoint
   */
  getRequestsByEndpoint() {
    const endpoints: Record<string, APIPerformanceData[]> = {}
    
    this.requests.forEach(request => {
      const endpoint = this.extractEndpoint(request.url)
      if (!endpoints[endpoint]) {
        endpoints[endpoint] = []
      }
      endpoints[endpoint].push(request)
    })

    return Object.entries(endpoints).map(([endpoint, requests]) => {
      const avgDuration = requests.reduce((sum, r) => sum + r.duration, 0) / requests.length
      const errorRate = (requests.filter(r => r.status >= 400).length / requests.length) * 100

      return {
        endpoint,
        requestCount: requests.length,
        averageDuration,
        errorRate,
      }
    })
  }

  /**
   * Handle slow request
   */
  private handleSlowRequest(data: APIPerformanceData) {
    console.warn(`Slow API request detected: ${data.method} ${data.url} took ${data.duration}ms`)
    
    // Send to monitoring service
    this.sendAlert('slow_request', data)
  }

  /**
   * Handle error request
   */
  private handleErrorRequest(data: APIPerformanceData) {
    console.error(`API request failed: ${data.method} ${data.url} - ${data.status}`)
    
    // Send to error tracking service
    this.sendAlert('request_error', data)
  }

  /**
   * Extract endpoint from URL
   */
  private extractEndpoint(url: string): string {
    try {
      const urlObj = new URL(url, window.location.origin)
      return urlObj.pathname.replace(/\/\d+/g, '/:id') // Replace IDs with :id
    } catch {
      return url
    }
  }

  /**
   * Send alert to monitoring service
   */
  private sendAlert(type: string, data: APIPerformanceData) {
    // In production, send to your monitoring service
    if (process.env.NODE_ENV === 'development') {
      console.debug(`API Alert [${type}]:`, data)
    }
  }
}

/**
 * Business Metrics Tracker
 */
export class BusinessMetricsTracker {
  /**
   * Track review approval metrics
   */
  trackReviewMetrics(approved: boolean, rating: number, channel: string) {
    const event: AnalyticsEvent = {
      name: 'review_processed',
      properties: {
        approved,
        rating,
        channel,
        timestamp: Date.now(),
      },
    }

    this.sendEvent(event)
  }

  /**
   * Track user engagement metrics
   */
  trackEngagementMetrics(action: string, value: number) {
    const event: AnalyticsEvent = {
      name: 'user_engagement',
      properties: {
        action,
        value,
        timestamp: Date.now(),
      },
    }

    this.sendEvent(event)
  }

  /**
   * Track feature adoption
   */
  trackFeatureAdoption(feature: string, adopted: boolean) {
    const event: AnalyticsEvent = {
      name: 'feature_adoption',
      properties: {
        feature,
        adopted,
        timestamp: Date.now(),
      },
    }

    this.sendEvent(event)
  }

  /**
   * Send event to analytics service
   */
  private sendEvent(event: AnalyticsEvent) {
    // In production, send to your analytics service
    if (process.env.NODE_ENV === 'development') {
      console.debug('Business Metric:', event)
    }
  }
}

/**
 * Error Tracking
 */
export class ErrorTracker {
  private errors: Array<{
    message: string
    stack?: string
    timestamp: number
    url: string
    userAgent: string
    userId?: string
  }> = []

  constructor() {
    this.initializeErrorTracking()
  }

  /**
   * Initialize error tracking
   */
  private initializeErrorTracking() {
    if (typeof window === 'undefined') return

    // Track unhandled errors
    window.addEventListener('error', (event) => {
      this.trackError({
        message: event.message,
        stack: event.error?.stack,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      })
    })

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      })
    })
  }

  /**
   * Track custom error
   */
  trackError(error: {
    message: string
    stack?: string
    timestamp: number
    url: string
    userAgent: string
    userId?: string
  }) {
    this.errors.push(error)
    
    // Keep only last 50 errors in memory
    if (this.errors.length > 50) {
      this.errors.shift()
    }

    // Send to error tracking service
    this.sendErrorReport(error)
  }

  /**
   * Get error summary
   */
  getErrorSummary() {
    return {
      totalErrors: this.errors.length,
      recentErrors: this.errors.slice(-10),
      errorsByType: this.groupErrorsByType(),
    }
  }

  /**
   * Group errors by type
   */
  private groupErrorsByType() {
    const grouped: Record<string, number> = {}
    
    this.errors.forEach(error => {
      const type = this.categorizeError(error.message)
      grouped[type] = (grouped[type] || 0) + 1
    })

    return grouped
  }

  /**
   * Categorize error by message
   */
  private categorizeError(message: string): string {
    if (message.includes('Network')) return 'Network Error'
    if (message.includes('TypeError')) return 'Type Error'
    if (message.includes('ReferenceError')) return 'Reference Error'
    if (message.includes('API')) return 'API Error'
    return 'Unknown Error'
  }

  /**
   * Send error report to service
   */
  private sendErrorReport(error: any) {
    // In production, send to your error tracking service (e.g., Sentry)
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Tracked:', error)
    }
  }
}

/**
 * A/B Testing Framework
 */
export class ABTestingFramework {
  private experiments: Record<string, {
    variant: string
    enrolled: boolean
  }> = {}

  /**
   * Get variant for experiment
   */
  getVariant(experimentName: string, variants: string[]): string {
    if (this.experiments[experimentName]) {
      return this.experiments[experimentName].variant
    }

    // Assign user to variant based on user ID or session
    const variant = variants[this.hashUserId(experimentName) % variants.length]
    
    this.experiments[experimentName] = {
      variant,
      enrolled: true,
    }

    this.trackExperiment(experimentName, variant)
    return variant
  }

  /**
   * Track experiment enrollment
   */
  private trackExperiment(experimentName: string, variant: string) {
    const event: AnalyticsEvent = {
      name: 'experiment_enrolled',
      properties: {
        experimentName,
        variant,
        timestamp: Date.now(),
      },
    }

    // Send to analytics service
    if (process.env.NODE_ENV === 'development') {
      console.debug('A/B Test Enrollment:', event)
    }
  }

  /**
   * Hash user ID for consistent variant assignment
   */
  private hashUserId(seed: string): number {
    let hash = 0
    const str = `${seed}_${navigator.userAgent}_${window.location.hostname}`
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    
    return Math.abs(hash)
  }
}

/**
 * Main Analytics Manager
 */
export class AnalyticsManager {
  public coreWebVitals: CoreWebVitalsTracker
  public userInteraction: UserInteractionTracker
  public apiPerformance: APIPerformanceTracker
  public businessMetrics: BusinessMetricsTracker
  public errorTracker: ErrorTracker
  public abTesting: ABTestingFramework

  constructor() {
    this.coreWebVitals = new CoreWebVitalsTracker()
    this.userInteraction = new UserInteractionTracker()
    this.apiPerformance = new APIPerformanceTracker()
    this.businessMetrics = new BusinessMetricsTracker()
    this.errorTracker = new ErrorTracker()
    this.abTesting = new ABTestingFramework()
  }

  /**
   * Initialize analytics with user context
   */
  initialize(userId?: string) {
    if (userId) {
      this.userInteraction.setUserId(userId)
    }

    // Track initial page view
    this.userInteraction.trackPageView(window.location.pathname)

    // Set up Core Web Vitals reporting
    this.coreWebVitals.subscribe((metrics) => {
      this.sendMetrics('core_web_vitals', metrics)
    })
  }

  /**
   * Get comprehensive analytics dashboard data
   */
  getDashboardData() {
    return {
      coreWebVitals: this.coreWebVitals.getMetrics(),
      apiMetrics: this.apiPerformance.getMetrics(),
      userSession: this.userInteraction.getSessionSummary(),
      errors: this.errorTracker.getErrorSummary(),
      timestamp: Date.now(),
    }
  }

  /**
   * Send metrics to external service
   */
  private sendMetrics(type: string, data: any) {
    // In production, send to your analytics service
    if (process.env.NODE_ENV === 'development') {
      console.debug(`Analytics [${type}]:`, data)
    }
  }

  /**
   * Clean up analytics (call on app unmount)
   */
  cleanup() {
    // Clean up event listeners and observers
    // Implementation would depend on specific cleanup needs
  }
}

// Create singleton instance
export const analytics = new AnalyticsManager()

// Export convenience functions
export const trackUserAction = (action: string, element: string, metadata?: Record<string, any>) => 
  analytics.userInteraction.track(action, element, metadata)

export const trackAPIRequest = (data: APIPerformanceData) => 
  analytics.apiPerformance.trackRequest(data)

export const trackError = (message: string, stack?: string) => 
  analytics.errorTracker.trackError({
    message,
    stack,
    timestamp: Date.now(),
    url: window.location.href,
    userAgent: navigator.userAgent,
  })

export const trackPerformanceMetric = (metric: { name: string; value: number; unit: string; data?: Record<string, any> }) => {
  // Send as a generic analytics event (or wire to a real sink later)
  analytics.userInteraction.track('performance_metric', metric.name, {
    value: metric.value,
    unit: metric.unit,
    ...metric.data,
  })
}

export const getABTestVariant = (experimentName: string, variants: string[]) => 
  analytics.abTesting.getVariant(experimentName, variants)

// Initialize analytics on import (browser only)
if (typeof window !== 'undefined') {
  analytics.initialize()
}

export default analytics

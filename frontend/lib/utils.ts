import clsx, { type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow, parseISO } from "date-fns"

/**
 * Utility function to merge and conditionally apply Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date string or Date object to a readable format
 */
export function formatDate(date: string | Date, formatStr: string = "MMM dd, yyyy"): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date
  return format(dateObj, formatStr)
}

/**
 * Format a date to show relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date
  return formatDistanceToNow(dateObj, { addSuffix: true })
}

/**
 * Format a rating number to display with one decimal place
 */
export function formatRating(rating: number): string {
  return rating.toFixed(1)
}

/**
 * Get rating color class based on rating value
 */
export function getRatingColor(rating: number): string {
  if (rating >= 4.5) return "text-green-600"
  if (rating >= 4.0) return "text-blue-600" 
  if (rating >= 3.5) return "text-yellow-600"
  if (rating >= 3.0) return "text-orange-600"
  return "text-red-600"
}

/**
 * Get rating background color class for badges
 */
export function getRatingBgColor(rating: number): string {
  if (rating >= 4.5) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
  if (rating >= 4.0) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
  if (rating >= 3.5) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
  if (rating >= 3.0) return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"
  return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
}

/**
 * Truncate text to specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + "..."
}

/**
 * Capitalize first letter of each word
 */
export function capitalize(text: string): string {
  return text.replace(/\b\w/g, (char) => char.toUpperCase())
}

/**
 * Convert snake_case or kebab-case to Title Case
 */
export function toTitleCase(text: string): string {
  return text
    .replace(/[_-]/g, " ")
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}

/**
 * Generate initials from a name
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map(word => word.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Get approval status display info
 */
export function getApprovalStatusInfo(approved: boolean | null) {
  if (approved === true) {
    return {
      label: "Approved",
      variant: "default" as const,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900"
    }
  }
  if (approved === false) {
    return {
      label: "Rejected",
      variant: "destructive" as const,
      color: "text-red-600", 
      bgColor: "bg-red-100 dark:bg-red-900"
    }
  }
  return {
    label: "Pending",
    variant: "secondary" as const,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100 dark:bg-yellow-900"
  }
}

/**
 * Calculate average rating from category ratings
 */
export function calculateAverageRating(categoryRatings: Record<string, number>): number {
  const ratings = Object.values(categoryRatings).filter(rating => rating > 0)
  if (ratings.length === 0) return 0
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
}

/**
 * Format currency with proper localization
 */
export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount)
}

/**
 * Debounce function for search inputs
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(null, args), wait)
  }
}

/**
 * Sleep utility for delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Generate a random ID
 */
export function generateId(length: number = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: any): boolean {
  if (value == null) return true
  if (typeof value === "string") return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === "object") return Object.keys(value).length === 0
  return false
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T
  if (Array.isArray(obj)) return obj.map(deepClone) as unknown as T
  
  const cloned = {} as T
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key])
    }
  }
  return cloned
}

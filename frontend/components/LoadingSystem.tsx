'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Star,
  User,
  Building,
  Calendar,
  MessageSquare,
  BarChart3,
  Settings,
  RefreshCw,
  Zap,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { flexLivingComponents } from '@/lib/theme';

// ===== SKELETON COMPONENTS =====

export interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'rounded' | 'circular';
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
}

export function Skeleton({ 
  className, 
  variant = 'default', 
  animation = 'shimmer' 
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-muted',
        variant === 'rounded' && 'rounded-md',
        variant === 'circular' && 'rounded-full',
        animation === 'pulse' && 'animate-pulse',
        animation === 'shimmer' && 'flex-skeleton',
        animation === 'wave' && 'shimmer',
        className
      )}
    />
  );
}

export function SkeletonText({ 
  lines = 1, 
  className 
}: { 
  lines?: number; 
  className?: string; 
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4',
            i === lines - 1 ? 'w-3/4' : 'w-full'
          )}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ 
  size = 'md',
  className 
}: { 
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  return (
    <Skeleton
      variant="circular"
      className={cn(sizeClasses[size], className)}
    />
  );
}

// ===== SPECIALIZED LOADING COMPONENTS =====

export function ReviewCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <Card style={flexLivingComponents.managerCard}>
      <CardHeader className={cn('pb-3', compact && 'pb-2')}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <SkeletonAvatar size={compact ? 'sm' : 'md'} />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <div className="flex items-center space-x-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-20" />
            {!compact && <Skeleton className="h-3 w-16" />}
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn('py-4', compact && 'py-2')}>
        <div className="space-y-3">
          <div className="flex items-center space-x-2 p-2 bg-muted/30 rounded-lg">
            <Building className="h-4 w-4 text-muted-foreground" />
            <Skeleton className="h-4 w-48" />
          </div>
          <SkeletonText lines={compact ? 2 : 3} />
          {!compact && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="text-center space-y-1">
                  <Skeleton className="h-3 w-16 mx-auto" />
                  <Skeleton className="h-5 w-12 mx-auto" />
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ReviewsTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-5 w-8 rounded-full" />
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        {/* Table Header */}
        <div className="border-b p-4">
          <div className="grid grid-cols-8 gap-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-4" />
          </div>
        </div>

        {/* Table Rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="border-b last:border-b-0 p-4">
            <div className="grid grid-cols-8 gap-4 items-center">
              <Skeleton className="h-4 w-4" />
              <div className="flex items-center space-x-3">
                <SkeletonAvatar size="sm" />
                <div className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <div className="flex items-center space-x-1">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="h-3 w-3" variant="circular" />
                ))}
              </div>
              <SkeletonText lines={1} className="max-w-xs" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-6 w-6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FiltersPanelSkeleton() {
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-16" />
          </div>
          <Skeleton className="h-8 w-8" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
            {i < 5 && <Separator />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function AnalyticsCardSkeleton() {
  return (
    <Card style={flexLivingComponents.managerCard}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <Skeleton className="h-3 w-3" />
            <Skeleton className="h-4 w-8" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ChartSkeleton({ type = 'bar' }: { type?: 'bar' | 'line' | 'donut' }) {
  return (
    <Card style={flexLivingComponents.managerCard}>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-5 w-32" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 flex items-end justify-between space-x-2">
          {type === 'bar' && (
            Array.from({ length: 8 }).map((_, i) => (
              <Skeleton
                key={i}
                className="w-full"
                style={{ height: `${Math.random() * 80 + 20}%` }}
              />
            ))
          )}
          {type === 'line' && (
            <div className="w-full h-full relative">
              <Skeleton className="absolute inset-0" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-px bg-muted-foreground/20" />
              </div>
            </div>
          )}
          {type === 'donut' && (
            <div className="mx-auto">
              <Skeleton className="h-32 w-32" variant="circular" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ===== LOADING STATES =====

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

export function LoadingSpinner({ 
  size = 'md', 
  className, 
  text 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="flex flex-col items-center space-y-2">
        <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
        {text && (
          <p className="text-sm text-muted-foreground">{text}</p>
        )}
      </div>
    </div>
  );
}

export interface ProgressLoaderProps {
  progress: number;
  title?: string;
  description?: string;
  className?: string;
}

export function ProgressLoader({ 
  progress, 
  title = 'Loading...', 
  description,
  className 
}: ProgressLoaderProps) {
  return (
    <div className={cn('w-full max-w-md space-y-4', className)}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{title}</h3>
          <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="w-full" />
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

export interface LoadingOverlayProps {
  isLoading: boolean;
  children: React.ReactNode;
  text?: string;
  backdrop?: boolean;
  className?: string;
}

export function LoadingOverlay({ 
  isLoading, 
  children, 
  text = 'Loading...',
  backdrop = true,
  className 
}: LoadingOverlayProps) {
  return (
    <div className={cn('relative', className)}>
      {children}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              'absolute inset-0 z-50 flex items-center justify-center',
              backdrop && 'bg-background/80 backdrop-blur-sm'
            )}
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm font-medium">{text}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== SPECIALIZED LOADING STATES =====

export function PageLoadingState({ 
  message = 'Loading page...', 
  showProgress = false,
  progress = 0 
}: { 
  message?: string; 
  showProgress?: boolean;
  progress?: number;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-6"
      >
        <div className="space-y-4">
          <div className="relative">
            <div className="flex items-center justify-center">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-6 w-6 bg-primary/20 rounded-full animate-ping" />
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{message}</h2>
            <p className="text-muted-foreground">
              Please wait while we prepare your content
            </p>
          </div>

          {showProgress && (
            <div className="w-64 mx-auto">
              <ProgressLoader progress={progress} title="" />
            </div>
          )}
        </div>

        {/* Decorative elements */}
        <div className="flex items-center justify-center space-x-4 opacity-50">
          <div className="h-2 w-2 bg-primary rounded-full animate-bounce" />
          <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
          <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
        </div>
      </motion.div>
    </div>
  );
}

export function DataLoadingState({ 
  type = 'reviews',
  count = 0 
}: { 
  type?: 'reviews' | 'properties' | 'analytics';
  count?: number;
}) {
  const getIcon = () => {
    switch (type) {
      case 'reviews': return MessageSquare;
      case 'properties': return Building;
      case 'analytics': return BarChart3;
      default: return Loader2;
    }
  };

  const Icon = getIcon();

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="relative">
        <Icon className="h-8 w-8 text-muted-foreground animate-pulse" />
        <div className="absolute -inset-1">
          <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
      
      <div className="text-center space-y-1">
        <h3 className="font-medium">Loading {type}...</h3>
        {count > 0 && (
          <p className="text-sm text-muted-foreground">
            Processing {count.toLocaleString()} items
          </p>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ 
  icon: Icon = MessageSquare,
  title,
  description,
  action,
  className 
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      <div className="space-y-4">
        <div className="mx-auto w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          {description && (
            <p className="text-muted-foreground max-w-sm mx-auto">
              {description}
            </p>
          )}
        </div>

        {action && (
          <div className="mt-6">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== HIGHER-ORDER COMPONENTS =====

export function withLoading<P extends object>(
  Component: React.ComponentType<P>,
  LoadingComponent: React.ComponentType = LoadingSpinner
) {
  return function WrappedComponent(props: P & { isLoading?: boolean; loadingText?: string }) {
    const { isLoading, loadingText, ...componentProps } = props;
    
    if (isLoading) {
      return <LoadingComponent text={loadingText} />;
    }
    
    return <Component {...(componentProps as P)} />;
  };
}

// ===== HOOK FOR LOADING STATES =====

export function useLoadingState(initialState = false) {
  const [isLoading, setIsLoading] = React.useState(initialState);
  const [loadingText, setLoadingText] = React.useState<string>('');

  const startLoading = (text = 'Loading...') => {
    setLoadingText(text);
    setIsLoading(true);
  };

  const stopLoading = () => {
    setIsLoading(false);
    setLoadingText('');
  };

  const withLoadingAction = async <T,>(
    action: () => Promise<T>,
    loadingMessage = 'Loading...'
  ): Promise<T> => {
    startLoading(loadingMessage);
    try {
      return await action();
    } finally {
      stopLoading();
    }
  };

  return {
    isLoading,
    loadingText,
    startLoading,
    stopLoading,
    withLoadingAction,
  };
}

// Main LoadingSystem component - re-export commonly used components
export const LoadingSystem = LoadingSpinner;

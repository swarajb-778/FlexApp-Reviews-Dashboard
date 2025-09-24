'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertTriangle,
  RefreshCw,
  Bug,
  ChevronDown,
  Copy,
  Send,
  Home,
  ArrowLeft,
  Shield,
  Info,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { flexLivingComponents } from '@/lib/theme';
import { trackUserAction } from '@/lib/analytics';
import { toast } from '@/lib/use-toast';

interface ErrorInfo {
  componentStack: string;
  errorBoundary: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  showDetails: boolean;
  showReportDialog: boolean;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showReportButton?: boolean;
  enableRetry?: boolean;
  maxRetries?: number;
  level?: 'page' | 'component' | 'critical';
  className?: string;
}

class ErrorBoundaryClass extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      showDetails: false,
      showReportDialog: false,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Generate unique error ID
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, level = 'component' } = this.props;
    
    this.setState({
      errorInfo,
    });

    // Track error in analytics
    trackUserAction('error_boundary_triggered', 'error_handling', {
      errorMessage: error.message,
      errorStack: error.stack?.substring(0, 500), // Limit stack trace length
      componentStack: errorInfo.componentStack?.substring(0, 500),
      level,
      retryCount: this.state.retryCount,
      errorId: this.state.errorId,
    });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Call custom error handler
    if (onError) {
      onError(error, errorInfo);
    }

    // Send error to external service in production
    if (process.env.NODE_ENV === 'production') {
      this.reportError(error, errorInfo);
    }
  }

  reportError = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      // In a real app, send to error reporting service like Sentry, Bugsnag, etc.
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        errorId: this.state.errorId,
        level: this.props.level,
        retryCount: this.state.retryCount,
      };

      // Mock API call to error reporting service
      console.log('Reporting error:', errorReport);
      
      // You would replace this with actual error reporting service
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorReport),
      // });
      
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      toast({
        title: 'Maximum retries reached',
        description: 'Please refresh the page or contact support if the issue persists.',
        variant: 'destructive',
      });
      return;
    }

    trackUserAction('error_boundary_retry', 'error_handling', {
      retryCount: retryCount + 1,
      errorId: this.state.errorId,
    });

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: retryCount + 1,
      showDetails: false,
      showReportDialog: false,
    });

    toast({
      title: 'Retrying...',
      description: 'Attempting to recover from the error.',
    });
  };

  handleRefresh = () => {
    trackUserAction('error_boundary_refresh', 'error_handling', {
      errorId: this.state.errorId,
    });
    window.location.reload();
  };

  handleGoHome = () => {
    trackUserAction('error_boundary_home', 'error_handling', {
      errorId: this.state.errorId,
    });
    window.location.href = '/';
  };

  handleGoBack = () => {
    trackUserAction('error_boundary_back', 'error_handling', {
      errorId: this.state.errorId,
    });
    window.history.back();
  };

  copyErrorDetails = () => {
    const { error, errorInfo, errorId } = this.state;
    
    const errorDetails = `
Error ID: ${errorId}
Error: ${error?.message}
Stack: ${error?.stack}
Component Stack: ${errorInfo?.componentStack}
URL: ${window.location.href}
Timestamp: ${new Date().toISOString()}
User Agent: ${navigator.userAgent}
    `.trim();

    navigator.clipboard.writeText(errorDetails).then(() => {
      toast({
        title: 'Error details copied',
        description: 'Error information has been copied to your clipboard.',
      });
    });
  };

  render() {
    const { 
      children, 
      fallback, 
      showReportButton = true, 
      enableRetry = true, 
      level = 'component',
      className,
    } = this.props;
    
    const { 
      hasError, 
      error, 
      errorInfo, 
      errorId, 
      showDetails, 
      showReportDialog, 
      retryCount 
    } = this.state;

    if (hasError && error) {
      // Custom fallback component
      if (fallback) {
        return <>{fallback}</>;
      }

      // Determine error severity and styling
      const isPageLevel = level === 'page';
      const isCritical = level === 'critical';
      const errorTitle = isCritical 
        ? 'Critical Application Error' 
        : isPageLevel 
        ? 'Page Error' 
        : 'Component Error';
      
      const errorDescription = isCritical
        ? 'A critical error occurred that affects the entire application.'
        : isPageLevel
        ? 'An error occurred while loading this page.'
        : 'An error occurred in this component.';

      return (
        <div className={cn('error-boundary-container', className)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              'flex items-center justify-center',
              isPageLevel ? 'min-h-screen p-4' : 'min-h-[200px] p-4'
            )}
          >
            <Card 
              className={cn(
                'w-full max-w-2xl',
                isCritical && 'border-red-500 bg-red-50 dark:bg-red-950/20'
              )}
              style={flexLivingComponents.managerCard}
            >
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className={cn(
                    'p-2 rounded-lg',
                    isCritical 
                      ? 'bg-red-100 dark:bg-red-900/20' 
                      : 'bg-orange-100 dark:bg-orange-900/20'
                  )}>
                    <AlertTriangle className={cn(
                      'h-6 w-6',
                      isCritical ? 'text-red-600' : 'text-orange-600'
                    )} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="flex items-center space-x-2">
                      <span>{errorTitle}</span>
                      <Badge variant={isCritical ? 'destructive' : 'secondary'} className="text-xs">
                        {level}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {errorDescription}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Error Message */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="font-mono text-sm text-destructive">
                    {error.message}
                  </p>
                  {errorId && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Error ID: <code className="bg-muted px-1 rounded">{errorId}</code>
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  {enableRetry && (
                    <Button
                      onClick={this.handleRetry}
                      className="flex-button-primary"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Again {retryCount > 0 && `(${retryCount})`}
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    onClick={this.handleRefresh}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Page
                  </Button>

                  {isPageLevel && (
                    <>
                      <Button
                        variant="outline"
                        onClick={this.handleGoBack}
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Go Back
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={this.handleGoHome}
                      >
                        <Home className="h-4 w-4 mr-2" />
                        Go Home
                      </Button>
                    </>
                  )}
                </div>

                {/* Error Details */}
                <Collapsible
                  open={showDetails}
                  onOpenChange={(open) => this.setState({ showDetails: open })}
                >
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between">
                      <span className="flex items-center space-x-2">
                        <Bug className="h-4 w-4" />
                        <span>Technical Details</span>
                      </span>
                      <ChevronDown className={cn(
                        'h-4 w-4 transition-transform',
                        showDetails && 'transform rotate-180'
                      )} />
                    </Button>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="mt-3">
                    <div className="space-y-3">
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-sm">Stack Trace</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={this.copyErrorDetails}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy Details
                          </Button>
                        </div>
                        <pre className="text-xs text-muted-foreground overflow-auto max-h-32 whitespace-pre-wrap font-mono">
                          {error.stack}
                        </pre>
                      </div>

                      {errorInfo && (
                        <div className="p-3 bg-muted rounded-lg">
                          <h4 className="font-semibold text-sm mb-2">Component Stack</h4>
                          <pre className="text-xs text-muted-foreground overflow-auto max-h-32 whitespace-pre-wrap font-mono">
                            {errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Report Error */}
                {showReportButton && (
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Info className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Help us improve
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          Report this error to help us fix it faster
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => this.setState({ showReportDialog: true })}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Report
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Report Dialog */}
          <Dialog open={showReportDialog} onOpenChange={(open) => this.setState({ showReportDialog: open })}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <Bug className="h-5 w-5" />
                  <span>Report Error</span>
                </DialogTitle>
                <DialogDescription>
                  Help us improve the application by reporting this error. Technical details will be included automatically.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <h4 className="font-medium text-sm mb-2">Error Summary</h4>
                  <p className="text-sm">{error.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Error ID: {errorId}
                  </p>
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>• Error details and stack trace</p>
                  <p>• Browser information</p>
                  <p>• Page URL and timestamp</p>
                  <p>• No personal information will be shared</p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => this.setState({ showReportDialog: false })}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    this.reportError(error, errorInfo!);
                    this.setState({ showReportDialog: false });
                    toast({
                      title: 'Error reported',
                      description: 'Thank you for helping us improve the application.',
                    });
                  }}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Report
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    return children;
  }
}

// Functional wrapper component for easier usage
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <ErrorBoundaryClass {...props} />;
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for manually triggering error boundaries (for testing or special cases)
export const useThrowError = () => {
  return (error: Error | string) => {
    if (typeof error === 'string') {
      throw new Error(error);
    }
    throw error;
  };
};

export default ErrorBoundary;

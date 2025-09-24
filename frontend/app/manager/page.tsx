'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ReviewsTable } from '@/components/ReviewsTable';
import { FiltersPanel } from '@/components/FiltersPanel';
import { ReviewAnalytics } from '@/components/ReviewAnalytics';
import { DataExport } from '@/components/DataExport';
import { ApprovalWorkflow } from '@/components/ApprovalWorkflow';
import { DataLoadingState } from '@/components/LoadingSystem';
import { 
  useReviews, 
  useReviewStats, 
  useRealtimeUpdates, 
  usePerformanceMonitoring,
  useLocalStorage,
  useOptimisticBulkApprovalMutation
} from '@/lib/hooks';
import { trackUserAction, trackPerformanceMetric } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { flexLivingComponents } from '@/lib/theme';
import { toast } from '@/lib/use-toast';
import { 
  MessageSquare, 
  Star, 
  Clock, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  Filter,
  Download,
  BarChart3,
  Settings,
  Zap,
  Users,
  Calendar,
  AlertTriangle,
  Workflow,
  Target,
  Eye,
  EyeOff,
  RefreshCw,
  Bell,
  Activity
} from 'lucide-react';

// Enhanced animations for FlexLiving dashboard
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

const staggerChildren = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const slideInLeft = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.4 }
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.5 }
};

// Enhanced interfaces
interface ReviewFilters {
  status?: string | null;
  rating?: number;
  channel?: string;
  dateRange?: [Date | null, Date | null];
  listing?: string;
  searchQuery?: string;
  priority?: 'high' | 'medium' | 'low';
  hasImages?: boolean;
  responseStatus?: 'responded' | 'not_responded';
}

interface DashboardPreferences {
  defaultView: 'table' | 'grid' | 'analytics';
  autoRefresh: boolean;
  refreshInterval: number;
  compactMode: boolean;
  showAnalytics: boolean;
  selectedStats: string[];
  pinnedFilters: ReviewFilters;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  action: () => void;
  shortcut?: string;
  count?: number;
  color?: string;
}

export default function ManagerDashboard() {
  // Core state
  const [filters, setFilters] = useState<ReviewFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [currentTab, setCurrentTab] = useState('all');
  const [currentView, setCurrentView] = useState<'table' | 'analytics'>('table');
  const [showApprovalWorkflow, setShowApprovalWorkflow] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedReviews, setSelectedReviews] = useState<string[]>([]);

  // Enhanced state management
  const [preferences, setPreferences] = useLocalStorage<DashboardPreferences>('manager-dashboard-prefs', {
    defaultView: 'table',
    autoRefresh: true,
    refreshInterval: 30,
    compactMode: false,
    showAnalytics: true,
    selectedStats: ['total', 'pending', 'approved', 'averageRating'],
    pinnedFilters: {}
  });

  // Real-time updates and performance monitoring
  const { connectionStatus, isConnected } = useRealtimeUpdates({ enabled: true });
  const performanceMetrics = usePerformanceMonitoring();
  const bulkApprovalMutation = useOptimisticBulkApprovalMutation();

  // Auto-refresh functionality
  const autoRefreshRef = useRef<NodeJS.Timeout>();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Enhanced data hooks
  const { 
    data: stats, 
    isLoading: statsLoading, 
    error: statsError,
    refetch: refetchStats 
  } = useReviewStats();
  
  const { 
    data: reviews, 
    isLoading: reviewsLoading, 
    error: reviewsError,
    refetch: refetchReviews 
  } = useReviews({
    ...filters,
    approved: currentTab === 'approved' ? true : currentTab === 'pending' ? false : undefined,
  });

  // Auto-refresh logic
  useEffect(() => {
    if (preferences.autoRefresh) {
      autoRefreshRef.current = setInterval(() => {
        refetchStats();
        refetchReviews();
        setLastRefresh(new Date());
        trackUserAction('auto_refresh_triggered', 'manager_dashboard', {
          interval: preferences.refreshInterval
        });
      }, preferences.refreshInterval * 1000);

      return () => {
        if (autoRefreshRef.current) {
          clearInterval(autoRefreshRef.current);
        }
      };
    }
  }, [preferences.autoRefresh, preferences.refreshInterval, refetchStats, refetchReviews]);

  // Performance tracking
  useEffect(() => {
    trackUserAction('manager_dashboard_viewed', 'page_view', {
      view: currentView,
      tab: currentTab,
      hasFilters: Object.keys(filters).length > 0,
      connectionStatus
    });

    // Track loading performance
    if (!statsLoading && !reviewsLoading) {
      trackPerformanceMetric({
        name: 'dashboard_load_time',
        value: performance.now(),
        unit: 'ms',
        data: { tab: currentTab, view: currentView }
      });
    }
  }, [currentView, currentTab, filters, connectionStatus, statsLoading, reviewsLoading]);

  // Enhanced event handlers
  const handleFiltersChange = (newFilters: ReviewFilters) => {
    setFilters(newFilters);
    trackUserAction('filters_applied', 'manager_dashboard', {
      filterCount: Object.keys(newFilters).length,
      filters: Object.keys(newFilters)
    });
  };

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    trackUserAction('tab_changed', 'manager_dashboard', { tab });
  };

  const handleViewChange = (view: 'table' | 'analytics') => {
    setCurrentView(view);
    setPreferences(prev => ({ ...prev, defaultView: view }));
    trackUserAction('view_changed', 'manager_dashboard', { view });
  };

  const handleBulkAction = (action: 'approve' | 'reject', reviewIds: string[]) => {
    if (reviewIds.length === 0) return;
    
    setSelectedReviews(reviewIds);
    setShowApprovalWorkflow(true);
    trackUserAction('bulk_action_initiated', 'manager_dashboard', {
      action,
      count: reviewIds.length
    });
  };

  const handleQuickApprove = async () => {
    if (selectedReviews.length === 0) return;
    
    try {
      await bulkApprovalMutation.mutateAsync({
        review_ids: selectedReviews,
        approved: true,
        notes: 'Quick approval via dashboard'
      });
      
      toast({
        title: 'Reviews approved',
        description: `${selectedReviews.length} reviews have been approved.`,
      });
      
      setSelectedReviews([]);
      trackUserAction('quick_approve_completed', 'manager_dashboard', {
        count: selectedReviews.length
      });
    } catch (error) {
      toast({
        title: 'Approval failed',
        description: 'There was an error approving the reviews. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const toggleAutoRefresh = () => {
    const newValue = !preferences.autoRefresh;
    setPreferences(prev => ({ ...prev, autoRefresh: newValue }));
    trackUserAction('auto_refresh_toggled', 'manager_dashboard', { enabled: newValue });
    
    toast({
      title: newValue ? 'Auto-refresh enabled' : 'Auto-refresh disabled',
      description: newValue 
        ? `Dashboard will refresh every ${preferences.refreshInterval} seconds`
        : 'Dashboard will no longer auto-refresh',
    });
  };

  const handleManualRefresh = () => {
    refetchStats();
    refetchReviews();
    setLastRefresh(new Date());
    trackUserAction('manual_refresh_triggered', 'manager_dashboard');
    toast({
      title: 'Dashboard refreshed',
      description: 'Latest data has been loaded.',
    });
  };

  // Enhanced stats cards with FlexLiving styling
  const statCards = [
    {
      id: 'total',
      title: 'Total Reviews',
      value: stats?.total || 0,
      icon: MessageSquare,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      trend: null,
      trendDirection: 'up',
      description: 'All-time reviews collected',
      action: () => setCurrentTab('all')
    },
    {
      id: 'pending',
      title: 'Pending Approval',
      value: stats?.pending || 0,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      priority: (stats?.pending || 0) > 20 ? 'high' : (stats?.pending || 0) > 5 ? 'medium' : 'low',
      description: 'Reviews awaiting approval',
      action: () => setCurrentTab('pending'),
      urgent: (stats?.pending || 0) > 10
    },
    {
      id: 'approved',
      title: 'Approved',
      value: stats?.approved || 0,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      percentage: stats?.total ? Math.round(((stats.approved || 0) / stats.total) * 100) : 0,
      description: 'Successfully approved reviews',
      action: () => setCurrentTab('approved')
    },
    {
      id: 'averageRating',
      title: 'Average Rating',
      value: stats?.averageRating?.toFixed(1) || '0.0',
      icon: Star,
      color: 'text-amber-500',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      trend: null,
      description: 'Average guest satisfaction',
      action: () => handleViewChange('analytics')
    },
    {
      id: 'thisMonth',
      title: 'This Month',
      value: stats?.totalThisMonth || 0,
      icon: Calendar,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      comparison: null,
      description: 'Reviews received this month',
      action: () => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        handleFiltersChange({ ...filters, dateRange: [firstDay, now] });
      }
    },
    {
      id: 'responseRate',
      title: 'Response Rate',
      value: `${Math.round(((stats?.approved || 0) / (stats?.total || 1)) * 100)}%`,
      icon: Users,
      color: 'text-violet-600',
      bgColor: 'bg-violet-50 dark:bg-violet-900/20',
      description: 'Reviews with management response',
      target: 85,
      action: () => handleViewChange('analytics')
    }
  ];

  // Quick actions for efficient workflow
  const quickActions: QuickAction[] = [
    {
      id: 'bulk-approve',
      label: 'Quick Approve',
      icon: Zap,
      action: handleQuickApprove,
      shortcut: 'Ctrl+A',
      count: selectedReviews.length,
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      id: 'smart-workflow',
      label: 'Smart Workflow',
      icon: Workflow,
      action: () => setShowApprovalWorkflow(true),
      shortcut: 'Ctrl+W',
      color: 'bg-indigo-500 hover:bg-indigo-600'
    },
    {
      id: 'export-data',
      label: 'Export Data',
      icon: Download,
      action: () => setShowExportDialog(true),
      shortcut: 'Ctrl+E',
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      id: 'refresh',
      label: 'Refresh',
      icon: RefreshCw,
      action: handleManualRefresh,
      shortcut: 'Ctrl+R',
      color: 'bg-gray-500 hover:bg-gray-600'
    }
  ];

  // Loading state handling
  if (statsError || reviewsError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load dashboard data. Please refresh the page or contact support.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <div className="space-y-6">
        {/* Dashboard Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl font-bold gradient-text">
                Manager Dashboard
              </h1>
              {/* Real-time Connection Status */}
              <div className="flex items-center space-x-2">
                <div className={cn(
                  "h-2 w-2 rounded-full",
                  isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
                )} />
                <span className="text-xs text-muted-foreground">
                  {isConnected ? 'Live' : 'Offline'}
                </span>
              </div>
            </div>
            <p className="text-muted-foreground mt-1">
              Intelligent review management with real-time updates
            </p>
            {preferences.autoRefresh && (
              <p className="text-xs text-muted-foreground mt-1">
                Last refreshed: {lastRefresh.toLocaleTimeString()}
              </p>
            )}
          </div>
          
          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {quickActions.map(action => (
              <Button
                key={action.id}
                variant={action.id === 'bulk-approve' && selectedReviews.length > 0 ? 'default' : 'outline'}
                size="sm"
                onClick={action.action}
                disabled={action.id === 'bulk-approve' && selectedReviews.length === 0}
                className={cn(
                  "flex items-center space-x-2 text-xs",
                  action.id === 'bulk-approve' && selectedReviews.length > 0 && action.color
                )}
              >
                <action.icon className="h-3 w-3" />
                <span>{action.label}</span>
                {action.count && action.count > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1 text-xs">
                    {action.count}
                  </Badge>
                )}
              </Button>
            ))}
            
            {/* Auto-refresh toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAutoRefresh}
              className={cn(
                "text-xs",
                preferences.autoRefresh && "text-primary"
              )}
            >
              <Activity className="h-3 w-3 mr-1" />
              Auto {preferences.autoRefresh ? 'ON' : 'OFF'}
            </Button>
          </div>
        </motion.div>

        {/* Stats Cards Grid */}
        <motion.div
          variants={staggerChildren}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
        >
          {statCards.filter(stat => preferences.selectedStats.includes(stat.id)).map((stat, index) => (
            <motion.div key={stat.id} variants={fadeInUp}>
              <Card 
                className={cn(
                  "cursor-pointer transition-all duration-200",
                  stat.urgent && "ring-2 ring-red-500/50",
                  "hover:shadow-lg hover:scale-105"
                )}
                style={flexLivingComponents.managerCard}
                onClick={stat.action}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground truncate">
                        {stat.title}
                      </p>
                      <div className="flex items-baseline mt-1 space-x-2">
                        <span className="text-xl font-bold">
                          {statsLoading ? (
                            <div className="loading-pulse h-6 w-8 rounded" />
                          ) : (
                            stat.value
                          )}
                        </span>
                        {(stat as any).trend && (
                          <span className={cn(
                            "text-xs font-medium",
                            (stat as any).trendDirection === 'up' ? "text-green-600" : "text-red-600"
                          )}>
                            {(stat as any).trend}
                          </span>
                        )}
                      </div>
                      
                      {/* Progress indicators */}
                      {stat.percentage !== undefined && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-1">
                            <div 
                              className="bg-primary h-1 rounded-full transition-all duration-500"
                              style={{ width: `${stat.percentage}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {stat.percentage}% approval rate
                          </p>
                        </div>
                      )}
                      
                      {stat.urgent && (
                        <div className="flex items-center mt-2 text-red-600">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          <span className="text-xs font-medium">Needs attention</span>
                        </div>
                      )}
                    </div>
                    
                    <div className={cn("p-2 rounded-lg", stat.bgColor)}>
                      <stat.icon className={cn("h-4 w-4", stat.color)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* View Toggle and Filters */}
        <motion.div
          variants={slideInLeft}
          initial="initial"
          animate="animate"
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex items-center space-x-4">
            <Tabs value={currentView} onValueChange={(value) => handleViewChange(value as "table" | "analytics")} className="w-auto">
              <TabsList>
                <TabsTrigger value="table" className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>Reviews</span>
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4" />
                  <span>Analytics</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2"
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              {Object.keys(filters).length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {Object.keys(filters).length}
                </Badge>
              )}
            </Button>
          </div>

          {/* Performance metrics (dev mode) */}
          {process.env.NODE_ENV === 'development' && performanceMetrics && (
            <div className="text-xs text-muted-foreground">
              Renders: {performanceMetrics.renderCount} | 
              Avg: {Math.round(performanceMetrics.averageRenderTime)}ms
            </div>
          )}
        </motion.div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <FiltersPanel
                filters={filters as any}
                onFiltersChange={handleFiltersChange}
                onClose={() => setShowFilters(false)}
                compactMode={preferences.compactMode}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          {currentView === 'table' ? (
            <Card style={flexLivingComponents.managerCard}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <MessageSquare className="h-5 w-5" />
                      <span>Reviews Management</span>
                    </CardTitle>
                    <CardDescription>
                      Intelligent review processing with optimistic updates
                    </CardDescription>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {stats && (
                      <>
                        <Badge variant="outline" className="flex items-center space-x-1">
                          <TrendingUp className="h-3 w-3" />
                          <span>{stats.totalThisMonth} this month</span>
                        </Badge>
                        {bulkApprovalMutation.isPending && (
                          <Badge variant="secondary" className="flex items-center space-x-1">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            <span>Processing...</span>
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-0">
                <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
                  <div className="px-6 pt-2 pb-4">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="all" className="flex items-center space-x-2">
                        <MessageSquare className="h-4 w-4" />
                        <span>All</span>
                        {stats && (
                          <Badge variant="secondary" size="sm">
                            {stats.total}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="pending" className="flex items-center space-x-2">
                        <Clock className="h-4 w-4" />
                        <span>Pending</span>
                        {stats && stats.pending > 0 && (
                          <Badge 
                            variant={stats.pending > 10 ? "destructive" : "secondary"} 
                            size="sm"
                            className={stats.pending > 10 ? "animate-pulse" : ""}
                          >
                            {stats.pending}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="approved" className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4" />
                        <span>Approved</span>
                        {stats && (
                          <Badge variant="default" size="sm">
                            {stats.approved}
                          </Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <Separator />

                  <div className="p-6">
                    <TabsContent value={currentTab} className="mt-0">
                      {statsLoading || reviewsLoading ? (
                        <DataLoadingState type="reviews" />
                      ) : (
                        <ReviewsTable
                          reviews={reviews}
                          loading={reviewsLoading}
                          filters={filters as any}
                          onFiltersChange={handleFiltersChange}
                          onBulkAction={handleBulkAction}
                          selectedReviews={selectedReviews}
                          onSelectionChange={setSelectedReviews}
                          enableOptimisticUpdates
                          compactMode={preferences.compactMode}
                        />
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <ReviewAnalytics 
              stats={stats as any} 
              filters={filters as any}
              onFilterChange={handleFiltersChange}
            />
          )}
        </motion.div>

        {/* Enhanced Dialogs */}
        <ApprovalWorkflow
          open={showApprovalWorkflow}
          onOpenChange={setShowApprovalWorkflow}
          reviews={reviews?.filter(r => selectedReviews.includes(r.id)) ?? []}
          mode="bulk"
          onApprovalComplete={() => {
            setShowApprovalWorkflow(false);
            setSelectedReviews([]);
            toast({
              title: 'Bulk action completed',
              description: 'Reviews have been processed successfully.',
            });
          }}
          onCancel={() => {
            setShowApprovalWorkflow(false);
            setSelectedReviews([]);
          }}
        />

        <DataExport
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          data={reviews}
          filters={filters}
          type="reviews"
        />
      </div>
    </AnimatePresence>
  );
}

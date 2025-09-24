'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Star,
  Users,
  Building,
  Calendar,
  BarChart3,
  PieChart,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Filter,
  Target,
  Zap,
  Eye,
  Heart,
  MessageSquare,
  Globe,
  MapPin,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
} from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Review, ReviewStats, AnalyticsTimeRange, AnalyticsMetric } from '@/lib/types';
import { flexLivingComponents } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { trackUserAction } from '@/lib/analytics';
import { useReviewStats } from '@/lib/hooks';
import { toast } from '@/lib/use-toast';

// Mock chart components (in real app, you'd use recharts, chart.js, etc.)
const SimpleBarChart = ({ data, color = '#3B82F6' }: { data: Array<{ name: string; value: number }>; color?: string }) => (
  <div className="flex items-end justify-between h-32 space-x-1">
    {data.map((item, index) => (
      <div key={index} className="flex flex-col items-center space-y-2 flex-1">
        <div
          className="w-full rounded-t"
          style={{
            height: `${Math.max((item.value / Math.max(...data.map(d => d.value))) * 100, 5)}%`,
            backgroundColor: color,
            opacity: 0.8,
          }}
        />
        <span className="text-xs text-muted-foreground truncate">{item.name}</span>
      </div>
    ))}
  </div>
);

const SimpleDonutChart = ({ 
  data, 
  colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'] 
}: { 
  data: Array<{ name: string; value: number; color?: string }>; 
  colors?: string[] 
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cumulativePercentage = 0;

  return (
    <div className="flex items-center justify-center">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 42 42" className="w-full h-full">
          <circle
            cx="21"
            cy="21"
            r="15.915"
            fill="transparent"
            stroke="hsl(var(--border))"
            strokeWidth="3"
          />
          {data.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const strokeDasharray = `${percentage} ${100 - percentage}`;
            const strokeDashoffset = -cumulativePercentage;
            const color = item.color || colors[index % colors.length];
            
            cumulativePercentage += percentage;
            
            return (
              <circle
                key={index}
                cx="21"
                cy="21"
                r="15.915"
                fill="transparent"
                stroke={color}
                strokeWidth="3"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-300"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-bold">{total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ReviewAnalyticsProps {
  reviews?: Review[];
  className?: string;
  showExport?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
  compactMode?: boolean;
}

const timeRangeOptions = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: '3months', label: 'Last 3 Months' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

const metricCards = [
  {
    key: 'totalReviews',
    title: 'Total Reviews',
    icon: MessageSquare,
    color: 'hsl(221 83% 53%)',
    format: (value: number) => value.toLocaleString(),
  },
  {
    key: 'averageRating',
    title: 'Average Rating',
    icon: Star,
    color: 'hsl(45 93% 47%)',
    format: (value: number) => value.toFixed(1),
  },
  {
    key: 'approvalRate',
    title: 'Approval Rate',
    icon: CheckCircle,
    color: 'hsl(142 71% 45%)',
    format: (value: number) => `${Math.round(value)}%`,
  },
  {
    key: 'pendingReviews',
    title: 'Pending Reviews',
    icon: Clock,
    color: 'hsl(48 94% 68%)',
    format: (value: number) => value.toLocaleString(),
  },
];

// Mock analytics data generator
const generateAnalyticsData = (reviews: Review[], timeRange: AnalyticsTimeRange) => {
  const now = new Date();
  let startDate: Date;

  switch (timeRange) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = startOfWeek(now);
      break;
    case 'month':
      startDate = startOfMonth(now);
      break;
    case '3months':
      startDate = subDays(now, 90);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(0); // All time
  }

  const filteredReviews = reviews.filter(review => 
    new Date(review.submission_date) >= startDate
  );

  const totalReviews = filteredReviews.length;
  const averageRating = filteredReviews.length > 0 
    ? filteredReviews.reduce((sum, review) => sum + review.overall_rating, 0) / filteredReviews.length 
    : 0;
  const approvedReviews = filteredReviews.filter(review => review.approved === true).length;
  const pendingReviews = filteredReviews.filter(review => review.approved === null).length;
  const rejectedReviews = filteredReviews.filter(review => review.approved === false).length;
  const approvalRate = totalReviews > 0 ? (approvedReviews / (approvedReviews + rejectedReviews)) * 100 : 0;

  // Channel distribution
  const channelData = filteredReviews.reduce((acc: Record<string, number>, review) => {
    const channel = review.channel_name || 'Direct';
    acc[channel] = (acc[channel] || 0) + 1;
    return acc;
  }, {});

  // Rating distribution
  const ratingData = [1, 2, 3, 4, 5].map(rating => ({
    name: `${rating} Star${rating !== 1 ? 's' : ''}`,
    value: filteredReviews.filter(review => Math.floor(review.overall_rating) === rating).length,
  }));

  // Monthly trend (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const monthStart = startOfMonth(subDays(now, i * 30));
    const monthEnd = endOfMonth(monthStart);
    const monthReviews = reviews.filter(review => {
      const reviewDate = new Date(review.submission_date);
      return reviewDate >= monthStart && reviewDate <= monthEnd;
    });
    
    return {
      name: format(monthStart, 'MMM'),
      value: monthReviews.length,
      rating: monthReviews.length > 0 
        ? monthReviews.reduce((sum, review) => sum + review.overall_rating, 0) / monthReviews.length 
        : 0,
    };
  }).reverse();

  return {
    totalReviews,
    averageRating,
    approvalRate,
    pendingReviews,
    approvedReviews,
    rejectedReviews,
    channelData: Object.entries(channelData).map(([name, value]) => ({ name, value })),
    ratingData,
    monthlyData,
    trends: {
      reviewsChange: Math.random() * 20 - 10, // Mock trend
      ratingChange: Math.random() * 0.4 - 0.2,
      approvalChange: Math.random() * 10 - 5,
    },
  };
};

export function ReviewAnalytics({
  reviews = [],
  className,
  showExport = true,
  autoRefresh = false,
  refreshInterval = 30000,
  compactMode = false,
}: ReviewAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>('month');
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'channels' | 'insights'>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const analyticsData = useMemo(() => 
    generateAnalyticsData(reviews, timeRange), 
    [reviews, timeRange]
  );

  const { data: reviewStats } = useReviewStats();

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setIsRefreshing(true);
      // In real app, this would trigger a data refetch
      setTimeout(() => {
        setIsRefreshing(false);
        setLastUpdated(new Date());
      }, 1000);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const handleExport = () => {
    trackUserAction('analytics_exported', 'review_analytics', { timeRange });
    toast({
      title: 'Export Started',
      description: 'Your analytics report is being generated.',
    });
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    trackUserAction('analytics_refreshed', 'review_analytics');
    setTimeout(() => {
      setIsRefreshing(false);
      setLastUpdated(new Date());
      toast({
        title: 'Data Refreshed',
        description: 'Analytics data has been updated.',
      });
    }, 1000);
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return <ArrowUpRight className="h-3 w-3 text-green-600" />;
    if (value < 0) return <ArrowDownRight className="h-3 w-3 text-red-600" />;
    return null;
  };

  const getTrendColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn('text-2xl font-bold', compactMode && 'text-xl')}>
            Review Analytics
          </h2>
          <p className="text-sm text-muted-foreground">
            Last updated: {format(lastUpdated, 'MMM dd, yyyy HH:mm')}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as AnalyticsTimeRange)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeRangeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh data</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {showExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('insights')}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Insights
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className={cn(
        'grid gap-4',
        compactMode ? 'grid-cols-2' : 'grid-cols-4'
      )}>
        {metricCards.map((metric, index) => {
          const Icon = metric.icon;
          const value = analyticsData[metric.key as keyof typeof analyticsData] as number;
          const trendValue = analyticsData.trends[`${metric.key.replace('Reviews', '').replace('Rate', '')}Change` as keyof typeof analyticsData.trends] as number;
          
          return (
            <motion.div
              key={metric.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:shadow-md transition-all duration-300" style={flexLivingComponents.managerCard}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${metric.color}15` }}
                      >
                        <Icon 
                          className="h-5 w-5" 
                          style={{ color: metric.color }}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {metric.title}
                        </p>
                        <p className="text-2xl font-bold">
                          {metric.format(value)}
                        </p>
                      </div>
                    </div>
                    
                    {trendValue !== 0 && (
                      <div className={cn('flex items-center space-x-1', getTrendColor(trendValue))}>
                        {getTrendIcon(trendValue)}
                        <span className="text-sm font-medium">
                          {Math.abs(trendValue).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Tabs for detailed analytics */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4" />
            <span>Trends</span>
          </TabsTrigger>
          <TabsTrigger value="channels" className="flex items-center space-x-2">
            <PieChart className="h-4 w-4" />
            <span>Channels</span>
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center space-x-2">
            <Target className="h-4 w-4" />
            <span>Insights</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Rating Distribution */}
            <Card style={flexLivingComponents.managerCard}>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  <span>Rating Distribution</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <SimpleBarChart 
                    data={analyticsData.ratingData}
                    color="hsl(45 93% 47%)"
                  />
                  <div className="grid grid-cols-5 gap-2">
                    {analyticsData.ratingData.map((item, index) => (
                      <div key={index} className="text-center">
                        <div className="text-sm font-medium">{item.value}</div>
                        <div className="text-xs text-muted-foreground">{item.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status Overview */}
            <Card style={flexLivingComponents.managerCard}>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Approval Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <SimpleDonutChart
                    data={[
                      { name: 'Approved', value: analyticsData.approvedReviews, color: 'hsl(142 71% 45%)' },
                      { name: 'Pending', value: analyticsData.pendingReviews, color: 'hsl(48 94% 68%)' },
                      { name: 'Rejected', value: analyticsData.rejectedReviews, color: 'hsl(0 84% 60%)' },
                    ]}
                  />
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-sm">Approved ({analyticsData.approvedReviews})</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <span className="text-sm">Pending ({analyticsData.pendingReviews})</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-sm">Rejected ({analyticsData.rejectedReviews})</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card style={flexLivingComponents.managerCard}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                <span>Review Trends (Last 6 Months)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <SimpleBarChart 
                  data={analyticsData.monthlyData.map(item => ({
                    name: item.name,
                    value: item.value,
                  }))}
                  color="hsl(221 83% 53%)"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="space-y-4">
          <Card style={flexLivingComponents.managerCard}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Globe className="h-5 w-5 text-purple-500" />
                <span>Channel Performance</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <SimpleDonutChart
                    data={analyticsData.channelData}
                  />
                </div>
                <div className="space-y-3">
                  {analyticsData.channelData.map((channel, index) => (
                    <div key={channel.name} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'][index % 4] }}
                        />
                        <span className="font-medium">{channel.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{channel.value}</div>
                        <div className="text-xs text-muted-foreground">
                          {Math.round((channel.value / analyticsData.totalReviews) * 100)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Key Insights */}
            <Card style={flexLivingComponents.managerCard}>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  <span>Key Insights</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start space-x-3">
                    <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900 dark:text-blue-100">
                        Rating Improvement
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Average rating has improved by {Math.abs(analyticsData.trends.ratingChange).toFixed(1)} stars this {timeRange}.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-900 dark:text-green-100">
                        High Approval Rate
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                        {Math.round(analyticsData.approvalRate)}% of reviews are being approved, showing good quality control.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-orange-900 dark:text-orange-100">
                        Pending Reviews
                      </p>
                      <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                        {analyticsData.pendingReviews} reviews are waiting for approval. Consider prioritizing high-rated ones.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card style={flexLivingComponents.managerCard}>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-purple-500" />
                  <span>Recommendations</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 border rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                    <div>
                      <p className="text-sm font-medium">Focus on High-Rating Reviews</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Prioritize approving 4-5 star reviews to boost overall ratings.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 border rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                    <div>
                      <p className="text-sm font-medium">Channel Optimization</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {analyticsData.channelData[0]?.name || 'Top channel'} is performing well - consider promotional strategies.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 border rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-orange-500 mt-2" />
                    <div>
                      <p className="text-sm font-medium">Review Response Time</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Reduce pending review backlog to improve guest satisfaction.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

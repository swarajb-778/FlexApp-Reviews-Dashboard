'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ReviewCardSkeleton } from '@/components/PageLoader';
import { ApprovalWorkflow } from '@/components/ApprovalWorkflow';
import {
  Star,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  Building,
  User,
  Filter,
  Trash2,
  Edit,
  Eye,
  Zap,
  RotateCcw,
  Download,
  Share,
  Clock,
  AlertTriangle,
  Loader2,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Review, ReviewFilters, SortConfig } from '@/lib/types';
import { 
  formatDate, 
  formatRelativeTime, 
  getInitials,
  getApprovalStatusInfo,
  formatRating,
  truncateText,
} from '@/lib/utils';
import { cn } from '@/lib/utils';
import { 
  useOptimisticApprovalMutation,
  useOptimisticBulkApprovalMutation,
  useRealtimeUpdates,
  useAdvancedPagination,
  useLocalStorage,
} from '@/lib/hooks';
import { trackUserAction } from '@/lib/analytics';
import { toast } from '@/lib/use-toast';

interface ReviewsTableProps {
  reviews?: Review[];
  loading?: boolean;
  filters?: ReviewFilters;
  onFiltersChange?: (filters: ReviewFilters) => void;
  onBulkAction?: (action: 'approve' | 'reject', reviewIds: string[]) => void;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  className?: string;
  enableRealtimeUpdates?: boolean;
  enableOptimisticUpdates?: boolean;
  showAdvancedActions?: boolean;
  compactMode?: boolean;
  virtualScrolling?: boolean;
  totalItems?: number;
  selectedReviews?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
}

interface RatingCellProps {
  rating: number;
  compact?: boolean;
}

function RatingCell({ rating, compact = false }: RatingCellProps) {
  return (
    <div className="flex items-center space-x-1">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              'h-3 w-3',
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700'
            )}
          />
        ))}
      </div>
      {!compact && (
        <span className="text-xs text-muted-foreground ml-1">
          {formatRating(rating)}
        </span>
      )}
    </div>
  );
}

export function ReviewsTable({
  reviews = [],
  loading = false,
  filters = {},
  onFiltersChange,
  onBulkAction,
  onSort,
  className,
  enableRealtimeUpdates = true,
  enableOptimisticUpdates = true,
  showAdvancedActions = true,
  compactMode = false,
  virtualScrolling = false,
  totalItems,
  selectedReviews: propSelectedReviews,
  onSelectionChange,
}: ReviewsTableProps) {
  const [selectedReviews, setSelectedReviews] = useState<string[]>(propSelectedReviews || []);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'created_at',
    direction: 'desc',
  });
  const [bulkActionDialog, setBulkActionDialog] = useState<{
    open: boolean;
    action: 'approve' | 'reject';
  }>({ open: false, action: 'approve' });
  const [showApprovalWorkflow, setShowApprovalWorkflow] = useState(false);
  const [processingReviews, setProcessingReviews] = useState<Set<string>>(new Set());
  const [undoStack, setUndoStack] = useState<Array<{
    action: string;
    reviewIds: string[];
    timestamp: number;
  }>>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [columnVisibility, setColumnVisibility] = useLocalStorage('reviews-table-columns', {
    guest: true,
    rating: true,
    review: true,
    property: true,
    date: true,
    status: true,
    actions: true,
  });

  // Enhanced hooks
  const optimisticApprovalMutation = useOptimisticApprovalMutation();
  const bulkApprovalMutation = useOptimisticBulkApprovalMutation();
  
  // Real-time updates
  const { isConnected: realtimeConnected } = useRealtimeUpdates({
    enabled: enableRealtimeUpdates,
    onReviewUpdate: (updatedReview) => {
      // Handle real-time review updates
      toast({
        title: 'Review Updated',
        description: `Review by ${updatedReview.guest_name} was ${updatedReview.approved ? 'approved' : 'rejected'}`,
      });
    },
    onBulkActionComplete: (data) => {
      toast({
        title: 'Bulk Action Complete',
        description: `${data.updated} reviews processed`,
      });
    },
  });

  // Pagination
  const pagination = useAdvancedPagination(
    totalItems || reviews.length,
    compactMode ? 20 : 10
  );

  // Sync with parent selectedReviews prop
  useEffect(() => {
    if (propSelectedReviews) {
      setSelectedReviews(propSelectedReviews);
    }
  }, [propSelectedReviews]);

  // Memoized filtered and sorted data
  const processedReviews = useMemo(() => {
    let filteredReviews = [...reviews];

    // Apply filters (this would typically be done on the backend)
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filteredReviews = filteredReviews.filter(review =>
        review.guest_name.toLowerCase().includes(query) ||
        review.review_text.toLowerCase().includes(query) ||
        review.listing_name?.toLowerCase().includes(query)
      );
    }

    if (filters.status && filters.status !== 'all') {
      filteredReviews = filteredReviews.filter(review => {
        switch (filters.status) {
          case 'pending': return review.approved === null;
          case 'approved': return review.approved === true;
          case 'rejected': return review.approved === false;
          default: return true;
        }
      });
    }

    if (filters.rating) {
      filteredReviews = filteredReviews.filter(review => 
        review.overall_rating >= filters.rating!
      );
    }

    // Apply sorting
    filteredReviews.sort((a, b) => {
      const { key, direction } = sortConfig;
      let aValue: any = a[key as keyof Review];
      let bValue: any = b[key as keyof Review];

      // Handle different data types
      if (key.includes('date') || key.includes('_at')) {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filteredReviews;
  }, [reviews, filters, sortConfig]);

  const handleSort = (column: string) => {
    const newDirection = sortConfig.key === column && sortConfig.direction === 'asc' 
      ? 'desc' 
      : 'asc';
    
    setSortConfig({ key: column, direction: newDirection });
    onSort?.(column, newDirection);
  };

  const handleSelectAll = (checked: boolean) => {
    const newSelection = checked ? processedReviews.map(review => review.id) : [];
    setSelectedReviews(newSelection);
    onSelectionChange?.(newSelection);
  };

  const handleSelectReview = (reviewId: string, checked: boolean) => {
    const newSelection = checked
      ? [...selectedReviews, reviewId]
      : selectedReviews.filter(id => id !== reviewId);
    
    setSelectedReviews(newSelection);
    onSelectionChange?.(newSelection);
    
    trackUserAction('review_selected', 'table_interaction', { 
      reviewId, 
      selected: checked,
      totalSelected: newSelection.length,
    });
  };

  const handleBulkAction = (action: 'approve' | 'reject') => {
    if (showAdvancedActions) {
      setShowApprovalWorkflow(true);
    } else {
      setBulkActionDialog({ open: true, action });
    }
    
    trackUserAction('bulk_action_initiated', 'approval_workflow', {
      action,
      reviewCount: selectedReviews.length,
    });
  };

  const executeBulkAction = async () => {
    if (enableOptimisticUpdates) {
      try {
        setProcessingReviews(new Set(selectedReviews));
        
        await bulkApprovalMutation.mutateAsync({
          review_ids: selectedReviews,
          approved: bulkActionDialog.action === 'approve',
          notes: `Bulk ${bulkActionDialog.action}`,
        });

        // Add to undo stack
        setUndoStack(prev => [...prev, {
          action: bulkActionDialog.action,
          reviewIds: selectedReviews,
          timestamp: Date.now(),
        }]);

        setSelectedReviews([]);
        onSelectionChange?.([]);
      } finally {
        setProcessingReviews(new Set());
        setBulkActionDialog({ open: false, action: 'approve' });
      }
    } else {
      onBulkAction?.(bulkActionDialog.action, selectedReviews);
      setSelectedReviews([]);
      setBulkActionDialog({ open: false, action: 'approve' });
    }
  };

  // Enhanced single approval handler
  const handleSingleApproval = async (reviewId: string, approved: boolean) => {
    if (enableOptimisticUpdates) {
      try {
        setProcessingReviews(prev => new Set(prev).add(reviewId));
        
        await optimisticApprovalMutation.mutateAsync({
          id: reviewId,
          data: { approved, notes: `Single ${approved ? 'approval' : 'rejection'}` },
        });

        // Add to undo stack
        setUndoStack(prev => [...prev, {
          action: approved ? 'approve' : 'reject',
          reviewIds: [reviewId],
          timestamp: Date.now(),
        }]);
      } finally {
        setProcessingReviews(prev => {
          const newSet = new Set(prev);
          newSet.delete(reviewId);
          return newSet;
        });
      }
    }
  };

  // Undo last action
  const handleUndo = () => {
    const lastAction = undoStack[undoStack.length - 1];
    if (!lastAction) return;

    // Reverse the last action
    const reversedApproval = lastAction.action === 'approve' ? false : true;
    
    lastAction.reviewIds.forEach(reviewId => {
      handleSingleApproval(reviewId, reversedApproval);
    });

    setUndoStack(prev => prev.slice(0, -1));
    
    toast({
      title: 'Action Undone',
      description: `Reversed ${lastAction.action} for ${lastAction.reviewIds.length} review(s)`,
    });
  };

  // Export functionality
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const dataToExport = processedReviews.map(review => ({
        guest_name: review.guest_name,
        overall_rating: review.overall_rating,
        review_text: review.review_text,
        listing_name: review.listing_name,
        channel_name: review.channel_name,
        submission_date: review.submission_date,
        approved: review.approved,
      }));

      const csv = [
        Object.keys(dataToExport[0]).join(','),
        ...dataToExport.map(row => Object.values(row).map(val => `"${val}"`).join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reviews-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export Complete',
        description: `Exported ${dataToExport.length} reviews`,
      });
      
      trackUserAction('reviews_exported', 'data_export', {
        count: dataToExport.length,
        format: 'csv',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Could not export reviews',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'a':
            event.preventDefault();
            handleSelectAll(true);
            break;
          case 'e':
            event.preventDefault();
            handleExport();
            break;
          case 'z':
            if (event.shiftKey) {
              event.preventDefault();
              handleUndo();
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle selection changes
  useEffect(() => {
    onSelectionChange?.(selectedReviews);
  }, [selectedReviews, onSelectionChange]);

  const getSortIcon = (column: string) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="h-4 w-4" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="h-4 w-4" />
      : <ArrowDown className="h-4 w-4" />;
  };

  const isAllSelected = processedReviews.length > 0 && selectedReviews.length === processedReviews.length;
  const isPartiallySelected = selectedReviews.length > 0 && selectedReviews.length < processedReviews.length;

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <ReviewCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Enhanced Table Header with Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold">Reviews ({processedReviews.length})</h3>
          {enableRealtimeUpdates && (
            <div className="flex items-center space-x-1">
              {realtimeConnected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-green-600">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-500" />
                  <span className="text-xs text-red-600">Offline</span>
                </>
              )}
            </div>
          )}
          {processingReviews.size > 0 && (
            <div className="flex items-center space-x-1">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-xs text-blue-600">Processing {processingReviews.size}</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {undoStack.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={processingReviews.size > 0}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Undo
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting || processedReviews.length === 0}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            Export
          </Button>

          {showAdvancedActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setViewMode(viewMode === 'table' ? 'card' : 'table')}>
                  {viewMode === 'table' ? 'Card View' : 'Table View'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowApprovalWorkflow(true)}>
                  <Zap className="h-4 w-4 mr-2" />
                  Smart Approval
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Enhanced Bulk Actions Bar */}
      <AnimatePresence>
        {selectedReviews.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            className="p-4 bg-gradient-to-r from-primary/5 to-blue-50 dark:to-blue-950/20 border border-primary/20 rounded-lg shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span className="font-medium">
                    {selectedReviews.length} review{selectedReviews.length === 1 ? '' : 's'} selected
                  </span>
                </div>
                
                {selectedReviews.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Total rating: {processedReviews
                      .filter(r => selectedReviews.includes(r.id))
                      .reduce((sum, r) => sum + r.overall_rating, 0)
                      .toFixed(1)} ⭐
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {showAdvancedActions ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => setShowApprovalWorkflow(true)}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                    >
                      <Zap className="h-4 w-4 mr-1" />
                      Smart Approve
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleBulkAction('approve')}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Quick Approve
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleBulkAction('approve')}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve All
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleBulkAction('reject')}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject All
                    </Button>
                  </>
                )}
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedReviews([]);
                    onSelectionChange?.([]);
                  }}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all reviews"
                  className={cn(isPartiallySelected && 'data-[state=checked]:bg-primary/60')}
                />
              </TableHead>
              <TableHead>Guest</TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('overall_rating')}>
                <div className="flex items-center space-x-1">
                  <span>Rating</span>
                  {getSortIcon('overall_rating')}
                </div>
              </TableHead>
              <TableHead>Review</TableHead>
              <TableHead>Property</TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('submission_date')}>
                <div className="flex items-center space-x-1">
                  <span>Date</span>
                  {getSortIcon('submission_date')}
                </div>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedReviews.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center space-y-2">
                    <Filter className="h-12 w-12 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">No reviews found</h3>
                    <p className="text-muted-foreground">
                      No reviews match your current filters. Try adjusting your search criteria.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              processedReviews.map((review, index) => {
                const isSelected = selectedReviews.includes(review.id);
                const approvalStatus = getApprovalStatusInfo(review.approved ?? null);

                return (
                  <motion.tr
                    key={review.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      'table-row-hover',
                      isSelected && 'bg-muted/50'
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectReview(review.id, checked as boolean)}
                        aria-label={`Select review from ${review.guest_name}`}
                      />
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={review.guest_avatar} alt={review.guest_name} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                            {getInitials(review.guest_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{review.guest_name}</p>
                          {review.channel_name && (
                            <Badge variant="outline" className="text-xs">
                              {review.channel_name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <RatingCell rating={review.overall_rating} />
                    </TableCell>

                    <TableCell className="max-w-xs">
                      <p className="text-sm text-muted-foreground truncate">
                        {truncateText(review.review_text, 80)}
                      </p>
                    </TableCell>

                    <TableCell>
                      {review.listing_name && (
                        <div className="flex items-center space-x-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm truncate max-w-32">
                            {review.listing_name}
                          </span>
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{formatRelativeTime(review.submission_date)}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant={approvalStatus.variant} className="text-xs">
                        {approvalStatus.label}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center space-x-1">
                        {processingReviews.has(review.id) && (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        )}
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Review
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {review.approved !== true && (
                              <DropdownMenuItem 
                                className="text-green-600"
                                onClick={() => handleSingleApproval(review.id, true)}
                                disabled={processingReviews.has(review.id)}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                {enableOptimisticUpdates ? 'Quick Approve' : 'Approve'}
                              </DropdownMenuItem>
                            )}
                            {review.approved !== false && (
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => handleSingleApproval(review.id, false)}
                                disabled={processingReviews.has(review.id)}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                {enableOptimisticUpdates ? 'Quick Reject' : 'Reject'}
                              </DropdownMenuItem>
                            )}
                            {showAdvancedActions && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                  <Share className="h-4 w-4 mr-2" />
                                  Share Review
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <AlertTriangle className="h-4 w-4 mr-2" />
                                  Flag Review
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </motion.tr>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Bulk Action Confirmation Dialog */}
      <AlertDialog open={bulkActionDialog.open} onOpenChange={(open) => setBulkActionDialog({ ...bulkActionDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkActionDialog.action === 'approve' ? 'Approve' : 'Reject'} Reviews
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {bulkActionDialog.action} {selectedReviews.length} selected review{selectedReviews.length === 1 ? '' : 's'}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeBulkAction}
              className={cn(
                bulkActionDialog.action === 'approve' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-red-600 hover:bg-red-700'
              )}
            >
              {bulkActionDialog.action === 'approve' ? 'Approve' : 'Reject'} Reviews
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Advanced Approval Workflow */}
      {showAdvancedActions && showApprovalWorkflow && (
        <ApprovalWorkflow
          reviews={processedReviews.filter(r => selectedReviews.includes(r.id))}
          mode="bulk"
          onApprovalComplete={(results) => {
            const successfulIds = results.filter(r => r.success).map(r => r.reviewId);
            setSelectedReviews(prev => prev.filter(id => !successfulIds.includes(id)));
            onSelectionChange?.(selectedReviews.filter(id => !successfulIds.includes(id)));
            setShowApprovalWorkflow(false);
            
            toast({
              title: 'Approval Workflow Complete',
              description: `${results.filter(r => r.success).length} reviews processed successfully`,
            });
          }}
          onCancel={() => setShowApprovalWorkflow(false)}
        />
      )}
    </div>
  );
}

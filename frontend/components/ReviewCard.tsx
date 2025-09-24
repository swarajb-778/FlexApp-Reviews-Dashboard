'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Star,
  Calendar,
  MapPin,
  User,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  Building,
  ExternalLink,
  Heart,
  MoreHorizontal,
  AlertTriangle,
} from 'lucide-react';
import { Review } from '@/lib/types';
import { 
  formatDate, 
  formatRelativeTime, 
  truncateText, 
  getInitials,
  getApprovalStatusInfo,
  formatRating,
} from '@/lib/utils';
import { cn } from '@/lib/utils';
import { 
  useOptimisticApprovalMutation,
  useLocalStorage,
} from '@/lib/hooks';
import { trackUserAction } from '@/lib/analytics';
import { flexLivingComponents, getStatusColor, getChannelColor } from '@/lib/theme';

interface ReviewCardProps {
  review: Review;
  showActions?: boolean;
  onApprove?: (reviewId: string, approved: boolean) => void;
  onEdit?: (review: Review) => void;
  className?: string;
  compact?: boolean;
  enableOptimisticUpdates?: boolean;
  showAdvancedActions?: boolean;
  showCategoryBreakdown?: boolean;
  showGuestVerification?: boolean;
  showSocialProof?: boolean;
  onFlag?: (reviewId: string) => void;
  onShare?: (review: Review) => void;
  onReport?: (reviewId: string) => void;
}

interface RatingStarsProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
}

function RatingStars({ rating, size = 'md', showValue = false }: RatingStarsProps) {
  const starSize = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4', 
    lg: 'h-5 w-5',
  }[size];

  return (
    <div className="flex items-center space-x-1">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              starSize,
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700'
            )}
          />
        ))}
      </div>
      {showValue && (
        <span className="text-sm font-medium text-muted-foreground ml-1">
          {formatRating(rating)}
        </span>
      )}
    </div>
  );
}

interface CategoryRatingsProps {
  review: Review;
  compact?: boolean;
}

function CategoryRatings({ review, compact = false }: CategoryRatingsProps) {
  const categories = [
    { key: 'accuracy_rating', label: 'Accuracy', value: review.accuracy_rating },
    { key: 'location_rating', label: 'Location', value: review.location_rating },
    { key: 'communication_rating', label: 'Communication', value: review.communication_rating },
    { key: 'checkin_rating', label: 'Check-in', value: review.checkin_rating },
    { key: 'cleanliness_rating', label: 'Cleanliness', value: review.cleanliness_rating },
    { key: 'value_rating', label: 'Value', value: review.value_rating },
  ].filter(category => category.value && category.value > 0);

  if (categories.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {categories.map((category) => (
          <TooltipProvider key={category.key}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="text-xs">
                  {category.label.charAt(0)}{formatRating(category.value!)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{category.label}: {formatRating(category.value!)} stars</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Category Ratings</h4>
      <div className="grid grid-cols-2 gap-2">
        {categories.map((category) => (
          <div key={category.key} className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{category.label}</span>
            <RatingStars rating={category.value!} size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReviewCard({ 
  review, 
  showActions = true, 
  onApprove, 
  onEdit, 
  className,
  compact = false,
  enableOptimisticUpdates = true,
  showAdvancedActions = true,
  showCategoryBreakdown = true,
  showGuestVerification = true,
  showSocialProof = true,
  onFlag,
  onShare,
  onReport,
}: ReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<{ 
    open: boolean; 
    action: 'approve' | 'reject' | 'flag' | 'report'; 
  }>({ open: false, action: 'approve' });
  const [isFavorited, setIsFavorited] = useLocalStorage(`review-favorite-${review.id}`, false);
  const [showFullImage, setShowFullImage] = useState(false);

  // Enhanced hooks
  const optimisticApprovalMutation = useOptimisticApprovalMutation();

  const approvalStatus = getApprovalStatusInfo(review.approved ?? null);
  const statusColor = getStatusColor(review.approved ?? null);
  const channelColor = getChannelColor(review.channel_name || '');
  
  const isLongReview = review.review_text.length > (compact ? 150 : 200);
  const displayText = isExpanded || !isLongReview 
    ? review.review_text 
    : truncateText(review.review_text, compact ? 150 : 200);

  const handleApprove = async (approved: boolean) => {
    if (enableOptimisticUpdates) {
      try {
        setIsLoading(true);
        await optimisticApprovalMutation.mutateAsync({
          id: review.id,
          data: { 
            approved, 
            notes: `${approved ? 'Approved' : 'Rejected'} via review card` 
          },
        });

        trackUserAction('review_card_approval', 'approval_workflow', {
          reviewId: review.id,
          approved,
          method: 'optimistic',
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      if (!onApprove) return;
      
      setIsLoading(true);
      try {
        await onApprove(review.id, approved);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleAction = (action: 'approve' | 'reject' | 'flag' | 'report') => {
    if (showAdvancedActions && (action === 'flag' || action === 'report')) {
      setShowConfirmDialog({ open: true, action });
    } else {
      handleApprove(action === 'approve');
    }
  };

  const executeAction = () => {
    const { action } = showConfirmDialog;
    
    switch (action) {
      case 'approve':
      case 'reject':
        handleApprove(action === 'approve');
        break;
      case 'flag':
        onFlag?.(review.id);
        break;
      case 'report':
        onReport?.(review.id);
        break;
    }
    
    setShowConfirmDialog({ open: false, action: 'approve' });
  };

  const handleShare = () => {
    if (onShare) {
      onShare(review);
    } else if (navigator.share) {
      navigator.share({
        title: `Review by ${review.guest_name}`,
        text: truncateText(review.review_text, 100),
        url: window.location.href,
      });
    }
    
    trackUserAction('review_shared', 'social_interaction', {
      reviewId: review.id,
      method: navigator.share ? 'native' : 'custom',
    });
  };

  const toggleFavorite = () => {
    setIsFavorited(!isFavorited);
    trackUserAction('review_favorite_toggled', 'user_interaction', {
      reviewId: review.id,
      favorited: !isFavorited,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn('group', className)}
    >
      <Card 
        className={cn(
          'relative overflow-hidden transition-all duration-300',
          'border border-border/50 hover:border-primary/30',
          'shadow-sm hover:shadow-md',
          review.approved === null && 'ring-1 ring-yellow-200 dark:ring-yellow-800',
          review.approved === true && 'ring-1 ring-green-200 dark:ring-green-800',
          review.approved === false && 'ring-1 ring-red-200 dark:ring-red-800'
        )}
        style={flexLivingComponents.reviewCard}
        role="article"
      >
        {/* Status indicator strip */}
        <div 
          className={cn(
            'absolute top-0 left-0 right-0 h-1',
            review.approved === null && 'bg-yellow-400',
            review.approved === true && 'bg-green-500',
            review.approved === false && 'bg-red-500'
          )}
        />
        
        {/* Favorite indicator */}
        {isFavorited && (
          <div className="absolute top-3 right-3 z-10">
            <Heart className="h-4 w-4 text-red-500 fill-current" />
          </div>
        )}

        <CardHeader className={cn('pb-3', compact && 'pb-2')}>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="relative">
                <Avatar className={cn(
                  'ring-2 ring-background shadow-md',
                  compact ? 'h-8 w-8' : 'h-12 w-12'
                )}>
                  <AvatarImage src={review.guest_avatar} alt={review.guest_name} />
                  <AvatarFallback 
                    className={cn(
                      'font-medium text-white',
                      'bg-gradient-to-br from-primary to-blue-600'
                    )}
                  >
                    {getInitials(review.guest_name)}
                  </AvatarFallback>
                </Avatar>
                
                {/* Guest verification badge */}
                {showGuestVerification && (
                  <div className="absolute -bottom-1 -right-1">
                    <div className="bg-green-500 text-white rounded-full p-0.5">
                      <CheckCircle className="h-3 w-3" />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h3 className={cn(
                    'font-semibold truncate',
                    compact ? 'text-sm' : 'text-base'
                  )}>
                    {review.guest_name}
                  </h3>
                  
                  <Badge 
                    variant="outline"
                    className={cn(
                      'shrink-0 border-0 text-white font-medium',
                      compact && 'text-xs px-2 py-0',
                      review.approved === null && 'bg-yellow-500',
                      review.approved === true && 'bg-green-500',
                      review.approved === false && 'bg-red-500'
                    )}
                  >
                    {approvalStatus.label}
                  </Badge>
                </div>
                
                <div className="flex items-center space-x-4 mt-1">
                  <div className="flex items-center space-x-1 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span className="text-xs">
                      {formatRelativeTime(review.submission_date)}
                    </span>
                  </div>
                  
                  {review.channel_name && (
                    <Badge 
                      variant="outline" 
                      className="text-xs border-0"
                      style={{ 
                        backgroundColor: `${channelColor}15`,
                        color: channelColor,
                        borderColor: `${channelColor}30`,
                      }}
                    >
                      {review.channel_name}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end space-y-2">
              <RatingStars 
                rating={review.overall_rating} 
                size={compact ? 'sm' : 'md'} 
                showValue={!compact}
              />
              
              {/* Social proof indicators */}
              {showSocialProof && !compact && (
                <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>Verified guest</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className={cn('py-4', compact && 'py-2')}>
          {/* Property Information */}
          {(review.listing_name || review.listing_address) && (
            <div className="flex items-center space-x-2 mb-3 p-2 bg-muted/30 rounded-lg">
              <Building className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                {review.listing_name && (
                  <p className="font-medium text-sm truncate">{review.listing_name}</p>
                )}
                {review.listing_address && (
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{review.listing_address}</span>
                  </div>
                )}
              </div>
              {review.listing_id && (
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}

          {/* Review Text */}
          <div className="space-y-2">
            <div className="relative">
              <p className={cn(
                'text-foreground leading-relaxed',
                compact ? 'text-sm' : 'text-base'
              )}>
                {displayText}
              </p>
              
              {isLongReview && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 mt-1 text-primary"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? 'Show less' : 'Read more'}
                </Button>
              )}
            </div>

            {/* Private Feedback */}
            {review.private_feedback && (
              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-center space-x-2 mb-1">
                  <MessageSquare className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Private Feedback
                  </span>
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {review.private_feedback}
                </p>
              </div>
            )}
          </div>

          {/* Category Ratings */}
          {!compact && (
            <div className="mt-4">
              <CategoryRatings review={review} />
            </div>
          )}
        </CardContent>

        {showActions && (
          <>
            <Separator />
            <CardFooter className={cn('pt-4', compact && 'pt-2')}>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-2">
                  {compact && <CategoryRatings review={review} compact />}
                  
                  {review.check_in_date && review.check_out_date && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge 
                            variant="outline" 
                            className="text-xs bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                          >
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(review.check_in_date, 'MMM dd')} - {formatDate(review.check_out_date, 'MMM dd')}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Stay period</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}

                  {/* Advanced actions */}
                  {showAdvancedActions && (
                    <div className="flex items-center space-x-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={toggleFavorite}
                              className="h-6 w-6"
                            >
                              <Heart className={cn(
                                'h-3 w-3',
                                isFavorited ? 'text-red-500 fill-current' : 'text-muted-foreground'
                              )} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handleShare}
                              className="h-6 w-6"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Share review</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {onEdit && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onEdit(review)}
                      className="shrink-0 hover:bg-primary/5"
                    >
                      Edit
                    </Button>
                  )}
                  
              {review.approved !== true && (
                    <Button
                      size="sm"
                      onClick={() => handleAction('approve')}
                      disabled={isLoading}
                      className={cn(
                        'shrink-0 transition-all duration-200',
                        'bg-gradient-to-r from-green-600 to-green-700',
                        'hover:from-green-700 hover:to-green-800',
                        'text-white shadow-sm hover:shadow-md'
                      )}
                  aria-label="approve review"
                    >
                      {isLoading ? (
                        <Clock className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-1" />
                      )}
                      {enableOptimisticUpdates ? 'Quick Approve' : 'Approve'}
                    </Button>
                  )}
                  
                  {review.approved !== false && review.approved !== true && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction('reject')}
                      disabled={isLoading}
                      className={cn(
                        'shrink-0 transition-all duration-200',
                        'border-red-200 text-red-700 hover:bg-red-50',
                        'dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20'
                      )}
                      aria-label="reject review"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  )}

                  {/* Advanced approval actions */}
                  {showAdvancedActions && review.approved === null && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="shrink-0" aria-label="more actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleAction('flag')}>
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          Flag for Review
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction('report')}>
                          <XCircle className="h-4 w-4 mr-2" />
                          Report Issue
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {/* Status indicators for approved/rejected */}
                  {review.approved === true && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex items-center space-x-1 px-3 py-1 bg-green-50 dark:bg-green-950/20 rounded-full"
                    >
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">
                        Approved
                      </span>
                    </motion.div>
                  )}

                  {review.approved === false && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex items-center space-x-1 px-3 py-1 bg-red-50 dark:bg-red-950/20 rounded-full"
                    >
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium text-red-700 dark:text-red-400">
                        Rejected
                      </span>
                    </motion.div>
                  )}
                </div>
              </div>
            </CardFooter>
          </>
        )}

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog.open} onOpenChange={(open) => setShowConfirmDialog({ ...showConfirmDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {showConfirmDialog.action === 'flag' ? 'Flag Review' : 'Report Review'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {showConfirmDialog.action === 'flag' 
                  ? 'This review will be flagged for manual review by a manager.'
                  : 'This review will be reported for potential policy violations.'
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={executeAction}>
                {showConfirmDialog.action === 'flag' ? 'Flag Review' : 'Report Review'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
      {isLoading && (
        <div role="status" aria-live="polite" className="sr-only">Processing</div>
      )}
    </motion.div>
  );
}

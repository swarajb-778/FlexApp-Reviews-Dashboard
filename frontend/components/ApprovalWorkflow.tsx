'use client';

/**
 * Advanced Approval Workflow Component
 * Provides comprehensive interface for review approval with sophisticated optimistic updates,
 * batch processing, audit trails, and real-time collaboration features
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  Calendar,
  MessageSquare,
  History,
  Settings,
  Zap,
  Shield,
  Eye,
  EyeOff,
  Undo,
  RotateCcw,
  Star,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  Square,
} from 'lucide-react';
import { Review, ReviewAuditLog } from '@/lib/types';
import { 
  useApproveReview, 
  useBulkApproveReviews, 
  useOptimisticUpdate 
} from '@/lib/hooks';
import { 
  OptimisticUpdateManager, 
  createOptimisticUpdateManager 
} from '@/lib/optimistic-updates';
import { trackUserAction } from '@/lib/analytics';
import { 
  formatDate, 
  formatRelativeTime, 
  getApprovalStatusInfo,
  cn 
} from '@/lib/utils';
import { toast } from '@/lib/use-toast';
import { flexLivingTheme, getStatusColor } from '@/lib/theme';

// Types
interface ApprovalWorkflowProps {
  reviews: Review[];
  mode: 'single' | 'bulk';
  onApprovalComplete?: (results: ApprovalResult[]) => void;
  onCancel?: () => void;
  className?: string;
  // Controlled dialog props
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface ApprovalResult {
  reviewId: string;
  approved: boolean;
  notes?: string;
  timestamp: number;
  success: boolean;
  error?: string;
}

interface ApprovalRule {
  id: string;
  name: string;
  condition: (review: Review) => boolean;
  action: 'approve' | 'reject' | 'flag';
  description: string;
  enabled: boolean;
}

interface BatchProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  currentReview?: Review;
  status: 'idle' | 'processing' | 'completed' | 'cancelled';
  errors: Array<{ reviewId: string; error: string }>;
}

// Default approval rules
const DEFAULT_APPROVAL_RULES: ApprovalRule[] = [
  {
    id: 'high_rating_auto_approve',
    name: 'Auto-approve 5-star reviews',
    condition: (review) => review.overall_rating === 5,
    action: 'approve',
    description: 'Automatically approve reviews with 5-star ratings',
    enabled: false,
  },
  {
    id: 'low_rating_flag',
    name: 'Flag low ratings',
    condition: (review) => review.overall_rating <= 2,
    action: 'flag',
    description: 'Flag reviews with 2 stars or below for manual review',
    enabled: false,
  },
  {
    id: 'recent_reviews_priority',
    name: 'Prioritize recent reviews',
    condition: (review) => {
      const daysSinceSubmission = (Date.now() - new Date(review.submission_date).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceSubmission <= 7;
    },
    action: 'approve',
    description: 'Prioritize reviews submitted within the last 7 days',
    enabled: false,
  },
];

const APPROVAL_REASONS = [
  { value: 'quality_content', label: 'Quality content' },
  { value: 'positive_feedback', label: 'Positive guest feedback' },
  { value: 'detailed_review', label: 'Detailed and helpful review' },
  { value: 'verified_guest', label: 'Verified guest stay' },
  { value: 'standard_approval', label: 'Standard approval process' },
];

const REJECTION_REASONS = [
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'fake_review', label: 'Suspected fake review' },
  { value: 'policy_violation', label: 'Policy violation' },
  { value: 'incomplete_information', label: 'Incomplete information' },
  { value: 'spam_content', label: 'Spam or promotional content' },
  { value: 'duplicate_review', label: 'Duplicate review' },
];

export function ApprovalWorkflow({
  reviews,
  mode,
  onApprovalComplete,
  onCancel,
  className,
  open,
  onOpenChange,
}: ApprovalWorkflowProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Use controlled dialog when props are provided
  const isDialogOpen = open !== undefined ? open : isOpen;
  const handleOpenChange = onOpenChange || setIsOpen;
  const [currentStep, setCurrentStep] = useState<'setup' | 'processing' | 'review' | 'complete'>('setup');
  const [approvalDecision, setApprovalDecision] = useState<boolean | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [useApprovalRules, setUseApprovalRules] = useState(false);
  const [approvalRules, setApprovalRules] = useState<ApprovalRule[]>(DEFAULT_APPROVAL_RULES);
  const [batchProgress, setBatchProgress] = useState<BatchProgress>({
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    status: 'idle',
    errors: [],
  });
  const [results, setResults] = useState<ApprovalResult[]>([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set());

  // Hooks
  const approveReviewMutation = useApproveReview();
  const bulkApproveReviewsMutation = useBulkApproveReviews();
  const optimisticUpdate = useOptimisticUpdate();

  // Initialize workflow
  useEffect(() => {
    if (reviews.length > 0 && mode === 'bulk') {
      setBatchProgress(prev => ({
        ...prev,
        total: reviews.length,
      }));
      setSelectedReviews(new Set(reviews.map(r => r.id)));
    }
  }, [reviews, mode]);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { duration: 0.3, staggerChildren: 0.1 }
    },
    exit: { opacity: 0, scale: 0.95 }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  // Handlers
  const handleOpenWorkflow = useCallback(() => {
    setIsOpen(true);
    trackUserAction('approval_workflow_opened', 'dialog', { mode, reviewCount: reviews.length });
  }, [mode, reviews.length]);

  const handleCloseWorkflow = useCallback(() => {
    if (isProcessing) {
      toast({
        title: 'Processing in progress',
        description: 'Cannot close workflow while processing reviews',
        variant: 'destructive',
      });
      return;
    }

    handleOpenChange(false);
    setCurrentStep('setup');
    setApprovalDecision(null);
    setApprovalNotes('');
    setSelectedReason('');
    onCancel?.();
  }, [isProcessing, onCancel, handleOpenChange]);

  const handleApprovalRuleToggle = useCallback((ruleId: string, enabled: boolean) => {
    setApprovalRules(prev => 
      prev.map(rule => 
        rule.id === ruleId ? { ...rule, enabled } : rule
      )
    );
  }, []);

  const handleReviewSelection = useCallback((reviewId: string, selected: boolean) => {
    setSelectedReviews(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(reviewId);
      } else {
        newSet.delete(reviewId);
      }
      return newSet;
    });
  }, []);

  const handleStartProcessing = useCallback(async () => {
    if (approvalDecision === null) {
      toast({
        title: 'Please make a decision',
        description: 'Select approve or reject before proceeding',
        variant: 'destructive',
      });
      return;
    }

    setCurrentStep('processing');
    setIsProcessing(true);
    setBatchProgress(prev => ({
      ...prev,
      status: 'processing',
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [],
    }));

    const reviewsToProcess = mode === 'single' 
      ? reviews 
      : reviews.filter(r => selectedReviews.has(r.id));

    const processResults: ApprovalResult[] = [];

    try {
      if (mode === 'bulk' && reviewsToProcess.length > 1) {
        // Bulk processing
        await processBulkApproval(reviewsToProcess, processResults);
      } else {
        // Single or sequential processing
        await processSequentialApproval(reviewsToProcess, processResults);
      }

      setResults(processResults);
      setCurrentStep('complete');
      setBatchProgress(prev => ({ ...prev, status: 'completed' }));
      
      onApprovalComplete?.(processResults);

      toast({
        title: 'Processing Complete',
        description: `${processResults.filter(r => r.success).length} of ${processResults.length} reviews processed successfully`,
        variant: 'default',
      });
    } catch (error) {
      console.error('Approval processing error:', error);
      setBatchProgress(prev => ({ ...prev, status: 'cancelled' }));
      
      toast({
        title: 'Processing Failed',
        description: 'An error occurred while processing reviews',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setCanUndo(true);
    }
  }, [approvalDecision, selectedReason, approvalNotes, mode, reviews, selectedReviews, onApprovalComplete]);

  const processBulkApproval = async (reviewsToProcess: Review[], results: ApprovalResult[]) => {
    try {
      const reviewIds = reviewsToProcess.map(r => r.id);
      
      // Optimistic update for all reviews
      reviewIds.forEach(reviewId => {
        optimisticUpdate.updateReview(reviewId, {
          approved: approvalDecision,
          approved_at: new Date().toISOString(),
          approved_by: 'current_user', // Replace with actual user ID
        });
      });

      const result = await bulkApproveReviewsMutation.mutateAsync({
        review_ids: reviewIds,
        approved: approvalDecision!,
        notes: approvalNotes || selectedReason,
      });

      // Mark all as successful
      reviewIds.forEach(reviewId => {
        results.push({
          reviewId,
          approved: approvalDecision!,
          notes: approvalNotes || selectedReason,
          timestamp: Date.now(),
          success: true,
        });
      });

      setBatchProgress(prev => ({
        ...prev,
        processed: reviewIds.length,
        successful: reviewIds.length,
      }));
    } catch (error) {
      // Handle bulk failure
      reviewsToProcess.forEach(review => {
        results.push({
          reviewId: review.id,
          approved: approvalDecision!,
          notes: approvalNotes || selectedReason,
          timestamp: Date.now(),
          success: false,
          error: (error as Error).message,
        });
      });

      setBatchProgress(prev => ({
        ...prev,
        failed: reviewsToProcess.length,
        errors: [{ reviewId: 'bulk', error: (error as Error).message }],
      }));
    }
  };

  const processSequentialApproval = async (reviewsToProcess: Review[], results: ApprovalResult[]) => {
    for (let i = 0; i < reviewsToProcess.length; i++) {
      const review = reviewsToProcess[i];
      
      setBatchProgress(prev => ({
        ...prev,
        currentReview: review,
        processed: i,
      }));

      try {
        // Apply approval rules if enabled
        let finalDecision = approvalDecision!;
        let finalNotes = approvalNotes || selectedReason;

        if (useApprovalRules) {
          const applicableRules = approvalRules.filter(rule => 
            rule.enabled && rule.condition(review)
          );

          if (applicableRules.length > 0) {
            const rule = applicableRules[0]; // Use first matching rule
            if (rule.action === 'approve') finalDecision = true;
            if (rule.action === 'reject') finalDecision = false;
            finalNotes += ` (Auto-applied rule: ${rule.name})`;
          }
        }

        // Optimistic update
        optimisticUpdate.updateReview(review.id, {
          approved: finalDecision,
          approved_at: new Date().toISOString(),
          approved_by: 'current_user', // Replace with actual user ID
        });

        // API call
        await approveReviewMutation.mutateAsync({
          id: review.id,
          data: {
            approved: finalDecision,
            notes: finalNotes,
          },
        });

        results.push({
          reviewId: review.id,
          approved: finalDecision,
          notes: finalNotes,
          timestamp: Date.now(),
          success: true,
        });

        setBatchProgress(prev => ({
          ...prev,
          successful: prev.successful + 1,
        }));

      } catch (error) {
        results.push({
          reviewId: review.id,
          approved: approvalDecision!,
          notes: approvalNotes || selectedReason,
          timestamp: Date.now(),
          success: false,
          error: (error as Error).message,
        });

        setBatchProgress(prev => ({
          ...prev,
          failed: prev.failed + 1,
          errors: [...prev.errors, { reviewId: review.id, error: (error as Error).message }],
        }));
      }

      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setBatchProgress(prev => ({
      ...prev,
      processed: reviewsToProcess.length,
    }));
  };

  const handleUndoApproval = useCallback(async () => {
    if (!canUndo || results.length === 0) return;

    try {
      // Reverse the approval decisions
      const reverseResults = results.map(result => ({
        ...result,
        approved: !result.approved,
        notes: `Undo: ${result.notes}`,
      }));

      if (mode === 'bulk') {
        await bulkApproveReviewsMutation.mutateAsync({
          review_ids: reverseResults.map(r => r.reviewId),
          approved: !approvalDecision!,
          notes: 'Bulk approval undo',
        });
      } else {
        for (const result of reverseResults) {
          await approveReviewMutation.mutateAsync({
            id: result.reviewId,
            data: {
              approved: result.approved,
              notes: result.notes,
            },
          });
        }
      }

      setCanUndo(false);
      toast({
        title: 'Approval Undone',
        description: 'All changes have been reversed',
        variant: 'default',
      });
    } catch (error) {
      toast({
        title: 'Undo Failed',
        description: 'Could not reverse all changes',
        variant: 'destructive',
      });
    }
  }, [canUndo, results, mode, approvalDecision, bulkApproveReviewsMutation, approveReviewMutation]);

  // Render different steps
  const renderSetupStep = () => (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Review Summary */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Review Summary</h3>
          <Badge variant="outline" className="text-sm">
            {mode === 'bulk' ? `${selectedReviews.size} selected` : '1 review'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{reviews.length}</div>
            <div className="text-sm text-muted-foreground">Total Reviews</div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">
              {(reviews.reduce((sum, r) => sum + r.overall_rating, 0) / reviews.length).toFixed(1)}
            </div>
            <div className="text-sm text-muted-foreground">Avg Rating</div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">
              {reviews.filter(r => r.approved === null).length}
            </div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">
              {new Set(reviews.map(r => r.channel_name)).size}
            </div>
            <div className="text-sm text-muted-foreground">Channels</div>
          </div>
        </div>
      </motion.div>

      <Separator />

      {/* Approval Decision */}
      <motion.div variants={itemVariants} className="space-y-4">
        <h3 className="text-lg font-semibold">Approval Decision</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant={approvalDecision === true ? 'default' : 'outline'}
            size="lg"
            onClick={() => setApprovalDecision(true)}
            className={cn(
              'h-20 flex-col space-y-2',
              approvalDecision === true && 'bg-green-600 hover:bg-green-700'
            )}
          >
            <CheckCircle className="h-6 w-6" />
            <span>Approve</span>
          </Button>
          
          <Button
            variant={approvalDecision === false ? 'default' : 'outline'}
            size="lg"
            onClick={() => setApprovalDecision(false)}
            className={cn(
              'h-20 flex-col space-y-2',
              approvalDecision === false && 'bg-red-600 hover:bg-red-700'
            )}
          >
            <XCircle className="h-6 w-6" />
            <span>Reject</span>
          </Button>
        </div>
      </motion.div>

      {/* Reason Selection */}
      {approvalDecision !== null && (
        <motion.div 
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          <Label htmlFor="reason">
            {approvalDecision ? 'Approval Reason' : 'Rejection Reason'}
          </Label>
          <Select value={selectedReason} onValueChange={setSelectedReason}>
            <SelectTrigger>
              <SelectValue placeholder={`Select ${approvalDecision ? 'approval' : 'rejection'} reason`} />
            </SelectTrigger>
            <SelectContent>
              {(approvalDecision ? APPROVAL_REASONS : REJECTION_REASONS).map((reason) => (
                <SelectItem key={reason.value} value={reason.value}>
                  {reason.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>
      )}

      {/* Notes */}
      <motion.div variants={itemVariants} className="space-y-4">
        <Label htmlFor="notes">Additional Notes (Optional)</Label>
        <Textarea
          id="notes"
          value={approvalNotes}
          onChange={(e) => setApprovalNotes(e.target.value)}
          placeholder="Add any additional notes or comments..."
          rows={3}
        />
      </motion.div>

      {/* Approval Rules */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="useRules"
            checked={useApprovalRules}
            onCheckedChange={(checked) => setUseApprovalRules(checked as boolean)}
          />
          <Label htmlFor="useRules" className="flex items-center space-x-2">
            <Zap className="h-4 w-4" />
            <span>Apply Automated Rules</span>
          </Label>
        </div>

        {useApprovalRules && (
          <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
            {approvalRules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={rule.enabled}
                    onCheckedChange={(checked) => handleApprovalRuleToggle(rule.id, checked as boolean)}
                  />
                  <div>
                    <div className="font-medium text-sm">{rule.name}</div>
                    <div className="text-xs text-muted-foreground">{rule.description}</div>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {rule.action}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Review Selection (for bulk mode) */}
      {mode === 'bulk' && (
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Review Selection</h3>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedReviews(new Set(reviews.map(r => r.id)))}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedReviews(new Set())}
              >
                Clear All
              </Button>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={selectedReviews.has(review.id)}
                    onCheckedChange={(checked) => handleReviewSelection(review.id, checked as boolean)}
                  />
                  <div>
                    <div className="font-medium text-sm">{review.guest_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {review.overall_rating} stars • {formatDate(review.submission_date)}
                    </div>
                  </div>
                </div>
                <Badge variant={getApprovalStatusInfo(review.approved).variant}>
                  {getApprovalStatusInfo(review.approved).label}
                </Badge>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );

  const renderProcessingStep = () => (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div className="text-center space-y-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="mx-auto w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
        />
        
        <div>
          <h3 className="text-lg font-semibold">Processing Reviews</h3>
          <p className="text-muted-foreground">
            {batchProgress.currentReview 
              ? `Processing review from ${batchProgress.currentReview.guest_name}`
              : 'Preparing to process reviews...'
            }
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span>Progress</span>
          <span>{batchProgress.processed} of {batchProgress.total}</span>
        </div>
        
        <Progress 
          value={(batchProgress.processed / batchProgress.total) * 100} 
          className="h-3"
        />

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{batchProgress.successful}</div>
            <div className="text-xs text-muted-foreground">Successful</div>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{batchProgress.failed}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {batchProgress.total - batchProgress.processed}
            </div>
            <div className="text-xs text-muted-foreground">Remaining</div>
          </div>
        </div>
      </div>

      {batchProgress.errors.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-red-600">Errors</h4>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {batchProgress.errors.map((error, index) => (
              <div key={index} className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                Review {error.reviewId}: {error.error}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );

  const renderCompleteStep = () => (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div className="text-center space-y-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 10, stiffness: 100 }}
          className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center"
        >
          <CheckCircle className="w-8 h-8 text-green-600" />
        </motion.div>
        
        <div>
          <h3 className="text-lg font-semibold">Processing Complete</h3>
          <p className="text-muted-foreground">
            {results.filter(r => r.success).length} of {results.length} reviews processed successfully
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-600">
            {results.filter(r => r.success).length}
          </div>
          <div className="text-sm text-muted-foreground">Successful</div>
        </div>
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
          <div className="text-2xl font-bold text-red-600">
            {results.filter(r => !r.success).length}
          </div>
          <div className="text-sm text-muted-foreground">Failed</div>
        </div>
      </div>

      {results.filter(r => !r.success).length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-red-600">Failed Reviews</h4>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {results.filter(r => !r.success).map((result) => (
              <div key={result.reviewId} className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                Review {result.reviewId}: {result.error}
              </div>
            ))}
          </div>
        </div>
      )}

      {canUndo && (
        <div className="flex items-center justify-center">
          <Button
            variant="outline"
            onClick={handleUndoApproval}
            disabled={!canUndo}
            className="flex items-center space-x-2"
          >
            <Undo className="h-4 w-4" />
            <span>Undo All Changes</span>
          </Button>
        </div>
      )}
    </motion.div>
  );

  return (
    <>
      {/* Only render trigger button when not controlled */}
      {open === undefined && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleOpenWorkflow}
                className={cn('flex items-center space-x-2', className)}
                disabled={reviews.length === 0}
              >
                <Zap className="h-4 w-4" />
                <span>{mode === 'bulk' ? 'Bulk Approve' : 'Smart Approve'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Advanced approval workflow with automated rules and batch processing</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <Dialog open={isDialogOpen} onOpenChange={handleCloseWorkflow}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Approval Workflow</span>
              <Badge variant="outline">{currentStep}</Badge>
            </DialogTitle>
            <DialogDescription>
              {mode === 'bulk' 
                ? `Batch process ${reviews.length} reviews with advanced automation`
                : 'Smart approval with AI-powered recommendations'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <AnimatePresence mode="wait">
              {currentStep === 'setup' && renderSetupStep()}
              {currentStep === 'processing' && renderProcessingStep()}
              {currentStep === 'complete' && renderCompleteStep()}
            </AnimatePresence>
          </div>

          <DialogFooter>
            {currentStep === 'setup' && (
              <>
                <Button variant="outline" onClick={handleCloseWorkflow}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleStartProcessing}
                  disabled={approvalDecision === null || (mode === 'bulk' && selectedReviews.size === 0)}
                  className="flex items-center space-x-2"
                >
                  <Play className="h-4 w-4" />
                  <span>Start Processing</span>
                </Button>
              </>
            )}
            
            {currentStep === 'processing' && (
              <Button variant="outline" disabled>
                <Square className="h-4 w-4 mr-2" />
                Processing...
              </Button>
            )}
            
            {currentStep === 'complete' && (
              <Button onClick={handleCloseWorkflow}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

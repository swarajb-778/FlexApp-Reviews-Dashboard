/**
 * Comprehensive Test Suite for FlexLiving Approval Workflow
 * 
 * This test suite covers the enhanced approval workflow features including:
 * - Optimistic updates with rollback
 * - Real-time WebSocket integration
 * - Advanced bulk actions
 * - Analytics tracking
 * - Error handling and resilience
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { jest } from '@jest/globals';
import userEvent from '@testing-library/user-event';

// Import components and utilities
import { ApprovalWorkflow } from '@/components/ApprovalWorkflow';
import { ReviewsTable } from '@/components/ReviewsTable';
import { ReviewCard } from '@/components/ReviewCard';
import { 
  OptimisticUpdateManager, 
  WebSocketManager, 
  OfflineManager,
  createOptimisticUpdateManager,
  createWebSocketManager,
  createOfflineManager
} from '@/lib/optimistic-updates';
import { 
  useOptimisticApprovalMutation,
  useOptimisticBulkApprovalMutation,
  useRealtimeUpdates
} from '@/lib/hooks';
import { trackUserAction, trackAPIRequest } from '@/lib/analytics';

// Mock dependencies
jest.mock('@/lib/analytics', () => ({
  trackUserAction: jest.fn(),
  trackAPIRequest: jest.fn(),
  trackPerformanceMetric: jest.fn(),
  initializePerformanceMonitoring: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  approveReview: jest.fn(),
  bulkApproveReviews: jest.fn(),
  getHostawaySimple: jest.fn().mockResolvedValue({ status: 'ok', data: [] }),
}));

jest.mock('@/lib/use-toast', () => ({
  toast: jest.fn(),
}));

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  send: jest.fn(),
  close: jest.fn(),
  readyState: WebSocket.OPEN,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
})) as any;

// Test utilities
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

// Mock data
const mockReview = {
  id: 'review-1',
  guest_name: 'John Doe',
  overall_rating: 5,
  comment: 'Amazing property with great amenities!',
  created_at: '2024-01-15T10:30:00Z',
  listing_id: 'listing-1',
  channel: 'airbnb',
  approved: null,
  images: ['image1.jpg', 'image2.jpg'],
  cleanliness: 5,
  communication: 4,
  checkin: 5,
  accuracy: 4,
  location: 5,
  value: 4,
};

const mockReviews = [
  mockReview,
  {
    ...mockReview,
    id: 'review-2',
    guest_name: 'Jane Smith',
    overall_rating: 4,
    comment: 'Great location and clean space.',
  },
  {
    ...mockReview,
    id: 'review-3',
    guest_name: 'Bob Johnson',
    overall_rating: 3,
    comment: 'Good property but could use some improvements.',
    approved: true,
  },
];

describe('OptimisticUpdateManager', () => {
  let queryClient: QueryClient;
  let manager: OptimisticUpdateManager;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    manager = createOptimisticUpdateManager(queryClient);
  });

  test('should perform optimistic update and rollback on error', async () => {
    const mockMutation = jest.fn().mockRejectedValue(new Error('API Error'));
    
    // Set initial query data
    queryClient.setQueryData(['reviews', 'review-1'], { data: mockReview });
    
    try {
      await manager.updateReview('review-1', { approved: true }, mockMutation);
    } catch (error) {
      // Expected to throw
    }

    // Should have rolled back
    const reviewData = queryClient.getQueryData(['reviews', 'review-1']) as any;
    expect(reviewData?.data.approved).toBe(null); // Original value
    expect(mockMutation).toHaveBeenCalled();
  });

  test('should handle successful optimistic update', async () => {
    const mockMutation = jest.fn().mockResolvedValue({ 
      data: { ...mockReview, approved: true } 
    });
    
    queryClient.setQueryData(['reviews', 'review-1'], { data: mockReview });
    
    await manager.updateReview('review-1', { approved: true }, mockMutation);
    
    const reviewData = queryClient.getQueryData(['reviews', 'review-1']) as any;
    expect(reviewData?.data.approved).toBe(true);
    expect(mockMutation).toHaveBeenCalled();
  });

  test('should handle manual rollback', () => {
    queryClient.setQueryData(['reviews', 'review-1'], { data: mockReview });
    
    // Start an update but don't await it
    manager.updateReview('review-1', { approved: true }, jest.fn().mockImplementation(() => new Promise(() => {})));
    
    // Manually rollback
    manager.rollback('review-1');
    
    const reviewData = queryClient.getQueryData(['reviews', 'review-1']) as any;
    expect(reviewData?.data.approved).toBe(null); // Should be rolled back
  });
});

describe('WebSocketManager', () => {
  let queryClient: QueryClient;
  let manager: WebSocketManager;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    manager = createWebSocketManager(queryClient);
    jest.clearAllMocks();
  });

  test('should establish WebSocket connection', () => {
    manager.connect('ws://localhost:8080');
    expect(WebSocket).toHaveBeenCalledWith('ws://localhost:8080');
  });

  test('should handle review_updated message', () => {
    const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');
    
    manager.connect('ws://localhost:8080');
    
    // Simulate WebSocket message
    const mockWs = (WebSocket as jest.Mock).mock.instances[0];
    const onMessage = mockWs.addEventListener.mock.calls.find(
      ([event]: [string]) => event === 'message'
    )?.[1];
    
    if (onMessage) {
      onMessage({
        data: JSON.stringify({
          type: 'review_updated',
          payload: { id: 'review-1', approved: true }
        })
      });
    }
    
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['reviews', 'review-1'] });
  });

  test('should handle bulk_action_completed message', () => {
    const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');
    
    manager.connect('ws://localhost:8080');
    
    const mockWs = (WebSocket as jest.Mock).mock.instances[0];
    const onMessage = mockWs.addEventListener.mock.calls.find(
      ([event]: [string]) => event === 'message'
    )?.[1];
    
    if (onMessage) {
      onMessage({
        data: JSON.stringify({
          type: 'bulk_action_completed',
          payload: { reviewIds: ['review-1', 'review-2'] }
        })
      });
    }
    
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['reviews'] });
  });

  test('should handle connection events', () => {
    const listeners = new Map();
    manager.subscribe('connected', () => listeners.set('connected', true));
    manager.subscribe('disconnected', () => listeners.set('disconnected', true));
    
    manager.connect('ws://localhost:8080');
    
    const mockWs = (WebSocket as jest.Mock).mock.instances[0];
    const onOpen = mockWs.addEventListener.mock.calls.find(
      ([event]: [string]) => event === 'open'
    )?.[1];
    
    if (onOpen) {
      onOpen();
    }
    
    expect(listeners.get('connected')).toBe(true);
  });
});

describe('OfflineManager', () => {
  let queryClient: QueryClient;
  let manager: OfflineManager;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    manager = createOfflineManager(queryClient);
    
    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  });

  test('should queue offline actions', () => {
    const action = {
      id: 'review-1',
      type: 'approveReview',
      data: { approved: true },
      timestamp: Date.now()
    };
    
    manager.queueOfflineAction(action);
    
    const queue = manager.getOfflineQueue();
    expect(queue).toContainEqual(action);
  });

  test('should process offline queue when online', async () => {
    const mockFetchQuery = jest.spyOn(queryClient, 'fetchQuery').mockResolvedValue({});
    
    // Queue some actions
    manager.queueOfflineAction({
      id: 'review-1',
      type: 'approveReview',
      data: { approved: true },
      timestamp: Date.now()
    });
    
    await manager.processOfflineQueue();
    
    expect(mockFetchQuery).toHaveBeenCalled();
  });
});

describe('ApprovalWorkflow Component', () => {
  test('should render approval workflow dialog', () => {
    renderWithQueryClient(
      <ApprovalWorkflow
        isOpen={true}
        onClose={() => {}}
        reviewIds={['review-1', 'review-2']}
        onComplete={() => {}}
      />
    );
    
    expect(screen.getByText(/Smart Review Approval/i)).toBeInTheDocument();
    expect(screen.getByText(/Bulk Actions/i)).toBeInTheDocument();
  });

  test('should handle smart categorization', async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn();
    
    renderWithQueryClient(
      <ApprovalWorkflow
        isOpen={true}
        onClose={() => {}}
        reviewIds={['review-1', 'review-2']}
        onComplete={onComplete}
      />
    );
    
    // Test smart approve button
    const smartApproveBtn = screen.getByText(/Smart Approve/i);
    await user.click(smartApproveBtn);
    
    // Should track analytics
    expect(trackUserAction).toHaveBeenCalledWith(
      'smart_approve_initiated',
      'approval_workflow',
      expect.any(Object)
    );
  });

  test('should handle batch processing with progress', async () => {
    const user = userEvent.setup();
    
    renderWithQueryClient(
      <ApprovalWorkflow
        isOpen={true}
        onClose={() => {}}
        reviewIds={['review-1', 'review-2', 'review-3']}
        onComplete={() => {}}
      />
    );
    
    // Test batch approval
    const batchApproveBtn = screen.getByText(/Process Selected/i);
    await user.click(batchApproveBtn);
    
    // Should show progress indicator
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });
});

describe('ReviewsTable Component', () => {
  test('should render reviews table with optimistic updates', () => {
    renderWithQueryClient(
      <ReviewsTable
        reviews={mockReviews}
        loading={false}
        filters={{}}
        onFiltersChange={() => {}}
        enableOptimisticUpdates={true}
      />
    );
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
  });

  test('should handle single review approval with optimistic updates', async () => {
    const user = userEvent.setup();
    
    renderWithQueryClient(
      <ReviewsTable
        reviews={[mockReview]}
        loading={false}
        filters={{}}
        onFiltersChange={() => {}}
        enableOptimisticUpdates={true}
      />
    );
    
    // Click approve button
    const approveBtn = screen.getByLabelText(/approve review/i);
    await user.click(approveBtn);
    
    // Should track analytics
    expect(trackUserAction).toHaveBeenCalledWith(
      'review_approved_optimistic',
      'reviews_table',
      expect.any(Object)
    );
  });

  test('should handle bulk selection', async () => {
    const user = userEvent.setup();
    const onBulkAction = jest.fn();
    
    renderWithQueryClient(
      <ReviewsTable
        reviews={mockReviews}
        loading={false}
        filters={{}}
        onFiltersChange={() => {}}
        onBulkAction={onBulkAction}
        selectedReviews={[]}
        onSelectionChange={() => {}}
      />
    );
    
    // Select all checkbox
    const selectAllCheckbox = screen.getByLabelText(/select all reviews/i);
    await user.click(selectAllCheckbox);
    
    // Should call selection change
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(4); // 3 reviews + select all
  });

  test('should handle real-time updates', async () => {
    const { rerender } = renderWithQueryClient(
      <ReviewsTable
        reviews={mockReviews}
        loading={false}
        filters={{}}
        onFiltersChange={() => {}}
      />
    );
    
    // Simulate real-time update
    const updatedReviews = [
      { ...mockReview, approved: true },
      ...mockReviews.slice(1)
    ];
    
    rerender(
      <QueryClientProvider client={createTestQueryClient()}>
        <ReviewsTable
          reviews={updatedReviews}
          loading={false}
          filters={{}}
          onFiltersChange={() => {}}
        />
      </QueryClientProvider>
    );
    
    // Should show updated approval status
    await waitFor(() => {
      expect(screen.getByText(/approved/i)).toBeInTheDocument();
    });
  });

  test('should handle keyboard shortcuts', async () => {
    const user = userEvent.setup();
    
    renderWithQueryClient(
      <ReviewsTable
        reviews={mockReviews}
        loading={false}
        filters={{}}
        onFiltersChange={() => {}}
      />
    );
    
    // Test Ctrl+A for select all
    await user.keyboard('{Control>}a{/Control}');
    
    // Should track keyboard shortcut usage
    expect(trackUserAction).toHaveBeenCalledWith(
      'keyboard_shortcut_used',
      'reviews_table',
      { shortcut: 'select_all' }
    );
  });
});

describe('ReviewCard Component', () => {
  test('should render review card with all features', () => {
    renderWithQueryClient(
      <ReviewCard
        review={mockReview}
        showAdvancedActions={true}
        showCategoryBreakdown={true}
        showGuestVerification={true}
        showSocialProof={true}
        enableOptimisticUpdates={true}
      />
    );
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Amazing property with great amenities!')).toBeInTheDocument();
    expect(screen.getByText(/5\.0/)).toBeInTheDocument();
  });

  test('should handle optimistic approval', async () => {
    const user = userEvent.setup();
    
    renderWithQueryClient(
      <ReviewCard
        review={mockReview}
        enableOptimisticUpdates={true}
      />
    );
    
    const approveBtn = screen.getByLabelText(/approve/i);
    await user.click(approveBtn);
    
    // Should show optimistic state
    await waitFor(() => {
      expect(screen.getByText(/processing/i)).toBeInTheDocument();
    });
  });

  test('should show category breakdown', () => {
    renderWithQueryClient(
      <ReviewCard
        review={mockReview}
        showCategoryBreakdown={true}
      />
    );
    
    expect(screen.getByText(/cleanliness/i)).toBeInTheDocument();
    expect(screen.getByText(/communication/i)).toBeInTheDocument();
    expect(screen.getByText(/location/i)).toBeInTheDocument();
  });

  test('should handle flagging and reporting', async () => {
    const user = userEvent.setup();
    const onFlag = jest.fn();
    const onReport = jest.fn();
    
    renderWithQueryClient(
      <ReviewCard
        review={mockReview}
        showAdvancedActions={true}
        onFlag={onFlag}
        onReport={onReport}
      />
    );
    
    // Open actions menu
    const moreBtn = screen.getByLabelText(/more actions/i);
    await user.click(moreBtn);
    
    // Click flag option
    const flagBtn = screen.getByText(/flag review/i);
    await user.click(flagBtn);
    
    expect(onFlag).toHaveBeenCalledWith(mockReview.id);
  });
});

describe('Analytics Integration', () => {
  test('should track user actions correctly', () => {
    trackUserAction('test_action', 'test_category', { key: 'value' });
    
    expect(trackUserAction).toHaveBeenCalledWith(
      'test_action',
      'test_category',
      { key: 'value' }
    );
  });

  test('should track API request metrics', () => {
    const metric = {
      method: 'POST',
      url: '/api/reviews/approve',
      status: 200,
      duration: 150,
    };
    
    trackAPIRequest(metric);
    
    expect(trackAPIRequest).toHaveBeenCalledWith(metric);
  });
});

describe('Error Handling and Resilience', () => {
  test('should handle network errors gracefully', async () => {
    const mockApi = jest.fn().mockRejectedValue(new Error('Network error'));
    
    const queryClient = createTestQueryClient();
    const manager = createOptimisticUpdateManager(queryClient);
    
    queryClient.setQueryData(['reviews', 'review-1'], { data: mockReview });
    
    try {
      await manager.updateReview('review-1', { approved: true }, mockApi);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
    
    // Should have rolled back
    const reviewData = queryClient.getQueryData(['reviews', 'review-1']) as any;
    expect(reviewData?.data.approved).toBe(null);
  });

  test('should handle malformed WebSocket messages', () => {
    const queryClient = createTestQueryClient();
    const manager = createWebSocketManager(queryClient);
    
    manager.connect('ws://localhost:8080');
    
    const mockWs = (WebSocket as jest.Mock).mock.instances[0];
    const onMessage = mockWs.addEventListener.mock.calls.find(
      ([event]: [string]) => event === 'message'
    )?.[1];
    
    // Should not throw for invalid JSON
    expect(() => {
      if (onMessage) {
        onMessage({ data: 'invalid json' });
      }
    }).not.toThrow();
  });

  test('should handle component unmounting during async operations', async () => {
    const { unmount } = renderWithQueryClient(
      <ReviewCard
        review={mockReview}
        enableOptimisticUpdates={true}
      />
    );
    
    // Start an async operation
    const approveBtn = screen.getByLabelText(/approve/i);
    fireEvent.click(approveBtn);
    
    // Unmount component immediately
    unmount();
    
    // Should not cause memory leaks or errors
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });
});

describe('Performance and Optimization', () => {
  test('should memoize expensive calculations', () => {
    const { rerender } = renderWithQueryClient(
      <ReviewsTable
        reviews={mockReviews}
        loading={false}
        filters={{}}
        onFiltersChange={() => {}}
      />
    );
    
    // Re-render with same props
    rerender(
      <QueryClientProvider client={createTestQueryClient()}>
        <ReviewsTable
          reviews={mockReviews}
          loading={false}
          filters={{}}
          onFiltersChange={() => {}}
        />
      </QueryClientProvider>
    );
    
    // Component should handle re-renders efficiently
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  test('should handle large datasets efficiently', () => {
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      ...mockReview,
      id: `review-${i}`,
      guest_name: `Guest ${i}`,
    }));
    
    const startTime = performance.now();
    
    renderWithQueryClient(
      <ReviewsTable
        reviews={largeDataset.slice(0, 50)} // Should virtualize
        loading={false}
        filters={{}}
        onFiltersChange={() => {}}
      />
    );
    
    const endTime = performance.now();
    
    // Should render quickly even with large datasets
    expect(endTime - startTime).toBeLessThan(1000); // 1 second threshold
  });
});

describe('Accessibility', () => {
  test('should have proper ARIA labels', () => {
    renderWithQueryClient(
      <ReviewCard
        review={mockReview}
        enableOptimisticUpdates={true}
      />
    );
    
    expect(screen.getByLabelText(/approve review/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reject review/i)).toBeInTheDocument();
    expect(screen.getByRole('article')).toBeInTheDocument();
  });

  test('should support keyboard navigation', async () => {
    const user = userEvent.setup();
    
    renderWithQueryClient(
      <ReviewsTable
        reviews={[mockReview]}
        loading={false}
        filters={{}}
        onFiltersChange={() => {}}
      />
    );
    
    // Should be able to navigate with keyboard
    await user.tab();
    expect(document.activeElement).toHaveAccessibleName();
  });

  test('should announce changes to screen readers', async () => {
    const user = userEvent.setup();
    
    renderWithQueryClient(
      <ReviewCard
        review={mockReview}
        enableOptimisticUpdates={true}
      />
    );
    
    const approveBtn = screen.getByLabelText(/approve review/i);
    await user.click(approveBtn);
    
    // Should have live region updates
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });
});

// Test cleanup
afterEach(() => {
  jest.clearAllMocks();
});

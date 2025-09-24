'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Search,
  MessageSquare,
  Building2,
  User,
  Star,
  Calendar,
  BarChart3,
  Settings,
  Clock,
  TrendingUp,
  Filter,
  ArrowRight,
  Command as CommandIcon,
  History,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAdvancedSearch, useLocalStorage } from '@/lib/hooks';
import { trackUserAction } from '@/lib/analytics';
import { toast } from '@/lib/use-toast';

interface SearchResult {
  id: string;
  type: 'review' | 'property' | 'guest' | 'page' | 'action';
  title: string;
  subtitle?: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  action?: () => void;
  badge?: string;
  rating?: number;
  metadata?: Record<string, any>;
}

const quickActions: SearchResult[] = [
  {
    id: 'view-pending-reviews',
    type: 'action',
    title: 'View Pending Reviews',
    subtitle: '12 pending',
    icon: Clock,
    href: '/manager?status=pending',
    badge: 'Quick Action',
  },
  {
    id: 'export-data',
    type: 'action',
    title: 'Export Data',
    subtitle: 'Download reviews',
    icon: Filter,
    action: () => toast({ title: 'Export started' }),
    badge: 'Action',
  },
  {
    id: 'view-analytics',
    type: 'action',
    title: 'View Analytics',
    subtitle: 'Review insights',
    icon: BarChart3,
    href: '/analytics',
    badge: 'Navigate',
  },
  {
    id: 'automation-rules',
    type: 'action',
    title: 'Setup Automation',
    subtitle: 'Create approval rules',
    icon: Zap,
    href: '/automation/rules',
    badge: 'New',
  },
];

const recentPages: SearchResult[] = [
  {
    id: 'recent-manager',
    type: 'page',
    title: 'Review Manager',
    subtitle: 'Visited 5 minutes ago',
    icon: MessageSquare,
    href: '/manager',
  },
  {
    id: 'recent-analytics',
    type: 'page',
    title: 'Analytics Dashboard',
    subtitle: 'Visited 1 hour ago',
    icon: BarChart3,
    href: '/analytics',
  },
  {
    id: 'recent-property',
    type: 'page',
    title: 'Luxury Apartment Downtown',
    subtitle: 'Visited yesterday',
    icon: Building2,
    href: '/property/luxury-apartment-downtown',
  },
];

// Mock search function - in real app, this would query your API
const searchFunction = async (query: string): Promise<SearchResult[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const mockResults: SearchResult[] = [
    {
      id: 'review-1',
      type: 'review',
      title: 'Great stay at downtown apartment',
      subtitle: 'By Sarah Johnson',
      description: '5-star review from Airbnb',
      icon: Star,
      rating: 5,
      href: '/manager?search=sarah+johnson',
      metadata: { channel: 'Airbnb', status: 'pending' },
    },
    {
      id: 'property-1',
      type: 'property',
      title: 'Luxury Apartment Downtown',
      subtitle: '4.8 ⭐ • 156 reviews',
      description: 'Premium downtown location with city views',
      icon: Building2,
      href: '/property/luxury-apartment-downtown',
      metadata: { type: 'apartment', location: 'downtown' },
    },
    {
      id: 'guest-1',
      type: 'guest',
      title: 'John Smith',
      subtitle: '3 reviews • Last stayed Dec 2023',
      description: 'Frequent guest with positive reviews',
      icon: User,
      href: '/guests/john-smith',
      metadata: { totalReviews: 3, lastStay: '2023-12-15' },
    },
  ];

  // Filter results based on query
  return mockResults.filter(result =>
    result.title.toLowerCase().includes(query.toLowerCase()) ||
    result.subtitle?.toLowerCase().includes(query.toLowerCase()) ||
    result.description?.toLowerCase().includes(query.toLowerCase())
  );
};

export function GlobalSearch() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useLocalStorage<string[]>('recent-searches', []);
  
  const searchHook = useAdvancedSearch(searchFunction, {
    debounceMs: 300,
    minQueryLength: 2,
    cacheKey: 'global-search',
  });

  const { query, setQuery, debouncedQuery, isSearching, results, clearSearch } = searchHook;

  // Keyboard shortcut to open search (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        trackUserAction('global_search_opened', 'search', { method: 'keyboard' });
      }
      
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        clearSearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, clearSearch]);

  const handleResultSelect = useCallback((result: SearchResult) => {
    // Add to recent searches if it's a text query
    if (debouncedQuery && !recentSearches.includes(debouncedQuery)) {
      setRecentSearches(prev => [debouncedQuery, ...prev.slice(0, 4)]);
    }

    trackUserAction('search_result_selected', 'search', {
      query: debouncedQuery,
      resultType: result.type,
      resultId: result.id,
    });

    if (result.action) {
      result.action();
    } else if (result.href) {
      router.push(result.href);
    }

    setIsOpen(false);
    clearSearch();
  }, [debouncedQuery, recentSearches, setRecentSearches, router, clearSearch]);

  const handleRecentSearchClick = useCallback((searchTerm: string) => {
    setQuery(searchTerm);
    trackUserAction('recent_search_selected', 'search', { query: searchTerm });
  }, [setQuery]);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    trackUserAction('recent_searches_cleared', 'search');
  }, [setRecentSearches]);

  const searchGroups = useMemo(() => {
    const groups: Array<{ title: string; items: SearchResult[] }> = [];

    // Show quick actions when no query or short query
    if (!debouncedQuery || debouncedQuery.length < 2) {
      groups.push({
        title: 'Quick Actions',
        items: quickActions,
      });

      groups.push({
        title: 'Recent Pages',
        items: recentPages,
      });
    }

    // Show search results when we have them
    if (results && results.length > 0) {
      // Group results by type
      const resultsByType = results.reduce((acc, result) => {
        if (!acc[result.type]) {
          acc[result.type] = [];
        }
        acc[result.type].push(result);
        return acc;
      }, {} as Record<string, SearchResult[]>);

      const typeLabels: Record<string, string> = {
        review: 'Reviews',
        property: 'Properties',
        guest: 'Guests',
        page: 'Pages',
        action: 'Actions',
      };

      Object.entries(resultsByType).forEach(([type, items]) => {
        groups.push({
          title: typeLabels[type] || type,
          items,
        });
      });
    }

    return groups;
  }, [debouncedQuery, results]);

  const ResultItem = ({ result }: { result: SearchResult }) => {
    const Icon = result.icon;
    
    return (
      <CommandItem
        value={result.id}
        onSelect={() => handleResultSelect(result)}
        className="flex items-center space-x-3 p-3 cursor-pointer"
      >
        <div className={cn(
          'p-2 rounded-lg',
          result.type === 'review' && 'bg-yellow-100 dark:bg-yellow-900/20',
          result.type === 'property' && 'bg-blue-100 dark:bg-blue-900/20',
          result.type === 'guest' && 'bg-green-100 dark:bg-green-900/20',
          result.type === 'page' && 'bg-purple-100 dark:bg-purple-900/20',
          result.type === 'action' && 'bg-orange-100 dark:bg-orange-900/20'
        )}>
          <Icon className={cn(
            'h-4 w-4',
            result.type === 'review' && 'text-yellow-600',
            result.type === 'property' && 'text-blue-600',
            result.type === 'guest' && 'text-green-600',
            result.type === 'page' && 'text-purple-600',
            result.type === 'action' && 'text-orange-600'
          )} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <p className="font-medium text-sm truncate">{result.title}</p>
            {result.badge && (
              <Badge variant="secondary" className="text-xs">
                {result.badge}
              </Badge>
            )}
            {result.rating && (
              <div className="flex items-center space-x-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs text-muted-foreground">{result.rating}</span>
              </div>
            )}
          </div>
          
          {result.subtitle && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {result.subtitle}
            </p>
          )}
          
          {result.description && (
            <p className="text-xs text-muted-foreground/80 truncate mt-0.5">
              {result.description}
            </p>
          )}
        </div>

        <ArrowRight className="h-3 w-3 text-muted-foreground opacity-50" />
      </CommandItem>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Global Search</DialogTitle>
          <DialogDescription>
            Search for reviews, properties, guests, and more
          </DialogDescription>
        </DialogHeader>

        <Command className="border-0">
          <div className="flex items-center border-b px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground mr-2" />
            <CommandInput
              placeholder="Search reviews, properties, guests..."
              value={query}
              onValueChange={setQuery}
              className="border-0 outline-0 ring-0 focus:ring-0"
            />
            {isSearching && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="ml-2"
              >
                <Search className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            )}
          </div>

          <CommandList className="max-h-96 overflow-y-auto">
            {/* Recent Searches */}
            {!debouncedQuery && recentSearches.length > 0 && (
              <>
                <CommandGroup>
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-xs font-medium text-muted-foreground">Recent Searches</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearRecentSearches}
                      className="h-6 px-2 text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                  {recentSearches.map((search, index) => (
                    <CommandItem
                      key={search}
                      value={`recent-${search}`}
                      onSelect={() => handleRecentSearchClick(search)}
                      className="flex items-center space-x-3 p-3 cursor-pointer"
                    >
                      <History className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{search}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {/* Search Groups */}
            <AnimatePresence>
              {searchGroups.map((group, groupIndex) => (
                <motion.div
                  key={group.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: groupIndex * 0.05 }}
                >
                  <CommandGroup heading={group.title}>
                    {group.items.map((item) => (
                      <ResultItem key={item.id} result={item} />
                    ))}
                  </CommandGroup>
                  {groupIndex < searchGroups.length - 1 && <CommandSeparator />}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* No Results */}
            {debouncedQuery && results && results.length === 0 && !isSearching && (
              <CommandEmpty>
                <div className="text-center py-6">
                  <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">No results found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try adjusting your search terms or browse quick actions above.
                  </p>
                </div>
              </CommandEmpty>
            )}
          </CommandList>

          {/* Footer */}
          <div className="border-t px-4 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                    <span className="text-xs">↵</span>
                  </kbd>
                  <span>to select</span>
                </div>
                <div className="flex items-center space-x-1">
                  <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                    <span className="text-xs">ESC</span>
                  </kbd>
                  <span>to close</span>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <CommandIcon className="h-3 w-3" />
                <span>+K to open</span>
              </div>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

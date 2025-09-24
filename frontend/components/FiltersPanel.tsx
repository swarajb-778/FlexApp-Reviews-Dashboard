'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  X,
  CalendarIcon,
  Star,
  RotateCcw,
  Building,
  CheckCircle,
  Clock,
  XCircle,
  Save,
  History,
  Share,
  TrendingUp,
  Sparkles,
  BookmarkPlus,
  Trash2,
  Heart,
  MoreHorizontal,
  Zap,
  Settings,
  Users,
  MapPin,
  Calendar as CalendarIcon2,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { ReviewFilters, FilterPreset, FilterSuggestion } from '@/lib/types';
import { FILTER_OPTIONS, CHANNELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { debounce } from '@/lib/utils';
import { useAdvancedSearch, useLocalStorage } from '@/lib/hooks';
import { trackUserAction } from '@/lib/analytics';
import { toast } from '@/lib/use-toast';

interface FiltersPanelProps {
  filters: ReviewFilters;
  onFiltersChange: (filters: ReviewFilters) => void;
  onClose?: () => void;
  className?: string;
  showPresets?: boolean;
  showHistory?: boolean;
  showSuggestions?: boolean;
  enableUrlSync?: boolean;
  compactMode?: boolean;
  availableListings?: Array<{ id: string; name: string; address?: string }>;
  onShareFilters?: (filters: ReviewFilters) => void;
}

const statusOptions = [
  { value: 'all', label: 'All Reviews', icon: Filter, color: 'hsl(var(--muted-foreground))', count: 0 },
  { value: 'pending', label: 'Pending', icon: Clock, color: 'hsl(48 94% 68%)', count: 0 },
  { value: 'approved', label: 'Approved', icon: CheckCircle, color: 'hsl(142 71% 45%)', count: 0 },
  { value: 'rejected', label: 'Rejected', icon: XCircle, color: 'hsl(0 84% 60%)', count: 0 },
];

const ratingOptions = [
  { value: '', label: 'All Ratings', stars: 0 },
  { value: '5', label: '5 Stars', stars: 5 },
  { value: '4', label: '4+ Stars', stars: 4 },
  { value: '3', label: '3+ Stars', stars: 3 },
  { value: '2', label: '2+ Stars', stars: 2 },
  { value: '1', label: '1+ Stars', stars: 1 },
];

// Channel options with brand colors and icons
const channelOptions = [
  { value: '', label: 'All Channels', icon: null, color: null },
  { value: 'airbnb', label: 'Airbnb', icon: '🏠', color: CHANNELS.AIRBNB?.color || 'hsl(0 100% 65%)' },
  { value: 'booking', label: 'Booking.com', icon: '🛏️', color: CHANNELS.BOOKING?.color || 'hsl(210 100% 25%)' },
  { value: 'vrbo', label: 'VRBO', icon: '🏖️', color: CHANNELS.VRBO?.color || 'hsl(225 100% 30%)' },
  { value: 'expedia', label: 'Expedia', icon: '✈️', color: CHANNELS.EXPEDIA?.color || 'hsl(48 100% 50%)' },
  { value: 'direct', label: 'Direct Booking', icon: '🏢', color: CHANNELS.DIRECT?.color || 'hsl(142 71% 45%)' },
];

// Advanced date presets
const datePresets = [
  {
    label: 'Today',
    value: 'today',
    range: () => ({ from: new Date(), to: new Date() }),
    icon: CalendarIcon2,
  },
  {
    label: 'Yesterday',
    value: 'yesterday',
    range: () => {
      const yesterday = subDays(new Date(), 1);
      return { from: yesterday, to: yesterday };
    },
    icon: Clock,
  },
  {
    label: 'Last 7 days',
    value: 'last_7_days',
    range: () => ({ from: subDays(new Date(), 7), to: new Date() }),
    icon: CalendarIcon2,
  },
  {
    label: 'Last 30 days',
    value: 'last_30_days',
    range: () => ({ from: subDays(new Date(), 30), to: new Date() }),
    icon: CalendarIcon2,
  },
  {
    label: 'This month',
    value: 'this_month',
    range: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }),
    icon: CalendarIcon2,
  },
  {
    label: 'This year',
    value: 'this_year',
    range: () => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) }),
    icon: CalendarIcon2,
  },
];

// Default filter presets
const defaultPresets: FilterPreset[] = [
  {
    id: 'high-rating-pending',
    name: 'High Rating Pending',
    icon: Sparkles,
    filters: { status: 'pending', rating: 4 },
    description: '4+ star reviews awaiting approval',
    color: 'hsl(48 94% 68%)',
  },
  {
    id: 'recent-rejections',
    name: 'Recent Rejections',
    icon: XCircle,
    filters: { status: 'rejected', dateRange: [subDays(new Date(), 7), new Date()] },
    description: 'Reviews rejected in the last week',
    color: 'hsl(0 84% 60%)',
  },
  {
    id: 'low-approved-ratings',
    name: 'Low Approved Ratings',
    icon: TrendingUp,
    filters: { status: 'approved', rating: 3 },
    description: 'Approved reviews with 3 or fewer stars',
    color: 'hsl(142 71% 45%)',
  },
  {
    id: 'airbnb-recent',
    name: 'Recent Airbnb',
    icon: Building,
    filters: { channel: 'airbnb', dateRange: [subDays(new Date(), 14), new Date()] },
    description: 'Airbnb reviews from last 2 weeks',
    color: 'hsl(0 100% 65%)',
  },
];

// Smart filter suggestions based on current filters
const generateFilterSuggestions = (currentFilters: ReviewFilters): FilterSuggestion[] => {
  const suggestions: FilterSuggestion[] = [];

  // If no status filter, suggest focusing on pending
  if (!currentFilters.status) {
    suggestions.push({
      id: 'focus-pending',
      title: 'Focus on pending reviews',
      description: 'Show only reviews awaiting approval',
      filters: { ...currentFilters, status: 'pending' },
      confidence: 0.9,
    });
  }

  // If high rating filter, suggest also filtering by channel
  if (currentFilters.rating && currentFilters.rating >= 4 && !currentFilters.channel) {
    suggestions.push({
      id: 'high-rating-airbnb',
      title: 'High-rated Airbnb reviews',
      description: 'Focus on Airbnb for your high-rating filter',
      filters: { ...currentFilters, channel: 'airbnb' },
      confidence: 0.8,
    });
  }

  // If no date range, suggest recent reviews
  if (!currentFilters.dateRange || (!currentFilters.dateRange[0] && !currentFilters.dateRange[1])) {
    suggestions.push({
      id: 'recent-reviews',
      title: 'Focus on recent reviews',
      description: 'Show reviews from the last 7 days',
      filters: { ...currentFilters, dateRange: [subDays(new Date(), 7), new Date()] },
      confidence: 0.7,
    });
  }

  return suggestions.slice(0, 3); // Limit to top 3 suggestions
};

export function FiltersPanel({ 
  filters, 
  onFiltersChange, 
  onClose,
  className,
  showPresets = true,
  showHistory = true,
  showSuggestions = true,
  enableUrlSync = false,
  compactMode = false,
  availableListings = [],
  onShareFilters,
}: FiltersPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [localFilters, setLocalFilters] = useState<ReviewFilters>(filters);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    filters.dateRange ? {
      from: filters.dateRange[0] || undefined,
      to: filters.dateRange[1] || undefined
    } : undefined
  );
  const [searchTerm, setSearchTerm] = useState(filters.searchQuery || '');
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced' | 'presets'>('basic');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [selectedDatePreset, setSelectedDatePreset] = useState<string>('');
  
  // Local storage for presets and history
  const [savedPresets, setSavedPresets] = useLocalStorage<FilterPreset[]>('filter-presets', defaultPresets);
  const [filterHistory, setFilterHistory] = useLocalStorage<ReviewFilters[]>('filter-history', []);
  const [favoritePresets, setFavoritePresets] = useLocalStorage<string[]>('favorite-presets', []);
  
  // Property search with autocomplete
  const propertySearch = useAdvancedSearch(
    async (query: string) => {
      // In real app, this would search the API
      return availableListings.filter(listing => 
        listing.name.toLowerCase().includes(query.toLowerCase()) ||
        listing.address?.toLowerCase().includes(query.toLowerCase())
      );
    },
    { debounceMs: 200, minQueryLength: 1, cacheKey: 'property-search' }
  );
  
  // Generate smart suggestions
  const smartSuggestions = useMemo(() => {
    if (!showSuggestions) return [];
    return generateFilterSuggestions(localFilters);
  }, [localFilters, showSuggestions]);
  
  // Track filter usage for analytics
  const trackFilterUsage = (filterType: string, value: any) => {
    trackUserAction('filter_applied', 'filter_panel', {
      filterType, value, timestamp: Date.now(),
    });
  };

  // Debounced search handler
  const debouncedSearch = debounce((term: string) => {
    const newFilters = { ...localFilters, searchQuery: term };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
    trackFilterUsage('search', term);
  }, 300);

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);
  
  // URL sync effect
  useEffect(() => {
    if (!enableUrlSync) return;
    
    const params = new URLSearchParams();
    Object.entries(localFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (key === 'dateRange' && Array.isArray(value)) {
          if (value[0]) params.set('dateFrom', value[0].toISOString());
          if (value[1]) params.set('dateTo', value[1].toISOString());
        } else {
          params.set(key, String(value));
        }
      }
    });
    
    const newUrl = params.toString() ? `${pathname}?${params}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [localFilters, enableUrlSync, pathname, router]);
  
  // Load filters from URL on mount
  useEffect(() => {
    if (!enableUrlSync) return;
    
    const filtersFromUrl: ReviewFilters = {};
    
    searchParams.forEach((value, key) => {
      switch (key) {
        case 'searchQuery':
          filtersFromUrl.searchQuery = value;
          setSearchTerm(value);
          break;
        case 'status':
          filtersFromUrl.status = value;
          break;
        case 'rating':
          filtersFromUrl.rating = parseInt(value);
          break;
        case 'channel':
          filtersFromUrl.channel = value;
          break;
        case 'listing':
          filtersFromUrl.listing = value;
          break;
        case 'dateFrom':
        case 'dateTo':
          if (!filtersFromUrl.dateRange) filtersFromUrl.dateRange = [null, null];
          const dateIndex = key === 'dateFrom' ? 0 : 1;
          filtersFromUrl.dateRange[dateIndex] = new Date(value);
          break;
      }
    });
    
    if (Object.keys(filtersFromUrl).length > 0) {
      setLocalFilters(prev => ({ ...prev, ...filtersFromUrl }));
      if (filtersFromUrl.dateRange) {
        setDateRange({
          from: filtersFromUrl.dateRange[0] || undefined,
          to: filtersFromUrl.dateRange[1] || undefined,
        });
      }
    }
  }, [searchParams, enableUrlSync]);

  const updateFilter = (key: keyof ReviewFilters, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
    trackFilterUsage(key, value);
    
    // Add to history if significantly different
    const isSignificantChange = Object.keys(newFilters).length !== Object.keys(localFilters).length ||
      Object.entries(newFilters).some(([k, v]) => (localFilters as any)[k] !== v);
    
    if (isSignificantChange && showHistory) {
      setFilterHistory(prev => {
        const newHistory = [localFilters, ...prev.filter(f => JSON.stringify(f) !== JSON.stringify(localFilters))];
        return newHistory.slice(0, 10); // Keep only last 10
      });
    }
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    updateFilter('dateRange', range ? [range.from || null, range.to || null] : [null, null]);
  };

  const clearFilters = () => {
    const clearedFilters: ReviewFilters = {};
    setLocalFilters(clearedFilters);
    setDateRange(undefined);
    setSearchTerm('');
    setSelectedDatePreset('');
    onFiltersChange(clearedFilters);
    trackUserAction('filters_cleared', 'filter_panel');
    toast({
      title: 'Filters cleared',
      description: 'All filters have been reset to default values.',
    });
  };
  
  const saveCurrentPreset = () => {
    if (!presetName.trim()) {
      toast({
        title: 'Preset name required',
        description: 'Please enter a name for your filter preset.',
        variant: 'destructive',
      });
      return;
    }
    
    const newPreset: FilterPreset = {
      id: `custom-${Date.now()}`,
      name: presetName.trim(),
      filters: localFilters,
      description: generatePresetDescription(localFilters),
      color: 'hsl(221 83% 53%)',
      icon: BookmarkPlus,
      isCustom: true,
      createdAt: new Date().toISOString(),
    };
    
    setSavedPresets(prev => [newPreset, ...prev]);
    setPresetName('');
    setShowSaveDialog(false);
    trackUserAction('preset_saved', 'filter_panel', { presetName: newPreset.name });
    toast({
      title: 'Preset saved',
      description: `"${newPreset.name}" has been saved to your presets.`,
    });
  };
  
  const applyPreset = (preset: FilterPreset) => {
    setLocalFilters(preset.filters);
    onFiltersChange(preset.filters);
    
    // Update UI state based on preset
    setSearchTerm(preset.filters.searchQuery || '');
    if (preset.filters.dateRange) {
      setDateRange({
        from: preset.filters.dateRange[0] || undefined,
        to: preset.filters.dateRange[1] || undefined,
      });
    } else {
      setDateRange(undefined);
    }
    
    trackUserAction('preset_applied', 'filter_panel', { presetId: preset.id });
    toast({
      title: 'Preset applied',
      description: `"${preset.name}" filters have been applied.`,
    });
  };
  
  const deletePreset = (presetId: string) => {
    setSavedPresets(prev => prev.filter(p => p.id !== presetId));
    setFavoritePresets(prev => prev.filter(id => id !== presetId));
    trackUserAction('preset_deleted', 'filter_panel', { presetId });
    toast({
      title: 'Preset deleted',
      description: 'The filter preset has been removed.',
    });
  };
  
  const toggleFavoritePreset = (presetId: string) => {
    setFavoritePresets(prev => 
      prev.includes(presetId) 
        ? prev.filter(id => id !== presetId)
        : [...prev, presetId]
    );
  };
  
  const shareFilters = () => {
    if (onShareFilters) {
      onShareFilters(localFilters);
    } else if (enableUrlSync) {
      const currentUrl = window.location.href;
      navigator.clipboard.writeText(currentUrl).then(() => {
        toast({
          title: 'Filters shared',
          description: 'Filter URL copied to clipboard.',
        });
      });
    }
    trackUserAction('filters_shared', 'filter_panel');
  };
  
  const applyDatePreset = (presetValue: string) => {
    const preset = datePresets.find(p => p.value === presetValue);
    if (preset) {
      const range = preset.range();
      setDateRange(range);
      updateFilter('dateRange', [range.from, range.to]);
      setSelectedDatePreset(presetValue);
    }
  };
  
  const generatePresetDescription = (filters: ReviewFilters): string => {
    const parts: string[] = [];
    
    if (filters.status && filters.status !== 'all') {
      const status = statusOptions.find(s => s.value === filters.status);
      if (status) parts.push(status.label.toLowerCase());
    }
    
    if (filters.rating) {
      parts.push(`${filters.rating}+ star reviews`);
    }
    
    if (filters.channel) {
      const channel = channelOptions.find(c => c.value === filters.channel);
      if (channel) parts.push(`from ${channel.label}`);
    }
    
    if (filters.dateRange && (filters.dateRange[0] || filters.dateRange[1])) {
      parts.push('with date filter');
    }
    
    return parts.length > 0 ? parts.join(', ') : 'Custom filter combination';
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (localFilters.searchQuery) count++;
    if (localFilters.status && localFilters.status !== 'all') count++;
    if (localFilters.rating) count++;
    if (localFilters.channel) count++;
    if (localFilters.listing) count++;
    if (localFilters.dateRange && (localFilters.dateRange[0] || localFilters.dateRange[1])) count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <Card className={cn('w-full', compactMode && 'shadow-sm', className)}>
      <CardHeader className={cn('pb-3', compactMode && 'pb-2 px-4')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Filter className="h-5 w-5 text-primary" />
              {smartSuggestions.length > 0 && (
                <div className="absolute -top-1 -right-1 h-2 w-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full animate-pulse" />
              )}
            </div>
            <CardTitle className={cn('text-lg', compactMode && 'text-base')}>Filters</CardTitle>
            <AnimatePresence>
              {activeFilterCount > 0 && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="flex items-center space-x-1"
                >
                  <Badge variant="default" className="text-xs bg-primary">
                    {activeFilterCount}
                  </Badge>
                  {smartSuggestions.length > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-white animate-pulse cursor-pointer">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Smart
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Smart suggestions available</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="flex items-center space-x-1">
            {/* Filter actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {showPresets && (
                  <DropdownMenuItem onClick={() => setShowSaveDialog(true)}>
                    <Save className="h-4 w-4 mr-2" />
                    Save as Preset
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={shareFilters}>
                  <Share className="h-4 w-4 mr-2" />
                  Share Filters
                </DropdownMenuItem>
                {showHistory && filterHistory.length > 0 && (
                  <DropdownMenuItem onClick={() => setActiveTab('presets')}>
                    <History className="h-4 w-4 mr-2" />
                    Filter History
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={clearFilters} disabled={activeFilterCount === 0}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Clear All
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className={cn('space-y-6', compactMode && 'space-y-4 px-4')}>
        {/* Smart Suggestions Banner */}
        <AnimatePresence>
          {smartSuggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Zap className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                    Smart Suggestions
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {smartSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded border border-yellow-200 dark:border-yellow-700 hover:shadow-sm transition-shadow cursor-pointer"
                    onClick={() => {
                      setLocalFilters(suggestion.filters);
                      onFiltersChange(suggestion.filters);
                      trackUserAction('suggestion_applied', 'filter_panel', { suggestionId: suggestion.id });
                    }}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {suggestion.title}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {suggestion.description}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="text-xs">
                      Apply
                    </Button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="search">Search Reviews</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search by guest name, review text, or property..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn('pl-9 form-input-focus', searchTerm && 'pr-8')}
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
                onClick={() => setSearchTerm('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        <Separator />

        {/* Status Filter */}
        <div className="space-y-3">
          <Label>Review Status</Label>
          <div className={cn(
            'grid gap-2',
            compactMode ? 'grid-cols-2' : 'grid-cols-2'
          )}>
            {statusOptions.map((option) => {
              const Icon = option.icon;
              const isActive = localFilters.status === option.value || (!localFilters.status && option.value === 'all');
              
              return (
                <motion.div
                  key={option.value}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateFilter('status', option.value === 'all' ? undefined : option.value)}
                    className={cn(
                      'justify-start w-full transition-all duration-200',
                      isActive && 'shadow-md',
                      !isActive && 'hover:border-primary/50'
                    )}
                    style={{
                      borderColor: isActive ? option.color : undefined,
                      boxShadow: isActive ? `0 0 0 1px ${option.color}20` : undefined,
                    }}
                  >
                    <Icon 
                      className="h-4 w-4 mr-2" 
                      style={{ color: isActive ? undefined : option.color }}
                    />
                    <span className="text-xs font-medium">{option.label}</span>
                    {option.count > 0 && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {option.count}
                      </Badge>
                    )}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Enhanced Rating Filter */}
        <div className="space-y-2">
          <Label htmlFor="rating">Minimum Rating</Label>
          <Select
            value={localFilters.rating?.toString() || ''}
            onValueChange={(value) => updateFilter('rating', value ? parseInt(value) : undefined)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select minimum rating" />
            </SelectTrigger>
            <SelectContent>
              {ratingOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center space-x-2">
                    {option.stars > 0 && (
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              'h-3 w-3',
                              i < option.stars
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'fill-gray-200 text-gray-200'
                            )}
                          />
                        ))}
                      </div>
                    )}
                    <span>{option.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Enhanced Channel Filter */}
        <div className="space-y-2">
          <Label htmlFor="channel">Booking Channel</Label>
          <Select
            value={localFilters.channel || ''}
            onValueChange={(value) => updateFilter('channel', value || undefined)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select booking channel" />
            </SelectTrigger>
            <SelectContent>
              {channelOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center space-x-2">
                    {option.icon && <span className="text-sm">{option.icon}</span>}
                    <span>{option.label}</span>
                    {option.color && (
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: option.color }}
                      />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Enhanced Property Filter with Autocomplete */}
        <div className="space-y-2">
          <Label htmlFor="listing">Property</Label>
          {availableListings.length > 0 ? (
            <div className="relative">
              <Input
                placeholder="Search properties..."
                value={propertySearch.query}
                onChange={(e) => propertySearch.setQuery(e.target.value)}
                className="pl-9"
              />
              <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              {propertySearch.results && propertySearch.results.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                  {propertySearch.results.map((listing) => (
                    <div
                      key={listing.id}
                      className="px-3 py-2 hover:bg-accent cursor-pointer"
                      onClick={() => {
                        updateFilter('listing', listing.id);
                        propertySearch.clearSearch();
                      }}
                    >
                      <div className="font-medium text-sm">{listing.name}</div>
                      {listing.address && (
                        <div className="text-xs text-muted-foreground">{listing.address}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Select
              value={localFilters.listing || ''}
              onValueChange={(value) => updateFilter('listing', value || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Properties</SelectItem>
                <SelectItem value="luxury-apt-downtown">Luxury Apartment Downtown</SelectItem>
                <SelectItem value="cozy-villa-beach">Cozy Villa Near Beach</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <Separator />

        {/* Enhanced Date Range Filter */}
        <div className="space-y-2">
          <Label>Date Range</Label>
          
          {/* Date presets */}
          <div className="flex flex-wrap gap-1 mb-2">
            {datePresets.map((preset) => (
              <Button
                key={preset.value}
                variant={selectedDatePreset === preset.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyDatePreset(preset.value)}
                className="text-xs"
              >
                <preset.icon className="h-3 w-3 mr-1" />
                {preset.label}
              </Button>
            ))}
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !dateRange && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, 'LLL dd, y')} -{' '}
                      {format(dateRange.to, 'LLL dd, y')}
                    </>
                  ) : (
                    format(dateRange.from, 'LLL dd, y')
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={handleDateRangeChange}
                numberOfMonths={2}
              />
              <div className="p-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleDateRangeChange(undefined);
                    setSelectedDatePreset('');
                  }}
                  className="w-full"
                >
                  Clear dates
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Saved Presets Quick Access */}
        {showPresets && savedPresets.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label>Saved Presets</Label>
              <div className="grid grid-cols-2 gap-2">
                {savedPresets.slice(0, 4).map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <div key={preset.id} className="relative group">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyPreset(preset)}
                        className="w-full justify-start text-xs text-left"
                        style={{ borderColor: `${preset.color}40` }}
                      >
                        <Icon className="h-3 w-3 mr-1" style={{ color: preset.color }} />
                        {preset.name}
                      </Button>
                      {preset.isCustom && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute -top-1 -right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePreset(preset.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Save Preset Dialog */}
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Filter Preset</DialogTitle>
              <DialogDescription>
                Create a preset to quickly apply these filters in the future.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="preset-name">Preset Name</Label>
                <Input
                  id="preset-name"
                  placeholder="Enter preset name..."
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Current filters:</p>
                <p className="mt-1">{generatePresetDescription(localFilters)}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                Cancel
              </Button>
              <Button onClick={saveCurrentPreset}>Save Preset</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

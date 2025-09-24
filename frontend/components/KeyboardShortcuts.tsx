'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Command,
  Keyboard,
  Search,
  CheckCircle,
  XCircle,
  Filter,
  Download,
  RefreshCw,
  Settings,
  HelpCircle as Help,
  Zap,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  X,
  Eye,
  Edit,
  Save,
  Undo,
  RotateCcw,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocalStorage } from '@/lib/hooks';
import { trackUserAction } from '@/lib/analytics';
import { toast } from '@/lib/use-toast';

// Keyboard shortcut definitions
export interface KeyboardShortcut {
  id: string;
  keys: string[];
  description: string;
  category: string;
  action: () => void;
  disabled?: boolean;
  global?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

interface ShortcutCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const categories: ShortcutCategory[] = [
  { id: 'navigation', name: 'Navigation', icon: ArrowUp, color: 'hsl(221 83% 53%)' },
  { id: 'approval', name: 'Approval', icon: CheckCircle, color: 'hsl(142 71% 45%)' },
  { id: 'filtering', name: 'Filtering', icon: Filter, color: 'hsl(262 83% 58%)' },
  { id: 'actions', name: 'Actions', icon: Zap, color: 'hsl(45 93% 47%)' },
  { id: 'general', name: 'General', icon: Command, color: 'hsl(215 16% 47%)' },
];

interface KeyboardShortcutsProps {
  shortcuts?: KeyboardShortcut[];
  onShortcutTriggered?: (shortcutId: string) => void;
  className?: string;
  showHelpOnMount?: boolean;
  enableGlobalShortcuts?: boolean;
  customShortcuts?: Record<string, KeyboardShortcut>;
}

// Default shortcuts for the review system
const defaultShortcuts: KeyboardShortcut[] = [
  // Navigation
  {
    id: 'navigate-up',
    keys: ['ArrowUp', 'k'],
    description: 'Navigate to previous review',
    category: 'navigation',
    action: () => console.log('Navigate up'),
    icon: ArrowUp,
    global: true,
  },
  {
    id: 'navigate-down',
    keys: ['ArrowDown', 'j'],
    description: 'Navigate to next review',
    category: 'navigation',
    action: () => console.log('Navigate down'),
    icon: ArrowDown,
    global: true,
  },
  {
    id: 'navigate-first',
    keys: ['Home', 'g g'],
    description: 'Go to first review',
    category: 'navigation',
    action: () => console.log('Navigate first'),
    icon: ArrowUp,
  },
  {
    id: 'navigate-last',
    keys: ['End', 'G'],
    description: 'Go to last review',
    category: 'navigation',
    action: () => console.log('Navigate last'),
    icon: ArrowDown,
  },

  // Approval actions
  {
    id: 'approve-review',
    keys: ['a', 'Enter'],
    description: 'Approve selected review',
    category: 'approval',
    action: () => console.log('Approve review'),
    icon: CheckCircle,
    global: true,
  },
  {
    id: 'reject-review',
    keys: ['r', 'x'],
    description: 'Reject selected review',
    category: 'approval',
    action: () => console.log('Reject review'),
    icon: XCircle,
    global: true,
  },
  {
    id: 'select-all',
    keys: ['Ctrl+a', 'Meta+a'],
    description: 'Select all visible reviews',
    category: 'approval',
    action: () => console.log('Select all'),
    icon: CheckCircle,
  },
  {
    id: 'approve-selected',
    keys: ['Shift+a'],
    description: 'Approve all selected reviews',
    category: 'approval',
    action: () => console.log('Approve selected'),
    icon: CheckCircle,
  },
  {
    id: 'reject-selected',
    keys: ['Shift+r'],
    description: 'Reject all selected reviews',
    category: 'approval',
    action: () => console.log('Reject selected'),
    icon: XCircle,
  },

  // Filtering
  {
    id: 'open-filters',
    keys: ['f', '/'],
    description: 'Open filter panel',
    category: 'filtering',
    action: () => console.log('Open filters'),
    icon: Filter,
    global: true,
  },
  {
    id: 'clear-filters',
    keys: ['Shift+f'],
    description: 'Clear all filters',
    category: 'filtering',
    action: () => console.log('Clear filters'),
    icon: RotateCcw,
  },
  {
    id: 'focus-search',
    keys: ['s', 'Ctrl+f'],
    description: 'Focus search input',
    category: 'filtering',
    action: () => console.log('Focus search'),
    icon: Search,
    global: true,
  },

  // Actions
  {
    id: 'refresh-data',
    keys: ['Ctrl+r', 'F5'],
    description: 'Refresh review data',
    category: 'actions',
    action: () => console.log('Refresh data'),
    icon: RefreshCw,
  },
  {
    id: 'export-data',
    keys: ['Ctrl+e'],
    description: 'Export current view',
    category: 'actions',
    action: () => console.log('Export data'),
    icon: Download,
  },
  {
    id: 'undo-action',
    keys: ['Ctrl+z'],
    description: 'Undo last action',
    category: 'actions',
    action: () => console.log('Undo action'),
    icon: Undo,
  },
  {
    id: 'view-details',
    keys: ['Enter', 'Space'],
    description: 'View selected review details',
    category: 'actions',
    action: () => console.log('View details'),
    icon: Eye,
  },

  // General
  {
    id: 'show-help',
    keys: ['?', 'h', 'F1'],
    description: 'Show keyboard shortcuts help',
    category: 'general',
    action: () => console.log('Show help'),
    icon: Help,
    global: true,
  },
  {
    id: 'close-modal',
    keys: ['Escape'],
    description: 'Close modal or panel',
    category: 'general',
    action: () => console.log('Close modal'),
    icon: X,
    global: true,
  },
];

// Key combination formatter
const formatKeyCombo = (keys: string[]): { key: string; modifier?: string }[] => {
  return keys.flatMap(keyCombo => {
    // Handle complex combinations like 'Ctrl+Shift+a'
    if (keyCombo.includes('+')) {
      const parts = keyCombo.split('+');
      const key = parts.pop()!;
      const modifiers = parts.join('+');
      return [{ key, modifier: modifiers }];
    }
    
    // Handle sequence combinations like 'g g'
    if (keyCombo.includes(' ')) {
      return keyCombo.split(' ').map(k => ({ key: k }));
    }
    
    return [{ key: keyCombo }];
  });
};

// Key press detection hook
const useKeyPress = (targetKeys: string[], callback: () => void, enabled = true) => {
  const pressedKeys = useRef<Set<string>>(new Set());
  const sequenceKeys = useRef<string[]>([]);
  const sequenceTimer = useRef<NodeJS.Timeout>();

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Ignore if typing in input fields
    if (event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement) {
      return;
    }

    const key = event.key;
    const modifiers = [];
    
    if (event.ctrlKey) modifiers.push('Ctrl');
    if (event.metaKey) modifiers.push('Meta');
    if (event.shiftKey) modifiers.push('Shift');
    if (event.altKey) modifiers.push('Alt');
    
    const keyCombo = modifiers.length > 0 ? `${modifiers.join('+')}+${key}` : key;
    pressedKeys.current.add(key);

    // Check for direct match
    if (targetKeys.includes(keyCombo)) {
      event.preventDefault();
      callback();
      return;
    }

    // Handle sequences
    for (const targetKey of targetKeys) {
      if (targetKey.includes(' ')) {
        const sequence = targetKey.split(' ');
        sequenceKeys.current.push(key);
        
        // Clear sequence after timeout
        clearTimeout(sequenceTimer.current);
        sequenceTimer.current = setTimeout(() => {
          sequenceKeys.current = [];
        }, 1000);
        
        // Check if sequence matches
        if (sequenceKeys.current.join(' ') === targetKey) {
          event.preventDefault();
          callback();
          sequenceKeys.current = [];
          return;
        }
      }
    }
  }, [targetKeys, callback, enabled]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    pressedKeys.current.delete(event.key);
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      clearTimeout(sequenceTimer.current);
    };
  }, [handleKeyDown, handleKeyUp]);
};

export function KeyboardShortcuts({
  shortcuts = defaultShortcuts,
  onShortcutTriggered,
  className,
  showHelpOnMount = false,
  enableGlobalShortcuts = true,
  customShortcuts = {},
}: KeyboardShortcutsProps) {
  const [showHelp, setShowHelp] = useState(showHelpOnMount);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [enabledShortcuts, setEnabledShortcuts] = useLocalStorage<Record<string, boolean>>('keyboard-shortcuts-enabled', {});

  // Merge custom shortcuts with defaults
  const allShortcuts = useMemo(() => {
    const merged = [...shortcuts];
    Object.values(customShortcuts).forEach(custom => {
      const existingIndex = merged.findIndex(s => s.id === custom.id);
      if (existingIndex >= 0) {
        merged[existingIndex] = custom;
      } else {
        merged.push(custom);
      }
    });
    return merged;
  }, [shortcuts, customShortcuts]);

  // Filter shortcuts based on search and category
  const filteredShortcuts = useMemo(() => {
    return allShortcuts.filter(shortcut => {
      if (enabledShortcuts[shortcut.id] === false) return false;
      
      const matchesSearch = !searchQuery || 
        shortcut.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shortcut.keys.some(key => key.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'all' || shortcut.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [allShortcuts, searchQuery, selectedCategory, enabledShortcuts]);

  // Group shortcuts by category
  const groupedShortcuts = useMemo(() => {
    const groups: Record<string, KeyboardShortcut[]> = {};
    filteredShortcuts.forEach(shortcut => {
      if (!groups[shortcut.category]) {
        groups[shortcut.category] = [];
      }
      groups[shortcut.category].push(shortcut);
    });
    return groups;
  }, [filteredShortcuts]);

  // Register all shortcuts
  allShortcuts.forEach(shortcut => {
    const isEnabled = enabledShortcuts[shortcut.id] !== false;
    const shouldRegister = enableGlobalShortcuts || !shortcut.global;
    
    useKeyPress(
      shortcut.keys,
      () => {
        if (shortcut.disabled) return;
        
        trackUserAction('keyboard_shortcut_used', 'keyboard_shortcuts', {
          shortcutId: shortcut.id,
          keys: shortcut.keys,
        });
        
        if (shortcut.id === 'show-help') {
          setShowHelp(true);
        } else if (shortcut.id === 'close-modal') {
          setShowHelp(false);
        } else {
          shortcut.action();
          onShortcutTriggered?.(shortcut.id);
        }
      },
      isEnabled && shouldRegister
    );
  });

  const toggleShortcut = (shortcutId: string) => {
    setEnabledShortcuts(prev => ({
      ...prev,
      [shortcutId]: prev[shortcutId] === false,
    }));
  };

  const KeyBadge = ({ keyCombo }: { keyCombo: { key: string; modifier?: string } }) => (
    <div className="flex items-center space-x-1">
      {keyCombo.modifier && (
        <Badge variant="outline" className="text-xs font-mono bg-muted">
          {keyCombo.modifier.replace('Meta', '⌘').replace('Ctrl', '⌃').replace('Shift', '⇧').replace('Alt', '⌥')}
        </Badge>
      )}
      <Badge variant="outline" className="text-xs font-mono bg-muted">
        {keyCombo.key === ' ' ? 'Space' : keyCombo.key}
      </Badge>
    </div>
  );

  return (
    <>
      {/* Floating help trigger */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                'fixed bottom-4 right-4 z-50 bg-background/80 backdrop-blur-sm border shadow-lg',
                className
              )}
              onClick={() => setShowHelp(true)}
            >
              <Keyboard className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Keyboard shortcuts (Press ? for help)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Help dialog */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Keyboard className="h-5 w-5" />
              <span>Keyboard Shortcuts</span>
              <Badge variant="secondary" className="text-xs">
                {filteredShortcuts.length} shortcuts
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Use these keyboard shortcuts to navigate and manage reviews more efficiently.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search and filters */}
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search shortcuts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background text-foreground"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category tabs */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
                className="text-xs"
              >
                All ({allShortcuts.length})
              </Button>
              {categories.map(category => {
                const Icon = category.icon;
                const count = allShortcuts.filter(s => s.category === category.id).length;
                return (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category.id)}
                    className="text-xs"
                    style={{
                      borderColor: selectedCategory === category.id ? category.color : undefined,
                    }}
                  >
                    <Icon className="h-3 w-3 mr-1" />
                    {category.name} ({count})
                  </Button>
                );
              })}
            </div>

            {/* Shortcuts list */}
            <div className="max-h-[60vh] overflow-y-auto space-y-4">
              {Object.entries(groupedShortcuts).map(([categoryId, categoryShortcuts]) => {
                const category = categories.find(c => c.id === categoryId);
                if (!category) return null;

                const Icon = category.icon;
                
                return (
                  <motion.div
                    key={categoryId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center space-x-2">
                      <Icon className="h-4 w-4" style={{ color: category.color }} />
                      <h3 className="font-semibold text-sm">{category.name}</h3>
                      <div 
                        className="h-px flex-1" 
                        style={{ backgroundColor: `${category.color}30` }}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      {categoryShortcuts.map(shortcut => {
                        const isEnabled = enabledShortcuts[shortcut.id] !== false;
                        const ShortcutIcon = shortcut.icon;
                        
                        return (
                          <motion.div
                            key={shortcut.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={cn(
                              'flex items-center justify-between p-3 rounded-lg border transition-all duration-200',
                              isEnabled 
                                ? 'bg-background hover:bg-accent/50' 
                                : 'bg-muted/50 opacity-60',
                              shortcut.disabled && 'opacity-40'
                            )}
                          >
                            <div className="flex items-center space-x-3 flex-1">
                              {ShortcutIcon && (
                                <ShortcutIcon className="h-4 w-4 text-muted-foreground" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">
                                  {shortcut.description}
                                </p>
                                {shortcut.global && (
                                  <Badge variant="secondary" className="text-xs mt-1">
                                    Global
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-3">
                              <div className="flex flex-wrap gap-1">
                                {shortcut.keys.map((key, index) => (
                                  <div key={index} className="flex items-center space-x-1">
                                    {index > 0 && (
                                      <span className="text-xs text-muted-foreground">or</span>
                                    )}
                                    <div className="flex items-center space-x-1">
                                      {formatKeyCombo([key]).map((combo, comboIndex) => (
                                        <KeyBadge key={comboIndex} keyCombo={combo} />
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleShortcut(shortcut.id)}
                                className="text-xs"
                              >
                                {isEnabled ? 'Disable' : 'Enable'}
                              </Button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
              
              {filteredShortcuts.length === 0 && (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-semibold">No shortcuts found</p>
                  <p className="text-muted-foreground">
                    Try adjusting your search or category filter.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <Separator />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Press Esc to close this dialog</span>
              <span>{filteredShortcuts.filter(s => enabledShortcuts[s.id] !== false).length} enabled shortcuts</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Hook for components to register custom shortcuts
export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[]) => {
  const [registeredShortcuts, setRegisteredShortcuts] = useState<KeyboardShortcut[]>([]);

  useEffect(() => {
    setRegisteredShortcuts(shortcuts);
    return () => setRegisteredShortcuts([]);
  }, [shortcuts]);

  return registeredShortcuts;
};

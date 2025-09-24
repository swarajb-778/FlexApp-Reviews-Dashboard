'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Home,
  MessageSquare,
  Building2,
  BarChart3,
  Settings,
  Users,
  Calendar,
  FileText,
  Zap,
  Shield,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Star,
  TrendingUp,
  Filter,
  Download,
  Bell,
  Activity,
  Globe,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLocalStorage } from '@/lib/hooks';
import { trackUserAction } from '@/lib/analytics';

interface SidebarItem {
  id: string;
  title: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  children?: SidebarItem[];
  permission?: string;
  isNew?: boolean;
  comingSoon?: boolean;
}

const sidebarItems: SidebarItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    href: '/',
    icon: Home,
  },
  {
    id: 'reviews',
    title: 'Review Management',
    icon: MessageSquare,
    badge: 12, // Pending reviews count
    children: [
      {
        id: 'reviews-manager',
        title: 'Review Manager',
        href: '/manager',
        icon: MessageSquare,
        badge: 12,
      },
      {
        id: 'reviews-pending',
        title: 'Pending Reviews',
        href: '/manager?status=pending',
        icon: Clock,
        badge: 8,
      },
      {
        id: 'reviews-approved',
        title: 'Approved Reviews',
        href: '/manager?status=approved',
        icon: Star,
      },
      {
        id: 'reviews-rejected',
        title: 'Rejected Reviews',
        href: '/manager?status=rejected',
        icon: XCircle,
      },
    ],
  },
  {
    id: 'properties',
    title: 'Properties',
    icon: Building2,
    children: [
      {
        id: 'properties-list',
        title: 'All Properties',
        href: '/properties',
        icon: Building2,
      },
      {
        id: 'properties-performance',
        title: 'Performance',
        href: '/properties/performance',
        icon: TrendingUp,
      },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics & Reports',
    icon: BarChart3,
    children: [
      {
        id: 'analytics-overview',
        title: 'Overview',
        href: '/analytics',
        icon: BarChart3,
      },
      {
        id: 'analytics-trends',
        title: 'Trends',
        href: '/analytics/trends',
        icon: TrendingUp,
      },
      {
        id: 'analytics-exports',
        title: 'Data Exports',
        href: '/analytics/exports',
        icon: Download,
      },
    ],
  },
  {
    id: 'automation',
    title: 'Automation',
    icon: Zap,
    isNew: true,
    children: [
      {
        id: 'automation-rules',
        title: 'Approval Rules',
        href: '/automation/rules',
        icon: Filter,
        isNew: true,
      },
      {
        id: 'automation-workflows',
        title: 'Workflows',
        href: '/automation/workflows',
        icon: Activity,
        comingSoon: true,
      },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    icon: Globe,
    children: [
      {
        id: 'integrations-channels',
        title: 'Booking Channels',
        href: '/integrations/channels',
        icon: Globe,
      },
      {
        id: 'integrations-apis',
        title: 'API Settings',
        href: '/integrations/apis',
        icon: Code2,
      },
    ],
  },
];

const bottomItems: SidebarItem[] = [
  {
    id: 'notifications',
    title: 'Notifications',
    href: '/notifications',
    icon: Bell,
    badge: 3,
  },
  {
    id: 'settings',
    title: 'Settings',
    href: '/settings',
    icon: Settings,
  },
  {
    id: 'help',
    title: 'Help & Support',
    href: '/help',
    icon: HelpCircle,
  },
];

export function FlexLivingSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useLocalStorage('sidebar-collapsed', false);
  const [expandedItems, setExpandedItems] = useLocalStorage<string[]>('sidebar-expanded', ['reviews']);

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
    trackUserAction('sidebar_toggled', 'navigation', { collapsed: !isCollapsed });
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const isItemActive = (item: SidebarItem): boolean => {
    if (item.href) {
      if (item.href === '/') {
        return pathname === '/';
      }
      return pathname.startsWith(item.href);
    }
    return false;
  };

  const hasActiveChild = (item: SidebarItem): boolean => {
    if (!item.children) return false;
    return item.children.some(child => isItemActive(child));
  };

  const SidebarItemComponent = ({ 
    item, 
    level = 0 
  }: { 
    item: SidebarItem; 
    level?: number;
  }) => {
    const hasChildren = item.children && item.children.length > 0;
    const isActive = isItemActive(item);
    const isExpanded = expandedItems.includes(item.id);
    const hasActiveChild = item.children?.some(child => isItemActive(child));
    const Icon = item.icon;

    const content = (
      <div className={cn(
        'flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200',
        'hover:bg-accent/50 group cursor-pointer',
        level > 0 && 'ml-6 pl-2',
        (isActive || hasActiveChild) && 'bg-primary/10 text-primary hover:bg-primary/15',
        item.comingSoon && 'opacity-60 cursor-not-allowed'
      )}>
        <Icon className={cn(
          'h-4 w-4 shrink-0 transition-colors',
          (isActive || hasActiveChild) ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
        )} />
        
        {!isCollapsed && (
          <>
            <span className={cn(
              'flex-1 truncate text-sm font-medium transition-colors',
              (isActive || hasActiveChild) ? 'text-primary' : 'text-foreground'
            )}>
              {item.title}
            </span>
            
            <div className="flex items-center space-x-1">
              {item.badge && (
                <Badge 
                  variant={isActive ? 'default' : 'secondary'} 
                  className="h-5 px-2 text-xs"
                >
                  {item.badge}
                </Badge>
              )}
              
              {item.isNew && (
                <Badge variant="default" className="h-5 px-2 text-xs bg-gradient-to-r from-green-500 to-emerald-500">
                  New
                </Badge>
              )}
              
              {item.comingSoon && (
                <Badge variant="outline" className="h-5 px-2 text-xs">
                  Soon
                </Badge>
              )}
              
              {hasChildren && (
                <div className="ml-auto">
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );

    if (item.comingSoon) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>{content}</div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Coming Soon</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    if (hasChildren) {
      return (
        <Collapsible 
          open={isExpanded} 
          onOpenChange={() => toggleExpanded(item.id)}
        >
          <CollapsibleTrigger asChild>
            <div>{content}</div>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-1 space-y-1">
            <AnimatePresence>
              {item.children?.map((child) => (
                <motion.div
                  key={child.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <SidebarItemComponent item={child} level={level + 1} />
                </motion.div>
              ))}
            </AnimatePresence>
          </CollapsibleContent>
        </Collapsible>
      );
    }

    if (item.href) {
      return (
        <Link href={item.href} onClick={() => trackUserAction('sidebar_navigate', 'navigation', { path: item.href })}>
          {content}
        </Link>
      );
    }

    return content;
  };

  return (
    <motion.aside 
      initial={{ width: isCollapsed ? 64 : 256 }}
      animate={{ width: isCollapsed ? 64 : 256 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={cn(
        'sticky top-0 h-screen bg-background/95 backdrop-blur border-r border-border/50',
        'flex flex-col overflow-hidden',
        'support-[backdrop-filter]:bg-background/90'
      )}
    >
      {/* Sidebar Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white font-bold text-sm">
              FL
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              FlexLiving
            </span>
          </div>
        )}
        
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          className="h-8 w-8"
        >
          <motion.div
            animate={{ rotate: isCollapsed ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronRight className="h-4 w-4" />
          </motion.div>
        </Button>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
        {sidebarItems.map((item) => (
          <SidebarItemComponent key={item.id} item={item} />
        ))}
      </div>

      {/* User Section */}
      {!isCollapsed && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 border-t bg-muted/20"
        >
          <div className="flex items-center space-x-3 p-2 rounded-lg bg-background border">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">FlexLiving Team</p>
              <p className="text-xs text-muted-foreground truncate">Manager Dashboard</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Bottom Navigation */}
      <div className="p-4 space-y-1 border-t">
        {bottomItems.map((item) => (
          <SidebarItemComponent key={item.id} item={item} />
        ))}
      </div>

      {/* Collapse Button for Mobile */}
      {isCollapsed && (
        <div className="p-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleCollapsed}
                  className="w-full"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Expand Sidebar</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </motion.aside>
  );
}

export default FlexLivingSidebar;

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Home,
  MessageSquare,
  Building2,
  BarChart3,
  Settings,
  ChevronDown,
  ArrowLeft,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  Calendar,
  User,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { trackUserAction } from '@/lib/analytics';

interface BreadcrumbConfig {
  path: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string;
  description?: string;
  children?: BreadcrumbConfig[];
}

const breadcrumbConfig: BreadcrumbConfig[] = [
  {
    path: '/',
    label: 'Dashboard',
    icon: Home,
    description: 'Overview of your review management dashboard',
  },
  {
    path: '/manager',
    label: 'Review Manager',
    icon: MessageSquare,
    description: 'Manage and approve guest reviews',
    children: [
      {
        path: '/manager?status=pending',
        label: 'Pending Reviews',
        icon: Clock,
        badge: 'Pending',
      },
      {
        path: '/manager?status=approved',
        label: 'Approved Reviews',
        icon: CheckCircle,
        badge: 'Approved',
      },
      {
        path: '/manager?status=rejected',
        label: 'Rejected Reviews',
        icon: XCircle,
        badge: 'Rejected',
      },
    ],
  },
  {
    path: '/properties',
    label: 'Properties',
    icon: Building2,
    description: 'Manage your property listings',
    children: [
      {
        path: '/properties/performance',
        label: 'Performance',
        icon: BarChart3,
      },
    ],
  },
  {
    path: '/property',
    label: 'Property Details',
    icon: Building2,
    description: 'Detailed view of property information and reviews',
  },
  {
    path: '/analytics',
    label: 'Analytics',
    icon: BarChart3,
    description: 'Review analytics and insights',
    children: [
      {
        path: '/analytics/trends',
        label: 'Trends',
        icon: BarChart3,
      },
      {
        path: '/analytics/exports',
        label: 'Data Exports',
        icon: Filter,
      },
    ],
  },
  {
    path: '/automation',
    label: 'Automation',
    icon: Filter,
    badge: 'New',
    description: 'Automated review approval rules and workflows',
    children: [
      {
        path: '/automation/rules',
        label: 'Approval Rules',
        icon: Filter,
      },
      {
        path: '/automation/workflows',
        label: 'Workflows',
        icon: Calendar,
      },
    ],
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: Settings,
    description: 'Application settings and preferences',
  },
];

export function BreadcrumbNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const breadcrumbs = useMemo(() => {
    const pathSegments = pathname.split('/').filter(Boolean);
    const crumbs = [];

    // Always start with home
    if (pathname !== '/') {
      crumbs.push({
        path: '/',
        label: 'Home',
        icon: Home,
        isHome: true,
      });
    }

    // Build breadcrumb trail
    let currentPath = '';
    for (const segment of pathSegments) {
      currentPath += `/${segment}`;
      
      // Find matching config
      let config = breadcrumbConfig.find(c => c.path === currentPath);
      
      // Handle dynamic routes like /property/[slug]
      if (!config && currentPath.includes('/property/')) {
        config = breadcrumbConfig.find(c => c.path === '/property');
        if (config) {
          // For property details, show the property name if available
          const propertySlug = segment;
          crumbs.push({
            ...config,
            path: currentPath,
            label: `Property: ${propertySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
            isDynamic: true,
          });
          continue;
        }
      }
      
      if (config) {
        crumbs.push({
          ...config,
          path: currentPath,
        });
      } else {
        // Fallback for unknown routes
        crumbs.push({
          path: currentPath,
          label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '),
          isUnknown: true,
        });
      }
    }

    // Handle query parameters for filters
    if (pathname === '/manager' && searchParams.get('status')) {
      const status = searchParams.get('status');
      const statusLabels: Record<string, { label: string; icon: any; color: string }> = {
        pending: { label: 'Pending Reviews', icon: Clock, color: 'text-yellow-600' },
        approved: { label: 'Approved Reviews', icon: CheckCircle, color: 'text-green-600' },
        rejected: { label: 'Rejected Reviews', icon: XCircle, color: 'text-red-600' },
      };
      
      if (status && statusLabels[status]) {
        crumbs.push({
          path: `${pathname}?status=${status}`,
          label: statusLabels[status].label,
          icon: statusLabels[status].icon,
          badge: status,
          color: statusLabels[status].color,
          isFilter: true,
        });
      }
    }

    return crumbs;
  }, [pathname, searchParams]);

  const currentPage = breadcrumbs[breadcrumbs.length - 1];
  const parentPages = breadcrumbs.slice(0, -1);

  const handleBreadcrumbClick = (path: string, label: string) => {
    trackUserAction('breadcrumb_navigate', 'navigation', { 
      path, 
      label,
      from_path: pathname 
    });
  };

  const handleBackClick = () => {
    trackUserAction('back_button_clicked', 'navigation', { from_path: pathname });
    window.history.back();
  };

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <div className="sticky top-16 z-30 bg-background/95 backdrop-blur border-b border-border/50 px-4 lg:px-6">
      <div className="flex items-center justify-between py-3">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center space-x-4 min-w-0 flex-1">
          {/* Back Button */}
          {breadcrumbs.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackClick}
              className="shrink-0 px-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}

          {/* Breadcrumb Trail */}
          <Breadcrumb>
            <BreadcrumbList>
              {parentPages.map((crumb, index) => {
                const Icon = crumb.icon;
                
                return (
                  <motion.div
                    key={crumb.path}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center"
                  >
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link
                          href={crumb.path}
                          onClick={() => handleBreadcrumbClick(crumb.path, crumb.label)}
                          className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {Icon && <Icon className="h-3 w-3" />}
                          <span className="text-sm font-medium">
                            {crumb.isHome ? 'Home' : crumb.label}
                          </span>
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                  </motion.div>
                );
              })}
              
              {/* Current Page */}
              <BreadcrumbItem>
                <BreadcrumbPage className="flex items-center space-x-2">
                  {currentPage?.icon && (
                    <currentPage.icon className={cn(
                      'h-4 w-4',
                      currentPage.color || 'text-foreground'
                    )} />
                  )}
                  <span className="text-sm font-semibold text-foreground">
                    {currentPage?.label}
                  </span>
                  {currentPage?.badge && (
                    <Badge 
                      variant={currentPage.isFilter ? 'default' : 'secondary'} 
                      className="text-xs ml-2"
                    >
                      {currentPage.badge}
                    </Badge>
                  )}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Page Actions */}
        <div className="flex items-center space-x-2">
          {/* Quick Actions Dropdown */}
          {currentPage && !currentPage.isHome && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <span className="text-xs">Actions</span>
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {pathname.includes('manager') && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/manager?status=pending">
                        <Clock className="h-4 w-4 mr-2" />
                        View Pending
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/manager">
                        <Filter className="h-4 w-4 mr-2" />
                        Clear Filters
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                
                {pathname.includes('property') && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/properties">
                        <Building2 className="h-4 w-4 mr-2" />
                        All Properties
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/analytics">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        View Analytics
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                
                {pathname.includes('analytics') && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/analytics/exports">
                        <Filter className="h-4 w-4 mr-2" />
                        Export Data
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Page Description */}
          {currentPage?.description && !currentPage.isFilter && (
            <div className="hidden lg:block text-xs text-muted-foreground max-w-xs truncate">
              {currentPage.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

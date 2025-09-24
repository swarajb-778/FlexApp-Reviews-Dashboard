'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Sparkles,
  Menu,
  Home,
  BarChart3,
  Building,
  Settings,
  MessageSquare,
  Star,
  TrendingUp,
  Bell,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  description?: string;
}

const navigation: NavItem[] = [
  {
    label: 'Home',
    href: '/',
    icon: Home,
    description: 'Welcome page and overview',
  },
  {
    label: 'Manager Dashboard',
    href: '/manager',
    icon: BarChart3,
    description: 'Manage and approve reviews',
  },
  {
    label: 'Property Demo',
    href: '/property/demo-property',
    icon: Building,
    description: 'View property page example',
  },
];

const stats = [
  { label: 'Total Reviews', value: '2,847', icon: MessageSquare, color: 'text-blue-600' },
  { label: 'Avg Rating', value: '4.8', icon: Star, color: 'text-yellow-600' },
  { label: 'Growth', value: '+12%', icon: TrendingUp, color: 'text-green-600' },
];

export function Header() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <motion.div
              whileHover={{ rotate: 180 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center"
            >
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </motion.div>
            <span className="text-xl font-bold gradient-text">FlexApp</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      'flex items-center space-x-2 transition-all duration-200',
                      isActive && 'bg-primary text-primary-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    {item.badge && (
                      <Badge variant="secondary" size="sm">
                        {item.badge}
                      </Badge>
                    )}
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* Desktop Stats */}
          <div className="hidden lg:flex items-center space-x-4">
            {stats.map((stat) => (
              <motion.div
                key={stat.label}
                whileHover={{ y: -2 }}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <div className="text-sm">
                  <div className="font-medium">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            {/* Notifications (placeholder) */}
            <Button variant="ghost" size="icon" className="relative hidden md:flex">
              <Bell className="h-4 w-4" />
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 text-xs p-0 flex items-center justify-center"
              >
                3
              </Badge>
            </Button>

            {/* User menu (placeholder) */}
            <Button variant="ghost" size="icon" className="hidden md:flex">
              <User className="h-4 w-4" />
            </Button>

            {/* Theme toggle */}
            <ThemeToggle />

            {/* Mobile menu */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <SheetHeader>
                  <SheetTitle className="flex items-center space-x-2">
                    <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <span>FlexApp</span>
                  </SheetTitle>
                  <SheetDescription>
                    Reviews management dashboard
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Navigation */}
                  <div>
                    <h4 className="font-medium mb-3">Navigation</h4>
                    <nav className="space-y-1">
                      {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <div
                              className={cn(
                                'flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors',
                                isActive
                                  ? 'bg-primary text-primary-foreground'
                                  : 'hover:bg-muted'
                              )}
                            >
                              <item.icon className="h-5 w-5" />
                              <div className="flex-1">
                                <div className="font-medium">{item.label}</div>
                                {item.description && (
                                  <div className="text-xs opacity-70">
                                    {item.description}
                                  </div>
                                )}
                              </div>
                              {item.badge && (
                                <Badge variant="secondary" size="sm">
                                  {item.badge}
                                </Badge>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </nav>
                  </div>

                  {/* Stats */}
                  <div>
                    <h4 className="font-medium mb-3">Quick Stats</h4>
                    <div className="space-y-2">
                      {stats.map((stat) => (
                        <div
                          key={stat.label}
                          className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-muted/50"
                        >
                          <stat.icon className={`h-5 w-5 ${stat.color}`} />
                          <div className="flex-1">
                            <div className="font-medium">{stat.value}</div>
                            <div className="text-sm text-muted-foreground">
                              {stat.label}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div>
                    <h4 className="font-medium mb-3">Actions</h4>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full justify-start" size="sm">
                        <Bell className="h-4 w-4 mr-2" />
                        Notifications
                        <Badge variant="destructive" className="ml-auto" size="sm">
                          3
                        </Badge>
                      </Button>
                      <Button variant="outline" className="w-full justify-start" size="sm">
                        <User className="h-4 w-4 mr-2" />
                        Profile
                      </Button>
                      <Button variant="outline" className="w-full justify-start" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </Button>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

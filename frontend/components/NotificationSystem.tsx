'use client';

/**
 * Real-time Notification System
 * Provides comprehensive notification management with WebSocket integration,
 * persistent notifications, sound alerts, and user preferences
 */

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Bell,
  BellOff,
  CheckCircle,
  XCircle,
  Clock,
  Star,
  MessageSquare,
  AlertCircle,
  Info,
  Trash2,
  MoreHorizontal,
  Settings,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Filter,
  Calendar,
  User,
  Building,
  Zap,
  WifiOff,
  Wifi,
} from 'lucide-react';
import { Review } from '@/lib/types';
import { WebSocketManager, createWebSocketManager } from '@/lib/optimistic-updates';
import { trackUserAction } from '@/lib/analytics';
import { formatRelativeTime, cn } from '@/lib/utils';
import { toast } from '@/lib/use-toast';
import { useQueryClient } from '@tanstack/react-query';

// Types
export interface Notification {
  id: string;
  type: 'review_approved' | 'review_rejected' | 'review_updated' | 'bulk_action_completed' | 'system_alert' | 'user_action';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  data?: any;
  actions?: NotificationAction[];
  persistent?: boolean;
  soundEnabled?: boolean;
}

export interface NotificationAction {
  id: string;
  label: string;
  action: () => void;
  variant?: 'default' | 'destructive';
}

export interface NotificationPreferences {
  enabled: boolean;
  soundEnabled: boolean;
  desktopNotifications: boolean;
  emailNotifications: boolean;
  categories: {
    approvals: boolean;
    updates: boolean;
    system: boolean;
    collaboration: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  autoMarkAsRead: boolean;
  maxNotifications: number;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  isConnected: boolean;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  updatePreferences: (preferences: Partial<NotificationPreferences>) => void;
}

// Default preferences
const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  soundEnabled: true,
  desktopNotifications: true,
  emailNotifications: false,
  categories: {
    approvals: true,
    updates: true,
    system: true,
    collaboration: true,
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00',
  },
  autoMarkAsRead: false,
  maxNotifications: 50,
};

// Context
const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

// Sound manager
class NotificationSoundManager {
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private enabled = true;

  constructor() {
    if (typeof window !== 'undefined' && window.AudioContext) {
      this.audioContext = new AudioContext();
      this.loadSounds();
    }
  }

  private async loadSounds() {
    if (!this.audioContext) return;

    // Generate notification sounds using Web Audio API
    const sounds = {
      default: this.createTone(800, 0.1, 0.3),
      success: this.createTone(600, 0.1, 0.2),
      error: this.createTone(400, 0.2, 0.4),
      urgent: this.createChord([800, 1000, 1200], 0.3, 0.5),
    };

    for (const [name, audioBuffer] of Object.entries(sounds)) {
      this.sounds.set(name, await audioBuffer);
    }
  }

  private async createTone(frequency: number, duration: number, volume: number): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('AudioContext not available');

    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      data[i] = Math.sin(2 * Math.PI * frequency * t) * volume * Math.exp(-t * 3);
    }

    return buffer;
  }

  private async createChord(frequencies: number[], duration: number, volume: number): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('AudioContext not available');

    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      let sample = 0;
      
      frequencies.forEach(freq => {
        sample += Math.sin(2 * Math.PI * freq * t) * volume / frequencies.length;
      });
      
      data[i] = sample * Math.exp(-t * 2);
    }

    return buffer;
  }

  async playSound(type: string = 'default') {
    if (!this.enabled || !this.audioContext || !this.sounds.has(type)) return;

    try {
      const buffer = this.sounds.get(type)!;
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start();
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
}

// Provider component
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();
  const wsManager = useRef<WebSocketManager | null>(null);
  const soundManager = useRef<NotificationSoundManager | null>(null);

  // Initialize WebSocket and sound manager
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initialize sound manager
    soundManager.current = new NotificationSoundManager();

    // Initialize WebSocket manager
    wsManager.current = createWebSocketManager(queryClient);

    // Load preferences from localStorage
    const savedPreferences = localStorage.getItem('flexapp_notification_preferences');
    if (savedPreferences) {
      try {
        setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(savedPreferences) });
      } catch (error) {
        console.warn('Failed to load notification preferences:', error);
      }
    }

    // Load saved notifications
    const savedNotifications = localStorage.getItem('flexapp_notifications');
    if (savedNotifications) {
      try {
        setNotifications(JSON.parse(savedNotifications));
      } catch (error) {
        console.warn('Failed to load saved notifications:', error);
      }
    }

    // Connect to WebSocket
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    wsManager.current.connect(wsUrl);

    // Set up WebSocket event handlers
    wsManager.current.subscribe('review_approved', (data) => {
      addNotification({
        type: 'review_approved',
        title: 'Review Approved',
        message: `Review by ${data.guest_name} has been approved`,
        priority: 'normal',
        read: false,
        data,
      });
    });

    wsManager.current.subscribe('review_rejected', (data) => {
      addNotification({
        type: 'review_rejected',
        title: 'Review Rejected',
        message: `Review by ${data.guest_name} has been rejected`,
        priority: 'normal',
        read: false,
        data,
      });
    });

    wsManager.current.subscribe('bulk_action_completed', (data) => {
      addNotification({
        type: 'bulk_action_completed',
        title: 'Bulk Action Complete',
        message: `${data.updated} reviews have been processed`,
        priority: 'high',
        read: false,
        data,
      });
    });

    // Check connection status
    const checkConnection = () => {
      setIsConnected(wsManager.current?.ws?.readyState === WebSocket.OPEN);
    };
    
    const connectionInterval = setInterval(checkConnection, 5000);

    return () => {
      wsManager.current?.disconnect();
      clearInterval(connectionInterval);
    };
  }, [queryClient]);

  // Save notifications to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('flexapp_notifications', JSON.stringify(notifications.slice(0, preferences.maxNotifications)));
    }
  }, [notifications, preferences.maxNotifications]);

  // Save preferences to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('flexapp_notification_preferences', JSON.stringify(preferences));
    }
  }, [preferences]);

  // Check if in quiet hours
  const isInQuietHours = useCallback(() => {
    if (!preferences.quietHours.enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const startTime = parseInt(preferences.quietHours.start.split(':')[0]) * 60 + parseInt(preferences.quietHours.start.split(':')[1]);
    const endTime = parseInt(preferences.quietHours.end.split(':')[0]) * 60 + parseInt(preferences.quietHours.end.split(':')[1]);

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      return currentTime >= startTime || currentTime <= endTime;
    }
  }, [preferences.quietHours]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    if (!preferences.enabled) return;

    // Check category preferences
    const categoryMap = {
      'review_approved': 'approvals',
      'review_rejected': 'approvals',
      'review_updated': 'updates',
      'bulk_action_completed': 'updates',
      'system_alert': 'system',
      'user_action': 'collaboration',
    };

    const category = categoryMap[notification.type as keyof typeof categoryMap] as keyof typeof preferences.categories;
    if (category && !preferences.categories[category]) return;

    // Don't show notifications during quiet hours unless urgent
    if (isInQuietHours() && notification.priority !== 'urgent') return;

    const newNotification: Notification = {
      ...notification,
      id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev.slice(0, preferences.maxNotifications - 1)];
      return updated;
    });

    // Play sound if enabled
    if (preferences.soundEnabled && notification.soundEnabled !== false && soundManager.current) {
      const soundType = {
        'urgent': 'urgent',
        'high': 'error',
        'normal': 'default',
        'low': 'success',
      }[notification.priority] || 'default';
      
      soundManager.current.playSound(soundType);
    }

    // Show desktop notification if enabled and supported
    if (preferences.desktopNotifications && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: newNotification.id,
      });
    }

    // Track notification
    trackUserAction('notification_received', 'notification_system', {
      type: notification.type,
      priority: notification.priority,
    });
  }, [preferences, isInQuietHours]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true }
          : notification
      )
    );

    trackUserAction('notification_read', 'notification_system', { notificationId });
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );

    trackUserAction('notifications_mark_all_read', 'notification_system', {
      count: notifications.filter(n => !n.read).length,
    });
  }, [notifications]);

  const removeNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    trackUserAction('notification_dismissed', 'notification_system', { notificationId });
  }, []);

  const clearAllNotifications = useCallback(() => {
    const count = notifications.length;
    setNotifications([]);
    trackUserAction('notifications_cleared', 'notification_system', { count });
    
    toast({
      title: 'Notifications Cleared',
      description: `${count} notifications removed`,
    });
  }, [notifications.length]);

  const updatePreferences = useCallback((newPreferences: Partial<NotificationPreferences>) => {
    setPreferences(prev => ({ ...prev, ...newPreferences }));
    
    // Update sound manager
    if (newPreferences.soundEnabled !== undefined && soundManager.current) {
      soundManager.current.setEnabled(newPreferences.soundEnabled);
    }
    
    trackUserAction('notification_preferences_updated', 'settings', newPreferences);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const contextValue: NotificationContextType = {
    notifications,
    unreadCount,
    preferences,
    isConnected,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
    updatePreferences,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

// Notification icon/trigger component
export function NotificationTrigger() {
  const { unreadCount, isConnected, preferences } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      trackUserAction('notification_panel_opened', 'notification_trigger');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                {preferences.enabled ? (
                  <Bell className={cn('h-5 w-5', !isConnected && 'text-muted-foreground')} />
                ) : (
                  <BellOff className="h-5 w-5 text-muted-foreground" />
                )}
                
                {unreadCount > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1"
                  >
                    <Badge 
                      variant="destructive" 
                      className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>
                  </motion.div>
                )}

                {!isConnected && (
                  <div className="absolute -bottom-1 -right-1">
                    <div className="h-2 w-2 bg-red-500 rounded-full" />
                  </div>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                <p>Notifications</p>
                {unreadCount > 0 && (
                  <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
                )}
                {!isConnected && (
                  <p className="text-xs text-red-500">Disconnected</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SheetTrigger>
      <SheetContent className="w-full sm:w-96">
        <NotificationPanel />
      </SheetContent>
    </Sheet>
  );
}

// Main notification panel
export function NotificationPanel() {
  const {
    notifications,
    unreadCount,
    preferences,
    isConnected,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
  } = useNotifications();

  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent'>('all');
  const [showSettings, setShowSettings] = useState(false);

  const filteredNotifications = notifications.filter(notification => {
    switch (filter) {
      case 'unread':
        return !notification.read;
      case 'urgent':
        return notification.priority === 'urgent';
      default:
        return true;
    }
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // Execute notification actions if any
    if (notification.actions && notification.actions.length > 0) {
      notification.actions[0].action();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <SheetHeader>
        <div className="flex items-center justify-between">
          <SheetTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Notifications</span>
            <div className="flex items-center space-x-1">
              {isConnected ? (
                <Wifi className="h-3 w-3 text-green-500" />
              ) : (
                <WifiOff className="h-3 w-3 text-red-500" />
              )}
            </div>
          </SheetTitle>
          
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              className="h-8 w-8"
            >
              <Settings className="h-4 w-4" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={markAllAsRead} disabled={unreadCount === 0}>
                  <Eye className="h-4 w-4 mr-2" />
                  Mark all as read
                </DropdownMenuItem>
                <DropdownMenuItem onClick={clearAllNotifications} disabled={notifications.length === 0}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear all
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        <SheetDescription className="flex items-center justify-between">
          <span>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </span>
          <div className="flex space-x-1">
            {(['all', 'unread', 'urgent'] as const).map((filterOption) => (
              <Button
                key={filterOption}
                variant={filter === filterOption ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilter(filterOption)}
                className="h-6 text-xs capitalize px-2"
              >
                {filterOption}
              </Button>
            ))}
          </div>
        </SheetDescription>
      </SheetHeader>

      {showSettings && <NotificationSettings />}

      <Separator className="my-4" />

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-2">
            <AnimatePresence>
              {filteredNotifications.length > 0 ? (
                filteredNotifications.map((notification, index) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    index={index}
                    onClick={() => handleNotificationClick(notification)}
                    onRemove={() => removeNotification(notification.id)}
                  />
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8 text-muted-foreground"
                >
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No notifications</p>
                  {filter !== 'all' && (
                    <p className="text-sm mt-1">Try changing the filter</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// Individual notification item
interface NotificationItemProps {
  notification: Notification;
  index: number;
  onClick: () => void;
  onRemove: () => void;
}

function NotificationItem({ notification, index, onClick, onRemove }: NotificationItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getIcon = () => {
    switch (notification.type) {
      case 'review_approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'review_rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'review_updated':
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'bulk_action_completed':
        return <Zap className="h-4 w-4 text-purple-500" />;
      case 'system_alert':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityStyles = () => {
    switch (notification.priority) {
      case 'urgent':
        return 'border-l-red-500 bg-red-50 dark:bg-red-900/20';
      case 'high':
        return 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/20';
      case 'normal':
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/20';
      case 'low':
        return 'border-l-gray-500 bg-gray-50 dark:bg-gray-900/20';
      default:
        return 'border-l-gray-300 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ scale: 1.02 }}
      className={cn(
        'p-3 rounded-lg border border-l-4 cursor-pointer transition-all',
        getPriorityStyles(),
        !notification.read && 'ring-1 ring-primary/20',
        'hover:shadow-md'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div className="flex items-start justify-between space-x-3">
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h4 className={cn(
                'font-medium text-sm truncate',
                !notification.read && 'text-foreground font-semibold'
              )}>
                {notification.title}
              </h4>
              {!notification.read && (
                <div className="h-2 w-2 bg-primary rounded-full flex-shrink-0" />
              )}
            </div>
            
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {notification.message}
            </p>
            
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                {formatRelativeTime(notification.timestamp)}
              </p>
              
              <div className="flex items-center space-x-1">
                <Badge variant="outline" className="text-xs px-1 py-0">
                  {notification.priority}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex-shrink-0"
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="h-6 w-6"
              >
                <XCircle className="h-3 w-3" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Notification Actions */}
      {notification.actions && notification.actions.length > 0 && (
        <div className="flex space-x-2 mt-3">
          {notification.actions.map((action) => (
            <Button
              key={action.id}
              variant={action.variant || 'outline'}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                action.action();
              }}
              className="text-xs"
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// Notification settings panel
function NotificationSettings() {
  const { preferences, updatePreferences } = useNotifications();

  const requestDesktopPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      updatePreferences({ desktopNotifications: permission === 'granted' });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-4 p-4 bg-muted/30 rounded-lg"
    >
      <h4 className="font-medium text-sm">Notification Settings</h4>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="enabled" className="text-sm">Enable notifications</Label>
          <Switch
            id="enabled"
            checked={preferences.enabled}
            onCheckedChange={(enabled) => updatePreferences({ enabled })}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="sound" className="text-sm">Sound alerts</Label>
          <Switch
            id="sound"
            checked={preferences.soundEnabled}
            onCheckedChange={(soundEnabled) => updatePreferences({ soundEnabled })}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="desktop" className="text-sm flex items-center space-x-2">
            <span>Desktop notifications</span>
            {'Notification' in window && Notification.permission === 'default' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={requestDesktopPermission}
                className="text-xs h-5 px-1"
              >
                Enable
              </Button>
            )}
          </Label>
          <Switch
            id="desktop"
            checked={preferences.desktopNotifications && ('Notification' in window && Notification.permission === 'granted')}
            onCheckedChange={(desktopNotifications) => updatePreferences({ desktopNotifications })}
            disabled={'Notification' in window && Notification.permission === 'denied'}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="autoRead" className="text-sm">Auto-mark as read</Label>
          <Switch
            id="autoRead"
            checked={preferences.autoMarkAsRead}
            onCheckedChange={(autoMarkAsRead) => updatePreferences({ autoMarkAsRead })}
          />
        </div>
      </div>
      
      <Separator />
      
      <div className="space-y-2">
        <Label className="text-sm">Categories</Label>
        <div className="space-y-2">
          {Object.entries(preferences.categories).map(([category, enabled]) => (
            <div key={category} className="flex items-center justify-between">
              <Label htmlFor={category} className="text-sm capitalize">
                {category}
              </Label>
              <Switch
                id={category}
                checked={enabled}
                onCheckedChange={(checked) => 
                  updatePreferences({
                    categories: { ...preferences.categories, [category]: checked }
                  })
                }
              />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// Hook to send custom notifications
export const useNotificationSender = () => {
  const { addNotification } = useNotifications();

  const sendReviewApprovalNotification = useCallback((review: Review, approved: boolean) => {
    addNotification({
      type: approved ? 'review_approved' : 'review_rejected',
      title: `Review ${approved ? 'Approved' : 'Rejected'}`,
      message: `Review by ${review.guest_name} for ${review.listing_name || 'property'} has been ${approved ? 'approved' : 'rejected'}`,
      priority: 'normal',
      read: false,
      data: review,
    });
  }, [addNotification]);

  const sendSystemAlert = useCallback((title: string, message: string, priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal') => {
    addNotification({
      type: 'system_alert',
      title,
      message,
      priority,
      read: false,
    });
  }, [addNotification]);

  const sendCustomNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    addNotification(notification);
  }, [addNotification]);

  return {
    sendReviewApprovalNotification,
    sendSystemAlert,
    sendCustomNotification,
  };
};

export default NotificationProvider;

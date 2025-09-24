'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Settings,
  Moon,
  Sun,
  Monitor,
  Bell,
  Eye,
  Keyboard,
  Palette,
  Globe,
  Shield,
  Download,
  Trash2,
  RefreshCw,
  Volume2,
  VolumeX,
  Zap,
  Filter,
  Activity,
  User,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLocalStorage } from '@/lib/hooks';
import { trackUserAction } from '@/lib/analytics';
import { toast } from '@/lib/use-toast';

interface UserPreferences {
  // Appearance
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  reducedMotion: boolean;
  compactMode: boolean;
  fontSize: 'small' | 'medium' | 'large';
  
  // Notifications
  enableNotifications: boolean;
  soundEnabled: boolean;
  emailNotifications: boolean;
  desktopNotifications: boolean;
  notificationFrequency: 'instant' | 'hourly' | 'daily';
  
  // Workflow
  autoApprovalEnabled: boolean;
  defaultView: 'table' | 'grid' | 'list';
  itemsPerPage: number;
  autoRefreshEnabled: boolean;
  autoRefreshInterval: number;
  
  // Privacy & Security
  analyticsEnabled: boolean;
  shareUsageData: boolean;
  sessionTimeout: number;
  
  // Advanced
  keyboardShortcutsEnabled: boolean;
  developerMode: boolean;
  experimentalFeatures: boolean;
}

const defaultPreferences: UserPreferences = {
  theme: 'system',
  accentColor: '#3b82f6',
  reducedMotion: false,
  compactMode: false,
  fontSize: 'medium',
  
  enableNotifications: true,
  soundEnabled: true,
  emailNotifications: true,
  desktopNotifications: true,
  notificationFrequency: 'instant',
  
  autoApprovalEnabled: false,
  defaultView: 'table',
  itemsPerPage: 10,
  autoRefreshEnabled: true,
  autoRefreshInterval: 30,
  
  analyticsEnabled: true,
  shareUsageData: true,
  sessionTimeout: 60,
  
  keyboardShortcutsEnabled: true,
  developerMode: false,
  experimentalFeatures: false,
};

export function UserPreferences() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [preferences, setPreferences] = useLocalStorage<UserPreferences>(
    'user-preferences', 
    defaultPreferences
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('appearance');

  // Track changes
  useEffect(() => {
    const hasChanged = JSON.stringify(preferences) !== JSON.stringify(defaultPreferences);
    setHasChanges(hasChanged);
  }, [preferences]);

  const updatePreference = <K extends keyof UserPreferences>(
    key: K, 
    value: UserPreferences[K]
  ) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value,
    }));
    
    trackUserAction('preference_updated', 'user_preferences', {
      preference: key,
      value: String(value),
    });

    // Apply immediate theme changes
    if (key === 'theme') {
      setTheme(value as string);
    }

    // Apply document-level changes
    if (key === 'reducedMotion') {
      document.documentElement.style.setProperty(
        '--animation-duration', 
        value ? '0.01ms' : '300ms'
      );
    }

    if (key === 'fontSize') {
      const sizes = { small: '14px', medium: '16px', large: '18px' };
      document.documentElement.style.setProperty(
        '--font-size-base',
        sizes[value as keyof typeof sizes]
      );
    }
  };

  const resetPreferences = () => {
    setPreferences(defaultPreferences);
    trackUserAction('preferences_reset', 'user_preferences');
    toast({
      title: 'Preferences reset',
      description: 'All preferences have been reset to default values.',
    });
  };

  const exportPreferences = () => {
    const dataStr = JSON.stringify(preferences, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'flexliving-preferences.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    trackUserAction('preferences_exported', 'user_preferences');
    toast({
      title: 'Preferences exported',
      description: 'Your preferences have been downloaded as a JSON file.',
    });
  };

  const importPreferences = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedPrefs = JSON.parse(e.target?.result as string);
        setPreferences({ ...defaultPreferences, ...importedPrefs });
        trackUserAction('preferences_imported', 'user_preferences');
        toast({
          title: 'Preferences imported',
          description: 'Your preferences have been successfully imported.',
        });
      } catch (error) {
        toast({
          title: 'Import failed',
          description: 'The file format is invalid.',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
  };

  const testNotification = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification('FlexLiving Test', {
            body: 'Notifications are working correctly!',
            icon: '/favicon.ico',
          });
          toast({
            title: 'Test notification sent',
            description: 'Check your system notifications.',
          });
        }
      });
    }
    trackUserAction('notification_test', 'user_preferences');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="fixed bottom-20 right-4 z-40">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>User Preferences</span>
            {hasChanges && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="h-2 w-2 bg-primary rounded-full"
              />
            )}
          </DialogTitle>
          <DialogDescription>
            Customize your FlexLiving experience and workflow preferences.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="appearance" className="text-xs">
              <Palette className="h-3 w-3 mr-1" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs">
              <Bell className="h-3 w-3 mr-1" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="workflow" className="text-xs">
              <Activity className="h-3 w-3 mr-1" />
              Workflow
            </TabsTrigger>
            <TabsTrigger value="privacy" className="text-xs">
              <Shield className="h-3 w-3 mr-1" />
              Privacy
            </TabsTrigger>
            <TabsTrigger value="advanced" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              Advanced
            </TabsTrigger>
          </TabsList>

          <div className="mt-6 max-h-[60vh] overflow-y-auto space-y-6">
            {/* Appearance */}
            <TabsContent value="appearance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Palette className="h-4 w-4" />
                    <span>Theme & Display</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Color Theme</Label>
                    <Select
                      value={preferences.theme}
                      onValueChange={(value) => updatePreference('theme', value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">
                          <div className="flex items-center space-x-2">
                            <Sun className="h-4 w-4" />
                            <span>Light</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="dark">
                          <div className="flex items-center space-x-2">
                            <Moon className="h-4 w-4" />
                            <span>Dark</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="system">
                          <div className="flex items-center space-x-2">
                            <Monitor className="h-4 w-4" />
                            <span>System</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Font Size</Label>
                    <Select
                      value={preferences.fontSize}
                      onValueChange={(value) => updatePreference('fontSize', value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Compact Mode</Label>
                      <p className="text-xs text-muted-foreground">
                        Reduce spacing and padding for denser layouts
                      </p>
                    </div>
                    <Switch
                      checked={preferences.compactMode}
                      onCheckedChange={(checked) => updatePreference('compactMode', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Reduced Motion</Label>
                      <p className="text-xs text-muted-foreground">
                        Minimize animations and transitions
                      </p>
                    </div>
                    <Switch
                      checked={preferences.reducedMotion}
                      onCheckedChange={(checked) => updatePreference('reducedMotion', checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications */}
            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Bell className="h-4 w-4" />
                    <span>Notification Settings</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Notifications</Label>
                      <p className="text-xs text-muted-foreground">
                        Receive notifications for review updates
                      </p>
                    </div>
                    <Switch
                      checked={preferences.enableNotifications}
                      onCheckedChange={(checked) => updatePreference('enableNotifications', checked)}
                    />
                  </div>

                  {preferences.enableNotifications && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Sound Effects</Label>
                          <p className="text-xs text-muted-foreground">
                            Play sounds for notifications
                          </p>
                        </div>
                        <Switch
                          checked={preferences.soundEnabled}
                          onCheckedChange={(checked) => updatePreference('soundEnabled', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Email Notifications</Label>
                          <p className="text-xs text-muted-foreground">
                            Receive email alerts for important events
                          </p>
                        </div>
                        <Switch
                          checked={preferences.emailNotifications}
                          onCheckedChange={(checked) => updatePreference('emailNotifications', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Desktop Notifications</Label>
                          <p className="text-xs text-muted-foreground">
                            Show system notifications in your browser
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={preferences.desktopNotifications}
                            onCheckedChange={(checked) => updatePreference('desktopNotifications', checked)}
                          />
                          <Button size="sm" variant="outline" onClick={testNotification}>
                            Test
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Notification Frequency</Label>
                        <Select
                          value={preferences.notificationFrequency}
                          onValueChange={(value) => updatePreference('notificationFrequency', value as any)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="instant">Instant</SelectItem>
                            <SelectItem value="hourly">Hourly Digest</SelectItem>
                            <SelectItem value="daily">Daily Summary</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Workflow */}
            <TabsContent value="workflow" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="h-4 w-4" />
                    <span>Workflow Settings</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Default View</Label>
                    <Select
                      value={preferences.defaultView}
                      onValueChange={(value) => updatePreference('defaultView', value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="table">Table View</SelectItem>
                        <SelectItem value="grid">Grid View</SelectItem>
                        <SelectItem value="list">List View</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Items Per Page</Label>
                    <Select
                      value={preferences.itemsPerPage.toString()}
                      onValueChange={(value) => updatePreference('itemsPerPage', parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 items</SelectItem>
                        <SelectItem value="25">25 items</SelectItem>
                        <SelectItem value="50">50 items</SelectItem>
                        <SelectItem value="100">100 items</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto Refresh</Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically refresh data periodically
                      </p>
                    </div>
                    <Switch
                      checked={preferences.autoRefreshEnabled}
                      onCheckedChange={(checked) => updatePreference('autoRefreshEnabled', checked)}
                    />
                  </div>

                  {preferences.autoRefreshEnabled && (
                    <div className="space-y-2">
                      <Label>Refresh Interval (seconds)</Label>
                      <div className="space-y-2">
                        <Slider
                          value={[preferences.autoRefreshInterval]}
                          onValueChange={([value]) => updatePreference('autoRefreshInterval', value)}
                          max={300}
                          min={10}
                          step={10}
                          className="flex-1"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>10s</span>
                          <span>{preferences.autoRefreshInterval}s</span>
                          <span>300s</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto Approval</Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically approve high-rated reviews
                      </p>
                    </div>
                    <Switch
                      checked={preferences.autoApprovalEnabled}
                      onCheckedChange={(checked) => updatePreference('autoApprovalEnabled', checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Privacy */}
            <TabsContent value="privacy" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="h-4 w-4" />
                    <span>Privacy & Security</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Analytics</Label>
                      <p className="text-xs text-muted-foreground">
                        Help improve the app by sharing usage analytics
                      </p>
                    </div>
                    <Switch
                      checked={preferences.analyticsEnabled}
                      onCheckedChange={(checked) => updatePreference('analyticsEnabled', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Usage Data</Label>
                      <p className="text-xs text-muted-foreground">
                        Share anonymous usage data to help improve features
                      </p>
                    </div>
                    <Switch
                      checked={preferences.shareUsageData}
                      onCheckedChange={(checked) => updatePreference('shareUsageData', checked)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Session Timeout (minutes)</Label>
                    <div className="space-y-2">
                      <Slider
                        value={[preferences.sessionTimeout]}
                        onValueChange={([value]) => updatePreference('sessionTimeout', value)}
                        max={480}
                        min={15}
                        step={15}
                        className="flex-1"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>15m</span>
                        <span>{preferences.sessionTimeout}m</span>
                        <span>8h</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Advanced */}
            <TabsContent value="advanced" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Zap className="h-4 w-4" />
                    <span>Advanced Settings</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Keyboard Shortcuts</Label>
                      <p className="text-xs text-muted-foreground">
                        Enable keyboard navigation and shortcuts
                      </p>
                    </div>
                    <Switch
                      checked={preferences.keyboardShortcutsEnabled}
                      onCheckedChange={(checked) => updatePreference('keyboardShortcutsEnabled', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Developer Mode</Label>
                      <p className="text-xs text-muted-foreground">
                        Show additional debugging information
                      </p>
                    </div>
                    <Switch
                      checked={preferences.developerMode}
                      onCheckedChange={(checked) => updatePreference('developerMode', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Experimental Features</Label>
                      <p className="text-xs text-muted-foreground">
                        Try new features before they're released
                      </p>
                    </div>
                    <Switch
                      checked={preferences.experimentalFeatures}
                      onCheckedChange={(checked) => updatePreference('experimentalFeatures', checked)}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label>Data Management</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportPreferences}
                        className="text-xs"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Export Settings
                      </Button>
                      
                      <div className="relative">
                        <input
                          type="file"
                          accept=".json"
                          onChange={importPreferences}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Button variant="outline" size="sm" className="text-xs">
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Import Settings
                        </Button>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetPreferences}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Reset All
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <p className="text-xs text-muted-foreground">
              Preferences are saved automatically
            </p>
            <Button onClick={() => setIsOpen(false)}>
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

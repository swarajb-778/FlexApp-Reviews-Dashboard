'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Download,
  FileText,
  Table,
  FileSpreadsheet,
  FileImage,
  Mail,
  Calendar,
  Settings,
  Filter,
  CheckCircle,
  AlertTriangle,
  Clock,
  X,
  Eye,
  Copy,
  Share,
  History,
  Zap,
  MoreHorizontal,
  Loader2,
  RefreshCw,
  Save,
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Review, ReviewFilters } from '@/lib/types';
import { flexLivingComponents } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { trackUserAction } from '@/lib/analytics';
import { useLocalStorage } from '@/lib/hooks';
import { toast } from '@/lib/use-toast';

export interface ExportColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'rating';
  required?: boolean;
  defaultSelected?: boolean;
  description?: string;
  formatter?: (value: any, review: Review) => string;
}

export interface ExportFormat {
  id: string;
  name: string;
  extension: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  mimeType: string;
  maxRows?: number;
  supportedColumns?: string[];
}

export interface ExportTemplate {
  id: string;
  name: string;
  description?: string;
  format: string;
  columns: string[];
  filters?: ReviewFilters;
  schedule?: ExportSchedule;
  isCustom?: boolean;
  createdAt?: string;
}

export interface ExportSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:mm format
  email?: string;
  lastRun?: string;
  nextRun?: string;
}

interface ExportProgress {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalRows: number;
  processedRows: number;
  startTime: string;
  completedTime?: string;
  downloadUrl?: string;
  error?: string;
}

interface DataExportProps {
  data: Review[];
  filters?: ReviewFilters;
  onExport?: (format: string, options: ExportOptions) => Promise<void>;
  className?: string;
  defaultFormat?: string;
  enableScheduling?: boolean;
  enableTemplates?: boolean;
  maxExportSize?: number;
}

interface ExportOptions {
  format: string;
  columns: string[];
  filters?: ReviewFilters;
  filename?: string;
  includeHeaders?: boolean;
  schedule?: ExportSchedule;
}

// Available export formats
const exportFormats: ExportFormat[] = [
  {
    id: 'csv',
    name: 'CSV',
    extension: 'csv',
    icon: FileText,
    description: 'Comma-separated values file, compatible with Excel and other spreadsheet applications',
    mimeType: 'text/csv',
  },
  {
    id: 'xlsx',
    name: 'Excel',
    extension: 'xlsx',
    icon: FileSpreadsheet,
    description: 'Microsoft Excel file with formatting and multiple sheets',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    maxRows: 1000000,
  },
  {
    id: 'json',
    name: 'JSON',
    extension: 'json',
    icon: FileText,
    description: 'JavaScript Object Notation, ideal for API integration',
    mimeType: 'application/json',
  },
  {
    id: 'pdf',
    name: 'PDF Report',
    extension: 'pdf',
    icon: FileImage,
    description: 'Formatted PDF report with charts and summary statistics',
    mimeType: 'application/pdf',
    maxRows: 10000,
    supportedColumns: ['guest_name', 'overall_rating', 'review_text', 'submission_date', 'approved'],
  },
];

// Available columns for export
const exportColumns: ExportColumn[] = [
  {
    key: 'id',
    label: 'Review ID',
    type: 'string',
    required: true,
    defaultSelected: true,
    description: 'Unique identifier for the review',
  },
  {
    key: 'guest_name',
    label: 'Guest Name',
    type: 'string',
    defaultSelected: true,
    description: 'Name of the guest who left the review',
  },
  {
    key: 'guest_email',
    label: 'Guest Email',
    type: 'string',
    description: 'Email address of the guest',
  },
  {
    key: 'overall_rating',
    label: 'Overall Rating',
    type: 'rating',
    defaultSelected: true,
    description: 'Overall rating given by the guest (1-5 stars)',
    formatter: (value: number) => `${value}/5`,
  },
  {
    key: 'review_text',
    label: 'Review Text',
    type: 'string',
    defaultSelected: true,
    description: 'Full text content of the review',
  },
  {
    key: 'private_feedback',
    label: 'Private Feedback',
    type: 'string',
    description: 'Private feedback not shown publicly',
  },
  {
    key: 'submission_date',
    label: 'Submission Date',
    type: 'date',
    defaultSelected: true,
    description: 'Date when the review was submitted',
    formatter: (value: string) => format(new Date(value), 'yyyy-MM-dd HH:mm'),
  },
  {
    key: 'check_in_date',
    label: 'Check-in Date',
    type: 'date',
    description: 'Guest check-in date',
    formatter: (value: string) => value ? format(new Date(value), 'yyyy-MM-dd') : '',
  },
  {
    key: 'check_out_date',
    label: 'Check-out Date',
    type: 'date',
    description: 'Guest check-out date',
    formatter: (value: string) => value ? format(new Date(value), 'yyyy-MM-dd') : '',
  },
  {
    key: 'listing_name',
    label: 'Property Name',
    type: 'string',
    defaultSelected: true,
    description: 'Name of the property',
  },
  {
    key: 'listing_address',
    label: 'Property Address',
    type: 'string',
    description: 'Address of the property',
  },
  {
    key: 'channel_name',
    label: 'Booking Channel',
    type: 'string',
    defaultSelected: true,
    description: 'Channel where the booking was made',
  },
  {
    key: 'approved',
    label: 'Approval Status',
    type: 'boolean',
    defaultSelected: true,
    description: 'Whether the review is approved, rejected, or pending',
    formatter: (value: boolean | null) => {
      if (value === true) return 'Approved';
      if (value === false) return 'Rejected';
      return 'Pending';
    },
  },
  {
    key: 'approved_at',
    label: 'Approved Date',
    type: 'date',
    description: 'Date when the review was approved or rejected',
    formatter: (value: string) => value ? format(new Date(value), 'yyyy-MM-dd HH:mm') : '',
  },
  {
    key: 'approved_by',
    label: 'Approved By',
    type: 'string',
    description: 'User who approved or rejected the review',
  },
];

// Default export templates
const defaultTemplates: ExportTemplate[] = [
  {
    id: 'basic-review-export',
    name: 'Basic Review Export',
    description: 'Essential review information for general reporting',
    format: 'csv',
    columns: ['guest_name', 'overall_rating', 'review_text', 'submission_date', 'listing_name', 'approved'],
  },
  {
    id: 'guest-communication',
    name: 'Guest Communication List',
    description: 'Guest contact information for follow-up communications',
    format: 'xlsx',
    columns: ['guest_name', 'guest_email', 'overall_rating', 'listing_name', 'check_in_date', 'check_out_date'],
  },
  {
    id: 'analytics-report',
    name: 'Analytics Report',
    description: 'Comprehensive data for analysis and reporting',
    format: 'xlsx',
    columns: ['id', 'guest_name', 'overall_rating', 'review_text', 'submission_date', 'listing_name', 'channel_name', 'approved', 'approved_at', 'approved_by'],
  },
  {
    id: 'pending-reviews',
    name: 'Pending Reviews',
    description: 'Reviews awaiting approval',
    format: 'csv',
    columns: ['guest_name', 'overall_rating', 'review_text', 'submission_date', 'listing_name'],
    filters: { status: 'pending' },
  },
];

export function DataExport({
  data,
  filters,
  onExport,
  className,
  defaultFormat = 'csv',
  enableScheduling = true,
  enableTemplates = true,
  maxExportSize = 50000,
}: DataExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'quick' | 'custom' | 'templates' | 'schedule'>('quick');
  const [selectedFormat, setSelectedFormat] = useState(defaultFormat);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    exportColumns.filter(col => col.defaultSelected).map(col => col.key)
  );
  const [filename, setFilename] = useState('');
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [exportFilters, setExportFilters] = useState<ReviewFilters>(filters || {});
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  
  // Local storage for templates and export history
  const [savedTemplates, setSavedTemplates] = useLocalStorage<ExportTemplate[]>('export-templates', defaultTemplates);
  const [exportHistory, setExportHistory] = useLocalStorage<ExportProgress[]>('export-history', []);
  const [scheduleSettings, setScheduleSettings] = useState<ExportSchedule>({
    enabled: false,
    frequency: 'weekly',
    time: '09:00',
  });

  // Calculate filtered data
  const filteredData = useMemo(() => {
    return data.filter(review => {
      // Apply export filters
      if (exportFilters.status) {
        if (exportFilters.status === 'pending' && review.approved !== null) return false;
        if (exportFilters.status === 'approved' && review.approved !== true) return false;
        if (exportFilters.status === 'rejected' && review.approved !== false) return false;
      }
      
      if (exportFilters.rating && review.overall_rating < exportFilters.rating) return false;
      if (exportFilters.channel && review.channel_name !== exportFilters.channel) return false;
      if (exportFilters.listing && review.listing_id !== exportFilters.listing) return false;
      
      if (exportFilters.dateRange) {
        const reviewDate = new Date(review.submission_date);
        const [startDate, endDate] = exportFilters.dateRange;
        if (startDate && reviewDate < startDate) return false;
        if (endDate && reviewDate > endDate) return false;
      }
      
      return true;
    });
  }, [data, exportFilters]);

  // Generate filename if not set
  const generateFilename = useCallback(() => {
    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmm');
    const formatExt = exportFormats.find(f => f.id === selectedFormat)?.extension || 'csv';
    const statusFilter = exportFilters.status ? `-${exportFilters.status}` : '';
    return `reviews${statusFilter}-${timestamp}.${formatExt}`;
  }, [selectedFormat, exportFilters.status]);

  useEffect(() => {
    if (!filename) {
      setFilename(generateFilename());
    }
  }, [filename, generateFilename]);

  // Handle format change
  const handleFormatChange = (formatId: string) => {
    setSelectedFormat(formatId);
    const format = exportFormats.find(f => f.id === formatId);
    
    // Filter columns based on format support
    if (format?.supportedColumns) {
      setSelectedColumns(prev => 
        prev.filter(col => format.supportedColumns!.includes(col))
      );
    }
    
    // Update filename extension
    const baseName = filename.replace(/\.[^/.]+$/, '');
    setFilename(`${baseName}.${format?.extension || 'csv'}`);
  };

  // Handle export execution
  const handleExport = async () => {
    if (filteredData.length === 0) {
      toast({
        title: 'No data to export',
        description: 'The current filters result in no data. Please adjust your filters.',
        variant: 'destructive',
      });
      return;
    }

    if (maxExportSize && filteredData.length > maxExportSize) {
      toast({
        title: 'Export size too large',
        description: `Please reduce the data size to under ${maxExportSize.toLocaleString()} rows.`,
        variant: 'destructive',
      });
      return;
    }

    const progressId = `export-${Date.now()}`;
    const progress: ExportProgress = {
      id: progressId,
      status: 'processing',
      progress: 0,
      totalRows: filteredData.length,
      processedRows: 0,
      startTime: new Date().toISOString(),
    };

    setExportProgress(progress);
    setExportHistory(prev => [progress, ...prev.slice(0, 9)]);

    try {
      const options: ExportOptions = {
        format: selectedFormat,
        columns: selectedColumns,
        filters: exportFilters,
        filename,
        includeHeaders,
        schedule: scheduleSettings.enabled ? scheduleSettings : undefined,
      };

      // Simulate progress for demo
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        const updatedProgress = {
          ...progress,
          progress: i,
          processedRows: Math.round((i / 100) * filteredData.length),
        };
        setExportProgress(updatedProgress);
      }

      if (onExport) {
        await onExport(selectedFormat, options);
      } else {
        // Default export implementation
        await defaultExport(filteredData, options);
      }

      const completedProgress = {
        ...progress,
        status: 'completed' as const,
        progress: 100,
        processedRows: filteredData.length,
        completedTime: new Date().toISOString(),
        downloadUrl: `#download-${progressId}`,
      };

      setExportProgress(completedProgress);
      setExportHistory(prev => [completedProgress, ...prev.slice(1)]);

      trackUserAction('data_exported', 'data_export', {
        format: selectedFormat,
        columns: selectedColumns.length,
        rows: filteredData.length,
        filename,
      });

      toast({
        title: 'Export completed',
        description: `Successfully exported ${filteredData.length} rows to ${filename}`,
      });

      // Auto-close after success
      setTimeout(() => {
        setIsOpen(false);
        setExportProgress(null);
      }, 2000);

    } catch (error) {
      const failedProgress = {
        ...progress,
        status: 'failed' as const,
        error: error instanceof Error ? error.message : 'Export failed',
      };

      setExportProgress(failedProgress);
      setExportHistory(prev => [failedProgress, ...prev.slice(1)]);

      toast({
        title: 'Export failed',
        description: failedProgress.error,
        variant: 'destructive',
      });
    }
  };

  // Default export implementation
  const defaultExport = async (data: Review[], options: ExportOptions) => {
    const selectedColumnDefs = exportColumns.filter(col => options.columns.includes(col.key));
    
    if (options.format === 'csv') {
      const headers = selectedColumnDefs.map(col => col.label);
      const rows = data.map(review => 
        selectedColumnDefs.map(col => {
          const value = (review as any)[col.key];
          return col.formatter ? col.formatter(value, review) : value;
        })
      );
      
      const csvContent = [
        options.includeHeaders ? headers.join(',') : null,
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].filter(Boolean).join('\n');
      
      downloadFile(csvContent, options.filename || 'export.csv', 'text/csv');
    } else if (options.format === 'json') {
      const jsonData = data.map(review => {
        const exportRow: any = {};
        selectedColumnDefs.forEach(col => {
          const value = (review as any)[col.key];
          exportRow[col.key] = col.formatter ? col.formatter(value, review) : value;
        });
        return exportRow;
      });
      
      downloadFile(JSON.stringify(jsonData, null, 2), options.filename || 'export.json', 'application/json');
    }
  };

  // Download file helper
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Save template
  const saveTemplate = () => {
    if (!templateName.trim()) {
      toast({
        title: 'Template name required',
        description: 'Please enter a name for your export template.',
        variant: 'destructive',
      });
      return;
    }

    const newTemplate: ExportTemplate = {
      id: `custom-${Date.now()}`,
      name: templateName.trim(),
      description: templateDescription.trim() || undefined,
      format: selectedFormat,
      columns: [...selectedColumns],
      filters: { ...exportFilters },
      isCustom: true,
      createdAt: new Date().toISOString(),
    };

    setSavedTemplates(prev => [newTemplate, ...prev]);
    setTemplateName('');
    setTemplateDescription('');
    setActiveTab('templates');

    toast({
      title: 'Template saved',
      description: `"${newTemplate.name}" has been saved to your templates.`,
    });
  };

  // Apply template
  const applyTemplate = (template: ExportTemplate) => {
    setSelectedFormat(template.format);
    setSelectedColumns([...template.columns]);
    if (template.filters) {
      setExportFilters({ ...template.filters });
    }
    setActiveTab('custom');
  };

  // Delete template
  const deleteTemplate = (templateId: string) => {
    setSavedTemplates(prev => prev.filter(t => t.id !== templateId));
    toast({
      title: 'Template deleted',
      description: 'The export template has been removed.',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={cn('', className)}>
          <Download className="h-4 w-4 mr-2" />
          Export Data
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Download className="h-5 w-5" />
            <span>Export Data</span>
            <Badge variant="secondary" className="text-xs">
              {filteredData.length.toLocaleString()} rows
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Export your review data in various formats with customizable columns and filters.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="quick" className="text-xs">Quick Export</TabsTrigger>
              <TabsTrigger value="custom" className="text-xs">Custom</TabsTrigger>
              {enableTemplates && <TabsTrigger value="templates" className="text-xs">Templates</TabsTrigger>}
              {enableScheduling && <TabsTrigger value="schedule" className="text-xs">Schedule</TabsTrigger>}
            </TabsList>

            <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-6">
              <TabsContent value="quick" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Export Format</Label>
                    <Select value={selectedFormat} onValueChange={handleFormatChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {exportFormats.map(format => {
                          const Icon = format.icon;
                          return (
                            <SelectItem key={format.id} value={format.id}>
                              <div className="flex items-center space-x-2">
                                <Icon className="h-4 w-4" />
                                <span>{format.name}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Filename</Label>
                    <Input
                      value={filename}
                      onChange={(e) => setFilename(e.target.value)}
                      placeholder="Enter filename..."
                    />
                  </div>
                </div>

                <div>
                  <Label>Quick Templates</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {defaultTemplates.slice(0, 4).map(template => (
                      <Button
                        key={template.id}
                        variant="outline"
                        size="sm"
                        onClick={() => applyTemplate(template)}
                        className="justify-start text-left h-auto p-3"
                      >
                        <div>
                          <div className="font-medium text-sm">{template.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {template.description}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="custom" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Format</Label>
                    <Select value={selectedFormat} onValueChange={handleFormatChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {exportFormats.map(format => {
                          const Icon = format.icon;
                          const isDisabled = format.maxRows && filteredData.length > format.maxRows;
                          return (
                            <SelectItem key={format.id} value={format.id} disabled={isDisabled}>
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center space-x-2">
                                  <Icon className="h-4 w-4" />
                                  <span>{format.name}</span>
                                </div>
                                {isDisabled && (
                                  <Badge variant="secondary" className="text-xs">
                                    Max {format.maxRows?.toLocaleString()} rows
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Filename</Label>
                    <Input
                      value={filename}
                      onChange={(e) => setFilename(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label>Columns to Export</Label>
                  <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg p-3 space-y-2">
                    {exportColumns.map(column => {
                      const isSelected = selectedColumns.includes(column.key);
                      const isDisabled = column.required || 
                        (exportFormats.find(f => f.id === selectedFormat)?.supportedColumns?.includes(column.key) === false);
                      
                      return (
                        <TooltipProvider key={column.key}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={column.key}
                                  checked={isSelected}
                                  disabled={isDisabled}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedColumns(prev => [...prev, column.key]);
                                    } else {
                                      setSelectedColumns(prev => prev.filter(c => c !== column.key));
                                    }
                                  }}
                                />
                                <Label
                                  htmlFor={column.key}
                                  className={cn(
                                    'text-sm cursor-pointer',
                                    isDisabled && 'opacity-50'
                                  )}
                                >
                                  {column.label}
                                  {column.required && <span className="text-red-500 ml-1">*</span>}
                                </Label>
                                <Badge variant="outline" className="text-xs">
                                  {column.type}
                                </Badge>
                              </div>
                            </TooltipTrigger>
                            {column.description && (
                              <TooltipContent>
                                <p>{column.description}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-headers"
                    checked={includeHeaders}
                    onCheckedChange={setIncludeHeaders}
                  />
                  <Label htmlFor="include-headers" className="text-sm">
                    Include column headers
                  </Label>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Save as Template (Optional)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Template name..."
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      onClick={saveTemplate}
                      disabled={!templateName.trim()}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Template
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Template description (optional)..."
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    className="h-20"
                  />
                </div>
              </TabsContent>

              {enableTemplates && (
                <TabsContent value="templates" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Saved Templates</h3>
                    <Badge variant="secondary">
                      {savedTemplates.length} templates
                    </Badge>
                  </div>

                  <div className="grid gap-3 max-h-96 overflow-y-auto">
                    {savedTemplates.map(template => {
                      const format = exportFormats.find(f => f.id === template.format);
                      const Icon = format?.icon || FileText;
                      
                      return (
                        <Card key={template.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 flex-1">
                              <Icon className="h-5 w-5 text-muted-foreground" />
                              <div className="min-w-0 flex-1">
                                <h4 className="font-medium text-sm">{template.name}</h4>
                                {template.description && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {template.description}
                                  </p>
                                )}
                                <div className="flex items-center space-x-2 mt-2">
                                  <Badge variant="outline" className="text-xs">
                                    {format?.name}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {template.columns.length} columns
                                  </Badge>
                                  {template.isCustom && (
                                    <Badge variant="secondary" className="text-xs">
                                      Custom
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                onClick={() => applyTemplate(template)}
                              >
                                Use Template
                              </Button>
                              {template.isCustom && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => deleteTemplate(template.id)}>
                                      <X className="h-4 w-4 mr-2" />
                                      Delete Template
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </TabsContent>
              )}

              {enableScheduling && (
                <TabsContent value="schedule" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Scheduled Exports</h3>
                      <p className="text-sm text-muted-foreground">
                        Automatically export data on a recurring schedule
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="enable-schedule"
                        checked={scheduleSettings.enabled}
                        onCheckedChange={(checked) => 
                          setScheduleSettings(prev => ({ ...prev, enabled: !!checked }))
                        }
                      />
                      <Label htmlFor="enable-schedule">Enable scheduling</Label>
                    </div>
                  </div>

                  {scheduleSettings.enabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Frequency</Label>
                        <Select
                          value={scheduleSettings.frequency}
                          onValueChange={(value) => 
                            setScheduleSettings(prev => ({ 
                              ...prev, 
                              frequency: value as 'daily' | 'weekly' | 'monthly' 
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Time</Label>
                        <Input
                          type="time"
                          value={scheduleSettings.time}
                          onChange={(e) => 
                            setScheduleSettings(prev => ({ ...prev, time: e.target.value }))
                          }
                        />
                      </div>

                      <div className="col-span-2">
                        <Label>Email notifications (optional)</Label>
                        <Input
                          type="email"
                          placeholder="Enter email address..."
                          value={scheduleSettings.email || ''}
                          onChange={(e) => 
                            setScheduleSettings(prev => ({ ...prev, email: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  )}
                </TabsContent>
              )}
            </div>
          </Tabs>
        </div>

        {/* Export Progress */}
        <AnimatePresence>
          {exportProgress && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="border-t pt-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2">
                      {exportProgress.status === 'processing' && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      )}
                      {exportProgress.status === 'completed' && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                      {exportProgress.status === 'failed' && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm font-medium">
                        {exportProgress.status === 'processing' && 'Exporting...'}
                        {exportProgress.status === 'completed' && 'Export completed!'}
                        {exportProgress.status === 'failed' && 'Export failed'}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {exportProgress.processedRows.toLocaleString()} / {exportProgress.totalRows.toLocaleString()} rows
                  </span>
                </div>
                
                <Progress value={exportProgress.progress} className="w-full" />
                
                {exportProgress.error && (
                  <p className="text-sm text-red-600">{exportProgress.error}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <span>{selectedColumns.length} columns selected</span>
            <Separator orientation="vertical" className="h-4" />
            <span>{filteredData.length.toLocaleString()} rows to export</span>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={exportProgress?.status === 'processing' || selectedColumns.length === 0}
            >
              {exportProgress?.status === 'processing' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

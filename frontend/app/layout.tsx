import type { Metadata, Viewport } from 'next';
import { Inter, Poppins } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Toaster } from '@/components/ui/toaster';
import { ReactQueryProvider } from '@/components/ReactQueryProvider';
import { PageLoader } from '@/components/PageLoader';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { NotificationProvider } from '@/components/NotificationSystem';
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts';
import { FlexLivingHeader } from '@/components/layout/FlexLivingHeader';
import { FlexLivingSidebar } from '@/components/layout/FlexLivingSidebar';
import { BreadcrumbNavigation } from '@/components/layout/BreadcrumbNavigation';
import { GlobalSearch } from '@/components/layout/GlobalSearch';
import { UserPreferences } from '@/components/layout/UserPreferences';
import { cn } from '@/lib/utils';
import { flexLivingComponents } from '@/lib/theme';

// FlexLiving Typography
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
});

const poppins = Poppins({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  preload: true,
});

// Enhanced FlexLiving Metadata
export const metadata: Metadata = {
  title: {
    template: '%s | FlexLiving Reviews',
    default: 'FlexLiving Reviews - Intelligent Property Review Management',
  },
  description: 'Advanced review management platform by FlexLiving. Streamline approval workflows, analyze guest feedback, and enhance property performance with intelligent automation.',
  keywords: [
    'FlexLiving',
    'property management',
    'review management',
    'guest reviews',
    'Airbnb reviews',
    'property analytics',
    'approval workflow',
    'hospitality technology',
    'vacation rental management',
    'guest experience',
    'review automation',
    'property insights'
  ],
  authors: [{ name: 'FlexLiving', url: 'https://flexliving.com' }],
  creator: 'FlexLiving',
  publisher: 'FlexLiving',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://reviews.flexliving.com',
    siteName: 'FlexLiving Reviews',
    title: 'FlexLiving Reviews - Intelligent Property Review Management',
    description: 'Advanced review management platform by FlexLiving. Streamline approval workflows, analyze guest feedback, and enhance property performance.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'FlexLiving Reviews Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FlexLiving Reviews - Intelligent Property Review Management',
    description: 'Advanced review management platform by FlexLiving. Streamline approval workflows and enhance property performance.',
    images: ['/twitter-image.png'],
    creator: '@flexliving',
  },
  alternates: {
    canonical: 'https://reviews.flexliving.com',
  },
  category: 'property management',
  classification: 'Business',
  referrer: 'origin-when-cross-origin',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#3b82f6' },
    { media: '(prefers-color-scheme: dark)', color: '#1e40af' },
  ],
  colorScheme: 'light dark',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

// Performance monitoring will be handled by analytics

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <head>
        {/* FlexLiving Branding */}
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        
        {/* Preload critical resources */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* FlexLiving Brand Colors */}
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        
        {/* Security Headers */}
        <meta name="referrer" content="origin-when-cross-origin" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-Frame-Options" content="DENY" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
      </head>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          'overflow-x-hidden', // Prevent horizontal scroll
          'selection:bg-primary/20 selection:text-primary-foreground',
          inter.variable,
          poppins.variable
        )}
      >
        <ErrorBoundary level="critical">
          <ReactQueryProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange={false}
            >
              <div className="relative flex min-h-screen">
                {/* Sidebar */}
                <Suspense fallback={<div className="w-64 bg-background border-r" />}>
                  <FlexLivingSidebar />
                </Suspense>
                
                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0">
                  {/* Header */}
                  <ErrorBoundary level="component">
                    <Suspense fallback={<div className="h-16 bg-background border-b" />}>
                      <FlexLivingHeader />
                    </Suspense>
                  </ErrorBoundary>
                  
                  {/* Breadcrumb Navigation */}
                  <ErrorBoundary level="component">
                    <Suspense fallback={<div className="h-10 bg-background/50" />}>
                      <BreadcrumbNavigation />
                    </Suspense>
                  </ErrorBoundary>
                  
                  {/* Page Content */}
                  <main className={cn(
                    'flex-1 overflow-auto',
                    'bg-gradient-to-br from-background via-background to-muted/20',
                    'min-h-0' // Important for proper scroll behavior
                  )}>
                    <ErrorBoundary level="page">
                      <Suspense fallback={<PageLoader />}>
                        <div className="container mx-auto px-4 py-6 space-y-6">
                          {children}
                        </div>
                      </Suspense>
                    </ErrorBoundary>
                  </main>
                </div>
              </div>
              
              {/* Global Components */}
              <ErrorBoundary level="component">
                <NotificationProvider>
                  <div />
                </NotificationProvider>
              </ErrorBoundary>
              
              <ErrorBoundary level="component">
                <KeyboardShortcuts enableGlobalShortcuts />
              </ErrorBoundary>
              
              <ErrorBoundary level="component">
                <Suspense fallback={null}>
                  <GlobalSearch />
                </Suspense>
              </ErrorBoundary>
              
              <ErrorBoundary level="component">
                <Suspense fallback={null}>
                  <UserPreferences />
                </Suspense>
              </ErrorBoundary>
              
              {/* Toast Notifications */}
              <Toaster />
              
              {/* Page Loader for route changes */}
              <PageLoader />
              
              {/* Accessibility improvements */}
              <div id="live-region" className="sr-only" aria-live="polite" aria-atomic="true" />
              <div id="status-region" className="sr-only" aria-live="polite" aria-atomic="true" />
              
            </ThemeProvider>
          </ReactQueryProvider>
        </ErrorBoundary>
        
        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

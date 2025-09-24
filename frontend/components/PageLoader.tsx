'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';

interface PageLoaderProps {
  className?: string;
}

export function PageLoader({ className }: PageLoaderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const router = useRouter();

  const loadingMessages = [
    'Loading reviews...',
    'Fetching data...',
    'Please wait...',
    'Almost there...',
    'Getting everything ready...',
  ];

  useEffect(() => {
    let messageInterval: NodeJS.Timeout;

    if (isLoading) {
      let messageIndex = 0;
      messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % loadingMessages.length;
        setLoadingMessage(loadingMessages[messageIndex]);
      }, 2000);
    }

    return () => {
      if (messageInterval) {
        clearInterval(messageInterval);
      }
    };
  }, [isLoading]);

  // Listen for route changes (simplified version)
  // In a real implementation, you'd use next/router events
  useEffect(() => {
    const handleStart = () => setIsLoading(true);
    const handleComplete = () => {
      setTimeout(() => setIsLoading(false), 500); // Small delay for smooth transition
    };

    // This is a simplified version - in practice you'd listen to actual router events
    return () => {
      // Cleanup
    };
  }, []);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={`fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md ${className}`}
        >
          <div className="flex flex-col items-center space-y-6">
            {/* Main loader with sparkles animation */}
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="relative"
              >
                <Loader2 className="h-12 w-12 text-primary" />
              </motion.div>
              
              {/* Sparkles around the loader */}
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-2 -left-2"
              >
                <Sparkles className="h-6 w-6 text-primary/60" />
              </motion.div>
              
              <motion.div
                animate={{ scale: [1.2, 1, 1.2], rotate: [360, 180, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
                className="absolute -bottom-2 -right-2"
              >
                <Sparkles className="h-4 w-4 text-primary/40" />
              </motion.div>
            </div>

            {/* Loading message with typewriter effect */}
            <motion.div
              key={loadingMessage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <h3 className="text-lg font-medium text-foreground mb-2">
                FlexApp
              </h3>
              <p className="text-sm text-muted-foreground">
                {loadingMessage}
              </p>
            </motion.div>

            {/* Progress bar animation */}
            <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
              <motion.div
                animate={{ x: [-100, 100] }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity, 
                  repeatType: 'reverse',
                  ease: 'easeInOut'
                }}
                className="h-full w-1/3 bg-gradient-to-r from-primary/50 via-primary to-primary/50 rounded-full"
              />
            </div>

            {/* Floating particles */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    y: [0, -20, 0],
                    x: [0, Math.sin(i) * 10, 0],
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 3 + i * 0.2,
                    repeat: Infinity,
                    delay: i * 0.3,
                    ease: 'easeInOut',
                  }}
                  className={`absolute w-1 h-1 bg-primary/30 rounded-full`}
                  style={{
                    left: `${20 + i * 10}%`,
                    top: `${40 + (i % 3) * 20}%`,
                  }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Skeleton loader components for specific content types
export function ReviewCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 animate-pulse">
      <div className="flex items-start space-x-4">
        <div className="h-10 w-10 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-1/4" />
          <div className="h-3 bg-muted rounded w-1/6" />
        </div>
        <div className="flex space-x-1">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-4 w-4 rounded bg-muted" />
          ))}
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 bg-muted rounded" />
        <div className="h-3 bg-muted rounded" />
        <div className="h-3 bg-muted rounded w-5/6" />
      </div>
      <div className="mt-4 flex justify-between items-center">
        <div className="h-6 w-16 bg-muted rounded" />
        <div className="flex space-x-2">
          <div className="h-8 w-20 bg-muted rounded" />
          <div className="h-8 w-20 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}

export function ReviewsTableSkeleton() {
  return (
    <div className="rounded-lg border bg-card">
      <div className="p-6 border-b">
        <div className="h-6 bg-muted rounded w-1/4 mb-2" />
        <div className="h-4 bg-muted rounded w-1/2" />
      </div>
      <div className="p-0">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-4 border-b last:border-b-0">
            <div className="h-4 w-4 bg-muted rounded" />
            <div className="h-8 w-8 bg-muted rounded-full" />
            <div className="flex-1 space-y-1">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
            <div className="flex space-x-1">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="h-3 w-3 bg-muted rounded" />
              ))}
            </div>
            <div className="h-6 w-16 bg-muted rounded" />
            <div className="flex space-x-2">
              <div className="h-8 w-16 bg-muted rounded" />
              <div className="h-8 w-16 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-4 bg-muted rounded w-24 mb-2" />
          <div className="h-8 bg-muted rounded w-16" />
        </div>
        <div className="h-12 w-12 bg-muted rounded-lg" />
      </div>
    </div>
  );
}

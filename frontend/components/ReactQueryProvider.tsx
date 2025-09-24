'use client'

import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

// Create a client outside of the component to avoid recreating on every render
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5 minutes
      staleTime: 1000 * 60 * 5,
      // 10 minutes
      gcTime: 1000 * 60 * 10,
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
})

interface ReactQueryProviderProps {
  children: React.ReactNode
}

export function ReactQueryProvider({ children }: ReactQueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools 
        initialIsOpen={false} 
        buttonPosition="bottom-right"
        position="bottom"
      />
    </QueryClientProvider>
  )
}
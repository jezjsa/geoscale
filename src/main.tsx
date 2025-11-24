import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App.tsx'
import { ThemeProvider } from './components/ThemeProvider'
import { Toaster } from './components/ui/sonner'
import { setupAuthListener } from './lib/auth-listener'
import './index.css'

// Create a query client with default options
// Configuration similar to snapbase - simple and reliable
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data is fresh for 5 minutes
      refetchOnWindowFocus: false, // Don't refetch when tab regains focus (like snapbase)
      refetchOnMount: false, // Don't refetch on mount - preserve data when navigating/returning to tab
      refetchOnReconnect: false, // Don't refetch on reconnect - preserve state
      retry: 1,
      // Keep data in cache even when components unmount
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
    },
  },
})

// Set up auth state listener
setupAuthListener(queryClient)

// Remove StrictMode in production to prevent double invocations
// StrictMode can cause issues with navigation and state after tab switches
const isDevelopment = import.meta.env.DEV
const AppWrapper = isDevelopment ? StrictMode : React.Fragment

createRoot(document.getElementById('root')!).render(
  <AppWrapper>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  </AppWrapper>,
)


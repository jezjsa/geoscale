import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App.tsx'
import { ThemeProvider } from './components/ThemeProvider'
import { Toaster } from './components/ui/sonner'
import { setupAuthListener } from './lib/auth-listener'
import './index.css'

// Create a query client with default options
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false, // Prevent refetch on tab switch (keep data when switching tabs)
      refetchOnMount: false, // Don't refetch on mount to preserve data when navigating
      refetchOnReconnect: true, // Refetch when network reconnects
      retry: 1,
      // Keep data in cache even when components unmount
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
    },
  },
})

// Set up auth state listener
setupAuthListener(queryClient)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)


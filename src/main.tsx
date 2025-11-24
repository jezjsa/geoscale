import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import { ThemeProvider } from './components/ThemeProvider'
import { Toaster } from './components/ui/sonner'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'

// Create a query client with default options
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false, // Don't refetch on tab switch
      refetchOnMount: false, // Don't refetch on mount by default
      refetchOnReconnect: false, // Don't refetch on reconnect
      retry: 1,
      gcTime: 1000 * 60 * 30, // 30 minutes
    },
  },
})

// Use StrictMode like Snapbase for consistent behavior
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <App />
          <Toaster />
        </QueryClientProvider>
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>,
)


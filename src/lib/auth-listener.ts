import { supabase } from './supabase'
import { QueryClient } from '@tanstack/react-query'

export function setupAuthListener(queryClient: QueryClient) {
  // Listen for auth state changes
  supabase.auth.onAuthStateChange(async (event) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      // Wait a moment for the database trigger to complete
      await new Promise(resolve => setTimeout(resolve, 500))
      // Refetch user query
      await queryClient.refetchQueries({ queryKey: ['currentUser'] })
    } else if (event === 'SIGNED_OUT') {
      // Clear user data
      queryClient.setQueryData(['currentUser'], null)
      // Redirect to login if we're on a protected route
      if (window.location.pathname !== '/login' && 
          window.location.pathname !== '/signup' && 
          window.location.pathname !== '/' &&
          !window.location.pathname.startsWith('/reset-password')) {
        window.location.href = '/login'
      }
    } else if (event === 'USER_UPDATED') {
      // User data was updated
      await queryClient.refetchQueries({ queryKey: ['currentUser'] })
    }
  })

  // Periodically check if session is still valid
  setInterval(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      // Session expired, clear user data
      queryClient.setQueryData(['currentUser'], null)
    }
  }, 60000) // Check every minute
}


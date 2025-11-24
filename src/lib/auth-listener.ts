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
      // Don't redirect here - let the router handle navigation
      // The signOut mutation in useAuth will handle the redirect
    } else if (event === 'USER_UPDATED') {
      // User data was updated
      await queryClient.refetchQueries({ queryKey: ['currentUser'] })
    }
  })

  // Periodically check if session is still valid (only when tab is visible)
  const checkSession = async () => {
    // Only check if document is visible (tab is active)
    if (document.hidden) {
      return
    }
    
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session) {
      // Only clear if we're sure the session is invalid
      // Don't clear on temporary errors
      if (error && error.message !== 'Session not found') {
        return
      }
      queryClient.setQueryData(['currentUser'], null)
    }
  }
  
  // Check session periodically, but only when tab is visible
  setInterval(checkSession, 60000) // Check every minute
  
  // Also check when tab becomes visible again
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkSession()
    }
  })
}


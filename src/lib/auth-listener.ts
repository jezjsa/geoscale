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
      // Note: The signOut mutation in useAuth will also clear and redirect
      // This is just a backup to ensure state is cleared
      queryClient.setQueryData(['currentUser'], null)
      // Don't redirect here - let the mutation handle navigation
      // to avoid race conditions
    } else if (event === 'USER_UPDATED') {
      // User data was updated
      await queryClient.refetchQueries({ queryKey: ['currentUser'] })
    }
  })

  // Simplified session handling - similar to snapbase's approach
  // Don't aggressively check session - let Supabase's built-in session management handle it
  // The onAuthStateChange listener above will handle session changes automatically
}


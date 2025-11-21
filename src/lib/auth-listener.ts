import { supabase } from './supabase'
import { QueryClient } from '@tanstack/react-query'

export function setupAuthListener(queryClient: QueryClient) {
  // Listen for auth state changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      // Wait a moment for the database trigger to complete
      await new Promise(resolve => setTimeout(resolve, 500))
      // Refetch user query
      await queryClient.refetchQueries({ queryKey: ['currentUser'] })
    } else if (event === 'SIGNED_OUT') {
      // Clear user data
      queryClient.setQueryData(['currentUser'], null)
    }
  })
}


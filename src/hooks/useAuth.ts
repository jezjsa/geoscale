import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { signIn, signOut, getCurrentUser, type SignInData } from '@/api/auth'

export function useAuth() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Get current user
  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1, // Reduce retries to fail faster
    retryDelay: 500,
    // Add timeout to prevent infinite loading
    gcTime: 1000 * 60 * 5, // Keep in cache for 5 minutes
    // Ensure query doesn't hang - fail gracefully
    throwOnError: false,
  })

  // Sign in mutation
  const signInMutation = useMutation({
    mutationFn: signIn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      navigate('/dashboard')
    },
  })

  // Sign out mutation - make it resilient to hanging after tab switch
  const signOutMutation = useMutation({
    mutationFn: async () => {
      // Try to sign out, but don't wait too long
      // After tab switch, Supabase might be slow to respond
      try {
        await Promise.race([
          signOut(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Sign out timeout')), 3000)
          )
        ])
      } catch (error) {
        // Log but don't throw - we'll clear state anyway
        console.warn('Sign out may have timed out:', error)
      }
    },
    onSettled: () => {
      // Always clear state and redirect, regardless of success/error
      // This ensures sign out completes even if Supabase is slow/unresponsive
      queryClient.setQueryData(['currentUser'], null)
      queryClient.clear()
      // Use navigate for SPA navigation (works reliably after tab switch)
      navigate('/login', { replace: true })
    },
  })

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signIn: (data: SignInData, options?: { onError?: (error: any) => void }) => {
      signInMutation.mutate(data, {
        onError: options?.onError,
      })
    },
    signOut: signOutMutation.mutate,
    isSigningIn: signInMutation.isPending,
    isSigningOut: signOutMutation.isPending,
  }
}


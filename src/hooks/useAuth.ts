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
    retry: 2,
    retryDelay: 1000,
  })

  // Sign in mutation
  const signInMutation = useMutation({
    mutationFn: signIn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      navigate('/dashboard')
    },
  })

  // Sign out mutation
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.setQueryData(['currentUser'], null)
      // Use window.location for logout to ensure clean state reset
      window.location.href = '/login'
    },
    onError: (error) => {
      console.error('Sign out error:', error)
      // Even on error, clear user data and redirect
      queryClient.setQueryData(['currentUser'], null)
      window.location.href = '/login'
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


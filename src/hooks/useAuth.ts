import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { signIn, signOut, getCurrentUser, type SignInData } from '@/api/auth'
import type { User } from '@/types/database'

export function useAuth() {
  const router = useRouter()
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
      router.navigate({ to: '/dashboard' })
    },
  })

  // Sign out mutation
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.setQueryData(['currentUser'], null)
      router.navigate({ to: '/' })
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


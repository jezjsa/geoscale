import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth()

  console.log('[ProtectedRoute] State:', { user, loading })

  if (loading) {
    console.log('[ProtectedRoute] Showing loading state')
    return (
      <div className="flex items-center justify-center" style={{ height: '100vh' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    console.log('[ProtectedRoute] No user, redirecting to login')
    return <Navigate to="/login" replace />
  }

  console.log('[ProtectedRoute] User authenticated, rendering children')
  return <>{children}</>
}


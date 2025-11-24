import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types/database'

interface AuthContextType {
  user: (User & { email?: string }) | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<any>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<(User & { email?: string }) | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastEventTime, setLastEventTime] = useState<number>(0)

  useEffect(() => {
    console.log('[AuthContext] Initializing...')
    
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[AuthContext] Initial session:', !!session)
      setSession(session)
      
      if (session?.user) {
        // Fetch user from database
        const { data: dbUser } = await supabase
          .from('users')
          .select('*')
          .eq('supabase_auth_user_id', session.user.id)
          .single()
        
        if (dbUser) {
          setUser({ ...dbUser, email: session.user.email })
        }
      }
      
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const now = Date.now()
      console.log('[AuthContext] Auth state changed:', _event, !!session)
      
      // Debounce duplicate events within 500ms
      if (now - lastEventTime < 500 && _event === 'SIGNED_IN') {
        console.log('[AuthContext] Ignoring duplicate SIGNED_IN event')
        return
      }
      setLastEventTime(now)
      
      // Handle sign out immediately
      if (_event === 'SIGNED_OUT') {
        console.log('[AuthContext] User signed out, clearing state')
        setSession(null)
        setUser(null)
        setLoading(false)
        return
      }
      
      setSession(session)
      
      if (session?.user) {
        console.log('[AuthContext] Fetching user from database for:', session.user.id)
        
        // Add a small delay to ensure database is ready after auth state change
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Fetch user from database
        const { data: dbUser, error } = await supabase
          .from('users')
          .select('*')
          .eq('supabase_auth_user_id', session.user.id)
          .single()
        
        console.log('[AuthContext] Database user fetch result:', { 
          dbUser, 
          error,
          hasId: dbUser?.id,
          keys: dbUser ? Object.keys(dbUser) : []
        })
        
        // Check if dbUser has actual data by checking if it has keys
        // After tab switches, dbUser.id might not be directly accessible even though it exists
        const hasData = dbUser && Object.keys(dbUser).length > 0
        
        if (hasData) {
          const userWithEmail = { ...dbUser, email: session.user.email }
          console.log('[AuthContext] Setting user:', userWithEmail)
          setUser(userWithEmail)
        } else {
          console.log('[AuthContext] No valid user found in database (no keys)')
          console.log('[AuthContext] Current user state:', user)
          // Don't set user to null if we already have a user - keep existing state
          if (!user) {
            setUser(null)
          } else {
            console.log('[AuthContext] Keeping existing user state')
          }
        }
      } else {
        console.log('[AuthContext] No session user, clearing user state')
        setUser(null)
      }
      
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password.trim(),
    })
    return { data, error }
  }

  const signOut = async () => {
    console.log('[AuthContext] Signing out...')
    // Clear state immediately to prevent flash of content
    setUser(null)
    setSession(null)
    await supabase.auth.signOut()
    console.log('[AuthContext] Sign out complete')
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

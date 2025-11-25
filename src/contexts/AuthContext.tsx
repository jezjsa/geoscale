import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User as SupabaseUser } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { User as DbUser } from '@/types/database'

interface AuthContextType {
  user: (DbUser & { email?: string }) | null
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
  const [user, setUser] = useState<(DbUser & { email?: string }) | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Helper to fetch DB user data safely without blocking
  const fetchUserProfile = async (authUser: SupabaseUser) => {
    try {
      console.log('[AuthContext] Fetching background profile for:', authUser.id)
      const { data: dbUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('supabase_auth_user_id', authUser.id)
        .maybeSingle()

      if (dbUser) {
        console.log('[AuthContext] Background profile loaded')
        setUser({ ...dbUser, email: authUser.email })
      } else if (error) {
        console.error('[AuthContext] Background fetch error:', error)
      } else {
        console.log('[AuthContext] No user profile found yet, will retry')
      }
    } catch (err) {
      console.error('[AuthContext] Background fetch exception:', err)
    }
  }

  useEffect(() => {
    console.log('[AuthContext] Initializing...')
    
    // 1. Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      
      if (session?.user) {
        // OPTIMISTIC: Set user immediately from session so app loads
        console.log('[AuthContext] Session found, setting optimistic user')
        // Cast to any to temporarily satisfy the DbUser type requirements with partial data
        setUser({ ...session.user } as any)
        
        // Background fetch for DB data
        fetchUserProfile(session.user)
      } else {
        setUser(null)
      }
      
      setLoading(false)
    })

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('[AuthContext] Auth state changed:', _event)
      
      if (_event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        setLoading(false)
        return
      }
      
      setSession(session)
      
      if (session?.user) {
        // OPTIMISTIC: Set user immediately if we don't have a full user yet
        setUser((prev) => {
           // If we already have the full DB user (check a known DB field like 'plan' or 'id'), 
           // don't overwrite with basic session user unless IDs mismatch
           if (prev?.supabase_auth_user_id === session.user.id && Object.keys(prev).length > 5) {
             return prev
           }
           return { ...session.user } as any
        })
        
        setLoading(false)
        
        // Background fetch to enrich data
        fetchUserProfile(session.user)
      } else {
        setUser(null)
        setLoading(false)
      }
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

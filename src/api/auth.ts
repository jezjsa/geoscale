import { supabase } from '@/lib/supabase'
import type { User } from '@/types/database'

export interface SignUpData {
  email: string
  password: string
  name: string
  plan: string
}

export interface SignInData {
  email: string
  password: string
}

export async function signUp({ email, password, name, plan }: SignUpData) {
  // Create auth user - the trigger will automatically create the user record
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        plan,
      },
    },
  })

  if (authError) {
    throw authError
  }

  if (!authData.user) {
    throw new Error('Failed to create user')
  }

  // The trigger creates the user record automatically
  // We'll return the session and let the app fetch the user after redirect
  // This avoids RLS issues during the signup process
  return { 
    user: null as any, // Will be fetched after redirect
    session: authData.session 
  }
}

export async function signIn({ email, password }: SignInData) {
  // Normalize email: trim whitespace and convert to lowercase
  const normalizedEmail = email.trim().toLowerCase()
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: password.trim(),
  })

  if (error) {
    throw error
  }

  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    throw error
  }
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })

  if (error) {
    throw error
  }
}

export async function getCurrentUser(): Promise<(User & { email?: string }) | null> {
  try {
    console.log('[getCurrentUser] Starting...')
    
    // Skip getSession() - it's slow on refresh. Go straight to getUser()
    // getUser() validates the JWT and is faster
    const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()
    console.log('[getCurrentUser] Auth user:', { hasAuthUser: !!authUser, userError })

    if (userError || !authUser) {
      console.log('[getCurrentUser] No auth user, returning null')
      return null
    }

    console.log('[getCurrentUser] Fetching user from database...')
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('supabase_auth_user_id', authUser.id)
      .single()

    if (error) {
      console.error('[getCurrentUser] Error fetching user from database:', error)
      return null
    }

    console.log('[getCurrentUser] Success! User:', user)
    return {
      ...user,
      email: authUser.email,
    } as User & { email?: string }
  } catch (error) {
    console.error('[getCurrentUser] Caught error:', error)
    return null
  }
}


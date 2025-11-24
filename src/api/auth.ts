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
    // First check if we have a valid session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      // No valid session - don't call signOut here as it can break navigation
      // Just return null and let the router handle redirect
      return null
    }

    const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()

    if (userError || !authUser) {
      // Auth user fetch failed - don't sign out here, just return null
    return null
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('supabase_auth_user_id', authUser.id)
    .single()

  if (error) {
    console.error('Error fetching user:', error)
    return null
  }

  return {
    ...user,
    email: authUser.email,
  } as User & { email?: string }
  } catch (error) {
    console.error('Error in getCurrentUser:', error)
    // Don't sign out on error - just return null
    return null
  }
}


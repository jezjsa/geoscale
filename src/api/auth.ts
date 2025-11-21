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
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
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

export async function getCurrentUser(): Promise<(User & { email?: string }) | null> {
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
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
}


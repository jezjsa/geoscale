import { createClient } from '@supabase/supabase-js'

// Get Supabase URL and anon key from environment variables
// These are safe to expose in the client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create Supabase client - use default config like Snapbase for reliability
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Note: API keys for third-party services (Google, DataForSEO, OpenAI, Stripe)
// will be stored in Supabase Secrets and accessed via Edge Functions or
// Supabase Database Functions, not in the client-side code.


import { supabase } from './supabase'

export interface WaitlistEntry {
  id: string
  email: string
  created_at: string
  converted_to_user: boolean
  converted_at: string | null
  source: string
}

export interface WaitlistResponse {
  success: boolean
  message: string
  data?: WaitlistEntry
}

export const waitlistService = {
  async joinWaitlist(email: string, source: string = 'landing_page'): Promise<WaitlistResponse> {
    try {
      const { data, error } = await supabase
        .from('waitlist')
        .insert([{ email, source }])
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          return {
            success: false,
            message: 'This email address is already on our waitlist!'
          }
        }
        
        console.error('Waitlist error:', error)
        return {
          success: false,
          message: 'Something went wrong. Please try again.'
        }
      }

      return {
        success: true,
        message: 'Thanks for joining! We\'ll notify you when we launch.',
        data
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      return {
        success: false,
        message: 'Something went wrong. Please try again.'
      }
    }
  },

  async checkEmailExists(email: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('waitlist')
        .select('email')
        .eq('email', email)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking email:', error)
        return false
      }

      return !!data
    } catch (err) {
      console.error('Unexpected error:', err)
      return false
    }
  }
}

import { supabase } from '@/lib/supabase'
import type { CompanySettings } from '@/types/database'

export async function getCompanySettings(userId: string): Promise<CompanySettings | null> {
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No settings found, return null
      return null
    }
    console.error('Error fetching company settings:', error)
    throw error
  }

  return data as CompanySettings
}

export async function upsertCompanySettings(
  userId: string,
  settings: {
    business_name?: string | null
    phone_number?: string | null
    contact_url?: string | null
    service_description?: string | null
  }
): Promise<CompanySettings> {
  const { data, error } = await supabase
    .from('company_settings')
    .upsert({
      user_id: userId,
      ...settings,
    }, {
      onConflict: 'user_id',
    })
    .select()
    .single()

  if (error) {
    console.error('Error upserting company settings:', error)
    throw error
  }

  return data as CompanySettings
}


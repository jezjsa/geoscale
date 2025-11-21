import { supabase } from '@/lib/supabase'

export interface CreateClientData {
  contactName: string
  email: string
  password: string
  companyName: string
  agencyId: string
  sendLoginEmail: boolean
}

export async function createClient(data: CreateClientData) {
  try {
    // 1. Create the auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: data.contactName,
        plan: 'individual',
      },
    })

    if (authError) throw authError
    if (!authData.user) throw new Error('Failed to create user')

    // 2. Wait a moment for the trigger to create the users table record
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 3. Update the users table to link to agency
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        agency_id: data.agencyId,
        name: data.contactName,
      })
      .eq('supabase_auth_user_id', authData.user.id)

    if (updateError) throw updateError

    // 4. Get the internal user ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('supabase_auth_user_id', authData.user.id)
      .single()

    if (userError) throw userError
    if (!userData) throw new Error('User record not found')

    // 5. Create company settings with the company name
    const { error: settingsError } = await supabase
      .from('company_settings')
      .insert({
        user_id: userData.id,
        business_name: data.companyName,
      })

    if (settingsError) throw settingsError

    // TODO: If sendLoginEmail is true, send email with credentials
    if (data.sendLoginEmail) {
      console.log('TODO: Send login email to', data.email)
    }

    return {
      success: true,
      userId: userData.id,
      authUserId: authData.user.id,
    }
  } catch (error) {
    console.error('Error creating client:', error)
    throw error
  }
}

export async function getAgencyClients(agencyId: string) {
  const { data, error } = await supabase
    .from('users')
    .select(`
      id,
      name,
      plan,
      created_at,
      company_settings (
        business_name
      )
    `)
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}


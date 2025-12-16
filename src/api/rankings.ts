/**
 * Rankings API
 * 
 * Functions for checking Google rankings via DataForSEO SERP API
 */

import { supabase } from '@/lib/supabase'

interface CheckRankingsInput {
  project_id: string
  combination_ids?: string[] // Optional: check specific combinations only
}

interface CheckRankingsResponse {
  success: boolean
  checked_count: number
  ranked_count: number
  not_ranked_count: number
  daily_quota?: number
  used_today?: number
  remaining_today?: number
}

/**
 * Check Google rankings for pushed combinations
 * Uses DataForSEO SERP API to find the position of each page
 */
export async function checkRankings(input: CheckRankingsInput): Promise<CheckRankingsResponse> {
  console.log('🔍 Checking rankings for project:', input.project_id)

  // Get the current session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('No active session')
  }

  // Call the Edge Function
  const { data, error } = await supabase.functions.invoke('check-rankings', {
    body: {
      project_id: input.project_id,
      combination_ids: input.combination_ids,
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (error) {
    throw error
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to check rankings')
  }

  console.log(`✅ Checked ${data.checked_count} combinations (${data.ranked_count} ranked)`)

  return data
}


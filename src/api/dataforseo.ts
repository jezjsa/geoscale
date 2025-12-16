/**
 * DataForSEO API Integration
 * 
 * This module will integrate with DataForSEO to:
 * 1. Fetch related keywords for a base keyword
 * 2. Get search volume data
 * 3. Get keyword difficulty scores
 * 
 * API Documentation: https://docs.dataforseo.com/
 * 
 * Environment variables needed:
 * - VITE_DATAFORSEO_LOGIN
 * - VITE_DATAFORSEO_PASSWORD
 */

import { supabase } from '@/lib/supabase'

interface KeywordVariationsInput {
  project_id: string
  base_keyword: string
  location?: string // GB by default
  limit?: number // Maximum number of variations to return
}

interface KeywordResult {
  keyword: string
  search_volume: number
  difficulty?: number
}

/**
 * Get keyword variations using DataForSEO API
 * This will:
 * 1. Fetch related keywords for the base keyword
 * 2. Get search volume and difficulty for each
 * 3. Store results in keyword_variations table
 */
export async function getKeywordVariations(input: KeywordVariationsInput): Promise<KeywordResult[]> {
  console.log('📊 Fetching keyword variations for:', input.base_keyword)

  // Get the current session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('No active session')
  }

  // Call the Edge Function (which has access to DATAFORSEO credentials secrets)
  const { data, error } = await supabase.functions.invoke('get-keyword-variations', {
    body: {
      project_id: input.project_id,
      base_keyword: input.base_keyword,
      location: input.location || 'GB',
      limit: input.limit || 50,
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (error) {
    throw error
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to get keyword variations')
  }

  console.log(`✅ Found ${data.keywords_count} keywords (${data.new_keywords_count} new)`)

  return data.keywords
}

interface KeywordMetricsResult {
  success: boolean
  message: string
  updated_count: number
  total_keywords?: number
  keywords_processed?: number
}

/**
 * Get keyword metrics (volume & difficulty) for existing keywords in a project
 * This will:
 * 1. Find all keywords missing volume or difficulty data
 * 2. Fetch search volume from Google Ads API
 * 3. Fetch keyword difficulty from DataForSEO Labs API
 * 4. Update the keyword_variations table with the new data
 */
export async function getKeywordMetrics(projectId: string): Promise<KeywordMetricsResult> {
  console.log('📊 Fetching keyword metrics for project:', projectId)

  // Get the current session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('No active session')
  }

  // Call the Edge Function
  const { data, error } = await supabase.functions.invoke('get-keyword-metrics', {
    body: {
      project_id: projectId,
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (error) {
    throw error
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to get keyword metrics')
  }

  console.log(`✅ ${data.message}`)

  return data
}

/**
 * IMPLEMENTATION NOTES FOR DATAFORSEO API:
 * 
 * DataForSEO uses HTTP Basic Authentication:
 * ```typescript
 * const auth = Buffer.from(`${login}:${password}`).toString('base64')
 * const headers = {
 *   'Authorization': `Basic ${auth}`,
 *   'Content-Type': 'application/json'
 * }
 * ```
 * 
 * Step 1: Get related keywords using Keywords For Keywords API
 * Endpoint: POST https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live
 * ```typescript
 * const body = [{
 *   keywords: [baseKeyword],
 *   location_code: 2826, // United Kingdom
 *   language_code: "en",
 *   include_seed_keyword: true,
 *   include_serp_info: true,
 *   sort_by: "search_volume",
 *   limit: 50
 * }]
 * ```
 * 
 * Step 2: Parse response to get keywords with volume and difficulty
 * ```typescript
 * const keywords = response.tasks[0].result[0].items.map(item => ({
 *   keyword: item.keyword,
 *   search_volume: item.search_volume,
 *   difficulty: item.keyword_difficulty
 * }))
 * ```
 * 
 * Alternative: Use Keywords For Site API to find competitor keywords
 * Alternative: Use Related Keywords API for more semantic variations
 * 
 * Note: DataForSEO charges per API call, so implement caching and 
 * allow users to fetch volume data on-demand to save costs.
 */


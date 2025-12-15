/**
 * Heat Map API
 * 
 * Functions for generating geographic ranking heat maps using DataForSEO
 */

import { supabase } from '@/lib/supabase'
import { generateGrid, GridPoint } from '@/utils/grid-generator'

interface CheckHeatMapRankingsInput {
  project_id: string
  combinationId: string
  keyword_combination: string
  grid_size: number
  radius_km: number
  centerLat: number
  centerLng: number
}

interface CheckHeatMapRankingsResponse {
  success: boolean
  positions: (number | null)[]
  businessCounts: (number | null)[]
  averagePosition: number
  rankedCount: number
  notRankedCount: number
  remainingChecks?: number
}

export interface RankMapCredits {
  checksUsed: number
  checksAllowed: number
  checksPurchased: number
  checksRemaining: number
  resetDate: string | null
}

/**
 * Generate heat map ranking data for a keyword combination
 * Creates a geographic grid and checks rankings at each point
 */
export async function checkHeatMapRankings(input: CheckHeatMapRankingsInput): Promise<CheckHeatMapRankingsResponse> {
  console.log('🗺️ Generating heat map for:', input.keyword_combination)
  console.log('📍 Input data:', {
    projectId: input.project_id,
    combinationId: input.combinationId,
    gridSize: input.grid_size,
    radiusKm: input.radius_km,
    centerLat: input.centerLat,
    centerLng: input.centerLng
  })

  // Get the current session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('No active session')
  }

  // Generate the grid points
  const gridPoints = generateGrid({
    centerLat: input.centerLat,
    centerLng: input.centerLng,
    gridSize: input.grid_size,
    radiusKm: input.radius_km
  })

  console.log(`📍 Generated ${gridPoints.length} grid points`)

  // Call the Edge Function to check rankings for each grid point
  const { data, error } = await supabase.functions.invoke('check-heat-map-rankings', {
    body: {
      project_id: input.project_id,
      combination_id: input.combinationId,
      keyword_combination: input.keyword_combination,
      grid_size: input.grid_size,
      radius_km: input.radius_km,
      centerLat: input.centerLat,
      centerLng: input.centerLng
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (error) {
    throw error
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to generate heat map')
  }

  console.log(`✅ Heat map generated: ${data.ranked_count} ranked, ${data.not_ranked_count} not ranked`)

  return {
    success: true,
    positions: data.positions,
    businessCounts: data.business_counts || [],
    averagePosition: data.average_position,
    rankedCount: data.ranked_count,
    notRankedCount: data.not_ranked_count,
    remainingChecks: data.remaining_checks
  }
}

/**
 * Get user's rank map credits and usage
 */
export async function getRankMapCredits(): Promise<RankMapCredits> {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('Not authenticated')
  }

  // Get user record
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, plan_id')
    .eq('supabase_auth_user_id', user.id)
    .single()

  if (userError || !userData) {
    throw new Error('User not found')
  }

  // Get plan details
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('rank_map_checks_per_month')
    .eq('id', userData.plan_id)
    .single()

  if (planError || !plan) {
    throw new Error('Plan not found')
  }

  // Get user credits
  const { data: credits, error: creditsError } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', userData.id)
    .single()

  // If no credits record exists, return defaults
  if (creditsError && creditsError.code === 'PGRST116') {
    return {
      checksUsed: 0,
      checksAllowed: plan.rank_map_checks_per_month || 0,
      checksPurchased: 0,
      checksRemaining: plan.rank_map_checks_per_month || 0,
      resetDate: null
    }
  }

  if (creditsError) {
    throw new Error('Failed to fetch credits')
  }

  const checksAllowed = plan.rank_map_checks_per_month || 0
  const checksUsed = credits?.rank_map_checks_used || 0
  const checksPurchased = credits?.rank_map_checks_purchased || 0
  const checksRemaining = checksAllowed + checksPurchased - checksUsed

  return {
    checksUsed,
    checksAllowed,
    checksPurchased,
    checksRemaining: Math.max(0, checksRemaining),
    resetDate: credits?.usage_reset_date || null
  }
}

/**
 * Get existing heat map data for a combination
 */
export async function getHeatMapData(projectId: string, keywordCombination: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('location_ranking_grid')
    .select('*')
    .eq('project_id', projectId)
    .eq('keyword_combination', keywordCombination)
    .order('grid_y', { ascending: true })
    .order('grid_x', { ascending: true })

  if (error) {
    throw error
  }

  return data || []
}

/**
 * Save heat map data to database
 */
export async function saveHeatMapData(
  projectId: string,
  keywordCombination: string,
  gridPoints: GridPoint[],
  positions: (number | null)[],
  gridSize: number,
  radiusKm: number
): Promise<void> {
  const records = gridPoints.map((point, index) => ({
    project_id: projectId,
    keyword_combination: keywordCombination,
    grid_x: point.x,
    grid_y: point.y,
    latitude: point.latitude,
    longitude: point.longitude,
    position: positions[index],
    grid_size: gridSize,
    radius_km: radiusKm,
    search_location: `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`
  }))

  const { error } = await supabase
    .from('location_ranking_grid')
    .upsert(records, {
      onConflict: 'project_id,keyword_combination,grid_x,grid_y'
    })

  if (error) {
    throw error
  }
}

/**
 * Delete heat map data for a combination
 */
export async function deleteHeatMapData(projectId: string, keywordCombination: string): Promise<void> {
  const { error } = await supabase
    .from('location_ranking_grid')
    .delete()
    .eq('project_id', projectId)
    .eq('keyword_combination', keywordCombination)

  if (error) {
    throw error
  }
}

export interface GridDataPoint {
  grid_x: number
  grid_y: number
  latitude: number
  longitude: number
  position: number | null
  business_count: number | null
}

/**
 * Save heat map scan summary with weak locations and full grid data
 */
export async function saveHeatMapScan(input: {
  projectId: string
  keywordCombination: string
  gridSize: number
  radiusKm: number
  centerLat: number
  centerLng: number
  averagePosition: number
  rankedCount: number
  notRankedCount: number
  weakLocations: Array<{ name: string; position: number | null; lat: number; lng: number }>
  gridData?: GridDataPoint[]
}): Promise<void> {
  const { error } = await supabase
    .from('heat_map_scans')
    .insert({
      project_id: input.projectId,
      keyword_combination: input.keywordCombination,
      grid_size: input.gridSize,
      radius_km: input.radiusKm,
      center_lat: input.centerLat,
      center_lng: input.centerLng,
      average_position: input.averagePosition,
      ranked_count: input.rankedCount,
      not_ranked_count: input.notRankedCount,
      weak_locations: input.weakLocations,
      grid_data: input.gridData || null
    })

  if (error) {
    throw error
  }
}

/**
 * Get heat map scan history for a combination
 */
export async function getHeatMapScanHistory(projectId: string, keywordCombination: string) {
  const { data, error } = await supabase
    .from('heat_map_scans')
    .select('*')
    .eq('project_id', projectId)
    .eq('keyword_combination', keywordCombination)
    .order('scanned_at', { ascending: false })

  if (error) {
    throw error
  }

  return data || []
}

/**
 * Get the most recent heat map scan for a combination
 */
export async function getLatestHeatMapScan(projectId: string, keywordCombination: string) {
  const { data, error } = await supabase
    .from('heat_map_scans')
    .select('*')
    .eq('project_id', projectId)
    .eq('keyword_combination', keywordCombination)
    .order('scanned_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw error
  }

  return data || null
}

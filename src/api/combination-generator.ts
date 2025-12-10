/**
 * Location-Keyword Combination Generator
 * 
 * This module generates all possible combinations of locations and keywords
 * for a project and stores them in the location_keywords table.
 */

import { supabase } from '@/lib/supabase'

interface GenerateCombinationsInput {
  project_id: string
}

interface CombinationResult {
  created_count: number
  total_count: number
}

/**
 * Generate all combinations of locations × selected keywords for a project
 * This will:
 * 1. Fetch all locations for the project
 * 2. Fetch all selected keywords from service_keywords (via project_services)
 * 3. Create combinations and store in location_keywords table
 */
export async function generateCombinations(input: GenerateCombinationsInput): Promise<CombinationResult> {
  const { project_id } = input

  // Fetch all locations for this project
  const { data: locations, error: locationsError } = await supabase
    .from('project_locations')
    .select('id, name, slug')
    .eq('project_id', project_id)

  if (locationsError) throw locationsError

  // Fetch all services for this project
  const { data: services, error: servicesError } = await supabase
    .from('project_services')
    .select('id')
    .eq('project_id', project_id)

  if (servicesError) throw servicesError

  if (!locations || locations.length === 0) {
    throw new Error('No locations found for this project')
  }

  if (!services || services.length === 0) {
    throw new Error('No services found for this project')
  }

  // Fetch all selected keywords from service_keywords
  const serviceIds = services.map(s => s.id)
  const { data: serviceKeywords, error: keywordsError } = await supabase
    .from('service_keywords')
    .select('id, keyword, service_id')
    .in('service_id', serviceIds)
    .eq('is_selected', true)

  if (keywordsError) throw keywordsError

  if (!serviceKeywords || serviceKeywords.length === 0) {
    throw new Error('No selected keywords found. Please select keywords in your services.')
  }

  // First, ensure all keywords exist in keyword_variations table (for FK constraint)
  const keywordsToInsert = serviceKeywords.map(sk => ({
    project_id,
    keyword: sk.keyword,
    search_volume: null,
    difficulty: null,
  }))

  const { data: insertedKeywords, error: kwInsertError } = await supabase
    .from('keyword_variations')
    .upsert(keywordsToInsert, {
      onConflict: 'project_id,keyword',
      ignoreDuplicates: false,
    })
    .select('id, keyword')

  if (kwInsertError) throw kwInsertError

  // Create keyword map for quick lookup
  const keywordIdMap = new Map<string, string>()
  insertedKeywords?.forEach((kw: any) => {
    keywordIdMap.set(kw.keyword, kw.id)
  })

  // Generate all combinations
  const combinations = []
  for (const location of locations) {
    for (const serviceKeyword of serviceKeywords) {
      const keywordId = keywordIdMap.get(serviceKeyword.keyword)
      if (!keywordId) continue

      // Create phrase variations based on keyword structure
      let phrase: string
      if (serviceKeyword.keyword.includes('near me')) {
        phrase = serviceKeyword.keyword.replace('near me', `near ${location.name}`)
      } else {
        phrase = `${serviceKeyword.keyword} in ${location.name}`
      }

      combinations.push({
        project_id,
        location_id: location.id,
        keyword_id: keywordId,
        service_id: serviceKeyword.service_id,
        phrase: phrase.toLowerCase(),
        status: 'pending',
      })
    }
  }

  if (combinations.length === 0) {
    return { created_count: 0, total_count: 0 }
  }

  // Insert combinations - use insert with ON CONFLICT DO NOTHING to handle duplicates gracefully
  // This avoids the 409 Conflict error when combinations already exist
  const { data, error } = await supabase
    .from('location_keywords')
    .upsert(combinations, {
      onConflict: 'project_id,location_id,keyword_id',
      ignoreDuplicates: true,
    })
    .select()

  if (error) {
    // If it's a unique constraint violation on phrase, try inserting one by one
    if (error.code === '23505') {
      let createdCount = 0
      for (const combo of combinations) {
        const { error: insertError } = await supabase
          .from('location_keywords')
          .insert(combo)
        if (!insertError) createdCount++
      }
      return { created_count: createdCount, total_count: combinations.length }
    }
    throw error
  }

  return {
    created_count: data?.length || 0,
    total_count: combinations.length,
  }
}

/**
 * Get statistics about combinations for a project
 */
export async function getCombinationStats(projectId: string) {
  const { data, error } = await supabase
    .from('location_keywords')
    .select('status', { count: 'exact' })
    .eq('project_id', projectId)

  if (error) throw error

  const stats = {
    total: 0,
    pending: 0,
    generated: 0,
    pushed: 0,
  }

  if (data) {
    stats.total = data.length
    stats.pending = data.filter(c => c.status === 'pending').length
    stats.generated = data.filter(c => c.status === 'generated').length
    stats.pushed = data.filter(c => c.status === 'pushed').length
  }

  return stats
}


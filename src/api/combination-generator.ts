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
 * Generate all combinations of locations × keywords for a project
 * This will:
 * 1. Fetch all locations for the project
 * 2. Fetch all keyword variations for the project
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

  // Fetch all keyword variations for this project
  const { data: keywords, error: keywordsError } = await supabase
    .from('keyword_variations')
    .select('id, keyword')
    .eq('project_id', project_id)

  if (keywordsError) throw keywordsError

  if (!locations || locations.length === 0) {
    throw new Error('No locations found for this project')
  }

  if (!keywords || keywords.length === 0) {
    throw new Error('No keyword variations found for this project')
  }

  // Generate all combinations
  const combinations = []
  for (const location of locations) {
    for (const keyword of keywords) {
      // Create phrase variations based on keyword structure
      let phrase: string

      if (keyword.keyword.includes('near me')) {
        // For "near me" keywords, use: "keyword near location"
        phrase = keyword.keyword.replace('near me', `near ${location.name}`)
      } else {
        // Standard format: "keyword in location"
        phrase = `${keyword.keyword} in ${location.name}`
      }

      combinations.push({
        project_id,
        location_id: location.id,
        keyword_id: keyword.id,
        phrase: phrase.toLowerCase(),
        status: 'pending',
      })
    }
  }

  // Insert combinations (using upsert with ignoreDuplicates to skip existing)
  // This is crucial for "Add More" functionality - only creates NEW unique combinations
  const { data, error } = await supabase
    .from('location_keywords')
    .upsert(combinations, {
      onConflict: 'project_id,location_id,keyword_id',
      ignoreDuplicates: true, // Skip duplicates - critical for Add More feature
    })
    .select()

  if (error) throw error

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


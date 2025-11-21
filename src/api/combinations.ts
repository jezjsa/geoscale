import { supabase } from '@/lib/supabase'
import { findNearbyTowns } from './google-places'
import { getKeywordVariations } from './dataforseo'
import { generateCombinations } from './combination-generator'

interface CreateCombinationsInput {
  base_location: string
  base_keyword: string
  radius_miles?: number // Default 30 miles if not provided
}

interface CreateCombinationsResponse {
  locations_count: number
  keywords_count: number
  combinations_count: number
}

export async function createLocationKeywordCombinations(
  projectId: string,
  input: CreateCombinationsInput
): Promise<CreateCombinationsResponse> {
  // First, update the project with base location and keyword
  const { error: updateError } = await supabase
    .from('projects')
    .update({
      base_location: input.base_location,
      base_keyword: input.base_keyword,
    })
    .eq('id', projectId)

  if (updateError) throw updateError

  // Stage 1: Call Google Places API to find nearby towns
  // Convert miles to kilometers (1 mile = 1.60934 km)
  const radiusKm = (input.radius_miles || 30) * 1.60934
  
  const locations = await findNearbyTowns({
    project_id: projectId,
    location: input.base_location,
    radius: radiusKm,
  })

  // Stage 2: Call DataForSEO API to get keyword variations
  const keywords = await getKeywordVariations({
    project_id: projectId,
    base_keyword: input.base_keyword,
    location: 'GB',
    limit: 50,
  })

  // Stage 3: Generate all combinations
  const combinations = await generateCombinations({
    project_id: projectId,
  })

  return {
    locations_count: locations.length,
    keywords_count: keywords.length,
    combinations_count: combinations.created_count,
  }
}

export async function getProjectCombinations(projectId: string) {
  const { data, error } = await supabase
    .from('location_keywords')
    .select(`
      id,
      phrase,
      status,
      wp_page_id,
      wp_page_url,
      position,
      previous_position,
      last_position_check,
      location:project_locations (
        id,
        name,
        slug
      ),
      keyword:keyword_variations (
        id,
        keyword,
        search_volume,
        difficulty
      ),
      created_at
    `)
    .eq('project_id', projectId)

  if (error) throw error
  
  // Normalize the data: Supabase returns location/keyword as arrays, but we need single objects
  const normalized = data?.map((item: any) => ({
    ...item,
    location: Array.isArray(item.location) ? item.location[0] : item.location,
    keyword: Array.isArray(item.keyword) ? item.keyword[0] : item.keyword,
  })) || []
  
  // Sort by location name (town) first, then by phrase alphabetically
  return normalized.sort((a, b) => {
    const locationA = a.location?.name || ''
    const locationB = b.location?.name || ''
    
    // First compare by location
    if (locationA < locationB) return -1
    if (locationA > locationB) return 1
    
    // If locations are the same, compare by phrase
    const phraseA = a.phrase || ''
    const phraseB = b.phrase || ''
    if (phraseA < phraseB) return -1
    if (phraseA > phraseB) return 1
    
    return 0
  })
}

export async function deleteLocationKeyword(id: string) {
  const { error } = await supabase
    .from('location_keywords')
    .delete()
    .eq('id', id)

  if (error) throw error
}

interface CsvUploadResponse {
  rows_processed: number
  combinations_count: number
  errors: string[]
}

export async function addSpecificCombinations(
  projectId: string,
  combinations: Array<{ location: string; keyword: string }>
): Promise<{ combinations_count: number }> {
  // Extract unique locations and keywords
  const uniqueLocations = new Set<string>()
  const uniqueKeywords = new Set<string>()

  combinations.forEach(combo => {
    uniqueLocations.add(combo.location)
    uniqueKeywords.add(combo.keyword)
  })

  // Insert locations
  const locationsToInsert = Array.from(uniqueLocations).map(location => ({
    project_id: projectId,
    place_id: `manual_${location.toLowerCase().replace(/\s+/g, '-')}`,
    name: location,
    slug: location.toLowerCase().replace(/\s+/g, '-'),
    lat: 0, // Manual entries don't have coordinates
    lng: 0,
    country: 'GB',
  }))

  const { data: insertedLocations, error: locError } = await supabase
    .from('project_locations')
    .upsert(locationsToInsert, {
      onConflict: 'project_id,place_id',
      ignoreDuplicates: false,
    })
    .select()

  if (locError) throw locError

  // Insert keywords
  const keywordsToInsert = Array.from(uniqueKeywords).map(keyword => ({
    project_id: projectId,
    keyword,
    search_volume: null,
    difficulty: null,
  }))

  const { data: insertedKeywords, error: kwError } = await supabase
    .from('keyword_variations')
    .upsert(keywordsToInsert, {
      onConflict: 'project_id,keyword',
      ignoreDuplicates: false,
    })
    .select()

  if (kwError) throw kwError

  // Create location-keyword map for quick lookup
  const locationIdMap = new Map<string, string>()
  insertedLocations?.forEach((loc: any) => {
    locationIdMap.set(loc.name, loc.id)
  })

  const keywordIdMap = new Map<string, string>()
  insertedKeywords?.forEach((kw: any) => {
    keywordIdMap.set(kw.keyword, kw.id)
  })

  // Generate combinations
  const combinationsToInsert = combinations.map(combo => {
    const locationId = locationIdMap.get(combo.location)
    const keywordId = keywordIdMap.get(combo.keyword)

    if (!locationId || !keywordId) {
      throw new Error(`Could not map location/keyword for: ${combo.location} / ${combo.keyword}`)
    }

    // Create phrase
    let phrase: string
    if (combo.keyword.includes('near me')) {
      phrase = combo.keyword.replace('near me', `near ${combo.location}`)
    } else {
      phrase = `${combo.keyword} in ${combo.location}`
    }

    return {
      project_id: projectId,
      location_id: locationId,
      keyword_id: keywordId,
      phrase: phrase.toLowerCase(),
      status: 'pending',
    }
  })

  // Insert combinations (database UNIQUE constraint will prevent duplicates)
  const { data: insertedCombos, error: comboError } = await supabase
    .from('location_keywords')
    .upsert(combinationsToInsert, {
      onConflict: 'project_id,location_id,keyword_id',
      ignoreDuplicates: true, // Skip duplicates, don't throw error
    })
    .select()

  if (comboError) throw comboError

  return {
    combinations_count: insertedCombos?.length || 0,
  }
}

export async function uploadCsvCombinations(
  projectId: string,
  file: File
): Promise<CsvUploadResponse> {
  // Read the CSV file
  const text = await file.text()
  const lines = text.split('\n').filter(line => line.trim())
  
  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows')
  }

  // Parse header
  const header = lines[0].toLowerCase().split(',').map(h => h.trim())
  const locationIndex = header.indexOf('location')
  const keywordIndex = header.indexOf('keyword')
  const volumeIndex = header.indexOf('search_volume')
  const difficultyIndex = header.indexOf('difficulty')

  if (locationIndex === -1 || keywordIndex === -1) {
    throw new Error('CSV must have "location" and "keyword" columns')
  }

  const errors: string[] = []
  const locationsMap = new Map<string, any>()
  const keywordsMap = new Map<string, any>()

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const columns = line.split(',').map(c => c.trim())
    const location = columns[locationIndex]
    const keyword = columns[keywordIndex]
    const volume = volumeIndex !== -1 ? parseInt(columns[volumeIndex]) : null
    const difficulty = difficultyIndex !== -1 ? parseFloat(columns[difficultyIndex]) : null

    if (!location || !keyword) {
      errors.push(`Row ${i + 1}: Missing location or keyword`)
      continue
    }

    // Store unique locations
    if (!locationsMap.has(location)) {
      locationsMap.set(location, {
        name: location,
        slug: location.toLowerCase().replace(/\s+/g, '-'),
        // We don't have lat/lng from CSV, use 0,0 as placeholder
        // These can be geocoded later if needed
        lat: 0,
        lng: 0,
        country: 'GB',
      })
    }

    // Store unique keywords
    if (!keywordsMap.has(keyword)) {
      keywordsMap.set(keyword, {
        keyword,
        search_volume: volume,
        difficulty,
      })
    }
  }

  // Insert locations
  const locationsToInsert = Array.from(locationsMap.values()).map(loc => ({
    project_id: projectId,
    place_id: `csv_${loc.slug}`,
    ...loc,
  }))

  const { data: insertedLocations, error: locError } = await supabase
    .from('project_locations')
    .upsert(locationsToInsert, {
      onConflict: 'project_id,place_id',
      ignoreDuplicates: false,
    })
    .select()

  if (locError) throw locError

  // Insert keywords
  const keywordsToInsert = Array.from(keywordsMap.values()).map(kw => ({
    project_id: projectId,
    ...kw,
  }))

  const { data: insertedKeywords, error: kwError } = await supabase
    .from('keyword_variations')
    .upsert(keywordsToInsert, {
      onConflict: 'project_id,keyword',
      ignoreDuplicates: false,
    })
    .select()

  if (kwError) throw kwError

  // Create location-keyword map for quick lookup
  const locationIdMap = new Map<string, string>()
  insertedLocations?.forEach((loc: any) => {
    locationIdMap.set(loc.name, loc.id)
  })

  const keywordIdMap = new Map<string, string>()
  insertedKeywords?.forEach((kw: any) => {
    keywordIdMap.set(kw.keyword, kw.id)
  })

  // Generate combinations from CSV rows
  const combinations = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const columns = line.split(',').map(c => c.trim())
    const location = columns[locationIndex]
    const keyword = columns[keywordIndex]

    if (!location || !keyword) continue

    const locationId = locationIdMap.get(location)
    const keywordId = keywordIdMap.get(keyword)

    if (!locationId || !keywordId) {
      errors.push(`Row ${i + 1}: Could not map location/keyword to database IDs`)
      continue
    }

    // Create phrase
    let phrase: string
    if (keyword.includes('near me')) {
      phrase = keyword.replace('near me', `near ${location}`)
    } else {
      phrase = `${keyword} in ${location}`
    }

    combinations.push({
      project_id: projectId,
      location_id: locationId,
      keyword_id: keywordId,
      phrase: phrase.toLowerCase(),
      status: 'pending',
    })
  }

  // Insert combinations
  const { data: insertedCombos, error: comboError } = await supabase
    .from('location_keywords')
    .upsert(combinations, {
      onConflict: 'project_id,location_id,keyword_id',
      ignoreDuplicates: true,
    })
    .select()

  if (comboError) throw comboError

  return {
    rows_processed: lines.length - 1,
    combinations_count: insertedCombos?.length || 0,
    errors,
  }
}


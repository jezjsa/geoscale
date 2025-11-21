/**
 * Google Places API Integration (NEW VERSION)
 * 
 * This module integrates with Google Places API (New) - the next generation API
 * with access to more than 200 million places.
 * 
 * Flow:
 * 1. Use Text Search to find the base location and get coordinates
 * 2. Use Nearby Search to find towns within a set radius
 * 3. Filter results to only show towns, cities, postal towns, or localities
 * 
 * API Documentation:
 * - Places API (New): https://developers.google.com/maps/documentation/places/web-service/op-overview
 * - Text Search: https://developers.google.com/maps/documentation/places/web-service/text-search
 * - Nearby Search: https://developers.google.com/maps/documentation/places/web-service/nearby-search
 * 
 * Note: This uses the NEW Places API (not the legacy version)
 * 
 * Supabase Secret needed:
 * - GOOGLE_PLACES_API_KEY
 */

import { supabase } from '@/lib/supabase'

interface NearbyTownsInput {
  project_id: string
  location: string
  radius?: number // in kilometers, default 50km
}

interface LocationResult {
  place_id: string
  name: string
  lat: number
  lng: number
  region?: string
  country: string
}

/**
 * Find nearby towns using Google Places API
 * This will:
 * 1. Geocode the base location to get lat/lng
 * 2. Search for nearby places of type 'locality'
 * 3. Filter and store results in project_locations table
 */
export async function findNearbyTowns(input: NearbyTownsInput): Promise<LocationResult[]> {
  console.log('🗺️ Finding nearby towns for:', input.location, 'within', input.radius, 'km')

  // Get the current session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('No active session')
  }

  // Call the Edge Function (which has access to GOOGLE_PLACES_API_KEY secret)
  const { data, error } = await supabase.functions.invoke('find-nearby-towns', {
    body: {
      project_id: input.project_id,
      location: input.location,
      radius: input.radius,
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (error) {
    throw error
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to find nearby towns')
  }

  console.log(`✅ Found ${data.locations_count} towns (${data.new_locations_count} new)`)

  return data.towns
}

/**
 * IMPLEMENTATION NOTES FOR GOOGLE PLACES API (NEW):
 * 
 * The new API uses REST endpoints with JSON request bodies (not URL params)
 * Base URL: https://places.googleapis.com/v1/
 * 
 * Step 1: Text Search to geocode the base location
 * ```typescript
 * const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'X-Goog-Api-Key': apiKey,
 *     'X-Goog-FieldMask': 'places.id,places.displayName,places.location'
 *   },
 *   body: JSON.stringify({
 *     textQuery: location,
 *     locationBias: {
 *       circle: {
 *         center: { latitude: 54.0, longitude: -2.0 }, // UK center
 *         radius: 500000.0 // 500km
 *       }
 *     }
 *   })
 * })
 * const { places } = await response.json()
 * const { latitude, longitude } = places[0].location
 * ```
 * 
 * Step 2: Nearby Search to find towns
 * ```typescript
 * const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'X-Goog-Api-Key': apiKey,
 *     'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.types,places.addressComponents'
 *   },
 *   body: JSON.stringify({
 *     locationRestriction: {
 *       circle: {
 *         center: { latitude, longitude },
 *         radius: radius * 1000 // convert km to meters
 *       }
 *     },
 *     includedTypes: ['locality', 'postal_town'],
 *     maxResultCount: 20
 *   })
 * })
 * ```
 * 
 * Step 3: Extract place data
 * ```typescript
 * const towns = places.map(place => ({
 *   place_id: place.id,
 *   name: place.displayName.text,
 *   lat: place.location.latitude,
 *   lng: place.location.longitude,
 *   region: extractRegion(place.addressComponents),
 *   country: extractCountry(place.addressComponents)
 * }))
 * ```
 * 
 * Key differences from old API:
 * - Uses POST with JSON body (not GET with URL params)
 * - Requires X-Goog-Api-Key header (not ?key= param)
 * - Requires X-Goog-FieldMask header to specify which fields to return
 * - Place IDs are in new format (not the old ChIJ format)
 * - Better filtering with includedTypes and excludedTypes
 */


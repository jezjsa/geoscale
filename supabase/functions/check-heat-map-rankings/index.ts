// @ts-nocheck - Deno types not available in this environment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
}

interface HeatMapRequest {
  project_id: string
  combination_id: string
  keyword_combination: string
  grid_size: number
  radius_km: number
  centerLat: number
  centerLng: number
  include_business_count?: boolean
}

interface GridPoint {
  latitude: number
  longitude: number
  gridX: number
  gridY: number
}

function generateGrid(centerLat: number, centerLng: number, gridSize: number, radiusKm: number): GridPoint[] {
  const points: GridPoint[] = []
  
  // Earth's circumference in kilometers
  const earthCircumference = 40075 // km
  
  // Convert radius to degrees (approximate)
  const latDelta = (radiusKm * 2) / 111.32 // 1 degree latitude ≈ 111.32 km
  const lngDelta = (radiusKm * 2) / (111.32 * Math.cos(centerLat * Math.PI / 180))
  
  // Calculate step size for the grid
  const latStep = latDelta / (gridSize - 1)
  const lngStep = lngDelta / (gridSize - 1)
  
  // Generate grid points
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const latitude = centerLat - (radiusKm / 111.32) + (y * latStep)
      const longitude = centerLng - (radiusKm / (111.32 * Math.cos(centerLat * Math.PI / 180))) + (x * lngStep)
      
      points.push({
        latitude,
        longitude,
        gridX: x,
        gridY: y
      })
    }
  }
  
  return points
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
      status: 200 // Explicitly return 200 OK for preflight
    })
  }

  try {
    const { project_id, combination_id, keyword_combination, grid_size, radius_km, centerLat, centerLng, include_business_count = true }: HeatMapRequest = await req.json()
    
    console.log('🔥 Edge Function called with:', {
      project_id,
      combination_id,
      keyword_combination,
      grid_size,
      radius_km,
      centerLat,
      centerLng
    })

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header required')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !authUser) {
      throw new Error('Invalid authentication')
    }

    // Get user record from users table
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, plan_id')
      .eq('supabase_auth_user_id', authUser.id)
      .single()

    if (userError || !user) {
      throw new Error('User not found')
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('name, rank_map_checks_per_month')
      .eq('id', user.plan_id)
      .single()

    if (planError || !plan) {
      throw new Error('Plan not found')
    }

    console.log(`👤 User plan: ${plan.name}, rank_map_checks_per_month: ${plan.rank_map_checks_per_month}`)

    // Check if plan allows rank map checks
    if (plan.rank_map_checks_per_month === 0 || plan.rank_map_checks_per_month === null) {
      throw new Error('Rank map checks are not available on your plan. Please upgrade to Pro or Agency.')
    }

    // Get or create user_credits record
    let { data: credits, error: creditsError } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (creditsError && creditsError.code === 'PGRST116') {
      // No record exists, create one
      const nextMonth = new Date()
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      nextMonth.setDate(1)
      nextMonth.setHours(0, 0, 0, 0)

      const { data: newCredits, error: insertError } = await supabase
        .from('user_credits')
        .insert({
          user_id: user.id,
          rank_map_checks_used: 0,
          rank_map_checks_purchased: 0,
          usage_reset_date: nextMonth.toISOString()
        })
        .select()
        .single()

      if (insertError) {
        console.error('Failed to create user_credits:', insertError)
        throw new Error('Failed to initialize usage tracking')
      }
      credits = newCredits
    } else if (creditsError) {
      throw new Error('Failed to check usage limits')
    }

    // Check if usage needs to be reset (new month)
    const now = new Date()
    const resetDate = new Date(credits.usage_reset_date)
    
    if (now >= resetDate) {
      // Reset monthly usage
      const nextMonth = new Date()
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      nextMonth.setDate(1)
      nextMonth.setHours(0, 0, 0, 0)

      const { error: resetError } = await supabase
        .from('user_credits')
        .update({
          rank_map_checks_used: 0,
          usage_reset_date: nextMonth.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

      if (resetError) {
        console.error('Failed to reset usage:', resetError)
      } else {
        credits.rank_map_checks_used = 0
        credits.usage_reset_date = nextMonth.toISOString()
      }
    }

    // Calculate credits needed based on grid size (25 pins = 1 credit)
    const totalPins = grid_size * grid_size
    const creditsNeeded = Math.ceil(totalPins / 25)
    
    // Calculate remaining checks
    const totalAllowed = plan.rank_map_checks_per_month + (credits.rank_map_checks_purchased || 0)
    const remaining = totalAllowed - (credits.rank_map_checks_used || 0)

    console.log(`📊 Usage: ${credits.rank_map_checks_used}/${plan.rank_map_checks_per_month} plan + ${credits.rank_map_checks_purchased || 0} purchased = ${remaining} remaining`)
    console.log(`📍 Grid ${grid_size}x${grid_size} = ${totalPins} pins = ${creditsNeeded} credits needed`)

    if (remaining < creditsNeeded) {
      throw new Error(`This scan requires ${creditsNeeded} credits (${grid_size}x${grid_size} = ${totalPins} pins), but you only have ${remaining} remaining. Choose a smaller grid size or purchase additional credits.`)
    }

    // Get DataForSEO credentials from environment
    const dataforseoLogin = Deno.env.get('DATAFORSEO_LOGIN')
    const dataforseoPassword = Deno.env.get('DATAFORSEO_PASSWORD')

    console.log('🔑 DataForSEO credentials:', {
      hasLogin: !!dataforseoLogin,
      hasPassword: !!dataforseoPassword
    })

    if (!dataforseoLogin || !dataforseoPassword) {
      throw new Error('DataForSEO credentials not configured')
    }

    // Generate grid points internally
    const grid_points = generateGrid(centerLat, centerLng, grid_size, radius_km)
    console.log(`📍 Generated ${grid_points.length} grid points`)

    // Get project details to extract domain URLs
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('project_name, company_name, base_location, latitude, longitude, blog_url, wp_url')
      .eq('id', project_id)
      .single()

    if (projectError || !project) {
      throw new Error('Project not found')
    }

    // Extract domains from both wp_url (WordPress URL) and blog_url (website URL)
    // We check both as they can be different (e.g., 55digital.net and blog.55digital.net)
    const targetDomains: string[] = []
    
    // Helper function to extract domain from URL
    const extractDomain = (urlString: string): string | null => {
      if (!urlString) return null
      try {
        const url = new URL(urlString)
        return url.hostname.replace('www.', '').toLowerCase()
      } catch {
        return urlString.replace(/^https?:\/\//, '').replace('www.', '').split('/')[0].toLowerCase()
      }
    }
    
    // Add domain from wp_url if set
    if (project.wp_url) {
      const domain = extractDomain(project.wp_url)
      if (domain && !targetDomains.includes(domain)) {
        targetDomains.push(domain)
      }
    }
    
    // Add domain from blog_url if set
    if (project.blog_url) {
      const domain = extractDomain(project.blog_url)
      if (domain && !targetDomains.includes(domain)) {
        targetDomains.push(domain)
      }
    }

    console.log(`🔍 Checking Google Maps rankings for "${keyword_combination}" across ${grid_points.length} points`)
    console.log(`🌐 Target domains: ${targetDomains.length > 0 ? targetDomains.join(', ') : 'none set'}`)

    // Prepare DataForSEO authentication using Deno's btoa
    const auth = btoa(`${dataforseoLogin}:${dataforseoPassword}`)
    
    const positions: (number | null)[] = new Array(grid_points.length).fill(null)
    const businessCounts: (number | null)[] = new Array(grid_points.length).fill(null)
    let rankedCount = 0
    let notRankedCount = 0
    
    // Get Google Places API key (New API)
    const googlePlacesApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')

    // Process grid points ONE AT A TIME (Google Maps API doesn't support batching)
    for (let i = 0; i < grid_points.length; i++) {
      const point = grid_points[i]
      
      // Create single task for DataForSEO Google Maps
      const task = [{
        keyword: keyword_combination,
        location_coordinate: `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)},15z`,
        language_code: "en",
        depth: 20
      }]

      // Make API request to DataForSEO Google Maps endpoint
      const apiResponse = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(task)
      })

      if (!apiResponse.ok) {
        console.error(`DataForSEO API error: ${apiResponse.status} ${apiResponse.statusText}`)
        positions[i] = null
        notRankedCount++
        continue
      }

      const apiData = await apiResponse.json()
      
      // Log the raw response structure for debugging (first request only)
      if (i === 0) {
        console.log('📊 Raw API response structure:', JSON.stringify(apiData.tasks?.[0]?.result?.[0]?.items?.slice(0, 3), null, 2))
      }
      
      const taskResult = apiData.tasks?.[0]
      
      if (taskResult?.status_code === 20000 && taskResult?.result?.[0]?.items) {
        // Find the business in Google Maps results - DOMAIN MATCH ONLY
        // This is the most reliable method as business names can have false positives
        let position = 1
        
        const matchingResult = taskResult.result[0].items.find((item: any) => {
          if (!item.title) {
            position++
            return false
          }
          
          // Only match by domain - check against all target domains (wp_url and blog_url)
          if (targetDomains.length > 0 && item.domain) {
            const itemDomain = item.domain.replace('www.', '').toLowerCase()
            
            // Check if item domain matches any of our target domains
            const domainMatches = targetDomains.some(targetDomain => {
              // Exact match
              if (itemDomain === targetDomain) return true
              // Subdomain match (e.g., blog.55digital.net matches 55digital.net)
              if (itemDomain.endsWith('.' + targetDomain)) return true
              // Reverse subdomain match (e.g., 55digital.net matches blog.55digital.net)
              if (targetDomain.endsWith('.' + itemDomain)) return true
              return false
            })
            
            if (domainMatches) {
              return true
            }
          }
          
          position++
          return false
        })
        
        if (matchingResult) {
          positions[i] = matchingResult.rank_group || matchingResult.rank_absolute || position
          rankedCount++
          console.log(`✓ Point ${i}: Found at position ${positions[i]} - "${matchingResult.title}"`)
        } else {
          positions[i] = null
          notRankedCount++
          // Log first few results to help debug (first point only)
          if (i === 0) {
            console.log(`📋 Sample results for point 0 (looking for "${businessName}"):`)
            taskResult.result[0].items.slice(0, 10).forEach((item: any, idx: number) => {
              console.log(`  ${idx + 1}. "${item.title}" (type: ${item.type}, domain: ${item.domain || 'none'})`)
            })
          }
        }
      } else {
        console.error(`Point ${i} failed:`, taskResult?.status_message || 'Unknown error')
        positions[i] = null
        notRankedCount++
      }

      // Fetch business count using Google Places API (New) if enabled
      if (include_business_count && googlePlacesApiKey) {
        try {
          // Use Google Places API (New) Nearby Search to count businesses
          // Search for business-related place types within a radius based on grid spacing
          const searchRadius = Math.min(Math.round((radius_km * 1000) / grid_size), 50000) // meters per grid cell, max 50km
          
          const placesResponse = await fetch(
            'https://places.googleapis.com/v1/places:searchNearby',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': googlePlacesApiKey,
                'X-Goog-FieldMask': 'places.id'
              },
              body: JSON.stringify({
                locationRestriction: {
                  circle: {
                    center: { latitude: point.latitude, longitude: point.longitude },
                    radius: searchRadius
                  }
                },
                // Use business-related types instead of 'establishment' which isn't valid
                includedTypes: ['store', 'restaurant', 'cafe', 'bar', 'bank', 'gym', 'hair_care', 'beauty_salon', 'spa', 'dentist', 'doctor', 'pharmacy', 'veterinary_care', 'car_repair', 'car_dealer', 'real_estate_agency', 'insurance_agency', 'lawyer', 'accounting', 'lodging'],
                maxResultCount: 20
              })
            }
          )
          
          if (placesResponse.ok) {
            const placesData = await placesResponse.json()
            // Count the number of businesses returned (max 20 per request)
            businessCounts[i] = placesData.places?.length || 0
            if (i === 0) {
              console.log(`🏢 Business count at point 0: ${businessCounts[i]} (radius: ${searchRadius}m)`)
            }
          } else {
            const errorText = await placesResponse.text()
            console.error(`Places API error for point ${i}: ${placesResponse.status} - ${errorText}`)
            businessCounts[i] = null
          }
        } catch (placesError) {
          console.error(`Failed to get business count for point ${i}:`, placesError)
          businessCounts[i] = null
        }
      }

      // Small delay between requests to respect rate limits (reduced for speed)
      if (i < grid_points.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    // Calculate average position (only counting ranked positions)
    const rankedPositions = positions.filter(p => p !== null) as number[]
    const averagePosition = rankedPositions.length > 0 
      ? Math.round(rankedPositions.reduce((sum, pos) => sum + pos, 0) / rankedPositions.length)
      : 0

    // Save results to database
    const records = grid_points.map((point, index) => ({
      project_id,
      location_keyword_id: combination_id,
      keyword_combination,
      grid_x: point.gridX,
      grid_y: point.gridY,
      latitude: point.latitude,
      longitude: point.longitude,
      position: positions[index],
      business_count: businessCounts[index],
      search_location: `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`,
      grid_size,
      radius_km: radius_km
    }))

    const { error: insertError } = await supabase
      .from('location_ranking_grid')
      .upsert(records, {
        onConflict: 'project_id,keyword_combination,grid_x,grid_y'
      })

    if (insertError) {
      console.error('Failed to save heat map data:', insertError)
      throw new Error('Failed to save heat map data')
    }

    // Increment usage count after successful check (deduct credits based on grid size)
    const { error: usageError } = await supabase
      .from('user_credits')
      .update({
        rank_map_checks_used: (credits.rank_map_checks_used || 0) + creditsNeeded,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)

    if (usageError) {
      console.error('Failed to update usage count:', usageError)
      // Don't throw - the check was successful, just log the error
    }

    const newRemaining = remaining - creditsNeeded
    console.log(`✅ Heat map complete: ${rankedCount} ranked, ${notRankedCount} not ranked`)
    console.log(`📊 Usage updated: deducted ${creditsNeeded} credits, ${newRemaining} remaining`)

    return new Response(
      JSON.stringify({
        success: true,
        positions,
        business_counts: businessCounts,
        average_position: averagePosition,
        ranked_count: rankedCount,
        not_ranked_count: notRankedCount,
        total_points: grid_points.length,
        remaining_checks: newRemaining,
        credits_used: creditsNeeded
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Heat map generation error:', error)
    console.error('Error details:', error.message, error.stack)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error.stack || 'No stack trace available'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

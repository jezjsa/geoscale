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
    const { project_id, combination_id, keyword_combination, grid_size, radius_km, centerLat, centerLng }: HeatMapRequest = await req.json()
    
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

    // Get project details to extract business name and other info
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('project_name, company_name, base_location, latitude, longitude, blog_url')
      .eq('id', project_id)
      .single()

    if (projectError || !project) {
      throw new Error('Project not found')
    }

    // For Google Maps matching, we use the company_name field (falls back to project_name)
    // Normalize the name for fuzzy matching
    const businessName = (project.company_name || project.project_name).toLowerCase().trim()
    
    // Also extract domain from blog_url as a fallback
    let targetDomain = ''
    if (project.blog_url) {
      try {
        const url = new URL(project.blog_url)
        targetDomain = url.hostname.replace('www.', '')
      } catch {
        targetDomain = project.blog_url.replace(/^https?:\/\//, '').replace('www.', '').split('/')[0]
      }
    }

    console.log(`🔍 Checking Google Maps rankings for "${keyword_combination}" across ${grid_points.length} points`)
    console.log(`🏢 Business name: ${businessName}`)
    console.log(`🌐 Target domain: ${targetDomain || 'not set'}`)

    // Prepare DataForSEO authentication using Deno's btoa
    const auth = btoa(`${dataforseoLogin}:${dataforseoPassword}`)
    
    const positions: (number | null)[] = new Array(grid_points.length).fill(null)
    let rankedCount = 0
    let notRankedCount = 0

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
        // Find the business in Google Maps results
        let position = 1
        const matchingResult = taskResult.result[0].items.find((item: any) => {
          if (!item.title) {
            position++
            return false
          }
          
          const itemTitle = (item.title || '').toLowerCase().trim()
          
          // Primary match: Business name contains our project name or vice versa
          if (itemTitle.includes(businessName) || businessName.includes(itemTitle)) {
            return true
          }
          
          // Try partial word matching (e.g., "dolphin" matches "Dolphin ICT Ltd")
          const businessWords = businessName.split(/\s+/).filter((w: string) => w.length > 2)
          const titleWords = itemTitle.split(/\s+/).filter((w: string) => w.length > 2)
          const matchingWords = businessWords.filter((bw: string) => titleWords.some((tw: string) => tw.includes(bw) || bw.includes(tw)))
          if (matchingWords.length >= 1) {
            return true
          }
          
          // Secondary match: Check domain if available
          if (targetDomain && item.domain) {
            const itemDomain = item.domain.replace('www.', '')
            if (itemDomain.includes(targetDomain) || targetDomain.includes(itemDomain)) {
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

    console.log(`✅ Heat map complete: ${rankedCount} ranked, ${notRankedCount} not ranked`)

    return new Response(
      JSON.stringify({
        success: true,
        positions,
        average_position: averagePosition,
        ranked_count: rankedCount,
        not_ranked_count: notRankedCount,
        total_points: grid_points.length
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

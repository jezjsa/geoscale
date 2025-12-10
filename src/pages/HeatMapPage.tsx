import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Navigation } from '@/components/Navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, MapPin, Loader2, Play, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getProject } from '@/api/projects'
import { generateGrid, GRID_PRESETS, GridPreset, GridPoint } from '@/utils/grid-generator'
import { checkHeatMapRankings, saveHeatMapScan, getLatestHeatMapScan, getHeatMapScanHistory } from '@/api/heat-map'
import { createLocationKeywordCombinations } from '@/api/combinations'
import { toast } from 'sonner'
import { GoogleMap, useJsApiLoader, Circle, Marker, OverlayView } from '@react-google-maps/api'

// Google Maps configuration
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

const mapContainerStyle = {
  width: '100%',
  height: '700px',
  borderRadius: '8px'
}

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: true,
  fullscreenControl: true,
  clickableIcons: false,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    }
  ]
}

// Custom map container style with pointer cursor
const mapContainerStyleWithCursor = {
  ...mapContainerStyle,
  cursor: 'pointer'
}

// Get color for position (returns hex color for Google Maps)
const getPositionHexColor = (position: number | null): string => {
  if (position === null) return '#9CA3AF' // gray-400
  if (position <= 3) return '#22C55E'     // green-500
  if (position <= 6) return '#FB923C'     // orange-400
  if (position <= 10) return '#F97316'    // orange-500
  if (position <= 20) return '#F87171'    // red-400
  return '#DC2626'                         // red-600
}

interface HeatMapPageState {
  phrase: string
  location: string
  keyword: string
}

interface GridData {
  points: GridPoint[]
  positions: (number | null)[]
  averagePosition: number
  isGenerating: boolean
}

interface WeakLocation {
  name: string
  position: number | null
  lat: number
  lng: number
}

export function HeatMapPage() {
  const { projectId, combinationId } = useParams<{ projectId: string; combinationId: string }>()
  const navigate = useNavigate()
  const location = useLocation() as { state: HeatMapPageState }
  const { user } = useAuth()
  
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Google Maps loader
  const { isLoaded: mapsLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY
  })
  
  // Heat map controls
  const [gridSize, setGridSize] = useState(5)
  const [radiusKm, setRadiusKm] = useState(5)
  const [gridPreset, setGridPreset] = useState<GridPreset>('quick')
  const [gridData, setGridData] = useState<GridData>({
    points: [],
    positions: [],
    averagePosition: 0,
    isGenerating: false
  })
  const [weakLocations, setWeakLocations] = useState<WeakLocation[]>([])
  const [loadingLocations, setLoadingLocations] = useState(false)
  const [progress, setProgress] = useState(0)
  const [lastScanDate, setLastScanDate] = useState<string | null>(null)
  const [scanHistory, setScanHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [creatingCombinations, setCreatingCombinations] = useState(false)
  const [combinationsCreated, setCombinationsCreated] = useState<number | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const [pulseOpacity, setPulseOpacity] = useState(0.5)

  // Pulse animation for loading circles
  useEffect(() => {
    if (!gridData.isGenerating) return

    const interval = setInterval(() => {
      setPulseOpacity(prev => {
        const next = prev + 0.05
        return next > 0.8 ? 0.2 : next
      })
    }, 50)

    return () => clearInterval(interval)
  }, [gridData.isGenerating])

  // Load project data and latest scan
  useEffect(() => {
    async function loadProject() {
      if (!projectId || !user?.id) return
      
      try {
        const data = await getProject(projectId)
        setProject(data)

        // Load latest scan if we have a keyword combination
        if (location.state?.phrase) {
          const latestScan = await getLatestHeatMapScan(projectId, location.state.phrase)
          if (latestScan) {
            setLastScanDate(latestScan.scanned_at)
            setWeakLocations(latestScan.weak_locations || [])
            
            // Load scan history
            const history = await getHeatMapScanHistory(projectId, location.state.phrase)
            setScanHistory(history)
          }
        }
      } catch (error) {
        console.error('Failed to load project:', error)
        toast.error('Failed to load project')
      } finally {
        setLoading(false)
      }
    }

    loadProject()
  }, [projectId, user, location.state?.phrase])

  // Generate grid when settings change
  useEffect(() => {
    if (project?.latitude && project?.longitude) {
      const points = generateGrid({
        centerLat: project.latitude,
        centerLng: project.longitude,
        gridSize,
        radiusKm
      })
      
      // Reset all grid data when settings change
      setGridData({
        points,
        positions: new Array(points.length).fill(null),
        averagePosition: 0,
        isGenerating: false
      })
    } else {
      // Clear grid data if no coordinates available
      setGridData({
        points: [],
        positions: [],
        averagePosition: 0,
        isGenerating: false
      })
    }
  }, [project, gridSize, radiusKm])

  // Fetch weak locations using reverse geocoding and return them
  const fetchWeakLocationsAndReturn = async (positions: (number | null)[]): Promise<WeakLocation[]> => {
    if (!mapsLoaded || !GOOGLE_MAPS_API_KEY) return []
    
    setLoadingLocations(true)
    const geocoder = new google.maps.Geocoder()
    const weak: WeakLocation[] = []
    
    // Find points with position 4+ or not ranked
    for (let i = 0; i < positions.length; i++) {
      const position = positions[i]
      if (position === null || position >= 4) {
        const point = gridData.points[i]
        
        try {
          const result = await geocoder.geocode({
            location: { lat: point.latitude, lng: point.longitude }
          })
          
          if (result.results[0]) {
            // Extract town/locality name
            const addressComponents = result.results[0].address_components
            const locality = addressComponents.find(c => 
              c.types.includes('locality') || c.types.includes('postal_town')
            )
            
            if (locality) {
              weak.push({
                name: locality.long_name,
                position,
                lat: point.latitude,
                lng: point.longitude
              })
            }
          }
        } catch (error) {
          console.error('Geocoding error:', error)
        }
      }
    }
    
    // Remove duplicates by name
    const uniqueWeak = weak.filter((loc, index, self) => 
      index === self.findIndex(l => l.name === loc.name)
    )
    
    setWeakLocations(uniqueWeak)
    setLoadingLocations(false)
    return uniqueWeak
  }

  // Handle preset selection
  const handlePresetChange = (preset: GridPreset) => {
    setGridPreset(preset)
    const config = GRID_PRESETS[preset]
    setGridSize(config.gridSize)
    setRadiusKm(config.radiusKm)
  }

  // Handle creating combinations from weak locations
  const handleCreateCombinations = async () => {
    if (!project || !weakLocations.length) return

    setCreatingCombinations(true)
    setCombinationsCreated(null)

    try {
      // Create combinations for each weak location
      let totalCreated = 0
      
      for (const location of weakLocations) {
        const result = await createLocationKeywordCombinations(projectId!, {
          base_location: location.name,
          base_keyword: project.base_keyword || '',
          radius_miles: 5 // Small radius for specific towns
        })
        totalCreated += result.combinations_count
      }

      setCombinationsCreated(totalCreated)
      toast.success(`${totalCreated} combinations created successfully!`)
    } catch (error) {
      console.error('Failed to create combinations:', error)
      toast.error('Failed to create combinations')
    } finally {
      setCreatingCombinations(false)
    }
  }

  // Handle map zoom change to update radius
  const handleZoomChanged = () => {
    const map = mapRef.current
    if (!map) return
    
    const zoom = map.getZoom()
    if (!zoom) return

    // Convert zoom level to approximate radius in km
    // Match our preset radius values: 5, 10, 15, 25
    let newRadius: number
    if (zoom >= 12) {
      newRadius = 5
    } else if (zoom >= 11) {
      newRadius = 10
    } else if (zoom >= 10) {
      newRadius = 15
    } else {
      newRadius = 25
    }

    // Only update if different to avoid infinite loop
    if (newRadius !== radiusKm) {
      setRadiusKm(newRadius)
      
      // Check if this matches a preset and update accordingly
      const matchingPreset = Object.entries(GRID_PRESETS).find(
        ([_, config]) => config.radiusKm === newRadius && config.gridSize === gridSize
      )
      
      if (matchingPreset) {
        setGridPreset(matchingPreset[0] as GridPreset)
      }
    }
  }

  // Handle map click to add location to weak locations
  const handleMapClick = async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng || !mapsLoaded) return

    const lat = e.latLng.lat()
    const lng = e.latLng.lng()
    
    try {
      const geocoder = new google.maps.Geocoder()
      const result = await geocoder.geocode({
        location: { lat, lng }
      })
      
      if (result.results[0]) {
        const addressComponents = result.results[0].address_components
        const locality = addressComponents.find(c => 
          c.types.includes('locality') || c.types.includes('postal_town')
        )
        
        if (locality) {
          const locationName = locality.long_name
          
          // Check if already in list
          const exists = weakLocations.some(loc => loc.name === locationName)
          
          if (!exists) {
            setWeakLocations(prev => [...prev, {
              name: locationName,
              position: null,
              lat,
              lng
            }])
            toast.success(`Added ${locationName} to report`)
          } else {
            toast.info(`${locationName} is already in the report`)
          }
        } else {
          toast.error('Could not identify town name at this location')
        }
      }
    } catch (error) {
      console.error('Geocoding error:', error)
      toast.error('Failed to identify location')
    }
  }

  // Generate heat map data
  const handleGenerateHeatMap = async () => {
    if (!project || !location.state) return
    
    // Check if project has coordinates
    if (!project.latitude || !project.longitude) {
      toast.error('This project does not have geographic coordinates set. Please add a location to generate heat maps.')
      return
    }
    
    setGridData(prev => ({ ...prev, isGenerating: true }))
    setProgress(0)
    
    // Simulate progress based on estimated time (200ms per API call + delays)
    const totalCalls = gridSize * gridSize
    const estimatedTimePerCall = 250 // ms (200ms API + 50ms overhead)
    const totalEstimatedTime = totalCalls * estimatedTimePerCall
    
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return prev // Cap at 95% until actual completion
        return prev + (100 / (totalEstimatedTime / 100))
      })
    }, 100)
    
    try {
      const result = await checkHeatMapRankings({
        project_id: projectId!,
        combinationId: combinationId!,
        keyword_combination: location.state!.phrase,
        grid_size: gridSize,
        radius_km: radiusKm,
        centerLat: project.latitude,
        centerLng: project.longitude
      })
      
      clearInterval(progressInterval)
      setProgress(100)
      
      setGridData(prev => ({
        ...prev,
        positions: result.positions,
        averagePosition: result.averagePosition,
        isGenerating: false
      }))
      
      toast.success(`Heat map generated! Average position: #${result.averagePosition}`)
      
      // Find weak locations (positions 4+ or not ranked)
      const weakLocs = await fetchWeakLocationsAndReturn(result.positions)
      
      // Save scan to history
      try {
        await saveHeatMapScan({
          projectId: projectId!,
          keywordCombination: location.state!.phrase,
          gridSize,
          radiusKm,
          centerLat: project.latitude,
          centerLng: project.longitude,
          averagePosition: result.averagePosition,
          rankedCount: result.rankedCount,
          notRankedCount: result.notRankedCount,
          weakLocations: weakLocs
        })
        
        setLastScanDate(new Date().toISOString())
        
        // Refresh scan history
        const history = await getHeatMapScanHistory(projectId!, location.state!.phrase)
        setScanHistory(history)
      } catch (error) {
        console.error('Failed to save scan history:', error)
      }
      
      // Hide progress bar after a short delay
      setTimeout(() => setProgress(0), 1000)
    } catch (error) {
      clearInterval(progressInterval)
      setProgress(0)
      console.error('Failed to generate heat map:', error)
      toast.error('Failed to generate heat map data')
      setGridData(prev => ({ ...prev, isGenerating: false }))
    }
  }

  // Calculate API cost estimate
  const apiCallCount = gridSize * gridSize
  const estimatedCost = (apiCallCount * 0.05).toFixed(2) // £0.05 per call estimate

  // Get position color based on ranking
  const getPositionColor = (position: number | null) => {
    if (position === null) return 'bg-gray-400' // Not ranked / no data
    if (position <= 3) return 'bg-green-500'    // Top 3 - Page 1 top
    if (position <= 6) return 'bg-orange-400'   // 4-6 - Page 1 middle
    if (position <= 10) return 'bg-orange-500'  // 7-10 - Page 1 bottom
    if (position <= 20) return 'bg-red-400'     // Page 2
    return 'bg-red-600'                          // Page 3+
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  if (!project || !location.state) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8 pt-24">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Data not found</h1>
            <p className="text-muted-foreground mb-4">
              No heat map data available for this combination.
            </p>
            <Button onClick={() => navigate(`/projects/${projectId}`)}>
              Back to Project
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8 pt-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Ranking Heat Map</h1>
            <p className="text-muted-foreground">
              Analyzing rankings for "{location.state?.phrase}"
            </p>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/projects/${projectId}`)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Project
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Controls Panel */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Scan Controls
                </CardTitle>
                <CardDescription>
                  Configure the geographic scan area
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Keyword Info */}
                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <div className="font-medium text-sm mb-1">Search Term:</div>
                  <div className="font-bold">{location.state?.phrase}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Location: {location.state?.location}
                  </div>
                </div>

                {/* Preset Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quick Presets:</label>
                  <Select value={gridPreset} onValueChange={handlePresetChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quick">Quick (5x5, 5km)</SelectItem>
                      <SelectItem value="standard">Standard (7x7, 10km)</SelectItem>
                      <SelectItem value="detailed">Detailed (10x10, 15km)</SelectItem>
                      <SelectItem value="comprehensive">Comprehensive (15x15, 25km)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Grid Size Slider */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Number of Pins: {gridSize}x{gridSize} ({apiCallCount})
                  </label>
                  <Slider
                    value={[gridSize]}
                    onValueChange={(value) => setGridSize(value[0])}
                    min={3}
                    max={15}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Radius Slider */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Radius: {radiusKm}km
                  </label>
                  <Slider
                    value={[radiusKm]}
                    onValueChange={(value) => setRadiusKm(value[0])}
                    min={1}
                    max={50}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Cost Estimate */}
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <div className="text-sm font-medium text-orange-800 dark:text-orange-200">
                    Estimated Cost: £{estimatedCost}
                  </div>
                  <div className="text-xs text-orange-600 dark:text-orange-400">
                    {apiCallCount} API calls
                  </div>
                </div>

                {/* Generate Button */}
                <Button
                  onClick={handleGenerateHeatMap}
                  disabled={gridData.isGenerating || !project.latitude || !project.longitude}
                  className="w-full"
                >
                  {gridData.isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      {!project.latitude || !project.longitude ? 'Location Required' : 'Generate Heat Map'}
                    </>
                  )}
                </Button>

                {/* Progress Bar */}
                {progress > 0 && progress < 100 && (
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-center text-muted-foreground">
                      Checking {gridSize * gridSize} locations... {Math.round(progress)}%
                    </p>
                  </div>
                )}

                {/* Last Scan Info */}
                {lastScanDate && !gridData.isGenerating && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                      Last scanned
                    </div>
                    <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      {new Date(lastScanDate).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    {scanHistory.length > 1 && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs mt-1"
                        onClick={() => setShowHistory(!showHistory)}
                      >
                        View {scanHistory.length} scans
                      </Button>
                    )}
                  </div>
                )}

                {/* Results Summary */}
                {gridData.positions.some(p => p !== null) && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-sm font-medium text-green-800 dark:text-green-200">
                      Average Position: #{gridData.averagePosition}
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-400">
                      {gridData.positions.filter(p => p !== null).length} of {gridData.positions.length} points ranked
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Scan History */}
            {showHistory && scanHistory.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-lg">Scan History</CardTitle>
                  <CardDescription>Track ranking improvements over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {scanHistory.map((scan, index) => (
                      <div 
                        key={scan.id}
                        className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium">
                            {new Date(scan.scanned_at).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          {index === 0 && (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                              Latest
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Avg Position:</span>
                            <span className="ml-1 font-medium">#{scan.average_position}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Ranked:</span>
                            <span className="ml-1 font-medium">{scan.ranked_count}/{scan.ranked_count + scan.not_ranked_count}</span>
                          </div>
                        </div>
                        {scan.weak_locations && scan.weak_locations.length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {scan.weak_locations.length} weak location{scan.weak_locations.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Map Visualization */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Geographic Ranking Map</CardTitle>
                <CardDescription>
                  Visual representation of ranking positions across the target area
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Map Visualization */}
                <div className="relative rounded-lg overflow-hidden min-h-[600px]">
                  {!project.latitude || !project.longitude ? (
                    <div className="flex items-center justify-center h-96 bg-slate-100 dark:bg-slate-800">
                      <div className="text-center">
                        <MapPin className="h-12 w-12 mx-auto mb-4 text-orange-500" />
                        <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-200 mb-2">
                          Location Required
                        </h3>
                        <p className="text-muted-foreground mb-4">
                          This project needs geographic coordinates to generate heat maps.
                        </p>
                        <Button 
                          onClick={() => navigate(`/projects/${projectId}?view=settings`)}
                          variant="outline"
                        >
                          Add Location
                        </Button>
                      </div>
                    </div>
                  ) : !mapsLoaded ? (
                    <div className="flex items-center justify-center h-[600px] bg-slate-100 dark:bg-slate-800">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span className="ml-2">Loading map...</span>
                    </div>
                  ) : !GOOGLE_MAPS_API_KEY ? (
                    // Fallback to grid view if no API key
                    <div className="bg-slate-100 dark:bg-slate-800 p-4 min-h-[600px]">
                      {gridData.points.length > 0 ? (
                        <div 
                          className="grid gap-1 mx-auto"
                          style={{
                            gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                            maxWidth: '600px'
                          }}
                        >
                          {gridData.points.map((_, index) => {
                            const position = gridData.positions[index]
                            const hasData = position !== null
                            const isLoading = gridData.isGenerating
                            
                            return (
                              <div
                                key={index}
                                className={`aspect-square rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md ${
                                  getPositionColor(position)
                                } ${isLoading ? 'animate-pulse' : ''}`}
                                title={`Position: ${hasData ? `#${position}` : 'Not ranked'}`}
                              >
                                {isLoading ? '...' : (hasData ? position : 'NR')}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-96 text-muted-foreground">
                          <div className="text-center">
                            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Configure scan settings and click Generate Heat Map</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Google Maps view
                    <GoogleMap
                      key={`map-${gridSize}-${radiusKm}`}
                      mapContainerStyle={mapContainerStyleWithCursor}
                      center={{ lat: project.latitude, lng: project.longitude }}
                      zoom={radiusKm <= 5 ? 12 : radiusKm <= 10 ? 11 : radiusKm <= 15 ? 10 : 9}
                      options={mapOptions}
                      onLoad={(map) => { mapRef.current = map }}
                      onZoomChanged={handleZoomChanged}
                      onClick={handleMapClick}
                    >
                      {/* Center marker for the business location */}
                      <Marker
                        position={{ lat: project.latitude, lng: project.longitude }}
                        title={project.project_name}
                        icon={{
                          url: '/icon.svg',
                          scaledSize: new google.maps.Size(50, 50),
                          anchor: new google.maps.Point(25, 50)
                        }}
                      />
                      
                      {/* Grid point circles - show preview or results */}
                      {gridData.points.map((point, index) => {
                        const position = gridData.positions[index]
                        const isLoading = gridData.isGenerating
                        const hasData = gridData.positions.some(p => p !== null)
                        const isPreview = !hasData && !isLoading
                        
                        return (
                          <React.Fragment key={index}>
                            <Circle
                              center={{ lat: point.latitude, lng: point.longitude }}
                              radius={radiusKm * 1000 / gridSize}
                              options={{
                                fillColor: (isPreview || isLoading) ? '#FFFFFF' : getPositionHexColor(position),
                                fillOpacity: isLoading ? pulseOpacity : (isPreview ? 0.5 : 0.4),
                                strokeColor: (isPreview || isLoading) ? '#CCCCCC' : undefined,
                                strokeOpacity: (isPreview || isLoading) ? 0.5 : 0,
                                strokeWeight: (isPreview || isLoading) ? 1 : 0,
                                clickable: !isPreview && !isLoading,
                                zIndex: position === null ? 1 : (100 - (position || 100))
                              }}
                              onClick={() => {
                                if (!isPreview) {
                                  toast.info(
                                    position !== null 
                                      ? `Position #${position} at this location`
                                      : 'Not ranked at this location'
                                  )
                                }
                              }}
                            />
                            {/* Position label overlay - only show when not preview */}
                            {!isPreview && (
                              <OverlayView
                                position={{ lat: point.latitude, lng: point.longitude }}
                                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                              >
                                <div 
                                  className="flex items-center justify-center font-bold text-white pointer-events-none"
                                  style={{
                                    transform: 'translate(-50%, -50%)',
                                    fontSize: radiusKm <= 5 ? '18px' : radiusKm <= 15 ? '16px' : '14px'
                                  }}
                                >
                                  {isLoading ? (
                                    <svg 
                                      className="animate-spin" 
                                      width={radiusKm <= 5 ? '16' : radiusKm <= 15 ? '14' : '12'} 
                                      height={radiusKm <= 5 ? '16' : radiusKm <= 15 ? '14' : '12'} 
                                      viewBox="0 0 24 24" 
                                      fill="none"
                                    >
                                      <circle 
                                        className="opacity-25" 
                                        cx="12" 
                                        cy="12" 
                                        r="10" 
                                        stroke="currentColor" 
                                        strokeWidth="4"
                                      />
                                      <path 
                                        className="opacity-75" 
                                        fill="currentColor" 
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                      />
                                    </svg>
                                  ) : (
                                    position !== null ? position : 'NR'
                                  )}
                                </div>
                              </OverlayView>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </GoogleMap>
                  )}
                </div>

                {/* Legend - Always show */}
                <div className="mt-4 flex items-center justify-center gap-4 text-sm flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                    <span>Top 3</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-400 rounded-full"></div>
                    <span>4-6</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                    <span>7-10</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-400 rounded-full"></div>
                    <span>11-20</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-600 rounded-full"></div>
                    <span>20+</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                    <span>Not Ranked on Google Maps</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Improvement Report Card */}
            {(loadingLocations || weakLocations.length > 0) && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Ranking Improvement Opportunities</CardTitle>
                  <CardDescription>
                    {loadingLocations ? 'Analyzing weak locations...' : 'Click anywhere on the map to add locations, or let us auto-detect weak areas'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingLocations ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span className="text-sm text-muted-foreground">Finding weak location names...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Instruction Banner */}
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          💡 <strong>Tip:</strong> Click anywhere on the map to add more towns or suburbs to your report. Hover over any location below to remove it.
                        </p>
                      </div>

                      <p className="text-sm leading-relaxed">
                        To improve rankings in the weaker towns on your heat map, create location-specific service pages targeting each area. 
                        Google ranks pages based on local relevance, and by adding tailored content for towns like{' '}
                        <span className="font-semibold text-orange-600 dark:text-orange-400">
                          {weakLocations.slice(0, 3).map(loc => loc.name).join(', ')}
                        </span>
                        {weakLocations.length > 3 && `, and ${weakLocations.length - 3} more`}, you become the most relevant result for users searching in those postcodes.
                      </p>
                    
                    <p className="text-sm leading-relaxed">
                      GeoScale lets you generate these pages in bulk, push them to WordPress, score their SEO quality, refresh them, and track their position over time.
                    </p>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {weakLocations.map((loc, index) => (
                        <div 
                          key={index}
                          className="group px-3 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 flex items-center gap-1"
                        >
                          <span>{loc.name} {loc.position !== null ? `(#${loc.position})` : '(NR)'}</span>
                          <button
                            onClick={() => {
                              setWeakLocations(prev => prev.filter((_, i) => i !== index))
                              toast.success(`Removed ${loc.name} from report`)
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-orange-200 dark:hover:bg-orange-800 rounded-full p-0.5"
                            title="Remove from report"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>

                      <div className="pt-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          <Button 
                            onClick={handleCreateCombinations}
                            disabled={creatingCombinations || !weakLocations.length}
                            className="w-full sm:w-auto"
                          >
                            {creatingCombinations ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Creating Combinations...
                              </>
                            ) : (
                              'Auto-Add These Locations & Generate Combinations'
                            )}
                          </Button>
                          
                          {combinationsCreated !== null && !creatingCombinations && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-green-600 dark:text-green-400 font-medium">
                                ✓ {combinationsCreated} combination{combinationsCreated !== 1 ? 's' : ''} successfully created
                              </span>
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0"
                                onClick={() => navigate(`/projects/${projectId}`)}
                              >
                                - click to view and generate content
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

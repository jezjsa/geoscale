/**
 * Geographic Grid Generator
 * 
 * Generates a grid of latitude/longitude points around a center location
 * for heat map ranking analysis.
 */

export interface GridPoint {
  x: number // Grid X coordinate (0 to gridSize-1)
  y: number // Grid Y coordinate (0 to gridSize-1)
  latitude: number
  longitude: number
}

export interface GridConfig {
  centerLat: number
  centerLng: number
  gridSize: number // e.g., 7 for 7x7 grid
  radiusKm: number // Coverage radius from center point
}

/**
 * Convert kilometers to degrees latitude
 * 1 degree latitude ≈ 111 km
 */
function kmToLatitude(km: number): number {
  return km / 111.0
}

/**
 * Convert kilometers to degrees longitude at given latitude
 * 1 degree longitude ≈ 111 km * cos(latitude)
 */
function kmToLongitude(km: number, latitude: number): number {
  return km / (111.0 * Math.cos(latitude * Math.PI / 180))
}

/**
 * Generate a square grid of points around a center location
 */
export function generateGrid(config: GridConfig): GridPoint[] {
  const { centerLat, centerLng, gridSize, radiusKm } = config
  const points: GridPoint[] = []

  // Calculate spacing between grid points
  const spacingLat = kmToLatitude(radiusKm * 2) / (gridSize - 1)
  const spacingLng = kmToLongitude(radiusKm * 2, centerLat) / (gridSize - 1)

  // Calculate the top-left corner of the grid
  const startLat = centerLat - (radiusKm / 111.0)
  const startLng = centerLng - kmToLongitude(radiusKm, centerLat)

  // Generate grid points
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      points.push({
        x,
        y,
        latitude: startLat + (y * spacingLat),
        longitude: startLng + (x * spacingLng)
      })
    }
  }

  return points
}

/**
 * Generate a hexagonal grid for better coverage
 */
export function generateHexagonalGrid(config: GridConfig): GridPoint[] {
  const { centerLat, centerLng, gridSize, radiusKm } = config
  const points: GridPoint[] = []

  const hexHeight = kmToLatitude(radiusKm * 2) / (gridSize - 1)
  const hexWidth = kmToLongitude(radiusKm * 2, centerLat) / (gridSize - 1)
  const vertSpacing = hexHeight * 0.75
  const horizSpacing = hexWidth

  const startX = centerLng - (hexWidth * (gridSize - 1) / 2)
  const startY = centerLat - (vertSpacing * (gridSize - 1) / 2)

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const x = startX + col * horizSpacing
      const y = startY + row * vertSpacing
      
      // Offset every other row for hexagonal pattern
      const offset = row % 2 === 0 ? 0 : horizSpacing / 2
      
      points.push({
        x: col,
        y: row,
        latitude: y,
        longitude: x + offset
      })
    }
  }

  return points
}

/**
 * Calculate the distance between two points in kilometers
 */
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

/**
 * Get a human-readable location name for coordinates (reverse geocoding)
 * This would typically call a geocoding API, but for now returns coordinates
 */
export function getLocationName(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
}

/**
 * Predefined grid configurations for quick selection
 */
export const GRID_PRESETS = {
  quick: { gridSize: 5, radiusKm: 5 },   // 25 points, town center
  standard: { gridSize: 7, radiusKm: 10 }, // 49 points, city area
  detailed: { gridSize: 10, radiusKm: 15 }, // 100 points, metro area
  comprehensive: { gridSize: 15, radiusKm: 25 } // 225 points, region
} as const

export type GridPreset = keyof typeof GRID_PRESETS

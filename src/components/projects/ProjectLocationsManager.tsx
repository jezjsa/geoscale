import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Trash2, MapPin, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

interface ProjectLocation {
  id: string
  name: string
  slug: string
  created_at: string
}

interface ProjectLocationsManagerProps {
  projectId: string
}

// Fetch locations for a project
async function getProjectLocations(projectId: string): Promise<ProjectLocation[]> {
  const { data, error } = await supabase
    .from('project_locations')
    .select('id, name, slug, created_at')
    .eq('project_id', projectId)
    .order('name', { ascending: true })

  if (error) throw error
  return data || []
}

// Get combination count for a location
async function getLocationCombinationCount(locationId: string): Promise<number> {
  const { count, error } = await supabase
    .from('location_keywords')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', locationId)

  if (error) throw error
  return count || 0
}

// Delete a location and its combinations
async function deleteLocation(locationId: string): Promise<void> {
  // First delete all combinations for this location
  const { error: comboError } = await supabase
    .from('location_keywords')
    .delete()
    .eq('location_id', locationId)

  if (comboError) throw comboError

  // Then delete the location
  const { error } = await supabase
    .from('project_locations')
    .delete()
    .eq('id', locationId)

  if (error) throw error
}

export function ProjectLocationsManager({ projectId }: ProjectLocationsManagerProps) {
  const queryClient = useQueryClient()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [locationToDelete, setLocationToDelete] = useState<ProjectLocation | null>(null)
  const [combinationCount, setCombinationCount] = useState(0)

  // Fetch locations
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['projectLocations', projectId],
    queryFn: () => getProjectLocations(projectId),
  })

  // Check for duplicates
  const duplicateNames = locations
    .map(l => l.name)
    .filter((name, index, arr) => arr.indexOf(name) !== index)
  const uniqueDuplicates = [...new Set(duplicateNames)]

  const deleteMutation = useMutation({
    mutationFn: deleteLocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectLocations', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectCombinations', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectCombinationStats', projectId] })
      toast.success('Location deleted successfully')
      setShowDeleteDialog(false)
      setLocationToDelete(null)
    },
    onError: (error: Error) => {
      toast.error('Failed to delete location', {
        description: error.message,
      })
    },
  })

  const handleDeleteClick = async (location: ProjectLocation) => {
    setLocationToDelete(location)
    // Get combination count for this location
    const count = await getLocationCombinationCount(location.id)
    setCombinationCount(count)
    setShowDeleteDialog(true)
  }

  const confirmDelete = () => {
    if (locationToDelete) {
      deleteMutation.mutate(locationToDelete.id)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>Loading locations...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Locations</p>
              <p className="text-2xl font-bold">{locations.length}</p>
              {uniqueDuplicates.length > 0 && (
                <p className="text-xs text-orange-500 mt-1">
                  {uniqueDuplicates.length} duplicate name{uniqueDuplicates.length !== 1 ? 's' : ''} found
                </p>
              )}
            </div>
            {uniqueDuplicates.length > 0 && (
              <div className="flex items-center gap-2 text-orange-500">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm font-medium">Duplicates detected</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Locations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
          <CardDescription>
            Towns and cities added to this project for combination generation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {locations.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No locations added yet</p>
              <p className="text-sm mt-1">Add locations from the Keyword Combinations tab</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => {
                  const isDuplicate = duplicateNames.includes(location.name)
                  return (
                    <TableRow key={location.id} className={isDuplicate ? 'bg-orange-50 dark:bg-orange-900/10' : ''}>
                      <TableCell className="font-medium">
                        {location.name}
                        {isDuplicate && (
                          <span className="ml-2 text-xs text-orange-500">(duplicate)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{location.slug}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(location.created_at).toLocaleDateString('en-GB')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(location)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Location</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{locationToDelete?.name}"?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {combinationCount > 0 ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                  ⚠️ This will also delete {combinationCount} combination{combinationCount !== 1 ? 's' : ''} using this location.
                </p>
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                  This action cannot be undone.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                This location has no combinations. It will be permanently deleted.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

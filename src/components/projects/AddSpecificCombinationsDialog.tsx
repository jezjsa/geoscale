import { useState, useMemo, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { addSpecificCombinations } from '@/api/combinations'
import { UK_REGIONS } from '@/data/uk-regions'

interface AddSpecificCombinationsDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  baseKeyword?: string
}

export function AddSpecificCombinationsDialog({ 
  projectId, 
  open, 
  onOpenChange,
  baseKeyword = ''
}: AddSpecificCombinationsDialogProps) {
  const queryClient = useQueryClient()
  
  // Section A: Selected regions
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set())
  
  // Section B: Individual towns from regions + manual additions
  const [selectedTowns, setSelectedTowns] = useState<Set<string>>(new Set())
  
  // Section C: Custom town input
  const [customTown, setCustomTown] = useState('')
  
  // All available towns for the checklist (sorted)
  const allAvailableTowns = useMemo(() => {
    return Array.from(selectedTowns).sort()
  }, [selectedTowns])

  const addMutation = useMutation({
    mutationFn: async (combinations: Array<{ location: string; keyword: string }>) => {
      return addSpecificCombinations(projectId, combinations)
    },
    onSuccess: (data) => {
      toast.success('Towns added successfully!', {
        description: `Created ${data.combinations_count} new combination${data.combinations_count !== 1 ? 's' : ''}.`,
      })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectCombinations', projectId] })
      handleClose()
    },
    onError: (error: Error) => {
      toast.error('Error adding towns', {
        description: error.message,
      })
    },
  })

  const handleToggleRegion = useCallback((regionId: string) => {
    const region = UK_REGIONS.find(r => r.id === regionId)
    if (!region) return

    setSelectedRegions(prev => {
      const newSelectedRegions = new Set(prev)
      const isRemoving = newSelectedRegions.has(regionId)
      
      if (isRemoving) {
        newSelectedRegions.delete(regionId)
      } else {
        newSelectedRegions.add(regionId)
      }
      
      // Update towns in a separate state update
      setSelectedTowns(prevTowns => {
        const newSelectedTowns = new Set(prevTowns)
        if (isRemoving) {
          region.towns.forEach(town => newSelectedTowns.delete(town))
        } else {
          region.towns.forEach(town => newSelectedTowns.add(town))
        }
        return newSelectedTowns
      })
      
      return newSelectedRegions
    })
  }, [])

  const handleToggleTown = useCallback((town: string) => {
    setSelectedTowns(prev => {
      const newSelected = new Set(prev)
      if (newSelected.has(town)) {
        newSelected.delete(town)
      } else {
        newSelected.add(town)
      }
      return newSelected
    })
  }, [])

  const handleAddCustomTown = useCallback(() => {
    const trimmedTown = customTown.trim()
    if (trimmedTown) {
      setSelectedTowns(prev => new Set([...prev, trimmedTown]))
      setCustomTown('')
    }
  }, [customTown])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (selectedTowns.size === 0) {
      toast.error('Please select at least one town')
      return
    }

    if (!baseKeyword.trim()) {
      toast.error('No base keyword found. Please set up your project first.')
      return
    }

    // Create combinations for each selected town with the base keyword
    const combinations = Array.from(selectedTowns).map(town => ({
      location: town,
      keyword: baseKeyword,
    }))

    addMutation.mutate(combinations)
  }

  const handleClose = () => {
    setSelectedRegions(new Set())
    setSelectedTowns(new Set())
    setCustomTown('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Towns</DialogTitle>
          <DialogDescription>
            Select regions or individual towns to add to your project. Each town will be combined with "{baseKeyword}".
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto py-4 space-y-6">
            
            {/* Section A: Quick Add Regions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Quick Add by Region</Label>
                <span className="text-xs text-muted-foreground">{selectedRegions.size} regions selected</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {UK_REGIONS.map((region) => (
                  <div
                    key={region.id}
                    className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent"
                  >
                    <Checkbox
                      id={`region-${region.id}`}
                      checked={selectedRegions.has(region.id)}
                      onCheckedChange={() => handleToggleRegion(region.id)}
                    />
                    <label
                      htmlFor={`region-${region.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="font-medium text-sm">{region.name}</div>
                      <div className="text-xs text-muted-foreground">{region.towns.length} towns</div>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Section B: Individual Towns */}
            {allAvailableTowns.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Select Individual Towns</Label>
                  <span className="text-xs text-muted-foreground">{selectedTowns.size} towns selected</span>
                </div>
                <div className="border rounded-lg p-3 max-h-[200px] overflow-y-auto">
                  <div className="grid grid-cols-3 gap-2">
                    {allAvailableTowns.map((town) => (
                      <div
                        key={town}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`town-${town}`}
                          checked={selectedTowns.has(town)}
                          onCheckedChange={() => handleToggleTown(town)}
                        />
                        <label
                          htmlFor={`town-${town}`}
                          className="text-sm cursor-pointer select-none"
                        >
                          {town}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Section C: Manual Entry */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Add Custom Town</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter town name (e.g., Hull)"
                  value={customTown}
                  onChange={(e) => setCustomTown(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddCustomTown()
                    }
                  }}
                  disabled={addMutation.isPending}
                />
                <Button
                  type="button"
                  onClick={handleAddCustomTown}
                  disabled={!customTown.trim() || addMutation.isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {selectedTowns.size} town{selectedTowns.size !== 1 ? 's' : ''} will be added with keyword "{baseKeyword}"
              </p>
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={addMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                style={{ backgroundColor: '#006239' }}
                className="hover:opacity-90 text-white"
                disabled={selectedTowns.size === 0 || addMutation.isPending}
              >
                {addMutation.isPending 
                  ? 'Adding...' 
                  : `Add ${selectedTowns.size} Town${selectedTowns.size !== 1 ? 's' : ''}`
                }
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}


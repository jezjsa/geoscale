import { useState, useMemo, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePlanLimits } from '@/hooks/usePlanLimits'
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
import { Badge } from '@/components/ui/badge'
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
  const { limits, usage } = usePlanLimits()
  
  // Section A: Selected regions
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set())
  
  // Section B: Individual towns from regions + manual additions
  const [selectedTowns, setSelectedTowns] = useState<Set<string>>(new Set())
  
  // Section C: Custom town input
  const [customTown, setCustomTown] = useState('')
  
  // Section D: Keywords
  const [keywords, setKeywords] = useState<Set<string>>(new Set(baseKeyword ? [baseKeyword] : []))
  const [customKeyword, setCustomKeyword] = useState('')
  
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

  const handleAddCustomKeyword = useCallback(() => {
    const trimmedKeyword = customKeyword.trim()
    if (trimmedKeyword) {
      setKeywords(prev => new Set([...prev, trimmedKeyword]))
      setCustomKeyword('')
    }
  }, [customKeyword])

  const handleRemoveKeyword = useCallback((keyword: string) => {
    setKeywords(prev => {
      const newKeywords = new Set(prev)
      newKeywords.delete(keyword)
      return newKeywords
    })
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (selectedTowns.size === 0) {
      toast.error('Please select at least one town')
      return
    }

    if (keywords.size === 0) {
      toast.error('Please add at least one keyword phrase')
      return
    }

    // Create combinations for each town × keyword pair
    const combinations: Array<{ location: string; keyword: string }> = []
    Array.from(selectedTowns).forEach(town => {
      Array.from(keywords).forEach(keyword => {
        combinations.push({
          location: town,
          keyword: keyword,
        })
      })
    })

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
      <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Auto-Generate Combinations</DialogTitle>
          <DialogDescription>
            Select towns and add keyword phrases. Every town will be combined with every keyword to create your combinations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto py-4 pr-2 space-y-6">
            
            {/* Section A: Quick Add Regions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">Step 1: Select Locations</Label>
                  <p className="text-xs text-muted-foreground mt-1">Quick add by region</p>
                </div>
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
                  <div>
                    <Label className="text-sm font-medium">Or Select Individual Towns</Label>
                  </div>
                  <span className="text-xs text-muted-foreground">{selectedTowns.size} towns selected</span>
                </div>
                <div className="border rounded-lg p-3 max-h-[200px] overflow-y-auto bg-transparent">
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
              <Label className="text-sm font-medium">Or Add Custom Town</Label>
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

            {/* Section D: Keywords */}
            <div className="space-y-3">
              <div>
                <Label className="text-base font-semibold">Step 2: Add Keyword Phrases</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  For the {selectedTowns.size} location{selectedTowns.size !== 1 ? 's' : ''} selected above
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter keyword phrase (e.g., plumber, emergency plumber)"
                    value={customKeyword}
                    onChange={(e) => setCustomKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddCustomKeyword()
                      }
                    }}
                    disabled={addMutation.isPending}
                  />
                  <Button
                    type="button"
                    onClick={handleAddCustomKeyword}
                    disabled={!customKeyword.trim() || addMutation.isPending}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Press Enter or click + to add each keyword phrase
                </p>
              </div>
              
              {keywords.size > 0 && (
                <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/50">
                  {Array.from(keywords).map((keyword) => (
                    <Badge key={keyword} variant="secondary" className="text-sm">
                      {keyword}
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(keyword)}
                        className="ml-2 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

          </div>

          <div className="border-t pt-4">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                {selectedTowns.size} town{selectedTowns.size !== 1 ? 's' : ''} × {keywords.size} keyword{keywords.size !== 1 ? 's' : ''} = {selectedTowns.size * keywords.size} combination{selectedTowns.size * keywords.size !== 1 ? 's' : ''}
              </p>
              {limits && usage && (
                <>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your plan allows {limits.combinationPageLimit} total combinations ({usage.combinationCount} currently used)
                  </p>
                  {(usage.combinationCount + (selectedTowns.size * keywords.size)) > limits.combinationPageLimit && (
                    <p className="text-xs text-red-500 font-medium mt-2">
                      ⚠️ This would exceed your plan limit by {(usage.combinationCount + (selectedTowns.size * keywords.size)) - limits.combinationPageLimit} combinations. Please upgrade or reduce selections.
                    </p>
                  )}
                </>
              )}
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
                style={{ backgroundColor: 'var(--brand-dark)' }}
                className="hover:opacity-90 text-white"
                disabled={
                  selectedTowns.size === 0 || 
                  keywords.size === 0 || 
                  addMutation.isPending ||
                  (limits && usage && (usage.combinationCount + (selectedTowns.size * keywords.size)) > limits.combinationPageLimit)
                }
              >
                {addMutation.isPending 
                  ? 'Creating...' 
                  : (limits && usage && (usage.combinationCount + (selectedTowns.size * keywords.size)) > limits.combinationPageLimit)
                    ? 'Exceeds Plan Limit'
                    : `Create ${selectedTowns.size * keywords.size} Combination${selectedTowns.size * keywords.size !== 1 ? 's' : ''}`
                }
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}


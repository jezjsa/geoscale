import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
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
import { Plus, Loader2, AlertTriangle, X, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { addSpecificCombinations, getProjectCombinations } from '@/api/combinations'
import { getProjectServices, getServiceKeywords } from '@/api/services'

interface AddLocationsDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddLocationsDialog({ 
  projectId, 
  open, 
  onOpenChange,
}: AddLocationsDialogProps) {
  const queryClient = useQueryClient()
  const { limits, usage } = usePlanLimits()
  
  // Fetch services and their selected keywords
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ['projectServices', projectId],
    queryFn: () => getProjectServices(projectId),
    enabled: open,
  })

  // Fetch all selected keywords from all services
  const { data: allKeywords, isLoading: keywordsLoading } = useQuery({
    queryKey: ['allServiceKeywords', projectId],
    queryFn: async () => {
      if (!services || services.length === 0) return []
      
      const keywordPromises = services.map(service => getServiceKeywords(service.id))
      const keywordResults = await Promise.all(keywordPromises)
      
      // Flatten and get only selected keywords
      const selectedKeywords = keywordResults
        .flat()
        .filter(kw => kw.is_selected)
        .map(kw => kw.keyword)
      
      // Remove duplicates
      return [...new Set(selectedKeywords)]
    },
    enabled: open && !!services && services.length > 0,
  })

  // Fetch existing locations for this project
  const { data: existingCombinations } = useQuery({
    queryKey: ['projectCombinations', projectId],
    queryFn: () => getProjectCombinations(projectId),
    enabled: open,
  })

  // Get unique existing location names (case-insensitive)
  const existingLocationNames = new Set(
    existingCombinations
      ?.map((c: any) => c.location?.name?.toLowerCase())
      .filter(Boolean) || []
  )

  // Check if a town already exists
  const isTownExisting = (town: string) => {
    return existingLocationNames.has(town.trim().toLowerCase())
  }

  const keywordCount = allKeywords?.length || 0
  
  // 5 input rows for towns
  const [townInputs, setTownInputs] = useState<string[]>(['', '', '', '', ''])
  
  // Additional towns beyond the initial 5
  const [additionalTowns, setAdditionalTowns] = useState<string[]>([])
  
  // Get all non-empty towns
  const getAllTowns = () => {
    const allInputTowns = [...townInputs, ...additionalTowns]
      .map(t => t.trim())
      .filter(t => t.length > 0)
    // Remove duplicates
    return [...new Set(allInputTowns)]
  }
  
  const selectedTowns = getAllTowns()
  
  // Check for any duplicate towns (towns that already exist in the project)
  const hasDuplicateTowns = selectedTowns.some(town => isTownExisting(town))
  
  // Calculate combinations and limits
  const combinationCount = selectedTowns.length * keywordCount
  const remainingLimit = limits && usage 
    ? limits.combinationPageLimit - usage.combinationCount 
    : Infinity
  const maxTownsAllowed = keywordCount > 0 ? Math.floor(remainingLimit / keywordCount) : Infinity
  const wouldExceedLimit = combinationCount > remainingLimit
  const isAtLimit = selectedTowns.length >= maxTownsAllowed

  const addMutation = useMutation({
    mutationFn: async (combinations: Array<{ location: string; keyword: string }>) => {
      return addSpecificCombinations(projectId, combinations)
    },
    onSuccess: (data) => {
      toast.success('Locations added successfully!', {
        description: `Created ${data.combinations_count} new combination${data.combinations_count !== 1 ? 's' : ''}.`,
      })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectCombinations', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectCombinationStats', projectId] })
      handleClose()
    },
    onError: (error: Error) => {
      toast.error('Error adding locations', {
        description: error.message,
      })
    },
  })

  // Capitalize first letter of each word
  const capitalizeWords = (str: string) => {
    return str.replace(/\b\w/g, char => char.toUpperCase())
  }

  const handleTownInputChange = (index: number, value: string) => {
    const newInputs = [...townInputs]
    newInputs[index] = capitalizeWords(value)
    setTownInputs(newInputs)
  }

  const handleAddMoreRows = () => {
    if (isAtLimit) {
      toast.error('Plan limit reached', {
        description: `You can only add ${maxTownsAllowed} towns with ${keywordCount} keywords on your current plan.`
      })
      return
    }
    setAdditionalTowns(prev => [...prev, ''])
  }

  const handleAdditionalTownChange = (index: number, value: string) => {
    const newTowns = [...additionalTowns]
    newTowns[index] = capitalizeWords(value)
    setAdditionalTowns(newTowns)
  }

  const handleRemoveAdditionalTown = (index: number) => {
    setAdditionalTowns(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const towns = getAllTowns()
    
    if (towns.length === 0) {
      toast.error('Please enter at least one town')
      return
    }

    if (!allKeywords || allKeywords.length === 0) {
      toast.error('No keywords found. Please add services with keywords first.')
      return
    }

    // Create combinations for each town × keyword pair
    const combinations: Array<{ location: string; keyword: string }> = []
    towns.forEach(town => {
      allKeywords.forEach(keyword => {
        combinations.push({
          location: town,
          keyword: keyword,
        })
      })
    })

    addMutation.mutate(combinations)
  }

  const handleClose = () => {
    setTownInputs(['', '', '', '', ''])
    setAdditionalTowns([])
    onOpenChange(false)
  }

  const isLoading = servicesLoading || keywordsLoading

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Locations</DialogTitle>
          <DialogDescription>
            Enter the towns/cities you want to target. Each location will be combined with your {keywordCount} keyword{keywordCount !== 1 ? 's' : ''}.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : keywordCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">No keywords found</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              You need to add services with keywords first. Go to the Services tab to add services and select keywords.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto py-4 px-1 space-y-4">
              
              {/* Town inputs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Enter Towns/Cities</Label>
                  <span className="text-sm text-muted-foreground">
                    {selectedTowns.length} town{selectedTowns.length !== 1 ? 's' : ''} entered
                  </span>
                </div>
                
                {/* Initial 5 rows */}
                <div className="space-y-2">
                  {townInputs.map((value, index) => {
                    const exists = value.trim() && isTownExisting(value)
                    return (
                      <div key={index} className="space-y-1">
                        <div className="relative">
                          <Input
                            placeholder={`Town ${index + 1} (e.g., ${['Manchester', 'Leeds', 'Sheffield', 'Birmingham', 'Bristol'][index]})`}
                            value={value}
                            onChange={(e) => handleTownInputChange(index, e.target.value)}
                            disabled={addMutation.isPending}
                            className={exists ? 'border-yellow-500 focus-visible:ring-yellow-500 pr-10' : ''}
                          />
                          {exists && (
                            <button
                              type="button"
                              onClick={() => handleTownInputChange(index, '')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-yellow-500 hover:text-yellow-400"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        {exists && (
                          <p className="text-xs text-yellow-500 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {value.trim()} already exists in this project
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Additional rows */}
                {additionalTowns.length > 0 && (
                  <div className="space-y-2">
                    {additionalTowns.map((value, index) => {
                      const exists = value.trim() && isTownExisting(value)
                      return (
                        <div key={`additional-${index}`} className="space-y-1">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                placeholder={`Town ${townInputs.length + index + 1}`}
                                value={value}
                                onChange={(e) => handleAdditionalTownChange(index, e.target.value)}
                                disabled={addMutation.isPending}
                                className={exists ? 'border-yellow-500 focus-visible:ring-yellow-500 pr-10' : ''}
                              />
                              {exists && (
                                <button
                                  type="button"
                                  onClick={() => handleAdditionalTownChange(index, '')}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-yellow-500 hover:text-yellow-400"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveAdditionalTown(index)}
                              disabled={addMutation.isPending}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          {exists && (
                            <p className="text-xs text-yellow-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {value.trim()} already exists in this project
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Add more button */}
                {!isAtLimit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddMoreRows}
                    disabled={addMutation.isPending}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Town
                  </Button>
                )}

                {isAtLimit && selectedTowns.length > 0 && (
                  <p className="text-xs text-yellow-500 text-center">
                    Plan limit reached: {maxTownsAllowed} towns maximum with {keywordCount} keywords
                  </p>
                )}
              </div>

            </div>

            <div className="border-t pt-4">
              <div className="mb-4">
                <p className="text-sm font-medium">
                  {selectedTowns.length} location{selectedTowns.length !== 1 ? 's' : ''} × {keywordCount} keyword{keywordCount !== 1 ? 's' : ''} = <span className="text-[var(--brand-dark)]">{combinationCount} combination{combinationCount !== 1 ? 's' : ''}</span>
                </p>
                {limits && usage && (
                  <>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your plan allows {limits.combinationPageLimit} total combinations ({usage.combinationCount} currently used)
                    </p>
                    {wouldExceedLimit && (
                      <p className="text-xs text-red-500 font-medium mt-2">
                        ⚠️ This would exceed your plan limit. Please upgrade or remove some towns.
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
                  style={{ backgroundColor: hasDuplicateTowns ? '#eab308' : 'var(--brand-dark)' }}
                  className="hover:opacity-90 text-white"
                  disabled={
                    selectedTowns.length === 0 || 
                    keywordCount === 0 || 
                    addMutation.isPending ||
                    wouldExceedLimit ||
                    hasDuplicateTowns
                  }
                >
                  {addMutation.isPending 
                    ? 'Creating...' 
                    : hasDuplicateTowns
                      ? 'Remove Duplicate Towns'
                      : wouldExceedLimit
                        ? 'Exceeds Plan Limit'
                        : `Create ${combinationCount} Combination${combinationCount !== 1 ? 's' : ''}`
                  }
                </Button>
              </DialogFooter>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

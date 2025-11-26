import { useState, useEffect } from 'react'
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
import { Search, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getKeywordVariations } from '@/api/dataforseo'
import { addSpecificCombinations } from '@/api/combinations'
import { supabase } from '@/lib/supabase'

interface KeywordResult {
  keyword: string
  search_volume: number
  difficulty?: number
}

interface ResearchKeywordsDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ResearchKeywordsDialog({ 
  projectId, 
  open, 
  onOpenChange 
}: ResearchKeywordsDialogProps) {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [keywordResults, setKeywordResults] = useState<KeywordResult[]>([])
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set())
  const [isSearching, setIsSearching] = useState(false)
  const [locationCount, setLocationCount] = useState(0)
  const [customKeywords, setCustomKeywords] = useState<string[]>([''])

  // Fetch location count on open
  const fetchLocationCount = async () => {
    const { count, error } = await supabase
      .from('project_locations')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
    
    if (!error && count !== null) {
      setLocationCount(count)
    }
  }

  // Search for keyword variations
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error('Please enter a keyword to search')
      return
    }

    setIsSearching(true)
    try {
      const results = await getKeywordVariations({
        project_id: projectId,
        base_keyword: searchTerm.trim(),
        location: 'GB',
        limit: 20,
      })
      setKeywordResults(results)
      toast.success(`Found ${results.length} keyword variations`)
    } catch (error: any) {
      toast.error('Failed to search keywords', {
        description: error.message,
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleToggleKeyword = (keyword: string) => {
    setSelectedKeywords(prev => {
      const newSelected = new Set(prev)
      if (newSelected.has(keyword)) {
        newSelected.delete(keyword)
      } else {
        newSelected.add(keyword)
      }
      return newSelected
    })
  }

  const handleUpdateCustomKeyword = (index: number, value: string) => {
    setCustomKeywords(prev => {
      const updated = [...prev]
      updated[index] = value
      return updated
    })
  }

  const handleAddCustomKeywordRow = () => {
    setCustomKeywords(prev => [...prev, ''])
  }

  const handleRemoveCustomKeywordRow = (index: number) => {
    if (customKeywords.length > 1) {
      setCustomKeywords(prev => prev.filter((_, i) => i !== index))
    }
  }

  const handleApplyCustomKeywords = () => {
    const validKeywords = customKeywords.filter(kw => kw.trim() !== '')
    if (validKeywords.length > 0) {
      setSelectedKeywords(prev => new Set([...prev, ...validKeywords.map(kw => kw.trim())]))
      setCustomKeywords(['']) // Reset to single empty row
      toast.success(`Added ${validKeywords.length} custom keyword${validKeywords.length !== 1 ? 's' : ''}`)
    }
  }

  const handleSelectAll = () => {
    const allKeywords = keywordResults.map(result => result.keyword)
    setSelectedKeywords(new Set(allKeywords))
    toast.success(`Selected all ${allKeywords.length} keywords`)
  }

  const handleDeselectAll = () => {
    // Keep any manually added keywords that aren't in the results
    const manualKeywords = Array.from(selectedKeywords).filter(
      keyword => !keywordResults.find(result => result.keyword === keyword)
    )
    setSelectedKeywords(new Set(manualKeywords))
    toast.success('Deselected all search results')
  }

  const addKeywordsMutation = useMutation({
    mutationFn: async () => {
      // Get all existing locations
      const { data: locations, error } = await supabase
        .from('project_locations')
        .select('id, name')
        .eq('project_id', projectId)

      if (error) throw error

      // Create combinations for each selected keyword with each location
      const combinations: Array<{ location: string; keyword: string }> = []
      
      Array.from(selectedKeywords).forEach(keyword => {
        locations?.forEach(location => {
          combinations.push({
            location: location.name,
            keyword: keyword,
          })
        })
      })

      // Use the existing API to add combinations
      return await addSpecificCombinations(projectId, combinations)
    },
    onSuccess: (data) => {
      toast.success('Keywords added successfully!', {
        description: `Created ${data.combinations_count} new combination${data.combinations_count !== 1 ? 's' : ''} across ${locationCount} location${locationCount !== 1 ? 's' : ''}.`,
      })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectCombinations', projectId] })
      handleClose()
    },
    onError: (error: Error) => {
      toast.error('Error adding keywords', {
        description: error.message,
      })
    },
  })

  const handleApplyKeywords = () => {
    if (selectedKeywords.size === 0) {
      toast.error('Please select at least one keyword')
      return
    }

    if (locationCount === 0) {
      toast.error('No locations found. Please add locations first.')
      return
    }

    addKeywordsMutation.mutate()
  }

  const handleClose = () => {
    setSearchTerm('')
    setKeywordResults([])
    setSelectedKeywords(new Set())
    setCustomKeywords([''])
    onOpenChange(false)
  }

  // Fetch location count when dialog opens
  useEffect(() => {
    if (open) {
      fetchLocationCount()
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Keywords</DialogTitle>
          <DialogDescription>
            Add custom or find related keywords and apply them to your existing {locationCount} location{locationCount !== 1 ? 's' : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col flex-1 overflow-hidden space-y-4 px-1">
          
          {/* Manual Keyword Entry */}
          <div className="space-y-3 mt-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Add Custom Keywords</Label>
             
            </div>
            <div className="space-y-2">
              {customKeywords.map((keyword, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Enter keyword (e.g., IT support)"
                    value={keyword}
                    onChange={(e) => handleUpdateCustomKeyword(index, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (keyword.trim()) {
                          handleAddCustomKeywordRow()
                        }
                      }
                    }}
                    disabled={addKeywordsMutation.isPending}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={handleAddCustomKeywordRow}
                    disabled={addKeywordsMutation.isPending}
                    className="flex-shrink-0"
                  >
                    <Plus className="h-4 w-4 text-white" />
                  </Button>
                  {customKeywords.length > 1 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => handleRemoveCustomKeywordRow(index)}
                      disabled={addKeywordsMutation.isPending}
                      className="flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  )}
                </div>
              ))}
                          <p className="text-xs text-muted-foreground">
                              Note: Don't add the location - we'll add this automatically.
                          </p>
            </div>
            {customKeywords.some(kw => kw.trim() !== '') && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleApplyCustomKeywords}
                  disabled={addKeywordsMutation.isPending}
                  style={{ backgroundColor: '#006239' }}
                  className="text-white hover:opacity-90"
                >
                  Apply {customKeywords.filter(kw => kw.trim() !== '').length} Custom Keyword{customKeywords.filter(kw => kw.trim() !== '').length !== 1 ? 's' : ''}
                </Button>
              </div>
            )}
          </div>

          {/* Search Section */}
          <div className="space-y-3 border-t pt-8">
            <Label className="text-sm font-semibold">Find Related Keywords</Label>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Enter keyword (e.g., web design)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSearch()
                  }
                }}
                disabled={isSearching || addKeywordsMutation.isPending}
              />
              <Button
                variant="outline"
                onClick={handleSearch}
                disabled={!searchTerm.trim() || isSearching || addKeywordsMutation.isPending}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 text-white" />
                )}
              </Button>
            </div>
          </div>

          {/* Results Section */}
          {keywordResults.length > 0 && (
            <div className="flex-1 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Select Keywords</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {selectedKeywords.size} keyword{selectedKeywords.size !== 1 ? 's' : ''} selected
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleSelectAll}
                    disabled={addKeywordsMutation.isPending}
                    className="h-7 text-xs"
                  >
                    Select All
                  </Button>
                  {selectedKeywords.size > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleDeselectAll}
                      disabled={addKeywordsMutation.isPending}
                      className="h-7 text-xs"
                    >
                      Deselect All
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted px-4 py-2 grid grid-cols-12 gap-3 text-xs font-medium">
                  <div className="col-span-1"></div>
                  <div className="col-span-6">Keyword</div>
                  <div className="col-span-3 text-right">Volume</div>
                  <div className="col-span-2 text-right">Difficulty</div>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {keywordResults.map((result) => (
                    <div
                      key={result.keyword}
                      className="px-4 py-3 border-t grid grid-cols-12 gap-3 items-center hover:bg-accent"
                    >
                      <div className="col-span-1">
                        <Checkbox
                          id={`keyword-${result.keyword}`}
                          checked={selectedKeywords.has(result.keyword)}
                          onCheckedChange={() => handleToggleKeyword(result.keyword)}
                        />
                      </div>
                      <label
                        htmlFor={`keyword-${result.keyword}`}
                        className="col-span-6 text-sm cursor-pointer"
                      >
                        {result.keyword}
                      </label>
                      <div className="col-span-3 text-sm text-right text-muted-foreground">
                        {result.search_volume.toLocaleString()}
                      </div>
                      <div className="col-span-2 text-sm text-right text-muted-foreground">
                        {result.difficulty ? result.difficulty.toFixed(1) : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Selected Keywords Pills */}
          {selectedKeywords.size > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
              {Array.from(selectedKeywords).map(keyword => (
                <div
                  key={keyword}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#006239] text-white text-xs"
                >
                  {keyword}
                  <button
                    onClick={() => handleToggleKeyword(keyword)}
                    className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                    disabled={addKeywordsMutation.isPending}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {keywordResults.length === 0 && !isSearching && selectedKeywords.size === 0 && (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  Add custom keywords above or search for keyword variations
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <p className="text-sm text-muted-foreground">
              {selectedKeywords.size > 0 && locationCount > 0
                ? `Will create ${selectedKeywords.size * locationCount} combination${(selectedKeywords.size * locationCount) !== 1 ? 's' : ''}`
                : ''}
            </p>
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={addKeywordsMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleApplyKeywords}
                style={{ backgroundColor: '#006239' }}
                className="hover:opacity-90 text-white"
                disabled={selectedKeywords.size === 0 || addKeywordsMutation.isPending}
              >
                {addKeywordsMutation.isPending 
                  ? 'Adding...' 
                  : `Apply ${selectedKeywords.size} Keyword${selectedKeywords.size !== 1 ? 's' : ''}`
                }
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


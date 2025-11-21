import { useState, useMemo, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2, X, Wand2, Loader2, CheckCircle2, XCircle, RefreshCw, Eye, ArrowUpToLine } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { generateContent, publishGeneratedPageToWordPress } from '@/api/content-generator'
import { checkRankings } from '@/api/rankings'
import { GoogleIcon } from '@/components/icons/GoogleIcon'

interface Combination {
  id: string
  phrase: string
  status: string
  position: number | null
  previous_position: number | null
  last_position_check: string | null
  location: {
    name: string
  }
  keyword: {
    keyword: string
    search_volume?: number
    difficulty?: number
  }
}

interface CombinationsTableProps {
  combinations: Combination[]
  projectId: string
}

export function CombinationsTable({ combinations, projectId }: CombinationsTableProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTown, setSelectedTown] = useState<string>('all')
  const [deleteMode, setDeleteMode] = useState(false)
  const [generateMode, setGenerateMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set())
  const [currentGeneratingId, setCurrentGeneratingId] = useState<string | null>(null)
  const [pushingIds, setPushingIds] = useState<Set<string>>(new Set())

  // Calculate generation progress
  const generationProgress = useMemo(() => {
    if (generatingIds.size === 0) return null

    const total = generatingIds.size
    const completed = Array.from(generatingIds).filter(id => {
      const combo = combinations.find(c => c.id === id)
      return combo && (combo.status === 'generated' || combo.status === 'error')
    }).length

    const generating = Array.from(generatingIds).filter(id => {
      const combo = combinations.find(c => c.id === id)
      return combo && combo.status === 'generating'
    }).length

    const successful = Array.from(generatingIds).filter(id => {
      const combo = combinations.find(c => c.id === id)
      return combo && combo.status === 'generated'
    }).length

    const failed = Array.from(generatingIds).filter(id => {
      const combo = combinations.find(c => c.id === id)
      return combo && combo.status === 'error'
    }).length

    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
    const isComplete = completed === total

    return {
      total,
      completed,
      generating,
      successful,
      failed,
      percentage,
      isComplete,
    }
  }, [combinations, generatingIds])

  // Clear generatingIds when all are complete
  useEffect(() => {
    if (generationProgress?.isComplete && generationProgress.total > 0) {
      const timer = setTimeout(() => {
        setGeneratingIds(new Set())
        setCurrentGeneratingId(null)
        
        // For batch operations, show summary toast
        if (generationProgress.total > 1) {
          if (generationProgress.successful > 0) {
            toast.success(`Successfully generated ${generationProgress.successful} page${generationProgress.successful !== 1 ? 's' : ''}`)
          }
          if (generationProgress.failed > 0) {
            toast.error(`${generationProgress.failed} generation${generationProgress.failed !== 1 ? 's' : ''} failed`)
          }
        }
      }, 3000) // Show completion state for 3 seconds

      return () => clearTimeout(timer)
    }
  }, [generationProgress])

  // Subscribe to real-time updates for location_keywords status changes
  useEffect(() => {
    const channel = supabase
      .channel('location_keywords_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'location_keywords',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          console.log('Real-time update received:', payload)
          
          // Show success toast for single-item generation when status changes
          const newStatus = payload.new?.status
          const oldStatus = payload.old?.status
          const recordId = payload.new?.id
          
          if (oldStatus === 'generating' && newStatus === 'generated') {
            // Only show toast for single-item operations
            if (recordId === currentGeneratingId && generatingIds.size === 1) {
              toast.success('Content generated successfully!')
            }
          } else if (oldStatus === 'generating' && (newStatus === 'error' || newStatus === 'failed')) {
            // Only show toast for single-item operations
            if (recordId === currentGeneratingId && generatingIds.size === 1) {
              toast.error('Content generation failed')
            }
          }
          
          // Refetch with a small delay to ensure DB is fully updated
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['projectCombinations', projectId] })
          }, 100)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, queryClient, currentGeneratingId, generatingIds])

  // Get unique towns for filter
  const uniqueTowns = useMemo(() => {
    const towns = new Set<string>()
    combinations.forEach(combo => {
      if (combo.location?.name) {
        towns.add(combo.location.name)
      }
    })
    return Array.from(towns).sort()
  }, [combinations])

  // Filter combinations
  const filteredCombinations = useMemo(() => {
    return combinations.filter(combo => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        combo.phrase.toLowerCase().includes(searchQuery.toLowerCase()) ||
        combo.location?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        combo.keyword?.keyword.toLowerCase().includes(searchQuery.toLowerCase())

      // Town filter
      const matchesTown = selectedTown === 'all' || combo.location?.name === selectedTown

      return matchesSearch && matchesTown
    })
  }, [combinations, searchQuery, selectedTown])

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('location_keywords')
        .delete()
        .in('id', ids)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success(`Deleted ${selectedIds.size} combination${selectedIds.size !== 1 ? 's' : ''}`)
      queryClient.invalidateQueries({ queryKey: ['projectCombinations', projectId] })
      setDeleteMode(false)
      setSelectedIds(new Set())
    },
    onError: (error: Error) => {
      toast.error('Error deleting combinations', {
        description: error.message,
      })
    },
  })

  const generateMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Track which IDs are being generated
      setGeneratingIds(new Set(ids))
      
      // Immediately refetch to show 'generating' status
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['projectCombinations', projectId] })
      }, 500)
      
      const response = await generateContent(ids)
      return response
    },
    onSuccess: () => {
      // Refetch to get final status
      queryClient.invalidateQueries({ queryKey: ['projectCombinations', projectId] })
      setGenerateMode(false)
      setSelectedIds(new Set())
      // Don't show toast here - will be shown when generation completes
    },
    onError: (error: Error) => {
      setGeneratingIds(new Set())
      toast.error('Error starting content generation', {
        description: error.message,
      })
    },
  })


  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleSelectAll = () => {
    // In generate mode, only select pending combinations
    const selectableCombinations = generateMode 
      ? filteredCombinations.filter(c => c.status === 'pending')
      : filteredCombinations
    
    if (selectedIds.size === selectableCombinations.length && selectableCombinations.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(selectableCombinations.map(c => c.id)))
    }
  }

  const handleDelete = () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one combination to delete')
      return
    }
    deleteMutation.mutate(Array.from(selectedIds))
  }

  const handleCancelDelete = () => {
    setDeleteMode(false)
    setSelectedIds(new Set())
  }

  const handleGenerate = () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one combination to generate')
      return
    }
    generateMutation.mutate(Array.from(selectedIds))
  }

  const handleCancelGenerate = () => {
    setGenerateMode(false)
    setSelectedIds(new Set())
  }

  // handleGenerateNext removed - using individual row regenerate icons instead

  const handleViewContent = (id: string) => {
    console.log('Navigating to view content:', { projectId, locationKeywordId: id })
    try {
      navigate({ 
        to: '/projects/$projectId/content/$locationKeywordId',
        params: { projectId, locationKeywordId: id }
      })
    } catch (error) {
      console.error('Navigation error:', error)
      // Fallback to direct URL navigation
      window.location.href = `/projects/${projectId}/content/${id}`
    }
  }

  // Mutation to generate or regenerate a single combination
  const singleGenerateMutation = useMutation({
    mutationFn: async ({ locationKeywordId, status }: { locationKeywordId: string, status: string }) => {
      console.log('🔄 MUTATION: Starting mutation for', locationKeywordId, 'with status', status)
      
      // Track this ID as generating
      setCurrentGeneratingId(locationKeywordId)
      setGeneratingIds(new Set([locationKeywordId]))
      
      // Immediately set status to 'generating' for visual feedback
      console.log('📝 MUTATION: Setting status to generating...')
      const { error: updateError } = await supabase
        .from('location_keywords')
        .update({ status: 'generating' })
        .eq('id', locationKeywordId)
      
      if (updateError) {
        console.error('❌ MUTATION: Update error:', updateError)
        throw updateError
      }
      console.log('✅ MUTATION: Status set to generating')

      // Small delay to ensure real-time subscription picks up the change
      await new Promise(resolve => setTimeout(resolve, 100))

      // Trigger generation (Edge Function will upsert the content)
      console.log('🤖 MUTATION: Calling generateContent API...')
      const response = await generateContent([locationKeywordId])
      console.log('✅ MUTATION: API call completed:', response)
      return response
    },
    onSuccess: (data, _variables) => {
      console.log('✅ MUTATION: onSuccess triggered', data)
      // Don't show success toast here - Edge Function will update status to 'generated' when complete
      // Real-time subscription will pick up the change and update the UI
      queryClient.invalidateQueries({ queryKey: ['projectCombinations', projectId] })
    },
    onError: (error: Error) => {
      console.error('❌ MUTATION: onError triggered', error)
      setCurrentGeneratingId(null)
      setGeneratingIds(new Set())
      toast.error('Failed to generate content', {
        description: error.message,
      })
    },
  })

  const handleSingleGenerate = (id: string, status: string) => {
    console.log('🎯 SINGLE GENERATE: Button clicked!')
    console.log('📍 SINGLE GENERATE: locationKeywordId:', id)
    console.log('📍 SINGLE GENERATE: status:', status)
    
    if (status === 'generating') {
      console.log('⚠️ SINGLE GENERATE: Already generating, aborting')
      toast.error('Content is already being generated')
      return
    }
    
    const isRegenerate = status === 'generated' || status === 'pushed' || status === 'error' || status === 'failed'
    toast.info(isRegenerate ? 'Starting content regeneration...' : 'Starting content generation...')
    
    console.log('✅ SINGLE GENERATE: Triggering mutation...')
    singleGenerateMutation.mutate({ locationKeywordId: id, status })
  }

  const handlePushToWordPress = async (id: string) => {
    setPushingIds(prev => new Set([...prev, id]))
    toast.info('Publishing to WordPress...')
    
    try {
      const result = await publishGeneratedPageToWordPress(id, projectId)
      
      if (result.success) {
        toast.success('Successfully published to WordPress!', {
          description: result.page_url ? `View page: ${result.page_url}` : undefined,
        })
        queryClient.invalidateQueries({ queryKey: ['projectCombinations', projectId] })
      } else {
        toast.error('Failed to publish to WordPress', {
          description: result.error,
        })
      }
    } catch (error) {
      toast.error('Error publishing to WordPress', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setPushingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const checkRankingsMutation = useMutation({
    mutationFn: async () => {
      return checkRankings({ project_id: projectId })
    },
    onSuccess: (data) => {
      toast.success('Rankings updated successfully!', {
        description: `Checked ${data.checked_count} combinations. ${data.ranked_count} ranked in top 100.`,
      })
      queryClient.invalidateQueries({ queryKey: ['projectCombinations', projectId] })
    },
    onError: (error: Error) => {
      toast.error('Error checking rankings', {
        description: error.message,
      })
    },
  })

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary'
      case 'generating':
        return 'outline'
      case 'generated':
        return 'default'
      case 'error':
        return 'destructive'
      case 'pushed':
        return 'default'
      default:
        return 'secondary'
    }
  }

  return (
    <div className="space-y-4">
      {/* Generation Progress Bar */}
      {generationProgress && (
        <div className="bg-card border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {generationProgress.isComplete ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Generation Complete!</span>
                </>
              ) : (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-[#006239]" />
                  <span className="font-medium">Generating Content...</span>
                </>
              )}
            </div>
            <div className="text-muted-foreground">
              {generationProgress.completed} of {generationProgress.total} complete
            </div>
          </div>
          
          <Progress 
            value={generationProgress.percentage} 
            className="h-2 [&>div]:bg-[#006239]"
          />
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{generationProgress.generating} generating</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              <span>{generationProgress.successful} successful</span>
            </div>
            {generationProgress.failed > 0 && (
              <div className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-600" />
                <span>{generationProgress.failed} failed</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search combinations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs"
        />
        
        <Select value={selectedTown} onValueChange={setSelectedTown}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by town" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Towns</SelectItem>
            {uniqueTowns.map(town => (
              <SelectItem key={town} value={town}>
                {town}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          {!deleteMode && !generateMode ? (
            <>
              {/* Generate Next button hidden - use individual row regenerate icons instead */}
              {/* <Button
                size="sm"
                onClick={handleGenerateNext}
                disabled={generateMutation.isPending || !filteredCombinations.some(c => c.status === 'pending')}
                variant="outline"
                className="border-[#006239] text-[#006239] hover:bg-[#006239] hover:text-white"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Generate Next
              </Button> */}
              <Button
                size="sm"
                onClick={() => setGenerateMode(true)}
                style={{ backgroundColor: '#006239' }}
                className="text-white hover:opacity-90"
              >
                <Wand2 className="mr-2 h-4 w-4" />
                Generate Content
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => checkRankingsMutation.mutate()}
                disabled={checkRankingsMutation.isPending}
                title="Check Google rankings for pushed pages"
              >
                {checkRankingsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GoogleIcon className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteMode(true)}
                title="Delete combinations"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : deleteMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelDelete}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={selectedIds.size === 0 || deleteMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelGenerate}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={selectedIds.size === 0 || generateMutation.isPending}
                style={{ backgroundColor: '#006239' }}
                className="text-white hover:opacity-90"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 h-4 w-4" />
                )}
                Generate {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredCombinations.length} of {combinations.length} combination{combinations.length !== 1 ? 's' : ''}
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {(deleteMode || generateMode) && (
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={(() => {
                      const selectableCombinations = generateMode 
                        ? filteredCombinations.filter(c => c.status === 'pending')
                        : filteredCombinations
                      return selectedIds.size === selectableCombinations.length && selectableCombinations.length > 0
                    })()}
                    onChange={handleSelectAll}
                    className="w-4 h-4 cursor-pointer accent-[#006239]"
                  />
                </TableHead>
              )}
              <TableHead>Phrase</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Keyword</TableHead>
              <TableHead className="text-right">Volume</TableHead>
              <TableHead className="text-right">Difficulty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Position</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCombinations.length === 0 ? (
              <TableRow>
                <TableCell 
                  colSpan={(deleteMode || generateMode) ? 9 : 8} 
                  className="text-center py-8 text-muted-foreground"
                >
                  No combinations found
                </TableCell>
              </TableRow>
            ) : (
              filteredCombinations.map((combo) => (
                <TableRow key={combo.id} className="hover:bg-accent/50">
                  {(deleteMode || generateMode) && (
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(combo.id)}
                        onChange={() => handleToggleSelect(combo.id)}
                        className="w-4 h-4 cursor-pointer accent-[#006239]"
                        disabled={generateMode && combo.status !== 'pending'}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{combo.phrase}</TableCell>
                  <TableCell>{combo.location?.name || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {combo.keyword?.keyword || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {combo.keyword?.search_volume ? combo.keyword.search_volume.toLocaleString() : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {combo.keyword?.difficulty ? combo.keyword.difficulty.toFixed(1) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={getStatusBadgeVariant(combo.status)}
                      className="text-xs"
                    >
                      {combo.status === 'generating' && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin inline" />
                      )}
                      {combo.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {combo.position !== null ? (
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-semibold text-[#006239]">#{combo.position}</span>
                        {combo.previous_position !== null && combo.previous_position !== combo.position && (
                          <span className={combo.position < combo.previous_position ? 'text-green-600 text-xs' : 'text-red-600 text-xs'}>
                            {combo.position < combo.previous_position ? '↑' : '↓'}
                            {Math.abs(combo.position - combo.previous_position)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {/* Generate/Regenerate Icon */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSingleGenerate(combo.id, combo.status)}
                        disabled={combo.status === 'generating' || currentGeneratingId === combo.id}
                        className="h-8 w-8 p-0"
                        title={
                          combo.status === 'generating' || currentGeneratingId === combo.id
                            ? 'Content is being generated'
                            : combo.status === 'pending'
                            ? 'Generate content'
                            : combo.status === 'generated' || combo.status === 'pushed'
                            ? 'Regenerate content'
                            : combo.status === 'error' || combo.status === 'failed'
                            ? 'Regenerate content (retry after error)'
                            : 'Generate/Regenerate content'
                        }
                      >
                        <RefreshCw 
                          className={`h-4 w-4 ${
                            combo.status === 'generating' || currentGeneratingId === combo.id
                              ? 'text-muted-foreground/30 cursor-not-allowed animate-spin'
                              : 'text-muted-foreground hover:text-[#006239] cursor-pointer'
                          }`}
                        />
                      </Button>
                      
                      {/* Push to WordPress Icon */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePushToWordPress(combo.id)}
                        disabled={
                          combo.status !== 'generated' || 
                          pushingIds.has(combo.id)
                        }
                        className="h-8 w-8 p-0"
                        title={
                          combo.status === 'generated'
                            ? 'Push to WordPress'
                            : combo.status === 'pushed'
                            ? 'Update on WordPress'
                            : pushingIds.has(combo.id)
                            ? 'Publishing to WordPress...'
                            : 'Content must be generated first'
                        }
                      >
                        <ArrowUpToLine 
                          className={`h-4 w-4 ${
                            pushingIds.has(combo.id)
                              ? 'text-muted-foreground animate-pulse'
                              : combo.status === 'generated' || combo.status === 'pushed'
                              ? 'text-muted-foreground hover:text-[#006239] cursor-pointer'
                              : 'text-muted-foreground/30 cursor-not-allowed'
                          }`}
                        />
                      </Button>
                      
                      {/* View Content Icon */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewContent(combo.id)}
                        disabled={combo.status !== 'generated' && combo.status !== 'pushed'}
                        className="h-8 w-8 p-0"
                        title={
                          combo.status === 'generated' || combo.status === 'pushed'
                            ? 'View content'
                            : 'Content not generated yet'
                        }
                      >
                        <Eye 
                          className={`h-4 w-4 ${
                            combo.status === 'generated' || combo.status === 'pushed'
                              ? 'text-muted-foreground hover:text-[#006239] cursor-pointer'
                              : 'text-muted-foreground/30 cursor-not-allowed'
                          }`}
                        />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}


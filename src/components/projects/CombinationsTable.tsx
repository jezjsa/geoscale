import { useState, useMemo, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
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
import { Trash2, X, Wand2, Loader2, CheckCircle2, XCircle, RefreshCw, Eye, ExternalLink, HelpCircle, Plus, Upload, Map } from 'lucide-react'
import { WordPressIcon } from '@/components/icons/WordPressIcon'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { publishGeneratedPageToWordPress } from '@/api/content-generator'
import { queueContentGeneration } from '@/api/content-queue'
import { queueWordPressPush } from '@/api/wordpress-queue'
import { QueueStatusIndicator } from './QueueStatusIndicator'
import { checkRankings } from '@/api/rankings'
import { togglePositionTracking, getTrackedCombinationsCount } from '@/api/combinations'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import { Switch } from '@/components/ui/switch'
import { GoogleIcon } from '@/components/icons/GoogleIcon'
import { useAuth } from '@/hooks/useAuth'

interface Combination {
  id: string
  phrase: string
  status: string
  wp_page_url: string | null
  position: number | null
  previous_position: number | null
  last_position_check: string | null
  track_position: boolean
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
  blogUrl?: string
  generateMode?: boolean
  onGenerateModeChange?: (mode: boolean) => void
  selectedIds?: Set<string>
  onSelectedIdsChange?: (ids: Set<string>) => void
  onGenerationTriggered?: (ids: string[]) => void
  isGenerating?: boolean
}

export function CombinationsTable({ 
  combinations, 
  projectId,
  generateMode: externalGenerateMode,
  onGenerateModeChange,
  selectedIds: externalSelectedIds,
  onSelectedIdsChange,
  onGenerationTriggered,
  isGenerating: externalIsGenerating,
}: CombinationsTableProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { limits, plan } = usePlanLimits()
  const [searchQuery, setSearchQuery] = useState('')
  
  // Check if user can use rank tracking (not Starter plan)
  const canUseRankTracking = plan?.rankTrackingFrequency !== null
  const [selectedTown, setSelectedTown] = useState<string>('all')
  const [deleteMode, setDeleteMode] = useState(false)
  const [internalGenerateMode, setInternalGenerateMode] = useState(false)
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set())
  
  // Use external state if provided, otherwise use internal state
  const generateMode = externalGenerateMode !== undefined ? externalGenerateMode : internalGenerateMode
  const selectedIds = externalSelectedIds !== undefined ? externalSelectedIds : internalSelectedIds
  
  const setGenerateMode = (mode: boolean) => {
    if (onGenerateModeChange) {
      onGenerateModeChange(mode)
    } else {
      setInternalGenerateMode(mode)
    }
  }
  
  const setSelectedIds = (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (onSelectedIdsChange) {
      if (typeof ids === 'function') {
        onSelectedIdsChange(ids(selectedIds))
      } else {
        onSelectedIdsChange(ids)
      }
    } else {
      setInternalSelectedIds(ids as any)
    }
  }
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set())
  const [currentGeneratingId, setCurrentGeneratingId] = useState<string | null>(null)
  const [pushingIds, setPushingIds] = useState<Set<string>>(new Set())
  const [showHelp, setShowHelp] = useState(false)
  const [trackedCount, setTrackedCount] = useState(0)
  const [togglingTrackIds, setTogglingTrackIds] = useState<Set<string>>(new Set())

  // Fetch tracked count on mount and when combinations change
  useEffect(() => {
    const fetchTrackedCount = async () => {
      try {
        const count = await getTrackedCombinationsCount(projectId)
        setTrackedCount(count)
      } catch (error) {
        console.error('Error fetching tracked count:', error)
      }
    }
    fetchTrackedCount()
  }, [projectId, combinations])

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

  // Check if rank tracking is available (daily quota system)
  const rankCheckInfo = useMemo(() => {
    // No rank tracking for Starter plan
    if (!plan?.rankCheckDailyBase && !plan?.rankCheckPerSite) {
      return { canCheck: false, message: 'Upgrade to Pro for rank tracking' }
    }

    // Count pushed combinations that can be checked
    const pushedCount = combinations.filter(c => c.status === 'pushed').length
    if (pushedCount === 0) {
      return { canCheck: false, message: 'No pushed pages to check' }
    }

    return { canCheck: true, message: `Check ${pushedCount} ranking${pushedCount !== 1 ? 's' : ''}` }
  }, [combinations, plan])

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
              toast.success('Content generated successfully!', {
                description: 'Ready to push to WordPress',
                action: {
                  label: 'Push to WordPress',
                  onClick: () => handlePushToWordPress(recordId)
                }
              })
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

  // Listen for external trigger to enter generate mode (from header button)
  useEffect(() => {
    const handleTriggerGenerateMode = () => {
      setGenerateMode(true)
      // Auto-select all pending combinations
      const pendingIds = combinations
        .filter(c => c.status === 'pending')
        .map(c => c.id)
      setSelectedIds(new Set(pendingIds))
    }

    window.addEventListener('triggerGenerateMode', handleTriggerGenerateMode)
    return () => {
      window.removeEventListener('triggerGenerateMode', handleTriggerGenerateMode)
    }
  }, [combinations])

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
      if (!user?.id) {
        throw new Error('User not authenticated')
      }

      console.log('📋 [UI] Queueing', ids.length, 'jobs for generation')
      
      // Queue the jobs instead of generating directly
      const response = await queueContentGeneration(ids, projectId, user.id)
      return response
    },
    onSuccess: (data) => {
      toast.success(`${data.jobsCreated} items queued for generation`, {
        description: 'Content will be generated in the background. You can navigate away.',
      })
      queryClient.invalidateQueries({ queryKey: ['projectCombinations', projectId] })
      setGenerateMode(false)
      setSelectedIds(new Set())
    },
    onError: (error: Error) => {
      setGeneratingIds(new Set())
      toast.error('Error queuing content generation', {
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
    // In delete mode, only select combinations that haven't been pushed
    const selectableCombinations = generateMode
      ? filteredCombinations.filter(c => c.status === 'pending')
      : deleteMode
      ? filteredCombinations.filter(c => c.status !== 'pushed')
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

    // Filter out any pushed combinations from the selection
    const deletableIds = Array.from(selectedIds).filter(id => {
      const combo = combinations.find(c => c.id === id)
      return combo && combo.status !== 'pushed'
    })

    // Check if any selected items were pushed (and thus can't be deleted)
    const pushedCount = selectedIds.size - deletableIds.length
    if (pushedCount > 0) {
      toast.error(`Cannot delete ${pushedCount} combination${pushedCount !== 1 ? 's' : ''} that ${pushedCount !== 1 ? 'have' : 'has'} been pushed to WordPress`, {
        description: 'Pushed combinations are locked to prevent gaming the system',
      })

      // If there are still some deletable items, continue with those
      if (deletableIds.length === 0) {
        return
      }
    }

    deleteMutation.mutate(deletableIds)
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
    // If external callback provided, use it; otherwise use internal mutation
    if (onGenerationTriggered) {
      onGenerationTriggered(Array.from(selectedIds))
    } else {
      generateMutation.mutate(Array.from(selectedIds))
    }
  }
  
  // Use external isGenerating state if provided
  const isGenerating = externalIsGenerating !== undefined ? externalIsGenerating : generateMutation.isPending

  const handleCancelGenerate = () => {
    setGenerateMode(false)
    setSelectedIds(new Set())
  }

  // handleGenerateNext removed - using individual row regenerate icons instead

  const handleViewContent = (id: string) => {
    console.log('Navigating to view content:', { projectId, locationKeywordId: id })
        navigate(`/projects/${projectId}/content/${id}`)
  }

  const handleViewHeatMap = (combination: Combination) => {
    console.log('Navigating to heat map:', { projectId, combination })
    navigate(`/projects/${projectId}/heat-map/${combination.id}`, {
      state: {
        phrase: combination.phrase,
        location: combination.location.name,
        keyword: combination.keyword.keyword
      }
    })
  }

  // Mutation to generate or regenerate a single combination
  const singleGenerateMutation = useMutation({
    mutationFn: async ({ locationKeywordId, status }: { locationKeywordId: string, status: string }) => {
      if (!user?.id) {
        throw new Error('User not authenticated')
      }

      console.log('🔄 [UI] Queueing single job for', locationKeywordId, 'with status', status)
      
      // Queue the job instead of generating directly
      const response = await queueContentGeneration([locationKeywordId], projectId, user.id)
      return response
    },
    onSuccess: (data, _variables) => {
      console.log('✅ [UI] Job queued successfully', data)
      toast.success('Content generation queued', {
        description: 'Your content will be generated in the background.',
      })
      queryClient.invalidateQueries({ queryKey: ['projectCombinations', projectId] })
    },
    onError: (error: Error) => {
      console.error('❌ [UI] Failed to queue job', error)
      setCurrentGeneratingId(null)
      setGeneratingIds(new Set())
      toast.error('Failed to queue content generation', {
        description: error.message,
      })
    },
  })

  const handleSingleGenerate = (id: string, status: string) => {
    console.log('🎯 SINGLE GENERATE: Button clicked!')
    console.log('📍 SINGLE GENERATE: locationKeywordId:', id)
    console.log('📍 SINGLE GENERATE: status:', status)
    
    if (status === 'generating' || status === 'queued') {
      console.log('⚠️ SINGLE GENERATE: Already generating/queued, aborting')
      toast.error(status === 'queued' ? 'Content is already queued' : 'Content is already being generated')
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

  // Mutation to queue all generated (unpushed) combinations for WordPress push
  const pushAllMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated')
      }

      // Get all generated (not pushed) combinations
      const generatedIds = combinations
        .filter(c => c.status === 'generated')
        .map(c => c.id)

      if (generatedIds.length === 0) {
        throw new Error('No generated pages to push')
      }

      console.log('📋 [UI] Queueing', generatedIds.length, 'pages for WordPress push')
      
      const response = await queueWordPressPush(generatedIds, projectId, user.id)
      return response
    },
    onSuccess: (data) => {
      toast.success(`${data.jobsCreated} pages queued for WordPress`, {
        description: 'Pages will be published in the background. You can navigate away.',
      })
      queryClient.invalidateQueries({ queryKey: ['projectCombinations', projectId] })
    },
    onError: (error: Error) => {
      toast.error('Error queuing WordPress push', {
        description: error.message,
      })
    },
  })

  // Count of generated (unpushed) combinations
  const generatedUnpushedCount = useMemo(() => {
    return combinations.filter(c => c.status === 'generated').length
  }, [combinations])

  const checkRankingsMutation = useMutation({
    mutationFn: async () => {
      return checkRankings({ project_id: projectId })
    },
    onSuccess: (data) => {
      const nextCheckMessage = limits.rankTrackingFrequency === 'every_other_day' 
        ? 'You can check again in 2 days.'
        : limits.rankTrackingFrequency === 'daily'
        ? 'You can check again tomorrow.'
        : limits.rankTrackingFrequency === 'weekly'
        ? 'You can check again in 7 days.'
        : ''
      
      toast.success('Rankings updated successfully!', {
        description: `Checked ${data.checked_count} combinations. ${data.ranked_count} ranked in top 100.${nextCheckMessage ? ` ${nextCheckMessage}` : ''}`,
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

  // Check if there are any queued items to show the queue status
  const hasQueuedItems = combinations.some(c => c.status === 'queued' || c.status === 'generating')

  return (
    <>
    <div className="space-y-4">
      {/* Queue Status Indicator - shows when items are queued */}
      {hasQueuedItems && <QueueStatusIndicator projectId={projectId} />}

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
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-dark)]" />
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
            className="h-2 [&>div]:bg-[var(--brand-dark)]"
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
      <div className="flex items-center gap-3 flex-wrap">
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
                className="border-[var(--brand-dark)] text-[var(--brand-dark)] hover:bg-[var(--brand-dark)] hover:text-white"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Generate Next
              </Button> */}
              {/* Push All to WordPress button - only show if there are generated unpushed pages */}
              {generatedUnpushedCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pushAllMutation.mutate()}
                  disabled={pushAllMutation.isPending}
                  title={`Push ${generatedUnpushedCount} generated page${generatedUnpushedCount !== 1 ? 's' : ''} to WordPress`}
                  className="border-[var(--brand-dark)] text-[var(--brand-dark)] hover:bg-[var(--brand-dark)]/10"
                >
                  {pushAllMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <WordPressIcon className="h-4 w-4" />
                  )}
                  <span className="ml-1">{generatedUnpushedCount}</span>
                </Button>
              )}
              {/* Hide Check Rankings button for Starter plan */}
              {canUseRankTracking && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => checkRankingsMutation.mutate()}
                  disabled={checkRankingsMutation.isPending || !rankCheckInfo.canCheck}
                  title={rankCheckInfo.message || "Check Google rankings for pushed pages"}
                >
                  {checkRankingsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <GoogleIcon className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteMode(true)}
                title="Delete combinations"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHelp(true)}
                title="Help & Instructions"
              >
                <HelpCircle className="h-4 w-4" />
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
            // Only show generate mode buttons here if NOT using external control
            // When using external control, buttons are in the card header
            !onGenerateModeChange ? (
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
                  disabled={selectedIds.size === 0 || isGenerating}
                  style={{ backgroundColor: 'var(--brand-dark)' }}
                  className="text-white hover:opacity-90"
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                  )}
                  Start Generation {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                </Button>
              </>
            ) : null
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
                        : deleteMode
                        ? filteredCombinations.filter(c => c.status !== 'pushed')
                        : filteredCombinations
                      return selectedIds.size === selectableCombinations.length && selectableCombinations.length > 0
                    })()}
                    onChange={handleSelectAll}
                    className="w-4 h-4 cursor-pointer accent-[var(--brand-dark)]"
                  />
                </TableHead>
              )}
              <TableHead>Combination Phrase</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Keyword</TableHead>
              <TableHead className="text-right">Volume</TableHead>
              <TableHead className="text-right">Difficulty</TableHead>
              <TableHead>Status</TableHead>
              {canUseRankTracking && (
                <>
                  <TableHead className="text-center">Track</TableHead>
                  <TableHead className="text-center">Position</TableHead>
                </>
              )}
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCombinations.length === 0 ? (
              <TableRow>
                <TableCell 
                  colSpan={(deleteMode || generateMode) ? (canUseRankTracking ? 10 : 8) : (canUseRankTracking ? 9 : 7)} 
                  className="text-center py-8 text-muted-foreground"
                >
                  No combinations found
                </TableCell>
              </TableRow>
            ) : (
              filteredCombinations.map((combo) => (
                <TableRow
                  key={combo.id}
                  className="hover:bg-accent/50"
                >
                  {(deleteMode || generateMode) && (
                    <TableCell className={deleteMode && combo.status === 'pushed' ? 'opacity-50' : ''}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(combo.id)}
                        onChange={() => handleToggleSelect(combo.id)}
                        className="w-4 h-4 cursor-pointer accent-[var(--brand-dark)]"
                        disabled={
                          (generateMode && combo.status !== 'pending') ||
                          (deleteMode && combo.status === 'pushed')
                        }
                        title={
                          deleteMode && combo.status === 'pushed'
                            ? 'Cannot delete - already pushed to WordPress'
                            : undefined
                        }
                      />
                    </TableCell>
                  )}
                  <TableCell className={`font-bold ${deleteMode && combo.status === 'pushed' ? 'opacity-50' : ''}`}>
                    {combo.status === 'generated' || combo.status === 'pushed' ? (
                      <button
                        onClick={() => handleViewContent(combo.id)}
                        className="text-left underline hover:text-[var(--brand-dark)] cursor-pointer transition-colors"
                      >
                        {combo.phrase}
                      </button>
                    ) : (
                      <span>{combo.phrase}</span>
                    )}
                  </TableCell>
                  <TableCell className={deleteMode && combo.status === 'pushed' ? 'opacity-50' : ''}>{combo.location?.name || '-'}</TableCell>
                  <TableCell className={`text-sm text-muted-foreground ${deleteMode && combo.status === 'pushed' ? 'opacity-50' : ''}`}>
                    {combo.keyword?.keyword || '-'}
                  </TableCell>
                  <TableCell className={`text-right ${deleteMode && combo.status === 'pushed' ? 'opacity-50' : ''}`}>
                    {combo.keyword?.search_volume ? combo.keyword.search_volume.toLocaleString() : '-'}
                  </TableCell>
                  <TableCell className={`text-right ${deleteMode && combo.status === 'pushed' ? 'opacity-50' : ''}`}>
                    {combo.keyword?.difficulty ? combo.keyword.difficulty.toFixed(1) : '-'}
                  </TableCell>
                  <TableCell className={deleteMode && combo.status === 'pushed' ? 'opacity-50' : ''}>
                    <Badge
                      variant={getStatusBadgeVariant(combo.status)}
                      className="text-xs"
                      style={combo.status === 'generated' ? {
                        backgroundColor: '#c2410c',
                        color: 'white',
                        borderColor: '#c2410c'
                      } : combo.status === 'pushed' ? {
                        backgroundColor: 'var(--brand-dark)',
                        color: 'white',
                        borderColor: 'var(--brand-dark)'
                      } : combo.status === 'generating' ? {
                        backgroundColor: '#2563eb',
                        color: 'white',
                        borderColor: '#2563eb'
                      } : combo.status === 'queued' ? {
                        backgroundColor: '#7c3aed',
                        color: 'white',
                        borderColor: '#7c3aed'
                      } : undefined}
                    >
                      {(combo.status === 'generating' || combo.status === 'queued') && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin inline" />
                      )}
                      {combo.status}
                    </Badge>
                  </TableCell>
                  {canUseRankTracking && (
                    <>
                      <TableCell className={`text-center ${deleteMode && combo.status === 'pushed' ? 'opacity-50' : ''}`}>
                        <Switch
                          checked={combo.track_position || false}
                          disabled={togglingTrackIds.has(combo.id) || (!combo.track_position && trackedCount >= limits.rankTrackingLimit)}
                          onCheckedChange={async (checked) => {
                            // Check if trying to enable and at limit
                            if (checked && trackedCount >= limits.rankTrackingLimit) {
                              toast.error(`You've reached your tracking limit of ${limits.rankTrackingLimit} combinations. Upgrade to track more.`)
                              return
                            }

                            setTogglingTrackIds(prev => new Set(prev).add(combo.id))
                            try {
                              await togglePositionTracking(combo.id, checked)
                              setTrackedCount(prev => checked ? prev + 1 : prev - 1)
                              queryClient.invalidateQueries({ queryKey: ['combinations', projectId] })
                              toast.success(checked ? 'Position tracking enabled' : 'Position tracking disabled')
                            } catch (error) {
                              toast.error('Failed to update tracking')
                            } finally {
                              setTogglingTrackIds(prev => {
                                const next = new Set(prev)
                                next.delete(combo.id)
                                return next
                              })
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className={`text-center ${deleteMode && combo.status === 'pushed' ? 'opacity-50' : ''}`}>
                        {combo.position !== null ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className="font-semibold text-[var(--brand-dark)]">#{combo.position}</span>
                            {combo.previous_position !== null && combo.previous_position !== combo.position && (
                              <span className={combo.position < combo.previous_position ? 'text-green-600 text-xs' : 'text-red-600 text-xs'}>
                                {combo.position < combo.previous_position ? '↑' : '↓'}
                                {Math.abs(combo.position - combo.previous_position)}
                              </span>
                            )}
                          </div>
                        ) : combo.last_position_check ? (
                          <span className="text-xs text-muted-foreground">100+</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </>
                  )}
                  <TableCell className="opacity-100">
                    <div className="flex items-center gap-1">
                      {/* Generate/Regenerate Icon */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSingleGenerate(combo.id, combo.status)}
                        disabled={combo.status === 'generating' || combo.status === 'queued' || currentGeneratingId === combo.id}
                        className="h-8 w-8 p-0"
                        title={
                          combo.status === 'queued'
                            ? 'Content is queued for generation'
                            : combo.status === 'generating' || currentGeneratingId === combo.id
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
                            combo.status === 'generating' || combo.status === 'queued' || currentGeneratingId === combo.id
                              ? 'text-muted-foreground/30 cursor-not-allowed animate-spin'
                              : 'text-muted-foreground hover:text-[var(--brand-dark)] cursor-pointer'
                          }`}
                        />
                      </Button>
                      
                      {/* Push to WordPress Icon */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePushToWordPress(combo.id)}
                        disabled={
                          (combo.status !== 'generated' && combo.status !== 'pushed') || 
                          pushingIds.has(combo.id)
                        }
                        className="h-9 w-9 p-0"
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
                        <WordPressIcon 
                          className={`text-lg ${
                            pushingIds.has(combo.id)
                              ? 'text-blue-400 animate-pulse'
                              : combo.status === 'pushed'
                              ? 'text-blue-500 hover:text-blue-600 cursor-pointer'
                              : combo.status === 'generated'
                              ? 'text-orange-500 hover:text-orange-600 cursor-pointer'
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
                              ? 'text-muted-foreground hover:text-[var(--brand-dark)] cursor-pointer'
                              : 'text-muted-foreground/30 cursor-not-allowed'
                          }`}
                        />
                      </Button>
                      
                      {/* Heat Map Icon */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewHeatMap(combo)}
                        className="h-8 w-8 p-0"
                        title="View ranking heat map"
                      >
                        <Map 
                          className="h-4 w-4 text-muted-foreground hover:text-[var(--brand-dark)] cursor-pointer"
                        />
                      </Button>
                      
                      {/* External Link Icon - Only show if pushed to WordPress */}
                      {combo.status === 'pushed' && combo.wp_page_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(combo.wp_page_url!, '_blank')}
                          className="h-8 w-8 p-0"
                          title="View on WordPress"
                        >
                          <ExternalLink 
                            className="h-4 w-4 text-muted-foreground hover:text-[var(--brand-dark)] cursor-pointer"
                          />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Help Panel - Slides in from right */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-background border-l shadow-2xl transform transition-transform duration-300 ease-in-out z-50 overflow-y-auto ${
          showHelp ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6">
          {/* Header with close button */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Help & Instructions</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHelp(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Instructions Content */}
          <div className="space-y-6 text-sm">
            {/* Getting Started */}
            <section>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <Plus className="h-5 w-5 text-[var(--brand-dark)]" />
                Getting Started
              </h3>
              <div className="space-y-3 ml-7">
                <div>
                  <p className="font-medium mb-1">1. Add Services (Services Tab)</p>
                  <p className="text-muted-foreground">First, go to the Services tab and add your services (e.g., "Web Design"). We'll automatically find related keywords with search volume data for you to select.</p>
                </div>
                <div>
                  <p className="font-medium mb-1">2. Add Locations</p>
                  <p className="text-muted-foreground">Click "Add Locations" to enter towns/cities you want to target. Each location is combined with your selected keywords to create landing page combinations.</p>
                </div>
                <div>
                  <p className="font-medium mb-1 flex items-center gap-1">
                    <Upload className="h-4 w-4" /> Upload CSV
                  </p>
                  <p className="text-muted-foreground">Alternatively, bulk upload specific location-keyword combinations from a CSV file. Download the template for the correct format.</p>
                </div>
              </div>
            </section>

            {/* Adding More */}
            <section>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <Plus className="h-5 w-5 text-[var(--brand-dark)]" />
                Adding More Combinations
              </h3>
              <div className="space-y-3 ml-7">
                <div>
                  <p className="font-medium mb-1">Add Locations Button</p>
                  <p className="text-muted-foreground">Add more towns/cities. Duplicates are automatically detected - you'll see a warning if a town already exists in your project.</p>
                </div>
                <div>
                  <p className="font-medium mb-1">Keywords Button</p>
                  <p className="text-muted-foreground">Research and add new keywords. These will be combined with all your existing locations.</p>
                </div>
              </div>
            </section>

            {/* Managing Combinations */}
            <section>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-[var(--brand-dark)]" />
                Managing Content
              </h3>
              <div className="space-y-3 ml-7">
                <div>
                  <p className="font-medium mb-1 flex items-center gap-1">
                    <RefreshCw className="h-4 w-4" /> Generate/Regenerate
                  </p>
                  <p className="text-muted-foreground">Click the refresh icon on any row to generate or regenerate AI content. Jobs are queued and processed in the background.</p>
                  <p className="text-muted-foreground mt-1 text-xs italic">You can regenerate content even for combinations already pushed to WordPress - useful for SEO optimization.</p>
                </div>
                <div>
                  <p className="font-medium mb-1 flex items-center gap-1">
                    <WordPressIcon className="text-orange-500" /> / <WordPressIcon className="text-blue-500" /> Push to WordPress
                  </p>
                  <p className="text-muted-foreground">Publish generated content to your WordPress site. <span className="text-orange-500 font-medium">Orange</span> = ready to push, <span className="text-blue-500 font-medium">Blue</span> = already pushed.</p>
                </div>
                <div>
                  <p className="font-medium mb-1 flex items-center gap-1">
                    <Eye className="h-4 w-4" /> View Content
                  </p>
                  <p className="text-muted-foreground">Preview and edit generated content. Click the eye icon or the phrase itself to view.</p>
                </div>
                <div>
                  <p className="font-medium mb-1 flex items-center gap-1">
                    <ExternalLink className="h-4 w-4" /> View on WordPress
                  </p>
                  <p className="text-muted-foreground">Opens the published page on your WordPress site in a new tab. Only visible for pushed content.</p>
                </div>
              </div>
            </section>

            {/* Status Badges */}
            <section>
              <h3 className="font-semibold text-lg mb-3">Status Indicators</h3>
              <div className="space-y-2 ml-7">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">pending</Badge>
                  <span className="text-muted-foreground">Ready to generate content</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    queued
                  </Badge>
                  <span className="text-muted-foreground">Waiting in queue for generation</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    generating
                  </Badge>
                  <span className="text-muted-foreground">AI is creating content</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="text-xs" style={{ backgroundColor: '#c2410c', color: 'white' }}>generated</Badge>
                  <span className="text-muted-foreground">Content ready to publish</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="text-xs" style={{ backgroundColor: 'var(--brand-dark)', color: 'white' }}>pushed</Badge>
                  <span className="text-muted-foreground">Published to WordPress</span>
                </div>
              </div>
            </section>

            {/* Bulk Actions */}
            <section>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-[var(--brand-dark)]" />
                Bulk Actions
              </h3>
              <div className="space-y-3 ml-7">
                <div>
                  <p className="font-medium mb-1 flex items-center gap-1">
                    <Wand2 className="h-4 w-4" /> Generate Content
                  </p>
                  <p className="text-muted-foreground">Select multiple pending combinations and generate content for all at once. Jobs are queued and you can navigate away.</p>
                </div>
                <div>
                  <p className="font-medium mb-1 flex items-center gap-1">
                    <Trash2 className="h-4 w-4" /> Delete
                  </p>
                  <p className="text-muted-foreground">Select multiple combinations to delete them. This action cannot be undone.</p>
                  <p className="text-muted-foreground mt-1 text-xs italic">Note: Combinations that have been pushed to WordPress cannot be deleted to prevent gaming plan limits. However, you can still regenerate their content for SEO optimization.</p>
                </div>
              </div>
            </section>

            {/* Ranking */}
            <section>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <GoogleIcon className="h-5 w-5" />
                Google Rankings
              </h3>
              <div className="space-y-2 ml-7">
                <p className="text-muted-foreground">Click the Google icon to check current rankings for all pushed pages. Rankings are tracked over time with position changes indicated by arrows.</p>
              </div>
            </section>

            {/* Filtering */}
            <section>
              <h3 className="font-semibold text-lg mb-3">Filtering & Search</h3>
              <div className="space-y-2 ml-7">
                <p className="text-muted-foreground">Use the search box to filter by phrase, and the dropdown to filter by specific towns. Combine both for precise filtering.</p>
              </div>
            </section>
          </div>
        </div>
      </div>

    </div>

    {/* Overlay when help panel is open */}
    {showHelp && (
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={() => setShowHelp(false)}
      />
    )}
    </>
  )
}


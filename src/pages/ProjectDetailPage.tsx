import { useState, useEffect } from 'react'
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Navigation } from '@/components/Navigation'
import { useAuth } from '@/hooks/useAuth'
import { InlineEdit } from '@/components/InlineEdit'
import { AddFirstCombinationDialog } from '@/components/projects/AddFirstCombinationDialog'
import { AddSpecificCombinationsDialog } from '@/components/projects/AddSpecificCombinationsDialog'
import { AddLocationsDialog } from '@/components/projects/AddLocationsDialog'
import { AddServiceDialog } from '@/components/projects/AddServiceDialog'
import { ResearchKeywordsDialog } from '@/components/projects/ResearchKeywordsDialog'
import { UploadCsvDialog } from '@/components/projects/UploadCsvDialog'
import { CombinationsTable } from '@/components/projects/CombinationsTable'
import { ProjectTestimonialsManager } from '@/components/projects/ProjectTestimonialsManager'
import { ProjectTestimonialsAddButton } from '@/components/projects/ProjectTestimonialsAddButton'
import { WordPressApiKeyDisplay } from '@/components/projects/WordPressApiKeyDisplay'
import { ProjectServicesManager } from '@/components/projects/ProjectServicesManager'
import { ProjectLocationsManager } from '@/components/projects/ProjectLocationsManager'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ArrowLeft, Plus, Upload, AlertTriangle, Wand2, X, Loader2 } from 'lucide-react'
import { getProject, updateProject } from '@/api/projects'
import { getProjectCombinations, getTrackedCombinationsCount } from '@/api/combinations'
import { generateCombinations } from '@/api/combination-generator'
import { getProjectServices, getProjectCombinationStats } from '@/api/services'
import { fetchWordPressTemplates, testWordPressConnection } from '@/api/wordpress'
import { queueContentGeneration } from '@/api/content-queue'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { generateWordPressApiKey } from '@/utils/api-key-generator'
import { getCurrentUserPlan } from '@/lib/plan-service'

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const currentView = (searchParams.get('view') as 'combinations' | 'services' | 'locations' | 'testimonials' | 'settings') || 'combinations'
  const queryClient = useQueryClient()
  
  // Check if user is on individual plan (not agency)
  const isIndividualUser = user?.plan !== 'agency'
  
  if (!projectId) {
    return <div>Project not found</div>
  }
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showAddFirstDialog, setShowAddFirstDialog] = useState(false)
  const [showAddSpecificDialog, setShowAddSpecificDialog] = useState(false)
  const [showAddLocationsDialog, setShowAddLocationsDialog] = useState(false)
  const [showAddServiceDialog, setShowAddServiceDialog] = useState(false)
  const [showResearchKeywordsDialog, setShowResearchKeywordsDialog] = useState(false)
  const [showUploadCsvDialog, setShowUploadCsvDialog] = useState(false)
  const [wpTemplates, setWpTemplates] = useState<Array<{ value: string; label: string }>>([])
  
  // Generate mode state (lifted from CombinationsTable for header buttons)
  const [generateMode, setGenerateMode] = useState(false)
  const [generateSelectedIds, setGenerateSelectedIds] = useState<Set<string>>(new Set())
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [wpConnectionVerified, setWpConnectionVerified] = useState(false)
  const [isRegeneratingApiKey, setIsRegeneratingApiKey] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [isGeocodingTown, setIsGeocodingTown] = useState(false)
  
  const setCurrentView = (view: 'combinations' | 'services' | 'locations' | 'testimonials' | 'settings') => {
    setSearchParams({ view })
  }

  // Get user's plan for combination limit
  const { data: userPlan } = useQuery({
    queryKey: ['userPlan', user?.id],
    queryFn: () => getCurrentUserPlan(user?.id),
    enabled: !!user?.id,
  })
  
  // Use per-website limit instead of total limit
  const combinationLimit = userPlan?.combinationsPerWebsite || userPlan?.combinationPageLimit || 100

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
  })

  const { data: combinations, isLoading: combinationsLoading } = useQuery({
    queryKey: ['projectCombinations', projectId],
    queryFn: () => getProjectCombinations(projectId),
  })

  // Get services for this project (to check if onboarding is needed)
  const { data: services = [] } = useQuery({
    queryKey: ['projectServices', projectId],
    queryFn: () => getProjectServices(projectId),
  })

  // Check if any services exist (keywords are optional - user can add locations once services exist)
  const hasServices = services.length > 0

  // Get location count for this project
  const { data: locationCount = 0 } = useQuery({
    queryKey: ['projectLocationCount', projectId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('project_locations')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
      if (error) throw error
      return count || 0
    },
  })

  // Get combination stats (includes selected keyword count)
  const { data: combinationStats } = useQuery({
    queryKey: ['projectCombinationStats', projectId],
    queryFn: () => getProjectCombinationStats(projectId),
  })
  const selectedKeywordCount = combinationStats?.selectedKeywordCount || 0
  
  // Get tracked count for this project
  const { data: trackedCount = 0 } = useQuery({
    queryKey: ['trackedCount', projectId],
    queryFn: () => getTrackedCombinationsCount(projectId),
  })

  // Per-project tracking limit
  const trackingLimit = userPlan?.rankTrackingLimit || 50

  // Redirect to combinations view on initial load if both services and locations are empty
  // and no explicit view is set in URL (indicating user didn't choose a tab)
  useEffect(() => {
    const urlView = searchParams.get('view')
    if (!urlView && !hasServices && locationCount === 0) {
      setCurrentView('combinations')
    }
  }, [hasServices, locationCount])

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: 'active' | 'inactive') => {
      const { error } = await supabase
        .from('projects')
        .update({ project_status: newStatus })
        .eq('id', projectId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['agencyProjects'] })
      toast.success('Project status updated successfully')
      setShowStatusModal(false)
    },
    onError: (error: Error) => {
      toast.error('Error updating project status', {
        description: error.message,
      })
    },
  })

  // Mutation to generate combinations from existing services/keywords and locations
  const generateCombinationsMutation = useMutation({
    mutationFn: async () => {
      return generateCombinations({ project_id: projectId })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectCombinations', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectCombinationStats', projectId] })
      toast.success('Combinations created successfully!', {
        description: `Created ${data.created_count} new combination${data.created_count !== 1 ? 's' : ''}.`,
      })
    },
    onError: (error: Error) => {
      toast.error('Error creating combinations', {
        description: error.message,
      })
    },
  })

  // Mutation to queue content generation for selected combinations
  const queueGenerationMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user?.id) {
        throw new Error('User not authenticated')
      }
      return queueContentGeneration(ids, projectId, user.id)
    },
    onSuccess: (data) => {
      toast.success(`Queued ${data.jobsCreated} combination${data.jobsCreated !== 1 ? 's' : ''} for generation`, {
        description: 'Content will be generated in the background. You can navigate away.',
      })
      queryClient.invalidateQueries({ queryKey: ['projectCombinations', projectId] })
      setGenerateMode(false)
      setGenerateSelectedIds(new Set())
    },
    onError: (error: Error) => {
      toast.error('Error queueing generation', {
        description: error.message,
      })
    },
  })

  // Handler for when generation is triggered from CombinationsTable
  const handleGenerationTriggered = (ids: string[]) => {
    queueGenerationMutation.mutate(ids)
  }

  // Handler to enter generate mode and auto-select pending combinations
  const handleEnterGenerateMode = () => {
    setGenerateMode(true)
    // Auto-select all pending combinations
    const pendingIds = combinations
      ?.filter(c => c.status === 'pending')
      .map(c => c.id) || []
    setGenerateSelectedIds(new Set(pendingIds))
  }

  // Handler to cancel generate mode
  const handleCancelGenerateMode = () => {
    setGenerateMode(false)
    setGenerateSelectedIds(new Set())
  }

  const handleFieldUpdate = async (field: string, value: string | boolean) => {
    try {
      await updateProject(projectId, { [field]: value })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['agencyProjects'] })
      toast.success('Field updated successfully')
    } catch (error) {
      toast.error('Error updating field', {
        description: error instanceof Error ? error.message : 'Failed to save',
      })
      throw error
    }
  }

  const handleTownUpdate = async (townName: string) => {
    if (!townName.trim()) {
      await handleFieldUpdate('town', '')
      return
    }

    setIsGeocodingTown(true)
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(townName + ', UK')}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
      )
      const data = await response.json()

      if (data.status === 'OK' && data.results.length > 0) {
        const location = data.results[0].geometry.location
        await updateProject(projectId, {
          town: townName,
          latitude: location.lat,
          longitude: location.lng
        })
        queryClient.invalidateQueries({ queryKey: ['project', projectId] })
        queryClient.invalidateQueries({ queryKey: ['agencyProjects'] })
        toast.success(`Location set to ${townName} (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`)
      } else {
        toast.error('Could not find coordinates for this town', {
          description: 'Please check the spelling and try again'
        })
      }
    } catch (error) {
      toast.error('Error geocoding town', {
        description: error instanceof Error ? error.message : 'Failed to get coordinates'
      })
    } finally {
      setIsGeocodingTown(false)
    }
  }

  const handlePageTemplateUpdate = async (value: string) => {
    try {
      await updateProject(projectId, { wp_page_template: value })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['agencyProjects'] })
      toast.success('Page template updated successfully')
    } catch (error) {
      toast.error('Error updating page template', {
        description: error instanceof Error ? error.message : 'Failed to save',
      })
    }
  }

  // Load WordPress templates when project has WP URL and API key
  useEffect(() => {
    const wpUrl = project?.blog_url || project?.wp_url
    if (wpUrl && project?.wp_api_key) {
      loadWpTemplates()
    } else {
      // Reset templates if WP settings are removed
      setWpTemplates([])
    }
  }, [project?.blog_url, project?.wp_url, project?.wp_api_key])

  const loadWpTemplates = async () => {
    const wpUrl = project?.blog_url || project?.wp_url
    if (!wpUrl || !project?.wp_api_key) return
    
    setLoadingTemplates(true)
    try {
      const templates = await fetchWordPressTemplates(wpUrl, project.wp_api_key)
      setWpTemplates(templates)
      setWpConnectionVerified(true) // Successfully loaded templates = connection works
    } catch (error) {
      console.error('Failed to load WordPress templates:', error)
      // Silently fail - user can still use default template
      // This is expected if WordPress plugin isn't installed yet
      setWpTemplates([
        { value: '', label: 'Default Template' }
      ])
      setWpConnectionVerified(false) // Failed to load = connection not verified
    } finally {
      setLoadingTemplates(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Project not found</p>
        </div>
      </div>
    )
  }

  const newStatus = project.project_status === 'active' ? 'inactive' : 'active'

  return (
    <div className="min-h-screen bg-background pt-16">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        {/* Header with title and back button */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold">
                <span className="text-gray-400">Client / </span>
                {project.company_name || project.project_name}
              </h1>
              <p className="text-sm text-muted-foreground mt-1 flex gap-4">
                <span>
                  Combo Pages: <span className={`font-medium ${
                    (combinations?.length || 0) >= combinationLimit 
                      ? 'text-red-600' 
                      : (combinations?.length || 0) >= combinationLimit * 0.8 
                      ? 'text-orange-600' 
                      : 'text-foreground'
                  }`}>{combinations?.length || 0} / {combinationLimit}</span>
                </span>
                <span>
                  Tracking: <span className={`font-medium ${
                    trackedCount >= trackingLimit 
                      ? 'text-red-600' 
                      : trackedCount >= trackingLimit * 0.8 
                      ? 'text-orange-600' 
                      : 'text-foreground'
                  }`}>{trackedCount} / {trackingLimit}</span>
                </span>
              </p>
            </div>
            {!isIndividualUser && (
              <Button 
                variant="outline" 
                size="sm"
                asChild
                className="bg-transparent hover:bg-gray-100 text-black border-0 dark:bg-transparent dark:hover:bg-gray-700 dark:text-white dark:hover:text-white"
              >
                <Link to="/settings">
                  <ArrowLeft className="mr-1 h-3 w-3" />
                  Back to Projects
                </Link>
              </Button>
            )}
            {isIndividualUser && (
              <Button 
                variant="outline" 
                size="sm"
                asChild
                className="bg-transparent hover:bg-gray-100 text-black border-0 dark:bg-transparent dark:hover:bg-gray-700 dark:text-white dark:hover:text-white"
              >
                <Link to="/dashboard">
                  <ArrowLeft className="mr-1 h-3 w-3" />
                  Back to Dashboard
                </Link>
              </Button>
            )}
          </div>

          {/* View switcher buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setCurrentView('combinations')}
              className={currentView === 'combinations' 
                ? 'bg-white text-[#0b6074] font-bold border-gray-800 hover:bg-white hover:text-[#0b6074] dark:bg-white dark:text-[#0b6074] dark:font-bold dark:border-white dark:hover:bg-white dark:hover:text-[#0b6074]' 
                : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-300 dark:bg-[#3a3a3a] dark:text-white dark:border-[#3a3a3a] dark:hover:bg-[#4a4a4a]'}
            >
              Keyword Combinations
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentView('services')}
              className={currentView === 'services' 
                ? 'bg-white text-[#0b6074] font-bold border-gray-800 hover:bg-white hover:text-[#0b6074] dark:bg-white dark:text-[#0b6074] dark:font-bold dark:border-white dark:hover:bg-white dark:hover:text-[#0b6074]' 
                : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-300 dark:bg-[#3a3a3a] dark:text-white dark:border-[#3a3a3a] dark:hover:bg-[#4a4a4a]'}
            >
              Services
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentView('locations')}
              className={currentView === 'locations' 
                ? 'bg-white text-[#0b6074] font-bold border-gray-800 hover:bg-white hover:text-[#0b6074] dark:bg-white dark:text-[#0b6074] dark:font-bold dark:border-white dark:hover:bg-white dark:hover:text-[#0b6074]' 
                : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-300 dark:bg-[#3a3a3a] dark:text-white dark:border-[#3a3a3a] dark:hover:bg-[#4a4a4a]'}
            >
              Locations
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentView('testimonials')}
              className={currentView === 'testimonials' 
                ? 'bg-white text-[#0b6074] font-bold border-gray-800 hover:bg-white hover:text-[#0b6074] dark:bg-white dark:text-[#0b6074] dark:font-bold dark:border-white dark:hover:bg-white dark:hover:text-[#0b6074]' 
                : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-300 dark:bg-[#3a3a3a] dark:text-white dark:border-[#3a3a3a] dark:hover:bg-[#4a4a4a]'}
            >
              Testimonials
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentView('settings')}
              className={currentView === 'settings' 
                ? 'bg-white text-[#0b6074] font-bold border-gray-800 hover:bg-white hover:text-[#0b6074] dark:bg-white dark:text-[#0b6074] dark:font-bold dark:border-white dark:hover:bg-white dark:hover:text-[#0b6074]' 
                : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-300 dark:bg-[#3a3a3a] dark:text-white dark:border-[#3a3a3a] dark:hover:bg-[#4a4a4a]'}
            >
              Project Settings
            </Button>
            {/* Hide Sitemap for Starter plan (no rank tracking) */}
            {userPlan?.rankTrackingFrequency && (
              <div className="ml-auto">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/projects/${projectId}/sitemap`)}
                  className="bg-white hover:bg-gray-50 text-gray-600 border-gray-300 dark:bg-[#3a3a3a] dark:text-white dark:border-[#3a3a3a] dark:hover:bg-[#4a4a4a]"
                >
                  Metadata Editor
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Main content area - full width */}
        <div>
            {currentView === 'combinations' ? (
              <>
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>Location & Keyword Combinations</CardTitle>
                      <CardDescription>
                        Configure locations and keywords for page generation
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                {combinationsLoading ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <p>Loading combinations...</p>
                  </div>
                ) : !combinations || combinations.length === 0 ? (
                  <div className="py-8">
                    <div className="max-w-3xl mx-auto">
                      <h3 className="text-lg font-medium text-center mb-6">Get Started</h3>
                      <p className="text-center text-muted-foreground mb-6">
                        Add your services, then locations and we'll instantly create combination SEO pages for you, e.g. web design in Doncaster
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Step 1 - Services */}
                        <div className={`rounded-lg border p-5 flex flex-col ${services.length > 0 ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium ${services.length > 0 ? 'bg-green-600 text-white' : 'bg-[var(--brand-dark)] text-white'}`}>
                              {services.length > 0 ? '✓' : '1'}
                            </span>
                            <h4 className="font-medium">Add Services</h4>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3 flex-1">
                            E.g. Web Design.
                          </p>
                          <p className="text-sm text-muted-foreground mb-3 flex-1">
                           We'll find related keywords with search volume data.
                          </p>
                          {services.length > 0 && (
                            <p className="text-sm font-medium mb-3">You have {services.length} service{services.length !== 1 ? 's' : ''}.</p>
                          )}
                          <Button
                            size="sm"
                            variant={services.length > 0 ? "outline" : "default"}
                            style={services.length === 0 ? { backgroundColor: 'var(--brand-dark)' } : {}}
                            className={services.length === 0 ? "hover:opacity-90 text-white w-full" : "w-full"}
                            onClick={() => setShowAddServiceDialog(true)}
                          >
                            {services.length > 0 ? 'Add More Services' : 'Add Services'}
                          </Button>
                        </div>

                        {/* Step 2 - Locations */}
                        <div className={`rounded-lg border p-5 flex flex-col ${combinations && combinations.length > 0 ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : hasServices ? 'bg-gray-50 dark:bg-gray-800/50' : 'bg-gray-100 dark:bg-gray-800/30 opacity-60'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium ${combinations && combinations.length > 0 ? 'bg-green-600 text-white' : hasServices ? 'bg-[var(--brand-dark)] text-white' : 'bg-gray-400 text-white'}`}>
                              {combinations && combinations.length > 0 ? '✓' : '2'}
                            </span>
                            <h4 className="font-medium">Add Locations</h4>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3 flex-1">
                            E.g. London.
                          </p>
                          <p className="text-sm text-muted-foreground flex-1">
                            Each location combines with your services.
                          </p>
                          {!hasServices && (
                            <p className="text-xs text-orange-500 mb-3">Add services first</p>
                          )}
                          {locationCount > 0 && (
                            <p className="text-sm font-medium mt-3">You have {locationCount} location{locationCount !== 1 ? 's' : ''}.</p>
                          )}
                          <Button
                            size="sm"
                            variant={locationCount > 0 ? "outline" : !hasServices ? "outline" : "default"}
                            style={locationCount === 0 && hasServices ? { backgroundColor: 'var(--brand-dark)' } : {}}
                            className={locationCount === 0 && hasServices ? "hover:opacity-90 text-white w-full mt-3" : "w-full mt-3"}
                            onClick={() => setShowAddLocationsDialog(true)}
                            disabled={!hasServices}
                          >
                            {locationCount > 0 ? 'Add More Locations' : 'Add Locations'}
                          </Button>
                        </div>

                        {/* Step 3 - Generate */}
                        {(() => {
                          const canGenerate = hasServices && locationCount > 0 && selectedKeywordCount > 0;
                          const potentialCombinations = selectedKeywordCount * locationCount;
                          return (
                            <div className={`rounded-lg border p-5 flex flex-col ${canGenerate ? 'bg-gray-50 dark:bg-gray-800/50' : 'bg-gray-100 dark:bg-gray-800/30 opacity-60'}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium ${canGenerate ? 'bg-[var(--brand-dark)] text-white' : 'bg-gray-400 text-white'}`}>
                                  3
                                </span>
                                <h4 className="font-medium">Generate Content</h4>
                              </div>
                              <p className="text-sm text-muted-foreground flex-1">
                                Generate AI-powered landing pages for each keyword + location combination.
                              </p>
                              {!canGenerate && (
                                <p className="text-xs text-muted-foreground mb-3">Complete steps 1 & 2 first</p>
                              )}
                              {canGenerate && (
                                <p className="text-sm font-medium mb-3">{selectedKeywordCount} keyword{selectedKeywordCount !== 1 ? 's' : ''} × {locationCount} location{locationCount !== 1 ? 's' : ''}</p>
                              )}
                              <Button
                                size="sm"
                                variant={canGenerate ? "default" : "outline"}
                                style={canGenerate ? { backgroundColor: 'var(--brand-dark)' } : {}}
                                className={canGenerate ? "hover:opacity-90 text-white w-full" : "w-full"}
                                disabled={!canGenerate || generateCombinationsMutation.isPending}
                                onClick={() => generateCombinationsMutation.mutate()}
                              >
                                {generateCombinationsMutation.isPending 
                                  ? 'Creating...'
                                  : canGenerate 
                                    ? `Create ${potentialCombinations} Combination${potentialCombinations !== 1 ? 's' : ''}`
                                    : 'Create Combinations'
                                }
                              </Button>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Alternative: CSV Upload */}
                      <div className="mt-6 text-center">
                        <p className="text-sm text-muted-foreground mb-2">Or import existing data:</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowUploadCsvDialog(true)}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Upload CSV
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <CombinationsTable
                      generateButton={
                        !generateMode ? (
                          <Button
                            size="sm"
                            onClick={handleEnterGenerateMode}
                            style={{ backgroundColor: '#1b9497' }}
                            className="text-white hover:opacity-90"
                          >
                            <Wand2 className="mr-2 h-4 w-4" />
                            Generate Content
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCancelGenerateMode}
                            >
                              <X className="mr-2 h-4 w-4" />
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleGenerationTriggered(Array.from(generateSelectedIds))}
                              disabled={generateSelectedIds.size === 0 || queueGenerationMutation.isPending}
                              style={{ backgroundColor: 'var(--brand-dark)' }}
                              className="text-white hover:opacity-90"
                            >
                              {queueGenerationMutation.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Wand2 className="mr-2 h-4 w-4" />
                              )}
                              Start Generation {generateSelectedIds.size > 0 ? `(${generateSelectedIds.size})` : ''}
                            </Button>
                          </>
                        )
                      }
                      addButtons={
                        <div className="flex flex-wrap gap-2 ml-auto">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowAddServiceDialog(true)}
                            style={{ borderColor: '#1b9497', color: '#1b9497' }}
                            className="bg-white hover:bg-gray-100 dark:bg-[#1b9497]/10 dark:text-[#1b9497] dark:hover:bg-[#1b9497]/20"
                          >
                            <Plus className="mr-0 h-4 w-4" />
                            Services
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowResearchKeywordsDialog(true)}
                            style={{ borderColor: '#1b9497', color: '#1b9497' }}
                            className="bg-white hover:bg-gray-100 dark:bg-[#1b9497]/10 dark:text-[#1b9497] dark:hover:bg-[#1b9497]/20"
                          >
                            <Plus className="mr-0 h-4 w-4" />
                            Keywords
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowAddLocationsDialog(true)}
                            style={{ borderColor: '#1b9497', color: '#1b9497' }}
                            className="bg-white hover:bg-gray-100 dark:bg-[#1b9497]/10 dark:text-[#1b9497] dark:hover:bg-[#1b9497]/20"
                          >
                            <Plus className="mr-0 h-4 w-4" />
                            Locations
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowUploadCsvDialog(true)}
                            className="bg-white hover:bg-gray-100 dark:bg-transparent"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Upload CSV
                          </Button>
                        </div>
                      } 
                      combinations={combinations} 
                      projectId={projectId}
                      blogUrl={project?.blog_url || project?.wp_url}
                      generateMode={generateMode}
                      onGenerateModeChange={setGenerateMode}
                      selectedIds={generateSelectedIds}
                      onSelectedIdsChange={setGenerateSelectedIds}
                      onGenerationTriggered={handleGenerationTriggered}
                      isGenerating={queueGenerationMutation.isPending}
                    />
                  </div>
                )}
                </CardContent>
              </Card>
              {/* Starter plan upsell message */}
              {userPlan?.name === 'starter' && (
                <p className="text-sm text-gray-400 dark:text-gray-600 mt-3 text-center">
                  Volume and difficulty scores show within the Pro and Agency plans.
                </p>
              )}
            </>
            ) : currentView === 'services' ? (
              <ProjectServicesManager 
                projectId={projectId} 
                combinationLimit={combinationLimit}
                wpUrl={project?.wp_url}
              />
            ) : currentView === 'locations' ? (
              <ProjectLocationsManager projectId={projectId} />
            ) : currentView === 'testimonials' ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Customer Testimonials</CardTitle>
                      <CardDescription>
                        Add testimonials from your customers that will be woven into AI-generated content
                      </CardDescription>
                    </div>
                    <ProjectTestimonialsAddButton projectId={projectId} />
                  </div>
                </CardHeader>
                <CardContent>
                  <ProjectTestimonialsManager projectId={projectId} />
                </CardContent>
              </Card>
            ) : currentView === 'settings' ? (
            <Card>
              <CardHeader>
                  <CardTitle>Project Settings</CardTitle>
                  <CardDescription>
                    Manage project information, contact details, and WordPress configuration
                  </CardDescription>
              </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    {/* Left Column - Project Details */}
                    <div className="space-y-6 border rounded-lg p-6">
                      <h3 className="text-lg font-semibold mb-2">Project Details</h3>
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-md p-3 mb-4">
                        <p className="text-sm text-muted-foreground">
                          These details are used in your AI-generated content to personalise pages with your business information and contact details.
                        </p>
                      </div>
                      
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                  <Badge 
                    className="text-xs"
                    style={project.project_status === 'active' ? { 
                      backgroundColor: '#313131', 
                      color: 'white',
                      borderColor: '#313131'
                    } : {
                      backgroundColor: '#541c15',
                      color: 'white',
                      borderColor: '#541c15'
                    }}
                  >
                    {project.project_status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Contact Name</p>
                  <InlineEdit
                    value={project.contact_name}
                    onSave={(value) => handleFieldUpdate('contact_name', value)}
                    placeholder="Enter contact name"
                  />
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Contact Email</p>
                  <InlineEdit
                    value={project.contact_email}
                    onSave={(value) => handleFieldUpdate('contact_email', value)}
                    type="email"
                    placeholder="Enter contact email"
                  />
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Phone</p>
                  <InlineEdit
                    value={project.phone_number}
                    onSave={(value) => handleFieldUpdate('phone_number', value)}
                    type="tel"
                    placeholder="Enter phone number"
                  />
                </div>

                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Contact URL</p>
                        <InlineEdit
                          value={project.contact_url}
                          onSave={(value) => handleFieldUpdate('contact_url', value)}
                          type="url"
                          placeholder="Enter contact URL"
                        />
                      </div>

                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Service Description</p>
                        <InlineEdit
                          value={project.service_description}
                          onSave={(value) => handleFieldUpdate('service_description', value)}
                          multiline
                          placeholder="Enter service description"
                        />
                      </div>

                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Town/City (for Heat Map)</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <InlineEdit
                              value={project.town}
                              onSave={handleTownUpdate}
                              placeholder="e.g., Doncaster"
                            />
                          </div>
                          {isGeocodingTown && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        </div>
                        {project.latitude && project.longitude ? (
                          <p className="text-xs text-muted-foreground mt-1">
                            Coordinates: {Number(project.latitude).toFixed(4)}, {Number(project.longitude).toFixed(4)}
                          </p>
                        ) : (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            Enter a town name to set the center point for ranking heat maps
                          </p>
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Created</p>
                        <p className="text-sm">{new Date(project.created_at).toLocaleDateString()}</p>
                      </div>

                      <div className="pt-4 border-t">
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setShowStatusModal(true)}
                        >
                          Change Status to {newStatus === 'active' ? 'Active' : 'Inactive'}
                        </Button>
                      </div>
                    </div>

                    {/* Right Column - WordPress Settings */}
                    <div className="space-y-6 border rounded-lg p-6">
                      <h3 className="text-lg font-semibold mb-2">WordPress Settings</h3>
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-md p-3 mb-4">
                        <p className="text-sm text-muted-foreground">
                          Configure your WordPress connection to publish generated pages directly to your website.
                        </p>
                      </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">WordPress URL</p>
                  <InlineEdit
                    value={project.wp_url}
                    onSave={(value) => handleFieldUpdate('wp_url', value)}
                    type="url"
                    placeholder="Enter WordPress URL"
                  />
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Blog Root URL</p>
                  <InlineEdit
                    value={project.blog_url}
                    onSave={(value) => handleFieldUpdate('blog_url', value)}
                    type="url"
                    placeholder="e.g., https://example.com/blog"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Root URL where pages are published. Used for rank tracking.
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">WordPress API Key</p>
                  <WordPressApiKeyDisplay
                    apiKey={project.wp_api_key}
                    wordpressUrl={project.blog_url || project.wp_url}
                    isRegenerating={isRegeneratingApiKey}
                    isTesting={isTestingConnection}
                    connectionVerified={wpConnectionVerified}
                    onTestConnection={async () => {
                      try {
                        setIsTestingConnection(true)
                        const testUrl = project.blog_url || project.wp_url
                        const result = await testWordPressConnection(testUrl, project.wp_api_key)
                        if (result.success) {
                          toast.success(result.message)
                          setWpConnectionVerified(true)
                          // Reload templates now that connection is verified
                          loadWpTemplates()
                        } else {
                          toast.error(result.message)
                          setWpConnectionVerified(false)
                        }
                      } catch (error) {
                        toast.error('Failed to test connection')
                        setWpConnectionVerified(false)
                      } finally {
                        setIsTestingConnection(false)
                      }
                    }}
                    onRegenerate={async () => {
                      try {
                        setIsRegeneratingApiKey(true)
                        const newApiKey = generateWordPressApiKey()
                        await handleFieldUpdate('wp_api_key', newApiKey)
                        toast.success('API key regenerated successfully')
                      } catch (error) {
                        toast.error('Failed to regenerate API key')
                      } finally {
                        setIsRegeneratingApiKey(false)
                      }
                    }}
                  />
                </div>

                {/* WordPress Connection Warning */}
                {(!(project.blog_url || project.wp_url) || !project.wp_api_key || (!wpConnectionVerified && !loadingTemplates)) && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-800 dark:text-amber-400">WordPress connection required</p>
                        <p className="text-amber-700 dark:text-amber-500 text-xs mt-1">
                          {!(project.blog_url || project.wp_url) 
                            ? 'Enter your WordPress URL above to connect.'
                            : !project.wp_api_key
                            ? 'Generate an API key and add it to your WordPress plugin settings.'
                            : 'Install the GeoScale plugin on your WordPress site and paste the API key into the plugin settings. Then click the test button above to verify the connection.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Page Template</p>
                        <Select
                          value={project.wp_page_template || undefined}
                          onValueChange={handlePageTemplateUpdate}
                          disabled={loadingTemplates || !(project.blog_url || project.wp_url) || !project.wp_api_key || !wpConnectionVerified}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={loadingTemplates ? 'Loading templates...' : 'Select template'} />
                          </SelectTrigger>
                          <SelectContent>
                            {wpTemplates.length > 0 ? (
                              wpTemplates.map((template) => (
                                <SelectItem key={template.value || 'default'} value={template.value || 'default'}>
                                  {template.label}
                                </SelectItem>
                              ))
                            ) : (
                              !loadingTemplates && (
                                <SelectItem value="default">
                                  Default Template
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          {!(project.blog_url || project.wp_url) || !project.wp_api_key 
                            ? 'Configure WordPress URL and API key to load templates'
                            : wpTemplates.length === 0 && !loadingTemplates
                            ? 'Test your connection above to load available templates'
                            : 'WordPress page template for generated pages'}
                        </p>
                </div>

                <div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="wp-publish-status" className="text-sm font-medium text-muted-foreground">
                              Publish Status
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              {project.wp_publish_status === 'publish' ? 'Publish pages immediately' : 'Save pages as drafts'}
                            </p>
                          </div>
                          <Switch
                            id="wp-publish-status"
                            checked={project.wp_publish_status === 'publish'}
                            onCheckedChange={(checked) => 
                              handleFieldUpdate('wp_publish_status', checked ? 'publish' : 'draft')
                            }
                  />
                </div>
                      </div>
                </div>
                </div>
              </CardContent>
            </Card>
            ) : null}
        </div>
      </div>

      {/* Add First Combination Dialog (Simple) */}
      <AddFirstCombinationDialog
        projectId={projectId}
        open={showAddFirstDialog}
        onOpenChange={setShowAddFirstDialog}
      />

      {/* Add Towns Dialog (Complex) - Legacy */}
      <AddSpecificCombinationsDialog
        projectId={projectId}
        open={showAddSpecificDialog}
        onOpenChange={setShowAddSpecificDialog}
        baseKeyword={project?.base_keyword || ''}
      />

      {/* Add Service Dialog (for onboarding flow) */}
      <AddServiceDialog
        projectId={projectId}
        wpUrl={project?.wp_url}
        open={showAddServiceDialog}
        onOpenChange={setShowAddServiceDialog}
      />

      {/* Add Locations Dialog (New - uses keywords from Services) */}
      <AddLocationsDialog
        projectId={projectId}
        open={showAddLocationsDialog}
        onOpenChange={setShowAddLocationsDialog}
      />

      {/* Research Keywords Dialog */}
      <ResearchKeywordsDialog
        projectId={projectId}
        open={showResearchKeywordsDialog}
        onOpenChange={setShowResearchKeywordsDialog}
      />

      {/* Upload CSV Dialog */}
      <UploadCsvDialog
        projectId={projectId}
        open={showUploadCsvDialog}
        onOpenChange={setShowUploadCsvDialog}
      />

      {/* Status Change Confirmation Modal */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Project Status</DialogTitle>
            <DialogDescription>
              Are you sure you want to change this project's status to <strong>{newStatus}</strong>?
              {newStatus === 'inactive' && (
                <span className="block mt-2 text-destructive">
                  This will deactivate the project and stop any automated processes.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusModal(false)}>
              Cancel
            </Button>
            <Button
              style={{ backgroundColor: 'var(--brand-dark)' }}
              className="hover:opacity-90 text-white"
              onClick={() => updateStatusMutation.mutate(newStatus)}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? 'Updating...' : 'Confirm Change'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


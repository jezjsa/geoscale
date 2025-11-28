import { useState, useEffect } from 'react'
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Navigation } from '@/components/Navigation'
import { useAuth } from '@/hooks/useAuth'
import { InlineEdit } from '@/components/InlineEdit'
import { AddFirstCombinationDialog } from '@/components/projects/AddFirstCombinationDialog'
import { AddSpecificCombinationsDialog } from '@/components/projects/AddSpecificCombinationsDialog'
import { AddLocationsDialog } from '@/components/projects/AddLocationsDialog'
import { ResearchKeywordsDialog } from '@/components/projects/ResearchKeywordsDialog'
import { UploadCsvDialog } from '@/components/projects/UploadCsvDialog'
import { CombinationsTable } from '@/components/projects/CombinationsTable'
import { ProjectTestimonialsManager } from '@/components/projects/ProjectTestimonialsManager'
import { ProjectTestimonialsAddButton } from '@/components/projects/ProjectTestimonialsAddButton'
import { WordPressApiKeyDisplay } from '@/components/projects/WordPressApiKeyDisplay'
import { ProjectServicesManager } from '@/components/projects/ProjectServicesManager'
import { ServiceFaqsManager } from '@/components/projects/ServiceFaqsManager'
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
import { ArrowLeft, Plus, Upload } from 'lucide-react'
import { getProject, updateProject } from '@/api/projects'
import { getProjectCombinations, getTrackedCombinationsCount } from '@/api/combinations'
import { fetchWordPressTemplates, testWordPressConnection } from '@/api/wordpress'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { generateWordPressApiKey } from '@/utils/api-key-generator'
import { getCurrentUserPlan } from '@/lib/plan-service'

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const currentView = (searchParams.get('view') as 'combinations' | 'services' | 'testimonials' | 'faqs' | 'settings') || 'combinations'
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
  const [showResearchKeywordsDialog, setShowResearchKeywordsDialog] = useState(false)
  const [showUploadCsvDialog, setShowUploadCsvDialog] = useState(false)
  const [wpTemplates, setWpTemplates] = useState<Array<{ value: string; label: string }>>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [isRegeneratingApiKey, setIsRegeneratingApiKey] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  
  const setCurrentView = (view: 'combinations' | 'services' | 'testimonials' | 'faqs' | 'settings') => {
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

  // Get tracked count for this project
  const { data: trackedCount = 0 } = useQuery({
    queryKey: ['trackedCount', projectId],
    queryFn: () => getTrackedCombinationsCount(projectId),
  })

  // Per-project tracking limit
  const trackingLimit = userPlan?.rankTrackingLimit || 50

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
    } catch (error) {
      console.error('Failed to load WordPress templates:', error)
      // Silently fail - user can still use default template
      // This is expected if WordPress plugin isn't installed yet
      setWpTemplates([
        { value: '', label: 'Default Template' }
      ])
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
                className="bg-transparent hover:bg-gray-100 text-black border-gray-300 dark:bg-transparent dark:hover:bg-gray-700 dark:text-white dark:hover:text-white dark:border-gray-600"
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
                className="bg-transparent hover:bg-gray-100 text-black border-gray-300 dark:bg-transparent dark:hover:bg-gray-700 dark:text-white dark:hover:text-white dark:border-gray-600"
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
                ? 'bg-[#3a3a3a] text-white border-[#3a3a3a] hover:bg-[#4a4a4a] hover:text-white dark:bg-white dark:text-black dark:border-white dark:hover:bg-gray-100 dark:hover:text-black' 
                : 'bg-btn-secondary-bg hover:bg-btn-secondary-hover text-black border-gray-300 dark:bg-[#3a3a3a] dark:text-white dark:border-[#3a3a3a] dark:hover:bg-[#4a4a4a]'}
            >
              Keyword Combinations
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentView('services')}
              className={currentView === 'services' 
                ? 'bg-[#3a3a3a] text-white border-[#3a3a3a] hover:bg-[#4a4a4a] hover:text-white dark:bg-white dark:text-black dark:border-white dark:hover:bg-gray-100 dark:hover:text-black' 
                : 'bg-btn-secondary-bg hover:bg-btn-secondary-hover text-black border-gray-300 dark:bg-[#3a3a3a] dark:text-white dark:border-[#3a3a3a] dark:hover:bg-[#4a4a4a]'}
            >
              Services
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentView('faqs')}
              className={currentView === 'faqs' 
                ? 'bg-[#3a3a3a] text-white border-[#3a3a3a] hover:bg-[#4a4a4a] hover:text-white dark:bg-white dark:text-black dark:border-white dark:hover:bg-gray-100 dark:hover:text-black' 
                : 'bg-btn-secondary-bg hover:bg-btn-secondary-hover text-black border-gray-300 dark:bg-[#3a3a3a] dark:text-white dark:border-[#3a3a3a] dark:hover:bg-[#4a4a4a]'}
            >
              FAQs
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentView('testimonials')}
              className={currentView === 'testimonials' 
                ? 'bg-[#3a3a3a] text-white border-[#3a3a3a] hover:bg-[#4a4a4a] hover:text-white dark:bg-white dark:text-black dark:border-white dark:hover:bg-gray-100 dark:hover:text-black' 
                : 'bg-btn-secondary-bg hover:bg-btn-secondary-hover text-black border-gray-300 dark:bg-[#3a3a3a] dark:text-white dark:border-[#3a3a3a] dark:hover:bg-[#4a4a4a]'}
            >
              Testimonials
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentView('settings')}
              className={currentView === 'settings' 
                ? 'bg-[#3a3a3a] text-white border-[#3a3a3a] hover:bg-[#4a4a4a] hover:text-white dark:bg-white dark:text-black dark:border-white dark:hover:bg-gray-100 dark:hover:text-black' 
                : 'bg-btn-secondary-bg hover:bg-btn-secondary-hover text-black border-gray-300 dark:bg-[#3a3a3a] dark:text-white dark:border-[#3a3a3a] dark:hover:bg-[#4a4a4a]'}
            >
              Project Settings
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/projects/${projectId}/sitemap`)}
              className="bg-btn-secondary-bg hover:bg-btn-secondary-hover text-black border-gray-300 dark:bg-[#3a3a3a] dark:text-white dark:border-[#3a3a3a] dark:hover:bg-[#4a4a4a]"
            >
              WordPress Sitemap
            </Button>
          </div>
        </div>

        {/* Main content area - full width */}
        <div>
            {currentView === 'combinations' ? (
              <Card>
                <CardHeader>
                  <CardTitle>Location & Keyword Combinations</CardTitle>
                  <CardDescription>
                    Configure locations and keywords for page generation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                {combinationsLoading ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <p>Loading combinations...</p>
                  </div>
                ) : !combinations || combinations.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="max-w-md mx-auto space-y-4">
                      <h3 className="text-lg font-medium">Add your first combination</h3>
                      <p className="text-sm text-muted-foreground">
                        Start by entering your base location and keyword. We'll automatically find nearby towns 
                        and generate keyword variations to create your location-based landing pages.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          style={{ backgroundColor: 'var(--brand-dark)' }}
                          className="hover:opacity-90 text-white"
                          onClick={() => setShowAddLocationsDialog(true)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Locations
                        </Button>
                        <Button
                          variant="outline"
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
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-medium">All Combinations</h3>
                      <div className="flex flex-wrap gap-2">
                        {/* Temporarily hidden - Google Places API has 31-mile radius limit */}
                        {/* <Button
                          size="sm"
                          style={{ backgroundColor: 'var(--brand-dark)' }}
                          className="hover:opacity-90 text-white"
                          onClick={() => setShowAddCombinationDialog(true)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Expand Search
                        </Button> */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAddLocationsDialog(true)}
                          style={{ borderColor: 'var(--brand-dark)', color: 'var(--brand-dark)' }}
                          className="bg-white hover:bg-gray-100 dark:bg-[var(--brand-dark)]/10 dark:text-white dark:hover:bg-[var(--brand-dark)]/20"
                        >
                          <Plus className="mr-0 h-4 w-4" />
                          Add Locations
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowResearchKeywordsDialog(true)}
                          style={{ borderColor: 'var(--brand-dark)', color: 'var(--brand-dark)' }}
                          className="bg-white hover:bg-gray-100 dark:bg-[var(--brand-dark)]/10 dark:text-white dark:hover:bg-[var(--brand-dark)]/20"
                        >
                                <Plus className="mr-0 h-4 w-4" />
                          Keywords
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
                    </div>
                    <CombinationsTable 
                      combinations={combinations} 
                      projectId={projectId}
                      blogUrl={project?.blog_url || project?.wp_url}
                    />
                  </div>
                )}
                </CardContent>
              </Card>
            ) : currentView === 'services' ? (
              <ProjectServicesManager 
                projectId={projectId} 
                combinationLimit={combinationLimit}
              />
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
            ) : currentView === 'faqs' ? (
              <ServiceFaqsManager projectId={projectId} />
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
                      <h3 className="text-lg font-semibold mb-4">Project Details</h3>
                      
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
                      <h3 className="text-lg font-semibold mb-4">WordPress Settings</h3>

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
                    onTestConnection={async () => {
                      try {
                        setIsTestingConnection(true)
                        const testUrl = project.blog_url || project.wp_url
                        const result = await testWordPressConnection(testUrl, project.wp_api_key)
                        if (result.success) {
                          toast.success(result.message)
                        } else {
                          toast.error(result.message)
                        }
                      } catch (error) {
                        toast.error('Failed to test connection')
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

                <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Page Template</p>
                        <Select
                          value={project.wp_page_template || undefined}
                          onValueChange={handlePageTemplateUpdate}
                          disabled={loadingTemplates || !(project.blog_url || project.wp_url) || !project.wp_api_key}
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
                            ? 'Install the GeoScale WordPress plugin to see available templates'
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


import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Navigation } from '@/components/Navigation'
import { InlineEdit } from '@/components/InlineEdit'
import { AddSpecificCombinationsDialog } from '@/components/projects/AddSpecificCombinationsDialog'
import { ResearchKeywordsDialog } from '@/components/projects/ResearchKeywordsDialog'
import { UploadCsvDialog } from '@/components/projects/UploadCsvDialog'
import { CombinationsTable } from '@/components/projects/CombinationsTable'
import { ProjectTestimonialsManager } from '@/components/projects/ProjectTestimonialsManager'
import { ProjectTestimonialsAddButton } from '@/components/projects/ProjectTestimonialsAddButton'
import { WordPressApiKeyDisplay } from '@/components/projects/WordPressApiKeyDisplay'
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
import { getProjectCombinations } from '@/api/combinations'
import { fetchWordPressTemplates } from '@/api/wordpress'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export function ProjectDetailPage() {
  const { projectId } = useParams({ from: '/projects/$projectId' })
  const search = useSearch({ from: '/projects/$projectId' })
  const currentView = search.view || 'combinations'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showAddSpecificDialog, setShowAddSpecificDialog] = useState(false)
  const [showResearchKeywordsDialog, setShowResearchKeywordsDialog] = useState(false)
  const [showUploadCsvDialog, setShowUploadCsvDialog] = useState(false)
  const [wpTemplates, setWpTemplates] = useState<Array<{ value: string; label: string }>>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  
  const setCurrentView = (view: 'combinations' | 'testimonials') => {
    navigate({
      to: '/projects/$projectId',
      params: { projectId },
      search: { view },
    })
  }

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
  })

  const { data: combinations, isLoading: combinationsLoading } = useQuery({
    queryKey: ['projectCombinations', projectId],
    queryFn: () => getProjectCombinations(projectId),
  })

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
    } catch (error) {
      toast.error('Error updating field', {
        description: error instanceof Error ? error.message : 'Failed to save',
      })
      throw error
    }
  }

  // Load WordPress templates when project has WP URL and API key
  useEffect(() => {
    if (project?.wp_url && project?.wp_api_key) {
      loadWpTemplates()
    } else {
      // Reset templates if WP settings are removed
      setWpTemplates([])
    }
  }, [project?.wp_url, project?.wp_api_key])

  const loadWpTemplates = async () => {
    if (!project?.wp_url || !project?.wp_api_key) return
    
    setLoadingTemplates(true)
    try {
      const templates = await fetchWordPressTemplates(project.wp_url, project.wp_api_key)
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
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Project not found</p>
        </div>
      </div>
    )
  }

  const newStatus = project.project_status === 'active' ? 'inactive' : 'active'

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        {/* Header with title and back button */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-4xl font-bold">
              <span className="text-gray-400">Client / </span>
              {project.company_name || project.project_name}
            </h1>
            <Button 
              variant="outline" 
              asChild
            >
              <Link to="/settings">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Projects
              </Link>
            </Button>
          </div>

          {/* View switcher buttons */}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setCurrentView('combinations')}
              style={currentView === 'combinations' ? {
                backgroundColor: '#3a3a3a'
              } : {}}
              className={currentView === 'combinations' ? 'text-white hover:bg-[#4a4a4a]' : 'bg-card hover:bg-[#4a4a4a] hover:text-white'}
            >
              Combinations
            </Button>
            <Button
              variant="ghost"
              onClick={() => setCurrentView('testimonials')}
              style={currentView === 'testimonials' ? {
                backgroundColor: '#3a3a3a'
              } : {}}
              className={currentView === 'testimonials' ? 'text-white hover:bg-[#4a4a4a]' : 'bg-card hover:bg-[#4a4a4a] hover:text-white'}
            >
              Customer Testimonials
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Main content area - 9 columns */}
          <div className="col-span-12 lg:col-span-9">
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
                          style={{ backgroundColor: '#006239' }}
                          className="hover:opacity-90 text-white"
                          onClick={() => setShowAddSpecificDialog(true)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Auto-Generate
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
                          style={{ backgroundColor: '#006239' }}
                          className="hover:opacity-90 text-white"
                          onClick={() => setShowAddCombinationDialog(true)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Expand Search
                        </Button> */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAddSpecificDialog(true)}
                          style={{ borderColor: '#006239', color: 'white' }}
                          className="bg-transparent hover:bg-[#006239]/10"
                        >
                          <Plus className="mr-0 h-4 w-4" />
                          Towns
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowResearchKeywordsDialog(true)}
                          style={{ borderColor: '#006239', color: 'white' }}
                          className="bg-transparent hover:bg-[#006239]/10"
                        >
                                <Plus className="mr-0 h-4 w-4" />
                          Keywords
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowUploadCsvDialog(true)}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Upload CSV
                        </Button>
                      </div>
                    </div>
                    <CombinationsTable combinations={combinations} projectId={projectId} />
                  </div>
                )}
                </CardContent>
              </Card>
            ) : (
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
            )}
          </div>

          {/* Project details sidebar - 3 columns */}
          <div className="col-span-12 lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Project Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
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
              </CardContent>
            </Card>

            {/* WordPress Settings Card */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">WordPress Settings</CardTitle>
                <CardDescription>
                  Configure how pages are published to WordPress
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">WordPress API Key</p>
                  <WordPressApiKeyDisplay
                    apiKey={project.wp_api_key}
                    onRegenerate={async () => {
                      // TODO: Implement API key regeneration
                      toast.error('API key regeneration coming soon')
                    }}
                  />
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Page Template</p>
                  <Select
                    value={project.wp_page_template || undefined}
                    onValueChange={(value) => handleFieldUpdate('wp_page_template', value)}
                    disabled={loadingTemplates || !project.wp_url || !project.wp_api_key}
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
                    {!project.wp_url || !project.wp_api_key 
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
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Towns Dialog */}
      <AddSpecificCombinationsDialog
        projectId={projectId}
        open={showAddSpecificDialog}
        onOpenChange={setShowAddSpecificDialog}
        baseKeyword={project?.base_keyword || ''}
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
              style={{ backgroundColor: '#006239' }}
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


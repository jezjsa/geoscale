import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Trash2, Loader2, Settings, AlertTriangle, Search, HelpCircle, Briefcase } from 'lucide-react'
import { toast } from 'sonner'
import {
  getProjectServices,
  createProjectService,
  deleteProjectService,
  getServiceKeywords,
  toggleKeywordSelection,
  bulkToggleKeywords,
  getProjectCombinationStats,
  createServiceFaq,
  type ProjectService,
  type ServiceKeyword,
} from '@/api/services'
import { getKeywordVariations } from '@/api/dataforseo'
import { addServiceKeywords } from '@/api/services'

interface ProjectServicesManagerProps {
  projectId: string
  combinationLimit: number
}

interface FetchedKeyword {
  keyword: string
  search_volume: number
  difficulty?: number
}

export function ProjectServicesManager({ projectId, combinationLimit }: ProjectServicesManagerProps) {
  const queryClient = useQueryClient()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showKeywordSelectionDialog, setShowKeywordSelectionDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [serviceToDelete, setServiceToDelete] = useState<ProjectService | null>(null)
  const [newServiceName, setNewServiceName] = useState('')
  const [newServiceDescription, setNewServiceDescription] = useState('')
  const [isFetchingKeywords, setIsFetchingKeywords] = useState(false)
  const [isAddingKeywords, setIsAddingKeywords] = useState(false)
  
  // For keyword selection step
  const [fetchedKeywords, setFetchedKeywords] = useState<FetchedKeyword[]>([])
  const [selectedKeywordIndexes, setSelectedKeywordIndexes] = useState<Set<number>>(new Set())

  // Fetch services
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ['projectServices', projectId],
    queryFn: () => getProjectServices(projectId),
  })

  // Fetch combination stats
  const { data: stats } = useQuery({
    queryKey: ['projectCombinationStats', projectId],
    queryFn: () => getProjectCombinationStats(projectId),
  })

  const isOverLimit = (stats?.totalCombinations || 0) > combinationLimit
  const isNearLimit = (stats?.totalCombinations || 0) > combinationLimit * 0.8

  // Store the service name/description for creating after keyword selection
  const [pendingServiceName, setPendingServiceName] = useState('')
  const [pendingServiceDescription, setPendingServiceDescription] = useState('')
  
  // For finding keywords for an existing service
  const [serviceToAddKeywords, setServiceToAddKeywords] = useState<ProjectService | null>(null)
  const [showFindKeywordsDialog, setShowFindKeywordsDialog] = useState(false)
  const [findKeywordsSearchTerm, setFindKeywordsSearchTerm] = useState('')
  
  // For adding FAQ to a service
  const [serviceToAddFaq, setServiceToAddFaq] = useState<ProjectService | null>(null)
  const [showAddFaqDialog, setShowAddFaqDialog] = useState(false)
  const [newFaqQuestion, setNewFaqQuestion] = useState('')
  const [newFaqAnswer, setNewFaqAnswer] = useState('')

  // Step 1: Fetch keywords first, DON'T create service yet
  const handleCreateService = async () => {
    if (!newServiceName.trim()) return
    
    const serviceName = newServiceName.trim()
    const serviceDescription = newServiceDescription.trim()
    
    // Store the name/description for later (service created after keyword confirmation)
    setPendingServiceName(serviceName)
    setPendingServiceDescription(serviceDescription)
    setNewServiceName('')
    setNewServiceDescription('')
    setShowAddDialog(false)
    
    // Show keyword selection dialog immediately with loading state
    setIsFetchingKeywords(true)
    setFetchedKeywords([])
    setSelectedKeywordIndexes(new Set())
    setShowKeywordSelectionDialog(true)
    
    try {
      // Only fetch keywords - don't create service yet
      const keywords = await getKeywordVariations({
        project_id: projectId,
        base_keyword: serviceName,
        location: 'GB',
        limit: 20,
      })
      
      setFetchedKeywords(keywords)
      // Pre-select all by default
      setSelectedKeywordIndexes(new Set(keywords.map((_, i) => i)))
    } catch (error: any) {
      console.error('Failed to fetch keywords:', error)
      toast.error('Failed to fetch keywords', { description: error.message })
      setShowKeywordSelectionDialog(false)
    } finally {
      setIsFetchingKeywords(false)
    }
  }

  // Step 2: Create service AND add selected keywords
  const handleAddSelectedKeywords = async () => {
    if (selectedKeywordIndexes.size === 0) {
      toast.error('Please select at least one keyword')
      return
    }
    
    setIsAddingKeywords(true)
    try {
      // NOW create the service
      const service = await createProjectService(projectId, pendingServiceName, pendingServiceDescription)
      
      // Add selected keywords
      const selectedKeywords = fetchedKeywords.filter((_, i) => selectedKeywordIndexes.has(i))
      await addServiceKeywords(service.id, selectedKeywords)
      
      toast.success(`Created "${service.name}" with ${selectedKeywords.length} keywords`)
      queryClient.invalidateQueries({ queryKey: ['projectServices', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectCombinationStats', projectId] })
    } catch (error: any) {
      toast.error('Failed to create service', { description: error.message })
    } finally {
      setIsAddingKeywords(false)
      setShowKeywordSelectionDialog(false)
      setPendingServiceName('')
      setPendingServiceDescription('')
      setFetchedKeywords([])
      setSelectedKeywordIndexes(new Set())
    }
  }

  // Cancel - don't create service
  const handleSkipKeywords = () => {
    setShowKeywordSelectionDialog(false)
    setPendingServiceName('')
    setPendingServiceDescription('')
    setFetchedKeywords([])
    setSelectedKeywordIndexes(new Set())
    toast.info('Service creation cancelled')
  }

  // Add service without fetching keywords - auto-add service name as a keyword
  const handleAddServiceOnly = async () => {
    if (!newServiceName.trim()) return
    
    const serviceName = newServiceName.trim()
    const serviceDescription = newServiceDescription.trim()
    
    try {
      // Create the service
      const service = await createProjectService(projectId, serviceName, serviceDescription)
      
      // Auto-add the service name as a keyword (selected by default)
      await addServiceKeywords(service.id, [{ keyword: serviceName, search_volume: 0 }])
      
      toast.success(`Created "${serviceName}" with keyword`)
      queryClient.invalidateQueries({ queryKey: ['projectServices', projectId] })
      setNewServiceName('')
      setNewServiceDescription('')
      setShowAddDialog(false)
    } catch (error: any) {
      toast.error('Failed to create service', { description: error.message })
    }
  }

  const toggleKeywordIndex = (index: number) => {
    setSelectedKeywordIndexes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const selectAllKeywords = () => {
    setSelectedKeywordIndexes(new Set(fetchedKeywords.map((_, i) => i)))
  }

  const deselectAllKeywords = () => {
    setSelectedKeywordIndexes(new Set())
  }

  // Handle finding keywords for an existing service
  const handleFindKeywordsForService = (service: ProjectService) => {
    setServiceToAddKeywords(service)
    setFindKeywordsSearchTerm(service.name)
    setFetchedKeywords([])
    setSelectedKeywordIndexes(new Set())
    setShowFindKeywordsDialog(true)
  }

  // Search for keywords for existing service
  const handleSearchKeywordsForService = async () => {
    if (!findKeywordsSearchTerm.trim() || !serviceToAddKeywords) return
    
    setIsFetchingKeywords(true)
    try {
      const keywords = await getKeywordVariations({
        project_id: projectId,
        base_keyword: findKeywordsSearchTerm.trim(),
        location: 'GB',
        limit: 20,
      })
      
      setFetchedKeywords(keywords)
      setSelectedKeywordIndexes(new Set(keywords.map((_, i) => i)))
    } catch (error: any) {
      console.error('Failed to fetch keywords:', error)
      toast.error('Failed to fetch keywords', { description: error.message })
    } finally {
      setIsFetchingKeywords(false)
    }
  }

  // Add selected keywords to existing service
  const handleAddKeywordsToService = async () => {
    if (selectedKeywordIndexes.size === 0 || !serviceToAddKeywords) return
    
    setIsAddingKeywords(true)
    try {
      const selectedKeywords = fetchedKeywords.filter((_, i) => selectedKeywordIndexes.has(i))
      await addServiceKeywords(serviceToAddKeywords.id, selectedKeywords)
      
      toast.success(`Added ${selectedKeywords.length} keywords to "${serviceToAddKeywords.name}"`)
      queryClient.invalidateQueries({ queryKey: ['projectServices', projectId] })
      queryClient.invalidateQueries({ queryKey: ['serviceKeywords', serviceToAddKeywords.id] })
      queryClient.invalidateQueries({ queryKey: ['projectCombinationStats', projectId] })
      
      setShowFindKeywordsDialog(false)
      setServiceToAddKeywords(null)
      setFetchedKeywords([])
      setSelectedKeywordIndexes(new Set())
      setFindKeywordsSearchTerm('')
    } catch (error: any) {
      toast.error('Failed to add keywords', { description: error.message })
    } finally {
      setIsAddingKeywords(false)
    }
  }

  // Handle adding FAQ to a service
  const handleAddFaqForService = (service: ProjectService) => {
    setServiceToAddFaq(service)
    setNewFaqQuestion('')
    setNewFaqAnswer('')
    setShowAddFaqDialog(true)
  }

  // Create FAQ for service
  const handleCreateFaq = async () => {
    if (!newFaqQuestion.trim() || !newFaqAnswer.trim() || !serviceToAddFaq) return
    
    try {
      await createServiceFaq(serviceToAddFaq.id, newFaqQuestion.trim(), newFaqAnswer.trim())
      toast.success(`FAQ added to "${serviceToAddFaq.name}"`)
      queryClient.invalidateQueries({ queryKey: ['projectServices', projectId] })
      queryClient.invalidateQueries({ queryKey: ['serviceFaqs', serviceToAddFaq.id] })
      setShowAddFaqDialog(false)
      setServiceToAddFaq(null)
      setNewFaqQuestion('')
      setNewFaqAnswer('')
    } catch (error: any) {
      toast.error('Failed to add FAQ', { description: error.message })
    }
  }

  // Delete service mutation
  const deleteServiceMutation = useMutation({
    mutationFn: (serviceId: string) => deleteProjectService(serviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectServices', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectCombinationStats', projectId] })
      toast.success('Service deleted')
      setShowDeleteDialog(false)
      setServiceToDelete(null)
    },
    onError: (error: Error) => {
      toast.error('Failed to delete service', { description: error.message })
    },
  })

  const handleDeleteClick = (service: ProjectService) => {
    setServiceToDelete(service)
    setShowDeleteDialog(true)
  }

  if (servicesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Combination Counter */}
      <Card className={isOverLimit ? 'border-red-500' : isNearLimit ? 'border-yellow-500' : ''}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Combination Usage</p>
              <p className="text-2xl font-bold">
                {stats?.totalCombinations || 0} / {combinationLimit}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.selectedKeywordCount || 0} keywords × {stats?.locationCount || 0} locations
              </p>
            </div>
            {isOverLimit && (
              <div className="flex items-center gap-2 text-red-500">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm font-medium">Over limit</span>
              </div>
            )}
            {isNearLimit && !isOverLimit && (
              <div className="flex items-center gap-2 text-yellow-500">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm font-medium">Approaching limit</span>
              </div>
            )}
          </div>
          {isOverLimit && (
            <p className="text-sm text-red-500 mt-2">
              Deselect some keywords or upgrade your plan to generate all combinations.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Services List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Services</CardTitle>
              <CardDescription>
                Add services to organize your keywords and FAQs
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowAddDialog(true)}
              style={{ backgroundColor: 'var(--brand-dark)' }}
              className="hover:opacity-90 text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Service
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!services || services.length === 0 ? (
            <div className="text-center py-12">
              <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No services yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add your first service to get started. We'll automatically find related keywords.
              </p>
              <Button
                onClick={() => setShowAddDialog(true)}
                style={{ backgroundColor: 'var(--brand-dark)' }}
                className="hover:opacity-90 text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Service
              </Button>
            </div>
          ) : (
            <Accordion
              type="single"
              collapsible
            >
              {services.map((service) => (
                <AccordionItem key={service.id} value={service.id}>
                  <AccordionTrigger className="hover:no-underline [&>svg]:pointer-events-none">
                    <div className="flex items-center gap-3 pointer-events-none">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{service.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {service.selected_keyword_count}/{service.keyword_count} keywords
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {service.faq_count} FAQs
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ServiceKeywordsPanel
                      service={service}
                      projectId={projectId}
                      combinationLimit={combinationLimit}
                      currentTotal={stats?.totalCombinations || 0}
                      locationCount={stats?.locationCount || 0}
                      onDelete={() => handleDeleteClick(service)}
                      onFindKeywords={() => handleFindKeywordsForService(service)}
                      onAddFaq={() => handleAddFaqForService(service)}
                    />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Add Service Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Service</DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block">Enter a service name and we'll find related keywords for you to choose from.</span>
              <span className="block text-orange-600 dark:text-orange-400">Don't include locations in your keyphrases – we'll combine them with your locations automatically afterwards.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="serviceName">Service Name</Label>
              <Input
                id="serviceName"
                placeholder="e.g., Web Design, IT Support, Plumbing"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newServiceName.trim()) {
                    e.preventDefault()
                    handleCreateService()
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serviceDescription">Description (optional)</Label>
              <Textarea
                id="serviceDescription"
                placeholder="Brief description of this service for AI context"
                value={newServiceDescription}
                onChange={(e) => setNewServiceDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleAddServiceOnly}
              disabled={!newServiceName.trim()}
            >
              Add Service Only
            </Button>
            <Button
              onClick={handleCreateService}
              disabled={!newServiceName.trim()}
              style={{ backgroundColor: 'var(--brand-dark)' }}
              className="hover:opacity-90 text-white"
            >
              Find Related Keywords
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keyword Selection Dialog */}
      <Dialog open={showKeywordSelectionDialog} onOpenChange={(open) => !open && !isFetchingKeywords && handleSkipKeywords()}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Keywords for {pendingServiceName}</DialogTitle>
            <DialogDescription>
              {isFetchingKeywords 
                ? 'Finding related keywords...' 
                : `We found ${fetchedKeywords.length} related keywords. Select the ones relevant to your service.`
              }
            </DialogDescription>
          </DialogHeader>
          
          {isFetchingKeywords ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-[var(--brand-dark)] mb-4" />
              <p className="text-sm text-muted-foreground">Finding related keywords...</p>
              <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 py-2">
                <Button size="sm" variant="outline" onClick={selectAllKeywords}>
                  Select All
                </Button>
                <Button size="sm" variant="outline" onClick={deselectAllKeywords}>
                  Deselect All
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto border rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 p-2">
                  {fetchedKeywords.map((keyword, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedKeywordIndexes.has(index) 
                          ? 'bg-accent/50 border-[var(--brand-dark)]' 
                          : 'bg-background hover:bg-accent/30'
                      }`}
                      onClick={() => toggleKeywordIndex(index)}
                    >
                      <Checkbox
                        checked={selectedKeywordIndexes.has(index)}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => toggleKeywordIndex(index)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{keyword.keyword}</p>
                        {keyword.search_volume > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {keyword.search_volume.toLocaleString()} searches/mo
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter className="pt-4">
                <span className="text-sm text-muted-foreground mr-auto">
                  {selectedKeywordIndexes.size} of {fetchedKeywords.length} selected
                </span>
                <Button
                  variant="outline"
                  onClick={handleSkipKeywords}
                  disabled={isAddingKeywords}
                >
                  Skip Keywords
                </Button>
                <Button
                  onClick={handleAddSelectedKeywords}
                  disabled={selectedKeywordIndexes.size === 0 || isAddingKeywords}
                  style={{ backgroundColor: 'var(--brand-dark)' }}
                  className="hover:opacity-90 text-white"
                >
                  {isAddingKeywords ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    `Add ${selectedKeywordIndexes.size} Keywords`
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Service</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{serviceToDelete?.name}"? This will also delete all associated keywords and FAQs.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => serviceToDelete && deleteServiceMutation.mutate(serviceToDelete.id)}
              disabled={deleteServiceMutation.isPending}
            >
              {deleteServiceMutation.isPending ? 'Deleting...' : 'Delete Service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Find Keywords for Existing Service Dialog */}
      <Dialog open={showFindKeywordsDialog} onOpenChange={(open) => {
        if (!open) {
          setShowFindKeywordsDialog(false)
          setServiceToAddKeywords(null)
          setFetchedKeywords([])
          setSelectedKeywordIndexes(new Set())
          setFindKeywordsSearchTerm('')
        }
      }}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Find Keywords for {serviceToAddKeywords?.name}</DialogTitle>
            <DialogDescription>
              Search for related keywords to add to this service.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex gap-2 py-4">
            <Input
              placeholder="Enter search term (e.g., web design)"
              value={findKeywordsSearchTerm}
              onChange={(e) => setFindKeywordsSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSearchKeywordsForService()
                }
              }}
              disabled={isFetchingKeywords}
            />
            <Button
              onClick={handleSearchKeywordsForService}
              disabled={!findKeywordsSearchTerm.trim() || isFetchingKeywords}
              style={{ backgroundColor: 'var(--brand-dark)' }}
              className="hover:opacity-90 text-white"
            >
              {isFetchingKeywords ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {isFetchingKeywords ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : fetchedKeywords.length > 0 ? (
            <>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">
                  {selectedKeywordIndexes.size} of {fetchedKeywords.length} selected
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAllKeywords}>
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={deselectAllKeywords}>
                    Deselect All
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto min-h-0 py-2">
                <div className="space-y-1">
                  {fetchedKeywords.map((kw, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-muted/50 ${
                        selectedKeywordIndexes.has(index) ? 'bg-muted' : ''
                      }`}
                      onClick={() => toggleKeywordIndex(index)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedKeywordIndexes.has(index)}
                          onCheckedChange={() => toggleKeywordIndex(index)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm">{kw.keyword}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {kw.search_volume?.toLocaleString() || 0} searches/mo
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">Enter a search term to find related keywords</p>
            </div>
          )}
          
          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              onClick={() => setShowFindKeywordsDialog(false)}
              disabled={isAddingKeywords}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddKeywordsToService}
              disabled={isAddingKeywords || selectedKeywordIndexes.size === 0}
              style={{ backgroundColor: 'var(--brand-dark)' }}
              className="hover:opacity-90 text-white"
            >
              {isAddingKeywords ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                `Add ${selectedKeywordIndexes.size} Keywords`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add FAQ Dialog */}
      <Dialog open={showAddFaqDialog} onOpenChange={(open) => {
        if (!open) {
          setShowAddFaqDialog(false)
          setServiceToAddFaq(null)
          setNewFaqQuestion('')
          setNewFaqAnswer('')
        }
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add FAQ for {serviceToAddFaq?.name}</DialogTitle>
            <DialogDescription>
              Add a frequently asked question for this service.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="faqQuestion">Question</Label>
              <Input
                id="faqQuestion"
                placeholder="e.g., How long does a website take to build?"
                value={newFaqQuestion}
                onChange={(e) => setNewFaqQuestion(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="faqAnswer">Answer</Label>
              <Textarea
                id="faqAnswer"
                placeholder="Enter the answer to this question..."
                value={newFaqAnswer}
                onChange={(e) => setNewFaqAnswer(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddFaqDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFaq}
              disabled={!newFaqQuestion.trim() || !newFaqAnswer.trim()}
              style={{ backgroundColor: 'var(--brand-dark)' }}
              className="hover:opacity-90 text-white"
            >
              Add FAQ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Sub-component for managing keywords within a service
function ServiceKeywordsPanel({
  service,
  projectId,
  combinationLimit,
  currentTotal,
  locationCount,
  onDelete,
  onFindKeywords,
  onAddFaq,
}: {
  service: ProjectService
  projectId: string
  combinationLimit: number
  currentTotal: number
  locationCount: number
  onDelete: () => void
  onFindKeywords: () => void
  onAddFaq: () => void
}) {
  const queryClient = useQueryClient()

  const { data: keywords, isLoading } = useQuery({
    queryKey: ['serviceKeywords', service.id],
    queryFn: () => getServiceKeywords(service.id),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ keywordId, isSelected }: { keywordId: string; isSelected: boolean }) =>
      toggleKeywordSelection(keywordId, isSelected),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceKeywords', service.id] })
      queryClient.invalidateQueries({ queryKey: ['projectServices', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectCombinationStats', projectId] })
    },
  })

  const bulkToggleMutation = useMutation({
    mutationFn: ({ keywordIds, isSelected }: { keywordIds: string[]; isSelected: boolean }) =>
      bulkToggleKeywords(keywordIds, isSelected),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceKeywords', service.id] })
      queryClient.invalidateQueries({ queryKey: ['projectServices', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectCombinationStats', projectId] })
    },
  })

  const handleToggle = (keyword: ServiceKeyword) => {
    // Check if selecting would exceed limit
    if (!keyword.is_selected) {
      const newTotal = currentTotal + locationCount
      if (newTotal > combinationLimit) {
        toast.error('Combination limit reached', {
          description: `Selecting this keyword would create ${newTotal} combinations, exceeding your limit of ${combinationLimit}.`,
        })
        return
      }
    }
    toggleMutation.mutate({ keywordId: keyword.id, isSelected: !keyword.is_selected })
  }

  const handleSelectAll = () => {
    if (!keywords) return
    const unselectedIds = keywords.filter(k => !k.is_selected).map(k => k.id)
    if (unselectedIds.length === 0) return

    const newTotal = currentTotal + (unselectedIds.length * locationCount)
    if (newTotal > combinationLimit) {
      toast.error('Would exceed combination limit', {
        description: `Selecting all would create ${newTotal} combinations, exceeding your limit of ${combinationLimit}.`,
      })
      return
    }

    bulkToggleMutation.mutate({ keywordIds: unselectedIds, isSelected: true })
  }

  const handleDeselectAll = () => {
    if (!keywords) return
    const selectedIds = keywords.filter(k => k.is_selected).map(k => k.id)
    if (selectedIds.length === 0) return
    bulkToggleMutation.mutate({ keywordIds: selectedIds, isSelected: false })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const selectedCount = keywords?.filter(k => k.is_selected).length || 0
  const totalCount = keywords?.length || 0

  return (
    <div className="space-y-4 pt-2">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleSelectAll}>
            Select All
          </Button>
          <Button size="sm" variant="outline" onClick={handleDeselectAll}>
            Deselect All
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={onFindKeywords}
            style={{ borderColor: 'var(--brand-dark)', color: 'var(--brand-dark)' }}
          >
            <Search className="h-4 w-4 mr-1" />
            Find Keywords
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={onAddFaq}
            style={{ borderColor: 'var(--brand-dark)', color: 'var(--brand-dark)' }}
          >
            <HelpCircle className="h-4 w-4 mr-1" />
            Add FAQ
          </Button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-500 hover:text-red-600 hover:bg-red-50"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete Service
        </Button>
      </div>

      {/* Keywords Grid */}
      {!keywords || keywords.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No keywords found for this service.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {keywords.map((keyword) => (
            <div
              key={keyword.id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                keyword.is_selected ? 'bg-accent/50 border-accent' : 'bg-background'
              }`}
            >
              <Checkbox
                checked={keyword.is_selected}
                onCheckedChange={() => handleToggle(keyword)}
                disabled={toggleMutation.isPending}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{keyword.keyword}</p>
                {keyword.search_volume && (
                  <p className="text-xs text-muted-foreground">
                    {keyword.search_volume.toLocaleString()} searches/mo
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {selectedCount} of {totalCount} keywords selected
        {locationCount > 0 && ` = ${selectedCount * locationCount} combinations`}
      </p>
    </div>
  )
}

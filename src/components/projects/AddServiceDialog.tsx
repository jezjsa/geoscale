import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createProjectService } from '@/api/services'
import { getKeywordVariations } from '@/api/dataforseo'
import { addServiceKeywords } from '@/api/services'

interface AddServiceDialogProps {
  projectId: string
  wpUrl?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface FetchedKeyword {
  keyword: string
  search_volume: number
  difficulty?: number
}

export function AddServiceDialog({ projectId, wpUrl, open, onOpenChange }: AddServiceDialogProps) {
  const queryClient = useQueryClient()
  
  // Add service dialog state
  const [newServiceName, setNewServiceName] = useState('')
  const [newServiceDescription, setNewServiceDescription] = useState('')
  const [newServicePageUrl, setNewServicePageUrl] = useState('')
  
  // Keyword selection dialog state
  const [showKeywordSelectionDialog, setShowKeywordSelectionDialog] = useState(false)
  const [isFetchingKeywords, setIsFetchingKeywords] = useState(false)
  const [fetchedKeywords, setFetchedKeywords] = useState<FetchedKeyword[]>([])
  const [selectedKeywordIndexes, setSelectedKeywordIndexes] = useState<Set<number>>(new Set())
  const [isAddingKeywords, setIsAddingKeywords] = useState(false)
  const [pendingServiceName, setPendingServiceName] = useState('')
  const [pendingServiceDescription, setPendingServiceDescription] = useState('')
  const [pendingServicePageUrl, setPendingServicePageUrl] = useState('')

  // Step 1: Fetch keywords first, DON'T create service yet
  const handleCreateService = async () => {
    if (!newServiceName.trim()) return
    
    const serviceName = newServiceName.trim()
    const serviceDescription = newServiceDescription.trim()
    
    // Store the name/description/url for later (service created after keyword confirmation)
    setPendingServiceName(serviceName)
    setPendingServiceDescription(serviceDescription)
    setPendingServicePageUrl(newServicePageUrl.trim())
    setNewServiceName('')
    setNewServiceDescription('')
    setNewServicePageUrl('')
    onOpenChange(false)
    
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
      const service = await createProjectService(projectId, pendingServiceName, pendingServiceDescription, pendingServicePageUrl)
      
      // Add selected keywords
      const selectedKeywords = fetchedKeywords.filter((_, i) => selectedKeywordIndexes.has(i))
      await addServiceKeywords(service.id, selectedKeywords)
      
      toast.success(`Created "${service.name}" with ${selectedKeywords.length} keywords`)
      queryClient.invalidateQueries({ queryKey: ['projectServices', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projectCombinationStats', projectId] })
      
      // Reset and close
      setShowKeywordSelectionDialog(false)
      setPendingServiceName('')
      setPendingServiceDescription('')
      setPendingServicePageUrl('')
      setFetchedKeywords([])
      setSelectedKeywordIndexes(new Set())
    } catch (error: any) {
      toast.error('Failed to create service', { description: error.message })
    } finally {
      setIsAddingKeywords(false)
    }
  }

  // Cancel - don't create service
  const handleSkipKeywords = () => {
    setShowKeywordSelectionDialog(false)
    setPendingServiceName('')
    setPendingServiceDescription('')
    setPendingServicePageUrl('')
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
      const service = await createProjectService(projectId, serviceName, serviceDescription, newServicePageUrl.trim())
      
      // Auto-add the service name as a keyword (selected by default)
      await addServiceKeywords(service.id, [{ keyword: serviceName, search_volume: 0 }])
      
      toast.success(`Created "${serviceName}" with keyword`)
      queryClient.invalidateQueries({ queryKey: ['projectServices', projectId] })
      setNewServiceName('')
      setNewServiceDescription('')
      setNewServicePageUrl('')
      onOpenChange(false)
    } catch (error: any) {
      toast.error('Failed to create service', { description: error.message })
    }
  }

  // Helper to create slug from name
  const createSlug = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  // Pre-populate service page URL when service name changes
  useEffect(() => {
    if (wpUrl && newServiceName.trim()) {
      const slug = createSlug(newServiceName)
      const baseUrl = wpUrl.replace(/\/$/, '') // Remove trailing slash
      setNewServicePageUrl(`${baseUrl}/${slug}`)
    } else if (!newServiceName.trim()) {
      setNewServicePageUrl('')
    }
  }, [newServiceName, wpUrl])

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

  return (
    <>
      {/* Add Service Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Service</DialogTitle>
            <DialogDescription>
              Enter a service name and we'll find related keywords for you to choose from.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-orange-500">
            Don't include locations in your keyphrases – we'll combine them with your locations automatically afterwards.
          </p>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="serviceName">Service Name</Label>
              <Input
                id="serviceName"
                placeholder="e.g., Web Design, Plumbing, Personal Training"
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
            <div className="space-y-2">
              <Label htmlFor="servicePageUrl">Main Service Page URL (optional)</Label>
              <Input
                id="servicePageUrl"
                placeholder={wpUrl ? `${wpUrl}/service-name` : 'https://yoursite.com/web-design'}
                value={newServicePageUrl}
                onChange={(e) => setNewServicePageUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Link to your existing service page on WordPress. Used for internal linking in generated content.
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleCreateService}
              disabled={!newServiceName.trim()}
            >
              Find Related Keywords
            </Button>
            <span className="text-sm text-muted-foreground">or</span>
            <Button
              onClick={handleAddServiceOnly}
              disabled={!newServiceName.trim()}
              style={{ backgroundColor: 'var(--brand-dark)' }}
              className="hover:opacity-90 text-white"
            >
              Add Service Only
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
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
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
          )}
          
          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              onClick={handleSkipKeywords}
              disabled={isFetchingKeywords || isAddingKeywords}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddSelectedKeywords}
              disabled={isFetchingKeywords || isAddingKeywords || selectedKeywordIndexes.size === 0}
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
    </>
  )
}

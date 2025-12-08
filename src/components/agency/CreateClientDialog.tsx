import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Copy, CheckCircle2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { createProject } from '@/api/projects'
import { toast } from 'sonner'
import { copyApiKeyToClipboard } from '@/utils/api-key-generator'

interface CreateClientDialogProps {
  userId: string
}

export function CreateClientDialog({ userId }: CreateClientDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [createdApiKey, setCreatedApiKey] = useState('')
  const [createdProjectName, setCreatedProjectName] = useState('')
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    contactEmail: '',
    phoneNumber: '',
    contactUrl: 'https://',
    serviceDescription: '',
    wpUrl: 'https://',
    blogUrl: 'https://',
  })

  const queryClient = useQueryClient()

  const capitalizeWords = (str: string) => {
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  const handleUrlFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === 'https://') {
      // Move cursor to the end (after the //)
      setTimeout(() => {
        e.target.setSelectionRange(e.target.value.length, e.target.value.length)
      }, 0)
    }
  }

  const createProjectMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return createProject({
        companyName: data.companyName,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        phoneNumber: data.phoneNumber,
        contactUrl: data.contactUrl,
        serviceDescription: data.serviceDescription,
        wpUrl: data.wpUrl,
        blogUrl: data.blogUrl,
        userId: userId,
      })
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['agencyProjects', userId] })
      // Store the API key and project name, then move to step 2
      setCreatedApiKey(result.wpApiKey)
      setCreatedProjectName(formData.companyName)
      setStep(2)
    },
    onError: (error: Error) => {
      toast.error('Error creating project', {
        description: error.message,
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createProjectMutation.mutate(formData)
  }

  const handleClose = () => {
    setOpen(false)
    // Reset after dialog closes
    setTimeout(() => {
      setStep(1)
      setCreatedApiKey('')
      setCreatedProjectName('')
      setFormData({ 
        companyName: '', 
        contactName: '', 
        contactEmail: '', 
        phoneNumber: '', 
        contactUrl: 'https://', 
        serviceDescription: '', 
        wpUrl: 'https://',
        blogUrl: 'https://' 
      })
    }, 200)
  }

  const handleCopyApiKey = async () => {
    const success = await copyApiKeyToClipboard(createdApiKey)
    if (success) {
      toast.success('API key copied to clipboard')
    } else {
      toast.error('Failed to copy API key')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button style={{ backgroundColor: 'var(--brand-dark)' }} className="hover:opacity-90 text-white">
          <Plus className="mr-2 h-4 w-4" />
          Create a Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px]">
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Create New Client Project</DialogTitle>
              <DialogDescription>
                Add a new client project. You'll manage their WordPress site and generate location pages for them.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-12 py-4">
            {/* Left Column */}
            <div className="space-y-6">
              <div className="grid gap-2">
                <Label htmlFor="companyName" className="text-sm text-muted-foreground font-normal">Company Name</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: capitalizeWords(e.target.value) })}
                  placeholder="ABC Plumbing Ltd"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contactName" className="text-sm text-muted-foreground font-normal">Contact Name</Label>
                <Input
                  id="contactName"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: capitalizeWords(e.target.value) })}
                  placeholder="John Smith"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contactEmail" className="text-sm text-muted-foreground font-normal">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  placeholder="client@example.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phoneNumber" className="text-sm text-muted-foreground font-normal">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  placeholder="+44 1234 567890"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="serviceDescription" className="text-sm text-muted-foreground font-normal">Service Description</Label>
                <Textarea
                  id="serviceDescription"
                  value={formData.serviceDescription}
                  onChange={(e) => setFormData({ ...formData, serviceDescription: e.target.value })}
                  placeholder="Describe the services this business provides..."
                  rows={3}
                  required
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <div className="grid gap-2">
                <Label htmlFor="wpUrl" className="text-sm text-muted-foreground font-normal">WordPress URL</Label>
                <Input
                  id="wpUrl"
                  type="url"
                  value={formData.wpUrl}
                  onChange={(e) => setFormData({ ...formData, wpUrl: e.target.value })}
                  onFocus={handleUrlFocus}
                  placeholder="https://client-website.com"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The WordPress site where pages will be published
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="blogUrl" className="text-sm text-muted-foreground font-normal">Blog URL</Label>
                <Input
                  id="blogUrl"
                  type="url"
                  value={formData.blogUrl}
                  onChange={(e) => setFormData({ ...formData, blogUrl: e.target.value })}
                  onFocus={handleUrlFocus}
                  placeholder="https://client-website.com/blog"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Root URL where blog posts are published
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contactUrl" className="text-sm text-muted-foreground font-normal">Contact URL</Label>
                <Input
                  id="contactUrl"
                  type="url"
                  value={formData.contactUrl}
                  onChange={(e) => setFormData({ ...formData, contactUrl: e.target.value })}
                  onFocus={handleUrlFocus}
                  placeholder="https://client-website.com/contact"
                  required
                />
              </div>
            </div>
          </div>
          <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                style={{ backgroundColor: 'var(--brand-dark)' }}
                className="hover:opacity-90 text-white"
                disabled={createProjectMutation.isPending}
              >
                {createProjectMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Project'
                )}
              </Button>
            </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <DialogTitle>Project Created Successfully</DialogTitle>
                  <DialogDescription>
                    {createdProjectName} has been added to your projects.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            
            <div className="py-6">
              <div className="bg-muted rounded-lg p-6 space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Step 2: Connect WordPress</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Copy this API key and paste it into the GeoScale WordPress plugin settings on your client's website.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground font-normal">WordPress API Key</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={createdApiKey}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyApiKey}
                      title="Copy API key"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Keep this key secure - it provides access to create and update pages on this WordPress site.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={handleClose}
                style={{ backgroundColor: 'var(--brand-dark)' }}
                className="hover:opacity-90 text-white"
              >
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}


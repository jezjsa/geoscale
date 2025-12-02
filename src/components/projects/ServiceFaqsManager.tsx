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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Loader2, HelpCircle, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import {
  getProjectServices,
  getServiceFaqs,
  createServiceFaq,
  updateServiceFaq,
  deleteServiceFaq,
  type ProjectService,
  type ServiceFaq,
} from '@/api/services'

interface ServiceFaqsManagerProps {
  projectId: string
}

// Helper to capitalize first letter
const capitalizeFirst = (str: string) => {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function ServiceFaqsManager({ projectId }: ServiceFaqsManagerProps) {
  const queryClient = useQueryClient()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [faqToEdit, setFaqToEdit] = useState<ServiceFaq | null>(null)
  const [faqToDelete, setFaqToDelete] = useState<ServiceFaq | null>(null)
  const [newQuestion, setNewQuestion] = useState('')
  const [newAnswer, setNewAnswer] = useState('')

  // Fetch services
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ['projectServices', projectId],
    queryFn: () => getProjectServices(projectId),
  })

  // Create FAQ mutation
  const createFaqMutation = useMutation({
    mutationFn: () => createServiceFaq(selectedServiceId!, newQuestion, newAnswer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceFaqs', selectedServiceId] })
      queryClient.invalidateQueries({ queryKey: ['projectServices', projectId] })
      toast.success('FAQ added successfully')
      setShowAddDialog(false)
      setNewQuestion('')
      setNewAnswer('')
      setSelectedServiceId(null)
    },
    onError: (error: Error) => {
      toast.error('Failed to add FAQ', { description: error.message })
    },
  })

  // Update FAQ mutation
  const updateFaqMutation = useMutation({
    mutationFn: () => updateServiceFaq(faqToEdit!.id, { question: newQuestion, answer: newAnswer }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceFaqs'] })
      toast.success('FAQ updated successfully')
      setShowEditDialog(false)
      setFaqToEdit(null)
      setNewQuestion('')
      setNewAnswer('')
    },
    onError: (error: Error) => {
      toast.error('Failed to update FAQ', { description: error.message })
    },
  })

  // Delete FAQ mutation
  const deleteFaqMutation = useMutation({
    mutationFn: (faqId: string) => deleteServiceFaq(faqId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceFaqs'] })
      queryClient.invalidateQueries({ queryKey: ['projectServices', projectId] })
      toast.success('FAQ deleted')
      setShowDeleteDialog(false)
      setFaqToDelete(null)
    },
    onError: (error: Error) => {
      toast.error('Failed to delete FAQ', { description: error.message })
    },
  })

  const handleAddClick = (serviceId: string) => {
    setSelectedServiceId(serviceId)
    setNewQuestion('')
    setNewAnswer('')
    setShowAddDialog(true)
  }

  const handleEditClick = (faq: ServiceFaq) => {
    setFaqToEdit(faq)
    setNewQuestion(faq.question)
    setNewAnswer(faq.answer)
    setShowEditDialog(true)
  }

  const handleDeleteClick = (faq: ServiceFaq) => {
    setFaqToDelete(faq)
    setShowDeleteDialog(true)
  }

  if (servicesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!services || services.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No services yet</h3>
            <p className="text-sm text-muted-foreground">
              Add services first to create FAQs. Go to the Services tab to get started.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Service FAQs</CardTitle>
            <CardDescription>
              Add frequently asked questions for each service. These will be included in generated content.
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setShowAddDialog(true)}
            style={{ backgroundColor: 'var(--brand-dark)' }}
            className="hover:opacity-90 text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add FAQ
          </Button>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {services.map((service) => (
              <AccordionItem key={service.id} value={service.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{service.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {service.faq_count} FAQs
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ServiceFaqsList
                    service={service}
                    onAdd={() => handleAddClick(service.id)}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Add FAQ Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open)
        if (!open) {
          setSelectedServiceId(null)
          setNewQuestion('')
          setNewAnswer('')
        }
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add FAQ</DialogTitle>
            <DialogDescription>
              Add a frequently asked question for a service.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="service">Service</Label>
              <Select
                value={selectedServiceId || ''}
                onValueChange={(value) => setSelectedServiceId(value)}
                disabled={createFaqMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {services?.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="question">Question</Label>
              <Input
                id="question"
                placeholder="e.g., How long does a website take to build?"
                value={newQuestion}
                onChange={(e) => setNewQuestion(capitalizeFirst(e.target.value))}
                disabled={createFaqMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="answer">Answer</Label>
              <Textarea
                id="answer"
                placeholder="Enter the answer to this question..."
                value={newAnswer}
                onChange={(e) => setNewAnswer(capitalizeFirst(e.target.value))}
                disabled={createFaqMutation.isPending}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              disabled={createFaqMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createFaqMutation.mutate()}
              disabled={!selectedServiceId || !newQuestion.trim() || !newAnswer.trim() || createFaqMutation.isPending}
              style={{ backgroundColor: 'var(--brand-dark)' }}
              className="hover:opacity-90 text-white"
            >
              {createFaqMutation.isPending ? 'Adding...' : 'Add FAQ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit FAQ Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit FAQ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editQuestion">Question</Label>
              <Input
                id="editQuestion"
                value={newQuestion}
                onChange={(e) => setNewQuestion(capitalizeFirst(e.target.value))}
                disabled={updateFaqMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editAnswer">Answer</Label>
              <Textarea
                id="editAnswer"
                value={newAnswer}
                onChange={(e) => setNewAnswer(capitalizeFirst(e.target.value))}
                disabled={updateFaqMutation.isPending}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={updateFaqMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateFaqMutation.mutate()}
              disabled={!newQuestion.trim() || !newAnswer.trim() || updateFaqMutation.isPending}
              style={{ backgroundColor: 'var(--brand-dark)' }}
              className="hover:opacity-90 text-white"
            >
              {updateFaqMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete FAQ</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this FAQ?
            </DialogDescription>
          </DialogHeader>
          {faqToDelete && (
            <div className="py-4">
              <p className="text-sm font-medium">{faqToDelete.question}</p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => faqToDelete && deleteFaqMutation.mutate(faqToDelete.id)}
              disabled={deleteFaqMutation.isPending}
            >
              {deleteFaqMutation.isPending ? 'Deleting...' : 'Delete FAQ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Sub-component for listing FAQs within a service
function ServiceFaqsList({
  service,
  onAdd,
  onEdit,
  onDelete,
}: {
  service: ProjectService
  onAdd: () => void
  onEdit: (faq: ServiceFaq) => void
  onDelete: (faq: ServiceFaq) => void
}) {
  const { data: faqs, isLoading } = useQuery({
    queryKey: ['serviceFaqs', service.id],
    queryFn: () => getServiceFaqs(service.id),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4 pt-2">
      {!faqs || faqs.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground mb-3">
            No FAQs for this service yet.
          </p>
          <Button
            size="sm"
            onClick={onAdd}
            style={{ backgroundColor: 'var(--brand-dark)' }}
            className="hover:opacity-90 text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add First FAQ
          </Button>
        </div>
      ) : (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={onAdd}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add FAQ
          </Button>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <div
                key={faq.id}
                className="p-4 rounded-lg border bg-background"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{faq.question}</p>
                    <p className="text-sm text-muted-foreground mt-1">{faq.answer}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => onEdit(faq)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      onClick={() => onDelete(faq)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

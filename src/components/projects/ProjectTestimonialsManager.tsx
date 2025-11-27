import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

interface Testimonial {
  id: string
  testimonial_text: string
  customer_name?: string
  business_name?: string
  created_at: string
}

interface ProjectTestimonialsManagerProps {
  projectId: string
}

export function ProjectTestimonialsManager({ projectId }: ProjectTestimonialsManagerProps) {
  const queryClient = useQueryClient()
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    testimonial_text: '',
    customer_name: '',
    business_name: '',
  })

  const { data: testimonials, isLoading } = useQuery({
    queryKey: ['projectTestimonials', projectId, 'v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_testimonials')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }
      
      return (data || []) as Testimonial[]
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('project_testimonials')
        .insert({
          project_id: projectId,
          ...data,
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectTestimonials', projectId] })
      setIsAdding(false)
      setFormData({ testimonial_text: '', customer_name: '', business_name: '' })
      toast.success('Testimonial added successfully')
    },
    onError: (error: Error) => {
      toast.error('Error adding testimonial', { description: error.message })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('project_testimonials')
        .update(data)
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectTestimonials', projectId] })
      setEditingId(null)
      setFormData({ testimonial_text: '', customer_name: '', business_name: '' })
      toast.success('Testimonial updated successfully')
    },
    onError: (error: Error) => {
      toast.error('Error updating testimonial', { description: error.message })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_testimonials')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectTestimonials', projectId] })
      toast.success('Testimonial deleted successfully')
    },
    onError: (error: Error) => {
      toast.error('Error deleting testimonial', { description: error.message })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.testimonial_text.trim()) {
      toast.error('Please enter testimonial text')
      return
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleEdit = (testimonial: Testimonial) => {
    setEditingId(testimonial.id)
    setFormData({
      testimonial_text: testimonial.testimonial_text,
      customer_name: testimonial.customer_name || '',
      business_name: testimonial.business_name || '',
    })
    setIsAdding(false)
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    setFormData({ testimonial_text: '', customer_name: '', business_name: '' })
  }

  // Listen for add testimonial event from button
  useEffect(() => {
    const handleAddEvent = () => {
      setIsAdding(true)
      setEditingId(null)
    }

    window.addEventListener('addTestimonial', handleAddEvent)
    return () => window.removeEventListener('addTestimonial', handleAddEvent)
  }, [])

  if (isLoading) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>Loading testimonials...</p>
      </div>
    )
  }

  const hasTestimonials = testimonials && testimonials.length > 0

  const isModalOpen = isAdding || editingId !== null

  return (
    <div>
      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit' : 'Add'} Testimonial</DialogTitle>
            <DialogDescription>
              Add customer testimonials that will be woven into your AI-generated landing pages.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="testimonial_text" className="text-sm font-medium block mb-2">
                Testimonial Text *
              </Label>
              <Textarea
                id="testimonial_text"
                value={formData.testimonial_text}
                onChange={(e) => setFormData({ ...formData, testimonial_text: e.target.value })}
                placeholder="Enter the customer testimonial..."
                rows={4}
                required
              />
            </div>

            <div>
              <Label htmlFor="customer_name" className="text-sm font-medium block mb-2">
                Customer Name (optional)
              </Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                placeholder="e.g., John Smith"
              />
            </div>

            <div>
              <Label htmlFor="business_name" className="text-sm font-medium block mb-2">
                Business Name (optional)
              </Label>
              <Input
                id="business_name"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                placeholder="e.g., ABC Company Ltd"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                type="submit"
                style={{ backgroundColor: 'var(--brand-dark)' }}
                className="hover:opacity-90 text-white"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingId ? 'Update' : 'Add'} Testimonial
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Empty State or Testimonials List */}
      {!hasTestimonials && !isAdding ? (
        <div className="py-12 text-center">
          <div className="max-w-md mx-auto space-y-6">
            <h3 className="text-lg font-medium">Add your first testimonial</h3>
            <p className="text-sm text-muted-foreground">
              Add customer testimonials that will be woven into your AI-generated landing pages to build trust and credibility.
            </p>
            <Button
              onClick={() => setIsAdding(true)}
              style={{ backgroundColor: 'var(--brand-dark)' }}
              className="hover:opacity-90 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Testimonial
            </Button>
          </div>
        </div>
      ) : hasTestimonials ? (
        <div className="space-y-4">
          {testimonials.map((testimonial) => {
            const hasText = testimonial.testimonial_text && testimonial.testimonial_text.trim().length > 0
            
            return (
            <Card key={testimonial.id} className="border">
              <CardContent className="pt-6 pb-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3 min-w-0">
                    <div className="bg-muted/30 rounded-lg p-4 border">
                      {hasText ? (
                        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
                          {testimonial.testimonial_text}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No testimonial text
                        </p>
                      )}
                    </div>
                    {(testimonial.customer_name || testimonial.business_name) && (
                      <div className="text-sm text-muted-foreground">
                        {testimonial.customer_name && (
                          <span className="font-medium text-foreground">{testimonial.customer_name}</span>
                        )}
                        {testimonial.customer_name && testimonial.business_name && (
                          <span>, </span>
                        )}
                        {testimonial.business_name && (
                          <span>{testimonial.business_name}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(testimonial)}
                      className="h-8"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(testimonial.id)}
                      disabled={deleteMutation.isPending}
                      className="h-8"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}


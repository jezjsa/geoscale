import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTestimonials, createTestimonial, updateTestimonial, deleteTestimonial } from '@/api/testimonials'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Trash2, Plus, Star } from 'lucide-react'

interface TestimonialsManagerProps {
  userId: string
}

export function TestimonialsManager({ userId }: TestimonialsManagerProps) {
  const queryClient = useQueryClient()
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    customer_name: '',
    testimonial_text: '',
    rating: 5,
  })

  const { data: testimonials, isLoading } = useQuery({
    queryKey: ['testimonials', userId],
    queryFn: () => getTestimonials(userId),
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => createTestimonial(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials', userId] })
      setIsAdding(false)
      setFormData({ customer_name: '', testimonial_text: '', rating: 5 })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) => 
      updateTestimonial(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials', userId] })
      setEditingId(null)
      setFormData({ customer_name: '', testimonial_text: '', rating: 5 })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTestimonial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials', userId] })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleEdit = (testimonial: any) => {
    setEditingId(testimonial.id)
    setFormData({
      customer_name: testimonial.customer_name,
      testimonial_text: testimonial.testimonial_text,
      rating: testimonial.rating || 5,
    })
    setIsAdding(false)
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    setFormData({ customer_name: '', testimonial_text: '', rating: 5 })
  }

  if (isLoading) {
    return <Card><CardContent className="py-8"><p className="text-muted-foreground">Loading...</p></CardContent></Card>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Testimonials</CardTitle>
              <CardDescription>
                Add customer testimonials to include in AI-generated content
              </CardDescription>
            </div>
            {!isAdding && !editingId && (
              <Button
                onClick={() => setIsAdding(true)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-900"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Testimonial
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {(isAdding || editingId) && (
            <form onSubmit={handleSubmit} className="space-y-4 mb-6 pb-6 border-b">
              <div className="space-y-2">
                <Label htmlFor="customer_name">Customer Name</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="John Smith"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="testimonial_text">Testimonial</Label>
                <Textarea
                  id="testimonial_text"
                  value={formData.testimonial_text}
                  onChange={(e) => setFormData({ ...formData, testimonial_text: e.target.value })}
                  placeholder="Great service, highly recommended!"
                  rows={4}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rating">Rating (1-5)</Label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFormData({ ...formData, rating: star })}
                      className={`${
                        star <= formData.rating
                          ? 'text-yellow-400'
                          : 'text-gray-300'
                      } hover:text-yellow-400 transition-colors`}
                    >
                      <Star className="h-6 w-6 fill-current" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="bg-gray-200 hover:bg-gray-300 text-gray-900"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingId ? 'Update' : 'Add'} Testimonial
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {testimonials && testimonials.length > 0 ? (
            <div className="space-y-4">
              {testimonials.map((testimonial) => (
                <Card key={testimonial.id}>
                  <CardContent className="pt-6">
                    {editingId === testimonial.id ? null : (
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{testimonial.customer_name}</h4>
                            {testimonial.rating && (
                              <div className="flex items-center gap-1 mt-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`h-4 w-4 ${
                                      star <= testimonial.rating!
                                        ? 'text-yellow-400 fill-current'
                                        : 'text-gray-300'
                                    }`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(testimonial)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteMutation.mutate(testimonial.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{testimonial.testimonial_text}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            !isAdding && (
              <p className="text-muted-foreground text-center py-8">
                No testimonials yet. Click "Add Testimonial" to get started.
              </p>
            )
          )}
        </CardContent>
      </Card>
    </div>
  )
}


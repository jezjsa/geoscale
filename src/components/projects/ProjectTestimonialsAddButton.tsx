import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ProjectTestimonialsAddButtonProps {
  projectId: string
}

export function ProjectTestimonialsAddButton({ projectId }: ProjectTestimonialsAddButtonProps) {
  const { data: testimonials } = useQuery({
    queryKey: ['projectTestimonials', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_testimonials')
        .select('id')
        .eq('project_id', projectId)

      if (error) throw error
      return data
    },
  })

  const hasTestimonials = testimonials && testimonials.length > 0

  if (!hasTestimonials) return null

  const handleClick = () => {
    // Trigger the add form by dispatching a custom event
    window.dispatchEvent(new CustomEvent('addTestimonial'))
  }

  return (
    <Button
      size="sm"
      style={{ backgroundColor: 'var(--brand-dark)' }}
      className="hover:opacity-90 text-white"
      onClick={handleClick}
    >
      <Plus className="mr-2 h-4 w-4" />
      Add Testimonial
    </Button>
  )
}


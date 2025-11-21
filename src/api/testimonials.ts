import { supabase } from '@/lib/supabase'
import type { Testimonial } from '@/types/database'

export async function getTestimonials(userId: string): Promise<Testimonial[]> {
  const { data, error } = await supabase
    .from('testimonials')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching testimonials:', error)
    throw error
  }

  return (data || []) as Testimonial[]
}

export async function createTestimonial(
  userId: string,
  testimonial: {
    customer_name: string
    testimonial_text: string
    rating?: number | null
  }
): Promise<Testimonial> {
  const { data, error } = await supabase
    .from('testimonials')
    .insert({
      user_id: userId,
      ...testimonial,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating testimonial:', error)
    throw error
  }

  return data as Testimonial
}

export async function updateTestimonial(
  testimonialId: string,
  updates: {
    customer_name?: string
    testimonial_text?: string
    rating?: number | null
    sort_order?: number
  }
): Promise<Testimonial> {
  const { data, error } = await supabase
    .from('testimonials')
    .update(updates)
    .eq('id', testimonialId)
    .select()
    .single()

  if (error) {
    console.error('Error updating testimonial:', error)
    throw error
  }

  return data as Testimonial
}

export async function deleteTestimonial(testimonialId: string): Promise<void> {
  const { error } = await supabase
    .from('testimonials')
    .delete()
    .eq('id', testimonialId)

  if (error) {
    console.error('Error deleting testimonial:', error)
    throw error
  }
}


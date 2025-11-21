import { supabase } from '@/lib/supabase'
import type { Plan } from '@/types/database'

export async function getPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching plans:', error)
    throw error
  }

  return data.map((plan) => ({
    ...plan,
    features: plan.features || [],
  })) as Plan[]
}

export async function getPlanByName(name: string): Promise<Plan | null> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('name', name)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('Error fetching plan:', error)
    return null
  }

  return {
    ...data,
    features: data.features || [],
  } as Plan
}


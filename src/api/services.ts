/**
 * API functions for project services, service keywords, and service FAQs
 */

import { supabase } from '@/lib/supabase'

// Types
export interface ProjectService {
  id: string
  project_id: string
  name: string
  slug: string
  description?: string
  service_page_url?: string
  created_at: string
  updated_at: string
  // Computed fields from joins
  keyword_count?: number
  selected_keyword_count?: number
  faq_count?: number
}

export interface ServiceKeyword {
  id: string
  service_id: string
  keyword: string
  search_volume?: number
  difficulty?: number
  is_selected: boolean
  created_at: string
}

export interface ServiceFaq {
  id: string
  service_id: string
  question: string
  answer: string
  sort_order: number
  created_at: string
  updated_at: string
}

// Helper to create slug from name
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ============ PROJECT SERVICES ============

export async function getProjectServices(projectId: string): Promise<ProjectService[]> {
  const { data, error } = await supabase
    .from('project_services')
    .select(`
      *,
      service_keywords(id, is_selected),
      service_faqs(id)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) throw error

  // Transform to include counts
  return (data || []).map(service => ({
    ...service,
    keyword_count: service.service_keywords?.length || 0,
    selected_keyword_count: service.service_keywords?.filter((k: any) => k.is_selected).length || 0,
    faq_count: service.service_faqs?.length || 0,
    service_keywords: undefined,
    service_faqs: undefined,
  }))
}

export async function getProjectService(serviceId: string): Promise<ProjectService | null> {
  const { data, error } = await supabase
    .from('project_services')
    .select('*')
    .eq('id', serviceId)
    .single()

  if (error) throw error
  return data
}

export async function createProjectService(
  projectId: string,
  name: string,
  description?: string,
  servicePageUrl?: string
): Promise<ProjectService> {
  const slug = createSlug(name)

  const { data, error } = await supabase
    .from('project_services')
    .insert({
      project_id: projectId,
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      service_page_url: servicePageUrl?.trim() || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateProjectService(
  serviceId: string,
  updates: { name?: string; description?: string; service_page_url?: string }
): Promise<ProjectService> {
  const updateData: any = { updated_at: new Date().toISOString() }
  
  if (updates.name) {
    updateData.name = updates.name.trim()
    updateData.slug = createSlug(updates.name)
  }
  if (updates.description !== undefined) {
    updateData.description = updates.description?.trim() || null
  }
  if (updates.service_page_url !== undefined) {
    updateData.service_page_url = updates.service_page_url?.trim() || null
  }

  const { data, error } = await supabase
    .from('project_services')
    .update(updateData)
    .eq('id', serviceId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteProjectService(serviceId: string): Promise<void> {
  const { error } = await supabase
    .from('project_services')
    .delete()
    .eq('id', serviceId)

  if (error) throw error
}

// ============ SERVICE KEYWORDS ============

export async function getServiceKeywords(serviceId: string): Promise<ServiceKeyword[]> {
  const { data, error } = await supabase
    .from('service_keywords')
    .select('*')
    .eq('service_id', serviceId)
    .order('search_volume', { ascending: false, nullsFirst: false })

  if (error) throw error
  return data || []
}

export async function addServiceKeywords(
  serviceId: string,
  keywords: Array<{ keyword: string; search_volume?: number; difficulty?: number }>
): Promise<ServiceKeyword[]> {
  const keywordsToInsert = keywords.map(kw => ({
    service_id: serviceId,
    keyword: kw.keyword,
    search_volume: kw.search_volume || null,
    difficulty: kw.difficulty || null,
    is_selected: true,
  }))

  const { data, error } = await supabase
    .from('service_keywords')
    .upsert(keywordsToInsert, {
      onConflict: 'service_id,keyword',
      ignoreDuplicates: true,
    })
    .select()

  if (error) throw error
  return data || []
}

export async function toggleKeywordSelection(
  keywordId: string,
  isSelected: boolean
): Promise<void> {
  const { error } = await supabase
    .from('service_keywords')
    .update({ is_selected: isSelected })
    .eq('id', keywordId)

  if (error) throw error
}

export async function bulkToggleKeywords(
  keywordIds: string[],
  isSelected: boolean
): Promise<void> {
  const { error } = await supabase
    .from('service_keywords')
    .update({ is_selected: isSelected })
    .in('id', keywordIds)

  if (error) throw error
}

export async function deleteServiceKeyword(keywordId: string): Promise<void> {
  const { error } = await supabase
    .from('service_keywords')
    .delete()
    .eq('id', keywordId)

  if (error) throw error
}

// ============ SERVICE FAQS ============

export async function getServiceFaqs(serviceId: string): Promise<ServiceFaq[]> {
  const { data, error } = await supabase
    .from('service_faqs')
    .select('*')
    .eq('service_id', serviceId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data || []
}

export async function getAllProjectFaqs(projectId: string): Promise<(ServiceFaq & { service_name: string })[]> {
  const { data, error } = await supabase
    .from('service_faqs')
    .select(`
      *,
      project_services!inner(name, project_id)
    `)
    .eq('project_services.project_id', projectId)
    .order('sort_order', { ascending: true })

  if (error) throw error

  return (data || []).map(faq => ({
    ...faq,
    service_name: faq.project_services?.name || '',
    project_services: undefined,
  }))
}

export async function createServiceFaq(
  serviceId: string,
  question: string,
  answer: string
): Promise<ServiceFaq> {
  // Get current max sort_order
  const { data: existing } = await supabase
    .from('service_faqs')
    .select('sort_order')
    .eq('service_id', serviceId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('service_faqs')
    .insert({
      service_id: serviceId,
      question: question.trim(),
      answer: answer.trim(),
      sort_order: nextOrder,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateServiceFaq(
  faqId: string,
  updates: { question?: string; answer?: string; sort_order?: number }
): Promise<ServiceFaq> {
  const updateData: any = { updated_at: new Date().toISOString() }
  
  if (updates.question) updateData.question = updates.question.trim()
  if (updates.answer) updateData.answer = updates.answer.trim()
  if (updates.sort_order !== undefined) updateData.sort_order = updates.sort_order

  const { data, error } = await supabase
    .from('service_faqs')
    .update(updateData)
    .eq('id', faqId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteServiceFaq(faqId: string): Promise<void> {
  const { error } = await supabase
    .from('service_faqs')
    .delete()
    .eq('id', faqId)

  if (error) throw error
}

// ============ COMBINATION CALCULATIONS ============

export async function getProjectCombinationStats(projectId: string): Promise<{
  locationCount: number
  selectedKeywordCount: number
  totalCombinations: number
}> {
  // Get location count
  const { count: locationCount } = await supabase
    .from('project_locations')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)

  // Get selected keyword count across all services
  const { data: services } = await supabase
    .from('project_services')
    .select('id')
    .eq('project_id', projectId)

  let selectedKeywordCount = 0
  if (services && services.length > 0) {
    const serviceIds = services.map(s => s.id)
    const { count } = await supabase
      .from('service_keywords')
      .select('*', { count: 'exact', head: true })
      .in('service_id', serviceIds)
      .eq('is_selected', true)
    
    selectedKeywordCount = count || 0
  }

  // Get ACTUAL combination count from location_keywords table
  const { count: actualCombinations } = await supabase
    .from('location_keywords')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)

  return {
    locationCount: locationCount || 0,
    selectedKeywordCount,
    totalCombinations: actualCombinations || 0,
  }
}

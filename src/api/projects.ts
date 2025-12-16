import { supabase } from '@/lib/supabase'
import { nanoid } from 'nanoid'

export interface CreateProjectData {
  companyName: string
  contactName: string
  contactEmail: string
  phoneNumber: string
  contactUrl: string
  serviceDescription: string
  wpUrl: string
  blogUrl: string
  userId: string
}

export async function createProject(data: CreateProjectData) {
  try {
    // Generate a secure API key for WordPress plugin authentication
    const wpApiKey = nanoid(32)

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        user_id: data.userId,
        project_name: data.companyName, // Use company name as project name
        company_name: data.companyName,
        contact_name: data.contactName,
        contact_email: data.contactEmail,
        phone_number: data.phoneNumber,
        contact_url: data.contactUrl,
        service_description: data.serviceDescription,
        wp_url: data.wpUrl,
        blog_url: data.blogUrl,
        wp_api_key: wpApiKey,
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, project, wpApiKey }
  } catch (error) {
    console.error('Error creating project:', error)
    throw error
  }
}

export async function getAgencyProjects(userId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      project_services(id),
      location_keywords(id)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  
  // Add service_count and combination_count to each project
  return (data || []).map(project => ({
    ...project,
    service_count: project.project_services?.length || 0,
    combination_count: project.location_keywords?.length || 0,
    project_services: undefined, // Remove the raw array
    location_keywords: undefined, // Remove the raw array
  }))
}

export async function getProject(projectId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (error) throw error
  return data
}

export async function updateProject(projectId: string, updates: Partial<{
  company_name: string
  contact_name: string
  contact_email: string
  phone_number: string
  wp_url: string
  blog_url: string
  contact_url: string
  service_description: string
  wp_api_key: string
  wp_page_template: string
  wp_publish_status: string
  town: string
  latitude: number
  longitude: number
}>) {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId)
    .select()
    .single()

  if (error) throw error
  return data
}

export interface DashboardStats {
  projects_count: number
  locations_count: number
  keywords_count: number
  pages_generated_count: number
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  // Get projects count
  const { count: projectsCount, error: projectsError } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (projectsError) throw projectsError

  // Get user's project IDs
  const { data: projects, error: projectsListError } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', userId)

  if (projectsListError) throw projectsListError

  const projectIds = projects?.map(p => p.id) || []

  // Get locations count across all user's projects
  const { count: locationsCount, error: locationsError } = await supabase
    .from('project_locations')
    .select('*', { count: 'exact', head: true })
    .in('project_id', projectIds.length > 0 ? projectIds : [''])

  if (locationsError) throw locationsError

  // Get keywords count across all user's projects
  const { count: keywordsCount, error: keywordsError } = await supabase
    .from('keyword_variations')
    .select('*', { count: 'exact', head: true })
    .in('project_id', projectIds.length > 0 ? projectIds : [''])

  if (keywordsError) throw keywordsError

  // Get pages generated count (location_keywords with status 'generated' or 'pushed')
  const { count: pagesCount, error: pagesError } = await supabase
    .from('location_keywords')
    .select('*', { count: 'exact', head: true })
    .in('project_id', projectIds.length > 0 ? projectIds : [''])
    .in('status', ['generated', 'pushed'])

  if (pagesError) throw pagesError

  return {
    projects_count: projectsCount || 0,
    locations_count: locationsCount || 0,
    keywords_count: keywordsCount || 0,
    pages_generated_count: pagesCount || 0,
  }
}


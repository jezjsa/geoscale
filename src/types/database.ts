// Database types for GeoScale

export type PlanName = 'individual' | 'agency' | 'agency_plus'

export interface Plan {
  id: string
  name: PlanName
  display_name: string
  description: string | null
  price_monthly: number
  price_yearly: number | null
  stripe_price_id_monthly: string | null
  stripe_price_id_yearly: string | null
  features: string[]
  max_projects: number | null
  max_locations: number | null
  max_keyword_variations: number | null
  max_generated_pages: number | null
  max_wordpress_pushes: number | null
  is_unlimited: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  supabase_auth_user_id: string
  name: string | null
  plan: PlanName
  agency_id: string | null
  created_at: string
  updated_at: string
}

export interface CompanySettings {
  id: string
  user_id: string
  business_name: string | null
  phone_number: string | null
  contact_url: string | null
  service_description: string | null
  created_at: string
  updated_at: string
}

export interface Testimonial {
  id: string
  user_id: string
  customer_name: string
  testimonial_text: string
  rating: number | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  user_id: string
  agency_id: string | null
  wp_url: string
  blog_url: string | null
  wp_api_key: string
  project_name: string
  base_keyword: string | null
  base_location: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
}

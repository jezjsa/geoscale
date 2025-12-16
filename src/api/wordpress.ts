import { supabase } from '@/lib/supabase'

export interface WordPressTemplate {
  value: string
  label: string
}

export interface WordPressSitemapItem {
  id: number
  type: string
  slug: string
  url: string
  meta_title: string
  meta_description: string
  status: string
  modified: string
}

/**
 * Fetch available page templates from WordPress site
 */
export async function fetchWordPressTemplates(
  wordpressUrl: string,
  wordpressApiKey: string
): Promise<WordPressTemplate[]> {
  // Get session to ensure JWT token is included
  const { data: { session } } = await supabase.auth.getSession()
  
  const { data, error } = await supabase.functions.invoke('fetch-wordpress-templates', {
    body: {
      wordpressUrl,
      wordpressApiKey,
    },
    headers: session ? {
      Authorization: `Bearer ${session.access_token}`,
    } : {},
  })

  if (error) {
    throw new Error(error.message || 'Failed to fetch WordPress templates')
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch WordPress templates')
  }

  return data.templates
}

/**
 * Fetch sitemap from WordPress site
 */
export async function fetchWordPressSitemap(
  wordpressUrl: string,
  wordpressApiKey: string
): Promise<{
  sitemap: WordPressSitemapItem[]
  total_items: number
  seo_plugin: string
}> {
  // Get session to ensure JWT token is included
  const { data: { session } } = await supabase.auth.getSession()
  
  const { data, error } = await supabase.functions.invoke('fetch-wordpress-sitemap', {
    body: {
      wordpressUrl,
      wordpressApiKey,
    },
    headers: session ? {
      Authorization: `Bearer ${session.access_token}`,
    } : {},
  })

  if (error) {
    throw new Error(error.message || 'Failed to fetch WordPress sitemap')
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch WordPress sitemap')
  }

  return {
    sitemap: data.sitemap,
    total_items: data.total_items,
    seo_plugin: data.seo_plugin,
  }
}

/**
 * Publish a page to WordPress
 */
export async function publishToWordPress(params: {
  combinationId: string
  title: string
  content: string
  metaTitle: string
  metaDescription: string
  wordpressUrl: string
  wordpressApiKey: string
  pageTemplate?: string
  publishStatus?: 'draft' | 'publish'
  location?: string
  keyword?: string
}): Promise<{
  success: boolean
  message: string
  page_id: number
  edit_url: string
  page_url: string
}> {
  // Get session to ensure JWT token is included
  const { data: { session } } = await supabase.auth.getSession()
  
  const { data, error } = await supabase.functions.invoke('publish-to-wordpress', {
    body: {
      combinationId: params.combinationId,
      title: params.title,
      content: params.content,
      metaTitle: params.metaTitle,
      metaDescription: params.metaDescription,
      wordpressUrl: params.wordpressUrl,
      wordpressApiKey: params.wordpressApiKey,
      pageTemplate: params.pageTemplate || '',
      publishStatus: params.publishStatus || 'draft',
      location: params.location,
      keyword: params.keyword,
    },
    headers: session ? {
      Authorization: `Bearer ${session.access_token}`,
    } : {},
  })

  if (error) {
    throw new Error(error.message || 'Failed to publish to WordPress')
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to publish to WordPress')
  }

  return data
}

/**
 * Update WordPress page meta data
 */
export async function updateWordPressPageMeta(params: {
  pageId: number
  metaTitle: string
  metaDescription: string
  wordpressUrl: string
  wordpressApiKey: string
}): Promise<{ success: boolean; message: string }> {
  // Get session to ensure JWT token is included
  const { data: { session } } = await supabase.auth.getSession()
  
  const { data, error } = await supabase.functions.invoke('update-wordpress-meta', {
    body: {
      pageId: params.pageId,
      metaTitle: params.metaTitle,
      metaDescription: params.metaDescription,
      wordpressUrl: params.wordpressUrl,
      wordpressApiKey: params.wordpressApiKey,
    },
    headers: session ? {
      Authorization: `Bearer ${session.access_token}`,
    } : {},
  })

  if (error) {
    throw new Error(error.message || 'Failed to update WordPress page meta')
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to update WordPress page meta')
  }

  return data
}

/**
 * Test WordPress connection via Edge Function to avoid CORS issues
 */
export async function testWordPressConnection(
  wordpressUrl: string,
  wordpressApiKey: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Get session to ensure JWT token is included
    const { data: { session } } = await supabase.auth.getSession()
    
    // Use the fetch-wordpress-templates Edge Function to test connection
    // If it can fetch templates, the connection works
    const { data, error } = await supabase.functions.invoke('fetch-wordpress-templates', {
      body: {
        wordpressUrl,
        wordpressApiKey,
      },
      headers: session ? {
        Authorization: `Bearer ${session.access_token}`,
      } : {},
    })

    if (error) {
      return { success: false, message: error.message || 'Connection failed' }
    }

    if (!data.success) {
      return { success: false, message: data.error || 'Connection failed' }
    }

    return { success: true, message: 'Connection successful - WordPress plugin detected' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
    }
  }
}


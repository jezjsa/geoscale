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
 * Test WordPress connection
 */
export async function testWordPressConnection(
  wordpressUrl: string,
  wordpressApiKey: string
): Promise<{ success: boolean; message: string }> {
  try {
    let wpUrl = wordpressUrl.trim()
    if (!wpUrl.startsWith('http://') && !wpUrl.startsWith('https://')) {
      wpUrl = 'https://' + wpUrl
    }
    wpUrl = wpUrl.replace(/\/$/, '')

    const response = await fetch(`${wpUrl}/wp-json/geoscale/v1/test`, {
      method: 'GET',
      headers: {
        'X-GeoScale-API-Key': wordpressApiKey.trim(),
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = 'Connection failed'
      
      if (response.status === 401) {
        errorMessage = 'Invalid API key'
      } else if (response.status === 404) {
        errorMessage = 'GeoScale plugin not found - Please install the plugin'
      } else {
        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.message || errorMessage
        } catch (e) {
          errorMessage = `${errorMessage} (Status: ${response.status})`
        }
      }
      
      return { success: false, message: errorMessage }
    }

    const data = await response.json()
    return { success: true, message: data.message || 'Connection successful' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
    }
  }
}


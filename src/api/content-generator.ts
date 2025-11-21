import { supabase } from '../lib/supabase';
import { publishToWordPress } from './wordpress';

export interface GenerateContentRequest {
  locationKeywordIds: string[];
}

export interface GenerateContentResult {
  locationKeywordId: string;
  success: boolean;
  generatedPageId?: string;
  error?: string;
}

export interface GenerateContentResponse {
  success: boolean;
  results: GenerateContentResult[];
}

export interface PublishToWordPressResult {
  success: boolean;
  page_id?: number;
  page_url?: string;
  edit_url?: string;
  error?: string;
}

/**
 * Triggers content generation for selected location keywords
 * Calls the Supabase Edge Function to generate landing page content using OpenAI
 */
export async function generateContent(
  locationKeywordIds: string[]
): Promise<GenerateContentResponse> {
  try {
    console.log('🌐 API: generateContent called with IDs:', locationKeywordIds)
    
    // Get the current session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      console.error('❌ API: No active session')
      throw new Error('No active session');
    }

    console.log('✅ API: Session found, calling Edge Function...')

    // Call the Edge Function
    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: { locationKeywordIds },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      console.error('❌ API: Edge Function error:', error)
      throw error;
    }

    console.log('✅ API: Edge Function response:', data)
    return data as GenerateContentResponse;
  } catch (error) {
    console.error('❌ API: Error generating content:', error);
    throw error;
  }
}

/**
 * Fetches generated page content for a location keyword
 */
export async function getGeneratedPage(locationKeywordId: string) {
  try {
    const { data, error } = await supabase
      .from('generated_pages')
      .select('*')
      .eq('location_keyword_id', locationKeywordId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error fetching generated page:', error);
    throw error;
  }
}

/**
 * Deletes generated page content for a location keyword
 */
export async function deleteGeneratedPage(locationKeywordId: string) {
  try {
    const { error } = await supabase
      .from('generated_pages')
      .delete()
      .eq('location_keyword_id', locationKeywordId);

    if (error) {
      throw error;
    }

    // Reset the status back to pending
    await supabase
      .from('location_keywords')
      .update({ status: 'pending' })
      .eq('id', locationKeywordId);

    return true;
  } catch (error) {
    console.error('Error deleting generated page:', error);
    throw error;
  }
}

/**
 * Publishes generated content to WordPress
 */
export async function publishGeneratedPageToWordPress(
  locationKeywordId: string,
  projectId: string
): Promise<PublishToWordPressResult> {
  try {
    // Get the generated page content
    const { data: page, error: pageError } = await supabase
      .from('generated_pages')
      .select('*')
      .eq('location_keyword_id', locationKeywordId)
      .single();

    if (pageError || !page) {
      throw new Error('Generated page not found. Please generate content first.');
    }

    // Get the location keyword details
    const { data: combination, error: combinationError } = await supabase
      .from('location_keywords')
      .select(`
        *,
        project_locations(name),
        keyword_variations(keyword)
      `)
      .eq('id', locationKeywordId)
      .single();

    if (combinationError || !combination) {
      throw new Error('Combination not found');
    }

    // Get project WordPress settings
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('wp_url, wp_api_key, wp_page_template, wp_publish_status')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      throw new Error('Project not found');
    }

    if (!project.wp_url || !project.wp_api_key) {
      throw new Error('WordPress URL and API key not configured for this project');
    }

    // Publish to WordPress
    const result = await publishToWordPress({
      combinationId: locationKeywordId,
      title: page.title,
      content: page.content,
      metaTitle: page.meta_title || page.title,
      metaDescription: page.meta_description || '',
      wordpressUrl: project.wp_url,
      wordpressApiKey: project.wp_api_key,
      pageTemplate: project.wp_page_template || '',
      publishStatus: (project.wp_publish_status as 'draft' | 'publish') || 'draft',
      location: combination.project_locations?.name || '',
      keyword: combination.keyword_variations?.keyword || '',
    });

    return {
      success: true,
      page_id: result.page_id,
      page_url: result.page_url,
      edit_url: result.edit_url,
    };
  } catch (error) {
    console.error('Error publishing to WordPress:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to publish to WordPress',
    };
  }
}


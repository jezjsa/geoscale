import { supabase } from '@/lib/supabase'

export interface QueueJobRequest {
  locationKeywordIds: string[]
  projectId: string
  userId: string
}

export interface QueueJobResponse {
  success: boolean
  jobsCreated: number
  jobIds: string[]
}

/**
 * Queue content generation jobs for processing by the background worker
 */
export async function queueContentGeneration(
  locationKeywordIds: string[],
  projectId: string,
  userId: string
): Promise<QueueJobResponse> {
  try {
    console.log('📋 [QUEUE] Queueing jobs for:', locationKeywordIds)

    // Update location_keywords status to 'queued' immediately for UI feedback
    const { error: updateError } = await supabase
      .from('location_keywords')
      .update({ status: 'queued', updated_at: new Date().toISOString() })
      .in('id', locationKeywordIds)

    if (updateError) {
      console.error('❌ [QUEUE] Error updating location_keywords status:', updateError)
      throw updateError
    }

    // Create jobs in the queue
    const jobs = locationKeywordIds.map((locationKeywordId) => ({
      user_id: userId,
      project_id: projectId,
      location_keyword_id: locationKeywordId,
      status: 'queued',
      priority: 0,
      attempts: 0,
      max_attempts: 3,
    }))

    const { data, error } = await supabase
      .from('content_generation_jobs')
      .insert(jobs)
      .select('id')

    if (error) {
      console.error('❌ [QUEUE] Error creating jobs:', error)
      throw error
    }

    console.log(`✅ [QUEUE] Created ${data.length} jobs`)

    return {
      success: true,
      jobsCreated: data.length,
      jobIds: data.map((job) => job.id),
    }
  } catch (error) {
    console.error('❌ [QUEUE] Error:', error)
    throw error
  }
}

/**
 * Get job status for a location keyword
 */
export async function getJobStatus(locationKeywordId: string) {
  const { data, error } = await supabase
    .from('content_generation_jobs')
    .select('*')
    .eq('location_keyword_id', locationKeywordId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 is "not found" which is ok
    throw error
  }

  return data
}

/**
 * Get all jobs for a project
 */
export async function getProjectJobs(projectId: string) {
  const { data, error } = await supabase
    .from('content_generation_jobs')
    .select('*, location_keyword:location_keywords(phrase)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

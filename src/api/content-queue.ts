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

export interface QueueStatus {
  totalQueued: number
  totalProcessing: number
  position: number | null // Position of this specific item in queue
  estimatedWaitMinutes: number
}

/**
 * Get real-time queue status for a specific location keyword
 */
export async function getQueuePosition(locationKeywordId: string): Promise<QueueStatus> {
  // Get all queued jobs ordered by priority and created_at
  const { data: queuedJobs, error } = await supabase
    .from('content_generation_jobs')
    .select('id, location_keyword_id, created_at, priority')
    .eq('status', 'queued')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw error

  // Get processing count
  const { count: processingCount } = await supabase
    .from('content_generation_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'processing')

  const totalQueued = queuedJobs?.length || 0
  const totalProcessing = processingCount || 0

  // Find position of this specific item
  let position: number | null = null
  if (queuedJobs) {
    const index = queuedJobs.findIndex(job => job.location_keyword_id === locationKeywordId)
    if (index !== -1) {
      position = index + 1 // 1-indexed position
    }
  }

  // Estimate wait time: ~20 seconds per job, processing 5 at a time per minute
  // So roughly 5 jobs per minute = 12 seconds per job on average
  const estimatedWaitMinutes = position ? Math.ceil((position * 12) / 60) : 0

  return {
    totalQueued,
    totalProcessing,
    position,
    estimatedWaitMinutes,
  }
}

/**
 * Get global queue stats (for all users)
 */
export async function getGlobalQueueStats() {
  const { count: queuedCount } = await supabase
    .from('content_generation_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')

  const { count: processingCount } = await supabase
    .from('content_generation_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'processing')

  return {
    queued: queuedCount || 0,
    processing: processingCount || 0,
  }
}

import { supabase } from '@/lib/supabase'

export interface WordPressPushJobRequest {
  locationKeywordIds: string[]
  projectId: string
  userId: string
}

export interface WordPressPushJobResponse {
  success: boolean
  jobsCreated: number
  jobIds: string[]
}

/**
 * Queue WordPress push jobs for processing by the background worker
 */
export async function queueWordPressPush(
  locationKeywordIds: string[],
  projectId: string,
  userId: string
): Promise<WordPressPushJobResponse> {
  try {
    console.log('📋 [WP QUEUE] Queueing WordPress push jobs for:', locationKeywordIds.length, 'items')

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
      .from('wordpress_push_jobs')
      .insert(jobs)
      .select('id')

    if (error) {
      console.error('❌ [WP QUEUE] Error creating jobs:', error)
      throw error
    }

    console.log(`✅ [WP QUEUE] Created ${data.length} WordPress push jobs`)

    return {
      success: true,
      jobsCreated: data.length,
      jobIds: data.map((job) => job.id),
    }
  } catch (error) {
    console.error('❌ [WP QUEUE] Error:', error)
    throw error
  }
}

/**
 * Get WordPress push job status for a location keyword
 */
export async function getWordPressPushJobStatus(locationKeywordId: string) {
  const { data, error } = await supabase
    .from('wordpress_push_jobs')
    .select('*')
    .eq('location_keyword_id', locationKeywordId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw error
  }

  return data
}

/**
 * Get all WordPress push jobs for a project
 */
export async function getProjectWordPressPushJobs(projectId: string) {
  const { data, error } = await supabase
    .from('wordpress_push_jobs')
    .select('*, location_keyword:location_keywords(phrase)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export interface WordPressPushQueueStatus {
  totalQueued: number
  totalProcessing: number
  position: number | null
  estimatedWaitMinutes: number
}

/**
 * Get real-time queue status for WordPress push jobs
 */
export async function getWordPressPushQueuePosition(locationKeywordId: string): Promise<WordPressPushQueueStatus> {
  const { data: queuedJobs, error } = await supabase
    .from('wordpress_push_jobs')
    .select('id, location_keyword_id, created_at, priority')
    .eq('status', 'queued')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw error

  const { count: processingCount } = await supabase
    .from('wordpress_push_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'processing')

  const totalQueued = queuedJobs?.length || 0
  const totalProcessing = processingCount || 0

  let position: number | null = null
  if (queuedJobs) {
    const index = queuedJobs.findIndex(job => job.location_keyword_id === locationKeywordId)
    if (index !== -1) {
      position = index + 1
    }
  }

  // Estimate wait time: ~5 seconds per WordPress push
  const estimatedWaitMinutes = position ? Math.ceil((position * 5) / 60) : 0

  return {
    totalQueued,
    totalProcessing,
    position,
    estimatedWaitMinutes,
  }
}

/**
 * Get global WordPress push queue stats
 */
export async function getGlobalWordPressPushQueueStats() {
  const { count: queuedCount } = await supabase
    .from('wordpress_push_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')

  const { count: processingCount } = await supabase
    .from('wordpress_push_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'processing')

  return {
    queued: queuedCount || 0,
    processing: processingCount || 0,
  }
}

/**
 * Get WordPress push queue stats for a specific project
 */
export async function getProjectWordPressPushQueueStats(projectId: string) {
  const { count: queuedCount } = await supabase
    .from('wordpress_push_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('status', 'queued')

  const { count: processingCount } = await supabase
    .from('wordpress_push_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('status', 'processing')

  const totalPending = (queuedCount || 0) + (processingCount || 0)
  
  // Estimate: cron runs every minute, processes 5 at a time
  // So if we have 10 pending, it will take ~2 minutes
  const estimatedMinutes = Math.ceil(totalPending / 5)

  return {
    queued: queuedCount || 0,
    processing: processingCount || 0,
    totalPending,
    estimatedMinutes,
  }
}

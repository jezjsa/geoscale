import { useState, useEffect } from 'react'
import { Loader2, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getGlobalQueueStats } from '@/api/content-queue'

interface QueueStatusIndicatorProps {
  projectId: string
}

export function QueueStatusIndicator({ projectId }: QueueStatusIndicatorProps) {
  const [queueStats, setQueueStats] = useState<{ queued: number; processing: number } | null>(null)

  // Fetch queue stats and subscribe to real-time updates
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const stats = await getGlobalQueueStats()
        setQueueStats(stats)
      } catch (error) {
        console.error('Error fetching queue stats:', error)
      }
    }

    // Initial fetch
    fetchStats()

    // Poll every 5 seconds for updates
    const interval = setInterval(fetchStats, 5000)

    // Also subscribe to real-time changes on content_generation_jobs
    const channel = supabase
      .channel('queue_status_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content_generation_jobs',
        },
        () => {
          // Refetch stats when any job changes
          fetchStats()
        }
      )
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [projectId])

  if (!queueStats || (queueStats.queued === 0 && queueStats.processing === 0)) {
    return null
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
          Queue Status
        </span>
      </div>
      <div className="flex items-center gap-4 text-sm text-blue-700 dark:text-blue-300">
        {queueStats.processing > 0 && (
          <span className="flex items-center gap-1">
            <span className="font-semibold">{queueStats.processing}</span> processing
          </span>
        )}
        {queueStats.queued > 0 && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span className="font-semibold">{queueStats.queued}</span> waiting
          </span>
        )}
        <span className="text-xs text-blue-600 dark:text-blue-400">
          ~{Math.ceil((queueStats.queued * 12) / 60)} min remaining
        </span>
      </div>
    </div>
  )
}

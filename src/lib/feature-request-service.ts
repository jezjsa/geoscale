import { supabase } from './supabase'
import type { FeatureRequest, FeatureRequestWithUser, FeatureRequestStatus } from '@/types/database'

export const getAllFeatureRequests = async (currentUserId?: string): Promise<FeatureRequestWithUser[]> => {
  const { data: features, error } = await supabase
    .from('feature_requests')
    .select(`
      *,
      user:users!feature_requests_user_id_fkey(name, is_super_admin)
    `)
    .order('vote_count', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching feature requests:', error)
    throw error
  }

  if (!currentUserId) {
    return features as FeatureRequestWithUser[]
  }

  const { data: votes } = await supabase
    .from('feature_votes')
    .select('feature_id')
    .eq('user_id', currentUserId)

  const votedFeatureIds = new Set(votes?.map(v => v.feature_id) || [])

  return features.map(feature => ({
    ...feature,
    has_voted: votedFeatureIds.has(feature.id)
  })) as FeatureRequestWithUser[]
}

export const createFeatureRequest = async (
  userId: string,
  title: string,
  description: string,
  isAdminRequest: boolean = false
): Promise<FeatureRequest> => {
  const { data, error } = await supabase
    .from('feature_requests')
    .insert({
      user_id: userId,
      title: title.trim(),
      description: description.trim(),
      is_admin_request: isAdminRequest
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating feature request:', error)
    throw error
  }

  return data as FeatureRequest
}

export const updateFeatureRequestStatus = async (
  featureId: string,
  status: FeatureRequestStatus
): Promise<void> => {
  const { error } = await supabase
    .from('feature_requests')
    .update({ status })
    .eq('id', featureId)

  if (error) {
    console.error('Error updating feature request status:', error)
    throw error
  }
}

export const deleteFeatureRequest = async (featureId: string): Promise<void> => {
  const { error } = await supabase
    .from('feature_requests')
    .delete()
    .eq('id', featureId)

  if (error) {
    console.error('Error deleting feature request:', error)
    throw error
  }
}

export const toggleVote = async (userId: string, featureId: string): Promise<boolean> => {
  const { data: existingVote } = await supabase
    .from('feature_votes')
    .select('id')
    .eq('user_id', userId)
    .eq('feature_id', featureId)
    .maybeSingle()

  if (existingVote) {
    const { error } = await supabase
      .from('feature_votes')
      .delete()
      .eq('id', existingVote.id)

    if (error) {
      console.error('Error removing vote:', error)
      throw error
    }
    return false
  } else {
    const { error } = await supabase
      .from('feature_votes')
      .insert({
        user_id: userId,
        feature_id: featureId
      })

    if (error) {
      console.error('Error adding vote:', error)
      throw error
    }
    return true
  }
}

export const hasUserVoted = async (userId: string, featureId: string): Promise<boolean> => {
  const { data } = await supabase
    .from('feature_votes')
    .select('id')
    .eq('user_id', userId)
    .eq('feature_id', featureId)
    .maybeSingle()

  return !!data
}

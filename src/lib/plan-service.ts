import { supabase } from './supabase';
import { Plan } from '../types';

// Simple in-memory cache for plans
let plansCache: { data: Plan[] | null; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour (plans don't change often)

/**
 * Get all available plans
 */
export const getAllPlans = async (): Promise<Plan[]> => {
  // Check cache first
  const now = Date.now();
  if (plansCache && (now - plansCache.timestamp) < CACHE_DURATION && plansCache.data) {
    return plansCache.data;
  }

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch plans: ${error.message}`);
  }

  const plans: Plan[] = (data || []).map((plan: any) => ({
    id: plan.id,
    name: plan.name,
    displayName: plan.display_name,
    description: plan.description,
    websiteLimit: plan.website_limit,
    combinationPageLimit: plan.combination_page_limit,
    rankTrackingFrequency: plan.rank_tracking_frequency,
    rankTrackingLimit: plan.rank_tracking_limit || 10,
    basePriceGbp: parseFloat(plan.base_price_gbp),
    perSitePriceGbp: parseFloat(plan.per_site_price_gbp),
    features: plan.features || [],
    targetCustomer: plan.target_customer,
    isActive: plan.is_active,
    createdAt: plan.created_at,
    updatedAt: plan.updated_at,
  }));

  // Update cache
  plansCache = {
    data: plans,
    timestamp: now,
  };

  return plans;
};

/**
 * Get a specific plan by name
 */
export const getPlanByName = async (name: 'starter' | 'pro' | 'agency'): Promise<Plan | null> => {
  const plans = await getAllPlans();
  return plans.find(p => p.name === name) || null;
};

/**
 * Get a specific plan by ID
 */
export const getPlanById = async (planId: string): Promise<Plan | null> => {
  const plans = await getAllPlans();
  return plans.find(p => p.id === planId) || null;
};

// Cache for current user's plan to avoid repeated calls
let currentUserPlanCache: { plan: Plan | null; userId: string; timestamp: number } | null = null;
const PLAN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get current user's plan (with caching)
 */
export const getCurrentUserPlan = async (userId?: string): Promise<Plan | null> => {
  // Get user ID from parameter or fetch from auth
  let targetUserId = userId;
  if (!targetUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    targetUserId = user.id;
  }

  // Check cache
  const now = Date.now();
  if (currentUserPlanCache && 
      currentUserPlanCache.userId === targetUserId && 
      (now - currentUserPlanCache.timestamp) < PLAN_CACHE_DURATION) {
    return currentUserPlanCache.plan;
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('plan_id')
    .eq('id', targetUserId)
    .maybeSingle();

  if (error || !user || !user.plan_id) {
    return null;
  }

  const plan = await getPlanById(user.plan_id);
  
  // Update cache
  currentUserPlanCache = {
    plan,
    userId: targetUserId,
    timestamp: now,
  };

  return plan;
};

/**
 * Check if user is on agency plan
 */
export const isAgencyUser = async (): Promise<boolean> => {
  const plan = await getCurrentUserPlan();
  return plan?.name === 'agency';
};

/**
 * Check if user can manage multiple projects (agency plan)
 */
export const canManageMultipleProjects = async (): Promise<boolean> => {
  const plan = await getCurrentUserPlan();
  return plan?.name === 'agency';
};

/**
 * Check if user is a super admin
 */
export const isSuperAdmin = async (): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data: userData, error } = await supabase
    .from('users')
    .select('is_super_admin')
    .eq('id', user.id)
    .maybeSingle();

  return !error && userData?.is_super_admin === true;
};

/**
 * Get user's current usage stats
 */
export const getUserUsageStats = async (userId?: string) => {
  let targetUserId = userId;
  if (!targetUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    targetUserId = user.id;
  }

  // Get project count
  const { count: projectCount } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', targetUserId);

  // Get total combination pages across all projects
  const { count: combinationCount } = await supabase
    .from('location_keywords')
    .select('*, projects!inner(user_id)', { count: 'exact', head: true })
    .eq('projects.user_id', targetUserId);

  // Get tracked combinations count
  const { count: trackedCount } = await supabase
    .from('location_keywords')
    .select('*, projects!inner(user_id)', { count: 'exact', head: true })
    .eq('projects.user_id', targetUserId)
    .eq('track_position', true);

  return {
    projectCount: projectCount || 0,
    combinationCount: combinationCount || 0,
    trackedCount: trackedCount || 0,
  };
};

/**
 * Check if user can create a new project
 */
export const canCreateProject = async (userId?: string): Promise<{ allowed: boolean; reason?: string }> => {
  const plan = await getCurrentUserPlan(userId);
  if (!plan) {
    return { allowed: false, reason: 'No plan found' };
  }

  const stats = await getUserUsageStats(userId);
  if (!stats) {
    return { allowed: false, reason: 'Could not fetch usage stats' };
  }

  if (stats.projectCount >= plan.websiteLimit) {
    return { 
      allowed: false, 
      reason: `You've reached your plan limit of ${plan.websiteLimit} website${plan.websiteLimit > 1 ? 's' : ''}. Upgrade to create more.` 
    };
  }

  return { allowed: true };
};

/**
 * Check if user can create more combinations
 */
export const canCreateCombinations = async (
  newCount: number,
  userId?: string
): Promise<{ allowed: boolean; reason?: string; remaining?: number }> => {
  const plan = await getCurrentUserPlan(userId);
  if (!plan) {
    return { allowed: false, reason: 'No plan found' };
  }

  const stats = await getUserUsageStats(userId);
  if (!stats) {
    return { allowed: false, reason: 'Could not fetch usage stats' };
  }

  const remaining = plan.combinationPageLimit - stats.combinationCount;
  
  if (stats.combinationCount + newCount > plan.combinationPageLimit) {
    return { 
      allowed: false, 
      reason: `This would exceed your plan limit of ${plan.combinationPageLimit} pages. You have ${remaining} remaining.`,
      remaining 
    };
  }

  return { allowed: true, remaining };
};

/**
 * Clear plans cache (use when plans are updated)
 */
export const clearPlansCache = () => {
  plansCache = null;
  currentUserPlanCache = null;
};

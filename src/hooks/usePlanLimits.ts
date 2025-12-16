import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentUserPlan, getUserUsageStats, getUserCredits } from '@/lib/plan-service';
import { Plan } from '@/types';

interface PlanLimits {
  plan: Plan | null;
  usage: {
    projectCount: number;
    combinationCount: number;
    trackedCount: number;
  };
  limits: {
    websiteLimit: number;
    combinationPageLimit: number;
    combinationsPerWebsite: number;
    rankTrackingFrequency: 'weekly' | 'every_other_day' | 'daily' | null;
    rankTrackingLimit: number;
  };
  remaining: {
    projects: number;
    combinations: number;
  };
  percentUsed: {
    projects: number;
    combinations: number;
  };
  credits: {
    rankChecksUsedToday: number;
    rankChecksDailyQuota: number;
    rankChecksRemaining: number;
    mapPackChecksUsed: number;
    mapPackChecksPurchased: number;
    mapPackChecksRemaining: number;
  };
  isLoading: boolean;
}

export function usePlanLimits(): PlanLimits {
  const { user } = useAuth();
  const [planLimits, setPlanLimits] = useState<PlanLimits>({
    plan: null,
    usage: {
      projectCount: 0,
      combinationCount: 0,
      trackedCount: 0,
    },
    limits: {
      websiteLimit: 0,
      combinationPageLimit: 0,
      combinationsPerWebsite: 0,
      rankTrackingFrequency: 'weekly',
      rankTrackingLimit: 0,
    },
    remaining: {
      projects: 0,
      combinations: 0,
    },
    percentUsed: {
      projects: 0,
      combinations: 0,
    },
    credits: {
      rankChecksUsedToday: 0,
      rankChecksDailyQuota: 0,
      rankChecksRemaining: 0,
      mapPackChecksUsed: 0,
      mapPackChecksPurchased: 0,
      mapPackChecksRemaining: 0,
    },
    isLoading: true,
  });

  useEffect(() => {
    async function fetchLimits() {
      if (!user?.id) {
        setPlanLimits(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        const [plan, usage, credits] = await Promise.all([
          getCurrentUserPlan(user.id),
          getUserUsageStats(user.id),
          getUserCredits(user.id),
        ]);

        if (plan && usage) {
          const remainingProjects = plan.websiteLimit - usage.projectCount;
          const remainingCombinations = plan.combinationPageLimit - usage.combinationCount;

          // Calculate daily rank check quota: base + (per_site * number_of_projects)
          const rankChecksDailyQuota = plan.rankCheckDailyBase + (plan.rankCheckPerSite * usage.projectCount);
          const rankChecksUsedToday = credits?.rankChecksUsedToday || 0;
          const rankChecksRemaining = Math.max(0, rankChecksDailyQuota - rankChecksUsedToday);

          // Map pack credits
          const mapPackChecksUsed = credits?.mapPackChecksUsed || 0;
          const mapPackChecksPurchased = credits?.mapPackChecksPurchased || 0;
          const mapPackChecksRemaining = Math.max(0, mapPackChecksPurchased - mapPackChecksUsed);

          setPlanLimits({
            plan,
            usage,
            limits: {
              websiteLimit: plan.websiteLimit,
              combinationPageLimit: plan.combinationPageLimit,
              combinationsPerWebsite: plan.combinationsPerWebsite,
              rankTrackingFrequency: plan.rankTrackingFrequency,
              rankTrackingLimit: plan.rankTrackingLimit,
            },
            remaining: {
              projects: Math.max(0, remainingProjects),
              combinations: Math.max(0, remainingCombinations),
            },
            percentUsed: {
              projects: Math.min(100, (usage.projectCount / plan.websiteLimit) * 100),
              combinations: Math.min(100, (usage.combinationCount / plan.combinationPageLimit) * 100),
            },
            credits: {
              rankChecksUsedToday,
              rankChecksDailyQuota,
              rankChecksRemaining,
              mapPackChecksUsed,
              mapPackChecksPurchased,
              mapPackChecksRemaining,
            },
            isLoading: false,
          });
        } else {
          setPlanLimits(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Error fetching plan limits:', error);
        setPlanLimits(prev => ({ ...prev, isLoading: false }));
      }
    }

    fetchLimits();
  }, [user?.id]);

  return planLimits;
}

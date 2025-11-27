import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentUserPlan, getUserUsageStats } from '@/lib/plan-service';
import { Plan } from '@/types';

interface PlanLimits {
  plan: Plan | null;
  usage: {
    projectCount: number;
    combinationCount: number;
  };
  limits: {
    websiteLimit: number;
    combinationPageLimit: number;
    rankTrackingFrequency: 'weekly' | 'daily';
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
  isLoading: boolean;
}

export function usePlanLimits(): PlanLimits {
  const { user } = useAuth();
  const [planLimits, setPlanLimits] = useState<PlanLimits>({
    plan: null,
    usage: {
      projectCount: 0,
      combinationCount: 0,
    },
    limits: {
      websiteLimit: 0,
      combinationPageLimit: 0,
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
    isLoading: true,
  });

  useEffect(() => {
    async function fetchLimits() {
      if (!user?.id) {
        setPlanLimits(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        const [plan, usage] = await Promise.all([
          getCurrentUserPlan(user.id),
          getUserUsageStats(user.id),
        ]);

        if (plan && usage) {
          const remainingProjects = plan.websiteLimit - usage.projectCount;
          const remainingCombinations = plan.combinationPageLimit - usage.combinationCount;

          setPlanLimits({
            plan,
            usage,
            limits: {
              websiteLimit: plan.websiteLimit,
              combinationPageLimit: plan.combinationPageLimit,
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

// Plan types for subscription management
export interface Plan {
  id: string;
  name: 'starter' | 'pro' | 'agency';
  displayName: string;
  description: string;
  websiteLimit: number;
  combinationPageLimit: number; // Total limit (for backward compat)
  combinationsPerWebsite: number; // Per-project limit
  rankTrackingFrequency: 'weekly' | 'daily';
  rankTrackingLimit: number; // Per-project rank tracking limit
  basePriceGbp: number;
  perSitePriceGbp: number;
  features: string[];
  targetCustomer?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// User with plan information
export interface UserWithPlan {
  id: string;
  email: string;
  planId?: string;
  plan?: Plan;
  isTrial: boolean;
  trialEndDate?: string;
  isSuperAdmin: boolean;
  websiteCount: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

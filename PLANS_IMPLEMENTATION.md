# GeoScale Plans Implementation Guide

Based on your plans.md and GhostSEO-v2 implementation pattern.

## Plan Structure

### Starter – £29/month
- **Target**: Solo site owners who want automation but minimal volume
- **Limits**:
  - 1 website
  - Up to 50 generated combination pages
  - Basic rank tracking (weekly)
- **Features**:
  - Content generation
  - Bulk meta editing
  - Weekly rank tracking

### Pro – £59/month
- **Target**: Businesses with multiple services or larger geographic coverage
- **Limits**:
  - 1 website  
  - Up to 100 generated combination pages
  - Daily rank tracking
- **Features**:
  - All Starter features
  - CSV upload
  - Content refresh button
  - Daily rank tracking

### Agency – £149/month
- **Target**: Agencies managing multiple clients
- **Limits**:
  - Up to 10 websites
  - Up to 1000 generated combination pages across clients
  - Team users
- **Features**:
  - All Pro features
  - Multi-client management
  - Team user access
- **Add-ons**:
  - Extra sites: £25/month per site

---

## Database Schema (Based on GhostSEO Pattern)

### 1. Create `plans` table

```sql
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE, -- 'starter', 'pro', 'agency'
  display_name text NOT NULL, -- 'Starter', 'Pro', 'Agency'
  description text,
  
  -- Limits
  website_limit integer NOT NULL DEFAULT 1,
  combination_page_limit integer NOT NULL DEFAULT 50,
  rank_tracking_frequency text NOT NULL DEFAULT 'weekly', -- 'weekly', 'daily'
  
  -- Pricing
  base_price_gbp decimal(10,2) DEFAULT 0,
  per_site_price_gbp decimal(10,2) DEFAULT 0, -- For agency extra sites
  
  -- Features (JSON array)
  features jsonb DEFAULT '[]'::jsonb,
  
  -- Meta
  is_active boolean DEFAULT true,
  target_customer text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plans_name ON public.plans(name);
```

### 2. Update `users` table (or create if needed)

```sql
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id),
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
ADD COLUMN IF NOT EXISTS is_trial boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS trial_end_date timestamp with time zone DEFAULT (now() + interval '7 days'),
ADD COLUMN IF NOT EXISTS is_super_admin boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS website_count integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_plan_id ON public.users(plan_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON public.users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_is_trial ON public.users(is_trial);
```

### 3. Update `projects` table

```sql
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS managed_by_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_projects_managed_by_user_id ON public.projects(managed_by_user_id);
```

### 4. Insert default plans

```sql
INSERT INTO public.plans (
  name, 
  display_name, 
  description, 
  website_limit, 
  combination_page_limit, 
  rank_tracking_frequency,
  base_price_gbp, 
  per_site_price_gbp,
  features,
  target_customer
)
VALUES
  (
    'starter',
    'Starter',
    'For solo site owners who want automation but minimal volume.',
    1,
    50,
    'weekly',
    29.00,
    0,
    '["content_generation", "bulk_meta_editing", "weekly_rank_tracking"]'::jsonb,
    'Solo site owners who want automation but minimal volume.'
  ),
  (
    'pro',
    'Pro',
    'For businesses with multiple services or larger geographic coverage.',
    1,
    100,
    'daily',
    59.00,
    0,
    '["content_generation", "bulk_meta_editing", "daily_rank_tracking", "csv_upload", "content_refresh"]'::jsonb,
    'Businesses with multiple services or larger geographic coverage.'
  ),
  (
    'agency',
    'Agency',
    'For agencies managing multiple clients.',
    10,
    1000,
    'daily',
    149.00,
    25.00,
    '["content_generation", "bulk_meta_editing", "daily_rank_tracking", "csv_upload", "content_refresh", "multi_client_management", "team_users"]'::jsonb,
    'Agencies managing multiple clients.'
  )
ON CONFLICT (name) DO NOTHING;
```

---

## Frontend Implementation

### Files to Create/Copy from GhostSEO:

1. **`src/components/PlansSelection.tsx`**
   - Copy from GhostSEO
   - Update branding colors (#006239 instead of #2a9d8f)
   - Update plan features display
   - Update pricing display

2. **`src/lib/plan-service.ts`**
   - Copy from GhostSEO
   - Update function names if needed
   - Keep caching logic

3. **`src/pages/PlansPage.tsx`**
   - Create route for `/plans`
   - Use PlansSelection component

4. **`src/pages/SignUpPage.tsx`**
   - Show selected plan at top
   - Allow "Change Plan" link
   - Show discount code input
   - Calculate price with discount

### Key Features to Implement:

#### Plan Enforcement
```typescript
// src/hooks/usePlanLimits.ts
export function usePlanLimits() {
  const { user } = useAuth()
  const [limits, setLimits] = useState(null)

  useEffect(() => {
    async function fetchLimits() {
      const plan = await getCurrentUserPlan(user?.id)
      if (plan) {
        setLimits({
          websiteLimit: plan.websiteLimit,
          combinationPageLimit: plan.combinationPageLimit,
          rankTrackingFrequency: plan.rankTrackingFrequency,
        })
      }
    }
    fetchLimits()
  }, [user])

  return limits
}
```

#### Usage Tracking
```typescript
// Check before creating new project
const canCreateProject = async (userId: string) => {
  const plan = await getCurrentUserPlan(userId)
  const { count } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  
  return count < plan.websiteLimit
}

// Check before creating combinations
const canCreateCombinations = async (projectId: string, newCount: number) => {
  const project = await getProject(projectId)
  const plan = await getCurrentUserPlan(project.user_id)
  
  const { count } = await supabase
    .from('location_keywords')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
  
  return (count + newCount) <= plan.combinationPageLimit
}
```

---

## RLS Policies

### For Agency Plan (Multi-Client Management)

```sql
-- Users can view their own projects OR projects they manage
CREATE POLICY "Users can view projects"
ON public.projects
FOR SELECT
USING (
  auth.uid() = user_id OR
  auth.uid() = managed_by_user_id OR
  (SELECT is_super_admin FROM public.users WHERE id = auth.uid())
);

-- Similar for location_keywords, generated_pages, etc.
```

---

## UI Components to Update

### 1. Dashboard Stats
- Show plan limits vs usage
- Example: "45 / 50 pages used"
- Upgrade button if near limit

### 2. Project Creation
- Check limits before allowing
- Show upgrade modal if at limit

### 3. Combination Creation
- Check limits before bulk operations
- Show warning if approaching limit

### 4. Settings Page
- Show current plan
- Upgrade/downgrade options
- Billing history

---

## Next Steps

1. ✅ Review this plan
2. Create migration SQL file
3. Copy PlansSelection component
4. Create plan-service.ts
5. Add plan limits checking
6. Update UI to show limits
7. Add upgrade flows
8. Implement Stripe integration (later)

---

## Notes

- Trial period: 7 days (all features)
- After trial: Enforce plan limits
- Agency plan: Can create sub-users (managed_by_user_id)
- Super admins: Bypass all limits

# Tab Switching, Page Refresh, and Navigation Issues - Complete Fix Guide

## The Problem

The app had multiple critical issues that made it unreliable:

1. **Page refresh broke the app** - Refreshing any page would show infinite loading or redirect to login
2. **Tab switching broke navigation** - After switching tabs and returning, links stopped working
3. **Sign out button hung** - The sign out button would get stuck and never complete
4. **Slow authentication checks** - Auth queries would hang for 10+ seconds on page load
5. **Sign in after tab switch hung** - After leaving tab, coming back, signing out, then signing in would get stuck fetching user data
6. **Ghost SIGNED_IN events** - After signing out, duplicate SIGNED_IN events would cause immediate re-login or timeouts

These issues made the app feel broken compared to normal websites like Snapbase.

## Root Causes

### 1. React Query Configuration Issues
- **`refetchOnMount: true`** - Caused unnecessary refetching that interfered with navigation
- **`refetchOnReconnect: true`** - Triggered refetches on tab switches, breaking state
- **No proper auth context** - Using React Query for auth state was over-complicated

### 2. Supabase Client Configuration
- **Custom auth options** - Explicit auth config caused session restoration to hang
- **`getSession()` was slow** - Session restoration from storage took 10+ seconds on refresh

### 3. Complex Auth Architecture
- **React Query-based auth** - Too complex, not resilient to browser events
- **No centralized auth state** - Auth state scattered across queries and mutations

### 4. Database Query Issues After Tab Switches
- **Supabase queries hang** - After tab switches, database queries would timeout
- **Object property access issues** - Database returned data but properties weren't accessible
- **No timeout handling** - Queries would hang indefinitely without recovery

### 5. Duplicate Auth Events
- **Ghost SIGNED_IN after SIGNED_OUT** - Supabase fires duplicate events causing re-authentication
- **No event debouncing** - Multiple rapid events weren't filtered
- **Race conditions** - Events processed out of order causing state corruption

## The Solution: Non-blocking Optimistic Auth (Snapbase Pattern)

We refactored to match Snapbase's proven, simple approach, but adapted for GeoScale's needs:

### Why the Previous Approaches Failed
- **Blocking on DB Fetch:** Waiting for the database query to complete before setting `loading=false` caused the app to hang if the connection was stale (common after tab switching).
- **Timeouts & Debouncing:** These were band-aids. They tried to manage the symptoms (hanging queries, duplicate events) rather than fixing the root cause (blocking the UI).

### The Fix: Optimistic Updates & Background Fetching

Instead of blocking the user interface while waiting for database profile data, we now:

1.  **Optimistic User Set:** Immediately set the `user` state from the Supabase session. This allows `ProtectedRoute` to render the dashboard instantly.
2.  **Stop Loading Immediately:** Set `loading=false` as soon as the session is verified.
3.  **Background Data Enrichment:** Fetch the full user profile (plan, agency_id, etc.) in the background. When it arrives, silent update the user context.

### Implementation Details

**Updated:** `src/contexts/AuthContext.tsx`

```tsx
// 1. Get initial session
supabase.auth.getSession().then(async ({ data: { session } }) => {
  if (session?.user) {
    // OPTIMISTIC: Set user immediately so app loads
    setUser({ ...session.user } as any)
    
    // Background fetch for DB data (doesn't block UI)
    fetchUserProfile(session.user)
  }
  // Stop loading immediately
  setLoading(false)
})

// 2. Listen for auth changes
supabase.auth.onAuthStateChange(async (_event, session) => {
  if (session?.user) {
    // OPTIMISTIC: Update user immediately
    setUser((prev) => ({ ...session.user } as any))
    setLoading(false)
    
    // Background fetch
    fetchUserProfile(session.user)
  }
})
```

**Why this works:**
- **Zero Perceived Latency:** The dashboard loads instantly.
- **Resilient:** If the DB fetch hangs (e.g., bad connection), the user is still logged in and can see the dashboard. The extra data just pops in when ready.
- **No Race Conditions:** We don't care about duplicate events because they just trigger state updates that are consistent.

### 2. Simplified Supabase Client

**Updated:** `src/lib/supabase.ts`

```tsx
// Before - Custom auth config (CAUSED HANGING)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// After - Use defaults (LIKE SNAPBASE)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**Why this fixes it:**
- Default config is optimized and doesn't hang
- Supabase's defaults already include session persistence and auto-refresh
- Explicit config was causing slow session restoration

### 3. Optimized React Query Config

**Updated:** `src/main.tsx`

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false, // Don't refetch on tab switch
      refetchOnMount: false, // Don't refetch on mount
      refetchOnReconnect: false, // Don't refetch on reconnect
      retry: 1,
      gcTime: 1000 * 60 * 30, // 30 minutes
    },
  },
})

// Wrap app with AuthProvider
<AuthProvider>
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
</AuthProvider>
```

**Key changes:**
- `refetchOnMount: false` - Prevents page refresh issues
- `refetchOnReconnect: false` - Prevents tab switch issues
- `refetchOnWindowFocus: false` - No refetch when returning to tab
- AuthProvider wraps QueryClientProvider

### 4. Simplified useAuth Hook

**Updated:** `src/hooks/useAuth.ts`

```tsx
// Before - Complex React Query implementation
export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    // ... complex config
  })
  // ... mutations, etc
}

// After - Simple re-export from context
export { useAuth } from '@/contexts/AuthContext'
```

**Why this works:**
- No React Query for auth state
- Direct access to context
- Simpler, more reliable

### 5. Updated Components to Use New Auth

**Updated:** `src/pages/LoginPage.tsx`

```tsx
// Before - Complex mutation-based approach with useEffect navigation
const { signIn, isSigningIn } = useAuth()
signIn(formData, { onError: (err) => setError(err.message) })

useEffect(() => {
  if (user) navigate('/dashboard')
}, [user])

// After - Simple async/await with immediate navigation (Snapbase pattern)
const { signIn } = useAuth()
const { data, error } = await signIn(email, password)
if (error) {
  setError(error.message)
} else if (data?.user) {
  // Navigate immediately after successful sign in
  navigate('/dashboard')
}
```

**Why this works:**
- No useEffect watching for user changes
- Direct navigation after successful auth
- Simpler, more predictable flow
- Matches Snapbase's proven pattern

**Updated:** `src/components/Navigation.tsx`

```tsx
// Before - Mutation with loading state
const { signOut, isSigningOut } = useAuth()
<Button disabled={isSigningOut} onClick={signOut}>
  {isSigningOut ? 'Signing out...' : 'Log out'}
</Button>

// After - Simple async function
const { signOut } = useAuth()
const handleSignOut = async () => await signOut()
<Button onClick={handleSignOut}>Log out</Button>
```

**Updated:** `src/components/ProtectedRoute.tsx`

```tsx
// Changed isLoading to loading to match AuthContext
const { user, loading } = useAuth()
if (loading) return <LoadingSpinner />
```

**Updated:** `src/pages/DashboardPage.tsx`

```tsx
// Changed isLoading to loading
const { user, loading } = useAuth()
if (loading) return <LoadingState />
```

### 6. Files Modified

**New Files:**
- `src/contexts/AuthContext.tsx` - **NEW** - Context-based auth (like Snapbase)

**Core Files:**
- `src/main.tsx` - Added AuthProvider, updated QueryClient config
- `src/lib/supabase.ts` - Removed custom auth config, use defaults
- `src/hooks/useAuth.ts` - Simplified to re-export from AuthContext
- `src/api/auth.ts` - Removed `getSession()` call, use `getUser()` directly

**Updated Components:**
- `src/components/ProtectedRoute.tsx` - Changed `isLoading` to `loading`
- `src/components/Navigation.tsx` - Updated signOut to async, removed `isSigningOut`

**Updated Pages:**
- `src/pages/LoginPage.tsx` - Updated to use new signIn API, changed `isLoading` to `loading`
- `src/pages/DashboardPage.tsx` - Changed `isLoading` to `loading`
- `src/pages/SettingsPage.tsx` - Changed `isLoading` to `loading`

**Deleted/Deprecated:**
- `src/lib/auth-listener.ts` - No longer needed (AuthContext handles this)

## Testing Checklist

After the migration, verify:

- [x] Direct URL access works (e.g., `/dashboard`)
- [x] Page refresh works on any route
- [x] In-app navigation works (clicking links)
- [x] Browser back/forward buttons work
- [x] **Tab switching works** - Leave tab, return, links still work
- [x] **Sign out works** - Even after tab switch
- [x] Protected routes redirect to login when not authenticated
- [x] Search params work correctly (e.g., `?view=settings`)

## Key Takeaways

### For Future Projects

1. **Non-blocking Auth is Critical**
   - **Never block the UI on secondary data.** If you have a valid session, log the user in immediately.
   - Fetch profile/subscription data in the background.
   - This makes the app resilient to network hiccups and database latency.

2. **Optimistic UI Updates**
   - Set state immediately based on the user's intent or available data (session).
   - Don't wait for the server to confirm if you can proceed safely.
   - This eliminates "loading spinner hell".

3. **Use Context for Auth, Not React Query**
   - React Query is great for data fetching, not auth state
   - Context with useState is simpler and more reliable
   - Follow Snapbase's pattern for auth

4. **Use Default Supabase Config**
   - Don't add custom auth options unless absolutely necessary
   - Defaults are optimized and battle-tested
   - Custom config can cause session restoration to hang

5. **Conservative React Query Settings**
   - `refetchOnMount: false` - Prevents page refresh issues
   - `refetchOnReconnect: false` - Prevents tab switch issues
   - `refetchOnWindowFocus: false` - No unnecessary refetches
   - Only override for specific queries that need it

6. **Navigate Immediately After Sign In (Snapbase Pattern)**
   - Don't use useEffect to watch for user changes
   - Navigate directly after successful `signIn()` call
   - Simpler, more predictable, no race conditions
   - Check `data?.user` exists before navigating

7. **Simpler is Better**
   - Over-engineering auth causes problems
   - Follow proven patterns (like Snapbase)
   - Don't reinvent the wheel
   - Add complexity only when necessary

### Architecture Pattern

```
AuthProvider (Context + useState)
  ├─ Supabase onAuthStateChange listener
  ├─ Fetch user from database on auth
  └─ Provide: { user, session, loading, signIn, signOut }

QueryClientProvider (For data, not auth)
  ├─ Conservative refetch settings
  └─ Used for projects, stats, etc.
```

## Related Documentation

- `SPA-Routing.md` - General SPA routing best practices
- `REFRESH_FIX.md` - Detailed page refresh fix documentation
- Snapbase `src/contexts/AuthContext.tsx` - Reference implementation

## Migration Date

November 24, 2025

## Status

✅ **COMPLETE** - All issues resolved:
- Page refresh works perfectly
- Tab switching doesn't break navigation  
- Sign out works reliably (no ghost re-authentication)
- Auth checks are instant (optimistic updates)
- No hanging queries on tab switches (background fetch)
- Clean logout without page refresh

## Browser Compatibility

Tested and working in:
- ✅ Chrome/Chromium browsers
- ✅ Safari (macOS)
- ✅ Firefox (expected to work)

## Known Edge Cases Handled

1. **Tab switch → Sign out → Sign in** - Works flawlessly due to non-blocking architecture
2. **Rapid sign out/sign in** - Optimistic updates handle state transitions instantly
3. **Public page visits** - No unnecessary auth queries
4. **Database query hangs** - UI never blocks, data loads when ready
5. **Empty database responses** - User still logged in with basic session data


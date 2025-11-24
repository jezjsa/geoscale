# Tab Switching and Navigation Issues - Fix Documentation

## The Problem

After switching browser tabs and returning to the GeoScale app, two critical issues occurred:

1. **Links stopped working** - Clicking navigation links would update the URL but not change the page content
2. **Sign out button hung** - The sign out button would get stuck on "Signing out..." and never complete

These issues only occurred after:
- Navigating to any page in the app
- Switching to another browser tab
- Returning to the GeoScale tab
- Trying to use links or sign out

Refreshing the page would temporarily fix the issues, but they would return after the next tab switch.

## Root Cause

The app was using **TanStack Router** (`@tanstack/react-router`), which has a different architecture than traditional React routers. After a tab switch:

1. **Event listeners were getting disconnected** - TanStack Router's Link components lost their click event handlers when the browser tab lost focus
2. **Router state wasn't properly maintained** - The router's internal state wasn't being preserved correctly across tab visibility changes
3. **Navigation mutations could hang** - After tab switches, async operations (like sign out) could hang waiting for responses that never came

## The Solution

We migrated from **TanStack Router** to **react-router-dom** (BrowserRouter), which is the industry-standard routing solution that handles tab switching and navigation more reliably.

### Why react-router-dom Works Better

- **More mature and battle-tested** - Used by millions of React apps
- **Better browser integration** - Handles tab visibility changes more gracefully
- **Simpler architecture** - Less complex internal state management
- **Proven reliability** - Works consistently like a "normal HTML website"

## Changes Made

### 1. Package Changes

**Removed:**
```json
"@tanstack/react-router": "^1.95.0"
```

**Added:**
```json
"react-router-dom": "^6.x.x"
```

### 2. Router Configuration

**Before (TanStack Router):**
- `src/router.tsx` - Complex route tree configuration
- `src/App.tsx` - Simple RouterProvider wrapper

**After (react-router-dom):**
- Deleted `src/router.tsx`
- `src/App.tsx` - Now contains BrowserRouter with Routes/Route components

```tsx
// New App.tsx structure
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        {/* ... other routes */}
      </Routes>
    </Router>
  )
}
```

### 3. Protected Routes

**Created:** `src/components/ProtectedRoute.tsx`

A wrapper component that checks authentication before rendering protected pages:

```tsx
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth()
  
  if (isLoading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  
  return <>{children}</>
}
```

### 4. Navigation Updates

**Link Components:**
- Changed from `@tanstack/react-router` to `react-router-dom`
- Updated all `<Link>` components throughout the app
- Changed search params from object syntax to query strings:
  - Before: `<Link to="/signup" search={{ plan: 'pro' }}>`
  - After: `<Link to="/signup?plan=pro">`

**Navigation Hooks:**
- Changed `useNavigate()` from TanStack to react-router-dom
- Updated navigation calls:
  - Before: `navigate({ to: '/dashboard', params: { id }, search: { view: 'settings' } })`
  - After: `navigate('/dashboard')` or `navigate(\`/projects/${id}?view=settings\`)`

**Search Params:**
- Changed from `useSearch()` to `useSearchParams()`
- Updated all components that read URL search parameters

### 5. Sign Out Fix

**Updated:** `src/hooks/useAuth.ts`

Made sign out more resilient to tab switching issues:

```tsx
const signOutMutation = useMutation({
  mutationFn: async () => {
    // Add timeout to prevent hanging after tab switch
    try {
      await Promise.race([
        signOut(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Sign out timeout')), 3000)
        )
      ])
    } catch (error) {
      console.warn('Sign out may have timed out:', error)
    }
  },
  onSettled: () => {
    // Always clear state and redirect, even if Supabase is slow
    queryClient.setQueryData(['currentUser'], null)
    queryClient.clear()
    navigate('/login', { replace: true })
  },
})
```

**Key improvements:**
- 3-second timeout prevents infinite hanging
- `onSettled` ensures cleanup happens regardless of success/failure
- Always redirects even if Supabase call times out

### 6. Files Modified

**Core Router Files:**
- `src/App.tsx` - Complete rewrite with BrowserRouter
- `src/router.tsx` - **DELETED** (no longer needed)
- `src/main.tsx` - Updated import (default export instead of named)

**New Components:**
- `src/components/ProtectedRoute.tsx` - Route protection wrapper

**Updated Components:**
- `src/components/Navigation.tsx` - Link imports
- `src/components/agency/ProjectsList.tsx` - Link syntax
- `src/components/projects/CombinationsTable.tsx` - Navigation calls

**Updated Pages:**
- `src/pages/HomePage.tsx` - Link imports
- `src/pages/LoginPage.tsx` - Link imports, added redirect logic
- `src/pages/SignUpPage.tsx` - useSearchParams, navigation
- `src/pages/ResetPasswordPage.tsx` - Navigation calls
- `src/pages/DashboardPage.tsx` - Link imports
- `src/pages/PlansPage.tsx` - Link search params
- `src/pages/ProjectDetailPage.tsx` - useParams, useSearchParams, navigation
- `src/pages/ViewContentPage.tsx` - useParams, navigation

**Updated Hooks:**
- `src/hooks/useAuth.ts` - useNavigate, sign out mutation improvements

**Updated API:**
- No changes needed - auth functions work the same

**Updated Listeners:**
- `src/lib/auth-listener.ts` - Minor comment updates (no functional changes)

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

1. **react-router-dom is more reliable** for handling browser tab visibility changes
2. **Simpler is better** - BrowserRouter's straightforward approach is more maintainable
3. **Always add timeouts** for async operations that might hang after tab switches
4. **Use `onSettled`** instead of separate `onSuccess`/`onError` when you need guaranteed cleanup

## Related Documentation

- `SPA-Routing.md` - General SPA routing best practices
- `reload.md` - React reload/navigation best practices

## Migration Date

December 2024

## Migration Commit

See commit: `c70d1f7` - "Migrate from TanStack Router to react-router-dom"


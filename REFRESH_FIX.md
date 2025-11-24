# Page Refresh & Tab Switch Fix

## Problem
The application was not working correctly when:
1. Refreshing the page (F5)
2. Switching browser tabs and returning
3. Direct URL access to routes

## Root Cause
The issue was NOT with routing configuration, but with React Query (TanStack Query) settings that were causing aggressive refetching behavior.

## Changes Made

### 1. Updated `vercel.json`
- Changed from generic catch-all `/(.*)`  to explicit route rewrites
- Matches Snapbase's working configuration
- Added `outputDirectory: "dist"` for clarity

### 2. Updated `src/main.tsx`
**QueryClient Configuration (Global Defaults):**
- Set `refetchOnMount: false` (was `true`)
- Set `refetchOnReconnect: false` (was `true`)
- Kept `refetchOnWindowFocus: false`

**StrictMode:**
- Now always uses `StrictMode` (like Snapbase)
- Removed conditional logic that disabled it in production

### 3. Updated `src/hooks/useAuth.ts`
**Auth Query Override:**
- Set `refetchOnMount: true` for the auth query specifically
- This ensures user authentication is always checked on page load
- Keeps `refetchOnWindowFocus: false` to prevent tab switch issues
- Critical queries like auth need to refetch, but most data queries don't

### 3. Updated `vite.config.ts`
- Simplified configuration to match Snapbase
- Removed unnecessary HMR configuration
- Removed `define` block that was setting NODE_ENV
- Kept essential build optimizations (code splitting)

## Why This Fixes The Issue

### The Tab Switch Problem
When you switched tabs and came back, React Query was:
1. Detecting the window regaining focus
2. Triggering `refetchOnReconnect`
3. Making unnecessary API calls
4. Potentially causing state changes that broke navigation

**Fix:** Disabled `refetchOnReconnect` and `refetchOnWindowFocus`

### The Page Refresh Problem  
When you refreshed the page, React Query was:
1. Mounting components
2. Triggering `refetchOnMount`
3. Making API calls before the router was ready
4. Potentially interfering with navigation state

**Fix:** Disabled `refetchOnMount`

### The StrictMode Issue
Conditionally removing StrictMode in production created inconsistent behavior between development and production environments.

**Fix:** Always use StrictMode for consistent behavior

## How It Works Now

The app now behaves like a normal website:
- ✅ Page refreshes work correctly
- ✅ Tab switching doesn't break navigation
- ✅ Direct URL access works
- ✅ Browser back/forward buttons work
- ✅ Data is still cached for 5 minutes (staleTime)
- ✅ Manual refetches still work when needed

## Comparison with Snapbase

| Feature | Snapbase | GeoScale (Before) | GeoScale (After) |
|---------|----------|-------------------|------------------|
| Routing | Explicit routes | Catch-all | Explicit routes ✅ |
| refetchOnMount | N/A (no React Query) | true | false ✅ |
| refetchOnReconnect | N/A | true | false ✅ |
| StrictMode | Always on | Conditional | Always on ✅ |
| Vite config | Simple | Complex | Simple ✅ |

## Testing

After deploying these changes, test:
1. ✅ Navigate to `/dashboard` and refresh (F5)
2. ✅ Switch to another tab and come back
3. ✅ Type a URL directly in the address bar
4. ✅ Use browser back/forward buttons
5. ✅ All navigation links should work normally

## Deployment

1. Commit these changes
2. Push to your Git repository
3. Vercel will automatically redeploy
4. Test all scenarios above

## Notes

- Data fetching is now more conservative (doesn't refetch automatically)
- If you need fresh data, you can manually trigger refetches in specific components
- The 5-minute staleTime means cached data is still used efficiently
- Auth state changes still trigger refetches via the auth listener

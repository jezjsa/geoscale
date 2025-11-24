import { createRouter, createRootRoute, createRoute, Outlet, redirect } from '@tanstack/react-router'
import { HomePage } from './pages/HomePage'
import { PlansPage } from './pages/PlansPage'
import { SignUpPage } from './pages/SignUpPage'
import { LoginPage } from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { DashboardPage } from './pages/DashboardPage'
import { SettingsPage } from './pages/SettingsPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { ViewContentPage } from './pages/ViewContentPage'
import { TestDataForSEOPage } from './pages/TestDataForSEO'
import { getCurrentUser } from './api/auth'

// Root route with layout
const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

// Index route (home page)
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

// Plans route
const plansRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/plans',
  component: PlansPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      plan: (search.plan as string) || undefined,
    }
  },
})

// Signup route
const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  component: SignUpPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      plan: (search.plan as string) || undefined,
    }
  },
})

// Login route
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (user) {
      throw redirect({ to: '/dashboard' })
    }
  },
})

// Reset password route
const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  component: ResetPasswordPage,
})

// Dashboard route (protected)
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage,
  beforeLoad: async () => {
    try {
      const user = await getCurrentUser()
      if (!user) {
        throw redirect({ to: '/login' })
      }
    } catch (error) {
      // If getCurrentUser fails, redirect to login
      console.error('Error in dashboard beforeLoad:', error)
      throw redirect({ to: '/login' })
    }
  },
})

// Settings route (protected, all users can access)
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
  beforeLoad: async () => {
    try {
      const user = await getCurrentUser()
      if (!user) {
        throw redirect({ to: '/login' })
      }
    } catch (error) {
      // If getCurrentUser fails, redirect to login
      console.error('Error in settings beforeLoad:', error)
      throw redirect({ to: '/login' })
    }
  },
})

// Project detail route (protected)
const projectDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId',
  component: ProjectDetailPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      view: (search.view as 'combinations' | 'testimonials' | 'settings') || 'combinations',
    }
  },
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (!user) {
      throw redirect({ to: '/login' })
    }
  },
})

// View content route (protected)
const viewContentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId/content/$locationKeywordId',
  component: ViewContentPage,
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (!user) {
      throw redirect({ to: '/login' })
    }
  },
})

// Test DataForSEO route (protected)
const testDataForSEORoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/test-dataforseo',
  component: TestDataForSEOPage,
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (!user) {
      throw redirect({ to: '/login' })
    }
  },
})

// Route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  plansRoute,
  signupRoute,
  loginRoute,
  resetPasswordRoute,
  dashboardRoute,
  settingsRoute,
  projectDetailRoute,
  viewContentRoute,
  testDataForSEORoute,
])

// Create router with proper configuration
export const router = createRouter({ 
  routeTree,
  // Ensure router stays active and handles navigation properly
  defaultPreload: 'intent',
  defaultPreloadDelay: 0,
  // Ensure router history is properly maintained
  history: typeof window !== 'undefined' ? window.history : undefined,
  // Add error handling for navigation
  defaultErrorComponent: ({ error }) => {
    console.error('Router error:', error)
    // If navigation fails, try to reload the page
    if (error?.message?.includes('redirect')) {
      return null // Let redirects work
    }
    // For other errors, show a simple error message
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Navigation Error</h1>
          <p className="text-muted-foreground mb-4">Please refresh the page</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded"
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  },
})

// Register router types
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

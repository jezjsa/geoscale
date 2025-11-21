import { createRouter, createRootRoute, createRoute, Outlet, redirect } from '@tanstack/react-router'
import { HomePage } from './pages/HomePage'
import { PlansPage } from './pages/PlansPage'
import { SignUpPage } from './pages/SignUpPage'
import { LoginPage } from './pages/LoginPage'
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

// Dashboard route (protected)
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage,
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (!user) {
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
    const user = await getCurrentUser()
    if (!user) {
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
  dashboardRoute,
  settingsRoute,
  projectDetailRoute,
  viewContentRoute,
  testDataForSEORoute,
])

// Create router
export const router = createRouter({ routeTree })

// Register router types
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

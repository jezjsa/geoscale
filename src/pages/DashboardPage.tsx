import { useAuth } from '@/hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Navigation } from '@/components/Navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getCompanySettings } from '@/api/company-settings'
import { getDashboardStats } from '@/api/projects'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

export function DashboardPage() {
  const { user, isLoading } = useAuth()

  const { data: companySettings } = useQuery({
    queryKey: ['companySettings', user?.id],
    queryFn: () => user ? getCompanySettings(user.id) : null,
    enabled: !!user && user.plan === 'individual',
  })

  const { data: stats } = useQuery({
    queryKey: ['dashboardStats', user?.id],
    queryFn: () => user ? getDashboardStats(user.id) : null,
    enabled: !!user,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">Loading your dashboard...</p>
            <div className="animate-pulse">Please wait</div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    )
  }

  const isIndividual = user.plan === 'individual'
  const hasCompanySettings = companySettings && 
    companySettings.business_name && 
    companySettings.phone_number && 
    companySettings.contact_url

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user.name || 'User'}!
          </p>
        </div>

        {/* Setup prompt for Individual users */}
        {isIndividual && !hasCompanySettings && (
          <Card className="mb-6 border-orange-200 bg-orange-50">
            <CardHeader>
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <CardTitle className="text-orange-900">Complete Your Setup</CardTitle>
                  <CardDescription className="text-orange-700">
                    Add your company information and testimonials to start generating landing pages
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild className="bg-gray-200 hover:bg-gray-300 text-gray-900">
                <Link to="/settings">Go to Settings</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {isIndividual && hasCompanySettings && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardHeader>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <CardTitle className="text-green-900">Setup Complete</CardTitle>
                  <CardDescription className="text-green-700">
                    Your company information is configured. You can start creating projects!
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Link to="/settings">
            <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Projects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.projects_count || 0}</div>
                {stats?.projects_count === 0 && (
                  <p className="text-xs text-muted-foreground">No projects yet</p>
                )}
              </CardContent>
            </Card>
          </Link>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Locations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.locations_count || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Keywords</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.keywords_count || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pages Generated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pages_generated_count || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <div className="grid gap-4 md:grid-cols-2">
          {isIndividual && (
            <Card>
              <CardHeader>
                <CardTitle>Company Settings</CardTitle>
                <CardDescription>Manage your business information and testimonials</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/settings">Manage Settings</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
              <CardDescription>Create and manage your WordPress projects</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="bg-white text-black hover:bg-gray-100">
                <Link to="/settings">Manage Projects</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}


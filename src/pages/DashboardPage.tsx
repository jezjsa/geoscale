import { useAuth } from '@/hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Navigation } from '@/components/Navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getCompanySettings } from '@/api/company-settings'
import { getDashboardStats } from '@/api/projects'
import { AlertCircle, CheckCircle2, Download } from 'lucide-react'
import { PlanUsageCardCompact } from '@/components/PlanUsageCardCompact'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { getCurrentUserPlan } from '@/lib/plan-service'

export function DashboardPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [userProject, setUserProject] = useState<any>(null)
  
  console.log('[DashboardPage] Render:', { user, loading })

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

  // Get user's actual plan from plan_id
  const { data: userPlan } = useQuery({
    queryKey: ['userPlan', user?.id],
    queryFn: () => getCurrentUserPlan(user?.id),
    enabled: !!user?.id,
  })

  // Fetch user's project for individual users
  useEffect(() => {
    async function fetchUserProject() {
      if (user?.id && user.plan !== 'agency') {
        const { data } = await supabase
          .from('projects')
          .select('id, project_name')
          .eq('user_id', user.id)
          .maybeSingle()
        
        if (data) {
          setUserProject(data)
        }
      }
    }
    fetchUserProject()
  }, [user])

  const handleManageProjects = () => {
    // If individual user with a project, go directly to their project
    if (user?.plan !== 'agency' && userProject) {
      navigate(`/projects/${userProject.id}`)
    } else {
      // Agency users go to settings to manage multiple projects
      navigate('/settings')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-16">
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
      <div className="min-h-screen bg-background pt-16">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    )
  }

  const isIndividual = user.plan === 'individual'
  // Single project plans have websiteLimit of 1 (Starter, Pro)
  const isSingleProjectPlan = userPlan?.websiteLimit === 1
  const hasCompanySettings = companySettings && 
    companySettings.business_name && 
    companySettings.phone_number && 
    companySettings.contact_url

  return (
    <div className="min-h-screen bg-background pt-16">
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
                    Add your company information to start creating projects
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

        {isIndividual && hasCompanySettings && !isSingleProjectPlan && (
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
                <CardTitle className="text-sm font-medium">{isSingleProjectPlan ? 'Project' : 'Projects'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.projects_count || 0}</div>
                {stats?.projects_count === 0 && (
                  <p className="text-xs text-muted-foreground">{isSingleProjectPlan ? 'No project yet' : 'No projects yet'}</p>
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
          <Card>
            <CardHeader>
              <CardTitle>{isSingleProjectPlan ? 'Project' : 'Projects'}</CardTitle>
              <CardDescription>{isSingleProjectPlan ? 'Create and manage your WordPress project' : 'Create and manage your WordPress projects'}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline"
                onClick={handleManageProjects}
                className="bg-btn-secondary-bg hover:bg-btn-secondary-hover text-black border-gray-300 dark:bg-[#3a3a3a] dark:text-white dark:border-[#3a3a3a] dark:hover:bg-[#4a4a4a] dark:hover:text-white"
              >
                {isSingleProjectPlan ? 'Manage Project' : 'Manage Projects'}
              </Button>
            </CardContent>
          </Card>
          <PlanUsageCardCompact />
        </div>

        {isIndividual && (
          <div className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Company Settings</CardTitle>
                <CardDescription>Manage your business information and testimonials</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link to="/settings">Manage Settings</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* WordPress Plugin Download */}
        <div className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>WordPress Plugin</CardTitle>
              <CardDescription>Download and install the GeoScale WordPress plugin to publish your content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Download the plugin, install it on your WordPress website, then go to your GeoScale project settings to generate an API key. Paste the API key into the WordPress plugin settings screen and save.
              </p>
              <Button asChild className="bg-gray-200 hover:bg-gray-300 text-gray-900">
                <a href="/geoscale-plugin.zip" download="geoscale-plugin.zip">
                  <Download className="mr-2 h-4 w-4" />
                  Download Plugin
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}


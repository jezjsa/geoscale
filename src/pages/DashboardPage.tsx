import { useAuth } from '@/hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Navigation } from '@/components/Navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getCompanySettings } from '@/api/company-settings'
import { getDashboardStats } from '@/api/projects'
import { AlertCircle, CheckCircle2, Download, MessageSquareQuote, HelpCircle, Lightbulb } from 'lucide-react'
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

  // Fetch user's project for individual users with testimonial and FAQ counts
  useEffect(() => {
    async function fetchUserProject() {
      if (user?.id && user.plan !== 'agency') {
        const { data: project } = await supabase
          .from('projects')
          .select('id, project_name, contact_name, contact_email, phone_number, contact_url, service_description, wp_url, blog_url, wp_api_key, wp_page_template')
          .eq('user_id', user.id)
          .maybeSingle()
        
        if (project) {
          // Get testimonial count
          const { count: testimonialCount } = await supabase
            .from('project_testimonials')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', project.id)
          
          // Get FAQ count (sum across all services)
          const { data: services } = await supabase
            .from('project_services')
            .select('id')
            .eq('project_id', project.id)
          
          let faqCount = 0
          if (services && services.length > 0) {
            const { count } = await supabase
              .from('service_faqs')
              .select('*', { count: 'exact', head: true })
              .in('service_id', services.map(s => s.id))
            faqCount = count || 0
          }
          
          setUserProject({
            ...project,
            testimonial_count: testimonialCount || 0,
            faq_count: faqCount
          })
        }
      }
    }
    fetchUserProject()
  }, [user])

  // Check if project has all required settings filled in
  const isProjectSetupComplete = userProject && 
    userProject.contact_name && 
    userProject.phone_number && 
    userProject.contact_url && 
    userProject.wp_url && 
    userProject.wp_api_key

  const handleManageProjects = () => {
    // If individual user with a project that's fully set up, go to combinations
    if (user?.plan !== 'agency' && userProject) {
      if (isProjectSetupComplete) {
        navigate(`/projects/${userProject.id}`)
      } else {
        navigate(`/projects/${userProject.id}?view=settings`)
      }
    } else {
      // Agency users go to settings to manage multiple projects
      // Single-project users without a project go to settings to create one
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
              <CardDescription>{isSingleProjectPlan 
                ? (userProject ? 'Manage your WordPress project' : 'Set up your WordPress project') 
                : 'Create and manage your WordPress projects'}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline"
                onClick={handleManageProjects}
                className="bg-btn-secondary-bg hover:bg-btn-secondary-hover text-black border-0 dark:bg-[#3a3a3a] dark:text-white dark:border dark:border-[#3a3a3a] dark:hover:bg-[#4a4a4a] dark:hover:text-white"
              >
                {isSingleProjectPlan 
                  ? (userProject ? 'Manage Project' : 'Create Project') 
                  : 'Manage Projects'}
              </Button>
            </CardContent>
          </Card>
          <PlanUsageCardCompact />
        </div>

        {/* Next Steps card for single-project users with a project */}
        {isSingleProjectPlan && userProject && isProjectSetupComplete && (
          <Card className="mt-4 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
            <CardHeader>
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <CardTitle className="text-blue-900 dark:text-blue-100">Improve Your Content</CardTitle>
                  <CardDescription className="text-blue-700 dark:text-blue-300">
                    Add testimonials and FAQs to make your generated pages more engaging and trustworthy
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/50 dark:bg-gray-800/50">
                  <MessageSquareQuote className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Customer Testimonials</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      {userProject.testimonial_count > 0 
                        ? `${userProject.testimonial_count} testimonial${userProject.testimonial_count !== 1 ? 's' : ''} added`
                        : 'No testimonials yet'}
                    </p>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => navigate(`/projects/${userProject.id}?view=testimonials`)}
                      className="text-xs"
                    >
                      {userProject.testimonial_count > 0 ? 'Manage Testimonials' : 'Add Testimonials'}
                    </Button>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/50 dark:bg-gray-800/50">
                  <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Service FAQs</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      {userProject.faq_count > 0 
                        ? `${userProject.faq_count} FAQ${userProject.faq_count !== 1 ? 's' : ''} added`
                        : 'No FAQs yet'}
                    </p>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => navigate(`/projects/${userProject.id}?view=faqs`)}
                      className="text-xs"
                    >
                      {userProject.faq_count > 0 ? 'Manage FAQs' : 'Add FAQs'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Company Settings & WordPress Plugin - side by side */}
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          {/* Hide Company Settings for single-project plans - they access it via Project Settings */}
          {isIndividual && !isSingleProjectPlan && (
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
          )}

          {/* WordPress Plugin Download */}
          <Card>
            <CardHeader>
              <CardTitle>WordPress Plugin</CardTitle>
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


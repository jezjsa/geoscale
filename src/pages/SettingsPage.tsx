import { useAuth } from '@/hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { Navigation } from '@/components/Navigation'
import { CompanySettingsForm } from '@/components/settings/CompanySettingsForm'
import { TestimonialsManager } from '@/components/settings/TestimonialsManager'
import { CreateClientDialog } from '@/components/agency/CreateClientDialog'
import { ProjectsList } from '@/components/agency/ProjectsList'
import { getAgencyProjects } from '@/api/projects'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

function AgencyProjectsView({ userId }: { userId: string }) {
  const { data: projects, isLoading } = useQuery({
    queryKey: ['agencyProjects', userId],
    queryFn: () => getAgencyProjects(userId),
  })

  const hasProjects = !isLoading && projects && projects.length > 0

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Client Projects</h1>
          <p className="text-muted-foreground">
            Create and manage client projects as an Agency
          </p>
        </div>
        {hasProjects && (
          <CreateClientDialog userId={userId} />
        )}
      </div>

      {!hasProjects && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Project</CardTitle>
            <CardDescription>
              Add a new client project. You'll manage their WordPress site and generate location pages for them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateClientDialog userId={userId} />
          </CardContent>
        </Card>
      )}

      <ProjectsList userId={userId} />
    </>
  )
}

export function SettingsPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // Show different content based on plan
  const isIndividual = user.plan === 'individual'

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        {isIndividual ? (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Company Settings</h1>
              <p className="text-muted-foreground">
                Configure your business information and testimonials for AI content generation
              </p>
            </div>

            <Tabs defaultValue="company" className="space-y-6">
              <TabsList>
                <TabsTrigger value="company">Company Information</TabsTrigger>
                <TabsTrigger value="testimonials">Testimonials</TabsTrigger>
              </TabsList>

              <TabsContent value="company">
                <CompanySettingsForm userId={user.id} />
              </TabsContent>

              <TabsContent value="testimonials">
                <TestimonialsManager userId={user.id} />
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <AgencyProjectsView userId={user.id} />
        )}
      </div>
    </div>
  )
}


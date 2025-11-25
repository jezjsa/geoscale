import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getCompanySettings, upsertCompanySettings } from '@/api/company-settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ArrowRight } from 'lucide-react'

interface CompanySettingsFormProps {
  userId: string
}

export function CompanySettingsForm({ userId }: CompanySettingsFormProps) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    business_name: '',
    phone_number: '',
    contact_url: '',
    service_description: '',
  })
  const [userProject, setUserProject] = useState<any>(null)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['companySettings', userId],
    queryFn: () => getCompanySettings(userId),
  })

  // Check if user has a project
  useEffect(() => {
    async function checkProject() {
      const { data } = await supabase
        .from('projects')
        .select('id, project_name')
        .eq('user_id', userId)
        .maybeSingle()
      
      if (data) {
        setUserProject(data)
      }
    }
    if (userId) {
      checkProject()
    }
  }, [userId])

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => upsertCompanySettings(userId, data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['companySettings', userId] })
      toast.success('Settings saved successfully!')
      
      // Auto-create project for individual users (starter/pro plans) if they don't have one
      // Agency users manage multiple projects, so we don't auto-create for them
      const isAgencyUser = user?.plan === 'agency'
      
      if (!isAgencyUser && !userProject) {
        try {
          const { data: newProject, error } = await supabase
            .from('projects')
            .insert({
              user_id: userId,
              project_name: formData.business_name || user?.name || 'My Project',
              wp_url: '', // Required field, will be filled in later
              wp_api_key: '', // Required field, will be filled in later
            })
            .select()
            .single()
          
          if (newProject && !error) {
            setUserProject(newProject)
            toast.success('Project created successfully!')
          } else if (error) {
            console.error('Error creating project:', error)
            toast.error('Failed to create project')
          }
        } catch (err) {
          console.error('Error creating project:', err)
          toast.error('Failed to create project')
        }
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save settings')
    },
  })

  useEffect(() => {
    if (settings) {
      setFormData({
        business_name: settings.business_name || '',
        phone_number: settings.phone_number || '',
        contact_url: settings.contact_url || '',
        service_description: settings.service_description || '',
      })
    } else if (user?.name && !settings) {
      // Pre-populate business name with user's name from signup for new users
      setFormData(prev => ({
        ...prev,
        business_name: user.name || '',
      }))
    }
  }, [settings, user])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(formData)
  }

  if (isLoading) {
    return <Card><CardContent className="py-8"><p className="text-muted-foreground">Loading...</p></CardContent></Card>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Information</CardTitle>
        <CardDescription>
          This information will be used in AI-generated landing pages
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="business_name" className="block mb-3">Business Name</Label>
            <Input
              id="business_name"
              value={formData.business_name}
              onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
              placeholder="Your Company Name"
            />
          </div>
          <div>
            <Label htmlFor="phone_number" className="block mb-3">Phone Number</Label>
            <Input
              id="phone_number"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              placeholder="+44 1234 567890"
            />
          </div>
          <div>
            <Label htmlFor="contact_url" className="block mb-3">Contact URL</Label>
            <Input
              id="contact_url"
              type="url"
              value={formData.contact_url}
              onChange={(e) => {
                let value = e.target.value;
                // Auto-add https:// if not present
                if (value && !value.startsWith('http://') && !value.startsWith('https://')) {
                  value = 'https://' + value;
                }
                setFormData({ ...formData, contact_url: value });
              }}
              placeholder="https://example.com/contact"
            />
          </div>
          <div>
            <Label htmlFor="service_description" className="block mb-3">Service Description</Label>
            <Textarea
              id="service_description"
              value={formData.service_description}
              onChange={(e) => setFormData({ ...formData, service_description: e.target.value })}
              placeholder="Describe your services..."
              rows={5}
            />
          </div>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button 
            type="submit" 
            className="bg-gray-200 hover:bg-gray-300 text-gray-900"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
          
          {userProject && (
            <Button 
              type="button"
              onClick={() => navigate(`/projects/${userProject.id}`)}
              className="bg-[#006239] hover:bg-[#005030] text-white"
            >
              Go to your Project
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  )
}


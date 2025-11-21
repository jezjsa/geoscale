import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCompanySettings, upsertCompanySettings } from '@/api/company-settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

interface CompanySettingsFormProps {
  userId: string
}

export function CompanySettingsForm({ userId }: CompanySettingsFormProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    business_name: '',
    phone_number: '',
    contact_url: '',
    service_description: '',
  })

  const { data: settings, isLoading } = useQuery({
    queryKey: ['companySettings', userId],
    queryFn: () => getCompanySettings(userId),
  })

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => upsertCompanySettings(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companySettings', userId] })
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
    }
  }, [settings])

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
              onChange={(e) => setFormData({ ...formData, contact_url: e.target.value })}
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
        <CardFooter>
          <Button 
            type="submit" 
            className="bg-gray-200 hover:bg-gray-300 text-gray-900"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}


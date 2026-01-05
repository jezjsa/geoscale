import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ArrowUp, Lightbulb, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  getAllFeatureRequests,
  createFeatureRequest,
  toggleVote,
  updateFeatureRequestStatus,
  deleteFeatureRequest,
} from '@/lib/feature-request-service'
import type { FeatureRequestWithUser, FeatureRequestStatus } from '@/types/database'
import { usePageMeta } from '@/hooks/usePageMeta'
import { Navigation } from '@/components/Navigation'

export function FeaturesPage() {
  usePageMeta({
    title: 'Feature Requests - GeoScale',
    description: 'Suggest and vote on new features for GeoScale'
  })

  const { user } = useAuth()
  const [features, setFeatures] = useState<FeatureRequestWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | FeatureRequestStatus>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newFeature, setNewFeature] = useState({ title: '', description: '' })
  const [submitting, setSubmitting] = useState(false)

  const loadFeatures = async () => {
    try {
      const data = await getAllFeatureRequests(user?.id)
      setFeatures(data)
    } catch (error) {
      console.error('Error loading features:', error)
      toast.error('Failed to load feature requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFeatures()
  }, [user?.id])

  const handleVote = async (featureId: string) => {
    if (!user?.id) return

    try {
      const voted = await toggleVote(user.id, featureId)
      setFeatures(prev =>
        prev.map(f =>
          f.id === featureId
            ? {
                ...f,
                vote_count: voted ? f.vote_count + 1 : f.vote_count - 1,
                has_voted: voted,
              }
            : f
        )
      )
    } catch (error) {
      console.error('Error toggling vote:', error)
      toast.error('Failed to update vote')
    }
  }

  const capitalizeFirstLetter = (text: string) => {
    if (!text) return text
    return text.charAt(0).toUpperCase() + text.slice(1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id || !newFeature.title.trim() || !newFeature.description.trim()) return

    setSubmitting(true)
    try {
      await createFeatureRequest(
        user.id,
        newFeature.title,
        newFeature.description,
        user.is_super_admin || false
      )
      toast.success('Feature request submitted!')
      setNewFeature({ title: '', description: '' })
      setIsDialogOpen(false)
      loadFeatures()
    } catch (error) {
      console.error('Error submitting feature:', error)
      toast.error('Failed to submit feature request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (featureId: string, status: FeatureRequestStatus) => {
    try {
      await updateFeatureRequestStatus(featureId, status)
      setFeatures(prev =>
        prev.map(f => (f.id === featureId ? { ...f, status } : f))
      )
      toast.success('Status updated')
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    }
  }

  const handleDelete = async (featureId: string) => {
    if (!confirm('Are you sure you want to delete this feature request?')) return

    try {
      await deleteFeatureRequest(featureId)
      setFeatures(prev => prev.filter(f => f.id !== featureId))
      toast.success('Feature request deleted')
    } catch (error) {
      console.error('Error deleting feature:', error)
      toast.error('Failed to delete feature request')
    }
  }

  const filteredFeatures = features.filter(f =>
    filter === 'all' ? true : f.status === filter
  )

  const getStatusBadge = (status: FeatureRequestStatus) => {
    const variants: Record<FeatureRequestStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      pending: { variant: 'outline', label: 'Pending' },
      in_progress: { variant: 'default', label: 'In Progress' },
      shipped: { variant: 'secondary', label: 'Shipped' },
      declined: { variant: 'destructive', label: 'Declined' },
    }
    const { variant, label } = variants[status]
    return <Badge variant={variant}>{label}</Badge>
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <>
      <Navigation />
      <div className="container mx-auto px-4 py-8 pt-24 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Feature Requests</h1>
          <p className="text-muted-foreground">
            Suggest new features and vote on what you'd like to see next
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Suggest Feature
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Suggest a New Feature</DialogTitle>
                <DialogDescription>
                  Share your idea for improving GeoScale
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Brief title for your feature"
                    value={newFeature.title}
                    onChange={e => {
                      const value = e.target.value
                      setNewFeature(prev => ({ ...prev, title: value ? capitalizeFirstLetter(value) : value }))
                    }}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the feature and why it would be useful"
                    value={newFeature.description}
                    onChange={e => {
                      const value = e.target.value
                      setNewFeature(prev => ({ ...prev, description: value ? capitalizeFirstLetter(value) : value }))
                    }}
                    rows={5}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Features</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {filteredFeatures.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No feature requests yet. Be the first to suggest one!</p>
            </CardContent>
          </Card>
        ) : (
          filteredFeatures.map(feature => (
            <Card key={feature.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                      {feature.is_admin_request && (
                        <Badge variant="secondary">Admin</Badge>
                      )}
                    </div>
                    <CardDescription>
                      Suggested by {feature.user.name || 'Anonymous'} •{' '}
                      {new Date(feature.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(feature.status)}
                    <Button
                      variant={feature.has_voted ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleVote(feature.id)}
                      className="flex items-center gap-1"
                    >
                      <ArrowUp className="h-4 w-4" />
                      {feature.vote_count}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap mb-4">{feature.description}</p>
                
                {user?.is_super_admin && (
                  <div className="flex items-center gap-2 pt-4 border-t">
                    <Select
                      value={feature.status}
                      onValueChange={(value: FeatureRequestStatus) =>
                        handleStatusChange(feature.id, value)
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                        <SelectItem value="declined">Declined</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(feature.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
    </>
  )
}

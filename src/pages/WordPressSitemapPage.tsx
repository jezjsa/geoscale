import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Navigation } from '@/components/Navigation'
import { InlineEdit } from '@/components/InlineEdit'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, RefreshCw, Loader2, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchWordPressSitemap, updateWordPressPageMeta } from '@/api/wordpress'
import { toast } from 'sonner'

export function WordPressSitemapPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  if (!projectId) {
    return <div>Project not found</div>
  }

  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // Fetch project details
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('project_name, company_name, wp_url, blog_url, wp_api_key')
        .eq('id', projectId)
        .single()

      if (error) throw error
      return data
    },
  })

  // Fetch WordPress sitemap
  const { data: sitemapData, isLoading, refetch } = useQuery({
    queryKey: ['wordpressSitemap', projectId],
    queryFn: async () => {
      if (!project?.wp_api_key || (!project?.wp_url && !project?.blog_url)) {
        throw new Error('WordPress URL and API key are required')
      }

      const wpUrl = project.blog_url || project.wp_url
      return fetchWordPressSitemap(wpUrl, project.wp_api_key)
    },
    enabled: !!project?.wp_api_key && !!(project?.wp_url || project?.blog_url),
  })

  // Update meta mutation
  const updateMetaMutation = useMutation({
    mutationFn: async ({ pageId, field, value }: { pageId: number; field: 'meta_title' | 'meta_description'; value: string }) => {
      if (!project?.wp_api_key || (!project?.wp_url && !project?.blog_url)) {
        throw new Error('WordPress configuration missing')
      }

      const wpUrl = project.blog_url || project.wp_url
      const currentPage = sitemapData?.sitemap.find(p => p.id === pageId)
      
      if (!currentPage) throw new Error('Page not found')

      return updateWordPressPageMeta({
        pageId,
        metaTitle: field === 'meta_title' ? value : currentPage.meta_title,
        metaDescription: field === 'meta_description' ? value : currentPage.meta_description,
        wordpressUrl: wpUrl,
        wordpressApiKey: project.wp_api_key,
      })
    },
    onSuccess: () => {
      toast.success('Meta data updated successfully')
      queryClient.invalidateQueries({ queryKey: ['wordpressSitemap', projectId] })
    },
    onError: (error: Error) => {
      toast.error('Failed to update meta data', {
        description: error.message,
      })
    },
  })

  // Filter sitemap
  const filteredSitemap = useMemo(() => {
    if (!sitemapData?.sitemap) return []

    return sitemapData.sitemap.filter(item => {
      const matchesSearch = searchQuery === '' || 
        item.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.meta_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.meta_description.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesType = typeFilter === 'all' || item.type === typeFilter

      return matchesSearch && matchesType
    })
  }, [sitemapData?.sitemap, searchQuery, typeFilter])

  // Get unique types
  const uniqueTypes = useMemo(() => {
    if (!sitemapData?.sitemap) return []
    const types = new Set(sitemapData.sitemap.map(item => item.type))
    return Array.from(types).sort()
  }, [sitemapData?.sitemap])

  const handleBack = () => {
    navigate(`/projects/${projectId}?view=settings`)
  }

  const handleUpdateMeta = async (pageId: number, field: 'meta_title' | 'meta_description', value: string) => {
    await updateMetaMutation.mutateAsync({ pageId, field, value })
  }

  const publishedCount = sitemapData?.sitemap.filter(item => item.status === 'publish').length || 0
  const needsSyncCount = 0 // Placeholder for future functionality

  if (!project) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    )
  }

  if (!project.wp_api_key || (!project.wp_url && !project.blog_url)) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground mb-4">
                WordPress URL and API key are required to view the sitemap.
              </p>
              <Button onClick={handleBack} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Project Settings
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pt-16">
      <Navigation />
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">WordPress Sitemap</h1>
            <p className="text-muted-foreground">
              Manage your WordPress meta titles and descriptions.
            </p>
          </div>
          <Button
            onClick={() => refetch()}
            disabled={isLoading}
            variant="outline"
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync from WordPress
          </Button>
        </div>

        {/* Stats and Filters */}
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
          
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {uniqueTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex gap-4">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Total Items</div>
              <div className="text-2xl font-bold">{sitemapData?.total_items || 0}</div>
            </div>
            <div className="text-center px-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-sm text-blue-600 dark:text-blue-400">Published</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{publishedCount}</div>
            </div>
            <div className="text-center px-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <div className="text-sm text-yellow-600 dark:text-yellow-400">Need Sync</div>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{needsSyncCount}</div>
            </div>
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Type</TableHead>
                  <TableHead className="w-[300px]">URL</TableHead>
                  <TableHead>Meta Title</TableHead>
                  <TableHead>Meta Description</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredSitemap.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No pages found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSitemap.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {item.type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[var(--brand-dark)] hover:underline flex items-center gap-1"
                        >
                          {item.slug}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell>
                        <InlineEdit
                          value={item.meta_title}
                          onSave={(value) => handleUpdateMeta(item.id, 'meta_title', value)}
                          className="text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <InlineEdit
                          value={item.meta_description}
                          onSave={(value) => handleUpdateMeta(item.id, 'meta_description', value)}
                          multiline
                          className="text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(item.url, '_blank')}
                          className="h-8 w-8 p-0"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Navigation } from '@/components/Navigation'
import { InlineEdit } from '@/components/InlineEdit'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Loader2, RefreshCw, ArrowUpToLine } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generateContent, publishGeneratedPageToWordPress } from '@/api/content-generator'
import { toast } from 'sonner'

export function ViewContentPage() {
  const { projectId, locationKeywordId } = useParams<{ projectId: string; locationKeywordId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  if (!projectId || !locationKeywordId) {
    return <div>Project or content not found</div>
  }
  const [projectName, setProjectName] = useState<string>('')
  const [projectUrl, setProjectUrl] = useState<string>('')
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regenerateProgress, setRegenerateProgress] = useState(0)
  const [isPublishing, setIsPublishing] = useState(false)

  // Fetch project details
  useEffect(() => {
    if (projectId) {
      supabase
        .from('projects')
        .select('project_name, blog_url, wp_url')
        .eq('id', projectId)
        .single()
        .then(({ data }) => {
          if (data) {
            setProjectName(data.project_name)
            // Use blog_url first, fallback to wp_url
            const url = data.blog_url || data.wp_url || ''
            // Extract domain from URL
            if (url) {
              try {
                const urlObj = new URL(url)
                setProjectUrl(urlObj.hostname)
              } catch {
                setProjectUrl(url)
              }
            }
          }
        })
    }
  }, [projectId])

  // Fetch generated content
  const { data: content, isLoading, error } = useQuery({
    queryKey: ['generatedContent', locationKeywordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generated_pages')
        .select(`
          *,
          location_keyword:location_keywords!location_keyword_id(
            phrase,
            status,
            location:project_locations!location_id(name),
            keyword:keyword_variations!keyword_id(keyword)
          )
        `)
        .eq('location_keyword_id', locationKeywordId)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!locationKeywordId,
  })

  // Subscribe to real-time updates for location_keywords status changes
  useEffect(() => {
    if (!locationKeywordId || !isRegenerating) return

    const channel = supabase
      .channel(`location_keyword_status_${locationKeywordId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'location_keywords',
          filter: `id=eq.${locationKeywordId}`,
        },
        (payload: any) => {
          console.log('Location keyword status changed:', payload)
          const newStatus = payload.new?.status
          
          if (newStatus === 'generating') {
            setRegenerateProgress(50)
          } else if (newStatus === 'generated') {
            setRegenerateProgress(90)
            // Content is ready, refetch
            setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: ['generatedContent', locationKeywordId] })
              setRegenerateProgress(100)
              setTimeout(() => {
                setIsRegenerating(false)
                setRegenerateProgress(0)
              }, 1000)
            }, 500)
          } else if (newStatus === 'error') {
            setIsRegenerating(false)
            setRegenerateProgress(0)
            toast.error('Content generation failed')
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [locationKeywordId, queryClient, isRegenerating])

  // Mutation to update generated page fields
  const updateFieldMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: string }) => {
      const { error } = await supabase
        .from('generated_pages')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('location_keyword_id', locationKeywordId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generatedContent', locationKeywordId] })
      toast.success('Updated successfully')
    },
    onError: (error: Error) => {
      toast.error('Failed to update', {
        description: error.message,
      })
    },
  })

  // Mutation to regenerate content
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      console.log('🔄 REGENERATE: Starting regeneration for locationKeywordId:', locationKeywordId)
      
      // Start progress
      setIsRegenerating(true)
      setRegenerateProgress(10)
      console.log('📊 REGENERATE: Progress 10% - Starting process')

      // Reset status to pending
      console.log('🔄 REGENERATE: Resetting status to pending...')
      const { error: statusError } = await supabase
        .from('location_keywords')
        .update({ status: 'pending' })
        .eq('id', locationKeywordId)

      if (statusError) {
        console.error('❌ REGENERATE: Error resetting status:', statusError)
        throw statusError
      }
      console.log('✅ REGENERATE: Status reset to pending')

      setRegenerateProgress(20)
      console.log('📊 REGENERATE: Progress 20% - Status reset')

      // Delete old content
      console.log('🗑️ REGENERATE: Deleting old content...')
      const { error: deleteError } = await supabase
        .from('generated_pages')
        .delete()
        .eq('location_keyword_id', locationKeywordId)

      if (deleteError) {
        console.error('❌ REGENERATE: Error deleting content:', deleteError)
        throw deleteError
      }
      console.log('✅ REGENERATE: Old content deleted')

      setRegenerateProgress(30)
      console.log('📊 REGENERATE: Progress 30% - Content deleted')

      // Trigger new generation
      console.log('🤖 REGENERATE: Calling generateContent API...')
      const response = await generateContent([locationKeywordId])
      console.log('✅ REGENERATE: API call completed, response:', response)
      
      setRegenerateProgress(80)
      console.log('📊 REGENERATE: Progress 80% - Waiting for generation to complete')
      return response
    },
    onSuccess: (data) => {
      console.log('✅ REGENERATE: Mutation onSuccess triggered, data:', data)
      setRegenerateProgress(100)
      console.log('📊 REGENERATE: Progress 100% - Complete!')
      toast.success('Content regenerated successfully!')
      
      // Wait a moment then reset and refetch
      setTimeout(() => {
        console.log('🔄 REGENERATE: Resetting state and refetching content...')
        setIsRegenerating(false)
        setRegenerateProgress(0)
        queryClient.invalidateQueries({ queryKey: ['generatedContent', locationKeywordId] })
      }, 1000)
    },
    onError: (error: Error) => {
      console.error('❌ REGENERATE: Mutation error:', error)
      setIsRegenerating(false)
      setRegenerateProgress(0)
      toast.error('Failed to regenerate content', {
        description: error.message,
      })
    },
  })

  const handleUpdateField = async (field: string, value: string) => {
    await updateFieldMutation.mutateAsync({ field, value })
  }

  const handleRegenerate = () => {
    console.log('🎯 REGENERATE: Button clicked!')
    console.log('📍 REGENERATE: locationKeywordId:', locationKeywordId)
    console.log('📍 REGENERATE: projectId:', projectId)
    regenerateMutation.mutate()
  }

  const handleBack = () => {
    navigate(`/projects/${projectId}?view=combinations`)
  }

  const handlePublishToWordPress = async () => {
    setIsPublishing(true)
    toast.info('Publishing to WordPress...')
    
    try {
      const result = await publishGeneratedPageToWordPress(locationKeywordId, projectId)
      
      if (result.success) {
        toast.success('Successfully published to WordPress!', {
          description: result.page_url ? `View page: ${result.page_url}` : undefined,
        })
        queryClient.invalidateQueries({ queryKey: ['generatedContent', locationKeywordId] })
        queryClient.invalidateQueries({ queryKey: ['projectCombinations', projectId] })
      } else {
        toast.error('Failed to publish to WordPress', {
          description: result.error,
        })
      }
    } catch (error) {
      toast.error('Error publishing to WordPress', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setIsPublishing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !content) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto py-8">
          <Card>
            <CardHeader>
              <CardTitle>Error Loading Content</CardTitle>
              <CardDescription>
                The generated content could not be found or loaded.
                {error && <span className="block mt-2 text-destructive">{error instanceof Error ? error.message : 'Unknown error'}</span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleBack} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Project
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
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
            {projectName && (
              <span className="text-muted-foreground">/ {projectName}</span>
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Generated Content</h1>
          {content.location_keyword && (
            <p className="text-muted-foreground">
              <span className="text-xs uppercase tracking-wider">Keyword Combination: </span>
              {content.location_keyword.phrase}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handlePublishToWordPress}
            disabled={isPublishing || isRegenerating}
            variant="outline"
            className="gap-2"
            style={{ borderColor: 'var(--brand-dark)', color: 'var(--brand-dark)' }}
          >
            {isPublishing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <ArrowUpToLine className="h-4 w-4" />
                Republish to WordPress
              </>
            )}
          </Button>
          <Button
            onClick={handleRegenerate}
            disabled={isRegenerating || regenerateMutation.isPending}
            className="gap-2"
            style={{ backgroundColor: 'var(--brand-dark)' }}
          >
            {isRegenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Regenerate Content
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      {isRegenerating && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Generating fresh content...</span>
                <span className="text-muted-foreground">{regenerateProgress}%</span>
              </div>
              <Progress 
                value={regenerateProgress} 
                className="h-2 [&>div]:bg-[var(--brand-dark)]"
              />
              <p className="text-xs text-muted-foreground">
                This may take 10-30 seconds. The page will refresh automatically when complete.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Google Search Preview */}
      <Card>
        <CardContent className="pt-6">
          <div className="border rounded-lg p-6 !bg-white dark:!bg-[#202124]">
            {/* Favicon and URL */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-[var(--brand-dark)] flex items-center justify-center text-white text-xs font-bold">
                G
              </div>
              <div className="flex flex-col">
                <span className="text-sm !text-gray-700 dark:!text-gray-300">{projectUrl || 'yoursite.com'}</span>
                <div className="flex items-center text-xs !text-gray-600 dark:!text-gray-400 [&_.cursor-pointer:hover]:!bg-gray-100 [&_.cursor-pointer:hover]:dark:!bg-gray-700">
                  <span>{projectUrl || 'yoursite.com'}/</span>
                  <InlineEdit
                    value={content.slug || ''}
                    onSave={(value) => handleUpdateField('slug', value)}
                    className="text-xs !text-gray-600 dark:!text-gray-400 font-normal"
                    placeholder="page-slug"
                  />
                </div>
              </div>
            </div>
            
            {/* Title (clickable in Google) */}
            <div className="mb-1 [&_.cursor-pointer:hover]:!bg-gray-100 [&_.cursor-pointer:hover]:dark:!bg-gray-700">
              <InlineEdit
                value={content.meta_title || content.title}
                onSave={(value) => handleUpdateField('meta_title', value)}
                className="text-xl leading-7 !text-[#1a0dab] dark:!text-[#8ab4f8] cursor-pointer font-normal"
              />
            </div>
            
            {/* Date line */}
            <div className="flex items-center gap-2 mb-3 text-sm !text-gray-600 dark:!text-gray-400">
              <span>{new Date(content.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              <span className="!text-gray-500 dark:!text-gray-500">—</span>
            </div>
            
            {/* Meta Description */}
            <div className="[&_.cursor-pointer:hover]:!bg-gray-100 [&_.cursor-pointer:hover]:dark:!bg-gray-700">
              <InlineEdit
                value={content.meta_description || ''}
                onSave={(value) => handleUpdateField('meta_description', value)}
                multiline
                className="text-sm !text-gray-700 dark:!text-gray-300 leading-relaxed"
                placeholder="Add meta description..."
              />
              <p className="text-xs text-muted-foreground mt-2">
                {content.meta_description?.length || 0}/155 characters
                {content.meta_description && content.meta_description.length > 155 && (
                  <span className="text-orange-500 ml-2">⚠️ Too long</span>
                )}
              </p>
            </div>
          </div>
          
        </CardContent>
      </Card>

      {/* Page Title (H1) */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Page Title (H1)</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <InlineEdit
            value={content.title}
            onSave={(value) => handleUpdateField('title', value)}
            className="text-4xl font-bold tracking-tight"
          />
        </CardContent>
      </Card>

      {/* Page Content */}
      <Card>
        <CardContent>
          {/* Preview Section */}
          <div className="space-y-4">
            <div className="border rounded-lg p-8 mt-8">
              <h3 className="text-sm font-medium mb-6 text-muted-foreground">Content</h3>
              <style>{`
                .content-preview {
                  max-width: none;
                  color: #e2e8f0;
                }
                .content-preview h1 {
                  font-size: 2.25rem;
                  font-weight: 700;
                  color: #e2e8f0;
                  margin-top: 0;
                  margin-bottom: 1.5rem;
                  line-height: 1.2;
                  letter-spacing: -0.025em;
                }
                .content-preview h2 {
                  font-size: 1.875rem;
                  font-weight: 700;
                  color: #e2e8f0;
                  margin-top: 3rem;
                  margin-bottom: 1rem;
                  padding-bottom: 0.5rem;
                  line-height: 1.3;
                }
                .content-preview h3 {
                  font-size: 1.5rem;
                  font-weight: 600;
                  color: #e2e8f0;
                  margin-top: 2rem;
                  margin-bottom: 0.75rem;
                  line-height: 1.4;
                }
                .content-preview h4 {
                  font-size: 1.25rem;
                  font-weight: 600;
                  color: #e2e8f0;
                  margin-top: 1.5rem;
                  margin-bottom: 0.5rem;
                }
                .content-preview p {
                  font-size: 1rem;
                  line-height: 1.75;
                  margin-bottom: 1.5rem;
                  color: #e2e8f0;
                }
                .content-preview ul,
                .content-preview ol {
                  margin: 1.5rem 0;
                  padding-left: 1.5rem;
                }
                .content-preview ul {
                  list-style-type: disc;
                }
                .content-preview ol {
                  list-style-type: decimal;
                }
                .content-preview li {
                  margin-bottom: 0.5rem;
                  line-height: 1.75;
                  color: #e2e8f0;
                }
                .content-preview strong {
                  font-weight: 600;
                  color: #e2e8f0;
                }
                .content-preview em {
                  font-style: italic;
                  color: #e2e8f0;
                }
                .content-preview a {
                  color: #e2e8f0;
                  text-decoration: underline;
                  transition: color 0.2s;
                }
                .content-preview a:hover {
                  color: #ffffff;
                }
                .content-preview .testimonial {
                  border-left: 4px solid var(--brand-dark);
                  background-color: rgba(0, 98, 57, 0.1);
                  padding: 1.5rem;
                  margin: 2rem 0;
                  border-radius: 0.5rem;
                  position: relative;
                }
                .content-preview .testimonial:before {
                  content: '"';
                  font-size: 3rem;
                  color: var(--brand-dark);
                  position: absolute;
                  left: 0.5rem;
                  top: -0.5rem;
                  font-family: Georgia, serif;
                  opacity: 0.3;
                }
                .content-preview .testimonial blockquote {
                  border: none;
                  background: none;
                  padding: 0;
                  padding-left: 1rem;
                  font-style: italic;
                  color: #e2e8f0;
                  margin: 0;
                  font-size: 1.125rem;
                  line-height: 1.75;
                }
                .content-preview .testimonial-author,
                .content-preview .testimonial p {
                  text-align: right;
                  margin-top: 1rem;
                  margin-bottom: 0;
                  font-size: 0.875rem;
                  color: #e2e8f0;
                  opacity: 0.8;
                }
                .content-preview blockquote {
                  border-left: 4px solid var(--brand-dark);
                  padding-left: 1rem;
                  font-style: italic;
                  color: #e2e8f0;
                  margin: 1.5rem 0;
                }
                .content-preview section {
                  margin-bottom: 2rem;
                }
                .content-preview dl {
                  margin: 1.5rem 0;
                }
                .content-preview dt {
                  font-weight: 600;
                  color: #e2e8f0;
                  margin-top: 1rem;
                }
                .content-preview dd {
                  color: #e2e8f0;
                  margin-bottom: 0.5rem;
                  margin-left: 0;
                }
                .content-preview code {
                  background-color: #f3f4f6;
                  padding: 0.125rem 0.25rem;
                  border-radius: 0.25rem;
                  font-size: 0.875rem;
                  font-family: monospace;
                }
                .content-preview pre {
                  background-color: #1f2937;
                  color: #f9fafb;
                  padding: 1rem;
                  border-radius: 0.5rem;
                  overflow-x: auto;
                  margin: 1.5rem 0;
                }
                .content-preview pre code {
                  background-color: transparent;
                  padding: 0;
                  color: inherit;
                }
              `}</style>
              <div 
                className="content-preview"
                dangerouslySetInnerHTML={{ __html: content.content }}
              />
            </div>

            {/* HTML Source */}
            <details className="border rounded-lg p-4">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                View HTML Source
              </summary>
              <pre className="mt-4 text-xs bg-muted p-4 rounded overflow-x-auto">
                <code>{content.content}</code>
              </pre>
            </details>
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-muted-foreground">Created</dt>
              <dd>{new Date(content.created_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Last Updated</dt>
              <dd>{new Date(content.updated_at).toLocaleString()}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}


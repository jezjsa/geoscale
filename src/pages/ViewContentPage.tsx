import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Navigation } from '@/components/Navigation'
import { InlineEdit } from '@/components/InlineEdit'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Loader2, RefreshCw, ArrowUpToLine, Sparkles, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Map, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generateContent, publishGeneratedPageToWordPress } from '@/api/content-generator'
import { getCurrentUserPlan } from '@/lib/plan-service'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

export function ViewContentPage() {
  const { projectId, locationKeywordId } = useParams<{ projectId: string; locationKeywordId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  
  if (!projectId || !locationKeywordId) {
    return <div>Project or content not found</div>
  }
  const [projectName, setProjectName] = useState<string>('')
  const [projectUrl, setProjectUrl] = useState<string>('')
  const [hasWordPressConnection, setHasWordPressConnection] = useState<boolean>(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regenerateProgress, setRegenerateProgress] = useState(0)
  const [isPublishing, setIsPublishing] = useState(false)

  // Get user's plan to check if they can regenerate content
  const { data: userPlan } = useQuery({
    queryKey: ['userPlan', user?.id],
    queryFn: () => getCurrentUserPlan(user?.id),
    enabled: !!user?.id,
  })

  // Starter plan users cannot regenerate content
  const canRegenerateContent = userPlan?.name !== 'starter'

  // Function to highlight keyword phrase and location in text
  const highlightText = (text: string, phrase: string | undefined, location: string | undefined): string => {
    if (!text) return text
    let result = text
    
    // Highlight location first (so phrase highlighting doesn't break location spans)
    if (location) {
      const locationRegex = new RegExp(`(${location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
      result = result.replace(locationRegex, '<mark class="highlight-location">$1</mark>')
    }
    
    // Highlight the full phrase (but avoid double-highlighting location within phrase)
    if (phrase) {
      // Remove location from phrase to get just the keyword part
      const keywordPart = location ? phrase.replace(new RegExp(`\\s*(in|for|near|around)\\s+${location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), '').trim() : phrase
      if (keywordPart && keywordPart !== location) {
        const phraseRegex = new RegExp(`(${keywordPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
        result = result.replace(phraseRegex, '<mark class="highlight-phrase">$1</mark>')
      }
    }
    
    return result
  }

  // Function to count occurrences of keyword and location
  const countOccurrences = (text: string, phrase: string | undefined, location: string | undefined): { keywordCount: number; locationCount: number } => {
    if (!text) return { keywordCount: 0, locationCount: 0 }
    
    let keywordCount = 0
    let locationCount = 0
    
    // Strip HTML tags for accurate counting
    const plainText = text.replace(/<[^>]*>/g, ' ')
    
    if (location) {
      const locationRegex = new RegExp(location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      const matches = plainText.match(locationRegex)
      locationCount = matches ? matches.length : 0
    }
    
    if (phrase) {
      const keywordPart = location ? phrase.replace(new RegExp(`\\s*(in|for|near|around)\\s+${location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), '').trim() : phrase
      if (keywordPart && keywordPart !== location) {
        const phraseRegex = new RegExp(keywordPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        const matches = plainText.match(phraseRegex)
        keywordCount = matches ? matches.length : 0
      }
    }
    
    return { keywordCount, locationCount }
  }

  // SEO Score calculation
  interface SEOScore {
    score: number
    grade: 'excellent' | 'good' | 'needs-work' | 'poor'
    checks: {
      name: string
      passed: boolean
      message: string
      points: number
    }[]
  }

  const calculateSEOScore = (
    content: string,
    title: string,
    phrase: string | undefined,
    location: string | undefined
  ): SEOScore => {
    const checks: SEOScore['checks'] = []
    const plainText = content.replace(/<[^>]*>/g, ' ')
    const wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length
    
    // Extract keyword part
    const keywordPart = location && phrase 
      ? phrase.replace(new RegExp(`\\s*(in|for|near|around)\\s+${location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), '').trim() 
      : phrase || ''

    // 1. Content length (max 15 points)
    const lengthPoints = wordCount >= 800 ? 15 : wordCount >= 500 ? 10 : wordCount >= 300 ? 5 : 0
    checks.push({
      name: 'Content Length',
      passed: wordCount >= 500,
      message: `${wordCount} words (${wordCount >= 800 ? 'excellent' : wordCount >= 500 ? 'good' : 'could be longer'})`,
      points: lengthPoints
    })

    // 2. Keyword in title (max 15 points)
    const keywordInTitle = keywordPart && title.toLowerCase().includes(keywordPart.toLowerCase())
    checks.push({
      name: 'Keyword in Title',
      passed: !!keywordInTitle,
      message: keywordInTitle ? 'Keyword found in title' : 'Keyword missing from title',
      points: keywordInTitle ? 15 : 0
    })

    // 3. Location in title (max 10 points)
    const locationInTitle = location && title.toLowerCase().includes(location.toLowerCase())
    checks.push({
      name: 'Location in Title',
      passed: !!locationInTitle,
      message: locationInTitle ? 'Location found in title' : 'Location missing from title',
      points: locationInTitle ? 10 : 0
    })

    // 4. Keyword density (max 20 points) - aim for 3-6 mentions
    const keywordCount = keywordPart ? (plainText.toLowerCase().match(new RegExp(keywordPart.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length : 0
    const keywordDensityPoints = keywordCount >= 5 ? 20 : keywordCount >= 3 ? 15 : keywordCount >= 1 ? 5 : 0
    checks.push({
      name: 'Keyword Frequency',
      passed: keywordCount >= 3,
      message: `Keyword appears ${keywordCount} times (aim for 3-6)`,
      points: keywordDensityPoints
    })

    // 5. Location density (max 15 points) - aim for 4-8 mentions
    const locationCount = location ? (plainText.toLowerCase().match(new RegExp(location.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length : 0
    const locationDensityPoints = locationCount >= 6 ? 15 : locationCount >= 4 ? 12 : locationCount >= 2 ? 6 : 0
    checks.push({
      name: 'Location Frequency',
      passed: locationCount >= 4,
      message: `Location appears ${locationCount} times (aim for 4-8)`,
      points: locationDensityPoints
    })

    // 6. Keyword in first paragraph (max 10 points)
    const firstPara = content.match(/<p[^>]*>(.*?)<\/p>/i)?.[1] || ''
    const keywordInFirstPara = keywordPart && firstPara.toLowerCase().includes(keywordPart.toLowerCase())
    checks.push({
      name: 'Keyword in First Paragraph',
      passed: !!keywordInFirstPara,
      message: keywordInFirstPara ? 'Keyword in opening paragraph' : 'Add keyword to first paragraph',
      points: keywordInFirstPara ? 10 : 0
    })

    // 7. Keyword in headings (max 15 points)
    const headings = content.match(/<h[2-3][^>]*>(.*?)<\/h[2-3]>/gi) || []
    const headingsWithKeyword = headings.filter(h => keywordPart && h.toLowerCase().includes(keywordPart.toLowerCase())).length
    const headingPoints = headingsWithKeyword >= 2 ? 15 : headingsWithKeyword >= 1 ? 10 : 0
    checks.push({
      name: 'Keyword in Headings',
      passed: headingsWithKeyword >= 1,
      message: `${headingsWithKeyword} heading(s) contain keyword`,
      points: headingPoints
    })

    const totalScore = checks.reduce((sum, check) => sum + check.points, 0)
    const grade: SEOScore['grade'] = 
      totalScore >= 80 ? 'excellent' : 
      totalScore >= 60 ? 'good' : 
      totalScore >= 40 ? 'needs-work' : 'poor'

    return { score: totalScore, grade, checks }
  }

  // State for enhancing content
  const [isEnhancing, setIsEnhancing] = useState(false)

  // Fetch project details
  useEffect(() => {
    if (projectId) {
      supabase
        .from('projects')
        .select('project_name, blog_url, wp_url, wp_api_key')
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
            // Check if WordPress is connected (has URL and API key)
            setHasWordPressConnection(!!(url && data.wp_api_key))
          }
        })
    }
  }, [projectId])

  // Fetch all generated pages for this project (for navigation)
  const { data: allGeneratedPages } = useQuery({
    queryKey: ['allGeneratedPages', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generated_pages')
        .select('id, location_keyword_id, title')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })

  // Calculate current index and navigation
  const currentIndex = allGeneratedPages?.findIndex(p => p.location_keyword_id === locationKeywordId) ?? -1
  const prevPage = currentIndex > 0 ? allGeneratedPages?.[currentIndex - 1] : null
  const nextPage = currentIndex >= 0 && currentIndex < (allGeneratedPages?.length ?? 0) - 1 ? allGeneratedPages?.[currentIndex + 1] : null
  const totalPages = allGeneratedPages?.length ?? 0

  const navigateToPrev = () => {
    if (prevPage) {
      navigate(`/projects/${projectId}/content/${prevPage.location_keyword_id}`)
    }
  }

  const navigateToNext = () => {
    if (nextPage) {
      navigate(`/projects/${projectId}/content/${nextPage.location_keyword_id}`)
    }
  }

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

  // Handle enhance keywords - calls OpenAI to add more keyword mentions
  const handleEnhanceKeywords = async () => {
    if (!content) return
    
    setIsEnhancing(true)
    toast.info('Enhancing content with more keywords...')
    
    try {
      const phrase = content.location_keyword?.phrase
      const location = content.location_keyword?.location?.name
      const keywordPart = location && phrase 
        ? phrase.replace(new RegExp(`\\s*(in|for|near|around)\\s+${location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), '').trim() 
        : phrase || ''

      const { keywordCount, locationCount } = countOccurrences(content.content, phrase, location)

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enhance-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          content: content.content,
          keyword: keywordPart,
          location: location,
          currentKeywordCount: keywordCount,
          currentLocationCount: locationCount,
          targetKeywordCount: Math.max(5, keywordCount + 2),
          targetLocationCount: Math.max(6, locationCount + 2),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to enhance content')
      }

      const result = await response.json()
      
      if (result.enhancedContent) {
        // Update the content in the database
        const { error } = await supabase
          .from('generated_pages')
          .update({ 
            content: result.enhancedContent, 
            updated_at: new Date().toISOString() 
          })
          .eq('location_keyword_id', locationKeywordId)

        if (error) throw error

        queryClient.invalidateQueries({ queryKey: ['generatedContent', locationKeywordId] })
        toast.success('Content enhanced with more keywords!')
      }
    } catch (error) {
      console.error('Enhance error:', error)
      toast.error('Failed to enhance content', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setIsEnhancing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-16">
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
      <div className="min-h-screen bg-background pt-16">
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
    <div className="min-h-screen bg-background pt-16">
      <Navigation />
      <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Generated Content</h1>
          {content.location_keyword && (
            <p className="text-muted-foreground">
              <span className="text-xs uppercase tracking-wider">Keyword Combination: </span>
              {content.location_keyword.phrase}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Navigation Arrows */}
          {totalPages > 1 && (
            <div className="flex items-center gap-3">
              <button
                onClick={navigateToPrev}
                disabled={!prevPage}
                className={`p-2 rounded-full transition-opacity ${prevPage ? 'hover:bg-foreground/10 cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
                title={prevPage ? `Previous: ${prevPage.title}` : 'No previous page'}
              >
                <ChevronLeft className="h-6 w-6 text-foreground" />
              </button>
              <span className="text-foreground text-sm font-medium">
                {currentIndex + 1} / {totalPages}
              </span>
              <button
                onClick={navigateToNext}
                disabled={!nextPage}
                className={`p-2 rounded-full transition-opacity ${nextPage ? 'hover:bg-foreground/10 cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
                title={nextPage ? `Next: ${nextPage.title}` : 'No next page'}
              >
                <ChevronRight className="h-6 w-6 text-foreground" />
              </button>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Project
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

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column - H1 Title + Content (wider) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Page Title (H1) */}
          <Card>
            <CardHeader className="pb-0">
              <CardDescription>Page Title (H1)</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <InlineEdit
                value={content.title}
                onSave={(value) => handleUpdateField('title', value)}
                className="text-4xl font-bold tracking-tight"
              />
            </CardContent>
          </Card>

          {/* Page Content */}
          <Card>
            <CardContent className="pt-6">
          {/* Preview Section */}
          <div className="space-y-4">
            <div className="p-2">
              {/* Highlight Legend with Counts */}
              {(() => {
                const counts = countOccurrences(
                  content.content,
                  content.location_keyword?.phrase,
                  content.location_keyword?.location?.name
                )
                return (
                  <div className="flex items-center gap-4 mb-6">
                    <h3 className="text-sm font-bold text-muted-foreground">Page Content</h3>
                    <div className="flex items-center gap-4 ml-auto text-xs">
                      <div className="flex items-center gap-1">
                        <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: 'rgba(254, 240, 138, 0.2)' }}></span>
                        <span className="text-muted-foreground">Keyword</span>
                        <span className="font-semibold text-foreground">({counts.keywordCount})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: 'rgba(187, 247, 208, 0.2)' }}></span>
                        <span className="text-muted-foreground">Location</span>
                        <span className="font-semibold text-foreground">({counts.locationCount})</span>
                      </div>
                    </div>
                  </div>
                )
              })()}
              <style>{`
                .content-preview {
                  max-width: none;
                  color: hsl(var(--foreground));
                }
                .content-preview h1 {
                  font-size: 2.25rem;
                  font-weight: 700;
                  color: hsl(var(--foreground));
                  margin-top: 0;
                  margin-bottom: 1.5rem;
                  line-height: 1.2;
                  letter-spacing: -0.025em;
                }
                .content-preview h2 {
                  font-size: 1.875rem;
                  font-weight: 700;
                  color: hsl(var(--foreground));
                  margin-top: 3rem;
                  margin-bottom: 1rem;
                  padding-bottom: 0.5rem;
                  line-height: 1.3;
                }
                .content-preview h3 {
                  font-size: 1.5rem;
                  font-weight: 600;
                  color: hsl(var(--foreground));
                  margin-top: 2rem;
                  margin-bottom: 0.75rem;
                  line-height: 1.4;
                }
                .content-preview h4 {
                  font-size: 1.25rem;
                  font-weight: 600;
                  color: hsl(var(--foreground));
                  margin-top: 1.5rem;
                  margin-bottom: 0.5rem;
                }
                .content-preview p {
                  font-size: 1rem;
                  line-height: 1.75;
                  margin-bottom: 1.5rem;
                  color: hsl(var(--foreground));
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
                  color: hsl(var(--foreground));
                }
                .content-preview strong {
                  font-weight: 600;
                  color: hsl(var(--foreground));
                }
                .content-preview em {
                  font-style: italic;
                  color: hsl(var(--foreground));
                }
                .content-preview a {
                  color: var(--brand-dark);
                  text-decoration: underline;
                  transition: color 0.2s;
                }
                .content-preview a:hover {
                  color: var(--brand-light);
                }
                .content-preview .testimonial {
                  border-left: 4px solid var(--brand-dark);
                  background-color: hsl(var(--muted));
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
                  color: hsl(var(--foreground));
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
                  color: hsl(var(--muted-foreground));
                }
                .content-preview blockquote {
                  border-left: 4px solid var(--brand-dark);
                  padding-left: 1rem;
                  font-style: italic;
                  color: hsl(var(--foreground));
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
                  color: hsl(var(--foreground));
                  margin-top: 1rem;
                }
                .content-preview dd {
                  color: hsl(var(--foreground));
                  margin-bottom: 0.5rem;
                  margin-left: 0;
                }
                .content-preview code {
                  background-color: hsl(var(--muted));
                  padding: 0.125rem 0.25rem;
                  border-radius: 0.25rem;
                  font-size: 0.875rem;
                  font-family: monospace;
                }
                .content-preview pre {
                  background-color: hsl(var(--muted));
                  color: hsl(var(--foreground));
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
                .highlight-phrase {
                  background-color: rgba(254, 240, 138, 0.3);
                  color: inherit;
                  padding: 0.1em 0.2em;
                  border-radius: 0.2em;
                  font-weight: inherit;
                }
                .highlight-location {
                  background-color: rgba(187, 247, 208, 0.3);
                  color: inherit;
                  padding: 0.1em 0.2em;
                  border-radius: 0.2em;
                  font-weight: inherit;
                }
              `}</style>
              <div 
                className="content-preview"
                dangerouslySetInnerHTML={{ 
                  __html: highlightText(
                    content.content, 
                    content.location_keyword?.phrase,
                    content.location_keyword?.location?.name
                  ) 
                }}
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

        </div>

        {/* Right Column - Actions + SEO Score + Metadata + Google Preview (narrower) */}
        <div className="space-y-6">
          {/* Actions Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-center">Actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handlePublishToWordPress}
                  disabled={isPublishing || isRegenerating || !hasWordPressConnection}
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  style={hasWordPressConnection 
                    ? { borderColor: 'var(--brand-dark)', color: 'var(--brand-dark)' }
                    : { borderColor: '#9ca3af', color: '#9ca3af' }
                  }
                >
                  {isPublishing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ArrowUpToLine className="h-3 w-3" />
                  )}
                  {content?.location_keyword?.status === 'pushed' ? 'Republish' : 'Publish'}
                </Button>
                {canRegenerateContent && (
                  <Button
                    onClick={handleRegenerate}
                    disabled={isRegenerating || regenerateMutation.isPending}
                    size="sm"
                    className="gap-1 text-xs text-white"
                    style={{ backgroundColor: 'var(--brand-dark)' }}
                  >
                    {isRegenerating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Regenerate
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/projects/${projectId}/ranking/${locationKeywordId}`)}
                  className="gap-1 text-xs"
                >
                  <TrendingUp className="h-3 w-3" />
                  Rank History
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigate(`/projects/${projectId}/heat-map/${locationKeywordId}`, {
                      state: {
                        phrase: content?.location_keyword?.phrase,
                        location: content?.location_keyword?.location?.name,
                        keyword: content?.location_keyword?.keyword?.keyword
                      }
                    })
                  }}
                  className="gap-1 text-xs"
                >
                  <Map className="h-3 w-3" />
                  Map Pack
                </Button>
              </div>
              {!hasWordPressConnection && (
                <p className="text-xs text-gray-400 text-center">
                  <button onClick={() => navigate(`/projects/${projectId}?view=settings`)} className="underline hover:text-[var(--brand-dark)]">Connect WordPress</button>
                </p>
              )}
            </CardContent>
          </Card>

          {/* SEO Score Card */}
          {(() => {
            const seoScore = calculateSEOScore(
              content.content,
              content.title,
              content.location_keyword?.phrase,
              content.location_keyword?.location?.name
            )
            // Calculate the stroke color based on score
            const getScoreColor = (score: number) => {
              if (score >= 70) return '#22c55e' // green - matches passed checks
              if (score >= 50) return '#f97316' // orange
              return '#ef4444' // red
            }
            
            const scoreColor = getScoreColor(seoScore.score)
            const circumference = 2 * Math.PI * 42 // radius = 42 (smaller to accommodate thicker stroke)
            const strokeDashoffset = circumference - (seoScore.score / 100) * circumference
            
            return (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-center">SEO Score</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Circular Score Chart */}
                  <div className="flex justify-center">
                    <div className="relative w-32 h-32">
                      <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
                        {/* Background circle */}
                        <circle
                          cx="50"
                          cy="50"
                          r="42"
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="12"
                          className="dark:stroke-gray-700"
                        />
                        {/* Score arc */}
                        <circle
                          cx="50"
                          cy="50"
                          r="42"
                          fill="none"
                          stroke={scoreColor}
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                        />
                      </svg>
                      {/* Score text in center */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold">{seoScore.score}</span>
                        <span className="text-xs text-muted-foreground">/ 100</span>
                      </div>
                    </div>
                  </div>

                  {/* Enhance Button */}
                  {seoScore.score < 70 && (
                    <Button
                      onClick={handleEnhanceKeywords}
                      disabled={isEnhancing}
                      size="sm"
                      className="w-full gap-2"
                      style={{ backgroundColor: 'var(--brand-dark)' }}
                    >
                      {isEnhancing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Enhancing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Enhance Keywords
                        </>
                      )}
                    </Button>
                  )}
                  
                  {/* Checks List */}
                  <div className="space-y-2">
                    {seoScore.checks.map((check, index) => (
                      <div 
                        key={index} 
                        className={`p-2 rounded-lg ${check.passed ? 'bg-green-50 dark:bg-green-950' : 'bg-amber-50 dark:bg-amber-900/30'}`}
                      >
                        <div className="flex items-center gap-2">
                          {check.passed ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="text-xs font-medium block">{check.name}</span>
                            <p className="text-xs text-muted-foreground truncate">{check.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })()}

          {/* Metadata */}
          <Card>
            <CardContent className="pt-6">
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="font-medium text-muted-foreground">Created</dt>
                  <dd>{new Date(content.created_at).toLocaleDateString('en-GB')}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Updated</dt>
                  <dd>{new Date(content.updated_at).toLocaleDateString('en-GB')}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Google Search Preview */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Google Search Preview</CardDescription>
            </CardHeader>
            <CardContent className="!bg-white dark:!bg-[#202124] rounded-b-lg">
                {/* Favicon and URL */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full bg-[var(--brand-dark)] flex items-center justify-center text-white text-xs font-bold">
                    G
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs !text-gray-700 dark:!text-gray-300">{projectUrl || 'yoursite.com'}</span>
                    <div className="flex items-center text-xs !text-gray-600 dark:!text-gray-400 [&_.cursor-pointer:hover]:!bg-gray-100 [&_.cursor-pointer:hover]:dark:!bg-gray-700">
                      <span className="truncate max-w-[100px]">{projectUrl || 'yoursite.com'}/</span>
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
                    className="text-sm leading-5 !text-[#1a0dab] dark:!text-[#8ab4f8] cursor-pointer font-normal"
                  />
                </div>
                
                {/* Date line */}
                <div className="flex items-center gap-2 mb-2 text-xs !text-gray-600 dark:!text-gray-400">
                  <span>{new Date(content.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  <span className="!text-gray-500 dark:!text-gray-500">—</span>
                </div>
                
                {/* Meta Description */}
                <div className="[&_.cursor-pointer:hover]:!bg-gray-100 [&_.cursor-pointer:hover]:dark:!bg-gray-700">
                  <InlineEdit
                    value={content.meta_description || ''}
                    onSave={(value) => handleUpdateField('meta_description', value)}
                    multiline
                    className="text-xs !text-gray-700 dark:!text-gray-300 leading-relaxed"
                    placeholder="Add meta description..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {content.meta_description?.length || 0}/155
                    {content.meta_description && content.meta_description.length > 155 && (
                      <span className="text-orange-500 ml-1">⚠️</span>
                    )}
                  </p>
                </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </div>
  )
}


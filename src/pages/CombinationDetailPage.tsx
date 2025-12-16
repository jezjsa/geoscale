import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Navigation } from '@/components/Navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePageMeta } from '@/hooks/usePageMeta'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

interface PositionHistory {
  id: string
  position: number | null
  checked_at: string
}

interface CombinationData {
  id: string
  phrase: string
  status: string
  position: number | null
  previous_position: number | null
  last_position_check: string | null
  wp_page_url: string | null
  project_id: string
  location: { name: string }
  keyword: { keyword: string }
  project: { project_name: string; company_name: string }
}

async function getCombinationDetails(combinationId: string): Promise<CombinationData | null> {
  const { data, error } = await supabase
    .from('location_keywords')
    .select(`
      id,
      phrase,
      status,
      position,
      previous_position,
      last_position_check,
      wp_page_url,
      project_id,
      location:project_locations!location_id(name),
      keyword:keyword_variations!keyword_id(keyword),
      project:projects!project_id(project_name, company_name)
    `)
    .eq('id', combinationId)
    .single()

  if (error) throw error
  return data as unknown as CombinationData
}

async function getPositionHistory(combinationId: string): Promise<PositionHistory[]> {
  const { data, error } = await supabase
    .from('position_history')
    .select('id, position, checked_at')
    .eq('location_keyword_id', combinationId)
    .order('checked_at', { ascending: true })

  if (error) throw error
  return data || []
}

export function CombinationDetailPage() {
  const { combinationId } = useParams<{ combinationId: string }>()

  const { data: combination, isLoading: combinationLoading } = useQuery({
    queryKey: ['combination', combinationId],
    queryFn: () => getCombinationDetails(combinationId!),
    enabled: !!combinationId,
  })

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['positionHistory', combinationId],
    queryFn: () => getPositionHistory(combinationId!),
    enabled: !!combinationId,
  })

  usePageMeta({
    title: combination ? `${combination.phrase} - Ranking History` : 'Ranking History',
    description: 'View Google ranking position history over time',
  })

  const isLoading = combinationLoading || historyLoading

  // Format chart data - show 100+ as position 100 for unranked
  const chartData = (history || []).map((h) => ({
    date: new Date(h.checked_at).toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short' 
    }),
    fullDate: new Date(h.checked_at).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    position: h.position !== null ? h.position : 100,
    isUnranked: h.position === null,
    displayLabel: h.position !== null ? h.position : '100+',
  }))

  // Calculate stats
  const positions = (history || []).filter(h => h.position !== null).map(h => h.position!)
  const bestPosition = positions.length > 0 ? Math.min(...positions) : null
  const worstPosition = positions.length > 0 ? Math.max(...positions) : null
  const avgPosition = positions.length > 0 
    ? Math.round(positions.reduce((a, b) => a + b, 0) / positions.length) 
    : null

  // Position change indicator
  const getPositionChange = () => {
    if (!combination?.position || !combination?.previous_position) return null
    const change = combination.previous_position - combination.position
    if (change > 0) return { direction: 'up', value: change }
    if (change < 0) return { direction: 'down', value: Math.abs(change) }
    return { direction: 'same', value: 0 }
  }

  const positionChange = getPositionChange()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!combination) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Combination not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pt-16">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        {/* Back button */}
        <div className="mb-6">
          <Button variant="ghost" asChild>
            <Link to={`/projects/${combination.project_id}?view=combinations`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Combinations
            </Link>
          </Button>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{combination.phrase}</h1>
              <p className="text-muted-foreground">
                {combination.project?.company_name || combination.project?.project_name}
              </p>
            </div>
            {combination.wp_page_url && (
              <Button variant="outline" asChild>
                <a href={combination.wp_page_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Page
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Current Position</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold">
                  {combination.position || '-'}
                </span>
                {positionChange && (
                  <div className={`flex items-center text-sm ${
                    positionChange.direction === 'up' ? 'text-green-600' :
                    positionChange.direction === 'down' ? 'text-red-600' :
                    'text-muted-foreground'
                  }`}>
                    {positionChange.direction === 'up' && <TrendingUp className="h-4 w-4" />}
                    {positionChange.direction === 'down' && <TrendingDown className="h-4 w-4" />}
                    {positionChange.direction === 'same' && <Minus className="h-4 w-4" />}
                    <span className="ml-1">
                      {positionChange.value > 0 ? positionChange.value : ''}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Best Position</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold text-green-600">
                {bestPosition || '-'}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Worst Position</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold text-red-600">
                {worstPosition || '-'}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Average Position</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">
                {avgPosition || '-'}
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Position History</CardTitle>
            <CardDescription>
              Google ranking position over time (lower is better)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                <p>No ranking history yet. Run a rank check to start tracking.</p>
              </div>
            ) : (
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      domain={[1, 100]}
                      reversed={true}
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      label={{ 
                        value: 'Position', 
                        angle: -90, 
                        position: 'insideLeft',
                        className: 'text-muted-foreground'
                      }}
                    />
                    <Tooltip 
                      content={({ active, payload }: any) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <div className="bg-background border rounded-lg shadow-lg p-3">
                              <p className="font-medium">{data.fullDate}</p>
                              <p className={data.isUnranked ? 'text-muted-foreground' : 'text-[var(--brand-dark)]'}>
                                Position: {data.displayLabel}
                              </p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <ReferenceLine y={10} stroke="#22c55e" strokeDasharray="5 5" label={{ value: 'Top 10', position: 'right', fill: '#22c55e', fontSize: 12 }} />
                    <ReferenceLine y={20} stroke="#eab308" strokeDasharray="5 5" label={{ value: 'Top 20', position: 'right', fill: '#eab308', fontSize: 12 }} />
                    <Line 
                      type="monotone" 
                      dataKey="position" 
                      stroke="var(--brand-dark)" 
                      strokeWidth={2}
                      dot={{ fill: 'var(--brand-dark)', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: 'var(--brand-dark)' }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Details */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-medium">{combination.location?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Keyword</p>
                <p className="font-medium">{combination.keyword?.keyword || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant="outline">{combination.status}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Checked</p>
                <p className="font-medium">
                  {combination.last_position_check 
                    ? new Date(combination.last_position_check).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Never'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* History Table */}
        {history && history.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Check History</CardTitle>
              <CardDescription>All recorded position checks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Date</th>
                      <th className="text-right py-2 font-medium">Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].reverse().map((h) => (
                      <tr key={h.id} className="border-b">
                        <td className="py-2">
                          {new Date(h.checked_at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="text-right py-2">
                          {h.position ? (
                            <span className={`font-medium ${
                              h.position <= 10 ? 'text-green-600' :
                              h.position <= 20 ? 'text-yellow-600' :
                              ''
                            }`}>
                              {h.position}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">100+</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

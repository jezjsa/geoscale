import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Navigation } from '@/components/Navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

export function TestDataForSEOPage() {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<any>(null)

  const testCredentials = async () => {
    setTesting(true)
    setResult(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        toast.error('No active session')
        setTesting(false)
        return
      }

      const { data, error } = await supabase.functions.invoke('test-dataforseo', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (error) {
        throw error
      }

      setResult(data)

      if (data.success) {
        toast.success('Credentials are working!')
      } else {
        toast.error('Credentials test failed')
      }
    } catch (error: any) {
      console.error('Error testing credentials:', error)
      toast.error('Error testing credentials', {
        description: error.message,
      })
      setResult({
        success: false,
        error: error.message,
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pt-16">
      <Navigation />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Test DataForSEO Credentials</CardTitle>
            <CardDescription>
              Verify that your DataForSEO API credentials are configured correctly in Supabase secrets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This test will check if the <code className="px-1.5 py-0.5 bg-muted rounded text-xs">DATAFORSEO_LOGIN</code> and{' '}
                <code className="px-1.5 py-0.5 bg-muted rounded text-xs">DATAFORSEO_PASSWORD</code> secrets are set correctly.
              </p>

              <Button
                onClick={testCredentials}
                disabled={testing}
                style={{ backgroundColor: 'var(--brand-dark)' }}
                className="hover:opacity-90 text-white w-full"
              >
                {testing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Credentials'
                )}
              </Button>
            </div>

            {result && (
              <div className="mt-6">
                <div
                  className={`p-4 rounded-lg border ${
                    result.success
                      ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                      : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {result.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-2">
                      <p className="font-medium">
                        {result.success ? 'Success!' : 'Failed'}
                      </p>
                      {result.message && (
                        <p className="text-sm">{result.message}</p>
                      )}
                      {result.error && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Error:</p>
                          <p className="text-sm font-mono bg-background/50 p-2 rounded">
                            {result.error}
                          </p>
                        </div>
                      )}
                      {result.diagnosis && (
                        <div className="mt-2 p-3 bg-background/50 rounded">
                          <p className="text-sm font-medium mb-1">Diagnosis:</p>
                          <p className="text-sm">{result.diagnosis}</p>
                        </div>
                      )}
                      {result.testResults && (
                        <div className="mt-3 space-y-1">
                          <p className="text-sm font-medium">Test Results:</p>
                          <div className="text-xs font-mono bg-background/50 p-2 rounded">
                            <div>HTTP Status: {result.testResults.status}</div>
                            <div>Status Code: {result.testResults.statusCode}</div>
                            <div>Status Message: {result.testResults.statusMessage}</div>
                            <div>Keywords Returned: {result.testResults.keywordsReturned}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {!result.success && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">To fix this:</p>
                    <ol className="text-sm space-y-1 list-decimal list-inside">
                      <li>Go to your Supabase project dashboard</li>
                      <li>Navigate to Settings → Edge Functions → Secrets</li>
                      <li>Add or update these secrets:
                        <ul className="ml-6 mt-1 space-y-0.5 list-disc">
                          <li><code className="px-1 py-0.5 bg-background rounded text-xs">DATAFORSEO_LOGIN</code></li>
                          <li><code className="px-1 py-0.5 bg-background rounded text-xs">DATAFORSEO_PASSWORD</code></li>
                        </ul>
                      </li>
                      <li>You can find your credentials at <a href="https://app.dataforseo.com/api-access" target="_blank" rel="noopener noreferrer" className="text-[var(--brand-dark)] hover:underline">https://app.dataforseo.com/api-access</a></li>
                    </ol>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


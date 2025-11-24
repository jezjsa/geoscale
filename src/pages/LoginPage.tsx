import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { resetPassword, type SignInData } from '@/api/auth'
import { toast } from 'sonner'

export function LoginPage() {
  const { signIn, isSigningIn } = useAuth()
  const [formData, setFormData] = useState<SignInData>({
    email: '',
    password: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Normalize email input
    const normalizedFormData = {
      ...formData,
      email: formData.email.trim().toLowerCase(),
      password: formData.password.trim(),
    }

    try {
      signIn(normalizedFormData, {
        onError: (err: any) => {
          console.error('Login error:', err)
          setError(err.message || 'Failed to sign in')
        },
      })
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Failed to sign in')
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsResetting(true)
    setError(null)

    try {
      await resetPassword(resetEmail)
      toast.success('Password reset email sent! Check your inbox.')
      setShowResetPassword(false)
      setResetEmail('')
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email')
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription>Enter your credentials to access your account</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}
            <div>
              <Label htmlFor="email" className="block mb-3">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="password" className="block mb-3">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button 
              type="submit" 
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900" 
              disabled={isSigningIn}
            >
              {isSigningIn ? 'Signing In...' : 'Sign In'}
            </Button>
            {!showResetPassword ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowResetPassword(true)}
                  className="text-sm text-center text-muted-foreground hover:text-primary hover:underline"
                >
                  Forgot your password?
                </button>
                <p className="text-sm text-center text-muted-foreground">
                  Don't have an account?{' '}
                  <a href="/signup" className="text-primary hover:underline">
                    Sign up
                  </a>
                </p>
              </>
            ) : (
              <div className="w-full space-y-4">
                <div>
                  <Label htmlFor="reset-email" className="block mb-2">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={handleResetPassword}
                    className="flex-1"
                    disabled={isResetting}
                  >
                    {isResetting ? 'Sending...' : 'Send Reset Email'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowResetPassword(false)
                      setResetEmail('')
                      setError(null)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}


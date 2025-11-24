import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { resetPassword } from '@/api/auth'
import { toast } from 'sonner'

export function LoginPage() {
  const { user, signIn, loading } = useAuth()
  const navigate = useNavigate()

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, loading, navigate])
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSigningIn(true)

    try {
      const { error: signInError } = await signIn(
        formData.email.trim().toLowerCase(),
        formData.password.trim()
      )
      
      if (signInError) {
        setError(signInError.message || 'Failed to sign in')
        setIsSigningIn(false)
      }
      // Don't navigate here - let the useEffect handle it when user is set
      // This prevents race conditions where we navigate before user is fetched
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Failed to sign in')
      setIsSigningIn(false)
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
                  <Link to="/signup" className="text-primary hover:underline">
                Sign up
                  </Link>
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


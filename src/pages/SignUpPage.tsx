import { useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { signUp, type SignUpData } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { calculatePasswordStrength } from '@/utils/password-strength'

export function SignUpPage() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/signup' })
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  })
  const [error, setError] = useState<string | null>(null)

  const selectedPlan = (search as any)?.plan || 'individual'
  const passwordStrength = calculatePasswordStrength(formData.password)

  const queryClient = useQueryClient()
  
  const signUpMutation = useMutation({
    mutationFn: (data: SignUpData) => signUp(data),
    onSuccess: async (_data) => {
      // Wait for the trigger to complete and session to be established
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Force refetch the user data
      await queryClient.refetchQueries({ queryKey: ['currentUser'] })
      
      // Navigate to dashboard
      navigate({ to: '/dashboard' })
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to sign up')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (passwordStrength.score < 2) {
      setError('Password is too weak. Please use a stronger password.')
      return
    }

    signUpMutation.mutate({
      email: formData.email,
      password: formData.password,
      name: formData.name,
      plan: selectedPlan,
    })
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Create an Account</CardTitle>
          <CardDescription>
            {selectedPlan && `Signing up for ${selectedPlan} plan`}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}
            <div>
              <Label htmlFor="name" className="block mb-3">Company Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Your company name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
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
              {formData.password && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Password strength:</span>
                    <span className={`font-medium ${
                      passwordStrength.score === 0 ? 'text-gray-500' :
                      passwordStrength.score === 1 ? 'text-red-500' :
                      passwordStrength.score === 2 ? 'text-orange-500' :
                      passwordStrength.score === 3 ? 'text-blue-500' :
                      'text-green-500'
                    }`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <Progress 
                    value={(passwordStrength.score / 4) * 100} 
                    className="h-2"
                  />
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button 
              type="submit" 
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900" 
              disabled={signUpMutation.isPending}
            >
              {signUpMutation.isPending ? 'Creating Account...' : 'Sign Up'}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{' '}
              <a href="/login" className="text-primary hover:underline">
                Sign in
              </a>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}


import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { signUp, type SignUpData } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { calculatePasswordStrength } from '@/utils/password-strength'
import { getPlanByName } from '@/lib/plan-service'
import { Plan } from '@/types'

export function SignUpPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [selectedPlanData, setSelectedPlanData] = useState<Plan | null>(null)

  const selectedPlan = searchParams.get('plan') || 'starter'
  const passwordStrength = calculatePasswordStrength(formData.password)

  useEffect(() => {
    async function loadPlan() {
      if (selectedPlan && ['starter', 'pro', 'agency'].includes(selectedPlan)) {
        const plan = await getPlanByName(selectedPlan as 'starter' | 'pro' | 'agency')
        setSelectedPlanData(plan)
      }
    }
    loadPlan()
  }, [selectedPlan])

  const queryClient = useQueryClient()
  
  const signUpMutation = useMutation({
    mutationFn: (data: SignUpData) => signUp(data),
    onSuccess: async (_data) => {
      // Wait for the trigger to complete and session to be established
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Force refetch the user data
      await queryClient.refetchQueries({ queryKey: ['currentUser'] })
      
      // Navigate to dashboard
      navigate('/dashboard')
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

  // Calculate trial end date (7 days from now)
  const trialEndDate = new Date()
  trialEndDate.setDate(trialEndDate.getDate() + 7)
  const formattedTrialEndDate = trialEndDate.toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  })

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Start Your Free Trial</h1>
          <p className="text-muted-foreground">7 days free, then billed monthly</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Selected Plan Card */}
          {selectedPlanData && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#006239]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Your Selected Plan
                  </CardTitle>
                  <Link to="/plans" className="text-sm text-[#006239] hover:underline font-medium">
                    Change Plan
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-[#2d2d2d] rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-xl mb-1 text-white">{selectedPlanData.displayName}</h3>
                      <p className="text-sm text-gray-400">{selectedPlanData.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[#006239]">
                        £{selectedPlanData.basePriceGbp}/mth
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Discount Code Card (Optional - can be added later) */}
          {/* <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 text-[#006239]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Discount Code (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input placeholder="ENTER DISCOUNT CODE" />
                <Button type="button" variant="outline" className="bg-[#006239] text-white hover:bg-[#005030]">
                  Apply
                </Button>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-semibold">Price:</span>
                <span className="text-xl font-bold text-[#006239]">
                  £{selectedPlanData?.basePriceGbp}/mth
                </span>
              </div>
            </CardContent>
          </Card> */}

          {/* Account Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 text-[#006239]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                  {error}
                </div>
              )}
              
              <div>
                <Label htmlFor="name" className="block mb-2">Company Name *</Label>
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
                <Label htmlFor="email" className="block mb-2">Email *</Label>
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
                <Label htmlFor="password" className="block mb-2">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  autoComplete="new-password"
                  required
                />
                {formData.password && (
                  <div className="mt-2 space-y-2">
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
          </Card>

          {/* Submit Button Card */}
          <Card>
            <CardContent className="pt-6">
              <Button 
                type="submit" 
                className="w-full bg-[#006239] hover:bg-[#005030] text-white h-12 text-base font-semibold" 
                disabled={signUpMutation.isPending}
              >
                {signUpMutation.isPending ? 'Creating Account...' : 'Start 7-Day Free Trial'}
              </Button>
              
              <div className="mt-4 text-center space-y-1">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span><strong>7 days free</strong>, then billed monthly</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  No charge until {formattedTrialEndDate}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Sign In Link */}
          <p className="text-sm text-center text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-[#006239] hover:underline font-medium">
              Sign In
            </Link>
          </p>

          {/* Back to Home Link */}
          <p className="text-sm text-center text-muted-foreground">
            <Link to="/" className="text-[#006239] hover:underline font-medium">
              ← Back to Home
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}


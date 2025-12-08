import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Globe, FileText, Target, Plus, Minus, AlertTriangle } from 'lucide-react';
import { PasswordStrengthMeter, isPasswordStrong } from '@/components/PasswordStrengthMeter';
import { Progress } from '@/components/ui/progress';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { getAllPlans } from '@/lib/plan-service';
import { Plan } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function AccountPage() {
  const { user, loading, signOut } = useAuth();
  const { plan, usage, limits, percentUsed, isLoading: planLoading } = usePlanLimits();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [additionalProjects, setAdditionalProjects] = useState(0);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Fetch all plans
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const plans = await getAllPlans();
        setAllPlans(plans);
      } catch (error) {
        console.error('Error fetching plans:', error);
      } finally {
        setPlansLoading(false);
      }
    };
    fetchPlans();
  }, []);

  // Scroll to plan section if hash is #plan
  useEffect(() => {
    if (location.hash === '#plan') {
      // Wait for content to render, then scroll
      setTimeout(() => {
        const planElement = document.getElementById('plan');
        if (planElement) {
          planElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [location.hash, planLoading]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isPasswordStrong(newPassword)) {
      toast.error('Please create a stronger password', {
        description: 'Your password must meet all the requirements shown below.'
      });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error('Failed to update password', { description: error.message });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleCancelPlan = async () => {
    if (!user?.id) return;
    
    setIsCancelling(true);
    try {
      // Remove plan from user (set plan_id to null)
      const { error } = await supabase
        .from('users')
        .update({ plan_id: null })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Your plan has been cancelled');
      setShowCancelDialog(false);
      
      // Sign out and redirect to home
      await signOut();
      navigate('/');
    } catch (error: any) {
      toast.error('Failed to cancel plan', { description: error.message });
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isNearLimit = (percent: number) => percent >= 80;
  const isAtLimit = (percent: number) => percent >= 100;

  // Calculate agency plan pricing (use current plan's price if on agency/agency_pro)
  const agencyPlan = allPlans.find(p => p.name === 'agency');
  const perProjectPrice = plan?.perSitePriceGbp || agencyPlan?.perSitePriceGbp || 25;
  const agencyBasePrice = agencyPlan?.basePriceGbp || 99;
  const currentPlanBasePrice = plan?.basePriceGbp || agencyBasePrice;
  const additionalProjectsCost = additionalProjects * perProjectPrice;
  const newMonthlyTotal = currentPlanBasePrice + additionalProjectsCost;

  return (
    <div className="min-h-screen bg-background pt-16">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Account</h1>
          <p className="text-muted-foreground">
            Manage your account settings and subscription
          </p>
        </div>

        <div className="grid gap-6 max-w-2xl mx-auto">
          {/* Account Details */}
          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Name</Label>
                  <p className="text-foreground font-medium">{user.name || 'Not set'}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Email</Label>
                  <p className="text-foreground font-medium">{user.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <div className="flex-1">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      required
                    />
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                    )}
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isChangingPassword || !isPasswordStrong(newPassword) || newPassword !== confirmPassword}
                    style={{ backgroundColor: 'var(--brand-dark)' }}
                    className="hover:opacity-90 text-white md:w-auto md:mt-6"
                  >
                    {isChangingPassword ? 'Updating...' : 'Update'}
                  </Button>
                </div>
                <PasswordStrengthMeter password={newPassword} />
              </form>
            </CardContent>
          </Card>

          {/* Current Usage */}
          <Card>
            <CardHeader>
              <CardTitle>Current Usage</CardTitle>
              <CardDescription>Your usage on the {plan?.displayName || 'current'} plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {planLoading ? (
                <p className="text-muted-foreground">Loading usage...</p>
              ) : plan ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Websites</span>
                      </div>
                      <span className={`font-medium ${
                        isAtLimit(percentUsed.projects) ? 'text-red-600' : 
                        isNearLimit(percentUsed.projects) ? 'text-orange-600' : 
                        'text-muted-foreground'
                      }`}>
                        {usage.projectCount} / {limits.websiteLimit}
                      </span>
                    </div>
                    <Progress 
                      value={percentUsed.projects} 
                      className={`h-2 ${
                        isAtLimit(percentUsed.projects) ? '[&>div]:bg-red-600' : 
                        isNearLimit(percentUsed.projects) ? '[&>div]:bg-orange-600' : '[&>div]:bg-[var(--brand-dark)]'
                      }`}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Combo Pages</span>
                      </div>
                      <span className={`font-medium ${
                        isAtLimit(percentUsed.combinations) ? 'text-red-600' : 
                        isNearLimit(percentUsed.combinations) ? 'text-orange-600' : 
                        'text-muted-foreground'
                      }`}>
                        {usage.combinationCount} / {limits.combinationPageLimit}
                      </span>
                    </div>
                    <Progress 
                      value={percentUsed.combinations} 
                      className={`h-2 ${
                        isAtLimit(percentUsed.combinations) ? '[&>div]:bg-red-600' : 
                        isNearLimit(percentUsed.combinations) ? '[&>div]:bg-orange-600' : '[&>div]:bg-[var(--brand-dark)]'
                      }`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Position Tracking</span>
                    </div>
                    <span className="font-medium text-muted-foreground">
                      {usage.trackedCount} / {limits.rankTrackingLimit}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">No plan selected</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Plan Selection Cards */}
        <div id="plan" className="mt-12 pt-8 border-t">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Your Plan</h2>
            <p className="text-muted-foreground">
              {plan ? 'Your current plan is highlighted below' : 'Choose a plan to get started'}
            </p>
          </div>

          {plansLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-dark)]"></div>
            </div>
          ) : (
            <div className={`grid gap-6 max-w-3xl mx-auto ${(plan?.name === 'agency' || plan?.name === 'agency_pro') ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
              {allPlans
                .filter((p) => {
                  // If user is on agency plan, show agency and agency_pro
                  if (plan?.name === 'agency') {
                    return p.name === 'agency' || p.name === 'agency_pro';
                  }
                  // If user is on agency_pro plan, show agency_pro only
                  if (plan?.name === 'agency_pro') {
                    return p.name === 'agency_pro';
                  }
                  return true;
                })
                .map((p) => {
                const isCurrentPlan = plan?.name === p.name;
                
                return (
                  <Card 
                    key={p.id}
                    className={`relative transition-all ${
                      isCurrentPlan 
                        ? 'border-[var(--brand-dark)] border-2 shadow-lg' 
                        : 'border-border hover:border-gray-300'
                    }`}
                  >
                    {isCurrentPlan && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="px-3 py-1 rounded-full text-xs font-bold text-white bg-[var(--brand-dark)]">
                          Current Plan
                        </span>
                      </div>
                    )}
                    <CardHeader className="text-center pb-2">
                      <CardTitle className="text-lg">{p.displayName}</CardTitle>
                      <div className="mt-2">
                        <span className="text-3xl font-bold">
                          {p.basePriceGbp === 0 ? 'Free' : `£${p.basePriceGbp}`}
                        </span>
                        {p.basePriceGbp > 0 && <span className="text-muted-foreground">/mth</span>}
                      </div>
                      {p.perSitePriceGbp > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          + £{p.perSitePriceGbp}/site/mth
                        </p>
                      )}
                      {/* Show per-site savings for Agency Pro */}
                      {p.name === 'agency_pro' && plan?.name === 'agency' && (
                        <div className="mt-2 inline-block bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold px-2 py-1 rounded">
                          Save £{((plan.basePriceGbp / plan.websiteLimit) - (p.basePriceGbp / p.websiteLimit)).toFixed(2)}/site
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="pt-2">
                      <ul className="space-y-2 text-sm">
                        {p.features?.slice(0, 4).map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-[var(--brand-dark)]" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      
                      {!isCurrentPlan && (
                        <Button 
                          className="w-full mt-4"
                          variant="outline"
                          disabled
                        >
                          {p.basePriceGbp > (plan?.basePriceGbp || 0) ? 'Upgrade' : 'Downgrade'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {/* Additional Projects Card - Only show for Agency plan users */}
              {(plan?.name === 'agency' || plan?.name === 'agency_pro') && (
                <Card className="border-dashed border-2 border-gray-300 dark:border-gray-600">
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-lg">Add Projects</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Expand your agency capacity
                    </p>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="text-center mb-4">
                      <span className="text-2xl font-bold">£{perProjectPrice}</span>
                      <span className="text-muted-foreground">/project/mth</span>
                    </div>

                    <div className="flex items-center justify-center gap-3 mb-4">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setAdditionalProjects(Math.max(0, additionalProjects - 1))}
                        disabled={additionalProjects === 0}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={additionalProjects}
                        onChange={(e) => setAdditionalProjects(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-16 text-center"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setAdditionalProjects(additionalProjects + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {additionalProjects > 0 && (
                      <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                        <div className="flex justify-between">
                          <span>{plan?.displayName || 'Agency Plan'}</span>
                          <span>£{plan?.basePriceGbp || agencyBasePrice}/mth</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{additionalProjects} extra project{additionalProjects !== 1 ? 's' : ''}</span>
                          <span>£{additionalProjectsCost}/mth</span>
                        </div>
                        <div className="flex justify-between font-bold pt-2 border-t">
                          <span>New Total</span>
                          <span>£{newMonthlyTotal}/mth</span>
                        </div>
                      </div>
                    )}

                    <Button 
                      className="w-full mt-4 text-white hover:opacity-90"
                      style={{ backgroundColor: 'var(--brand-dark)' }}
                      disabled={additionalProjects === 0}
                    >
                      Update Plan
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground mt-8">
            Need help choosing? <a href="mailto:support@geoscale.app" className="text-[var(--brand-dark)] hover:underline">Contact us</a>
          </p>

          {/* Cancel Plan Card */}
          {plan && (
            <Card className="mt-8 max-w-3xl mx-auto border-red-200 dark:border-red-900">
              <CardHeader>
                <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Cancel My Plan
                </CardTitle>
                <CardDescription className="space-y-2">
                  <span className="block">Cancelling your plan will permanently delete all your data held within GeoScale, including all projects, generated content, and settings. This action cannot be undone.</span>
                  <span className="block">Note: Pages already published to WordPress will remain safely on your websites.</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="destructive"
                  onClick={() => setShowCancelDialog(true)}
                >
                  Cancel My Plan
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Are you sure you want to cancel?
            </DialogTitle>
            <DialogDescription className="pt-4">
              This will permanently delete all your data including:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All your projects and websites</li>
                <li>All generated content and pages</li>
                <li>All keyword combinations and rankings</li>
                <li>All settings and configurations</li>
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">Note: Pages already published to WordPress will remain on your websites.</p>
              <p className="mt-2 font-medium text-foreground">This action cannot be undone.</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={isCancelling}
            >
              No, Keep My Plan
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelPlan}
              disabled={isCancelling}
            >
              {isCancelling ? 'Cancelling...' : 'Yes, Cancel My Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

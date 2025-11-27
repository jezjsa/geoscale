import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Globe, FileText, Target } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function AccountPage() {
  const { user, loading } = useAuth();
  const { plan, usage, limits, percentUsed, isLoading: planLoading } = usePlanLimits();
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
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

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Account</h1>
          <p className="text-muted-foreground">
            Manage your account settings and subscription
          </p>
        </div>

        <div className="grid gap-6 max-w-4xl">
          {/* Account Details */}
          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Name</Label>
                <p className="text-foreground font-medium">{user.name || 'Not set'}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Email</Label>
                <p className="text-foreground font-medium">{user.email}</p>
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
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                <div>
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
                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={isChangingPassword}
                  style={{ backgroundColor: 'var(--brand-dark)' }}
                  className="hover:opacity-90 text-white"
                >
                  {isChangingPassword ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Plan Details */}
          <Card>
            <CardHeader>
              <CardTitle>{plan?.displayName || 'No'} Plan</CardTitle>
              <CardDescription>Your current subscription and usage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {planLoading ? (
                <p className="text-muted-foreground">Loading plan details...</p>
              ) : plan ? (
                <>
                  {/* Usage Bars */}
                  <div className="space-y-4">
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
                          <span className="font-medium">Combination Pages</span>
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

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Position Tracking Limit</span>
                        </div>
                        <span className="font-medium text-muted-foreground">
                          {limits.rankTrackingLimit} combinations
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Plan Features */}
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-3">Plan includes:</p>
                    <ul className="space-y-2">
                      {plan.features?.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 bg-[var(--brand-dark)]/20">
                            <Check className="w-3 h-3 text-[var(--brand-dark)]" />
                          </div>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button 
                    asChild 
                    variant="outline"
                    className="border-[var(--brand-dark)] text-[var(--brand-dark)]"
                  >
                    <a href="/plans">View All Plans</a>
                  </Button>
                </>
              ) : (
                <div>
                  <p className="text-muted-foreground mb-4">No plan selected</p>
                  <Button asChild>
                    <a href="/plans">Choose a Plan</a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

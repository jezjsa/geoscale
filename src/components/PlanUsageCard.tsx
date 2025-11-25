import { Link } from 'react-router-dom';
import { ArrowUpRight, Globe, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { usePlanLimits } from '@/hooks/usePlanLimits';

export function PlanUsageCard() {
  const { plan, usage, limits, remaining, percentUsed, isLoading } = usePlanLimits();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plan Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!plan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plan Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">No plan selected</p>
          <Button asChild size="sm">
            <Link to="/plans">Choose a Plan</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isNearLimit = (percent: number) => percent >= 80;
  const isAtLimit = (percent: number) => percent >= 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{plan.displayName} Plan</CardTitle>
            <CardDescription>Your current usage and limits</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/plans">
              Upgrade
              <ArrowUpRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Websites Usage */}
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
              isNearLimit(percentUsed.projects) ? '[&>div]:bg-orange-600' : ''
            }`}
          />
          {remaining.projects === 0 ? (
            <p className="text-xs text-red-600">
              You've reached your website limit. Upgrade to add more.
            </p>
          ) : remaining.projects <= 2 ? (
            <p className="text-xs text-orange-600">
              {remaining.projects} website{remaining.projects !== 1 ? 's' : ''} remaining
            </p>
          ) : null}
        </div>

        {/* Combination Pages Usage */}
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
              isNearLimit(percentUsed.combinations) ? '[&>div]:bg-orange-600' : ''
            }`}
          />
          {remaining.combinations === 0 ? (
            <p className="text-xs text-red-600">
              You've reached your page limit. Upgrade to create more.
            </p>
          ) : remaining.combinations <= 10 ? (
            <p className="text-xs text-orange-600">
              {remaining.combinations} page{remaining.combinations !== 1 ? 's' : ''} remaining
            </p>
          ) : null}
        </div>

        {/* Plan Features Summary */}
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-2">Plan includes:</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• {limits.rankTrackingFrequency === 'daily' ? 'Daily' : 'Weekly'} rank tracking</li>
            <li>• Content generation</li>
            <li>• Bulk meta editing</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

import { Link } from 'react-router-dom';
import { ArrowUpRight, Globe, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { usePlanLimits } from '@/hooks/usePlanLimits';
export function PlanUsageCardCompact() {
  const { plan, usage, limits, percentUsed, isLoading } = usePlanLimits();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Plan</CardTitle>
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
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Plan</CardTitle>
        </CardHeader>
        <CardContent>
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
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{plan.displayName} Plan</CardTitle>
          <Button 
            asChild 
            variant="ghost" 
            size="sm" 
            className="h-7 px-2 text-xs text-white hover:opacity-80 bg-gray-500 dark:bg-transparent dark:border dark:border-gray-500 dark:text-gray-300"
          >
            <Link to="/account#plan">
              Upgrade
              <ArrowUpRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Websites Usage - only show for multi-project plans */}
        {limits.websiteLimit > 1 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm">Websites</span>
              </div>
              <span className={`text-sm ${
                isAtLimit(percentUsed.projects) ? 'text-red-600' : 
                isNearLimit(percentUsed.projects) ? 'text-orange-600' : 
                'text-muted-foreground'
              }`}>
                {usage.projectCount} / {limits.websiteLimit}
              </span>
            </div>
            <Progress 
              value={percentUsed.projects} 
              className={`h-1.5 ${
                isAtLimit(percentUsed.projects) ? '[&>div]:bg-red-600' : 
                isNearLimit(percentUsed.projects) ? '[&>div]:bg-orange-600' : '[&>div]:bg-[var(--brand-dark)]'
              }`}
            />
          </div>
        )}

        {/* Combination Pages Usage */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm">Combinations Generated</span>
            </div>
            <span className={`text-sm ${
              isAtLimit(percentUsed.combinations) ? 'text-red-600' : 
              isNearLimit(percentUsed.combinations) ? 'text-orange-600' : 
              'text-muted-foreground'
            }`}>
              {usage.combinationCount} / {limits.combinationPageLimit}
            </span>
          </div>
          <Progress 
            value={percentUsed.combinations} 
            className={`h-1.5 ${
              isAtLimit(percentUsed.combinations) ? '[&>div]:bg-red-600' : 
              isNearLimit(percentUsed.combinations) ? '[&>div]:bg-orange-600' : '[&>div]:bg-[var(--brand-dark)]'
            }`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

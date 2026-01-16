import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Plan } from '../types';
import { getAllPlans } from '../lib/plan-service';

interface PlansSelectionProps {
  onSelectPlan?: (planName: string) => void;
  showHeader?: boolean;
}

type PlanCategory = 'agency' | 'single';

export default function PlansSelection({ onSelectPlan, showHeader = true }: PlansSelectionProps) {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<PlanCategory>('agency');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const plansData = await getAllPlans();
      setPlans(plansData);
    } catch (err) {
      console.error('Error fetching plans:', err);
      setError('Failed to load plans. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (planName: string) => {
    if (onSelectPlan) {
      onSelectPlan(planName);
    } else {
      navigate(`/sign-up?plan=${planName}`);
    }
  };

  const formatPrice = (plan: Plan) => {
    if (plan.basePriceGbp === 0) return 'Free';
    return `£${plan.basePriceGbp.toFixed(0)}`;
  };

  const formatPriceSuffix = (plan: Plan) => {
    if (plan.basePriceGbp === 0) return '';
    return plan.isOneOff ? ' one-off' : '/mth';
  };

  return (
    <div className="w-full">
      {showHeader && (
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-5xl font-black text-foreground mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Select the perfect plan for your content needs. All plans include our full suite of AI-powered features.
          </p>
        </div>
      )}

      {/* Plan Category Toggle */}
      <div className="flex justify-center mb-10">
        <div className="inline-flex rounded-full p-1 bg-muted">
          <button
            onClick={() => setActiveCategory('agency')}
            className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
              activeCategory === 'agency'
                ? 'bg-[var(--brand-dark)] text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Agency Plans
          </button>
          <button
            onClick={() => setActiveCategory('single')}
            className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
              activeCategory === 'single'
                ? 'bg-[var(--brand-dark)] text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Single Site
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand-dark)]"></div>
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchPlans}
            className="px-6 py-2 text-white rounded-lg font-semibold bg-[var(--brand-dark)] hover:opacity-90"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {plans
            .filter((plan: Plan) => {
              if (activeCategory === 'agency') {
                return plan.name === 'agency' || plan.name === 'agency_pro';
              } else {
                return plan.name === 'starter' || plan.name === 'pro';
              }
            })
            .map((plan: Plan) => {
            // Mark Agency and Pro as popular in their respective categories
            const isPopular = (activeCategory === 'agency' && plan.name === 'agency') || 
                              (activeCategory === 'single' && plan.name === 'pro');
            
            // Calculate per-site savings for Agency Pro
            const agencyPlan = plans.find((p: Plan) => p.name === 'agency');
            const perSiteSavings = plan.name === 'agency_pro' && agencyPlan 
              ? ((agencyPlan.basePriceGbp / agencyPlan.websiteLimit) - (plan.basePriceGbp / plan.websiteLimit)).toFixed(2)
              : null;

            return (
              <div
                key={plan.id}
                className={`bg-card rounded-3xl p-6 sm:p-8 border-4 relative transition-all hover:shadow-xl flex flex-col ${
                  isPopular ? 'border-[var(--brand-dark)] shadow-lg' : 'border-border'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="px-4 py-1 rounded-full text-sm font-bold text-white bg-[var(--brand-dark)]">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-6 rounded-2xl p-4 sm:p-6 bg-muted">
                  <h3 className="text-xl sm:text-2xl font-black text-foreground mb-1">
                    {plan.displayName}
                  </h3>
                  <div className="mb-3">
                    <span className="text-4xl sm:text-5xl font-black text-foreground">
                      {formatPrice(plan)}
                    </span>
                    <span className="text-lg font-medium text-muted-foreground">
                      {formatPriceSuffix(plan)}
                    </span>
                  </div>
                  {plan.perSitePriceGbp > 0 ? (
                    <p className="text-sm text-muted-foreground mb-0">
                      + £{plan.perSitePriceGbp}/site/mth for additional sites
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground mb-0 invisible">
                      &nbsp;
                    </p>
                  )}
                  {/* Fixed height container for savings badge to maintain alignment */}
                  <div className="h-8 flex items-center justify-center">
                    {perSiteSavings && (
                      <div className="inline-block bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold px-2 py-1 rounded">
                        Save £{perSiteSavings}/site
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-center mb-6">
                  <p className="text-foreground min-h-[48px]">
                    {plan.description}
                  </p>
                </div>

                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map((feature: string, featureIndex: number) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 bg-[var(--brand-dark)]/20">
                        <Check className="w-3 h-3 text-[var(--brand-dark)]" />
                      </div>
                      <span className="text-muted-foreground text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  <button
                    onClick={() => navigate('/?highlight=waitlist')}
                    className={`w-full px-6 py-3 rounded-xl font-bold transition-all ${
                      isPopular
                        ? 'bg-[var(--brand-dark)] text-white shadow-lg hover:shadow-xl hover:opacity-90'
                        : 'border-2 border-[var(--brand-dark)] text-[var(--brand-dark)] hover:bg-muted'
                    }`}
                  >
                    Join the Waitlist
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Info Card */}
          <div className="mt-12 max-w-4xl mx-auto">
            <div className="bg-muted/50 rounded-2xl p-8 text-center">
              {activeCategory === 'agency' ? (
                <>
                  <h3 className="text-xl font-bold text-foreground mb-3">
                    Designed for Agencies to Scale Confidently
                  </h3>
                  <p className="text-muted-foreground">
                    We built the Agency plans to give SEO teams a larger tracked-keyword allowance and predictable fixed costs. This lets agencies onboard more clients, grow their local SEO offering, and keep monthly expenses stable – even as their portfolio increases.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-foreground mb-3">
                    Perfect for Individual Websites
                  </h3>
                  <p className="text-muted-foreground">
                    Our Single Site plans are ideal for business owners and freelancers managing one website. Get all the power of GeoScale's AI-driven geo pages without the complexity of multi-site management.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="mt-16 text-center">
            <p className="text-sm text-muted-foreground">
              Need a custom plan or have questions?{' '}
              <a href="mailto:support@geoscale.app" className="font-semibold text-[var(--brand-dark)] hover:underline">
                Contact us
              </a>
            </p>
          </div>
        </>
      )}
    </div>
  );
}

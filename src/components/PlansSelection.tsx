import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Plan } from '../types';
import { getAllPlans } from '../lib/plan-service';

interface PlansSelectionProps {
  onSelectPlan?: (planName: string) => void;
  showHeader?: boolean;
}

export default function PlansSelection({ onSelectPlan, showHeader = true }: PlansSelectionProps) {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planType, setPlanType] = useState<'single-site' | 'agency'>('single-site');

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

  const formatPrice = (price: number) => {
    return price === 0 ? 'Free' : `£${price.toFixed(0)}`;
  };

  // Filter plans based on selected plan type
  const filteredPlans = plans.filter((plan) => {
    if (planType === 'single-site') {
      return plan.websiteLimit === 1;
    } else {
      return plan.websiteLimit > 1;
    }
  });

  return (
    <div className="w-full">
      {showHeader && (
        <div className="text-center mb-16">
          <h1 className="text-3xl sm:text-5xl font-black text-foreground mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Select the perfect plan for your content needs. All plans include our full suite of AI-powered features.
          </p>
        </div>
      )}

      {/* Plan Type Toggle */}
      <div className="flex justify-center mb-12">
        <div className="inline-flex rounded-lg border-2 border-border p-1 bg-muted">
          <button
            onClick={() => setPlanType('single-site')}
            className={`px-6 py-2 rounded-md font-semibold transition-all ${
              planType === 'single-site'
                ? 'bg-[var(--brand-dark)] text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Single Site Plans
          </button>
          <button
            onClick={() => setPlanType('agency')}
            className={`px-6 py-2 rounded-md font-semibold transition-all ${
              planType === 'agency'
                ? 'bg-[var(--brand-dark)] text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Agency Plans
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
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {filteredPlans.map((plan, index) => {
            // For single-site plans, mark Pro (index 1) as popular
            // For agency plans, mark the first one as popular
            const isPopular = planType === 'single-site' ? index === 1 : index === 0;

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
                      {formatPrice(plan.basePriceGbp)}
                      {plan.basePriceGbp > 0 && '/mth'}
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
                </div>

                <div className="text-center mb-6">
                  <p className="text-foreground min-h-[48px]">
                    {plan.description}
                  </p>
                </div>

                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map((feature, featureIndex) => (
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
                    onClick={() => handleSelectPlan(plan.name)}
                    className={`w-full px-6 py-3 rounded-xl font-bold transition-all ${
                      isPopular
                        ? 'bg-[var(--brand-dark)] text-white shadow-lg hover:shadow-xl hover:opacity-90'
                        : 'border-2 border-[var(--brand-dark)] text-[var(--brand-dark)] hover:bg-muted'
                    }`}
                  >
                    Get Started
                  </button>
                  {plan.targetCustomer && (
                    <p className="text-sm text-muted-foreground text-center mt-3">
                      {plan.targetCustomer}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && (
        <div className="mt-16 text-center">
          <p className="text-muted-foreground mb-4">
            All plans include a 7-day free trial. No credit card required.
          </p>
          <p className="text-sm text-muted-foreground">
            Need a custom plan or have questions?{' '}
            <a href="mailto:support@geoscale.app" className="font-semibold text-[var(--brand-dark)] hover:underline">
              Contact us
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

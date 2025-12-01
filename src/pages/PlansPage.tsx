import PlansSelection from '@/components/PlansSelection';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { usePageMeta } from '@/hooks/usePageMeta';

export function PlansPage() {
  usePageMeta({
    title: 'Pricing & Plans - GeoScale',
    description: 'Choose the perfect GeoScale plan for your business. From Starter to Agency, find the right fit for generating location-based landing pages. 7-day free trial included.'
  });

  return (
    <div className="min-h-screen bg-background pt-16">
      <Navigation />
      <div className="container mx-auto px-4 py-12">
        <PlansSelection showHeader={true} />
      </div>

      <Footer />
    </div>
  );
}


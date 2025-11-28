import { Link } from 'react-router-dom';
import PlansSelection from '@/components/PlansSelection';
import { Navigation } from '@/components/Navigation';
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

      {/* Footer */}
      <footer className="border-t mt-20 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2 md:flex-1">
              <img src="/icon.svg" alt="GeoScale" className="h-8 w-8" />
              <span className="text-lg font-bold">GeoScale</span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground md:flex-1 md:justify-center">
              <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
              <Link to="/login" className="hover:text-foreground transition-colors">Sign In</Link>
              <a href="mailto:support@geoscale.app" className="hover:text-foreground transition-colors">Contact</a>
            </div>
            <p className="text-sm text-muted-foreground md:flex-1 md:text-right">
              © {new Date().getFullYear()} GeoScale. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}


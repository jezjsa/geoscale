import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Navigation } from '@/components/Navigation'
import { TypewriterLocations } from '@/components/TypewriterLocations'

export function HomePage() {
  return (
    <div className="min-h-screen bg-background pt-16 md:pt-0">
      <Navigation />
      
      {/* Hero Section */}
      <section className="container mx-auto px-[30px] md:px-4 py-20 text-center">
        <div className="mb-8">
          <TypewriterLocations />
        </div>
        <h1 className="text-3xl md:text-6xl font-bold mb-6 max-w-5xl mx-auto">
          Generate Location-Based Landing Pages at Scale, in Minutes.
        </h1>
        <p className="text-base md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Create dozens or hundreds of SEO-optimized geo landing pages for your WordPress site. 
          Powered by AI and automated for scale.
        </p>
        <Button 
          asChild 
          size="lg"
          style={{ backgroundColor: 'var(--brand-dark)' }}
          className="hover:opacity-90 text-white"
        >
          <Link to="/plans">Start Your 7-Day Free Trial</Link>
        </Button>
        <div className="mt-4">
          <Link 
            to="/plans" 
            className="text-[var(--brand-dark)] hover:underline font-medium"
          >
            View Plans
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="bg-muted/50 rounded-lg p-6 text-center">
            <div className="w-full h-40 bg-muted rounded-lg mb-4 flex items-center justify-center">
              <span className="text-muted-foreground text-sm">Image placeholder</span>
            </div>
            <h3 className="text-xl font-semibold mb-4">Keyword Research</h3>
            <p className="text-muted-foreground">
              Research and discover high-value keywords with search volume data.
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-6 text-center">
            <div className="w-full h-40 bg-muted rounded-lg mb-4 flex items-center justify-center">
              <span className="text-muted-foreground text-sm">Image placeholder</span>
            </div>
            <h3 className="text-xl font-semibold mb-4">Bulk Location Pages</h3>
            <p className="text-muted-foreground">
              Add your target towns and cities to create geo-targeted landing pages at scale in minutes.
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-6 text-center">
            <div className="w-full h-40 bg-muted rounded-lg mb-4 flex items-center justify-center">
              <span className="text-muted-foreground text-sm">Image placeholder</span>
            </div>
            <h3 className="text-xl font-semibold mb-4">Content Generation</h3>
            <p className="text-muted-foreground">
              Generate SEO-optimized landing page content using AI, tailored for each location.
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-6 text-center">
            <div className="w-full h-40 bg-muted rounded-lg mb-4 flex items-center justify-center">
              <span className="text-muted-foreground text-sm">Image placeholder</span>
            </div>
            <h3 className="text-xl font-semibold mb-4">Testimonials & FAQs</h3>
            <p className="text-muted-foreground">
              Your real customer testimonials and service-specific FAQs are woven into every generated page.
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-6 text-center">
            <div className="w-full h-40 bg-muted rounded-lg mb-4 flex items-center justify-center">
              <span className="text-muted-foreground text-sm">Image placeholder</span>
            </div>
            <h3 className="text-xl font-semibold mb-4">Position Tracking*</h3>
            <p className="text-muted-foreground">
              Monitor your Google search rankings for each location page and track performance over time.
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-6 text-center">
            <div className="w-full h-40 bg-muted rounded-lg mb-4 flex items-center justify-center">
              <span className="text-muted-foreground text-sm">Image placeholder</span>
            </div>
            <h3 className="text-xl font-semibold mb-4">WordPress Integration</h3>
            <p className="text-muted-foreground">
              Automatically publish pages directly to your WordPress site. No manual copying or pasting required.
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground text-center mt-8">
          * Position tracking limits vary by plan. See our <Link to="/plans" className="text-[var(--brand-dark)] hover:underline">pricing page</Link> for details.
        </p>
      </section>

      {/* Agency Section */}
      <section className="bg-muted/50 py-24">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Built for Agencies</h2>
          <p className="text-xl text-muted-foreground mb-6 max-w-3xl mx-auto">
            Manage multiple client websites from one powerful dashboard. Create location pages for all your clients and track their search positions with ease — all from a single system.
          </p>
          <Button 
            asChild 
            size="lg"
            style={{ backgroundColor: 'var(--brand-dark)' }}
            className="hover:opacity-90 text-white"
          >
            <Link to="/plans">View Agency Plan</Link>
          </Button>
        </div>
      </section>

      {/* FAQs Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">How does the 7-day free trial work?</h3>
              <p className="text-muted-foreground">
                Start using GeoScale immediately with full access to all features. No credit card required. After 7 days, choose a plan that fits your needs.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">Do I need technical knowledge to use GeoScale?</h3>
              <p className="text-muted-foreground">
                No technical skills required. Simply add your services and locations, and our AI generates SEO-optimized content that publishes directly to your WordPress site.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">How many landing pages can I create?</h3>
              <p className="text-muted-foreground">
                It depends on your plan. Starter includes 50 pages, Pro includes 400 pages, and Agency includes up to 4,000 pages across multiple websites.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">Does GeoScale work with any WordPress site?</h3>
              <p className="text-muted-foreground">
                Yes! GeoScale integrates with any self-hosted WordPress site. Simply install our plugin and connect your site to start publishing pages automatically.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">How does position tracking work?</h3>
              <p className="text-muted-foreground">
                GeoScale monitors your Google search rankings for your location pages. You choose which keyword/location combinations to track. Starter plans include 10 tracked combinations, Pro includes 50, and Agency includes 500. Tracking frequency is weekly for Starter and daily for Pro and Agency plans.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 mt-12 text-center bg-muted/50 rounded-lg">
        <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
        <p className="text-muted-foreground mb-8">
          Choose a plan that fits your needs and start generating landing pages today.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Button 
            asChild 
            size="lg"
            style={{ backgroundColor: 'var(--brand-dark)' }}
            className="hover:opacity-90 text-white"
          >
            <Link to="/plans">Start Your 7-Day Free Trial</Link>
          </Button>
          <Button 
            asChild 
            variant="outline"
            size="lg"
            className="border-[var(--brand-dark)] text-[var(--brand-dark)] bg-transparent hover:bg-[var(--brand-dark)]/10"
          >
            <Link to="/plans">View Plans</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-20 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2 md:flex-1">
              <img src="/icon.svg" alt="GeoScale" className="h-8 w-8" />
              <span className="text-lg font-bold">GeoScale</span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground md:flex-1 md:justify-center">
              <Link to="/plans" className="hover:text-foreground transition-colors">Plans</Link>
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
  )
}


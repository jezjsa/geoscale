import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { TypewriterLocations } from '@/components/TypewriterLocations'
import { usePageMeta } from '@/hooks/usePageMeta'

export function HomePage() {
  usePageMeta({
    title: 'GeoScale - Generate Location Landing Pages at Scale',
    description: 'Create SEO-optimized geo-targeted landing pages in minutes. AI-powered content generation with one-click WordPress publishing. Start your free trial today.'
  })

  return (
    <div className="min-h-screen bg-background pt-16">
      <Navigation />
      
      {/* Hero Section */}
      <section 
        className="container mx-auto px-[30px] md:px-4 py-20 text-center bg-center bg-no-repeat">
        <div className="mb-8">
          <TypewriterLocations />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wider text-[var(--brand-dark)] mb-4">SEO Agencies</p>
        <h1 className="text-3xl md:text-6xl font-bold mb-6 max-w-5xl mx-auto">
          Generate, Manage and Track <br /> Local SEO Landing Pages at Scale for Multiple WP Websites
        </h1>
        <p className="text-base md:text-xl text-muted-foreground mb-8 max-w-4xl mx-auto">
          Instantly create local seo pages, publish to WordPress in one click, and track organic rankings and Google Map Pack visibility across every town and suburb you target, for all your clients from one single dashboard.
        </p>
        <Button 
          asChild 
          size="lg"
          style={{ backgroundColor: 'var(--brand-dark)' }}
          className="hover:opacity-90 text-white"
        >
          <Link to="/plans">Start Your 14-Day Free Trial</Link>
        </Button>
        <div className="mt-4">
          <Link 
            to="/plans" 
            className="text-[var(--brand-dark)] hover:underline font-medium"
          >
            Rank Tracking & Map Pack Credits included
          </Link>
        </div>
      </section>

      {/* Demo Video Section */}
      <section className="container mx-auto px-4 pt-4 pb-16">
        <div className="max-w-10xl mx-auto">
          <div 
            className="rounded-4xl border-8 overflow-hidden aspect-video flex items-center justify-center bg-muted"
            style={{ borderColor: '#fff' }}
          >
            <img src="/app.png" alt="GeoScale App" className="w-full h-full " />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-5 gap-6 max-w-7xl mx-auto">
          <div className="bg-muted/50 rounded-lg p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--brand-dark)] text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">
              1
            </div>
            <h3 className="text-xl font-semibold mb-2">Input</h3>
            <p className="text-muted-foreground">
              Add your locations and keywords to create combinations.
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--brand-dark)] text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">
              2
            </div>
            <h3 className="text-xl font-semibold mb-2">Generate</h3>
            <p className="text-muted-foreground">
              GeoScale creates unique, SEO friendly content automatically.
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--brand-dark)] text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">
              3
            </div>
            <h3 className="text-xl font-semibold mb-2">Publish</h3>
            <p className="text-muted-foreground">
              Push the content directly into your WordPress site with one click.
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--brand-dark)] text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">
              4
            </div>
            <h3 className="text-xl font-semibold mb-2">Track</h3>
            <p className="text-muted-foreground">
              Monitor Google rankings, changes and improvements over time.
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--brand-dark)] text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">
              5
            </div>
            <h3 className="text-xl font-semibold mb-2">Refresh</h3>
            <p className="text-muted-foreground">
              Regenerate and republish content whenever you need.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="bg-muted/50 rounded-lg p-6 text-center">
            <div className="w-full bg-muted rounded-lg mb-4 flex items-center justify-center overflow-hidden">
              <img src="/keywords.png" alt="Keyword Research" className="w-full h-full object-cover" />
            </div>
            <h3 className="text-xl font-semibold mb-4">Keyword Research</h3>
            <p className="text-muted-foreground">
              Research and discover high-value keywords with search volume data.
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-6 text-center">
            <div className="w-full bg-muted rounded-lg mb-4 flex items-center justify-center">
              <img src="/bulk.png" alt="Bulk Location Pages" className="w-full h-full object-cover" />
            </div>
            <h3 className="text-xl font-semibold mb-4">Bulk Location Pages</h3>
            <p className="text-muted-foreground">
              Add your target towns to create geo-targeted landing pages in minutes.
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-6 text-center">
            <div className="w-full bg-muted rounded-lg mb-4 flex items-center justify-center">
              <img src="/content.png" alt="Content Generation" className="w-full h-full object-cover" />
            </div>
            <h3 className="text-xl font-semibold mb-4">Content Generation</h3>
            <p className="text-muted-foreground">
              Generate SEO-optimized landing page content, tailored for each location.
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-6 text-center">
            <div className="w-full bg-muted rounded-lg mb-4 flex items-center justify-center">
              <img src="/comments.png" alt="Testimonials & FAQs" className="w-full h-full object-cover" />
            </div>
            <h3 className="text-xl font-semibold mb-4">Testimonials & FAQs</h3>
            <p className="text-muted-foreground">
              Your real customer testimonials and service-specific FAQs are woven into every generated page.
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-6 text-center">
            <div className="w-full bg-muted rounded-lg mb-4 flex items-center justify-center">
              <img src="/ranking.png" alt="Position Tracking" className="w-full h-full object-cover" />
            </div>
            <h3 className="text-xl font-semibold mb-4">Position Tracking*</h3>
            <p className="text-muted-foreground">
              Monitor your Google search rankings for each location page and track performance over time.
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-6 text-center">
            <div className="w-full bg-muted rounded-lg mb-4 flex items-center justify-center">
              <img src="/wordpress.png" alt="WordPress Integration" className="w-full h-full object-cover" />
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
            Manage multiple client websites from one powerful dashboard. Create location pages for all your clients and track their search positions with ease — all from a single system, with instant push to WordPress.
          </p>
          <Button 
            asChild 
            size="lg"
            style={{ backgroundColor: 'var(--brand-dark)' }}
            className="hover:opacity-90 text-white"
          >
            <Link to="/plans">View Agency Plan</Link>
          </Button>
          <p className="mt-6 text-white font-bold">
            Input → Generate → Publish → Track
          </p>
        </div>
      </section>

      {/* FAQs Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">How does the 14-day free trial work?</h3>
              <p className="text-muted-foreground">
                Start using GeoScale immediately with full access to all features. Enter your card details at signup – you won't be charged for 14 days and can cancel anytime during the trial.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">How many client websites can I manage?</h3>
              <p className="text-muted-foreground">
                Our Agency Base plan supports up to 10 client websites, while Agency Pro supports up to 25. Each website gets 400 geo-landing pages. Need more? Additional websites can be added for £20/site/month.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">Do my clients need GeoScale accounts?</h3>
              <p className="text-muted-foreground">
                No. You manage everything from your single agency dashboard. Connect each client's WordPress site, generate their pages, and publish directly – all without your clients needing to log in anywhere.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">Can I update content after publishing?</h3>
              <p className="text-muted-foreground">
                Absolutely! Edit content in GeoScale at any time and republish to WordPress with one click. This makes it easy to refresh pages regularly across all your client sites, which can help improve SEO rankings.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">Does GeoScale work with any WordPress site?</h3>
              <p className="text-muted-foreground">
                Yes! GeoScale integrates with any self-hosted WordPress site. Install our plugin, generate a unique API key in your project settings, and enter it in WordPress to connect. Once linked, you can publish pages automatically.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">Can I manage meta titles and descriptions for existing pages?</h3>
              <p className="text-muted-foreground">
                Yes! Once connected, GeoScale pulls in all pages from your client's WordPress site. You can then edit meta titles and descriptions for every page – not just the geo-landing pages you create with GeoScale. It's a complete on-page SEO management tool.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">How does keyword rank tracking work?</h3>
              <p className="text-muted-foreground">
                GeoScale monitors Google search rankings for your clients' location pages. Pro plans include 50 daily rank checks, Agency Base includes 300, and Agency Pro includes 650. Rankings update every other day, so you can report on performance without additional rank tracking tools.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">What are Google Map Pack credits?</h3>
              <p className="text-muted-foreground">
                Map Pack credits are used for our local ranking heat map feature, which shows where your business appears in Google's Map Pack across different locations. Each scan uses credits based on grid size: 5×5 grid = 1 credit, 7×7 = 2 credits, 10×10 = 4 credits, 15×15 = 9 credits. Pro gets 2 credits/month, Agency Base gets 10, and Agency Pro gets 50. Need more? Additional credits are available for £0.20 each.
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
            <Link to="/plans">Start Your 14-Day Free Trial</Link>
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

      <Footer />
    </div>
  )
}


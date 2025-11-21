import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold mb-6">
          Generate Location-Based Landing Pages with AI
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Create dozens or hundreds of SEO-optimized geo landing pages for your WordPress site. 
          Powered by AI and automated for scale.
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild size="lg">
            <Link to="/plans">View Plans</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/login">Sign In</Link>
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-4">Keyword Research</h3>
            <p className="text-muted-foreground">
              Research and discover high-value keywords using DataForSEO integration.
            </p>
          </div>
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-4">Location Discovery</h3>
            <p className="text-muted-foreground">
              Automatically find nearby towns and cities using Google Places API.
            </p>
          </div>
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-4">AI Content Generation</h3>
            <p className="text-muted-foreground">
              Generate SEO-optimized landing page content using OpenAI GPT.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center bg-muted/50 rounded-lg">
        <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
        <p className="text-muted-foreground mb-8">
          Choose a plan that fits your needs and start generating landing pages today.
        </p>
        <Button asChild size="lg">
          <Link to="/plans">View Plans</Link>
        </Button>
      </section>
    </div>
  )
}


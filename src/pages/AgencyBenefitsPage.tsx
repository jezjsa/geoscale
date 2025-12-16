import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'

interface BenefitCardProps {
  title: string
  description: string
  imagePlaceholder?: string
  imagePosition?: 'left' | 'right'
  bgColor?: 'white' | 'grey'
}

function BenefitCard({ title, description, imagePlaceholder, imagePosition = 'right', bgColor = 'white' }: BenefitCardProps) {
  const bgClass = bgColor === 'grey' ? 'bg-[#f5f5f7] dark:bg-[#1c1c1e]' : 'bg-white dark:bg-background'
  
  return (
    <section className={`${bgClass} py-20 px-6`}>
      <div className="max-w-6xl mx-auto">
        <div className={`flex flex-col ${imagePosition === 'left' ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12`}>
          {/* Text Content */}
          <div className="flex-1 text-center lg:text-left">
            <h2 className="text-4xl md:text-5xl font-bold text-[#1d1d1f] dark:text-white tracking-tight mb-6">
              {title}
            </h2>
            <p className="text-xl md:text-2xl text-[#86868b] dark:text-gray-400 leading-relaxed max-w-xl">
              {description}
            </p>
          </div>
          
          {/* Image Placeholder */}
          <div className="flex-1 w-full">
            <div className="bg-[#e8e8ed] dark:bg-[#2c2c2e] rounded-3xl aspect-video flex items-center justify-center min-h-[300px] lg:min-h-[400px]">
              {imagePlaceholder ? (
                <img 
                  src={imagePlaceholder} 
                  alt={title}
                  className="w-full h-full object-cover rounded-3xl"
                />
              ) : (
                <span className="text-[#86868b] dark:text-gray-500 text-lg">Screenshot placeholder</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function AgencyBenefitsPage() {
  const benefits = [
    {
      title: "Scale Local SEO Effortlessly",
      description: "Generate hundreds of location-specific landing pages in minutes, not weeks. Perfect for agencies managing multiple client campaigns.",
      imagePosition: 'right' as const,
      bgColor: 'white' as const,
    },
    {
      title: "White-Label Ready",
      description: "Manage multiple client websites from one powerful dashboard. No GeoScale branding visible to your clients.",
      imagePosition: 'left' as const,
      bgColor: 'grey' as const,
    },
    {
      title: "AI-Powered Content Generation",
      description: "Unique, SEO-optimised content for every location and keyword combination. No duplicate content penalties.",
      imagePosition: 'right' as const,
      bgColor: 'white' as const,
    },
    {
      title: "Heat Map Rank Tracking",
      description: "Visual grid-based ranking analysis across geographic areas. Instantly identify weak spots and opportunities for your clients.",
      imagePosition: 'left' as const,
      bgColor: 'grey' as const,
    },
    {
      title: "One-Click WordPress Publishing",
      description: "Push generated content directly to client WordPress sites. No manual copying, no formatting issues.",
      imagePosition: 'right' as const,
      bgColor: 'white' as const,
    },
    {
      title: "Suburb & Town Targeting",
      description: "Automatically discover and target nearby suburbs to dominate local search results across entire regions.",
      imagePosition: 'left' as const,
      bgColor: 'grey' as const,
    },
    {
      title: "Bulk Operations",
      description: "Generate, optimise, and publish content in bulk across all your client projects. Maximum efficiency, minimum effort.",
      imagePosition: 'right' as const,
      bgColor: 'white' as const,
    },
    {
      title: "Built for Agency Growth",
      description: "Track rankings, monitor content status, and manage unlimited projects. Everything you need to scale your agency.",
      imagePosition: 'left' as const,
      bgColor: 'grey' as const,
    },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-background pt-16">
      <Navigation />
      {/* Hero Section */}
      <section className="bg-white dark:bg-background pt-20 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-[#1d1d1f] dark:text-white tracking-tight mb-6">
            Built for SEO Agencies
          </h1>
          <p className="text-xl md:text-2xl text-[#86868b] dark:text-gray-400 mb-10 max-w-2xl mx-auto">
            Scale your local SEO services. Deliver results faster. Grow your agency.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              asChild
              size="lg"
              className="bg-[var(--brand-dark)] hover:bg-[var(--brand-light)] text-white rounded-full px-8 py-6 text-lg font-medium"
            >
              <Link to="/register">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button 
              asChild
              variant="outline"
              size="lg"
              className="rounded-full px-8 py-6 text-lg font-medium border-2"
            >
              <Link to="/plans">
                View Plans
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Benefit Cards */}
      {benefits.map((benefit, index) => (
        <BenefitCard
          key={index}
          title={benefit.title}
          description={benefit.description}
          imagePosition={benefit.imagePosition}
          bgColor={benefit.bgColor}
        />
      ))}

      {/* CTA Section */}
      <section className="bg-[var(--brand-dark)] py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-6">
            Ready to scale your agency?
          </h2>
          <p className="text-xl text-white/70 mb-10">
            Join agencies already using GeoScale to deliver exceptional local SEO results.
          </p>
          <Button 
            asChild
            size="lg"
            className="bg-white hover:bg-gray-100 text-[var(--brand-dark)] rounded-full px-10 py-6 text-lg font-medium"
          >
            <Link to="/register">
              Get Started Today
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      <div className="[&_footer]:mt-0">
        <Footer />
      </div>
    </div>
  )
}

import { Navigation } from '../components/Navigation';
import { Footer } from '../components/Footer';

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: 01/12/2024</p>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
              <p className="text-muted-foreground mb-4">
                GeoScale ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.
              </p>
              <p className="text-muted-foreground">
                Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
              <p className="text-muted-foreground mb-4">We collect information that you provide directly to us:</p>
              
              <h3 className="text-xl font-semibold mb-3">Account Information</h3>
              <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
                <li>Email address</li>
                <li>Name</li>
                <li>Password (encrypted)</li>
                <li>Subscription and billing information</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3">Project Data</h3>
              <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
                <li>WordPress website URLs and API credentials</li>
                <li>Business/company name</li>
                <li>Contact information (name, email, phone number, website URL)</li>
                <li>Service descriptions</li>
                <li>Location data (place names, coordinates)</li>
                <li>Keywords and search volume data</li>
                <li>Generated page content</li>
                <li>Testimonials you add to your projects</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3">Usage Data</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>API usage logs</li>
                <li>Content generation history</li>
                <li>Search ranking position data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
              <p className="text-muted-foreground mb-4">We use the information we collect to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Generate SEO-optimised content for your websites</li>
                <li>Publish content to your WordPress sites</li>
                <li>Track search engine rankings for your pages</li>
                <li>Process payments and manage subscriptions</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments, questions, and requests</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Third-Party Services</h2>
              <p className="text-muted-foreground mb-4">We use the following third-party services to operate GeoScale:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>Supabase</strong> - Database and authentication services</li>
                <li><strong>Stripe</strong> - Payment processing</li>
                <li><strong>OpenAI</strong> - AI content generation</li>
                <li><strong>DataForSEO</strong> - Keyword research and rank tracking</li>
                <li><strong>Google Places API</strong> - Location data</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Each of these services has their own privacy policy governing their use of your data.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
              <p className="text-muted-foreground mb-4">
                We implement appropriate technical and organisational security measures to protect your personal information. This includes:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure authentication via Supabase</li>
                <li>Row-level security policies on our database</li>
                <li>Regular security reviews</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your personal information for as long as your account is active or as needed to provide you services. If you wish to cancel your account or request that we no longer use your information, please contact us at <a href="mailto:support@geoscale.app" className="text-[var(--brand-dark)] hover:underline">support@geoscale.app</a>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Your Rights</h2>
              <p className="text-muted-foreground mb-4">You have the right to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to processing of your data</li>
                <li>Request data portability</li>
                <li>Withdraw consent at any time</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                To exercise any of these rights, please contact us at <a href="mailto:support@geoscale.app" className="text-[var(--brand-dark)] hover:underline">support@geoscale.app</a>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Cookies</h2>
              <p className="text-muted-foreground">
                We use essential cookies to maintain your session and preferences. We do not use tracking or advertising cookies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this privacy policy from time to time. We will notify you of any changes by posting the new privacy policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">10. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have any questions about this Privacy Policy, please contact us at:<br />
                <a href="mailto:support@geoscale.app" className="text-[var(--brand-dark)] hover:underline">support@geoscale.app</a>
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

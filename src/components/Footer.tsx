import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t mt-20 py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 md:flex-1">
            <img src="/icon.svg" alt="GeoScale" className="h-8 w-8" />
            <span className="text-lg font-bold">GeoScale</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground md:flex-1 md:justify-center flex-wrap">
            <Link to="/plans" className="hover:text-foreground transition-colors">Plans</Link>
            <Link to="/login" className="hover:text-foreground transition-colors">Sign In</Link>
            <a href="mailto:support@geoscale.app" className="hover:text-foreground transition-colors">Contact</a>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link>
          </div>
          <p className="text-sm text-muted-foreground md:flex-1 md:text-right">
            © {new Date().getFullYear()} GeoScale. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

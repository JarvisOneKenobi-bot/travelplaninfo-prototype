import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">
      <div className="w-full px-6 lg:px-12 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <p className="text-white font-bold text-lg mb-2">TravelPlanInfo</p>
            <p className="text-sm text-gray-400">
              Expert itineraries, hidden gems, and deals for every kind of traveler.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <p className="text-white font-semibold text-sm mb-3 uppercase tracking-widest">Explore</p>
            <nav className="flex flex-col gap-2 text-sm">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <Link href="/destinations" className="hover:text-white transition-colors">Destinations</Link>
              <Link href="/hot-deals" className="hover:text-white transition-colors">Hot Deals</Link>
              <Link href="/planner" className="hover:text-white transition-colors">Trip Planner</Link>
              <Link href="/guides" className="hover:text-white transition-colors">Travel Guides</Link>
            </nav>
          </div>

          {/* Legal */}
          <div>
            <p className="text-white font-semibold text-sm mb-3 uppercase tracking-widest">Legal</p>
            <nav className="flex flex-col gap-2 text-sm">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            </nav>
          </div>
        </div>

        {/* Affiliate disclosure */}
        <div className="border-t border-gray-700 pt-6 space-y-2">
          <p className="text-xs text-gray-500">
            <strong className="text-gray-400">Affiliate Disclosure:</strong> TravelPlanInfo participates in affiliate programs including CJ Affiliate and Travelpayouts. When you click links to Hotels.com, Vrbo, CruiseDirect, Aviasales, or other partner sites and make a purchase, we may earn a commission at no extra cost to you. This helps us keep the site free and our recommendations honest.
          </p>
          <p className="text-xs text-gray-600">
            © {year} TravelPlanInfo. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

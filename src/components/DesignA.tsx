import Link from "next/link";

import LatestGuides from "@/components/LatestGuides";
import CuratedItineraries from "@/components/CuratedItineraries";
import { DEALS, getAffiliateUrl } from "@/config/affiliates";

const destinations = [
  { slug: "miami", name: "Miami Beach", country: "Florida, USA", desc: "Sun-soaked beaches, Art Deco architecture, and vibrant nightlife await.", emoji: "🌴" },
  { slug: "cancun", name: "Cancún", country: "Mexico", desc: "Crystal-clear waters, ancient Mayan ruins, and all-inclusive resorts.", emoji: "🏖️" },
  { slug: "new-york", name: "New York City", country: "New York, USA", desc: "The city that never sleeps — culture, food, and iconic skylines.", emoji: "🗽" },
];

export default function DesignA() {
  return (
    <div className="space-y-10">
      {/* Featured Destinations */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-bold text-gray-900">Featured Destinations</h2>
          <Link href="/destinations" className="text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {destinations.map((d) => (
            <div key={d.name} className="rounded-2xl overflow-hidden border border-gray-100 hover:shadow-md transition-shadow">
              {/* Image placeholder */}
              <div className="h-44 bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center text-6xl">
                {d.emoji}
              </div>
              <div className="p-6">
                <span className="text-xs font-medium bg-orange-100 text-orange-700 px-3 py-1 rounded-full">{d.country}</span>
                <h3 className="text-lg font-bold text-gray-900 mt-3 mb-1">{d.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{d.desc}</p>
                <Link
                  href={`/destinations#${d.slug}`}
                  className="text-sm font-medium text-gray-900 hover:text-orange-600 transition-colors"
                >
                  Explore →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hot Deals */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-bold text-gray-900">🔥 Hot Deals</h2>
          <Link href="/hot-deals" className="text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors">
            View all →
          </Link>
        </div>
        <div className="space-y-3">
          {DEALS.slice(0, 3).map((deal) => (
            <a
              key={deal.id}
              href={getAffiliateUrl(deal)}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="flex items-center justify-between p-6 rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50/30 transition-colors"
            >
              <div>
                <p className="font-medium text-gray-900">{deal.title}</p>
                <p className="text-sm text-gray-500">{deal.subtitle}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium bg-green-100 text-green-700 px-3 py-1 rounded-full">{deal.savings}</span>
                <span className="text-lg font-bold text-gray-900">{deal.price}</span>
                <span className="text-sm font-medium bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors">
                  {deal.cta}
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>

      <CuratedItineraries />

      <LatestGuides />
    </div>
  );
}

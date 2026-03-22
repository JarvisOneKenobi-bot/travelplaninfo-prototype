"use client";

import Header from "@/components/Header";
import HelpButton from "@/components/HelpButton";
import Link from "next/link";
import { DEALS, getAffiliateUrl, CJ_LINKS } from "@/config/affiliates";
import NewsletterForm from "@/components/NewsletterForm";

export default function HotDeals() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="w-full px-6 lg:px-12 py-8 space-y-8">

        {/* ── HERO SECTION ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Col 1 — Hero copy + stats */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-teal-800 font-medium mb-4">
                Live Deal Feed &nbsp;·&nbsp; Hotels · Vacation Rentals · Car Rentals · Cruises
              </p>
              <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
                Curated travel deals from trusted partners — book & save.
              </h1>
              <p className="text-base text-gray-600 mb-6">
                Compare hotels on Hotels.com, vacation rentals on Vrbo, car rentals on EconomyBookings, and cruise deals on CruiseDirect. Every booking supports TravelPlanInfo.
              </p>
              <div className="flex gap-3 flex-wrap">
                <a href={CJ_LINKS.hotels()} target="_blank" rel="noopener noreferrer sponsored" className="bg-teal-700 text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-teal-800 transition-colors inline-block">
                  🏨 Hotels.com Deals
                </a>
                <a href={CJ_LINKS.vrbo()} target="_blank" rel="noopener noreferrer sponsored" className="bg-blue-600 text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-blue-700 transition-colors inline-block">
                  🏡 Vrbo Rentals
                </a>
                <a href={CJ_LINKS.cars()} target="_blank" rel="noopener noreferrer sponsored" className="bg-emerald-600 text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-emerald-700 transition-colors inline-block">
                  🚗 Car Rentals
                </a>
                <a href={CJ_LINKS.cruises()} target="_blank" rel="noopener noreferrer sponsored" className="bg-orange-600 text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-orange-700 transition-colors inline-block">
                  🚢 CruiseDirect
                </a>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 border-t border-gray-300 pt-5 mt-8">
              {[
                { label: "HOTELS", value: "From $79/night", icon: "🏨" },
                { label: "RENTALS", value: "From $129/night", icon: "🏡" },
                { label: "CAR RENTALS", value: "From $19/day", icon: "🚗" },
                { label: "CRUISES", value: "From $199/person", icon: "🚢" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{s.icon} {s.label}</p>
                  <p className="text-sm font-bold text-gray-900">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Col 2 — Featured deal card */}
          <div className="lg:col-span-4">
            <a href={CJ_LINKS.cruises()} target="_blank" rel="noopener noreferrer sponsored" className="block bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
              <p className="text-xs uppercase tracking-widest text-orange-500 font-medium mb-2">
                🔥 Featured Deal
              </p>
              <h2 className="text-xl font-bold text-gray-900">
                Caribbean Cruise from Miami
              </h2>
              <p className="text-sm text-gray-500 mt-1">CruiseDirect · 5-night all-inclusive from Port Everglades</p>
              <p className="text-3xl font-bold text-orange-600 mt-3">$349</p>
              <p className="text-sm text-gray-500 mt-1">Includes meals, entertainment & port stops at Nassau + Cozumel</p>
              <div className="flex gap-3 mt-5">
                <span className="flex-1 bg-orange-600 text-white text-sm font-medium py-3 rounded-lg text-center">
                  View on CruiseDirect →
                </span>
              </div>
            </a>

            {/* All 6 deals list */}
            <div className="mt-4 space-y-2">
              {DEALS.map((d) => (
                <a
                  key={d.id}
                  href={getAffiliateUrl(d)}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="block px-4 py-3 rounded-lg text-sm text-gray-800 bg-orange-50/60 hover:bg-orange-100 transition-colors"
                >
                  <span className="text-gray-500 font-normal">
                    {d.program === "hotels" ? "🏨" : d.program === "vrbo" ? "🏡" : "🚢"}
                  </span>{" "}
                  <span className="font-medium">{d.title}</span>
                  <span className="text-gray-400 ml-2">— {d.price}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Col 3 — Program cards */}
          <div className="lg:col-span-3 space-y-4">
            <a href={CJ_LINKS.hotels()} target="_blank" rel="noopener noreferrer sponsored" className="block bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-xs uppercase tracking-widest text-teal-600 mb-2">🏨 Hotels.com</p>
              <h3 className="text-lg font-bold text-gray-900 leading-snug">Late-night hotel deals</h3>
              <p className="text-sm text-gray-600 mt-1">Up to 45% off Miami Beach stays tonight.</p>
              <span className="mt-3 px-4 py-2 text-sm text-white rounded-lg bg-teal-700 inline-block">View rates</span>
            </a>
            <a href={CJ_LINKS.vrbo()} target="_blank" rel="noopener noreferrer sponsored" className="block bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-xs uppercase tracking-widest text-blue-600 mb-2">🏡 Vrbo</p>
              <h3 className="text-lg font-bold text-gray-900 leading-snug">Entire home rentals</h3>
              <p className="text-sm text-gray-600 mt-1">Perfect for families & groups. Free cancellation.</p>
              <span className="mt-3 px-4 py-2 text-sm text-white rounded-lg bg-blue-600 inline-block">Browse homes</span>
            </a>
            <a href={CJ_LINKS.cruisesLastMinute()} target="_blank" rel="noopener noreferrer sponsored" className="block bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-xs uppercase tracking-widest text-orange-500 mb-2">🚢 CruiseDirect</p>
              <h3 className="text-lg font-bold text-gray-900 leading-snug">Last minute cruise deals</h3>
              <p className="text-sm text-gray-600 mt-1">Best price guarantee. No booking fees. Limited inventory.</p>
              <span className="mt-3 px-4 py-2 text-sm text-white rounded-lg bg-orange-600 inline-block">Grab a deal</span>
            </a>
            <a href={CJ_LINKS.cars()} target="_blank" rel="noopener noreferrer sponsored" className="block bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-xs uppercase tracking-widest text-emerald-600 mb-2">🚗 EconomyBookings</p>
              <h3 className="text-lg font-bold text-gray-900 leading-snug">Car rentals — all brands compared</h3>
              <p className="text-sm text-gray-600 mt-1">500+ suppliers. Best price guarantee. Free cancellation.</p>
              <span className="mt-3 px-4 py-2 text-sm text-white rounded-lg bg-emerald-600 inline-block">Compare cars</span>
            </a>
          </div>
        </div>

        {/* ── BOTTOM SECTION ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* All deals grid */}
          <div className="md:col-span-2 bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">All Deals</h2>
            <div className="grid grid-cols-2 gap-4">
              {DEALS.map((deal) => (
                <a
                  key={deal.id}
                  href={getAffiliateUrl(deal)}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="block p-5 rounded-xl border border-gray-100 hover:border-orange-200 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{deal.savings}</span>
                    <span className="text-lg font-bold text-gray-900">{deal.price}</span>
                  </div>
                  <p className="font-medium text-gray-900 text-sm">{deal.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{deal.subtitle}</p>
                  <span className="text-xs font-medium text-orange-600 mt-2 inline-block">{deal.cta} →</span>
                </a>
              ))}
            </div>
          </div>

          {/* Sidebar — guides + deal alert */}
          <div className="space-y-6">
            {/* TODO: Link planning guides once articles are created:
              "48-hour Miami itinerary (design district + Wynwood)"
              "What to pack for Miami in spring"
              "Top 8 beaches within 30 minutes of FLL"
              "Miami on a budget: food, transit, stays"
              These are high-SEO content targets — create as /guides/[slug] articles.
            */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Planning Guides</h2>
              <p className="text-sm text-gray-500 mb-4">Destination-specific guides coming soon.</p>
              <Link
                href="/guides"
                className="block w-full text-center bg-teal-700 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-teal-800 transition-colors"
              >
                Browse All Guides →
              </Link>
            </div>

            <div className="bg-teal-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-white">Deal Alerts</h2>
              <p className="text-teal-100 text-sm mt-2">
                Weekly flight + hotel bundles with price-drop alerts.
              </p>
              <div className="mt-4">
                <NewsletterForm source="hot-deals" />
              </div>
              <p className="text-xs text-teal-300 mt-2">No spam. Unsubscribe anytime.</p>
            </div>
          </div>
        </div>

        {/* Disclosure */}
        <p className="text-xs text-gray-400 text-center pt-4 border-t border-gray-200">
          TravelPlanInfo earns a commission when you book through our partner links. This helps us keep the site free. Prices shown are estimates and may vary.
        </p>

      </main>
      <HelpButton pageId="hot-deals" />
    </div>
  );
}

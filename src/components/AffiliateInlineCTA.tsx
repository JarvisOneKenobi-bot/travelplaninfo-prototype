"use client";

import { CJ_LINKS } from "@/config/affiliates";

export default function AffiliateInlineCTA() {
  return (
    <div className="my-8 p-6 rounded-2xl bg-gradient-to-r from-orange-50 to-teal-50 border border-orange-200">
      <p className="text-xs uppercase tracking-wider text-orange-600 font-medium mb-2">Recommended</p>
      <h3 className="text-lg font-bold text-gray-900 mb-1">Ready to book your trip?</h3>
      <p className="text-sm text-gray-600 mb-4">
        Compare deals from our trusted partners — every booking supports TravelPlanInfo.
      </p>
      <div className="flex flex-wrap gap-3">
        <a
          href={CJ_LINKS.hotels()}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-flex items-center gap-2 bg-teal-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-teal-800 transition-colors"
        >
          🏨 Hotels from $79
        </a>
        <a
          href={CJ_LINKS.vrbo()}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
        >
          🏡 Vacation Rentals
        </a>
        <a
          href={CJ_LINKS.cruises()}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-flex items-center gap-2 bg-orange-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-orange-700 transition-colors"
        >
          🚢 Cruise Deals
        </a>
      </div>
    </div>
  );
}

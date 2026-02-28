"use client";

import { DEALS, getAffiliateUrl } from "@/config/affiliates";

export default function AffiliateSidebar() {
  return (
    <aside className="space-y-4">
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Travel Deals</h3>
      {DEALS.slice(0, 3).map((deal) => (
        <a
          key={deal.id}
          href={getAffiliateUrl(deal.program)}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="block p-4 rounded-xl border border-gray-100 hover:border-orange-200 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              {deal.savings}
            </span>
            <span className="text-lg font-bold text-gray-900">{deal.price}</span>
          </div>
          <p className="text-sm font-medium text-gray-900">{deal.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{deal.subtitle}</p>
          <span className="text-xs font-medium text-orange-600 mt-2 inline-block">{deal.cta} →</span>
        </a>
      ))}

      <div className="p-4 rounded-xl bg-teal-800 text-white">
        <p className="text-sm font-bold">📧 Deal Alerts</p>
        <p className="text-xs text-teal-200 mt-1">Get weekly price drops on flights, hotels & cruises.</p>
        <input
          type="email"
          placeholder="you@email.com"
          className="w-full mt-3 px-3 py-2 rounded-lg text-sm bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <button className="w-full mt-2 bg-orange-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-orange-700 transition-colors">
          Subscribe
        </button>
      </div>

      <p className="text-[10px] text-gray-400 leading-snug">
        We earn a commission when you book through our links. This supports TravelPlanInfo at no extra cost to you.
      </p>
    </aside>
  );
}

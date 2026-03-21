"use client";

import { DEALS, CJ_BANNERS, getAffiliateUrl } from "@/config/affiliates";

export default function AffiliateSidebar() {
  return (
    <aside className="space-y-4">
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Travel Deals</h3>
      {DEALS.slice(0, 3).map((deal) => (
        <a
          key={deal.id}
          href={getAffiliateUrl(deal)}
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

      {/* 300×60 CJ strip banners */}
      {CJ_BANNERS.map((banner) => (
        <a
          key={banner.id}
          href={banner.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="flex items-center justify-between w-full h-[60px] px-4 rounded-lg overflow-hidden hover:opacity-90 hover:shadow-md transition-all"
          style={{ background: `linear-gradient(135deg, ${banner.bgFrom}, ${banner.bgTo})` }}
          aria-label={`${banner.advertiser} — ${banner.headline}`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-70" style={{ color: banner.textColor }}>
              {banner.advertiser}
            </p>
            <p className="text-sm font-bold leading-tight truncate" style={{ color: banner.textColor }}>
              {banner.headline}
            </p>
          </div>
          <span
            className="ml-3 text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap shrink-0"
            style={{ backgroundColor: banner.ctaColor, color: banner.ctaText }}
          >
            {banner.cta} →
          </span>
        </a>
      ))}

<p className="text-[10px] text-gray-400 leading-snug">
        We earn a commission when you book through our links. This supports TravelPlanInfo at no extra cost to you.
      </p>
    </aside>
  );
}

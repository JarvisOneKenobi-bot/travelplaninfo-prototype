"use client";

import { DEALS, CJ_BANNERS, getAffiliateUrl } from "@/config/affiliates";
import NewsletterForm from "@/components/NewsletterForm";

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

      {/* 300×250 CJ banner units */}
      {CJ_BANNERS.map((banner) => (
        <a
          key={banner.id}
          href={banner.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="block w-[300px] h-[250px] mx-auto rounded-xl overflow-hidden hover:opacity-95 hover:shadow-lg transition-all relative"
          style={{ background: `linear-gradient(135deg, ${banner.bgFrom}, ${banner.bgTo})` }}
          aria-label={`${banner.advertiser} — ${banner.headline}`}
        >
          <div className="flex flex-col justify-between h-full p-5">
            <div>
              <p
                className="text-xs font-bold uppercase tracking-widest mb-3 opacity-80"
                style={{ color: banner.textColor }}
              >
                {banner.advertiser}
              </p>
              <p
                className="text-xl font-extrabold leading-tight"
                style={{ color: banner.textColor }}
              >
                {banner.headline}
              </p>
              <p
                className="text-sm mt-2 opacity-80"
                style={{ color: banner.textColor }}
              >
                {banner.subline}
              </p>
            </div>
            <span
              className="inline-block text-sm font-bold px-5 py-2.5 rounded-full self-start"
              style={{ backgroundColor: banner.ctaColor, color: banner.ctaText }}
            >
              {banner.cta} →
            </span>
          </div>
        </a>
      ))}

      <div className="p-4 rounded-xl bg-teal-800 text-white">
        <p className="text-sm font-bold">📧 Deal Alerts</p>
        <p className="text-xs text-teal-200 mt-1">Get weekly price drops on flights, hotels & cruises.</p>
        <div className="mt-3">
          <NewsletterForm source="sidebar" />
        </div>
      </div>

      <p className="text-[10px] text-gray-400 leading-snug">
        We earn a commission when you book through our links. This supports TravelPlanInfo at no extra cost to you.
      </p>
    </aside>
  );
}

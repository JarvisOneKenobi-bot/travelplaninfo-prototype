"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { DEALS, getAffiliateUrl, type AffiliateDeal } from "@/config/affiliates";
import { useTranslations } from "next-intl";

const CRUISE_DEAL_IDS = ["cruisedirect-caribbean", "cruisedirect-bahamas"];
const VISIBLE = 4;
const GAP_PX = 12;

interface Props {
  origin?: string;
  interests: string[];
  budget: string;
}

function scoreDeal(deal: AffiliateDeal, interests: string[], budget: string): number {
  let score = 0;
  if (interests.includes("cruise") && deal.program === "cruises") score += 10;
  if (budget === "budget" && deal.program === "cars") score += 3;
  if (budget === "luxury" && (deal.program === "hotels" || deal.program === "vrbo")) score += 3;
  if (interests.includes("beach") && deal.id.includes("miami")) score += 2;
  if (interests.includes("beach") && deal.id.includes("cancun")) score += 2;
  if (interests.includes("city") && deal.id.includes("nyc")) score += 2;
  if (interests.includes("romance") && deal.program === "cruises") score += 2;
  if (interests.includes("family") && deal.program === "cruises") score += 1;
  if (CRUISE_DEAL_IDS.includes(deal.id)) score += 1;
  return score;
}

const programColors: Record<string, string> = {
  hotels: "bg-red-50 text-red-700 border-red-200",
  vrbo: "bg-blue-50 text-blue-700 border-blue-200",
  cruises: "bg-teal-50 text-teal-700 border-teal-200",
  cars: "bg-amber-50 text-amber-700 border-amber-200",
};

const programLabels: Record<string, string> = {
  hotels: "Hotels.com",
  vrbo: "Vrbo",
  cruises: "CruiseDirect",
  cars: "EconomyBookings",
};

export default function PackageDealsCarousel({ origin, interests, budget }: Props) {
  const t = useTranslations("tripForm");
  const [offset, setOffset] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const sortedDeals = useMemo(
    () => [...DEALS]
      .map(deal => ({ deal, score: scoreDeal(deal, interests, budget) }))
      .sort((a, b) => b.score - a.score)
      .map(d => d.deal),
    [interests, budget]
  );

  const total = sortedDeals.length;
  const canSlide = total > VISIBLE;
  const maxOffset = Math.max(0, total - VISIBLE);

  const next = useCallback(() => {
    setOffset(prev => (prev >= maxOffset ? 0 : prev + 1));
  }, [maxOffset]);

  const prev = useCallback(() => {
    setOffset(prev => (prev <= 0 ? maxOffset : prev - 1));
  }, [maxOffset]);

  // Auto-advance every 5 seconds, pause on hover
  useEffect(() => {
    if (paused || !canSlide) return;
    timerRef.current = setInterval(next, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, next, canSlide]);

  // Reset on deal reorder
  useEffect(() => { setOffset(0); }, [sortedDeals]);

  if (total === 0) return null;

  // Each card width = (container - gaps) / VISIBLE
  // translateX per offset step = one card width + one gap
  const cardWidthCalc = `calc((100% - ${(VISIBLE - 1) * GAP_PX}px) / ${VISIBLE})`;
  const shiftCalc = `calc(${offset} * ((100% - ${(VISIBLE - 1) * GAP_PX}px) / ${VISIBLE} + ${GAP_PX}px))`;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{t("packageDeals")}</h3>

      <div className="relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}>

        {canSlide && (
          <button type="button" onClick={prev}
            className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full border border-gray-300 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors text-sm shadow-sm">
            ←
          </button>
        )}

        <div className="overflow-hidden mx-4">
          <div ref={trackRef}
            className="flex transition-transform duration-500 ease-in-out"
            style={{ gap: `${GAP_PX}px`, transform: `translateX(-${shiftCalc})` }}>
            {sortedDeals.map(deal => (
              <a key={deal.id}
                href={getAffiliateUrl(deal)}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="flex-none rounded-xl border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all p-4 space-y-2 bg-white"
                style={{ width: cardWidthCalc }}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${programColors[deal.program] || ''}`}>
                    {programLabels[deal.program]}
                  </span>
                  <span className="text-xs text-green-600 font-medium">{deal.savings}</span>
                </div>
                <h4 className="text-sm font-semibold text-gray-900 leading-tight">{deal.title}</h4>
                <p className="text-xs text-gray-500 line-clamp-2">{deal.subtitle}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-lg font-bold text-orange-600">{deal.price}</span>
                  <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">
                    {deal.cta} →
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>

        {canSlide && (
          <button type="button" onClick={next}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full border border-gray-300 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors text-sm shadow-sm">
            →
          </button>
        )}
      </div>

      {/* Dots */}
      {canSlide && (
        <div className="flex justify-center gap-1.5 pt-1">
          {Array.from({ length: maxOffset + 1 }, (_, i) => (
            <button key={i} type="button" onClick={() => setOffset(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === offset ? 'bg-orange-500' : 'bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Page ${i + 1}`} />
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400">{t("packageDealsDesc")}</p>
    </div>
  );
}

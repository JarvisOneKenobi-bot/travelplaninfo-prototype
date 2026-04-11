"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import AtlasHeroSection from "./AtlasHeroSection";

interface Destination {
  name: string;
  airline: string;
  flightPrice: string;
  hotelPrice?: string;
  nonstop: boolean;
  link?: string;   // TP API booking URL — preserved so Phase 2 can render a "Book" CTA
}

interface SurpriseMeSectionProps {
  originCode: string;
  vibesSummary: string;
  budgetLabel: string;
}

const V1_FALLBACK: Destination[] = [
  { name: "Cancún, Mexico", airline: "Spirit NK", flightPrice: "$127", hotelPrice: "$89/night", nonstop: true },
  { name: "San Juan, Puerto Rico", airline: "JetBlue", flightPrice: "$159", hotelPrice: "$95/night", nonstop: true },
  { name: "Punta Cana, DR", airline: "Spirit NK", flightPrice: "$189", hotelPrice: "$75/night", nonstop: true },
];

export default function SurpriseMeSection({
  originCode,
  vibesSummary,
  budgetLabel,
}: SurpriseMeSectionProps) {
  const t = useTranslations("atlasHero");
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const origin = originCode === "???" ? "MIA" : originCode;
    fetch(`/api/surprise-me?origin=${encodeURIComponent(origin)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        if (Array.isArray(data?.destinations) && data.destinations.length > 0) {
          setDestinations(data.destinations);
        } else {
          setDestinations(V1_FALLBACK);
        }
      })
      .catch(() => setDestinations(V1_FALLBACK))
      .finally(() => setLoading(false));
  }, [originCode]);

  function handleTellMeMore(index: number) {
    const dest = destinations[index];
    if (dest) {
      window.dispatchEvent(
        new CustomEvent("atlas-open", {
          detail: { message: `Tell me more about ${dest.name} as a destination for my trip` },
        })
      );
    }
  }

  function handleShowDifferent() {
    window.dispatchEvent(
      new CustomEvent("atlas-open", {
        detail: { message: "Show me different destination options for my trip" },
      })
    );
  }

  function handleChatWithAtlas() {
    window.dispatchEvent(new CustomEvent("atlas-open", { detail: {} }));
  }

  return (
    <div className="space-y-6">
      {loading ? (
        /* Loading skeleton — 3 placeholder cards */
        <div className="rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-6 animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-orange-200" />
            <div className="space-y-2">
              <div className="h-4 w-48 bg-orange-200 rounded" />
              <div className="h-3 w-64 bg-orange-100 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="h-3 w-20 bg-gray-200 rounded mb-2" />
                <div className="h-5 w-36 bg-gray-300 rounded mb-2" />
                <div className="h-3 w-28 bg-gray-200 rounded mb-1" />
                <div className="h-3 w-24 bg-gray-100 rounded mb-4" />
                <div className="h-8 w-full bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <AtlasHeroSection
          destinations={destinations}
          originCode={originCode}
          vibesSummary={vibesSummary}
          budgetLabel={budgetLabel}
          onTellMeMore={handleTellMeMore}
          onShowDifferent={handleShowDifferent}
          onChatWithAtlas={handleChatWithAtlas}
        />
      )}

      {/* Dimmed planner placeholder */}
      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center">
        <div className="text-5xl mb-4">📋</div>
        <p className="text-gray-400 text-sm">{t("dimmedPlanner")}</p>
      </div>
    </div>
  );
}

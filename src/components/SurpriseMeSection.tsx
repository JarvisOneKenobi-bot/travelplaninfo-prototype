"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import AtlasHeroSection from "./AtlasHeroSection";
import PlannerErrorBanner from "./PlannerErrorBanner";

interface Destination {
  name: string;
  airline: string;
  flightPrice: string;
  hotelPrice?: string;
  nonstop: boolean;
  link?: string;   // TP API booking URL — preserved so Phase 2 can render a "Book" CTA
}

interface SurpriseMeSectionProps {
  tripId: number;
  originCode: string;
  vibesSummary: string;
  budgetLabel: string;
  flexibleWindow?: string | null;  // "next_2_weeks" | "next_month" | "2_3_months" | etc.
  tripLength?: string | null;      // "weekend" | "week" | "10_14_days" | "2_weeks" | etc.
  startDate?: string | null;       // ISO date if specific dates were set
}

const V1_FALLBACK: Destination[] = [
  { name: "Cancún, Mexico", airline: "Spirit NK", flightPrice: "$127", hotelPrice: "$89/night", nonstop: true },
  { name: "San Juan, Puerto Rico", airline: "JetBlue", flightPrice: "$159", hotelPrice: "$95/night", nonstop: true },
  { name: "Punta Cana, DR", airline: "Spirit NK", flightPrice: "$189", hotelPrice: "$75/night", nonstop: true },
];

// Convert flexible_window value to a YYYY-MM departure month
function deriveDepartMonth(
  flexibleWindow?: string | null,
  startDate?: string | null,
): string {
  // Specific start date takes priority
  if (startDate) return startDate.slice(0, 7); // "2026-05-15" → "2026-05"

  const now = new Date();
  switch (flexibleWindow) {
    case "next_2_weeks": {
      const d = new Date(now); d.setDate(d.getDate() + 14);
      return d.toISOString().slice(0, 7);
    }
    case "next_month": {
      const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return d.toISOString().slice(0, 7);
    }
    case "2_3_months": {
      const d = new Date(now.getFullYear(), now.getMonth() + 2, 1);
      return d.toISOString().slice(0, 7);
    }
    case "6_months": {
      const d = new Date(now.getFullYear(), now.getMonth() + 6, 1);
      return d.toISOString().slice(0, 7);
    }
    default: {
      // "anytime" or unknown → next month
      const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return d.toISOString().slice(0, 7);
    }
  }
}

export default function SurpriseMeSection({
  tripId,
  originCode,
  vibesSummary,
  budgetLabel,
  flexibleWindow,
  tripLength,
  startDate,
}: SurpriseMeSectionProps) {
  const t = useTranslations("atlasHero");
  const router = useRouter();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [originUnknown, setOriginUnknown] = useState(false);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (originCode === "???") {
      setOriginUnknown(true);
      setLoading(false);
      return;
    }
    setOriginUnknown(false);
    fetchSuggestions();
  }, [originCode, vibesSummary, flexibleWindow, startDate, tripLength]);

  function fetchSuggestions() {
    setLoading(true);
    setFallbackUsed(false);
    setFetchError(null);

    const departMonth = deriveDepartMonth(flexibleWindow, startDate);
    const params = new URLSearchParams({ origin: originCode, depart_month: departMonth });
    if (tripLength) params.set("trip_length", tripLength);
    if (vibesSummary) {
      const vibesParam = vibesSummary
        .split(/\s*\+\s*/).map((v) => v.trim().toLowerCase()).filter(Boolean).join(",");
      if (vibesParam) params.set("vibes", vibesParam);
    }

    fetch(`/api/surprise-me?${params.toString()}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data) => {
        if (Array.isArray(data?.destinations) && data.destinations.length > 0) {
          setDestinations(data.destinations);
        } else {
          setDestinations(V1_FALLBACK);
          setFallbackUsed(true);
        }
      })
      .catch((e) => {
        setDestinations(V1_FALLBACK);
        setFallbackUsed(true);
        setFetchError(String(e));
      })
      .finally(() => setLoading(false));
  }

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

  async function handleResolveDestination(index: number) {
    const dest = destinations[index];
    if (!dest) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/resolve-surprise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: dest.name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setResolveError((err as { error?: string }).error || 'Could not resolve destination');
        setResolving(false);
        return;
      }
      // Locale-aware navigation: typed router honors localePrefix='as-needed'.
      router.push(`/planner/${tripId}`);
      router.refresh();
    } catch {
      setResolveError('Network error');
      setResolving(false);
    }
  }

  if (originUnknown) {
    return (
      <div className="space-y-6" data-testid="surprise-me-section">
        <div data-testid="origin-needed-prompt" className="rounded-xl border-2 border-orange-200 bg-orange-50 p-6">
          <p className="font-medium text-orange-900">{t("originNeededTitle")}</p>
          <p className="text-sm text-orange-800 mt-1">{t("originNeededBody")}</p>
          <a href="/planner" className="inline-block mt-3 text-sm font-medium underline">Set origin →</a>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="surprise-me-section" className="space-y-6">
      {resolveError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {resolveError}
          <button onClick={() => setResolveError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}
      {fallbackUsed && (
        <PlannerErrorBanner
          testId="surprise-fallback-banner"
          title={t("fallbackTitle")}
          body={t("fallbackBody")}
          onRetry={fetchSuggestions}
        />
      )}
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
          onResolveDestination={resolving ? undefined : handleResolveDestination}
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

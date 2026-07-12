"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { buildSurpriseQuery } from "@/lib/atlas/surprise-query";
import AtlasHeroSection from "./AtlasHeroSection";
import PlannerErrorBanner from "./PlannerErrorBanner";

interface Destination {
  name: string;
  airline: string;
  flightPrice: string;
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
  const [degradedReason, setDegradedReason] = useState<string | null>(null);

  const fetchSuggestions = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setDegradedReason(null);

    const params = buildSurpriseQuery({ originCode, vibesSummary, flexibleWindow, tripLength, startDate });

    return fetch(`/api/surprise-me?${params.toString()}`, { signal })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data) => {
        if (Array.isArray(data?.destinations) && data.destinations.length > 0) {
          setDestinations(data.destinations);
          setDegradedReason(null);
        } else {
          setDestinations([]);
          setDegradedReason(data?.degraded?.reason ?? t("degradedNetworkBody"));
        }
      })
      .catch((e) => {
        if ((e as { name?: string })?.name === "AbortError") return;
        console.warn("[SurpriseMeSection] fetch failed", e);
        setDestinations([]);
        setDegradedReason(t("degradedNetworkBody"));
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, [originCode, vibesSummary, flexibleWindow, startDate, tripLength, t]);

  useEffect(() => {
    if (originCode === "???") {
      setOriginUnknown(true);
      setLoading(false);
      return;
    }
    setOriginUnknown(false);
    const controller = new AbortController();
    fetchSuggestions(controller.signal);
    return () => controller.abort();
  }, [originCode, fetchSuggestions]);

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
          <Link href="/planner" className="inline-block mt-3 text-sm font-medium underline">{t("setOriginCta")}</Link>
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
      ) : degradedReason ? (
        <div className="space-y-4">
          <PlannerErrorBanner
            testId="surprise-fallback-banner"
            title={t("degradedTitle")}
            body={degradedReason}
            onRetry={() => fetchSuggestions()}
          />
          <button
            type="button"
            onClick={handleChatWithAtlas}
            className="inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
          >
            {t("chatWithAtlas")}
          </button>
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

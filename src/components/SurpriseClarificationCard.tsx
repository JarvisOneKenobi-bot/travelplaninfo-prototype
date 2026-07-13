"use client";

import { useTranslations } from "next-intl";
import { CANONICAL_VIBES, type CanonicalVibe } from "@/lib/trip-types";
import type { PreflightResult } from "@/lib/atlas/vibe-preflight";

type NonOkPreflight = Exclude<PreflightResult, { status: "ok" }>;

interface SurpriseClarificationCardProps {
  preflight: NonOkPreflight;
  vibes: string[];
  onMatchAny: () => void;
  onUseSuggestion: (vibe: string) => void;
  onUseKnownOnly: () => void;
  onAskAtlas: () => void;
}

const CANONICAL = new Set<string>(CANONICAL_VIBES);

export default function SurpriseClarificationCard({
  preflight,
  vibes,
  onMatchAny,
  onUseSuggestion,
  onUseKnownOnly,
  onAskAtlas,
}: SurpriseClarificationCardProps) {
  const t = useTranslations("atlasHero");
  const tv = useTranslations("tripForm.vibes");

  // Canonical vibes get their localized label; a user's free-text wish is
  // echoed back in their own words.
  const label = (vibe: string) => (CANONICAL.has(vibe) ? tv(vibe as CanonicalVibe) : vibe);

  const isUnknown = preflight.status === "unknown_vibes";
  const unknown = isUnknown ? preflight.unknown : [];
  const suggestions = isUnknown ? preflight.suggestions : [];
  const known = vibes.filter((vibe) => !unknown.includes(vibe));
  const vibesLabel = vibes.map(label).join(" · ");
  const knownLabel = known.map(label).join(" · ");

  const actionClass =
    "inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors";
  const chipClass =
    "px-3 py-1.5 rounded-full border-2 border-orange-300 bg-white text-sm font-medium text-orange-800 hover:border-orange-500 transition-colors";

  return (
    <div
      data-testid="surprise-clarification-card"
      className="rounded-xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-6 space-y-4"
    >
      {isUnknown ? (
        <div>
          <p className="font-bold text-lg text-orange-950">{t("clarifyUnknownTitle")}</p>
          <p className="text-sm text-orange-900 mt-1">
            {t("clarifyUnknownBody", { vibes: unknown.join(", ") })}
          </p>
        </div>
      ) : (
        <div>
          <p className="font-bold text-lg text-orange-950">{t("clarifyImpossibleTitle")}</p>
          <p className="text-sm text-orange-900 mt-1">
            {t("clarifyImpossibleBody", { vibes: vibesLabel, count: preflight.wouldMatchIfAny })}
          </p>
        </div>
      )}

      {isUnknown && suggestions.length > 0 && (
        <div>
          <p className="text-sm font-medium text-orange-900 mb-2">{t("clarifySuggestionsLead")}</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                data-testid="clarify-suggestion"
                onClick={() => onUseSuggestion(suggestion)}
                className={chipClass}
              >
                {label(suggestion)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {!isUnknown && (
          <button type="button" data-testid="clarify-match-any" onClick={onMatchAny} className={actionClass}>
            {t("clarifyMatchAny", { count: preflight.wouldMatchIfAny })}
          </button>
        )}
        {isUnknown && known.length > 0 && (
          <button type="button" data-testid="clarify-use-known" onClick={onUseKnownOnly} className={actionClass}>
            {t("clarifyUseKnown", { vibes: knownLabel })}
          </button>
        )}
        <button
          type="button"
          data-testid="clarify-ask-atlas"
          onClick={onAskAtlas}
          className="inline-flex items-center rounded-lg border-2 border-orange-600 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100 transition-colors"
        >
          {t("clarifyAskAtlas")}
        </button>
      </div>

    </div>
  );
}

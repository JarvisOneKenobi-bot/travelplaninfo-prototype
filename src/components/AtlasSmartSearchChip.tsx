"use client";

import { useTranslations } from "next-intl";

interface AtlasSmartSearchChipProps {
  destination: string;
  onConsent: () => void;
  onDecline: () => void;
}

export default function AtlasSmartSearchChip({ destination, onConsent, onDecline }: AtlasSmartSearchChipProps) {
  const t = useTranslations("atlasSmartSearch");
  return (
    <div
      data-testid="atlas-smart-search-chip"
      className="rounded-xl border border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-4 flex items-center gap-3 shadow-sm"
      role="region"
      aria-label={t("ariaLabel")}
    >
      <div className="text-2xl" aria-hidden>🤖</div>
      <div className="flex-1 text-sm text-orange-900">
        {t("prompt", { destination })}
      </div>
      <button
        onClick={onConsent}
        data-testid="atlas-smart-search-start"
        className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-700"
      >
        {t("start")}
      </button>
      <button
        onClick={onDecline}
        data-testid="atlas-smart-search-decline"
        className="text-orange-700 px-2 py-1.5 text-sm hover:underline"
      >
        {t("notYet")}
      </button>
    </div>
  );
}

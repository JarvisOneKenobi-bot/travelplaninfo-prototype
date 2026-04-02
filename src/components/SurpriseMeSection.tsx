"use client";

import { useTranslations } from "next-intl";
import AtlasHeroSection from "./AtlasHeroSection";

interface Destination {
  name: string;
  airline: string;
  flightPrice: string;
  hotelPrice: string;
  nonstop: boolean;
}

interface SurpriseMeSectionProps {
  destinations: Destination[];
  originCode: string;
  vibesSummary: string;
  budgetLabel: string;
}

export default function SurpriseMeSection({
  destinations,
  originCode,
  vibesSummary,
  budgetLabel,
}: SurpriseMeSectionProps) {
  const t = useTranslations("atlasHero");

  function handleTellMeMore(index: number) {
    // Dispatch event to open Atlas chat with destination context
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
      <AtlasHeroSection
        destinations={destinations}
        originCode={originCode}
        vibesSummary={vibesSummary}
        budgetLabel={budgetLabel}
        onTellMeMore={handleTellMeMore}
        onShowDifferent={handleShowDifferent}
        onChatWithAtlas={handleChatWithAtlas}
      />

      {/* Dimmed planner placeholder */}
      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center">
        <div className="text-5xl mb-4">📋</div>
        <p className="text-gray-400 text-sm">{t("dimmedPlanner")}</p>
      </div>
    </div>
  );
}

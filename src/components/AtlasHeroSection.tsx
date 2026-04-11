"use client";

import { useTranslations } from "next-intl";
import DestinationCard from "./DestinationCard";

interface Destination {
  name: string;
  airline: string;
  flightPrice: string;
  hotelPrice?: string;
  nonstop: boolean;
}

interface AtlasHeroSectionProps {
  destinations: Destination[];
  originCode: string;
  vibesSummary: string;
  budgetLabel: string;
  onTellMeMore: (index: number) => void;
  onShowDifferent: () => void;
  onChatWithAtlas: () => void;
}

export default function AtlasHeroSection({
  destinations,
  originCode,
  vibesSummary,
  budgetLabel,
  onTellMeMore,
  onShowDifferent,
  onChatWithAtlas,
}: AtlasHeroSectionProps) {
  const t = useTranslations("atlasHero");

  return (
    <div className="rounded-xl border-2 border-orange-400 bg-gradient-to-br from-orange-50 to-amber-50 p-6">
      {/* Header row */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-sm">
          {"\uD83C\uDF0D"}
        </div>
        <div>
          <p className="font-bold text-lg">
            {t("title", { count: destinations.length })}
          </p>
          <p className="text-sm text-orange-800">
            {t("subtitle", {
              vibes: vibesSummary,
              origin: originCode,
              budget: budgetLabel,
            })}
          </p>
        </div>
      </div>

      {/* Destination cards row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {destinations.map((dest, i) => (
          <DestinationCard
            key={i}
            destination={dest.name}
            airline={dest.airline}
            flightPrice={dest.flightPrice}
            hotelPrice={dest.hotelPrice}
            nonstop={dest.nonstop}
            isTopPick={i === 0}
            onTellMeMore={() => onTellMeMore(i)}
          />
        ))}
      </div>

      {/* Footer links */}
      <div className="mt-4 text-center">
        <button
          onClick={onShowDifferent}
          className="text-xs text-orange-800 underline cursor-pointer hover:text-orange-600"
        >
          {"\uD83D\uDD04"} {t("showDifferent")}
        </button>
        <span className="text-xs text-orange-800 mx-2">|</span>
        <button
          onClick={onChatWithAtlas}
          className="text-xs text-orange-800 underline cursor-pointer hover:text-orange-600"
        >
          {"\uD83D\uDCAC"} {t("chatWithAtlas")}
        </button>
      </div>
    </div>
  );
}

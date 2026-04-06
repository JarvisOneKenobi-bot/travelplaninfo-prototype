"use client";

import { useTranslations } from "next-intl";

interface TripContextStripProps {
  origin: string | null;
  nearbyAirports: string[];
  budget: string | null;
  vibes: string[];
  interests: string[];
  adults: number;
  childrenCount: number;
}

const VIBE_EMOJIS: Record<string, string> = {
  tropical: "\u{1F334}",
  mountains: "\u{1F3D4}\uFE0F",
  big_city: "\u{1F3D9}\uFE0F",
  beach: "\u{1F30A}",
  winter: "\u2744\uFE0F",
  cultural: "\u{1F3DB}\uFE0F",
  adventure: "\u{1F3D5}\uFE0F",
};

const INTEREST_EMOJIS: Record<string, string> = {
  beach: "\u{1F3D6}\uFE0F",
  culture: "\u{1F3DB}\uFE0F",
  food: "\u{1F35C}",
  nightlife: "\u{1F3AD}",
  nature: "\u{1F6B6}",
  city: "\u{1F6CD}\uFE0F",
  family: "\u{1F3A1}",
  adventure: "\u{1F3D4}\uFE0F",
  wellness: "\u{1F305}",
  cruise: "\u{1F6A2}",
  luxury: "\u{1F377}",
  budget: "\u{1F4F8}",
  backpacking: "\u{1F3D5}\uFE0F",
  romance: "\u{1F495}",
  family_travel: "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}",
};

export default function TripContextStrip({
  origin,
  nearbyAirports,
  budget,
  vibes,
  interests,
  adults,
  childrenCount: childCount,
}: TripContextStripProps) {
  const t = useTranslations("contextStrip");

  const extraAirports = nearbyAirports.filter(
    (code) => code !== origin
  );

  const budgetLabel =
    budget === "budget"
      ? t("budget")
      : budget === "midrange"
        ? t("midrange")
        : budget === "luxury"
          ? t("luxury")
          : null;

  return (
    <div className="flex flex-wrap gap-2">
      {/* Origin pill */}
      {origin && (
        <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs">
          {"\u2708\uFE0F"} {origin}
          {extraAirports.length > 0 && (
            <span className="ml-1 text-amber-600">
              (+ {extraAirports.join(", ")})
            </span>
          )}
        </span>
      )}

      {/* Budget pill */}
      {budget && budgetLabel && (
        <span className="inline-flex items-center rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs">
          {"\u{1F4B0}"} {budgetLabel}
        </span>
      )}

      {/* Vibe pills */}
      {vibes.map((vibe) => (
        <span
          key={vibe}
          className="inline-flex items-center rounded-full border border-pink-300 bg-pink-50 px-3 py-1 text-xs"
        >
          {VIBE_EMOJIS[vibe] ? `${VIBE_EMOJIS[vibe]} ` : ""}
          {vibe}
        </span>
      ))}

      {/* Interest pills */}
      {interests.map((interest) => {
        const clean = interest.replace(/^custom:/, "");
        const emoji = INTEREST_EMOJIS[interest];
        return (
          <span
            key={interest}
            className="inline-flex items-center rounded-full border border-orange-300 bg-orange-50 px-3 py-1 text-xs"
          >
            {emoji ? `${emoji} ` : ""}
            {clean}
          </span>
        );
      })}

      {/* Travelers pills */}
      {adults > 0 && (
        <span className="inline-flex items-center rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs">
          {"\u{1F465}"} {t("adults", { count: adults })}
        </span>
      )}
      {childCount > 0 && (
        <span className="inline-flex items-center rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs">
          {"\u{1F476}"} {t("children", { count: childCount })}
        </span>
      )}
    </div>
  );
}

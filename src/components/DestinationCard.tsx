"use client";

import { useTranslations } from "next-intl";

interface DestinationCardProps {
  destination: string;
  airline: string;
  flightPrice: string;
  hotelPrice?: string;
  nonstop: boolean;
  isTopPick?: boolean;
  onTellMeMore: () => void;
}

export default function DestinationCard({
  destination,
  airline,
  flightPrice,
  hotelPrice,
  nonstop,
  isTopPick,
  onTellMeMore,
}: DestinationCardProps) {
  const t = useTranslations("atlasHero");

  return (
    <div
      className={`bg-white rounded-lg p-4 flex flex-col h-full ${
        isTopPick
          ? "border-2 border-green-300"
          : "border border-gray-200"
      }`}
    >
      {/* Label */}
      <div className="h-5">
        {isTopPick && (
          <span className="text-xs text-green-600 font-semibold">
            {"\u2B50"} {t("topPick")}
          </span>
        )}
      </div>

      {/* Destination name */}
      <p className="font-bold text-base mt-1">{destination}</p>

      {/* Airline + flight price */}
      <p className="text-sm text-gray-500 mt-1">
        {airline} &middot; {flightPrice}
        {nonstop && (
          <span className="ml-1.5 inline-block text-xs bg-green-50 text-green-700 rounded px-1.5 py-0.5 font-medium">
            {t("nonstop")}
          </span>
        )}
      </p>

      {/* Hotel price — only shown when available */}
      {hotelPrice && <p className="text-sm text-gray-500 mt-0.5 mb-4">{hotelPrice}</p>}

      {/* CTA button — pinned to bottom */}
      <button
        onClick={onTellMeMore}
        className={`mt-auto w-full rounded py-2 text-sm font-medium transition-colors ${
          isTopPick
            ? "bg-orange-600 text-white hover:bg-orange-700"
            : "border border-gray-200 text-gray-600 hover:border-orange-300"
        }`}
      >
        {t("tellMeMore")}
      </button>
    </div>
  );
}

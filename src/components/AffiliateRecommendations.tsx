"use client";

import { useState } from "react";
import { CJ_LINKS, TP_CONFIG } from "@/config/affiliates";
import { useTranslations } from "next-intl";

interface Recommendation {
  id: string;
  label: string;
  title: string;
  description: string;
  cta: string;
  url: string;
  category: "hotel" | "flight" | "car_rental" | "cruise";
  affiliate_program: string;
}

function buildRecommendations(
  destination: string,
  budget: string | null,
  interests: string[],
  t: (key: string, values?: Record<string, string>) => string
): Recommendation[] {
  const recs: Recommendation[] = [];
  const isLuxury = budget === "luxury";
  const isBudget = budget === "budget";
  const interestStr = interests.join(" ").toLowerCase();
  const wantsCruise =
    interestStr.includes("cruise") ||
    interestStr.includes("🚢") ||
    /bahamas|caribbean|miami|fort lauderdale|key west|cancun|punta cana/i.test(destination);

  // Hotels — always show, priority order based on budget
  if (isLuxury) {
    recs.push({
      id: "hotels-luxury",
      label: t("labelHotels"),
      title: t("luxuryHotelsIn", { destination }),
      description: t("luxuryHotelsDesc"),
      cta: t("searchLuxuryHotels"),
      url: CJ_LINKS.hotelsCity(destination),
      category: "hotel",
      affiliate_program: "Hotels.com",
    });
  } else {
    recs.push({
      id: "hotels-city",
      label: t("labelHotels"),
      title: t("hotelsIn", { destination }),
      description: isBudget ? t("budgetHotelsDesc") : t("hotelsDesc"),
      cta: t("findHotels"),
      url: CJ_LINKS.hotelsCity(destination),
      category: "hotel",
      affiliate_program: "Hotels.com",
    });
  }

  // Vrbo — vacation rentals
  recs.push({
    id: "vrbo",
    label: t("labelVacationRentals"),
    title: t("vacationRentalsIn", { destination }),
    description: t("vrboDesc"),
    cta: t("browseRentals"),
    url: CJ_LINKS.vrbo(),
    category: "hotel",
    affiliate_program: "Vrbo",
  });

  // Flights — use generic TP search
  recs.push({
    id: "flights",
    label: t("labelFlights"),
    title: t("flightsTo", { destination }),
    description: t("flightsDesc"),
    cta: t("searchFlights"),
    url: `https://www.aviasales.com/?marker=${TP_CONFIG.marker}`,
    category: "flight",
    affiliate_program: "Aviasales/Travelpayouts",
  });

  // Car rental — budget first, always show
  if (isBudget) {
    recs.push({
      id: "cars-compare",
      label: t("labelCarRental"),
      title: t("compareCarsTitle"),
      description: t("compareCarsDesc"),
      cta: t("compareCars"),
      url: CJ_LINKS.carsCompare(),
      category: "car_rental",
      affiliate_program: "EconomyBookings",
    });
  } else {
    recs.push({
      id: "cars",
      label: t("labelCarRental"),
      title: t("carRentalsIn", { destination }),
      description: t("carsDesc"),
      cta: t("findCars"),
      url: CJ_LINKS.cars(),
      category: "car_rental",
      affiliate_program: "EconomyBookings",
    });
  }

  // Cruises — contextual
  if (wantsCruise) {
    recs.push({
      id: "cruise",
      label: t("labelCruises"),
      title: t("cruisesTitle"),
      description: t("cruisesDesc"),
      cta: t("viewCruises"),
      url: CJ_LINKS.cruisesLastMinute(),
      category: "cruise",
      affiliate_program: "CruiseDirect",
    });
  }

  return recs;
}

export default function AffiliateRecommendations({
  tripId,
  destination,
  budget,
  interests,
}: {
  tripId: number;
  destination: string;
  budget: string | null;
  interests: string[];
}) {
  const t = useTranslations("affiliateRecommendations");
  const [adding, setAdding] = useState<string | null>(null);

  const recs = buildRecommendations(destination, budget, interests, t);

  async function addToItinerary(rec: Recommendation) {
    setAdding(rec.id);
    await fetch(`/api/trips/${tripId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        day_number: 1,
        category: rec.category,
        title: rec.title,
        description: rec.description,
        affiliate_program: rec.affiliate_program,
        affiliate_url: rec.url,
      }),
    });
    setAdding(null);
    // Reload to show the new item
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">{t("recommendedBookings")}</h2>
      <p className="text-xs text-gray-500">{t("matchedToTrip")}</p>

      {recs.map(rec => (
        <div key={rec.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{rec.label}</span>
            <span className="text-xs text-gray-400">{rec.affiliate_program}</span>
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{rec.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{rec.description}</p>
          </div>
          <div className="flex gap-2">
            <a
              href={rec.url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="flex-1 text-center text-xs font-medium text-teal-700 border border-teal-300 py-2 rounded-lg hover:bg-teal-50 transition-colors"
            >
              {rec.cta}
            </a>
            <button
              onClick={() => addToItinerary(rec)}
              disabled={adding === rec.id}
              className="flex-1 text-xs font-medium bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-60"
            >
              {adding === rec.id ? t("adding") : t("addToItinerary")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

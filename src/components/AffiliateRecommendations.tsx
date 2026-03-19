"use client";

import { useState } from "react";
import { CJ_LINKS, TP_CONFIG } from "@/config/affiliates";

interface Recommendation {
  id: string;
  label: string;
  title: string;
  description: string;
  cta: string;
  url: string;
  category: "hotel" | "flight" | "car" | "cruise";
  affiliate_program: string;
}

function buildRecommendations(
  destination: string,
  budget: string | null,
  interests: string[]
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
      label: "🏨 Hotels",
      title: `Luxury Hotels in ${destination}`,
      description: "Hand-picked 4★ & 5★ hotels. Hotels.com Price Match Guarantee.",
      cta: "Search Luxury Hotels",
      url: CJ_LINKS.hotelsCity(destination),
      category: "hotel",
      affiliate_program: "Hotels.com",
    });
  } else {
    recs.push({
      id: "hotels-city",
      label: "🏨 Hotels",
      title: `Hotels in ${destination}`,
      description: isBudget ? "Best value hotels with free cancellation." : "Top-rated hotels at the best price.",
      cta: "Find Hotels",
      url: CJ_LINKS.hotelsCity(destination),
      category: "hotel",
      affiliate_program: "Hotels.com",
    });
  }

  // Vrbo — vacation rentals
  recs.push({
    id: "vrbo",
    label: "🏠 Vacation Rentals",
    title: `Vacation Rentals in ${destination}`,
    description: "Entire homes & condos — more space, more privacy.",
    cta: "Browse Rentals",
    url: CJ_LINKS.vrbo(),
    category: "hotel",
    affiliate_program: "Vrbo",
  });

  // Flights — use generic TP search (no reliable city→IATA mapping available client-side)
  recs.push({
    id: "flights",
    label: "✈️ Flights",
    title: `Flights to ${destination}`,
    description: "Compare hundreds of airlines for the best fare.",
    cta: "Search Flights",
    url: `https://www.aviasales.com/?marker=${TP_CONFIG.marker}`,
    category: "flight",
    affiliate_program: "Aviasales/Travelpayouts",
  });

  // Car rental — budget first, always show
  if (isBudget) {
    recs.push({
      id: "cars-compare",
      label: "🚗 Car Rental",
      title: "Compare 500+ Car Rental Suppliers",
      description: "EconomyBookings finds the cheapest available rate.",
      cta: "Compare Cars",
      url: CJ_LINKS.carsCompare(),
      category: "car",
      affiliate_program: "EconomyBookings",
    });
  } else {
    recs.push({
      id: "cars",
      label: "🚗 Car Rental",
      title: `Car Rentals in ${destination}`,
      description: "Compare top brands — Hertz, Enterprise, Sixt & more.",
      cta: "Find Cars",
      url: CJ_LINKS.cars(),
      category: "car",
      affiliate_program: "EconomyBookings",
    });
  }

  // Cruises — contextual
  if (wantsCruise) {
    recs.push({
      id: "cruise",
      label: "🚢 Cruises",
      title: "Caribbean & Bahamas Cruises",
      description: "Up to 75% off cruise fares. Last-minute deals available.",
      cta: "View Cruises",
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
  const [adding, setAdding] = useState<string | null>(null);

  const recs = buildRecommendations(destination, budget, interests);

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
      <h2 className="text-xl font-bold text-gray-900">Recommended Bookings</h2>
      <p className="text-xs text-gray-500">Matched to your destination and interests. Click &ldquo;Add&rdquo; to add to your itinerary with a direct booking link.</p>

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
              {adding === rec.id ? "Adding…" : "+ Add to Itinerary"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { FlightResult, HotelResult, ActivityResult, RestaurantResult, BudgetTier } from "./types";

// ── Budget tier badge colors (consistent with ItineraryBuilder) ─────────────

const TIER_BADGE: Record<BudgetTier, string> = {
  budget: "bg-green-100 text-green-700",
  mid: "bg-blue-100 text-blue-700",
  luxury: "bg-purple-100 text-purple-700",
};

const TIER_LABEL: Record<BudgetTier, string> = {
  budget: "Budget",
  mid: "Mid-range",
  luxury: "Luxury",
};

const BUDGET_DAILY_RANGES: Record<BudgetTier, string> = {
  budget: "$50-100/day",
  mid: "$100-250/day",
  luxury: "$250+/day",
};

// ── Tab definitions ─────────────────────────────────────────────────────────

const TABS = ["Flights", "Hotels", "Activities", "Restaurants", "Summary"] as const;
type TabId = (typeof TABS)[number];

// ── Props ───────────────────────────────────────────────────────────────────

interface TripResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  destination: string;
  dates?: { start: string; end: string };
  adults: number;
  flights: FlightResult[];
  hotels: HotelResult[];
  activities: ActivityResult[];
  restaurants: RestaurantResult[];
  budgetTier: BudgetTier;
  tripId?: number;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function TripResultsModal({
  isOpen,
  onClose,
  destination,
  dates,
  adults,
  flights,
  hotels,
  activities,
  restaurants,
  budgetTier,
  tripId,
}: TripResultsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("Flights");
  const [flightSort, setFlightSort] = useState<"price" | "duration" | "airline">("price");
  const [hotelSort, setHotelSort] = useState<"price" | "rating">("price");
  const [selectedFlights, setSelectedFlights] = useState<Set<number>>(new Set());
  const [selectedHotels, setSelectedHotels] = useState<Set<number>>(new Set());
  const [selectedActivities, setSelectedActivities] = useState<Set<number>>(new Set());
  const [selectedRestaurants, setSelectedRestaurants] = useState<Set<number>>(new Set());
  const [addingAll, setAddingAll] = useState(false);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);
  // Per-item selected day (keyed by global index within each category)
  const [flightDays, setFlightDays] = useState<Record<number, number>>({});
  const [hotelDays, setHotelDays] = useState<Record<number, number>>({});
  const [activityDays, setActivityDays] = useState<Record<number, number>>({});
  const [restaurantDays, setRestaurantDays] = useState<Record<number, number>>({});

  const totalSelected = selectedFlights.size + selectedHotels.size + selectedActivities.size + selectedRestaurants.size;

  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  // ── Calculate nights and total trip days ───────────────────────────────

  const nights = useMemo(() => {
    if (!dates?.start || !dates?.end) return 1;
    const start = new Date(dates.start);
    const end = new Date(dates.end);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }, [dates]);

  // Total trip days (inclusive of arrival and departure day)
  const dayCount = useMemo(() => {
    if (!dates?.start || !dates?.end) return 1;
    return Math.ceil((new Date(dates.end).getTime() - new Date(dates.start).getTime()) / 86400000) + 1;
  }, [dates]);

  // ── Sorted data ────────────────────────────────────────────────────────

  const sortedFlights = useMemo(() => {
    const sorted = [...flights];
    if (flightSort === "price") sorted.sort((a, b) => a.price_value - b.price_value);
    else if (flightSort === "duration") sorted.sort((a, b) => a.duration_minutes - b.duration_minutes);
    else sorted.sort((a, b) => a.airline.localeCompare(b.airline));
    return sorted;
  }, [flights, flightSort]);

  const cheapestFlightValue = useMemo(
    () => flights.length > 0 ? Math.min(...flights.map((f) => f.price_value)) : 0,
    [flights]
  );

  const sortedHotels = useMemo(() => {
    const sorted = [...hotels];
    if (hotelSort === "price") sorted.sort((a, b) => a.price_night_value - b.price_night_value);
    else sorted.sort((a, b) => b.rating - a.rating);
    return sorted;
  }, [hotels, hotelSort]);

  const groupedActivities = useMemo(() => {
    const groups: Record<string, ActivityResult[]> = {};
    for (const a of activities) {
      const key = a.interest || "Other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }
    return groups;
  }, [activities]);

  // ── Focus trap + escape key ────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;

    // Save opener element for focus restoration
    openerRef.current = document.activeElement;

    // Focus the close button on open
    requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusableSelector =
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(focusableSelector)
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus to opener
      if (openerRef.current && openerRef.current instanceof HTMLElement) {
        openerRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  // ── Default day for a new item (day with fewest assignments across activities + restaurants) ──

  const getDefaultDay = useCallback((): number => {
    if (dayCount <= 1) return 1;
    // Count how many items are currently assigned to each day
    const counts: Record<number, number> = {};
    for (let d = 1; d <= dayCount; d++) counts[d] = 0;
    for (const day of Object.values(activityDays)) {
      if (day >= 1 && day <= dayCount) {
        counts[day] = (counts[day] ?? 0) + 1;
      }
    }
    for (const day of Object.values(restaurantDays)) {
      if (day >= 1 && day <= dayCount) {
        counts[day] = (counts[day] ?? 0) + 1;
      }
    }
    // Return the day with the fewest assignments; ties go to the lowest day number
    let best = 1;
    for (let d = 2; d <= dayCount; d++) {
      if ((counts[d] ?? 0) < (counts[best] ?? 0)) best = d;
    }
    return best;
  }, [dayCount, activityDays, restaurantDays]);

  // ── Activity selection toggle ──────────────────────────────────────────

  const toggleSelection = useCallback((setter: React.Dispatch<React.SetStateAction<Set<number>>>, idx: number) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const toggleFlight = useCallback((idx: number) => toggleSelection(setSelectedFlights, idx), [toggleSelection]);
  const toggleHotel = useCallback((idx: number) => toggleSelection(setSelectedHotels, idx), [toggleSelection]);
  const toggleActivity = useCallback((idx: number) => toggleSelection(setSelectedActivities, idx), [toggleSelection]);
  const toggleRestaurant = useCallback((idx: number) => toggleSelection(setSelectedRestaurants, idx), [toggleSelection]);

  // ── Summary calculations ───────────────────────────────────────────────

  const summary = useMemo(() => {
    const cheapestFlight = flights.length > 0 ? Math.min(...flights.map((f) => f.price_value)) : 0;
    const cheapestHotel = hotels.length > 0 ? Math.min(...hotels.map((h) => h.price_night_value)) : 0;
    const selectedActivityCost = activities.reduce(
      (sum, a, i) => (selectedActivities.has(i) ? sum + a.price_value : sum),
      0
    );
    const allActivityCost = activities.reduce((sum, a) => sum + a.price_value, 0);

    // Estimate dining cost from price_range symbols: $ ~$15, $$ ~$35, $$$ ~$65, $$$$ ~$100
    const priceRangeToValue = (pr: string): number => {
      const dollars = (pr.match(/\$/g) || []).length;
      if (dollars <= 1) return 15;
      if (dollars === 2) return 35;
      if (dollars === 3) return 65;
      return 100;
    };
    const selectedDiningCost = restaurants.reduce(
      (sum, r, i) => (selectedRestaurants.has(i) ? sum + priceRangeToValue(r.price_range) : sum),
      0
    );
    const allDiningCost = restaurants.reduce((sum, r) => sum + priceRangeToValue(r.price_range), 0);

    const flightTotal = cheapestFlight * adults;
    const hotelTotal = cheapestHotel * nights;
    const diningTotal = selectedRestaurants.size > 0 ? selectedDiningCost : allDiningCost;
    const minTotal = flightTotal + hotelTotal + selectedActivityCost + (selectedRestaurants.size > 0 ? selectedDiningCost : 0);
    const maxTotal = flightTotal + hotelTotal + allActivityCost + allDiningCost;
    const totalDays = nights > 0 ? nights : 1;
    const avgPerDay = Math.round(minTotal / totalDays);

    return {
      flightTotal,
      hotelTotal,
      selectedActivityCost,
      allActivityCost,
      diningTotal,
      minTotal,
      maxTotal,
      avgPerDay,
    };
  }, [flights, hotels, activities, selectedActivities, restaurants, selectedRestaurants, adults, nights]);

  // ── Add All to Itinerary ───────────────────────────────────────────────

  const handleAddAll = useCallback(async () => {
    if (!tripId) {
      setAddedMessage("No active trip. Create a trip first.");
      return;
    }

    setAddingAll(true);
    setAddedMessage(null);

    interface BatchItem {
      day_number: number;
      category: string;
      title: string;
      description: string;
      price_estimate: string;
      affiliate_url: string;
    }

    const items: BatchItem[] = [];

    // Add selected flights (or cheapest if none selected)
    if (selectedFlights.size > 0) {
      for (const idx of selectedFlights) {
        const f = flights[idx];
        if (!f) continue;
        items.push({
          day_number: flightDays[idx] || 1,
          category: "flight",
          title: `${f.airline} ${f.route}`,
          description: `${f.duration} - ${f.stops} - ${f.price}`,
          price_estimate: f.price,
          affiliate_url: f.book_url,
        });
      }
    } else if (sortedFlights.length > 0) {
      // Default: add cheapest flight (first in sorted list)
      const f = sortedFlights[0];
      const realIdx = flights.indexOf(f);
      items.push({
        day_number: flightDays[realIdx] || 1,
        category: "flight",
        title: `${f.airline} ${f.route}`,
        description: `${f.duration} - ${f.stops} - ${f.price}`,
        price_estimate: f.price,
        affiliate_url: f.book_url,
      });
    }

    // Add selected hotels (or cheapest if none selected)
    if (selectedHotels.size > 0) {
      for (const idx of selectedHotels) {
        const h = hotels[idx];
        if (!h) continue;
        items.push({
          day_number: hotelDays[idx] || 1,
          category: "hotel",
          title: h.name,
          description: `${h.price_night}/night × ${nights} nights - ${h.rating} stars`,
          price_estimate: `$${h.price_night_value * nights}`,
          affiliate_url: h.book_url,
        });
      }
    } else if (sortedHotels.length > 0) {
      // Default: add cheapest hotel (first in sorted list)
      const h = sortedHotels[0];
      const realIdx = hotels.indexOf(h);
      items.push({
        day_number: hotelDays[realIdx] || 1,
        category: "hotel",
        title: h.name,
        description: `${h.price_night}/night × ${nights} nights - ${h.rating} stars`,
        price_estimate: `$${h.price_night_value * nights}`,
        affiliate_url: h.book_url,
      });
    }

    // Add selected activities (or all if none selected)
    const activityIndices =
      selectedActivities.size > 0 ? Array.from(selectedActivities) : activities.map((_, i) => i);
    for (const idx of activityIndices) {
      const a = activities[idx];
      if (!a) continue;
      items.push({
        day_number: activityDays[idx] ?? 1,
        category: "activity",
        title: a.name,
        description: `${a.duration || ""} - ${a.interest}`.trim(),
        price_estimate: a.price,
        affiliate_url: "",
      });
    }

    // Add selected restaurants (or all if none selected)
    const restaurantIndices =
      selectedRestaurants.size > 0 ? Array.from(selectedRestaurants) : restaurants.map((_, i) => i);
    for (const idx of restaurantIndices) {
      const r = restaurants[idx];
      if (!r) continue;
      items.push({
        day_number: restaurantDays[idx] ?? getDefaultDay(),
        category: "restaurant",
        title: r.name,
        description: `${r.cuisine} · ${r.neighborhood} · ${r.price_range}`,
        price_estimate: r.price_range,
        affiliate_url: "",
      });
    }

    if (items.length === 0) {
      setAddingAll(false);
      setAddedMessage("No items to add.");
      return;
    }

    try {
      const res = await fetch(`/api/trips/${tripId}/items/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      if (res.ok) {
        const data = await res.json();
        setAddedMessage(`Added ${data.items?.length || items.length} items to your itinerary!`);
        // Reload after brief delay so user sees the message
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const err = await res.json().catch(() => ({ error: "Failed to add items" }));
        setAddedMessage(err.error || "Failed to add items");
      }
    } catch {
      setAddedMessage("Network error. Please try again.");
    }

    setAddingAll(false);
  }, [tripId, flights, hotels, sortedFlights, sortedHotels, activities, nights, selectedFlights, selectedHotels, selectedActivities, activityDays, flightDays, hotelDays, selectedRestaurants, restaurants, restaurantDays, getDefaultDay]);

  // ── Render ─────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center pt-[5vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trip-results-title"
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 id="trip-results-title" className="text-xl font-bold text-gray-900">
              Trip Plan: {destination}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {dates ? `${dates.start} - ${dates.end}` : "Flexible dates"}
              {" | "}
              {adults} {adults === 1 ? "adult" : "adults"}
              {" | "}
              <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${TIER_BADGE[budgetTier]}`}>
                {TIER_LABEL[budgetTier]}
              </span>
            </p>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close trip results"
            className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Tab bar ── */}
        <div className="px-6 border-b border-gray-200 shrink-0" role="tablist" aria-label="Trip result categories">
          <div className="flex gap-6">
            {TABS.map((tab) => {
              const isActive = activeTab === tab;
              const count =
                tab === "Flights"
                  ? flights.length
                  : tab === "Hotels"
                  ? hotels.length
                  : tab === "Activities"
                  ? activities.length
                  : tab === "Restaurants"
                  ? restaurants.length
                  : null;
              return (
                <button
                  key={tab}
                  role="tab"
                  id={`tab-${tab}`}
                  aria-selected={isActive}
                  aria-controls={`panel-${tab}`}
                  onClick={() => setActiveTab(tab)}
                  className={[
                    "py-3 text-sm font-medium transition-colors relative",
                    isActive
                      ? "text-orange-600"
                      : "text-gray-500 hover:text-gray-700",
                  ].join(" ")}
                >
                  {tab}
                  {count !== null && (
                    <span className="ml-1 text-xs text-gray-400">({count})</span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Content area ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Flights Tab */}
          <div
            role="tabpanel"
            id="panel-Flights"
            aria-labelledby="tab-Flights"
            className={activeTab === "Flights" ? "" : "hidden"}
          >
            {flights.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No flight results available.</p>
            ) : (
              <>
                {/* Sort toggles */}
                <div className="flex gap-2 mb-4">
                  {(["price", "duration", "airline"] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => setFlightSort(key)}
                      className={[
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                        flightSort === key
                          ? "bg-orange-100 text-orange-700"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                      ].join(" ")}
                    >
                      Sort by {key.charAt(0).toUpperCase() + key.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  {sortedFlights.map((f, i) => {
                    const realIdx = flights.indexOf(f);
                    const isCheapest = f.price_value === cheapestFlightValue;
                    const isSelected = selectedFlights.has(realIdx);
                    return (
                      <div
                        key={i}
                        onClick={() => toggleFlight(realIdx)}
                        className={[
                          "cursor-pointer",
                          "bg-white rounded-lg border p-4 hover:shadow-md transition-shadow",
                          isSelected ? "border-orange-400 ring-2 ring-orange-200 bg-orange-50/30" : isCheapest ? "border-green-300 ring-1 ring-green-200" : "border-gray-200",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleFlight(realIdx)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 shrink-0 mt-1"
                            />
                            <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-gray-100 rounded flex items-center justify-center text-xs font-bold text-gray-500">
                                {f.airline.charAt(0)}
                              </div>
                              <span className="font-medium text-gray-900">{f.airline}</span>
                              {isCheapest && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                  Best Price
                                </span>
                              )}
                              {f.nonstop && (
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-full">
                                  Nonstop
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                              {f.route} &middot; {f.duration} &middot; {f.stops}
                            </p>
                            {f.depart_date && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {f.depart_date}
                                {f.return_date ? ` - ${f.return_date}` : " (one-way)"}
                              </p>
                            )}
                          </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-xl text-orange-600">{f.price}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <a
                            href={f.book_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-full px-4 py-2 transition-colors"
                          >
                            Book on Aviasales
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                          </a>
                          {dayCount > 1 && (
                            <select
                              value={flightDays[realIdx] || 1}
                              onChange={(e) => { e.stopPropagation(); setFlightDays((prev) => ({ ...prev, [realIdx]: Number(e.target.value) })); }}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-600"
                            >
                              {Array.from({ length: dayCount }, (_, d) => (
                                <option key={d + 1} value={d + 1}>Day {d + 1}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Hotels Tab */}
          <div
            role="tabpanel"
            id="panel-Hotels"
            aria-labelledby="tab-Hotels"
            className={activeTab === "Hotels" ? "" : "hidden"}
          >
            {hotels.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No hotel results available.</p>
            ) : (
              <>
                {/* Sort toggles */}
                <div className="flex gap-2 mb-4">
                  {(["price", "rating"] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => setHotelSort(key)}
                      className={[
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                        hotelSort === key
                          ? "bg-orange-100 text-orange-700"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                      ].join(" ")}
                    >
                      Sort by {key.charAt(0).toUpperCase() + key.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sortedHotels.map((h, i) => {
                    const realIdx = hotels.indexOf(h);
                    const stars = Math.round(h.rating);
                    const tierClass = TIER_BADGE[h.tier] || "bg-gray-100 text-gray-600";
                    const totalCost = h.total_cost || `$${(h.price_night_value * nights).toLocaleString()}`;
                    const isSelected = selectedHotels.has(realIdx);
                    return (
                      <div
                        key={i}
                        onClick={() => toggleHotel(realIdx)}
                        className={[
                          "cursor-pointer bg-white rounded-lg border p-4 hover:shadow-md transition-shadow",
                          isSelected ? "border-orange-400 ring-2 ring-orange-200 bg-orange-50/30" : "border-gray-200",
                        ].join(" ")}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleHotel(realIdx)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 shrink-0 mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{h.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-yellow-500">
                                {"★".repeat(stars)}
                                {"☆".repeat(Math.max(0, 5 - stars))}
                              </span>
                              <span className="text-xs text-gray-500">{h.rating}</span>
                              <span
                                className={[
                                  "text-xs rounded px-1.5 py-0.5 font-medium capitalize",
                                  tierClass,
                                ].join(" ")}
                              >
                                {h.tier}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-lg text-orange-600">{h.price_night}</p>
                            <p className="text-xs text-gray-400">/night</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          {nights} {nights === 1 ? "night" : "nights"} total: <span className="font-medium text-gray-700">{totalCost}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                          <a
                            href={h.book_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-full px-4 py-2 transition-colors"
                          >
                            Find on Hotels.com
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                          </a>
                          {dayCount > 1 && (
                            <select
                              value={hotelDays[realIdx] || 1}
                              onChange={(e) => { e.stopPropagation(); setHotelDays((prev) => ({ ...prev, [realIdx]: Number(e.target.value) })); }}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-600"
                            >
                              {Array.from({ length: dayCount }, (_, d) => (
                                <option key={d + 1} value={d + 1}>Day {d + 1}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Activities Tab */}
          <div
            role="tabpanel"
            id="panel-Activities"
            aria-labelledby="tab-Activities"
            className={activeTab === "Activities" ? "" : "hidden"}
          >
            {activities.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No activity results available.</p>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedActivities).map(([interest, group]) => (
                  <div key={interest}>
                    <h3 className="text-sm font-semibold text-gray-700 capitalize mb-3 flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded text-xs">
                        {interest}
                      </span>
                    </h3>
                    <div className="space-y-2">
                      {group.map((a) => {
                        // Find global index for selection tracking
                        const globalIdx = activities.indexOf(a);
                        const isSelected = selectedActivities.has(globalIdx);
                        const tierClass = TIER_BADGE[a.tier] || "bg-gray-100 text-gray-600";
                        const isOverBudget =
                          (budgetTier === "budget" && a.tier === "luxury") ||
                          (budgetTier === "budget" && a.tier === "mid") ||
                          (budgetTier === "mid" && a.tier === "luxury");

                        return (
                          <div
                            key={globalIdx}
                            className={[
                              "bg-white rounded-lg border p-3 transition-shadow hover:shadow-md",
                              isSelected ? "border-orange-300 ring-1 ring-orange-200" : "border-gray-200",
                            ].join(" ")}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-gray-900">{a.name}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  {a.duration && (
                                    <span className="text-xs text-gray-500">{a.duration}</span>
                                  )}
                                  <span
                                    className={[
                                      "text-xs rounded px-1.5 py-0.5 font-medium capitalize",
                                      tierClass,
                                    ].join(" ")}
                                  >
                                    {a.tier}
                                  </span>
                                </div>
                                {isOverBudget && (
                                  <p className="text-xs text-amber-600 mt-1">
                                    Above your {TIER_LABEL[budgetTier]} budget
                                  </p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-bold text-sm text-gray-900">{a.price}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              {/* Day selector dropdown */}
                              <select
                                value={activityDays[globalIdx] ?? getDefaultDay()}
                                onChange={(e) => {
                                  const day = Number(e.target.value);
                                  setActivityDays((prev) => ({ ...prev, [globalIdx]: day }));
                                }}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Select day for ${a.name}`}
                                className="text-xs border border-gray-300 rounded-full px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-orange-400 cursor-pointer"
                              >
                                {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
                                  <option key={d} value={d}>
                                    Day {d}
                                  </option>
                                ))}
                              </select>
                              {/* Add / Selected toggle button */}
                              <button
                                onClick={() => {
                                  // Ensure day is set before toggling selection
                                  if (activityDays[globalIdx] === undefined) {
                                    setActivityDays((prev) => ({ ...prev, [globalIdx]: getDefaultDay() }));
                                  }
                                  toggleActivity(globalIdx);
                                }}
                                className={[
                                  "text-xs font-medium px-3 py-1.5 rounded-full transition-colors",
                                  isSelected
                                    ? "bg-orange-500 text-white"
                                    : "bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600",
                                ].join(" ")}
                              >
                                {isSelected ? "Selected" : "Add"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Restaurants Tab */}
          <div
            role="tabpanel"
            id="panel-Restaurants"
            aria-labelledby="tab-Restaurants"
            className={activeTab === "Restaurants" ? "" : "hidden"}
          >
            {restaurants.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No restaurant results available.</p>
            ) : (
              <div className="space-y-3">
                {restaurants.map((r, idx) => {
                  const isSelected = selectedRestaurants.has(idx);
                  return (
                    <div
                      key={idx}
                      className={[
                        "bg-white rounded-lg border p-3 transition-shadow hover:shadow-md",
                        isSelected ? "border-orange-300 ring-1 ring-orange-200" : "border-gray-200",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRestaurant(idx)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 shrink-0 mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900">{r.name}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs rounded px-1.5 py-0.5 font-medium bg-orange-100 text-orange-700">
                                {r.cuisine}
                              </span>
                              <span className="text-xs text-gray-500">{r.neighborhood}</span>
                              <span className="text-xs font-medium text-gray-700">{r.price_range}</span>
                              {r.rating && (
                                <span className="text-xs text-yellow-500">
                                  {"★".repeat(Math.round(r.rating))}
                                  {"☆".repeat(Math.max(0, 5 - Math.round(r.rating)))}
                                </span>
                              )}
                            </div>
                            {r.highlights.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {r.highlights.map((h, hIdx) => (
                                  <span
                                    key={hIdx}
                                    className="text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5"
                                  >
                                    {h}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {/* Day selector dropdown */}
                        <select
                          value={restaurantDays[idx] ?? getDefaultDay()}
                          onChange={(e) => {
                            const day = Number(e.target.value);
                            setRestaurantDays((prev) => ({ ...prev, [idx]: day }));
                          }}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select day for ${r.name}`}
                          className="text-xs border border-gray-300 rounded-full px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-orange-400 cursor-pointer"
                        >
                          {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={d}>
                              Day {d}
                            </option>
                          ))}
                        </select>
                        {/* Add / Selected toggle button */}
                        <button
                          onClick={() => {
                            if (restaurantDays[idx] === undefined) {
                              setRestaurantDays((prev) => ({ ...prev, [idx]: getDefaultDay() }));
                            }
                            toggleRestaurant(idx);
                          }}
                          className={[
                            "text-xs font-medium px-3 py-1.5 rounded-full transition-colors",
                            isSelected
                              ? "bg-orange-500 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600",
                          ].join(" ")}
                        >
                          {isSelected ? "Selected" : "Add"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summary Tab */}
          <div
            role="tabpanel"
            id="panel-Summary"
            aria-labelledby="tab-Summary"
            className={activeTab === "Summary" ? "" : "hidden"}
          >
            <div className="space-y-6">
              {/* Cost breakdown */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Cost Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      Flights (cheapest x {adults} {adults === 1 ? "adult" : "adults"})
                    </span>
                    <span className="font-medium text-gray-900">
                      ${summary.flightTotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      Hotels (cheapest x {nights} {nights === 1 ? "night" : "nights"})
                    </span>
                    <span className="font-medium text-gray-900">
                      ${summary.hotelTotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      Activities ({selectedActivities.size > 0 ? "selected" : "all"})
                    </span>
                    <span className="font-medium text-gray-900">
                      $
                      {(selectedActivities.size > 0
                        ? summary.selectedActivityCost
                        : summary.allActivityCost
                      ).toLocaleString()}
                    </span>
                  </div>
                  {restaurants.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        Dining (estimated)
                      </span>
                      <span className="font-medium text-gray-900">
                        ~${summary.diningTotal.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-3 flex justify-between text-sm">
                    <span className="font-semibold text-gray-900">Estimated Total</span>
                    <span className="font-bold text-lg text-orange-600">
                      ${summary.minTotal.toLocaleString()}
                      {summary.maxTotal > summary.minTotal &&
                        ` - $${summary.maxTotal.toLocaleString()}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Budget comparison */}
              <div className="bg-orange-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-2">Budget Comparison</h3>
                <p className="text-sm text-gray-700">
                  Your budget tier:{" "}
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${TIER_BADGE[budgetTier]}`}>
                    {TIER_LABEL[budgetTier]}
                  </span>{" "}
                  ({BUDGET_DAILY_RANGES[budgetTier]})
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  This trip averages{" "}
                  <span className="font-bold text-orange-600">${summary.avgPerDay}/day</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sticky footer ── */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
          {addedMessage && (
            <p className="text-sm text-center mb-2 text-green-700 font-medium">{addedMessage}</p>
          )}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Estimated total:{" "}
              <span className="font-bold text-gray-900">
                ${summary.minTotal.toLocaleString()}
                {summary.maxTotal > summary.minTotal &&
                  ` - $${summary.maxTotal.toLocaleString()}`}
              </span>
            </p>
            <button
              onClick={handleAddAll}
              disabled={addingAll || !tripId}
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm px-5 py-2.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingAll ? "Adding..." : totalSelected > 0 ? `Add Selected (${totalSelected}) to Itinerary` : "Add All to Itinerary"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

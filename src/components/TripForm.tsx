"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const INTERESTS = [
  { value: "beach", label: "Beaches", icon: "\uD83C\uDFD6\uFE0F" },
  { value: "culture", label: "Museums", icon: "\uD83C\uDFDB\uFE0F" },
  { value: "food", label: "Food & Dining", icon: "\uD83C\uDF5C" },
  { value: "nightlife", label: "Nightlife", icon: "\uD83C\uDFAD" },
  { value: "nature", label: "Hiking", icon: "\uD83D\uDEB6" },
  { value: "city", label: "Shopping", icon: "\uD83D\uDECD\uFE0F" },
  { value: "family", label: "Theme Parks", icon: "\uD83C\uDFA2" },
  { value: "adventure", label: "Adventure", icon: "\uD83C\uDFD4\uFE0F" },
  { value: "wellness", label: "Nature & Wellness", icon: "\uD83C\uDF05" },
  { value: "cruise", label: "Cruises", icon: "\uD83D\uDEA2" },
  { value: "luxury", label: "Luxury", icon: "\uD83C\uDF77" },
  { value: "budget", label: "Budget Travel", icon: "\uD83D\uDCF8" },
  { value: "backpacking", label: "Backpacking", icon: "\uD83C\uDFD5\uFE0F" },
  { value: "business", label: "Business Travel", icon: "\uD83D\uDCBC" },
];

const AI_ASSISTED_CHIP = { value: "ai_assisted", label: "Let Atlas decide", icon: "\u2728" };

const BUDGET_OPTIONS = [
  { value: "budget", label: "Budget", icon: "\uD83D\uDCB0" },
  { value: "midrange", label: "Mid-range", icon: "\uD83D\uDCB5" },
  { value: "luxury", label: "Luxury", icon: "\uD83D\uDC8E" },
];

// Nearby airport groups — Atlas will search all airports in the group for best fares
const NEARBY_AIRPORTS: Record<string, { label: string; airports: string[] }> = {
  MIA: { label: "Miami area", airports: ["MIA", "FLL", "PBI"] },
  FLL: { label: "Fort Lauderdale area", airports: ["FLL", "MIA", "PBI"] },
  PBI: { label: "West Palm Beach area", airports: ["PBI", "FLL", "MIA"] },
  JFK: { label: "New York area", airports: ["JFK", "EWR", "LGA"] },
  EWR: { label: "Newark area", airports: ["EWR", "JFK", "LGA"] },
  LGA: { label: "New York area", airports: ["LGA", "JFK", "EWR"] },
  LAX: { label: "Los Angeles area", airports: ["LAX", "SNA", "BUR", "LGB", "ONT"] },
  SFO: { label: "San Francisco area", airports: ["SFO", "OAK", "SJC"] },
  ORD: { label: "Chicago area", airports: ["ORD", "MDW"] },
  DFW: { label: "Dallas area", airports: ["DFW", "DAL", "IAH"] },
  IAH: { label: "Houston area", airports: ["IAH", "HOU"] },
  ATL: { label: "Atlanta area", airports: ["ATL"] },
  DCA: { label: "Washington DC area", airports: ["DCA", "IAD", "BWI"] },
  IAD: { label: "Washington DC area", airports: ["IAD", "DCA", "BWI"] },
  BOS: { label: "Boston area", airports: ["BOS", "PVD", "MHT"] },
  SEA: { label: "Seattle area", airports: ["SEA"] },
  MCO: { label: "Orlando area", airports: ["MCO", "SFB", "TPA"] },
  TPA: { label: "Tampa area", airports: ["TPA", "SRQ", "PIE"] },
};

export default function TripForm({ onCancel }: { onCancel?: () => void }) {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [includeNearby, setIncludeNearby] = useState(true);
  const [destination, setDestination] = useState("");
  const [tripName, setTripName] = useState("");

  // Pre-fill origin from user preferences on mount
  useEffect(() => {
    fetch("/api/user/preferences")
      .then(r => r.ok ? r.json() : null)
      .then(prefs => {
        if (prefs?.home_airport) setOrigin(prefs.home_airport.toUpperCase());
      })
      .catch(() => {});
  }, []);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [flexibleDates, setFlexibleDates] = useState(false);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState(1);
  const [budget, setBudget] = useState("midrange");
  const [interests, setInterests] = useState<string[]>([]);
  const [surpriseMe, setSurpriseMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function toggleInterest(interest: string) {
    setInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  }

  function handleSurpriseMe() {
    setSurpriseMe(true);
    setDestination("Surprise Me");
  }

  function clearSurpriseMe() {
    setSurpriseMe(false);
    setDestination("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!destination.trim()) {
      setError("Please enter a destination.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: tripName.trim() || `Trip to ${destination.trim()}`,
        destination: destination.trim(),
        start_date: flexibleDates ? null : (startDate || null),
        end_date: flexibleDates ? null : (endDate || null),
        budget,
        travelers_adults: adults,
        travelers_children: children,
        rooms,
        interests,
        origin: origin.trim().toUpperCase(),
        include_nearby_airports: includeNearby,
        nearby_airports: includeNearby && NEARBY_AIRPORTS[origin.trim().toUpperCase()]
          ? NEARBY_AIRPORTS[origin.trim().toUpperCase()].airports
          : [origin.trim().toUpperCase()],
      }),
    });

    if (!res.ok) {
      if (res.status === 401) {
        router.push("/signin?callbackUrl=/planner");
        return;
      }
      setError("Failed to create trip. Please try again.");
      setLoading(false);
      return;
    }

    const trip = await res.json();
    router.push(`/planner/${trip.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Step 0: Departing from */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">1</span>
          <h2 className="text-xl font-bold text-gray-900">Departing from</h2>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            required
            value={origin}
            onChange={e => setOrigin(e.target.value.toUpperCase())}
            placeholder="Airport code (e.g., MIA, JFK, LAX)"
            maxLength={4}
            className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent uppercase font-mono text-lg tracking-wider"
          />
        </div>
        {origin.trim().length >= 3 && NEARBY_AIRPORTS[origin.trim().toUpperCase()] && (
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={includeNearby}
              onChange={e => setIncludeNearby(e.target.checked)}
              className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <span>
              Also search nearby airports: {NEARBY_AIRPORTS[origin.trim().toUpperCase()].airports
                .filter(a => a !== origin.trim().toUpperCase())
                .join(", ")}
            </span>
            <span className="text-xs text-orange-600 font-medium">(often cheaper fares)</span>
          </label>
        )}
        {origin.trim().length >= 3 && !NEARBY_AIRPORTS[origin.trim().toUpperCase()] && (
          <p className="text-xs text-gray-400">Atlas will search flights from {origin.trim().toUpperCase()}</p>
        )}
      </div>

      {/* Step 2: Destination */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</span>
          <h2 className="text-xl font-bold text-gray-900">Where are you going?</h2>
        </div>

        {surpriseMe ? (
          <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <span className="text-2xl">{"\u2728"}</span>
            <div className="flex-1">
              <p className="font-medium text-orange-900">Surprise Me!</p>
              <p className="text-sm text-orange-700">Atlas will suggest destinations based on your budget and interests.</p>
            </div>
            <button type="button" onClick={clearSurpriseMe}
              className="text-sm text-orange-600 hover:text-orange-800 font-medium underline">
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              required
              value={destination}
              onChange={e => setDestination(e.target.value)}
              placeholder="e.g., Miami, Florida"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={handleSurpriseMe}
              className="w-full text-sm text-orange-700 border border-dashed border-orange-300 rounded-lg py-2.5 hover:bg-orange-50 transition-colors font-medium"
            >
              {"\u2728"} I don&apos;t know yet &mdash; Surprise Me
            </button>
          </>
        )}

        <input
          type="text"
          value={tripName}
          onChange={e => setTripName(e.target.value)}
          placeholder="Trip name (optional)"
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Step 3: Dates */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">3</span>
          <h2 className="text-xl font-bold text-gray-900">When are you traveling?</h2>
        </div>

        {!flexibleDates && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Check-in</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Check-out</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
            </div>
          </div>
        )}

        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:border-orange-300 transition-colors">
          <input
            type="checkbox"
            checked={flexibleDates}
            onChange={e => setFlexibleDates(e.target.checked)}
            className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
          />
          <div>
            <p className="text-sm font-medium text-gray-900">I&apos;m flexible if it means a great deal</p>
            <p className="text-xs text-gray-500">Atlas will search for the cheapest dates to fly</p>
          </div>
        </label>
      </div>

      {/* Step 4: Travelers */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">4</span>
          <h2 className="text-xl font-bold text-gray-900">Who&apos;s traveling?</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Adults</label>
            <select value={adults} onChange={e => setAdults(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
              {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Children</label>
            <select value={children} onChange={e => setChildren(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
              {[0,1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rooms</label>
            <select value={rooms} onChange={e => setRooms(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
              {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Step 5: Budget (labels only, no dollar amounts per product spec) */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">5</span>
          <h2 className="text-xl font-bold text-gray-900">What&apos;s your budget?</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {BUDGET_OPTIONS.map(opt => (
            <label key={opt.value} className="cursor-pointer">
              <input type="radio" name="budget" value={opt.value} checked={budget === opt.value}
                onChange={() => setBudget(opt.value)} className="sr-only" />
              <div className={`px-4 py-4 rounded-lg border-2 text-center transition-colors ${budget === opt.value ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}>
                <p className="text-2xl mb-1">{opt.icon}</p>
                <p className="font-medium text-gray-900">{opt.label}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Step 5: Interests (with "Let Atlas decide" chip) */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">6</span>
          <h2 className="text-xl font-bold text-gray-900">What interests you?</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {INTERESTS.map(interest => (
            <label key={interest.value} className="cursor-pointer">
              <input type="checkbox" checked={interests.includes(interest.value)}
                onChange={() => toggleInterest(interest.value)} className="sr-only" />
              <div className={`px-4 py-2.5 rounded-lg border-2 text-center transition-colors text-sm ${interests.includes(interest.value) ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}>
                {interest.icon} {interest.label}
              </div>
            </label>
          ))}

          {/* "Let Atlas decide" chip with sparkle icon */}
          <label className="cursor-pointer">
            <input type="checkbox" checked={interests.includes(AI_ASSISTED_CHIP.value)}
              onChange={() => toggleInterest(AI_ASSISTED_CHIP.value)} className="sr-only" />
            <div className={`px-4 py-2.5 rounded-lg border-2 text-center transition-colors text-sm ${
              interests.includes(AI_ASSISTED_CHIP.value)
                ? "border-orange-500 bg-gradient-to-br from-orange-50 to-amber-50"
                : "border-dashed border-orange-300 hover:border-orange-400 bg-gradient-to-br from-orange-50/50 to-amber-50/50"
            }`}>
              {AI_ASSISTED_CHIP.icon} {AI_ASSISTED_CHIP.label}
            </div>
          </label>
        </div>
        {interests.includes("ai_assisted") && (
          <p className="text-xs text-orange-600 pl-1">
            Atlas will chat with you after planning to refine your itinerary with personalized suggestions.
          </p>
        )}
      </div>

      {/* Submit */}
      <div className="pt-4 border-t border-gray-200 flex gap-3">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="flex-1 border border-gray-300 text-gray-700 py-4 rounded-lg font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        )}
        <button type="submit" disabled={loading}
          className="flex-1 bg-orange-600 text-white py-4 rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-60">
          {loading ? "Creating trip\u2026" : "Start Planning"}
        </button>
      </div>
    </form>
  );
}

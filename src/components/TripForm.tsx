"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const INTERESTS = [
  { value: "beach", icon: "\uD83C\uDFD6\uFE0F" },
  { value: "culture", icon: "\uD83C\uDFDB\uFE0F" },
  { value: "food", icon: "\uD83C\uDF5C" },
  { value: "nightlife", icon: "\uD83C\uDFAD" },
  { value: "nature", icon: "\uD83D\uDEB6" },
  { value: "city", icon: "\uD83D\uDECD\uFE0F" },
  { value: "family", icon: "\uD83C\uDFA2" },
  { value: "adventure", icon: "\uD83C\uDFD4\uFE0F" },
  { value: "wellness", icon: "\uD83C\uDF05" },
  { value: "cruise", icon: "\uD83D\uDEA2" },
  { value: "luxury", icon: "\uD83C\uDF77" },
  { value: "budget", icon: "\uD83D\uDCF8" },
  { value: "backpacking", icon: "\uD83C\uDFD5\uFE0F" },
  { value: "business", icon: "\uD83D\uDCBC" },
  { value: "romance", icon: "\uD83D\uDC95" },
  { value: "family_travel", icon: "\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66" },
];

const AI_ASSISTED_VALUE = "ai_assisted";

const BUDGET_VALUES = [
  { value: "budget", icon: "\uD83D\uDCB0" },
  { value: "midrange", icon: "\uD83D\uDCB5" },
  { value: "luxury", icon: "\uD83D\uDC8E" },
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
  const t = useTranslations("tripForm");
  const tInterests = useTranslations("tripForm.interests");
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
  const [flexibleWindow, setFlexibleWindow] = useState("next_month");
  const [tripLength, setTripLength] = useState("week");
  const [atlasDecidesDates, setAtlasDecidesDates] = useState(false);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState(1);
  const [budget, setBudget] = useState("midrange");
  const [interests, setInterests] = useState<string[]>([]);
  const [surpriseMe, setSurpriseMe] = useState(false);
  const [showCustomInterests, setShowCustomInterests] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [customInterests, setCustomInterests] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function toggleInterest(interest: string) {
    setInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  }

  function addCustomInterests(raw: string) {
    const items = raw.split(/[,\n]/).map(s => s.trim().toLowerCase()).filter(Boolean);
    const newOnes = items.filter(i => !customInterests.includes(i) && !INTERESTS.some(p => p.value === i));
    if (newOnes.length > 0) setCustomInterests(prev => [...prev, ...newOnes]);
    setCustomInput("");
  }

  function removeCustomInterest(item: string) {
    setCustomInterests(prev => prev.filter(i => i !== item));
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
      setError(t("pleaseEnterDestination"));
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
        flexible_window: flexibleDates ? (atlasDecidesDates ? "any" : flexibleWindow) : null,
        trip_length: flexibleDates ? (atlasDecidesDates ? "any" : tripLength) : null,
        budget,
        travelers_adults: adults,
        travelers_children: children,
        rooms,
        interests: [...interests, ...customInterests.map(c => `custom:${c}`)],
        origin: origin.trim().toUpperCase(),
        include_nearby_airports: includeNearby,
        nearby_airports: includeNearby && NEARBY_AIRPORTS[origin.trim().toUpperCase()]
          ? NEARBY_AIRPORTS[origin.trim().toUpperCase()].airports
          : [origin.trim().toUpperCase()],
      }),
    });

    if (!res.ok) {
      setError(t("failedToCreateTrip"));
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
          <h2 className="text-xl font-bold text-gray-900">{t("departingFrom")}</h2>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            required
            value={origin}
            onChange={e => setOrigin(e.target.value.toUpperCase())}
            placeholder={t("airportCodePlaceholder")}
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
              {t("searchNearbyAirports")} {NEARBY_AIRPORTS[origin.trim().toUpperCase()].airports
                .filter(a => a !== origin.trim().toUpperCase())
                .join(", ")}
            </span>
            <span className="text-xs text-orange-600 font-medium">{t("oftenCheaperFares")}</span>
          </label>
        )}
        {origin.trim().length >= 3 && !NEARBY_AIRPORTS[origin.trim().toUpperCase()] && (
          <p className="text-xs text-gray-400">{t("atlasWillSearch")} {origin.trim().toUpperCase()}</p>
        )}
      </div>

      {/* Step 2: Destination */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</span>
          <h2 className="text-xl font-bold text-gray-900">{t("whereAreYouGoing")}</h2>
        </div>

        {surpriseMe ? (
          <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <span className="text-2xl">{"\u2728"}</span>
            <div className="flex-1">
              <p className="font-medium text-orange-900">{t("surpriseMeTitle")}</p>
              <p className="text-sm text-orange-700">{t("surpriseMeDesc")}</p>
            </div>
            <button type="button" onClick={clearSurpriseMe}
              className="text-sm text-orange-600 hover:text-orange-800 font-medium underline">
              {t("change")}
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              required
              value={destination}
              onChange={e => setDestination(e.target.value)}
              placeholder={t("destinationPlaceholder")}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={handleSurpriseMe}
              className="w-full text-sm text-orange-700 border border-dashed border-orange-300 rounded-lg py-2.5 hover:bg-orange-50 transition-colors font-medium"
            >
              {t("surpriseMeButton")}
            </button>
          </>
        )}

        <input
          type="text"
          value={tripName}
          onChange={e => setTripName(e.target.value)}
          placeholder={t("tripNamePlaceholder")}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Step 3: Dates */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">3</span>
          <h2 className="text-xl font-bold text-gray-900">{t("whenAreYouTraveling")}</h2>
        </div>

        {!flexibleDates ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("checkIn")}</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("checkOut")}</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
            </div>
          </div>
        ) : (
          <>
            {!atlasDecidesDates && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t("whenAreYouThinking")}</label>
                  <select value={flexibleWindow} onChange={e => setFlexibleWindow(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                    <option value="next_2_weeks">{t("next2Weeks")}</option>
                    <option value="next_month">{t("nextMonth")}</option>
                    <option value="2_3_months">{t("in2To3Months")}</option>
                    <option value="6_months">{t("in6Months")}</option>
                    <option value="this_year">{t("anytimeThisYear")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t("howLong")}</label>
                  <select value={tripLength} onChange={e => setTripLength(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                    <option value="weekend">{t("weekend")}</option>
                    <option value="week">{t("aboutAWeek")}</option>
                    <option value="10_14_days">{t("10To14Days")}</option>
                    <option value="2_plus_weeks">{t("2PlusWeeks")}</option>
                  </select>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setAtlasDecidesDates(!atlasDecidesDates)}
              className={[
                "w-full text-sm rounded-lg py-2.5 font-medium transition-colors",
                atlasDecidesDates
                  ? "bg-orange-50 border-2 border-orange-500 text-orange-700"
                  : "border border-dashed border-orange-300 text-orange-700 hover:bg-orange-50",
              ].join(" ")}
            >
              {t("atlasFindCheapestDates")}
            </button>
          </>
        )}

        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:border-orange-300 transition-colors">
          <input
            type="checkbox"
            checked={flexibleDates}
            onChange={e => { setFlexibleDates(e.target.checked); if (!e.target.checked) setAtlasDecidesDates(false); }}
            className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
          />
          <div>
            <p className="text-sm font-medium text-gray-900">{t("flexibleDates")}</p>
            <p className="text-xs text-gray-500">{t("flexibleDatesDesc")}</p>
          </div>
        </label>
      </div>

      {/* Step 4: Travelers */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">4</span>
          <h2 className="text-xl font-bold text-gray-900">{t("whoIsTraveling")}</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t("adults")}</label>
            <select value={adults} onChange={e => setAdults(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
              {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t("children")}</label>
            <select value={children} onChange={e => setChildren(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
              {[0,1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t("rooms")}</label>
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
          <h2 className="text-xl font-bold text-gray-900">{t("whatsYourBudget")}</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {BUDGET_VALUES.map(opt => (
            <label key={opt.value} className="cursor-pointer">
              <input type="radio" name="budget" value={opt.value} checked={budget === opt.value}
                onChange={() => setBudget(opt.value)} className="sr-only" />
              <div className={`px-4 py-4 rounded-lg border-2 text-center transition-colors ${budget === opt.value ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}>
                <p className="text-2xl mb-1">{opt.icon}</p>
                <p className="font-medium text-gray-900">{t(opt.value as "budget" | "midrange" | "luxury")}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Step 5: Interests (with "Let Atlas decide" chip) */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">6</span>
          <h2 className="text-xl font-bold text-gray-900">{t("whatInterestsYou")}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {INTERESTS.map(interest => (
            <label key={interest.value} className="cursor-pointer">
              <input type="checkbox" checked={interests.includes(interest.value)}
                onChange={() => toggleInterest(interest.value)} className="sr-only" />
              <div className={`px-4 py-2.5 rounded-lg border-2 text-center transition-colors text-sm ${interests.includes(interest.value) ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}>
                {interest.icon} {tInterests(interest.value as keyof typeof tInterests)}
              </div>
            </label>
          ))}

          {/* "Let Atlas decide" chip with sparkle icon */}
          <label className="cursor-pointer">
            <input type="checkbox" checked={interests.includes(AI_ASSISTED_VALUE)}
              onChange={() => toggleInterest(AI_ASSISTED_VALUE)} className="sr-only" />
            <div className={`px-4 py-2.5 rounded-lg border-2 text-center transition-colors text-sm ${
              interests.includes(AI_ASSISTED_VALUE)
                ? "border-orange-500 bg-gradient-to-br from-orange-50 to-amber-50"
                : "border-dashed border-orange-300 hover:border-orange-400 bg-gradient-to-br from-orange-50/50 to-amber-50/50"
            }`}>
              {"\u2728"} {t("letAtlasDecide")}
            </div>
          </label>

          {/* "Add your own" chip */}
          <button
            type="button"
            onClick={() => setShowCustomInterests(!showCustomInterests)}
            className={`px-4 py-2.5 rounded-lg border-2 text-center transition-colors text-sm ${
              showCustomInterests || customInterests.length > 0
                ? "border-orange-500 bg-orange-50"
                : "border-dashed border-gray-300 hover:border-orange-300"
            }`}
          >
            {t("addYourOwn")}
          </button>
        </div>

        {/* Custom interests input */}
        {showCustomInterests && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); addCustomInterests(customInput); }
                }}
                placeholder={t("customInterestPlaceholder")}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
              />
              <button
                type="button"
                onClick={() => addCustomInterests(customInput)}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                {t("add")}
              </button>
            </div>
            <p className="text-xs text-gray-400">{t("customInterestExample")}</p>
          </div>
        )}

        {/* Custom interest tags */}
        {customInterests.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {customInterests.map(item => (
              <span key={item} className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-100 text-orange-800 rounded-full text-sm">
                {item}
                <button type="button" onClick={() => removeCustomInterest(item)}
                  className="ml-0.5 text-orange-500 hover:text-orange-700 font-bold">&times;</button>
              </span>
            ))}
          </div>
        )}

        {interests.includes("ai_assisted") && (
          <p className="text-xs text-orange-600 pl-1">
            {t("atlasWillRefine")}
          </p>
        )}
      </div>

      {/* Submit */}
      <div className="pt-4 border-t border-gray-200 flex gap-3">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="flex-1 border border-gray-300 text-gray-700 py-4 rounded-lg font-medium hover:bg-gray-50 transition-colors">
            {t("cancel")}
          </button>
        )}
        <button type="submit" disabled={loading}
          className="flex-1 bg-orange-600 text-white py-4 rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-60">
          {loading ? t("creatingTrip") : t("startPlanning")}
        </button>
      </div>
    </form>
  );
}

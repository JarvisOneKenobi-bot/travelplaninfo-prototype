"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useGeolocateOrigin } from "@/hooks/useGeolocateOrigin";
import { usePlacesAutocomplete } from "@/hooks/usePlacesAutocomplete";

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
  const { origin: geoOrigin } = useGeolocateOrigin();
  const [prefFetched, setPrefFetched] = useState(false);

  const [origin, setOrigin] = useState("");
  const [includeNearby, setIncludeNearby] = useState(true);
  const [destination, setDestination] = useState("");
  const [tripName, setTripName] = useState("");
  const [tripType, setTripType] = useState<"round_trip" | "one_way">("round_trip");
  const [wantHotel, setWantHotel] = useState(true);
  const [wantCar, setWantCar] = useState(false);
  const [wantLimo, setWantLimo] = useState(false);

  const originRef = useRef<HTMLInputElement>(null);
  const destinationRef = useRef<HTMLInputElement>(null);

  usePlacesAutocomplete(originRef, {
    types: ["airport", "(cities)"],
    onSelect: (place) => setOrigin(place.name + (place.iataCode ? ` (${place.iataCode})` : "")),
  });

  usePlacesAutocomplete(destinationRef, {
    types: ["(cities)"],
    onSelect: (place) => setDestination(place.name),
  });

  // Pre-fill origin from user preferences on mount (takes priority over geo)
  useEffect(() => {
    fetch("/api/user/preferences")
      .then(r => r.ok ? r.json() : null)
      .then(prefs => {
        if (prefs?.home_airport) setOrigin(prefs.home_airport.toUpperCase());
      })
      .catch(() => {})
      .finally(() => {
        setPrefFetched(true);
      });
  }, []);

  // Auto-fill origin from IP geolocation only if prefs didn't set one
  useEffect(() => {
    if (prefFetched && !origin && geoOrigin.code) {
      setOrigin(`${geoOrigin.name} (${geoOrigin.code})`);
    }
  }, [prefFetched, geoOrigin.code, origin]);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [flexibleDates, setFlexibleDates] = useState(false);
  const [flexibleWindow, setFlexibleWindow] = useState("next_month");
  const [tripLength, setTripLength] = useState("week");
  const [atlasDecidesDates, setAtlasDecidesDates] = useState(false);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState(1);
  const [budget] = useState("midrange");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Listen for prefill-destination events from other components
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail?.destination) {
        setDestination(e.detail.destination);
      }
    };
    window.addEventListener("prefill-destination", handler as EventListener);
    return () => window.removeEventListener("prefill-destination", handler as EventListener);
  }, []);

  // Expose form state to Atlas via window.__atlasFormContext
  useEffect(() => {
    (window as any).__atlasFormContext = {
      destination,
      origin,
      adults,
      children,
      rooms,
      flexibleDates,
      flexibleWindow: flexibleDates ? flexibleWindow : null,
      tripLength: flexibleDates ? tripLength : null,
    };
    return () => { delete (window as any).__atlasFormContext; };
  }, [destination, origin, adults, children, rooms, flexibleDates, flexibleWindow, tripLength]);

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
        interests: [],
        origin: origin.trim().toUpperCase(),
        include_nearby_airports: includeNearby,
        nearby_airports: includeNearby && NEARBY_AIRPORTS[origin.trim().toUpperCase()]
          ? NEARBY_AIRPORTS[origin.trim().toUpperCase()].airports
          : [origin.trim().toUpperCase()],
        origin_auto: geoOrigin.code || null,
        trip_type: tripType,
        want_hotel: wantHotel,
        want_car: wantCar,
        want_limo: wantLimo,
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

      {/* Row 1: Departing from */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">1</span>
          <h2 className="text-xl font-bold text-gray-900">{t("departingFrom")}</h2>
        </div>
        <div className="flex gap-3">
          <input
            ref={originRef}
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

      {/* Trip type + services + trip name row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Round trip / One way toggle */}
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm font-medium">
          <button
            type="button"
            onClick={() => setTripType("round_trip")}
            className={[
              "px-4 py-2 transition-colors",
              tripType === "round_trip"
                ? "bg-orange-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50",
            ].join(" ")}
          >
            {t("roundTrip")}
          </button>
          <button
            type="button"
            onClick={() => setTripType("one_way")}
            className={[
              "px-4 py-2 transition-colors border-l border-gray-300",
              tripType === "one_way"
                ? "bg-orange-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50",
            ].join(" ")}
          >
            {t("oneWay")}
          </button>
        </div>

        {/* Service checkboxes */}
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={wantHotel}
            onChange={e => setWantHotel(e.target.checked)}
            className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
          />
          {t("hotel")}
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={wantCar}
            onChange={e => setWantCar(e.target.checked)}
            className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
          />
          {t("carRental")}
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={wantLimo}
            onChange={e => setWantLimo(e.target.checked)}
            className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
          />
          {t("limo")}
        </label>

        {/* Trip Name */}
        <input
          type="text"
          value={tripName}
          onChange={e => setTripName(e.target.value)}
          placeholder={t("tripNamePlaceholder")}
          className="flex-1 min-w-[180px] px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Row 2: Destination */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</span>
          <h2 className="text-xl font-bold text-gray-900">{t("whereAreYouGoing")}</h2>
        </div>

        <input
          ref={destinationRef}
          type="text"
          required
          value={destination}
          onChange={e => { setDestination(e.target.value); window.dispatchEvent(new Event("atlas-interaction")); }}
          placeholder={t("destinationPlaceholder")}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>

      {/* Row 3: Dates */}
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

      {/* Row 4: Travelers */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">4</span>
          <h2 className="text-xl font-bold text-gray-900">{t("whoIsTraveling")}</h2>
        </div>
        <div className={`grid gap-4 ${wantHotel ? "grid-cols-3" : "grid-cols-2"}`}>
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
          {wantHotel && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("rooms")}</label>
              <select value={rooms} onChange={e => setRooms(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}
        </div>
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

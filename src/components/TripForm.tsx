"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePlacesAutocomplete } from "@/hooks/usePlacesAutocomplete";
import PackageDealsCarousel from "./PackageDealsCarousel";

const INTERESTS = [
  { value: "beach", icon: "🏖️" },
  { value: "culture", icon: "🏛️" },
  { value: "food", icon: "🍜" },
  { value: "nightlife", icon: "🎭" },
  { value: "nature", icon: "🚶" },
  { value: "city", icon: "🛍️" },
  { value: "family", icon: "🎡" },
  { value: "adventure", icon: "🏔️" },
  { value: "wellness", icon: "🌅" },
  { value: "cruise", icon: "🚢" },
  { value: "luxury", icon: "🍷" },
  { value: "budget", icon: "📸" },
  { value: "backpacking", icon: "🏕️" },
  { value: "romance", icon: "💕" },
  { value: "family_travel", icon: "👨‍👩‍👧‍👦" },
];

const VIBES = [
  { value: "tropical", icon: "🌴", label: "Tropical" },
  { value: "mountains", icon: "🏔️", label: "Mountains" },
  { value: "big_city", icon: "🏙️", label: "Big City" },
  { value: "beach", icon: "🌊", label: "Beach" },
  { value: "winter", icon: "❄️", label: "Winter Escape" },
  { value: "cultural", icon: "🏛️", label: "Cultural" },
  { value: "adventure", icon: "🏕️", label: "Adventure" },
];

const BUDGET_VALUES = [
  { value: "budget", icon: "💰" },
  { value: "midrange", icon: "💵" },
  { value: "luxury", icon: "💎" },
];

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

  // ── Mode: chooser → flight | explore ──
  const [mode, setMode] = useState<'chooser' | 'flight' | 'explore'>('chooser');

  // ── Shared state ──
  const [origin, setOrigin] = useState("");
  const [includeNearby, setIncludeNearby] = useState(true);
  const [destination, setDestination] = useState("");
  const [tripName, setTripName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [flexibleDates, setFlexibleDates] = useState(false);
  const [flexibleWindow, setFlexibleWindow] = useState("next_month");
  const [tripLength, setTripLength] = useState("week");
  const [customWindowValue, setCustomWindowValue] = useState(1);
  const [customWindowUnit, setCustomWindowUnit] = useState<'days' | 'weeks' | 'months'>('months');
  const [customLengthValue, setCustomLengthValue] = useState(7);
  const [customLengthUnit, setCustomLengthUnit] = useState<'days' | 'weeks' | 'months'>('days');
  const [atlasDecidesDates, setAtlasDecidesDates] = useState(false);
  const [tripType, setTripType] = useState<'round_trip' | 'one_way'>('round_trip');
  const [wantHotel, setWantHotel] = useState(false);
  const [wantCar, setWantCar] = useState(false);
  const [wantLimo, setWantLimo] = useState(false);
  const [wantActivities, setWantActivities] = useState(false);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState(1);
  const [budget, setBudget] = useState("midrange");
  const [budgetMode, setBudgetMode] = useState<'preset' | 'total' | 'per_day' | 'per_person'>('preset');
  const [budgetAmount, setBudgetAmount] = useState<number | null>(null);
  const [budgetCategories, setBudgetCategories] = useState<Record<string, number | undefined>>({});
  const [showFineTune, setShowFineTune] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [surpriseMe, setSurpriseMe] = useState(false);
  const [vibes, setVibes] = useState<string[]>([]);
  const [customVibes, setCustomVibes] = useState<string[]>([]);
  const [showCustomVibes, setShowCustomVibes] = useState(false);
  const [customVibeInput, setCustomVibeInput] = useState("");
  const [destinationHint, setDestinationHint] = useState("");
  const [showCustomInterests, setShowCustomInterests] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [customInterests, setCustomInterests] = useState<string[]>([]);
  const [customAdultsMode, setCustomAdultsMode] = useState(false);
  const [customChildrenMode, setCustomChildrenMode] = useState(false);
  const [customRoomsMode, setCustomRoomsMode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Pre-fill origin from user preferences on mount
  useEffect(() => {
    fetch("/api/user/preferences")
      .then(r => r.ok ? r.json() : null)
      .then(prefs => {
        if (prefs?.home_airport) setOrigin(prefs.home_airport.toUpperCase());
      })
      .catch(() => {});
  }, []);

  // ── Refs + Places Autocomplete ──
  const destinationRef = useRef<HTMLInputElement>(null);
  const originRef = useRef<HTMLInputElement>(null);

  usePlacesAutocomplete(destinationRef, {
    types: ['(cities)'],
    enabled: mode === 'flight',
    onSelect: (place) => {
      setDestination(place.name);
      window.dispatchEvent(new Event('atlas-interaction'));
    },
  });

  usePlacesAutocomplete(originRef, {
    types: ['airport'],
    enabled: mode !== 'chooser',
    onSelect: (place) => {
      const code = place.iataCode || place.name.match(/\(([A-Z]{3})\)/)?.[1] || place.name;
      setOrigin(code.toUpperCase());
      window.dispatchEvent(new Event('atlas-interaction'));
    },
  });

  // Auto-set rooms when hotel unchecked
  useEffect(() => {
    if (!wantHotel) setRooms(0);
    else setRooms(r => r === 0 ? 1 : r);
  }, [wantHotel]);

  // Expose form state to Atlas
  useEffect(() => {
    (window as any).__atlasFormContext = {
      mode,
      destination: surpriseMe ? (destinationHint || "Surprise Me") : destination,
      vibes: surpriseMe ? [...vibes, ...customVibes.map(v => `custom:${v}`)] : [],
      interests: [...interests, ...customInterests],
      budget,
      budgetMode,
      budgetAmount: budgetMode !== 'preset' ? budgetAmount : null,
      budgetCategories: budgetMode !== 'preset' ? budgetCategories : null,
      origin,
      adults,
      children,
      rooms,
      flexibleDates,
      flexibleWindow: flexibleDates
        ? (atlasDecidesDates ? "any" : (flexibleWindow === 'custom' ? `custom:${customWindowValue}:${customWindowUnit}` : flexibleWindow))
        : null,
      tripLength: flexibleDates
        ? (atlasDecidesDates ? "any" : (tripLength === 'custom' ? `custom:${customLengthValue}:${customLengthUnit}` : tripLength))
        : null,
      startDate: flexibleDates ? null : (startDate || null),
      endDate: (flexibleDates || tripType === 'one_way') ? null : (endDate || null),
      surpriseMe,
      tripType,
      wantHotel,
      wantCar,
      wantLimo,
      wantActivities,
      atlasDecidesDates,
    };
    return () => { delete (window as any).__atlasFormContext; };
  }, [mode, destination, vibes, customVibes, interests, customInterests, budget, budgetMode, budgetAmount, budgetCategories, origin, adults, children, rooms, flexibleDates, flexibleWindow, tripLength, startDate, endDate, surpriseMe, destinationHint, tripType, wantHotel, wantCar, wantLimo, wantActivities, atlasDecidesDates, customWindowValue, customWindowUnit, customLengthValue, customLengthUnit]);

  // ── Mode transitions (with browser history support) ──
  function selectMode(m: 'flight' | 'explore') {
    setError("");
    setMode(m);
    window.history.pushState({ tripFormMode: m }, '', window.location.pathname);
    if (m === 'explore') {
      setSurpriseMe(true);
      setDestination('Surprise Me');
      setFlexibleDates(true);
      setWantHotel(true);
      setWantActivities(true);
    } else {
      setSurpriseMe(false);
      setDestination('');
      setVibes([]);
      setCustomVibes([]);
      setDestinationHint('');
      setInterests([]);
      setCustomInterests([]);
      setBudget("midrange");
      setBudgetMode('preset');
      setBudgetAmount(null);
      setBudgetCategories({});
      setShowFineTune(false);
      setWantHotel(false);
      setWantCar(false);
      setWantLimo(false);
      setWantActivities(false);
    }
  }

  function goBackToChooser() {
    setError("");
    setMode('chooser');
    // Origin persists — intentional
  }

  // Browser back button returns to chooser instead of leaving the page
  useEffect(() => {
    function handlePopState(e: PopStateEvent) {
      if (mode !== 'chooser') {
        setMode('chooser');
        setError("");
      }
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [mode]);

  // ── Handlers ──
  function toggleInterest(interest: string) {
    window.dispatchEvent(new Event("atlas-interaction"));
    setInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  }

  function toggleVibe(vibe: string) {
    window.dispatchEvent(new Event("atlas-interaction"));
    setVibes(prev =>
      prev.includes(vibe) ? prev.filter(v => v !== vibe) : [...prev, vibe]
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

  function addCustomVibes(raw: string) {
    const items = raw.split(/[,\n]/).map(s => s.trim().toLowerCase()).filter(Boolean);
    const newOnes = items.filter(i => !customVibes.includes(i) && !VIBES.some(v => v.value === i));
    if (newOnes.length > 0) setCustomVibes(prev => [...prev, ...newOnes]);
    setCustomVibeInput("");
  }

  function removeCustomVibe(item: string) {
    setCustomVibes(prev => prev.filter(v => v !== item));
  }

  function selectPresetBudget(value: string) {
    setBudget(value);
    setBudgetMode('preset');
    setBudgetAmount(null);
    setBudgetCategories({});
    setShowFineTune(false);
  }

  function selectCustomBudget(scope: 'total' | 'per_day' | 'per_person') {
    setBudget('');
    setBudgetMode(scope);
  }

  function updateBudgetCategory(key: string, value: string) {
    const num = value === '' ? undefined : Number(value);
    setBudgetCategories(prev => ({ ...prev, [key]: num }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!surpriseMe && !destination.trim()) {
      setError(t("pleaseEnterDestination"));
      return;
    }

    if (surpriseMe) {
      const totalInterests = interests.length + customInterests.length;
      if (totalInterests < 2) {
        setError(t("pickAtLeast2"));
        return;
      }
    }

    const finalDestination = surpriseMe
      ? (destinationHint.trim() || "Surprise Me")
      : destination.trim();

    const finalInterests = surpriseMe
      ? [
          ...interests,
          ...customInterests.map(c => `custom:${c}`),
          ...vibes.map(v => `vibe:${v}`),
          ...customVibes.map(v => `vibe:custom:${v}`),
        ]
      : [...interests, ...customInterests.map(c => `custom:${c}`)];

    if (budgetMode !== 'preset' && (!budgetAmount || budgetAmount <= 0)) {
      setError(t("budgetAmountRequired"));
      return;
    }

    setLoading(true);
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: tripName.trim() || `Trip to ${finalDestination}`,
        destination: finalDestination,
        start_date: flexibleDates ? null : (startDate || null),
        end_date: (flexibleDates || tripType === 'one_way') ? null : (endDate || null),
        flexible_window: flexibleDates
          ? (atlasDecidesDates ? "any" : (flexibleWindow === 'custom' ? `custom:${customWindowValue}:${customWindowUnit}` : flexibleWindow))
          : null,
        trip_length: flexibleDates
          ? (atlasDecidesDates ? "any" : (tripLength === 'custom' ? `custom:${customLengthValue}:${customLengthUnit}` : tripLength))
          : null,
        budget,
        travelers_adults: adults,
        travelers_children: children,
        rooms,
        interests: finalInterests,
        origin: origin.trim().toUpperCase(),
        include_nearby_airports: includeNearby,
        nearby_airports: includeNearby && NEARBY_AIRPORTS[origin.trim().toUpperCase()]
          ? NEARBY_AIRPORTS[origin.trim().toUpperCase()].airports
          : [origin.trim().toUpperCase()],
        trip_type: tripType,
        want_hotel: wantHotel,
        want_car: wantCar,
        want_limo: wantLimo,
        want_activities: wantActivities,
        budget_mode: budgetMode,
        budget_amount: budgetMode !== 'preset' ? budgetAmount : null,
        budget_categories: budgetMode !== 'preset' && showFineTune
          ? Object.fromEntries(Object.entries(budgetCategories).filter(([_, v]) => v != null))
          : null,
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

  const totalInterestsSelected = interests.length + customInterests.length;

  // ── Explore mode section validation (green border when complete) ──
  const vibesComplete = vibes.length + customVibes.length >= 1;
  const interestsComplete = totalInterestsSelected >= 2;
  const budgetComplete = budgetMode === 'preset' || (budgetAmount != null && budgetAmount > 0);
  const travelDetailsComplete = origin.trim().length >= 3;

  const sectionBorder = (complete: boolean) =>
    `rounded-xl p-5 space-y-3 border-2 transition-colors ${complete ? 'border-green-400' : 'border-gray-200'}`;
  const sectionBorder4 = (complete: boolean) =>
    `rounded-xl p-5 space-y-4 border-2 transition-colors ${complete ? 'border-green-400' : 'border-gray-200'}`;

  // ── Shared sub-sections ──
  const nearbyAirportsHint = origin.trim().length >= 3 && NEARBY_AIRPORTS[origin.trim().toUpperCase()] ? (
    <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-500">
      <input type="checkbox" checked={includeNearby} onChange={e => setIncludeNearby(e.target.checked)}
        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500" />
      {t("searchNearbyAirports")} {NEARBY_AIRPORTS[origin.trim().toUpperCase()].airports.filter(a => a !== origin.trim().toUpperCase()).join(", ")}
    </label>
  ) : null;

  const flexDatesRow = (
    <div className="flex items-center gap-3 flex-wrap">
      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
        <input type="checkbox" checked={flexibleDates}
          onChange={e => { setFlexibleDates(e.target.checked); if (!e.target.checked) setAtlasDecidesDates(false); }}
          className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500" />
        {t("flexibleDates")}
      </label>
      {flexibleDates && (
        <span className="inline-flex items-center gap-1">
          <button type="button" onClick={() => setAtlasDecidesDates(!atlasDecidesDates)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              atlasDecidesDates ? 'bg-orange-100 border-orange-400 text-orange-800' : 'border-gray-300 text-gray-500 hover:border-orange-300'
            }`}>
            {t("atlasFindCheapestDates")}
          </button>
          <span className="relative group">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold cursor-help leading-none">i</span>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 px-3 py-2 rounded-lg bg-gray-800 text-white text-xs leading-snug opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 text-center">
              {t("atlasDecidesTooltip")}
            </span>
          </span>
        </span>
      )}
    </div>
  );

  const servicePills = (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => setWantHotel(!wantHotel)}
        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
          wantHotel ? 'bg-orange-100 border-orange-400 text-orange-800' : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400'
        }`}>
        🏨 {t("hotel")} {wantHotel && '✓'}
      </button>
      <button type="button" onClick={() => setWantCar(!wantCar)}
        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
          wantCar ? 'bg-orange-100 border-orange-400 text-orange-800' : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400'
        }`}>
        🚗 {t("carRental")} {wantCar && '✓'}
      </button>
      <button type="button" onClick={() => setWantLimo(!wantLimo)}
        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
          wantLimo ? 'bg-orange-100 border-orange-400 text-orange-800' : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400'
        }`}>
        🚐 {t("limoService")} {wantLimo && '✓'}
      </button>
      <button type="button" onClick={() => setWantActivities(!wantActivities)}
        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
          wantActivities ? 'bg-orange-100 border-orange-400 text-orange-800' : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400'
        }`}>
        🎯 {t("dailyActivities")} {wantActivities && '✓'}
      </button>
    </div>
  );

  const selectCls = "w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm";

  function travelerField(
    value: number, onChange: (n: number) => void, min: number,
    isCustom: boolean, setCustom: (v: boolean) => void,
  ) {
    const cap = 6;
    if (isCustom) {
      return (
        <div className="flex items-center gap-1">
          <input type="number" min={min} value={value}
            onChange={e => onChange(Math.max(min, Number(e.target.value) || min))}
            className={selectCls} autoFocus />
          <button type="button" onClick={() => { onChange(Math.min(value, cap)); setCustom(false); }}
            className="text-xs text-gray-400 hover:text-orange-600 shrink-0">✕</button>
        </div>
      );
    }
    return (
      <select value={value > cap ? 'custom' : value} onChange={e => {
        if (e.target.value === 'custom') { onChange(cap + 1); setCustom(true); }
        else onChange(Number(e.target.value));
      }} className={selectCls}>
        {Array.from({ length: cap - min + 1 }, (_, i) => i + min).map(n => (
          <option key={n} value={n}>{n}</option>
        ))}
        <option value="custom">{t("customQuantity")}</option>
      </select>
    );
  }

  const submitRow = (
    <div className="flex gap-3 pt-2">
      {onCancel && (
        <button type="button" onClick={onCancel}
          className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm">
          {t("cancel")}
        </button>
      )}
      <button type="submit" disabled={loading}
        className="flex-1 bg-orange-600 text-white py-2.5 rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-60 text-sm">
        {loading ? t("creatingTrip") : (mode === 'explore' ? t("letAtlasPlan") : t("startPlanning"))}
      </button>
    </div>
  );

  // ════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* ═══════════════════════════════════════
          BRANCH 1: CHOOSER
          ═══════════════════════════════════════ */}
      {mode === 'chooser' && (
        <div className="space-y-6">
          {onCancel && (
            <button type="button" onClick={onCancel}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              {t("cancel")}
            </button>
          )}

          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-gray-900">{t("chooserTitle")}</h2>
            <p className="text-sm text-gray-500">{t("chooserSubtitle")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card A */}
            <button type="button" onClick={() => selectMode('flight')}
              className="group p-6 rounded-2xl border-2 border-gray-200 hover:border-orange-400 hover:shadow-lg transition-all text-left space-y-3">
              <div className="text-3xl">✈️</div>
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-orange-600 transition-colors">
                {t("pathATitle")}
              </h3>
              <p className="text-sm text-gray-500">{t("pathADesc")}</p>
              <div className="flex flex-wrap gap-1.5 pt-2">
                <span className="text-xs px-2 py-0.5 bg-orange-50 rounded-full text-orange-600">{t("flightsTag")}</span>
                <span className="text-xs px-2 py-0.5 bg-orange-50 rounded-full text-orange-600">{t("datesTag")}</span>
                <span className="text-xs px-2 py-0.5 bg-orange-50 rounded-full text-orange-600">{t("destinationTag")}</span>
              </div>
            </button>

            {/* Card B */}
            <button type="button" onClick={() => selectMode('explore')}
              className="group p-6 rounded-2xl border-2 border-gray-200 hover:border-pink-400 hover:shadow-lg transition-all text-left space-y-3">
              <div className="text-3xl">🌍</div>
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-pink-600 transition-colors">
                {t("pathBTitle")}
              </h3>
              <p className="text-sm text-gray-500">{t("pathBDesc")}</p>
              <div className="flex flex-wrap gap-1.5 pt-2">
                <span className="text-xs px-2 py-0.5 bg-pink-50 rounded-full text-pink-600">{t("vibesTag")}</span>
                <span className="text-xs px-2 py-0.5 bg-pink-50 rounded-full text-pink-600">{t("interestsTag")}</span>
                <span className="text-xs px-2 py-0.5 bg-pink-50 rounded-full text-pink-600">{t("packagesTag")}</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          BRANCH 2: PATH A — "I Know When & Where"
          ═══════════════════════════════════════ */}
      {mode === 'flight' && (
        <>
          <button type="button" onClick={goBackToChooser}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-orange-600 border border-gray-300 hover:border-orange-300 px-3 py-1.5 rounded-lg transition-colors">
            ← {t("backToChooser")}
          </button>

          {/* Row 1: Trip type + Service pills + Trip name */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg border border-gray-300 overflow-hidden shrink-0">
              <button type="button" onClick={() => setTripType('round_trip')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  tripType === 'round_trip' ? 'bg-orange-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}>
                {t("roundTrip")}
              </button>
              <button type="button" onClick={() => setTripType('one_way')}
                className={`px-4 py-2 text-sm font-medium border-l border-gray-300 transition-colors ${
                  tripType === 'one_way' ? 'bg-orange-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}>
                {t("oneWay")}
              </button>
            </div>
            <span className="text-gray-300 shrink-0">|</span>
            {servicePills}
            <span className="text-gray-300 shrink-0">|</span>
            <input type="text" value={tripName} onChange={e => setTripName(e.target.value)}
              placeholder={t("tripNamePlaceholder")}
              className="flex-1 min-w-[140px] px-3 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
          </div>

          {/* Origin | Destination | Dates */}
          <div className="space-y-3">
            <div className={`grid gap-3 grid-cols-1 ${tripType === 'one_way' ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("departingFrom")}</label>
                <input ref={originRef} type="text" value={origin}
                  onChange={e => setOrigin(e.target.value)}
                  placeholder={t("airportCodePlaceholder")}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("whereAreYouGoing")}</label>
                <input ref={destinationRef} type="text" value={destination}
                  onChange={e => { setDestination(e.target.value); window.dispatchEvent(new Event("atlas-interaction")); }}
                  placeholder={t("destinationPlaceholder")}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
              </div>
              {!flexibleDates ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      {tripType === 'one_way' ? t("departureDate") : t("checkIn")}
                    </label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                  </div>
                  {tripType === 'round_trip' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{t("returnDate")}</label>
                      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                    </div>
                  )}
                </>
              ) : (
                <>
                  {!atlasDecidesDates && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t("whenAreYouThinking")}</label>
                        {flexibleWindow !== 'custom' ? (
                          <select value={flexibleWindow} onChange={e => setFlexibleWindow(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm">
                            <option value="next_2_weeks">{t("next2Weeks")}</option>
                            <option value="next_month">{t("nextMonth")}</option>
                            <option value="2_3_months">{t("in2To3Months")}</option>
                            <option value="6_months">{t("in6Months")}</option>
                            <option value="this_year">{t("anytimeThisYear")}</option>
                            <option value="custom">{t("customDateOption")}</option>
                          </select>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600 shrink-0">{t("customDateIn")}</span>
                            <input type="number" min="1" max="365" value={customWindowValue}
                              onChange={e => setCustomWindowValue(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
                              className="w-16 px-2 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm text-center" />
                            <select value={customWindowUnit} onChange={e => setCustomWindowUnit(e.target.value as 'days' | 'weeks' | 'months')}
                              className="px-2 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm">
                              <option value="days">{t("customDateDays")}</option>
                              <option value="weeks">{t("customDateWeeks")}</option>
                              <option value="months">{t("customDateMonths")}</option>
                            </select>
                            <button type="button" onClick={() => setFlexibleWindow('next_month')}
                              className="text-xs text-gray-500 hover:text-orange-600 shrink-0">✕</button>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t("howLong")}</label>
                        {tripLength !== 'custom' ? (
                          <select value={tripLength} onChange={e => setTripLength(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm">
                            <option value="weekend">{t("weekend")}</option>
                            <option value="week">{t("aboutAWeek")}</option>
                            <option value="10_14_days">{t("10To14Days")}</option>
                            <option value="2_plus_weeks">{t("2PlusWeeks")}</option>
                            <option value="custom">{t("customDateOption")}</option>
                          </select>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input type="number" min="1" max="365" value={customLengthValue}
                              onChange={e => setCustomLengthValue(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
                              className="w-16 px-2 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm text-center" />
                            <select value={customLengthUnit} onChange={e => setCustomLengthUnit(e.target.value as 'days' | 'weeks' | 'months')}
                              className="px-2 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm">
                              <option value="days">{t("customDateDays")}</option>
                              <option value="weeks">{t("customDateWeeks")}</option>
                              <option value="months">{t("customDateMonths")}</option>
                            </select>
                            <button type="button" onClick={() => setTripLength('week')}
                              className="text-xs text-gray-500 hover:text-orange-600 shrink-0">✕</button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Sub-row: nearby airports + flex dates */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>{nearbyAirportsHint}</div>
              <div />
              <div className="md:col-span-2">{flexDatesRow}</div>
            </div>
          </div>

          {/* Row 3: Travelers (50%) + CTA (50%) */}
          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("adults")}</label>
                {travelerField(adults, setAdults, 1, customAdultsMode, setCustomAdultsMode)}
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("children")}</label>
                {travelerField(children, setChildren, 0, customChildrenMode, setCustomChildrenMode)}
              </div>
              {wantHotel && (
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t("rooms")}</label>
                  {travelerField(rooms, setRooms, 1, customRoomsMode, setCustomRoomsMode)}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              {onCancel && (
                <button type="button" onClick={onCancel}
                  className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm">
                  {t("cancel")}
                </button>
              )}
              <button type="submit" disabled={loading}
                className="flex-1 bg-orange-600 text-white py-2.5 rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-60 text-sm">
                {loading ? t("creatingTrip") : t("startPlanning")}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════
          BRANCH 3: PATH B — "Surprise Me! (I'm Flexible)"
          ═══════════════════════════════════════ */}
      {mode === 'explore' && (
        <>
          <button type="button" onClick={goBackToChooser}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-orange-600 border border-gray-300 hover:border-orange-300 px-3 py-1.5 rounded-lg transition-colors">
            ← {t("backToChooser")}
          </button>

          {/* ══ SECTION 1: Vibes ══ */}
          <div className={sectionBorder(vibesComplete)}>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{t("whatVibes")}</h3>
            <div className="flex flex-wrap gap-2">
              {VIBES.map(v => (
                <button key={v.value} type="button" onClick={() => toggleVibe(v.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    vibes.includes(v.value)
                      ? 'bg-pink-100 border-pink-400 text-pink-800'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-pink-300'
                  }`}>
                  {v.icon} {v.label}
                </button>
              ))}
              {customVibes.map(c => (
                <button key={c} type="button" onClick={() => removeCustomVibe(c)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium bg-pink-100 border border-pink-400 text-pink-800">
                  {c} ✕
                </button>
              ))}
              <button type="button" onClick={() => setShowCustomVibes(!showCustomVibes)}
                className="px-3 py-1.5 rounded-full text-sm font-medium border border-dashed border-gray-400 text-gray-500 hover:border-pink-400 hover:text-pink-600 transition-colors">
                + {t("addYourOwn")}
              </button>
            </div>
            {showCustomVibes && (
              <div className="flex gap-2 items-center">
                <input type="text" value={customVibeInput} onChange={e => setCustomVibeInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomVibes(customVibeInput); } }}
                  placeholder={t("customVibesPlaceholder")}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm" />
                <button type="button" onClick={() => addCustomVibes(customVibeInput)}
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-medium hover:bg-pink-700 transition-colors">
                  {t("add")}
                </button>
              </div>
            )}
          </div>

          {/* ══ SECTION 2: Interests ══ */}
          <div className={sectionBorder(interestsComplete)}>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{t("interestsLabel")}</h3>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map(i => (
                <button key={i.value} type="button" onClick={() => toggleInterest(i.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    interests.includes(i.value)
                      ? 'bg-orange-100 border-orange-400 text-orange-800'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-orange-300'
                  }`}>
                  {i.icon} {tInterests(i.value)}
                </button>
              ))}
              {customInterests.map(c => (
                <button key={c} type="button" onClick={() => removeCustomInterest(c)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium bg-orange-100 border border-orange-400 text-orange-800">
                  {c} ✕
                </button>
              ))}
              <button type="button" onClick={() => setShowCustomInterests(!showCustomInterests)}
                className="px-3 py-1.5 rounded-full text-sm font-medium border border-dashed border-gray-400 text-gray-500 hover:border-orange-400 hover:text-orange-600 transition-colors">
                + {t("addYourOwn")}
              </button>
            </div>
            {showCustomInterests && (
              <div className="flex gap-2 items-center">
                <input type="text" value={customInput} onChange={e => setCustomInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomInterests(customInput); } }}
                  placeholder={t("customInterestExample")}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                <button type="button" onClick={() => addCustomInterests(customInput)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors">
                  {t("add")}
                </button>
              </div>
            )}
            {totalInterestsSelected === 0 && (
              <p className="text-xs text-pink-600">{t("pickAtLeast2")}</p>
            )}
            {totalInterestsSelected === 1 && (
              <p className="text-xs text-pink-600">{t("pickAtLeast1More")}</p>
            )}
          </div>

          {/* ══ SECTION 3: Budget + Services ══ */}
          <div className={sectionBorder4(budgetComplete)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{t("budgetLabel")}</h3>
                <div className="flex flex-wrap gap-2">
                  {BUDGET_VALUES.map(b => (
                    <button key={b.value} type="button" onClick={() => selectPresetBudget(b.value)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        budgetMode === 'preset' && budget === b.value
                          ? 'bg-orange-100 border-orange-400 text-orange-800'
                          : 'bg-white border-gray-300 text-gray-600 hover:border-orange-300'
                      }`}>
                      {b.icon} {t(b.value)}
                    </button>
                  ))}
                  <button type="button" onClick={() => selectCustomBudget('total')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      budgetMode !== 'preset'
                        ? 'bg-orange-100 border-orange-400 text-orange-800'
                        : 'border-dashed border-gray-400 text-gray-500 hover:border-orange-400 hover:text-orange-600'
                    }`}>
                    + {t("addYourOwn")}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{t("whatDoYouNeed")}</h3>
                {servicePills}
              </div>
            </div>
            {budgetMode !== 'preset' && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(['total', 'per_day', 'per_person'] as const).map(scope => (
                    <button key={scope} type="button" onClick={() => selectCustomBudget(scope)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        budgetMode === scope
                          ? 'bg-orange-600 text-white border-orange-600'
                          : 'bg-white border-gray-300 text-gray-600 hover:border-orange-300'
                      }`}>
                      {t(`budgetScope_${scope}`)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-orange-700">$</span>
                  <input type="number" min={0} value={budgetAmount ?? ''} onChange={e => setBudgetAmount(e.target.value === '' ? null : Number(e.target.value))}
                    placeholder={t("budgetAmountPlaceholder")}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className="relative" onClick={() => setShowFineTune(!showFineTune)}>
                    <div className={`w-9 h-5 rounded-full transition-colors ${showFineTune ? 'bg-orange-500' : 'bg-gray-300'}`} />
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showFineTune ? 'translate-x-4' : ''}`} />
                  </div>
                  <span className="text-xs font-medium text-gray-600">{t("fineTuneCategories")}</span>
                </label>
                {showFineTune && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {['flights', 'activities', 'food'].map(cat => (
                      <div key={cat}>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t(`budgetCat_${cat}`)}</label>
                        <input type="number" min={0} value={budgetCategories[cat] ?? ''} onChange={e => updateBudgetCategory(cat, e.target.value)}
                          placeholder="$" className="w-full px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                      </div>
                    ))}
                    {wantHotel && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t("budgetCat_accommodation")}</label>
                        <input type="number" min={0} value={budgetCategories['accommodation'] ?? ''} onChange={e => updateBudgetCategory('accommodation', e.target.value)}
                          placeholder="$" className="w-full px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                      </div>
                    )}
                    {(wantCar || wantLimo) && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t("budgetCat_transport")}</label>
                        <input type="number" min={0} value={budgetCategories['transport'] ?? ''} onChange={e => updateBudgetCategory('transport', e.target.value)}
                          placeholder="$" className="w-full px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                      </div>
                    )}
                    {interests.includes('cruise') && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t("budgetCat_cruise")}</label>
                        <input type="number" min={0} value={budgetCategories['cruise'] ?? ''} onChange={e => updateBudgetCategory('cruise', e.target.value)}
                          placeholder="$" className="w-full px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ══ SECTION 4: Travel Details + CTA ══ */}
          <div className={sectionBorder4(travelDetailsComplete)}>
            {/* Row: Destination | Origin */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("destinationHintLabel")}</label>
                <input type="text" value={destinationHint}
                  onChange={e => setDestinationHint(e.target.value)}
                  placeholder={t("destinationHintPlaceholder")}
                  className="w-full px-3 py-2.5 rounded-lg border-2 border-pink-300 bg-pink-50 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t("departingFrom")}</label>
                <input ref={originRef} type="text" value={origin}
                  onChange={e => setOrigin(e.target.value)}
                  placeholder={t("airportCodePlaceholder")}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                {nearbyAirportsHint}
              </div>
            </div>
            {/* Row: When | How Long */}
            {!flexibleDates ? (
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t("checkIn")}</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t("returnDate")}</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                </div>
              </div>
            ) : (
              <>
                {!atlasDecidesDates && (
                  <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{t("whenAreYouThinking")}</label>
                      {flexibleWindow !== 'custom' ? (
                        <select value={flexibleWindow} onChange={e => setFlexibleWindow(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm">
                          <option value="next_2_weeks">{t("next2Weeks")}</option>
                          <option value="next_month">{t("nextMonth")}</option>
                          <option value="2_3_months">{t("in2To3Months")}</option>
                          <option value="6_months">{t("in6Months")}</option>
                          <option value="this_year">{t("anytimeThisYear")}</option>
                          <option value="custom">{t("customDateOption")}</option>
                        </select>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 shrink-0">{t("customDateIn")}</span>
                          <input type="number" min="1" max="365" value={customWindowValue}
                            onChange={e => setCustomWindowValue(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
                            className="w-16 px-2 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm text-center" />
                          <select value={customWindowUnit} onChange={e => setCustomWindowUnit(e.target.value as 'days' | 'weeks' | 'months')}
                            className="px-2 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm">
                            <option value="days">{t("customDateDays")}</option>
                            <option value="weeks">{t("customDateWeeks")}</option>
                            <option value="months">{t("customDateMonths")}</option>
                          </select>
                          <button type="button" onClick={() => setFlexibleWindow('next_month')}
                            className="text-xs text-gray-500 hover:text-orange-600 shrink-0">✕</button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{t("howLong")}</label>
                      {tripLength !== 'custom' ? (
                        <select value={tripLength} onChange={e => setTripLength(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm">
                          <option value="weekend">{t("weekend")}</option>
                          <option value="week">{t("aboutAWeek")}</option>
                          <option value="10_14_days">{t("10To14Days")}</option>
                          <option value="2_plus_weeks">{t("2PlusWeeks")}</option>
                          <option value="custom">{t("customDateOption")}</option>
                        </select>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input type="number" min="1" max="365" value={customLengthValue}
                            onChange={e => setCustomLengthValue(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
                            className="w-16 px-2 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm text-center" />
                          <select value={customLengthUnit} onChange={e => setCustomLengthUnit(e.target.value as 'days' | 'weeks' | 'months')}
                            className="px-2 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm">
                            <option value="days">{t("customDateDays")}</option>
                            <option value="weeks">{t("customDateWeeks")}</option>
                            <option value="months">{t("customDateMonths")}</option>
                          </select>
                          <button type="button" onClick={() => setTripLength('week')}
                            className="text-xs text-gray-500 hover:text-orange-600 shrink-0">✕</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
            {flexDatesRow}
            {/* Row: Travelers | CTA — 50/50 */}
            <div className="grid grid-cols-2 gap-4 items-end pt-2">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t("adults")}</label>
                  {travelerField(adults, setAdults, 1, customAdultsMode, setCustomAdultsMode)}
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t("children")}</label>
                  {travelerField(children, setChildren, 0, customChildrenMode, setCustomChildrenMode)}
                </div>
                {wantHotel && (
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t("rooms")}</label>
                    {travelerField(rooms, setRooms, 1, customRoomsMode, setCustomRoomsMode)}
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                {onCancel && (
                  <button type="button" onClick={onCancel}
                    className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm">
                    {t("cancel")}
                  </button>
                )}
                <button type="submit" disabled={loading}
                  className="flex-1 bg-orange-600 text-white py-2.5 rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-60 text-sm">
                  {loading ? t("creatingTrip") : t("letAtlasPlan")}
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center">{t("atlasWillRefine")}</p>
          </div>

          {/* ══ SECTION 5: Package Deals ══ */}
          <div className="rounded-xl border border-gray-200 p-5">
            <PackageDealsCarousel origin={origin} interests={[...interests, ...customInterests]} budget={budget} />
          </div>
        </>
      )}
    </form>
  );
}

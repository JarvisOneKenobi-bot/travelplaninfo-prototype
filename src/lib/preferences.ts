export const PREF_ENUMS = {
  budget_tier: ["budget", "mid", "luxury"] as const,
  currency_pref: ["USD", "EUR", "GBP", "CAD", "AUD"] as const,
  default_search_mode: ["flight_only", "flight_hotel", "flight_hotel_car", "flight_limo", "surprise_me"] as const,
  trip_length_pref: ["day_trip", "weekend", "week", "two_weeks", "month_plus"] as const,
  assistant_style: ["concise", "detailed", "friendly"] as const,
  interests: ["beach", "adventure", "culture", "food", "nightlife", "nature", "wellness", "family", "luxury", "budget", "cruise", "city", "backpacking", "business", "ai_assisted"] as const,
  language: ["en", "es", "pt", "fr", "de", "it"] as const,
} as const;

export interface UserPreferences {
  version: string;
  home_airport: string;
  home_city: string;
  budget_tier: (typeof PREF_ENUMS.budget_tier)[number];
  currency_pref: (typeof PREF_ENUMS.currency_pref)[number];
  party: {
    adults: number;
    children: number;
    has_pets: boolean;
    accessibility_needs: boolean;
  };
  default_search_mode: (typeof PREF_ENUMS.default_search_mode)[number];
  interests: ((typeof PREF_ENUMS.interests)[number] | string)[];
  excluded_vibes: string[];
  climate_pref: string;
  trip_length_pref: (typeof PREF_ENUMS.trip_length_pref)[number];
  preferred_airlines: string[];
  preferred_hotel_chains: string[];
  dietary_needs: string[];
  assistant_style: (typeof PREF_ENUMS.assistant_style)[number];
  voice_enabled: boolean;
  deal_alerts: boolean;
  deal_alert_threshold_pct: number;
  budget_ranges: {
    budget_max: number;   // default 100 — anything below is "budget"
    mid_max: number;      // default 250 — between budget_max and this is "mid", above is "luxury"
  };
  ai_assisted: boolean;   // default false — user wants Atlas to pick interests
  language: (typeof PREF_ENUMS.language)[number]; // preferred UI language
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  version: "1.0",
  home_airport: "",
  home_city: "",
  budget_tier: "mid",
  currency_pref: "USD",
  party: { adults: 1, children: 0, has_pets: false, accessibility_needs: false },
  default_search_mode: "flight_hotel",
  interests: [],
  excluded_vibes: [],
  climate_pref: "warm",
  trip_length_pref: "weekend",
  preferred_airlines: [],
  preferred_hotel_chains: [],
  dietary_needs: [],
  assistant_style: "concise",
  voice_enabled: false,
  deal_alerts: true,
  deal_alert_threshold_pct: 20,
  budget_ranges: { budget_max: 100, mid_max: 250 },
  ai_assisted: false,
  language: "en" as const,
};

export function mergePreferences(saved: Partial<UserPreferences>): UserPreferences {
  return {
    ...DEFAULT_PREFERENCES,
    ...saved,
    party: { ...DEFAULT_PREFERENCES.party, ...(saved.party || {}) },
    budget_ranges: { ...DEFAULT_PREFERENCES.budget_ranges, ...(saved.budget_ranges || {}) },
  };
}

/**
 * Validate and sanitize incoming preference data.
 * Strips unknown keys, validates enums, clamps numbers, limits string lengths.
 * Returns a sanitized Partial<UserPreferences> safe for merging.
 */
export function validatePreferences(input: Record<string, unknown>): Partial<UserPreferences> {
  const allowed = new Set(Object.keys(DEFAULT_PREFERENCES));
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(input)) {
    if (allowed.has(key)) {
      result[key] = input[key];
    }
  }

  // version is server-controlled — never accept from client
  delete result.version;

  // Validate enum fields
  if (result.budget_tier !== undefined) {
    if (!(PREF_ENUMS.budget_tier as readonly string[]).includes(result.budget_tier as string)) {
      delete result.budget_tier;
    }
  }
  if (result.currency_pref !== undefined) {
    if (!(PREF_ENUMS.currency_pref as readonly string[]).includes(result.currency_pref as string)) {
      delete result.currency_pref;
    }
  }
  if (result.default_search_mode !== undefined) {
    if (!(PREF_ENUMS.default_search_mode as readonly string[]).includes(result.default_search_mode as string)) {
      delete result.default_search_mode;
    }
  }
  if (result.trip_length_pref !== undefined) {
    if (!(PREF_ENUMS.trip_length_pref as readonly string[]).includes(result.trip_length_pref as string)) {
      delete result.trip_length_pref;
    }
  }
  if (result.assistant_style !== undefined) {
    if (!(PREF_ENUMS.assistant_style as readonly string[]).includes(result.assistant_style as string)) {
      delete result.assistant_style;
    }
  }

  // Validate interests array — allow custom strings alongside enum values
  if (result.interests !== undefined) {
    if (!Array.isArray(result.interests)) {
      delete result.interests;
    } else {
      result.interests = (result.interests as unknown[])
        .filter((i): i is string => typeof i === "string")
        .map((i) => i.trim().slice(0, 50))
        .filter((i) => i.length > 0)
        .slice(0, 30); // cap at 30 interests to prevent abuse
    }
  }

  // String length limits
  if (typeof result.home_airport === "string") {
    result.home_airport = result.home_airport.slice(0, 4).toUpperCase();
  }
  if (typeof result.home_city === "string") {
    result.home_city = (result.home_city as string).slice(0, 100);
  }
  if (typeof result.climate_pref === "string") {
    result.climate_pref = (result.climate_pref as string).slice(0, 100);
  }

  // Clamp numeric fields in party and strip unknown keys
  if (result.party !== undefined && typeof result.party === "object" && result.party !== null) {
    const raw = result.party as Record<string, unknown>;
    const party: Record<string, unknown> = {};
    if (typeof raw.adults === "number") {
      party.adults = Math.max(0, Math.floor(raw.adults));
    }
    if (typeof raw.children === "number") {
      party.children = Math.max(0, Math.floor(raw.children));
    }
    if (typeof raw.has_pets === "boolean") {
      party.has_pets = raw.has_pets;
    }
    if (typeof raw.accessibility_needs === "boolean") {
      party.accessibility_needs = raw.accessibility_needs;
    }
    result.party = party;
  }

  // Clamp deal_alert_threshold_pct
  if (typeof result.deal_alert_threshold_pct === "number") {
    result.deal_alert_threshold_pct = Math.min(100, Math.max(0, Math.floor(result.deal_alert_threshold_pct)));
  }

  // Boolean fields
  if (result.voice_enabled !== undefined && typeof result.voice_enabled !== "boolean") {
    delete result.voice_enabled;
  }
  if (result.deal_alerts !== undefined && typeof result.deal_alerts !== "boolean") {
    delete result.deal_alerts;
  }
  if (result.ai_assisted !== undefined && typeof result.ai_assisted !== "boolean") {
    delete result.ai_assisted;
  }

  // Validate budget_ranges — clamp to positive numbers, ensure budget_max < mid_max
  if (result.budget_ranges !== undefined && typeof result.budget_ranges === "object" && result.budget_ranges !== null) {
    const raw = result.budget_ranges as Record<string, unknown>;
    const ranges: Record<string, unknown> = {};
    if (typeof raw.budget_max === "number") {
      ranges.budget_max = Math.max(1, Math.floor(raw.budget_max));
    }
    if (typeof raw.mid_max === "number") {
      ranges.mid_max = Math.max(1, Math.floor(raw.mid_max));
    }
    // Ensure budget_max < mid_max when both are present
    const bMax = (ranges.budget_max ?? DEFAULT_PREFERENCES.budget_ranges.budget_max) as number;
    const mMax = (ranges.mid_max ?? DEFAULT_PREFERENCES.budget_ranges.mid_max) as number;
    if (bMax >= mMax) {
      // Force mid_max to be at least budget_max + 1
      ranges.mid_max = bMax + 1;
    }
    result.budget_ranges = ranges;
  }

  // Array string fields — sanitize to string arrays with length limits
  for (const arrKey of ["excluded_vibes", "preferred_airlines", "preferred_hotel_chains", "dietary_needs"] as const) {
    if (result[arrKey] !== undefined) {
      if (!Array.isArray(result[arrKey])) {
        delete result[arrKey];
      } else {
        result[arrKey] = (result[arrKey] as unknown[])
          .filter((v): v is string => typeof v === "string")
          .map((v) => v.slice(0, 100))
          .slice(0, 50);
      }
    }
  }

  return result as Partial<UserPreferences>;
}

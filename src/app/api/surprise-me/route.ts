import { NextRequest, NextResponse } from "next/server";
import { getFastApiBaseUrl } from "@/lib/server-config";

interface SurpriseDestination {
  name: string;
  flightPrice: string;
  airline: string;
  nonstop: boolean;
  hotelPrice: string;
  link: string;
}

interface SurpriseResponse {
  destinations: SurpriseDestination[];
  origin: string;
}

const MAX_CACHE_ENTRIES = 200;
const MAX_VIBES_LENGTH = 120;
const MAX_MONTH_LENGTH = 20;
const MAX_TRIP_LENGTH_LENGTH = 20;

// 1-hour in-memory cache keyed by normalized query params.
const cache = new Map<string, { data: SurpriseResponse; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

function clampQueryValue(value: string | null, maxLength: number): string {
  return (value ?? "").trim().slice(0, maxLength);
}

function purgeExpiredCacheEntries(): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

function pruneCacheIfNeeded(): void {
  if (cache.size < MAX_CACHE_ENTRIES) {
    return;
  }

  const oldestKey = cache.keys().next().value;
  if (oldestKey) {
    cache.delete(oldestKey);
  }
}

const FALLBACK: SurpriseResponse = {
  origin: "MIA",
  destinations: [
    { name: "Cancún, Mexico", flightPrice: "—", airline: "Spirit NK", nonstop: true, hotelPrice: "$89/night", link: "" },
    { name: "San Juan, Puerto Rico", flightPrice: "—", airline: "JetBlue", nonstop: true, hotelPrice: "$95/night", link: "" },
    { name: "Punta Cana, DR", flightPrice: "—", airline: "Spirit NK", nonstop: true, hotelPrice: "$75/night", link: "" },
  ],
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const origin = (searchParams.get("origin") ?? "MIA")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3) || "MIA";
  const vibes = clampQueryValue(searchParams.get("vibes"), MAX_VIBES_LENGTH);
  const departMonth = clampQueryValue(
    searchParams.get("depart_month"),
    MAX_MONTH_LENGTH
  );
  const tripLength = clampQueryValue(
    searchParams.get("trip_length"),
    MAX_TRIP_LENGTH_LENGTH
  );

  purgeExpiredCacheEntries();

  // Cache key includes vibes, month, and trip_length so different combos get different results
  const cacheKey = `${origin}|${vibes}|${departMonth}|${tripLength}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data);
  }

  try {
    const params = new URLSearchParams({ origin });
    if (vibes) params.set("vibes", vibes);
    if (departMonth) params.set("depart_month", departMonth);
    if (tripLength) params.set("trip_length", tripLength);
    const surpriseUrl = new URL(
      "/api/assistant/surprise-destinations",
      getFastApiBaseUrl()
    );
    surpriseUrl.search = params.toString();

    const res = await fetch(surpriseUrl, { next: { revalidate: 0 } });

    if (!res.ok) {
      return NextResponse.json(FALLBACK);
    }

    const data: SurpriseResponse = await res.json();
    pruneCacheIfNeeded();
    cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(FALLBACK);
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  getSurpriseDestinations,
  NO_PRICE_LABEL,
  type SurpriseResult,
} from "@/lib/atlas/surprise";

const MAX_CACHE_ENTRIES = 200;
const MAX_VIBES_LENGTH = 120;
const MAX_MONTH_LENGTH = 20;
const MAX_TRIP_LENGTH_LENGTH = 20;
const MAX_MATCH_LENGTH = 10;

// 1-hour in-memory cache keyed by normalized query params.
const cache = new Map<string, { data: SurpriseResult; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

export const INTERNAL_ERROR_REASON =
  "Surprise Me hit an unexpected internal error. This does NOT mean no flights exist — try again.";

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

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const origin = clampQueryValue(searchParams.get("origin"), 10);
  const vibes = clampQueryValue(searchParams.get("vibes"), MAX_VIBES_LENGTH);
  const departMonth = clampQueryValue(
    searchParams.get("depart_month"),
    MAX_MONTH_LENGTH
  );
  const tripLength = clampQueryValue(
    searchParams.get("trip_length"),
    MAX_TRIP_LENGTH_LENGTH
  );
  const match = clampQueryValue(searchParams.get("match"), MAX_MATCH_LENGTH);
  const matchMode = match === "any" ? ("any" as const) : ("all" as const);

  purgeExpiredCacheEntries();

  const cacheKey = [origin.toUpperCase(), vibes, departMonth, tripLength, matchMode]
    .map(encodeURIComponent)
    .join("|");

  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data);
  }

  let result: SurpriseResult;
  try {
    result = await getSurpriseDestinations({
      origin,
      vibes,
      departMonth,
      tripLength,
      matchMode,
    });
  } catch {
    return NextResponse.json({
      origin,
      destinations: [],
      degraded: { code: "internal_error", reason: INTERNAL_ERROR_REASON },
    });
  }

  const hasMeasuredPrice = result.destinations.some(
    (destination) => destination.flightPrice !== NO_PRICE_LABEL
  );
  if (result.destinations.length > 0 && hasMeasuredPrice && !result.degraded && !result.notice) {
    pruneCacheIfNeeded();
    cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  return NextResponse.json(result);
}

import { NextRequest, NextResponse } from "next/server";

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

const FASTAPI_BASE = process.env.FASTAPI_URL ?? "http://localhost:8766";

// 1-hour in-memory cache keyed by "origin|vibes".
const cache = new Map<string, { data: SurpriseResponse; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

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
  const origin = (searchParams.get("origin") ?? "MIA").toUpperCase();
  const vibes = searchParams.get("vibes") ?? "";
  const departMonth = searchParams.get("depart_month") ?? "";

  // Cache key includes vibes and month so different combos get different results
  const cacheKey = `${origin}|${vibes}|${departMonth}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data);
  }

  try {
    const params = new URLSearchParams({ origin });
    if (vibes) params.set("vibes", vibes);
    if (departMonth) params.set("depart_month", departMonth);

    const res = await fetch(
      `${FASTAPI_BASE}/api/assistant/surprise-destinations?${params.toString()}`,
      { next: { revalidate: 0 } }
    );

    if (!res.ok) {
      return NextResponse.json(FALLBACK);
    }

    const data: SurpriseResponse = await res.json();
    cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(FALLBACK);
  }
}

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

// 1-hour in-memory cache keyed by origin IATA code.
// Avoids hammering the TP API on every Surprise Me page load.
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

  // Serve from cache if still fresh
  const cached = cache.get(origin);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data);
  }

  try {
    const res = await fetch(
      `${FASTAPI_BASE}/api/assistant/surprise-destinations?origin=${encodeURIComponent(origin)}`,
      { next: { revalidate: 0 } }
    );

    if (!res.ok) {
      return NextResponse.json(FALLBACK);
    }

    const data: SurpriseResponse = await res.json();
    cache.set(origin, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(FALLBACK);
  }
}

import { NextRequest, NextResponse } from "next/server";

interface GeoResult {
  code: string | null;
  name: string | null;
  city: string | null;
  country: string | null;
}

const NULL_RESULT: GeoResult = { code: null, name: null, city: null, country: null };

// In-memory cache: IP → { result, expiresAt }
const cache = new Map<string, { result: GeoResult; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// 24 major metro airports keyed by city name (lowercase)
const METRO_AIRPORTS: Record<string, { code: string; name: string }> = {
  miami: { code: "MIA", name: "Miami International Airport" },
  "fort lauderdale": { code: "FLL", name: "Fort Lauderdale-Hollywood International Airport" },
  "new york": { code: "JFK", name: "John F. Kennedy International Airport" },
  "los angeles": { code: "LAX", name: "Los Angeles International Airport" },
  chicago: { code: "ORD", name: "O'Hare International Airport" },
  dallas: { code: "DFW", name: "Dallas/Fort Worth International Airport" },
  houston: { code: "IAH", name: "George Bush Intercontinental Airport" },
  atlanta: { code: "ATL", name: "Hartsfield-Jackson Atlanta International Airport" },
  "san francisco": { code: "SFO", name: "San Francisco International Airport" },
  seattle: { code: "SEA", name: "Seattle-Tacoma International Airport" },
  boston: { code: "BOS", name: "Boston Logan International Airport" },
  orlando: { code: "MCO", name: "Orlando International Airport" },
  denver: { code: "DEN", name: "Denver International Airport" },
  phoenix: { code: "PHX", name: "Phoenix Sky Harbor International Airport" },
  "las vegas": { code: "LAS", name: "Harry Reid International Airport" },
  washington: { code: "DCA", name: "Ronald Reagan Washington National Airport" },
  tampa: { code: "TPA", name: "Tampa International Airport" },
  philadelphia: { code: "PHL", name: "Philadelphia International Airport" },
  minneapolis: { code: "MSP", name: "Minneapolis-Saint Paul International Airport" },
  detroit: { code: "DTW", name: "Detroit Metropolitan Wayne County Airport" },
  london: { code: "LHR", name: "Heathrow Airport" },
  paris: { code: "CDG", name: "Charles de Gaulle Airport" },
  tokyo: { code: "NRT", name: "Narita International Airport" },
  dubai: { code: "DXB", name: "Dubai International Airport" },
};

function matchAirport(city: string | null): { code: string; name: string } | null {
  if (!city) return null;
  const lower = city.toLowerCase();
  for (const [key, airport] of Object.entries(METRO_AIRPORTS)) {
    if (lower.includes(key)) {
      return airport;
    }
  }
  return null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

    // Check cache
    const cached = cache.get(ip);
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json(cached.result);
    }

    // Skip external call for loopback/private IPs
    if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
      return NextResponse.json(NULL_RESULT);
    }

    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { "User-Agent": "travelplaninfo/1.0" },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return NextResponse.json(NULL_RESULT);
    }

    const data = await response.json();

    if (data.error) {
      return NextResponse.json(NULL_RESULT);
    }

    const city: string | null = data.city ?? null;
    const country: string | null = data.country_name ?? null;

    const airport = matchAirport(city);

    const result: GeoResult = {
      code: airport?.code ?? null,
      name: airport?.name ?? null,
      city,
      country,
    };

    cache.set(ip, { result, expiresAt: Date.now() + CACHE_TTL_MS });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(NULL_RESULT);
  }
}

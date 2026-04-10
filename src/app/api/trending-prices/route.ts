import { NextRequest, NextResponse } from 'next/server';
import { TRENDING_DESTINATIONS } from '@/config/destinations';

type PriceRecord = Record<string, { flight: number | null; hotel: number | null }>;

// 24-hour in-memory cache keyed by originCode
const cache = new Map<string, { prices: PriceRecord; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const NULL_PRICES: PriceRecord = Object.fromEntries(
  TRENDING_DESTINATIONS.map((d) => [d.code, { flight: null, hotel: null }])
);

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const origin = (searchParams.get('origin') ?? 'MIA').toUpperCase();

  // Return cached result if still fresh
  const cached = cache.get(origin);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.prices);
  }

  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) {
    return NextResponse.json(NULL_PRICES);
  }

  try {
    const params = new URLSearchParams({
      origin,
      currency: 'usd',
      sorting: 'price',
      limit: '30',
      one_way: 'false',
      token,
    });

    const response = await fetch(
      `https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${params}`,
      { next: { revalidate: 0 } }
    );

    if (!response.ok) {
      return NextResponse.json(NULL_PRICES);
    }

    const data = await response.json();

    // Build a lookup from destination IATA code → lowest price found
    const destinationCodes = new Set(TRENDING_DESTINATIONS.map((d) => d.code));
    const flightPrices: Record<string, number> = {};

    if (Array.isArray(data?.data)) {
      for (const ticket of data.data) {
        const dest: string | undefined = ticket?.destination;
        const price: number | undefined = ticket?.price;
        if (dest && destinationCodes.has(dest) && typeof price === 'number') {
          if (flightPrices[dest] === undefined || price < flightPrices[dest]) {
            flightPrices[dest] = price;
          }
        }
      }
    }

    const prices: PriceRecord = Object.fromEntries(
      TRENDING_DESTINATIONS.map((d) => [
        d.code,
        {
          flight: flightPrices[d.code] ?? null,
          hotel: null, // hotel prices not fetched in this route
        },
      ])
    );

    cache.set(origin, { prices, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(prices);
  } catch {
    return NextResponse.json(NULL_PRICES);
  }
}

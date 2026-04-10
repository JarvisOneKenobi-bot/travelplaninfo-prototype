'use client';

import { useState, useEffect } from 'react';
import { TRENDING_DESTINATIONS } from '@/config/destinations';
import { useGeolocateOrigin } from '@/hooks/useGeolocateOrigin';

type DestinationPrices = Record<string, { flight: number | null; hotel: number | null }>;

export default function TrendingDestinations() {
  const { origin } = useGeolocateOrigin();
  const [prices, setPrices] = useState<DestinationPrices>({});

  useEffect(() => {
    if (!origin.code) return;

    let cancelled = false;

    async function fetchPrices() {
      try {
        const res = await fetch(`/api/trending-prices?origin=${origin.code}`);
        if (!res.ok) return;
        const data: DestinationPrices = await res.json();
        if (!cancelled) {
          setPrices(data);
        }
      } catch {
        // Silently fail — prices stay empty
      }
    }

    fetchPrices();

    return () => {
      cancelled = true;
    };
  }, [origin.code]);

  function handlePlanTrip(city: string, country: string) {
    const event = new CustomEvent('prefill-destination', {
      detail: { destination: `${city}, ${country}` },
    });
    window.dispatchEvent(event);
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Trending Destinations</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {TRENDING_DESTINATIONS.map((dest) => {
          const destPrices = prices[dest.code];

          return (
            <div
              key={dest.code}
              className="border rounded-xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
            >
              {/* Image area */}
              <div className="h-28 relative bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center overflow-hidden">
                {dest.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={dest.image}
                    alt={`${dest.city}, ${dest.country}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      // Fall back to gradient + emoji if image fails to load
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        const emoji = document.createElement('span');
                        emoji.textContent = '🌍';
                        emoji.className = 'text-4xl';
                        parent.appendChild(emoji);
                      }
                    }}
                  />
                ) : (
                  <span className="text-4xl">🌍</span>
                )}
              </div>

              {/* Card content */}
              <div className="p-3">
                <p className="font-semibold text-sm text-gray-800 leading-tight">{dest.city}</p>
                <p className="text-xs text-gray-500 mb-1">{dest.country}</p>

                {destPrices?.flight != null && (
                  <p className="text-xs text-gray-500">from ${destPrices.flight}</p>
                )}
                {destPrices?.hotel != null && (
                  <p className="text-xs text-gray-500">from ${destPrices.hotel}/night</p>
                )}

                <button
                  onClick={() => handlePlanTrip(dest.city, dest.country)}
                  className="mt-2 w-full text-xs bg-blue-600 text-white rounded-lg py-1 px-2 hover:bg-blue-700 transition-colors"
                >
                  Plan trip →
                </button>

                {dest.articleSlug && (
                  <a
                    href={`/articles/${dest.articleSlug}`}
                    className="block mt-1 text-xs text-blue-600 hover:underline text-center"
                  >
                    Read guide
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {origin.name && (
        <p className="mt-4 text-center text-xs text-gray-400">
          Prices from your area ({origin.name}) · Updated daily
        </p>
      )}
    </section>
  );
}

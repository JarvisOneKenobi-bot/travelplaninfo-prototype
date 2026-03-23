"use client";

interface RestaurantData {
  name: string;
  cuisine: string;
  price_range: string;      // "$", "$$", "$$$"
  neighborhood: string;
  rating?: number;           // 1-5
  highlights?: string[];
  budget_tier: string;
}

const TIER_COLORS: Record<string, string> = {
  budget: "bg-green-100 text-green-700",
  mid: "bg-blue-100 text-blue-700",
  luxury: "bg-purple-100 text-purple-700",
};

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (i <= full) {
      stars.push(<span key={i} className="text-amber-400 text-xs">★</span>);
    } else if (i === full + 1 && half) {
      stars.push(<span key={i} className="text-amber-300 text-xs">★</span>);
    } else {
      stars.push(<span key={i} className="text-gray-300 text-xs">★</span>);
    }
  }
  return <span className="inline-flex gap-0">{stars}</span>;
}

export default function RestaurantCard({ restaurant }: { restaurant: RestaurantData }) {
  const tierClass = TIER_COLORS[restaurant.budget_tier] || "bg-gray-100 text-gray-600";
  const highlights = restaurant.highlights ?? [];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-900 truncate">{restaurant.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs bg-orange-50 text-orange-600 rounded px-1.5 py-0.5 capitalize">
              {restaurant.cuisine}
            </span>
            <span className="text-xs text-gray-500">{restaurant.neighborhood}</span>
          </div>
          {highlights.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {highlights.map((h, i) => (
                <span
                  key={i}
                  className="text-xs bg-gray-50 text-gray-500 border border-gray-200 rounded px-1.5 py-0.5"
                >
                  {h}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-sm text-gray-900">{restaurant.price_range}</p>
          {restaurant.rating != null && (
            <div className="flex items-center justify-end gap-1 mt-0.5">
              <StarRating rating={restaurant.rating} />
              <span className="text-xs text-gray-500">{restaurant.rating.toFixed(1)}</span>
            </div>
          )}
          <span className={["text-xs rounded px-1.5 py-0.5 font-medium capitalize mt-1 inline-block", tierClass].join(" ")}>
            {restaurant.budget_tier}
          </span>
        </div>
      </div>
    </div>
  );
}

"use client";

interface HotelData {
  name: string;
  price_night: string;
  rating: number;
  tier: string;
  book_url: string;
}

const TIER_COLORS: Record<string, string> = {
  budget: "bg-green-100 text-green-700",
  mid: "bg-blue-100 text-blue-700",
  luxury: "bg-purple-100 text-purple-700",
};

export default function HotelCard({ hotel }: { hotel: HotelData }) {
  const stars = Math.round(hotel.rating);
  const tierClass = TIER_COLORS[hotel.tier] || "bg-gray-100 text-gray-600";

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-900 truncate">{hotel.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-yellow-500">
              {"★".repeat(stars)}{"☆".repeat(Math.max(0, 5 - stars))}
            </span>
            <span className="text-xs text-gray-500">{hotel.rating}</span>
            <span className={["text-xs rounded px-1.5 py-0.5 font-medium capitalize", tierClass].join(" ")}>
              {hotel.tier}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg text-orange-600">{hotel.price_night}</p>
          <p className="text-xs text-gray-400">/night</p>
        </div>
      </div>
      <a
        href={hotel.book_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-full px-3 py-1.5 transition-colors"
      >
        Find on Hotels.com
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}

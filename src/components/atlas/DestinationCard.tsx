"use client";

interface DestinationData {
  city: string;
  tagline: string;
  estimated_flight: string;
  best_for?: string[];
}

export default function DestinationCard({ destination }: { destination: DestinationData }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 hover:shadow-md transition-shadow">
      <p className="font-medium text-sm text-gray-900">{destination.city}</p>
      <p className="text-xs text-gray-600 mt-1 leading-relaxed">{destination.tagline}</p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs font-semibold text-orange-600">{destination.estimated_flight}</p>
        {destination.best_for && destination.best_for.length > 0 && (
          <div className="flex gap-1">
            {destination.best_for.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5 capitalize"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-full px-3 py-1.5 transition-colors"
        onClick={() => {
          // In the future: open planner with this destination pre-filled
          window.location.href = "/planner";
        }}
      >
        Plan this trip
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

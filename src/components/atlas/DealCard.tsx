"use client";

interface DealData {
  date: string;
  destination: string;
  price: string;
  savings_pct: number;
  search_url: string;
}

export default function DealCard({ deal }: { deal: DealData }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-center gap-2">
        <div>
          <p className="font-medium text-sm text-gray-900">{deal.destination}</p>
          <p className="text-xs text-gray-500 mt-0.5">{deal.date}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg text-orange-600">{deal.price}</p>
          {deal.savings_pct > 0 && (
            <span className="text-xs font-semibold text-green-600 bg-green-50 rounded px-1.5 py-0.5">
              -{deal.savings_pct}%
            </span>
          )}
        </div>
      </div>
      <a
        href={deal.search_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-full px-3 py-1.5 transition-colors"
      >
        View Deal
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}

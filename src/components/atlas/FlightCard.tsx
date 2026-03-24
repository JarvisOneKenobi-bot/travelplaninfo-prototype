"use client";

interface FlightData {
  airline: string;
  route: string;
  price: string;
  duration: string;
  stops: string;
  depart_date?: string;
  return_date?: string;
  book_url: string;
  is_mock?: boolean;
}

export default function FlightCard({ flight }: { flight: FlightData }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          {/* Airline logo placeholder + name */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center text-xs font-bold text-gray-500">
              {flight.airline.charAt(0)}
            </div>
            <p className="font-medium text-sm text-gray-900 truncate">{flight.airline}</p>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {flight.route} &middot; {flight.duration} &middot; {flight.stops}
          </p>
          {flight.depart_date && (
            <p className="text-xs text-gray-400 mt-0.5">
              {flight.depart_date}
              {flight.return_date ? ` - ${flight.return_date}` : " (one-way)"}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-bold text-lg text-orange-600 whitespace-nowrap">{flight.price}</p>
          {flight.is_mock && (
            <span className="text-xs text-amber-600 bg-amber-50 rounded px-1 py-0.5">(estimated)</span>
          )}
        </div>
      </div>
      <a
        href={flight.book_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-full px-3 py-1.5 transition-colors"
      >
        Book on Aviasales
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}

const itineraries = [
  {
    emoji: "🌴",
    days: "3 days",
    category: "City + Beach",
    title: "3 Days in Miami",
    desc: "South Beach, Wynwood, Little Havana, and the best ceviche you'll ever have.",
  },
  {
    emoji: "🚢",
    days: "5 days",
    category: "Cruise",
    title: "5-Day Caribbean Cruise",
    desc: "Nassau, Cozumel, and Grand Cayman — all-inclusive from Port Everglades.",
  },
  {
    emoji: "🚗",
    days: "4 days",
    category: "Road Trip",
    title: "Florida Keys Road Trip",
    desc: "Miami to Key West on the Overseas Highway. Snorkeling, sunsets, and fresh seafood.",
  },
];

export default function CuratedItineraries() {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Curated Itineraries</h2>
        <button className="text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors">
          Browse all →
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {itineraries.map((item) => (
          <div
            key={item.title}
            className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col"
          >
            {/* Illustration */}
            <div className="h-40 bg-orange-50 flex items-center justify-center">
              <span className="text-6xl">{item.emoji}</span>
            </div>

            {/* Content */}
            <div className="px-5 py-4 flex flex-col flex-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
                  {item.days}
                </span>
                <span className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700">
                  {item.category}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{item.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">{item.desc}</p>
              <button className="mt-auto text-sm font-medium text-orange-600 hover:text-orange-700 text-left transition-colors">
                View itinerary →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

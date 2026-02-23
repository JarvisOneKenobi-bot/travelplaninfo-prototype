const itineraries = [
  {
    title: "3 Days in Miami",
    desc: "South Beach, Wynwood, Little Havana, and the best ceviche you'll ever have.",
    days: "3 days",
    type: "City + Beach",
    emoji: "🌴",
  },
  {
    title: "5-Day Caribbean Cruise",
    desc: "Nassau, Cozumel, and Grand Cayman — all-inclusive from Port Everglades.",
    days: "5 days",
    type: "Cruise",
    emoji: "🚢",
  },
  {
    title: "Florida Keys Road Trip",
    desc: "Miami to Key West on the Overseas Highway. Snorkeling, sunsets, and fresh seafood.",
    days: "4 days",
    type: "Road Trip",
    emoji: "🚗",
  },
];

export default function DesignC() {
  return (
    <div className="space-y-8">
      {/* Trip Planner Tool */}
      <div className="bg-amber-50 rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Plan Your Trip</h2>
        <p className="text-gray-500 text-sm mb-6">Tell us where and when &mdash; we&apos;ll build your perfect itinerary.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Destination</label>
            <input
              type="text"
              placeholder="e.g. Miami, Cancún..."
              className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Travel Dates</label>
            <input
              type="text"
              placeholder="Mar 15 → Mar 20"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Travelers</label>
            <select className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white text-gray-700">
              <option>1 traveler</option>
              <option>2 travelers</option>
              <option>3–4 travelers</option>
              <option>5+ travelers</option>
            </select>
          </div>
        </div>
        <button className="w-full md:w-auto px-8 py-3 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors">
          Plan My Trip →
        </button>
      </div>

      {/* Curated Itineraries */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-bold text-gray-900">Curated Itineraries</h2>
          <button className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors">Browse all →</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {itineraries.map((it) => (
            <div key={it.title} className="rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-36 bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center text-5xl">
                {it.emoji}
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{it.days}</span>
                  <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{it.type}</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{it.title}</h3>
                <p className="text-sm text-gray-500 mb-4">{it.desc}</p>
                <button className="text-sm font-medium text-gray-900 hover:text-amber-600 transition-colors">
                  View itinerary →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

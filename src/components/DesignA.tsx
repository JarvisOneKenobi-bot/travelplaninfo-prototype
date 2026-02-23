const stats = [
  { emoji: "🗓️", value: "2", label: "Active Trips" },
  { emoji: "⭐", value: "8", label: "Saved Destinations" },
  { emoji: "📝", value: "3", label: "Draft Itineraries" },
];

const destinations = [
  { name: "Miami Beach", country: "Florida, USA", desc: "Sun-soaked beaches, Art Deco architecture, and vibrant nightlife await.", emoji: "🌴" },
  { name: "Cancún", country: "Mexico", desc: "Crystal-clear waters, ancient Mayan ruins, and all-inclusive resorts.", emoji: "🏖️" },
  { name: "New York City", country: "New York, USA", desc: "The city that never sleeps — culture, food, and iconic skylines.", emoji: "🗽" },
];

export default function DesignA() {
  return (
    <div className="space-y-10">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-5">
        {stats.map((s) => (
          <div key={s.label} className="bg-amber-50 rounded-2xl p-8 text-center">
            <div className="text-3xl mb-2">{s.emoji}</div>
            <div className="text-3xl font-bold text-amber-600 mb-1">{s.value}</div>
            <div className="text-sm text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Featured Destinations */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-bold text-gray-900">Featured Destinations</h2>
          <button className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors">
            View all →
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {destinations.map((d) => (
            <div key={d.name} className="rounded-2xl overflow-hidden border border-gray-100 hover:shadow-md transition-shadow">
              {/* Image placeholder */}
              <div className="h-44 bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-6xl">
                {d.emoji}
              </div>
              <div className="p-5">
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">{d.country}</span>
                <h3 className="text-lg font-bold text-gray-900 mt-2 mb-1">{d.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{d.desc}</p>
                <button className="text-sm font-medium text-gray-900 hover:text-amber-600 transition-colors">
                  Explore →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hot Deals */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-bold text-gray-900">🔥 Hot Deals</h2>
          <button className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors">View all →</button>
        </div>
        <div className="space-y-3">
          {[
            { title: "Miami → NYC Round Trip", airline: "American Airlines", price: "$129", savings: "Save 40%" },
            { title: "Cancún All-Inclusive 7 Nights", airline: "Palace Resorts", price: "$899", savings: "Save 35%" },
            { title: "FLL → Miami Beach Shuttle", airline: "Ground Transfer", price: "$39", savings: "Book now" },
          ].map((deal) => (
            <div key={deal.title} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-amber-200 hover:bg-amber-50/30 transition-colors">
              <div>
                <p className="font-medium text-gray-900">{deal.title}</p>
                <p className="text-sm text-gray-500">{deal.airline}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded">{deal.savings}</span>
                <span className="text-lg font-bold text-gray-900">{deal.price}</span>
                <button className="text-sm font-medium bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
                  Book
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const bookables = [
  { title: "FLL → Miami Beach Shuttle", note: "Instant confirmation", price: "$39" },
  { title: "Everglades Airboat + Wildlife Park", note: "Family favorite", price: "$72" },
  { title: "South Beach Art Deco Walking Tour", note: "Small groups", price: "$22" },
  { title: "Miami → Key West Day Trip", note: "Best seller", price: "$89" },
  { title: "Wynwood Street Art Tour", note: "2.5 hours", price: "$35" },
  { title: "Miami Sunset Cruise", note: "Drinks included", price: "$59" },
];

export default function DesignB() {
  return (
    <div className="space-y-8">
      {/* Quick Bookables */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-bold text-gray-900">Quick Bookables</h2>
          <span className="text-sm text-gray-500">Affiliate partner offers</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bookables.map((item) => (
            <div key={item.title} className="flex items-center justify-between p-4 rounded-xl bg-amber-50 border border-amber-100 hover:border-amber-300 transition-colors">
              <div>
                <p className="font-medium text-gray-900">{item.title}</p>
                <p className="text-sm text-gray-500">{item.note}</p>
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <span className="text-lg font-bold text-amber-600">{item.price}</span>
                <button className="text-sm font-medium bg-gray-900 text-white px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap">
                  Book →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deal Alert */}
      <div className="rounded-2xl bg-gray-900 text-white p-8">
        <h2 className="text-2xl font-bold mb-2">Deal Alert 🔔</h2>
        <p className="text-gray-300 mb-6">
          Join 41,200 travelers. We send weekly Miami flight + hotel bundles with price-drop alerts.
        </p>
        <div className="flex gap-3 mb-3">
          <input
            type="email"
            placeholder="you@email.com"
            className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button className="px-6 py-3 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors whitespace-nowrap">
            Notify Me
          </button>
        </div>
        <p className="text-xs text-gray-500">No spam. Unsubscribe anytime.</p>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 text-center">
        * Some links are affiliate links. TravelPlanInfo may earn a commission at no extra cost to you.
      </p>
    </div>
  );
}

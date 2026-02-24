import Header from "@/components/Header";

const deals = [
  { label: "CJ Exclusive", title: "Miami Weekend Escape", active: true },
  { label: "Flash Fare", title: "Chicago → FLL", active: false },
  { label: "Stay & Play", title: "South Beach", active: false },
];

const bookables = [
  { title: "Fort Lauderdale to Miami Beach Shuttle", note: "Instant confirmation", price: "$39" },
  { title: "Everglades Airboat + Wildlife Park", note: "Family favorite", price: "$72" },
  { title: "South Beach Art Deco Walking Tour", note: "Small groups", price: "$22" },
];

const guides = [
  "48-hour Miami itinerary (design district + Wynwood)",
  "What to pack for Miami in spring",
  "Top 8 beaches within 30 minutes of FLL",
  "Miami on a budget: food, transit, stays",
];

const adCards = [
  {
    label: "ADSENSE",
    title: "Late-night hotel deals",
    body: "Up to 45% off Miami Beach stays tonight.",
    btn: "View rates",
    btnColor: "bg-teal-700",
  },
  {
    label: "ADSENSE",
    title: "FLL rides from $24",
    body: "Airport pickups + Miami Beach drop-off.",
    btn: "Book a ride",
    btnColor: "bg-teal-700",
  },
  {
    label: "ADSENSE",
    title: "Cuban food tour",
    body: "Little Havana bites + mojito class.",
    btn: "Reserve spot",
    btnColor: "bg-red-600",
  },
];

export default function HotDeals() {
  return (
    <div className="min-h-screen bg-[#F5F0EB]">
      <Header />

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── TOP 3-COLUMN SECTION ── */}
        <div className="grid grid-cols-12 gap-6">

          {/* Col 1 — Hero copy + stats */}
          <div className="col-span-5 flex flex-col justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-teal-800 font-medium mb-4">
                Live Deal Feed &nbsp;·&nbsp; Miami, FLL
              </p>
              <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-4 font-serif">
                Sun-soaked Miami trips with flight + stay bundles from $99.
              </h1>
              <p className="text-base text-gray-600 mb-6">
                Compare Miami flight deals, beachfront stays, and curated itineraries. Updated hourly with affiliate offers.
              </p>
              <div className="flex gap-3 flex-wrap">
                <button className="bg-teal-700 text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-teal-800 transition-colors">
                  View Today&apos;s Deals
                </button>
                <button className="border border-gray-400 text-teal-700 text-sm font-medium px-6 py-3 rounded-full hover:bg-white transition-colors">
                  See 3-day itinerary
                </button>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-4 border-t border-gray-300 pt-5 mt-8">
              {[
                { label: "FLIGHTS", value: "Miami (FLL) from $99" },
                { label: "HOTELS", value: "Beachfront from $79/night" },
                { label: "BUNDLE", value: "2-night trip from $239" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{s.label}</p>
                  <p className="text-sm font-bold text-gray-900">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Col 2 — Featured deal card */}
          <div className="col-span-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <p className="text-xs uppercase tracking-widest text-orange-400 font-medium mb-2">
                CJ Affiliate Mock
              </p>
              <h2 className="text-xl font-bold text-gray-900 font-serif">
                CJ Exclusive &bull; Miami Weekend Escape
              </h2>
              <p className="text-sm text-gray-500 mt-1">Roundtrip from NYC + 2 nights</p>
              <p className="text-3xl font-bold text-orange-600 mt-3">$299</p>
              <p className="text-sm text-gray-500 mt-1">Includes airport transfer + Wynwood street art tour</p>
              <div className="flex gap-3 mt-5">
                <button className="flex-1 bg-red-600 text-white text-sm font-medium py-3 rounded-lg hover:bg-red-700 transition-colors">
                  Book on partner
                </button>
                <button className="flex-1 border border-orange-300 text-orange-600 text-sm font-medium py-3 rounded-lg hover:bg-orange-50 transition-colors">
                  See details
                </button>
              </div>
            </div>

            {/* Carousel dots */}
            <div className="flex items-center gap-2 mt-4 px-1">
              <div className="h-2 w-6 rounded-full bg-red-600" />
              <div className="h-2 w-2 rounded-full bg-orange-300" />
              <div className="h-2 w-2 rounded-full bg-orange-300" />
            </div>

            {/* Deal list */}
            <div className="mt-3 space-y-2">
              {deals.map((d) => (
                <div
                  key={d.title}
                  className={`px-4 py-3 rounded-lg text-sm text-gray-800 cursor-pointer transition-colors ${
                    d.active ? "bg-orange-100 font-semibold" : "bg-[#FAF5EF] hover:bg-orange-50"
                  }`}
                >
                  <span className="text-gray-500 font-normal">{d.label} &bull;</span> {d.title}
                </div>
              ))}
            </div>
          </div>

          {/* Col 3 — Ad cards */}
          <div className="col-span-3 space-y-4">
            {adCards.map((ad) => (
              <div key={ad.title} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">{ad.label}</p>
                <h3 className="text-lg font-bold text-gray-900 font-serif leading-snug">{ad.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{ad.body}</p>
                <button className={`mt-3 px-4 py-2 text-sm text-white rounded-lg ${ad.btnColor} hover:opacity-90 transition-opacity`}>
                  {ad.btn}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── BOTTOM 3-COLUMN SECTION ── */}
        <div className="grid grid-cols-3 gap-6">

          {/* Quick bookables */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 font-serif mb-4">Quick bookables</h2>
            <div className="divide-y divide-gray-100">
              {bookables.map((item) => (
                <div key={item.title} className="flex items-center justify-between py-4 border-l-4 border-orange-200 pl-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.note}</p>
                  </div>
                  <span className="text-lg font-bold text-gray-900 ml-4">{item.price}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Miami planning guides */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 font-serif mb-4">Miami planning guides</h2>
            <ul className="space-y-3">
              {guides.map((g) => (
                <li key={g}>
                  <a href="#" className="text-gray-700 text-base hover:text-teal-700 hover:underline transition-colors">
                    {g}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Deal alert */}
          <div className="bg-teal-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-white font-serif">Deal alert</h2>
            <p className="text-teal-100 text-sm mt-3">
              Join 41,200 travelers. We send weekly Miami flight + hotel bundles with price-drop alerts.
            </p>
            <div className="flex gap-2 mt-5">
              <input
                type="email"
                placeholder="you@email.com"
                className="flex-1 px-4 py-3 rounded-lg text-sm bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
              <button className="bg-red-600 text-white text-sm font-bold px-5 py-3 rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap">
                Notify me
              </button>
            </div>
            <p className="text-xs text-teal-300 mt-3">No spam. Unsubscribe anytime.</p>
          </div>
        </div>

      </main>
    </div>
  );
}

const chips = [
  "🏖️ Beach", "🏙️ City Break", "🌲 Nature", "👨‍👩‍👧‍👦 Family",
  "🧗 Adventure", "🚢 Cruise", "🎒 Backpacking", "🚗 Road Trip",
];

export default function Hero() {
  return (
    <section className="bg-orange-50 rounded-3xl px-10 py-16 md:px-14 md:py-20">
      {/* Badge */}
      <span className="inline-block bg-orange-100 text-orange-700 text-xs font-medium px-3 py-1 rounded-full mb-5">
        Travel Deals &amp; Guides
      </span>

      {/* Headline */}
      <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-5">
        <span className="text-gray-900">Plan your next trip,</span>
        <br />
        <span className="text-orange-600">one adventure at a time.</span>
      </h1>

      {/* Subtitle */}
      <p className="text-lg text-gray-500 mb-7 max-w-xl">
        Expert itineraries, hidden gems, and deals for every kind of traveler.
      </p>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2 mb-8">
        {chips.map((chip) => (
          <button
            key={chip}
            className="px-4 py-2 rounded-full text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:border-orange-300 hover:text-orange-700 transition-colors whitespace-nowrap"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* CTA buttons */}
      <div className="flex flex-wrap gap-3">
        <button className="px-6 py-3 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:border-gray-500 hover:text-gray-900 transition-colors">
          Explore Destinations
        </button>
        <button className="px-6 py-3 rounded-lg text-sm font-medium bg-orange-600 text-white hover:bg-orange-700 transition-colors">
          Start Planning
        </button>
      </div>
    </section>
  );
}

import Link from "next/link";

export default function Hero() {
  return (
    <section
      className="relative rounded-3xl px-10 py-20 md:px-14 md:py-28 overflow-hidden"
      style={{
        backgroundImage:
          "url(/images/hero-bg.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center 40%",
      }}
    >
      {/* Gradient overlay — darker on the left where text lives, lighter on the right */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-gray-950/80 via-gray-900/60 to-gray-800/30" />

      {/* Content */}
      <div className="relative z-10 max-w-3xl">
        {/* Badge */}
        <span className="inline-block bg-white/15 backdrop-blur-sm border border-white/20 text-white text-xs font-medium px-3 py-1 rounded-full mb-5">
          Travel Deals &amp; Guides
        </span>

        {/* Headline */}
        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-5 text-white">
          Plan your next trip,
          <br />
          <span className="text-orange-400">one adventure at a time.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg text-white/75 mb-8 max-w-xl">
          Expert itineraries, hidden gems, and deals for every kind of traveler.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-wrap gap-3">
          <Link
            href="/destinations"
            className="px-6 py-3 rounded-lg text-sm font-medium bg-white text-gray-900 hover:bg-gray-100 transition-colors"
          >
            Explore Destinations
          </Link>
          <Link
            href="/planner"
            className="px-6 py-3 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors"
          >
            Start Planning
          </Link>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";

import tripModes from "@/content/tripModes";

export default function TripModes() {
  return (
    <section className="bg-slate-50 rounded-3xl px-8 py-10">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-orange-500">Trip Modes</p>
          <h2 className="text-3xl font-bold text-gray-900 mt-2">Choose your travel energy</h2>
          <p className="text-gray-500 mt-2 max-w-2xl">
            Vertical slices that bundle itineraries, hotel intel, and transfer guidance. Pick your mode and we’ll point you to what matters first.
          </p>
        </div>
        <Link
          href="/planner"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-full text-sm font-semibold bg-white border border-gray-200 text-gray-700 hover:border-gray-400 hover:text-gray-900 transition-colors"
        >
          Build a custom mode →
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {tripModes.map((mode) => (
          <article
            key={mode.id}
            className="rounded-2xl border border-transparent bg-white/60 shadow-sm hover:shadow-md transition-all"
          >
            <div className={`rounded-t-2xl bg-gradient-to-br ${mode.accent} px-6 py-4 flex items-center gap-3`}>
              <span className="text-2xl" aria-hidden>{mode.emoji}</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{mode.title}</h3>
                <p className="text-sm text-gray-600">{mode.tagline}</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <ul className="space-y-2 text-sm text-gray-600">
                {mode.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-orange-400" aria-hidden />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={mode.primaryCta.href}
                  className="px-4 py-2.5 rounded-full text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                >
                  {mode.primaryCta.label}
                </Link>
                {mode.secondaryCta && (
                  <a
                    href={mode.secondaryCta.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-full text-sm font-semibold border border-gray-200 text-gray-700 hover:border-gray-400 hover:text-gray-900 transition-colors"
                  >
                    {mode.secondaryCta.label}
                  </a>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

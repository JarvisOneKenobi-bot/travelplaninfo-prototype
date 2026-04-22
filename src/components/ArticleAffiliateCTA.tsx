import { CJ_LINKS, TP_CONFIG, TP_KLOOK } from "@/config/affiliates";

interface Props {
  opportunities: string[];
  destination?: string;
}

interface CTAConfig {
  label: string;
  title: string;
  description: string;
  cta: string;
  url: string;
}

function buildCTAs(opportunities: string[], destination?: string): CTAConfig[] {
  const hotelsCityCTA: CTAConfig = {
    label: "🏨 Hotels",
    title: destination ? `Hotels in ${destination}` : "Find Your Hotel",
    description: "Top-rated hotels with free cancellation. Best price guaranteed.",
    cta: "Search Hotels",
    url: destination ? CJ_LINKS.hotelsCity(destination) : CJ_LINKS.hotels(),
  };

  const ctaMap: Record<string, CTAConfig> = {
    hotels: hotelsCityCTA,
    // Booking.com TP is archived for TPI — route "booking" to Hotels.com (CJ) per CLAUDE.md
    booking: hotelsCityCTA,
    vrbo: {
      label: "🏠 Vacation Rentals",
      title: "Vacation Rentals",
      description: "Entire homes and condos — more space, more privacy.",
      cta: "Browse Rentals",
      url: CJ_LINKS.vrbo(),
    },
    cars: {
      label: "🚗 Car Rental",
      title: "Compare Car Rentals",
      description: "Compare 500+ suppliers — Hertz, Enterprise, Sixt & more.",
      cta: "Find Cars",
      url: CJ_LINKS.carsCompare(),
    },
    cruises: {
      label: "🚢 Cruises",
      title: "Caribbean & Bahamas Cruises",
      description: "Up to 75% off cruise fares. Last-minute deals available.",
      cta: "View Cruises",
      url: CJ_LINKS.cruisesLastMinute(),
    },
    tours: {
      label: "🎟️ Tours & Activities",
      title: destination ? `Tours & Activities in ${destination}` : "Tours & Activities",
      description: "Skip-the-line tickets, day trips and local experiences.",
      cta: "Browse Tours",
      url: TP_KLOOK.url(destination ?? ""),
    },
    flights: {
      label: "✈️ Flights",
      title: destination ? `Flights to ${destination}` : "Flight Deals",
      description: "Compare hundreds of airlines and agencies in one search.",
      cta: "Search Flights",
      // Aviasales accepts origin-empty — cleaner gets empty string, dest gets city code slug
      url: TP_CONFIG.searchUrl("", destination ?? ""),
    },
  };

  return opportunities
    .map((key) => ctaMap[key.toLowerCase()])
    .filter(Boolean);
}

export default function ArticleAffiliateCTA({ opportunities, destination }: Props) {
  const ctaList = buildCTAs(opportunities, destination);
  if (ctaList.length === 0) return null;

  return (
    <div className="my-8 p-5 bg-orange-50 border border-orange-200 rounded-xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-orange-600 mb-4">
        Plan this trip
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ctaList.map((cta) => (
          <a
            key={cta.label}
            href={cta.url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="flex items-start gap-3 bg-white rounded-lg border border-orange-100 p-4 hover:border-orange-300 hover:shadow-sm transition-all group"
          >
            <span className="text-2xl leading-none mt-0.5">{cta.label.split(" ")[0]}</span>
            <div>
              <p className="font-semibold text-gray-900 text-sm group-hover:text-orange-700 transition-colors">
                {cta.title}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{cta.description}</p>
              <span className="inline-block mt-2 text-xs font-medium text-orange-600">
                {cta.cta} →
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Affiliate Configuration ──
// Programs with active credentials: CruiseDirect, Vrbo, Hotels.com, EconomyBookings
// CJ publisher ID 101692720 (Hotels/Vrbo) | 101692716 (CruiseDirect/EconomyBookings)

export const CJ_LINKS = {
  // Hotels.com
  hotels: () => "https://www.dpbolvw.net/click-101692720-10433860",
  hotelsCity: (city: string) =>
    `https://www.dpbolvw.net/click-101692720-10433860?url=${encodeURIComponent(`https://www.hotels.com/Hotel-Search?destination=${city}`)}`,

  // Vrbo
  vrbo: () => "https://www.jdoqocy.com/click-101692720-10790646",

  // CruiseDirect — contextual deep links (use the right one per placement)
  cruises: () => "https://www.tkqlhce.com/click-101692716-15534697",       // generic fallback
  cruisesHoneymoon: () => "https://www.anrdoezrs.net/click-101692716-8331176",  // $5.68 EPC — best performer
  cruisesFamily: () => "https://www.dpbolvw.net/click-101692716-8331168",
  cruisesLastMinute: () => "https://www.tkqlhce.com/click-101692716-8331182",
  cruisesBahamas: () => "https://www.anrdoezrs.net/click-101692716-13096743",
  cruisesCarnival: () => "https://www.kqzyfj.com/click-101692716-13096782",
  cruisesDisney: () => "https://www.anrdoezrs.net/click-101692716-12558136",
  cruisesCelebrity: () => "https://www.dpbolvw.net/click-101692716-13034477",

  // EconomyBookings — car rentals
  cars: () => "https://www.jdoqocy.com/click-101692716-15586457",
  carsCompare: () => "https://www.tkqlhce.com/click-101692716-15586461",
};

// Travelpayouts — flight search widget (free to integrate, earns on bookings)
export const TP_CONFIG = {
  marker: "164743",
  searchUrl: (origin: string, dest: string) =>
    `https://www.aviasales.com/search/${origin}${dest}1?marker=${TP_CONFIG.marker}`,
};

// Deal catalog — real affiliate offers mapped to programs
export interface AffiliateDeal {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  savings: string;
  program: "hotels" | "vrbo" | "cruises" | "cars";
  cta: string;
  url?: string;  // override getAffiliateUrl() for contextual deep links
}

export const DEALS: AffiliateDeal[] = [
  {
    id: "hotels-miami-beach",
    title: "Miami Beach Hotels — Tonight's Deals",
    subtitle: "Hotels.com · Beachfront from $79/night",
    price: "$79",
    savings: "Save up to 40%",
    program: "hotels",
    cta: "Search Hotels",
  },
  {
    id: "vrbo-miami-condo",
    title: "Miami Vacation Rentals",
    subtitle: "Vrbo · Entire homes & condos",
    price: "$129",
    savings: "Free cancellation",
    program: "vrbo",
    cta: "Browse Rentals",
  },
  {
    id: "cars-miami",
    title: "Miami Car Rentals — All Brands Compared",
    subtitle: "EconomyBookings · Compare 500+ suppliers",
    price: "From $19",
    savings: "Best price guarantee",
    program: "cars",
    cta: "Compare Cars",
  },
  {
    id: "cruisedirect-caribbean",
    title: "Caribbean Cruise from Miami",
    subtitle: "CruiseDirect · 5-night all-inclusive",
    price: "$349",
    savings: "Up to 75% off",
    program: "cruises",
    cta: "View Cruises",
    url: "https://www.kqzyfj.com/click-101692716-13096782",  // Carnival — most affordable Caribbean
  },
  {
    id: "hotels-cancun",
    title: "Cancún All-Inclusive Resorts",
    subtitle: "Hotels.com · 7 nights from $899",
    price: "$899",
    savings: "Save 35%",
    program: "hotels",
    cta: "Book Resort",
  },
  {
    id: "cars-cancun",
    title: "Cancún Car Rentals",
    subtitle: "EconomyBookings · Free cancellation options",
    price: "From $25",
    savings: "Free cancellation",
    program: "cars",
    cta: "Find Cars",
  },
  {
    id: "vrbo-nyc-apartment",
    title: "NYC Vacation Apartments",
    subtitle: "Vrbo · Manhattan & Brooklyn stays",
    price: "$159",
    savings: "Weekly discounts",
    program: "vrbo",
    cta: "Find Apartments",
  },
  {
    id: "cruisedirect-bahamas",
    title: "Bahamas Cruise — 3 Nights",
    subtitle: "CruiseDirect · Up to $500 onboard credit",
    price: "$199",
    savings: "Up to $500 onboard",
    program: "cruises",
    cta: "Escape to Bahamas",
    url: "https://www.anrdoezrs.net/click-101692716-13096743",  // Bahamas deep link
  },
];

export function getAffiliateUrl(deal: AffiliateDeal): string {
  if (deal.url) return deal.url;
  if (deal.program === "cars") return CJ_LINKS.cars();
  return CJ_LINKS[deal.program]();
}

export default CJ_LINKS;

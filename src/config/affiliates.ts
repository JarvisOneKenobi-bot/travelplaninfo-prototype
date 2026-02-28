// ── Affiliate Configuration ──
// Programs with active credentials: CruiseDirect, Vrbo, Hotels.com
// All links are CJ Affiliate deeplinks (publisher ID 101692720)

export const CJ_LINKS = {
  hotels: () => "https://www.dpbolvw.net/click-101692720-10433860",
  vrbo: () => "https://www.jdoqocy.com/click-101692720-10790646",
  cruises: () => "https://www.tkqlhce.com/click-101692716-15534697",
};

// Travelpayouts — flight search widget (free to integrate, earns on bookings)
export const TP_CONFIG = {
  marker: "travelplaninfo",  // Jose's Travelpayouts marker (update when enrolled)
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
  program: "hotels" | "vrbo" | "cruises";
  cta: string;
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
    id: "cruisedirect-caribbean",
    title: "Caribbean Cruise from Miami",
    subtitle: "CruiseDirect · 5-night all-inclusive",
    price: "$349",
    savings: "Up to 75% off",
    program: "cruises",
    cta: "View Cruises",
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
    subtitle: "CruiseDirect · From Port Everglades",
    price: "$199",
    savings: "Last minute deal",
    program: "cruises",
    cta: "Grab Deal",
  },
];

export function getAffiliateUrl(program: AffiliateDeal["program"]): string {
  return CJ_LINKS[program]();
}

export default CJ_LINKS;

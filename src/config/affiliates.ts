// ── Affiliate Configuration ──
// Programs with active credentials: CruiseDirect, Vrbo, Hotels.com, EconomyBookings
// CJ publisher ID 101692720 (Hotels/Vrbo) | 101692716 (CruiseDirect/EconomyBookings)

export const CJ_LINKS = {
  // Hotels.com — property 101692716 (travelplaninfo)
  hotels: () => "https://www.dpbolvw.net/click-101692716-15734399?sid=travelplaninfo",        // evergreen $138.91 EPC
  hotelsMemberPrices: () => "https://www.dpbolvw.net/click-101692716-15612526?sid=travelplaninfo", // member prices $154.50 EPC
  hotelsCity: (city: string) =>
    `https://www.dpbolvw.net/click-101692716-15734399?sid=travelplaninfo&url=${encodeURIComponent(`https://www.hotels.com/Hotel-Search?destination=${encodeURIComponent(city)}`)}`,

  // Vrbo — property 101692716 (travelplaninfo)
  vrbo: () => "https://www.jdoqocy.com/click-101692716-10784831?sid=travelplaninfo",          // top EPC $280.26

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

  // AirAdvisor — flight delay/cancellation compensation (CJ ID 7818110)
  // TODO: replace with CJ click URL once generated (program status: "New")
  airAdvisor: () => "https://airadvisor.com/en/flight-compensation",
};

// Travelpayouts — flight search widget (free to integrate, earns on bookings)
export const TP_CONFIG = {
  marker: "164743",
  searchUrl: (origin: string, dest: string) => {
    const clean = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    return `https://www.aviasales.com/search/${clean(origin)}${clean(dest)}1?marker=${TP_CONFIG.marker}`;
  },
};

// Klook — Tours & Activities (Travelpayouts, TPI program ID 4110, trs 500721)
export const TP_KLOOK = {
  url: (city: string) => {
    const dest = encodeURIComponent(`https://www.klook.com/search/?query=${encodeURIComponent(city)}`);
    return `https://tp.media/r?campaign_id=137&marker=164743&p=4110&trs=500721&u=${dest}`;
  },
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
  switch (deal.program) {
    case "hotels": return CJ_LINKS.hotels();
    case "vrbo":   return CJ_LINKS.vrbo();
    case "cruises": return CJ_LINKS.cruises();
    case "cars":   return CJ_LINKS.cars();
  }
}

// 300×60 sidebar strip banners (compact, sticky-friendly)
export interface CJBanner {
  id: string;
  advertiser: string;
  headline: string;
  cta: string;
  url: string;
  bgFrom: string;
  bgTo: string;
  textColor: string;
  ctaColor: string;
  ctaText: string;
}

export const CJ_BANNERS: CJBanner[] = [
  {
    id: "hotels-member-prices",
    advertiser: "Hotels.com",
    headline: "Save 10%+ with Member Prices",
    cta: "Book",
    url: "https://www.dpbolvw.net/click-101692716-15612526?sid=travelplaninfo",
    bgFrom: "#D93025",
    bgTo: "#B71C1C",
    textColor: "#ffffff",
    ctaColor: "#ffffff",
    ctaText: "#D93025",
  },
  {
    id: "vrbo-vacation-rentals",
    advertiser: "Vrbo",
    headline: "Entire Homes for Every Trip",
    cta: "Search",
    url: "https://www.jdoqocy.com/click-101692716-10784831?sid=travelplaninfo",
    bgFrom: "#1565C0",
    bgTo: "#0D47A1",
    textColor: "#ffffff",
    ctaColor: "#ffffff",
    ctaText: "#1565C0",
  },
  {
    id: "cruisedirect-deals",
    advertiser: "CruiseDirect",
    headline: "Cruises Up to 75% Off",
    cta: "Deals",
    url: "https://www.dpbolvw.net/click-101692716-15734200?sid=travelplaninfo",
    bgFrom: "#00695C",
    bgTo: "#004D40",
    textColor: "#ffffff",
    ctaColor: "#FFD54F",
    ctaText: "#004D40",
  },
  {
    id: "cars-compare",
    advertiser: "EconomyBookings",
    headline: "Compare 500+ Car Rentals",
    cta: "Compare",
    url: "https://www.anrdoezrs.net/click-101692716-15736982?sid=travelplaninfo",
    bgFrom: "#E65100",
    bgTo: "#BF360C",
    textColor: "#ffffff",
    ctaColor: "#ffffff",
    ctaText: "#E65100",
  },
];

export default CJ_LINKS;

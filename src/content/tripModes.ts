export interface TripMode {
  id: string;
  emoji: string;
  title: string;
  tagline: string;
  highlights: string[];
  primaryCta: {
    label: string;
    href: string;
  };
  secondaryCta?: {
    label: string;
    href: string;
  };
  accent: string;
}

const tripModes: TripMode[] = [
  {
    id: "city-hit",
    emoji: "⚡",
    title: "48-Hour City Hit",
    tagline: "Land at noon, squeeze in culture, cocktails, and rooftop sunsets before you fly back out.",
    highlights: [
      "Curated hour-by-hour playbook",
      "Late checkout hotel picks",
      "Priority transfer add-ons"
    ],
    primaryCta: {
      label: "See the 2-day playbook",
      href: "/guides",
    },
    secondaryCta: {
      label: "Book transfers",
      href: "https://airportspickup.com/",
    },
    accent: "from-orange-100 to-rose-50",
  },
  {
    id: "family-week",
    emoji: "👨‍👩‍👧‍👦",
    title: "Family Week Reload",
    tagline: "Kid-proof itineraries with rest days, stroller-friendly stops, and backup plans.",
    highlights: [
      "Split-day schedule templates",
      "Theme-park + chill day balance",
      "Family-sized transfer guide"
    ],
    primaryCta: {
      label: "Build a family plan",
      href: "/planner?mode=family",
    },
    secondaryCta: {
      label: "Family cruise deals",
      href: "https://www.dpbolvw.net/click-101692716-8331168",
    },
    accent: "from-sky-100 to-emerald-50",
  },
  {
    id: "executive-retreat",
    emoji: "💼",
    title: "Executive Retreat",
    tagline: "Boardroom in the morning, black-car dinners after dark — no surprises, no delays.",
    highlights: [
      "5-star meeting hotels",
      "Off-site dining shortlists",
      "On-call chauffeur partners"
    ],
    primaryCta: {
      label: "Preview retreat kit",
      href: "/destinations",
    },
    secondaryCta: {
      label: "Request corporate transport",
      href: "https://123corporatetransportation.com/reservations/",
    },
    accent: "from-amber-100 to-slate-50",
  },
  {
    id: "cruise-transfer",
    emoji: "🛳️",
    title: "Cruise Transfer Express",
    tagline: "Same-day port transfers, hotel day-pass ideas, and luggage-safe excursions.",
    highlights: [
      "Port arrival cheat sheet",
      "Half-day excursion picks",
      "AirportsPickup cruise rates"
    ],
    primaryCta: {
      label: "Plan the layover",
      href: "/guides?tag=cruise",
    },
    secondaryCta: {
      label: "Reserve a port transfer",
      href: "https://airportspickup.com/miami-airport-cruise-port-transportation-guide-2026/",
    },
    accent: "from-cyan-100 to-indigo-50",
  },
  {
    id: "backpacker-bounce",
    emoji: "🎒",
    title: "Backpacker Bounce",
    tagline: "Hand luggage only? We’ve got bus routes, hostel clusters, and detours covered.",
    highlights: [
      "Transit + sleeper buses",
      "Hostel & co-work map",
      "Budget-friendly bites"
    ],
    primaryCta: {
      label: "Open the backpacker map",
      href: "https://travelplaninfo.com/tag/backpacking/",
    },
    secondaryCta: {
      label: "Share your route",
      href: "/planner",
    },
    accent: "from-lime-100 to-emerald-50",
  },
  {
    id: "romantic-escape",
    emoji: "🥂",
    title: "Romantic Escape",
    tagline: "Sunsets for two — private villa, candlelit table, and a transfer that shows up on time.",
    highlights: [
      "Couples hotel & villa picks",
      "Private transfer options",
      "Romantic dining shortlist"
    ],
    primaryCta: {
      label: "Plan a couples trip",
      href: "/planner?mode=couples",
    },
    secondaryCta: {
      label: "Honeymoon cruises",
      href: "https://www.anrdoezrs.net/click-101692716-8331176",
    },
    accent: "from-rose-100 to-pink-50",
  },
];

export default tripModes;

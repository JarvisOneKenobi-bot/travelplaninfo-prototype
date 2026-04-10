/** Shared types for Atlas trip result data — used by TripResultsModal + AssistantChat */

/** Extends FlightData from FlightCard with fields needed for sort + badges */
export interface FlightResult {
  airline: string;
  route: string;
  price: string;          // display string, e.g. "$289"
  price_value: number;    // numeric for sorting (dollars)
  duration: string;       // e.g. "3h 15m"
  duration_minutes: number; // numeric for sorting
  stops: string;          // e.g. "Nonstop" or "1 stop"
  nonstop: boolean;       // for badge rendering
  depart_date?: string;
  return_date?: string;
  book_url: string;
}

/** Extends HotelData from HotelCard with total cost + nights */
export interface HotelResult {
  name: string;
  price_night: string;     // display string
  price_night_value: number; // numeric for sorting
  total_cost?: string;     // price_night * nights (display)
  rating: number;          // 1-5 for sort and star rendering
  tier: "budget" | "mid" | "luxury";
  book_url: string;
  neighborhood?: string;
  highlights?: string[];
}

/** Extends ActivityData from ActivityCard with per-person price */
export interface ActivityResult {
  name: string;
  price: string;           // display string, e.g. "$89/person"
  price_value: number;     // numeric for sorting
  tier: "budget" | "mid" | "luxury";
  interest: string;        // category grouping key
  duration?: string;
}

/** Extends RestaurantCard data with budget tier */
export interface RestaurantResult {
  name: string;
  cuisine: string;
  price_range: string;      // "$", "$$", "$$$"
  neighborhood: string;
  rating?: number;           // 1-5
  highlights: string[];      // e.g. ["outdoor seating", "live music"]
  budget_tier: BudgetTier;
}

/** Budget tier type reused across modal and chat */
export type BudgetTier = "budget" | "mid" | "luxury";

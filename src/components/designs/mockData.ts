export interface Destination {
  slug: string;
  name: string;
  region: string;
  bestMonths: string;
  style: string;
  budgetHint: string;
  tagline: string;
  image?: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readingMinutes: number;
  publishedAt: string;
  author: string;
  image?: string;
}

export const destinations: Destination[] = [
  { slug: "miami", name: "Miami", region: "USA", bestMonths: "Nov–Apr", style: "Beach + nightlife", budgetHint: "$$", tagline: "Art Deco, Cuban food, and warm-water weekends." },
  { slug: "lisbon", name: "Lisbon", region: "Europe", bestMonths: "Mar–Jun", style: "City break", budgetHint: "$$", tagline: "Hillside viewpoints, pastel streets, and day trips." },
  { slug: "tokyo", name: "Tokyo", region: "Asia", bestMonths: "Mar–Apr", style: "Food + neighborhoods", budgetHint: "$$$", tagline: "Markets, museums, and easy rail day trips." },
  { slug: "cancun", name: "Cancún", region: "Caribbean", bestMonths: "Dec–Apr", style: "Resorts + tours", budgetHint: "$$", tagline: "All-inclusive stays with cenote and ruins tours." },
  { slug: "reykjavik", name: "Reykjavík", region: "Europe", bestMonths: "Feb–Mar", style: "Nature", budgetHint: "$$$", tagline: "Northern lights, hot springs, and short road trips." },
  { slug: "san-diego", name: "San Diego", region: "USA", bestMonths: "Sep–Nov", style: "Family", budgetHint: "$$", tagline: "Beaches, tacos, and laid-back coastal neighborhoods." },
];

export const posts: BlogPost[] = [
  { slug: "3-day-itinerary-template", title: "A simple 3‑day itinerary template you can reuse anywhere", excerpt: "A practical framework for planning: neighborhoods, anchors, and buffers.", category: "Planning", readingMinutes: 6, publishedAt: "2026-02-01", author: "TravelPlanInfo" },
  { slug: "carry-on-packing-list", title: "Carry‑on packing list: what actually earns a spot", excerpt: "A no‑fluff list optimized for city breaks and long weekends.", category: "Gear", readingMinutes: 5, publishedAt: "2026-01-14", author: "TravelPlanInfo" },
  { slug: "how-to-avoid-tourist-traps", title: "How to avoid tourist traps (without overplanning)", excerpt: "Signals to look for, questions to ask, and how to pick tours worth it.", category: "Tips", readingMinutes: 7, publishedAt: "2025-12-20", author: "TravelPlanInfo" },
  { slug: "budgeting-a-weekend-trip", title: "Budgeting a weekend trip: a 20‑minute worksheet", excerpt: "Split your spend into predictable buckets and keep wiggle room.", category: "Budget", readingMinutes: 8, publishedAt: "2025-11-02", author: "TravelPlanInfo" },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}

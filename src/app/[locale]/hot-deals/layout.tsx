import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hot Travel Deals — Hotels, Rentals & Cruises | TravelPlanInfo",
  description: "Curated travel deals from trusted partners. Book hotels on Hotels.com, vacation rentals on Vrbo, and cruise deals on CruiseDirect — and save.",
};

export default function HotDealsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

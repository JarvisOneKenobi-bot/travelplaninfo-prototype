import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Top Travel Destinations — Flights & Hotels | TravelPlanInfo",
  description: "Explore top travel destinations in the US and Caribbean. Compare flights and hotels to Miami, New York, Cancún, Jamaica, the Bahamas, and more.",
};

export default function DestinationsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

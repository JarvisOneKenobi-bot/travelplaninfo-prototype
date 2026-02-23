import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TravelPlanInfo • Plan Your Next Trip",
  description: "Expert itineraries, hidden gems, and deals for every kind of traveler.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}

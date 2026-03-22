import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import OnboardingWrapper from "@/components/OnboardingWrapper";
import AssistantChat from "@/components/AssistantChat";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TravelPlanInfo • Plan Your Next Trip",
  description: "Expert itineraries, hidden gems, and deals for every kind of traveler.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: [
      { url: "/favicon.svg" },
    ],
  },
};


const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "TravelPlanInfo",
  url: "https://travelplaninfo.com",
  description: "Expert itineraries, hidden gems, and deals for every kind of traveler.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body className={`${inter.variable} ${playfair.variable} font-sans bg-gray-50 text-gray-900 antialiased`}>
        <SessionProviderWrapper>
          <OnboardingWrapper />
          {children}
          <Footer />
          <AssistantChat />
        </SessionProviderWrapper>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import Header from "@/components/Header";
import { getAllArticles } from "@/lib/articles";
import GuidesFilter from "@/components/GuidesFilter";
import NewsletterForm from "@/components/NewsletterForm";

export const metadata: Metadata = {
  title: "Travel Guides & Itineraries | TravelPlanInfo",
  description: "Expert travel guides, itineraries, and tips for destinations worldwide. Plan your perfect trip with advice from experienced travelers.",
};

export default function Guides() {
  const posts = getAllArticles();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="w-full px-6 lg:px-12 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-teal-800 font-medium mb-4">
            Travel Guides
          </p>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Explore our travel guides
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Expert advice, itineraries, and tips for planning your next adventure.
          </p>
        </div>

        <GuidesFilter posts={posts} />

        {/* Newsletter */}
        <div className="mt-16 bg-teal-800 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Get travel tips in your inbox
          </h2>
          <p className="text-teal-100 mb-6 max-w-xl mx-auto">
            Get weekly deals, itinerary tips, and destination guides.
          </p>
          <NewsletterForm source="guides" />
          <p className="text-xs text-teal-300 mt-3">No spam. Unsubscribe anytime.</p>
        </div>
      </main>
    </div>
  );
}

import type { Metadata } from "next";
import { getUserId } from "@/lib/guest";
import Header from "@/components/Header";
import HelpButton from "@/components/HelpButton";
import PlannerDashboard from "@/components/PlannerDashboard";
import TripForm from "@/components/TripForm";

export const metadata: Metadata = {
  title: "Trip Planner — Build Your Perfect Itinerary | TravelPlanInfo",
  description: "Plan your perfect trip with our free trip planner. Tell us your destination, dates, and interests — we'll help you build a custom itinerary.",
};

export default async function Planner() {
  const ctx = await getUserId();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-widest text-teal-800 font-medium mb-4">Trip Planner</p>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Plan your perfect trip</h1>
          <p className="text-lg text-gray-600">
            Answer a few questions and we&apos;ll help you build an itinerary that fits your budget and interests.
          </p>
        </div>

        {ctx ? (
          <PlannerDashboard isGuest={ctx.isGuest} />
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <TripForm />
          </div>
        )}

        {/* Features */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6">
            <div className="text-3xl mb-3">🔍</div>
            <h3 className="font-bold text-gray-900 mb-2">Smart Search</h3>
            <p className="text-sm text-gray-600">We compare prices across 100+ booking sites</p>
          </div>
          <div className="text-center p-6">
            <div className="text-3xl mb-3">📋</div>
            <h3 className="font-bold text-gray-900 mb-2">Personalized Itinerary</h3>
            <p className="text-sm text-gray-600">Get a custom day-by-day plan</p>
          </div>
          <div className="text-center p-6">
            <div className="text-3xl mb-3">💰</div>
            <h3 className="font-bold text-gray-900 mb-2">Best Deals</h3>
            <p className="text-sm text-gray-600">Contextual affiliate deals matched to your trip</p>
          </div>
        </div>
      </main>
      <HelpButton pageId="planner-new" />
    </div>
  );
}

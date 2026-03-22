import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import HelpButton from "@/components/HelpButton";
import ItineraryBuilder from "@/components/ItineraryBuilder";
import AffiliateRecommendations from "@/components/AffiliateRecommendations";

interface Props {
  params: Promise<{ tripId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tripId } = await params;
  const db = getDb();
  const trip = db.prepare("SELECT name, destination FROM trips WHERE id = ?").get(tripId) as any;
  if (!trip) return { title: "Trip | TravelPlanInfo" };
  return {
    title: `${trip.name} — ${trip.destination} | TravelPlanInfo`,
  };
}

export default async function TripDetail({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/planner");

  const { tripId } = await params;
  const userId = (session.user as any).id;
  const db = getDb();

  const trip = db.prepare("SELECT * FROM trips WHERE id = ? AND user_id = ?").get(tripId, userId) as any;
  if (!trip) notFound();

  const items = db
    .prepare("SELECT * FROM trip_items WHERE trip_id = ? ORDER BY day_number, sort_order")
    .all(tripId) as any[];

  const interests: string[] = JSON.parse(trip.interests || "[]");

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-[72rem] mx-auto px-6 py-8">
        {/* Trip header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">{trip.name}</h1>
              <p className="text-gray-500">📍 {trip.destination}
                {trip.start_date && ` · ${new Date(trip.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                {trip.end_date && ` → ${new Date(trip.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
              </p>
              <div className="flex gap-3 mt-2 text-sm text-gray-500">
                <span>👥 {trip.travelers_adults} adult{trip.travelers_adults !== 1 ? "s" : ""}{trip.travelers_children > 0 ? `, ${trip.travelers_children} child${trip.travelers_children !== 1 ? "ren" : ""}` : ""}</span>
                <span>🛏️ {trip.rooms} room{trip.rooms !== 1 ? "s" : ""}</span>
                {trip.budget && <span className="capitalize">💰 {trip.budget === "midrange" ? "Mid-range" : trip.budget}</span>}
              </div>
            </div>
            <Link href="/planner" className="text-sm text-teal-700 hover:text-teal-800 font-medium">← All trips</Link>
          </div>
        </div>

        {/* Two-column layout: itinerary + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
          <ItineraryBuilder
            tripId={trip.id}
            initialItems={items}
            tripDestination={trip.destination}
            tripBudget={trip.budget}
            tripInterests={interests}
            tripStartDate={trip.start_date}
            tripEndDate={trip.end_date}
          />
          <AffiliateRecommendations
            tripId={trip.id}
            destination={trip.destination}
            budget={trip.budget}
            interests={interests}
          />
        </div>
      </main>
      <HelpButton pageId="planner-itinerary" />
    </div>
  );
}

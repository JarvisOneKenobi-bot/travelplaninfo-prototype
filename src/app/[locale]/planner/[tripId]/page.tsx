import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getUserId } from "@/lib/guest";
import { getDb } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import HelpButton from "@/components/HelpButton";
import ItineraryBuilder from "@/components/ItineraryBuilder";
import AffiliateRecommendations from "@/components/AffiliateRecommendations";
import GenerationProgress from '@/components/GenerationProgress';
interface Props {
  params: Promise<{ tripId: string; locale: string }>;
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
  const { locale, tripId } = await params;
  setRequestLocale(locale);

  const ctx = await getUserId();
  if (!ctx) redirect("/signin?callbackUrl=/planner");

  const userId = ctx.userId;
  const db = getDb();

  const trip = db.prepare("SELECT * FROM trips WHERE id = ? AND user_id = ?").get(tripId, userId) as any;
  if (!trip) notFound();
  const isGuest = ctx.isGuest;

  const items = db
    .prepare("SELECT * FROM trip_items WHERE trip_id = ? ORDER BY day_number, sort_order")
    .all(tripId) as any[];

  const interests: string[] = JSON.parse(trip.interests || "[]");
  const t = await getTranslations("tripDetail");
  const dateFmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-[90rem] mx-auto px-6 py-8">
        {/* Trip header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">{trip.name}</h1>
              <p className="text-gray-500">📍 {trip.destination}
                {trip.start_date && ` · ${dateFmt.format(new Date(trip.start_date))}`}
                {trip.end_date && ` → ${dateFmt.format(new Date(trip.end_date))}`}
              </p>
              <div className="flex gap-3 mt-2 text-sm text-gray-500">
                <span>👥 {trip.travelers_adults} {t("adults", { count: trip.travelers_adults })}{trip.travelers_children > 0 ? `, ${trip.travelers_children} ${t("children", { count: trip.travelers_children })}` : ""}</span>
                <span>🛏️ {trip.rooms} {t("rooms", { count: trip.rooms })}</span>
                {trip.budget && <span className="capitalize">💰 {trip.budget === "midrange" ? t("midrange") : trip.budget}</span>}
              </div>
            </div>
            <Link href="/planner" className="text-sm text-teal-700 hover:text-teal-800 font-medium">← {t("allTrips")}</Link>
          </div>
        </div>

        {/* Two-column layout: itinerary + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
          <div>
            {items.length === 0 && (
              <GenerationProgress destination={trip.destination} isGenerating={true} />
            )}
            {trip.entry_mode === 'surprise' && trip.quiz_vibes && (
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-sm text-gray-500">Based on:</span>
                {trip.quiz_budget && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    {trip.quiz_budget.replace('_', '-')}
                  </span>
                )}
                {JSON.parse(trip.quiz_vibes || '[]').map((v: string) => (
                  <span key={v} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full capitalize">
                    {v}
                  </span>
                ))}
                {trip.quiz_who && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full capitalize">
                    {trip.quiz_who}
                  </span>
                )}
              </div>
            )}
            <ItineraryBuilder
              tripId={trip.id}
              initialItems={items}
              tripDestination={trip.destination}
              tripBudget={trip.budget}
              tripInterests={interests}
              tripStartDate={trip.start_date}
              tripEndDate={trip.end_date}
              tripAdults={trip.travelers_adults ?? 1}
              initialBudgetOverride={trip.budget_override ?? null}
            />
            {items.length === 0 && (
              <div className="text-center py-4 text-sm text-gray-500 border-t border-dashed border-gray-200 mt-4">
                While you wait, add anything you already know
              </div>
            )}
          </div>
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

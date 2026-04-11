"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import TripForm from "./TripForm";

interface Trip {
  id: number;
  name: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  budget: string | null;
  status: string;
  created_at: string;
}

export default function PlannerDashboard({ isGuest = false }: { isGuest?: boolean }) {
  const t = useTranslations("plannerDashboard");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Trip | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/trips")
      .then(r => r.json())
      .then(data => { setTrips(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Merge guest trips into real account after login
  useEffect(() => {
    if (isGuest) return;
    if (!document.cookie.includes("tpi_guest_hint")) return;
    fetch("/api/auth/merge-guest", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.merged > 0) window.location.reload();
      })
      .catch(() => {});
  }, [isGuest]);

  if (showForm) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">{t("newTrip")}</h2>
          <button
            onClick={() => setShowForm(false)}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium"
          >
            ← {t("myTrips")}
          </button>
        </div>
        <TripForm />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isGuest && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-3">
          <p className="text-sm text-amber-800">{t("guestWarning")} <Link href="/register?callbackUrl=/planner" className="font-medium underline hover:text-amber-900">{t("createFreeAccount")}</Link> {t("keepForever")}</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">{t("myTrips")}</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-teal-700 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-teal-800 transition-colors text-sm"
        >
          {t("createNewTrip")}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">{t("loadingTrips")}</div>
      ) : trips.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">✈️</div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">{t("noTrips")}</h3>
          <p className="text-gray-500 mb-6">{t("noTripsDesc")}</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-teal-700 text-white px-6 py-3 rounded-lg font-medium hover:bg-teal-800 transition-colors"
          >
            {t("planFirstTrip")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {trips.map(trip => (
            <div key={trip.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:border-teal-300 hover:shadow-md transition-all relative group">
              <Link href={`/planner/${trip.id}`} className="block">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-gray-900 text-lg leading-tight pr-8">{trip.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
                    trip.status === "completed" ? "bg-green-100 text-green-700" :
                    trip.status === "booked" ? "bg-blue-100 text-blue-700" :
                    "bg-orange-100 text-orange-700"
                  }`}>{trip.status}</span>
                </div>
                <p className="text-gray-500 text-sm mb-3">📍 {trip.destination}</p>
                {(trip.start_date || trip.end_date) && (
                  <p className="text-gray-400 text-xs mb-3">
                    {trip.start_date && new Date(trip.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {trip.start_date && trip.end_date && " → "}
                    {trip.end_date && new Date(trip.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                )}
                {trip.budget && (
                  <p className="text-xs text-teal-700 font-medium capitalize">{trip.budget === "midrange" ? "Mid-range" : trip.budget} budget</p>
                )}
              </Link>
              <button
                onClick={() => setDeleteTarget(trip)}
                className="absolute bottom-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                aria-label={t("deleteTrip")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => { if (!deleting) setDeleteTarget(null); }}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-600">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">{t("confirmDeleteTitle")}</h3>
            </div>
            <p className="text-sm text-gray-500 pl-[52px]">
              <span className="font-medium text-gray-700">{deleteTarget.name}</span>
              <br />
              {t("confirmDeleteMessage")}
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                {t("cancelDelete")}
              </button>
              <button
                onClick={async () => {
                  setDeleting(true);
                  try {
                    const res = await fetch(`/api/trips/${deleteTarget.id}`, { method: "DELETE" });
                    if (res.ok) {
                      setTrips(prev => prev.filter(t => t.id !== deleteTarget.id));
                      setDeleteTarget(null);
                    }
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
                {deleting ? "..." : t("confirmDeleteButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

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
        <h2 className="text-xl font-bold text-gray-900 mb-6">New Trip</h2>
        <TripForm onCancel={() => setShowForm(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isGuest && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-3">
          <p className="text-sm text-amber-800">Your trips are saved temporarily. <Link href="/register?callbackUrl=/planner" className="font-medium underline hover:text-amber-900">Create a free account</Link> to keep them forever.</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">My Trips</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-teal-700 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-teal-800 transition-colors text-sm"
        >
          + Create New Trip
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading trips…</div>
      ) : trips.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">✈️</div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">No trips yet</h3>
          <p className="text-gray-500 mb-6">Create your first trip to start building an itinerary.</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-teal-700 text-white px-6 py-3 rounded-lg font-medium hover:bg-teal-800 transition-colors"
          >
            Plan My First Trip
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {trips.map(trip => (
            <Link key={trip.id} href={`/planner/${trip.id}`}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:border-teal-300 hover:shadow-md transition-all block">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-gray-900 text-lg leading-tight">{trip.name}</h3>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
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
          ))}
        </div>
      )}
    </div>
  );
}

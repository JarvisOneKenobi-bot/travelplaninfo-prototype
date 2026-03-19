"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const INTERESTS = [
  "🏖️ Beaches", "🏛️ Museums", "🍜 Food & Dining", "🎭 Nightlife",
  "🚶 Hiking", "🛍️ Shopping", "🎢 Theme Parks", "🌅 Nature", "📸 Photography",
  "🚢 Cruises", "🏔️ Adventure", "🍷 Wine & Culinary",
];

const BUDGET_OPTIONS = [
  { value: "budget", label: "Budget", desc: "Under $100/day", icon: "💰" },
  { value: "midrange", label: "Mid-range", desc: "$100–250/day", icon: "💵" },
  { value: "luxury", label: "Luxury", desc: "$250+/day", icon: "💎" },
];

export default function TripForm({ onCancel }: { onCancel?: () => void }) {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const [tripName, setTripName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState(1);
  const [budget, setBudget] = useState("midrange");
  const [interests, setInterests] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function toggleInterest(interest: string) {
    setInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!destination.trim()) {
      setError("Please enter a destination.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: tripName.trim() || `Trip to ${destination.trim()}`,
        destination: destination.trim(),
        start_date: startDate || null,
        end_date: endDate || null,
        budget,
        travelers_adults: adults,
        travelers_children: children,
        rooms,
        interests,
      }),
    });

    if (!res.ok) {
      if (res.status === 401) {
        router.push("/signin?callbackUrl=/planner");
        return;
      }
      setError("Failed to create trip. Please try again.");
      setLoading(false);
      return;
    }

    const trip = await res.json();
    router.push(`/planner/${trip.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Step 1: Destination */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">1</span>
          <h2 className="text-xl font-bold text-gray-900">Where are you going?</h2>
        </div>
        <input
          type="text"
          required
          value={destination}
          onChange={e => setDestination(e.target.value)}
          placeholder="e.g., Miami, Florida"
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
        <input
          type="text"
          value={tripName}
          onChange={e => setTripName(e.target.value)}
          placeholder="Trip name (optional)"
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Step 2: Dates */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</span>
          <h2 className="text-xl font-bold text-gray-900">When are you traveling?</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Check-in</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Check-out</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </div>
        </div>
      </div>

      {/* Step 3: Travelers */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">3</span>
          <h2 className="text-xl font-bold text-gray-900">Who&apos;s traveling?</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Adults</label>
            <select value={adults} onChange={e => setAdults(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent">
              {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Children</label>
            <select value={children} onChange={e => setChildren(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent">
              {[0,1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rooms</label>
            <select value={rooms} onChange={e => setRooms(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent">
              {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Step 4: Budget */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">4</span>
          <h2 className="text-xl font-bold text-gray-900">What&apos;s your budget?</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {BUDGET_OPTIONS.map(opt => (
            <label key={opt.value} className="cursor-pointer">
              <input type="radio" name="budget" value={opt.value} checked={budget === opt.value}
                onChange={() => setBudget(opt.value)} className="sr-only" />
              <div className={`px-4 py-3 rounded-lg border-2 text-center transition-colors ${budget === opt.value ? "border-teal-600 bg-teal-50" : "border-gray-200 hover:border-gray-300"}`}>
                <p className="font-medium text-gray-900">{opt.icon}</p>
                <p className="text-sm text-gray-700">{opt.label}</p>
                <p className="text-xs text-gray-400">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Step 5: Interests */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-orange-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">5</span>
          <h2 className="text-xl font-bold text-gray-900">What interests you?</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {INTERESTS.map(interest => (
            <label key={interest} className="cursor-pointer">
              <input type="checkbox" checked={interests.includes(interest)}
                onChange={() => toggleInterest(interest)} className="sr-only" />
              <div className={`px-4 py-2.5 rounded-lg border-2 text-center transition-colors text-sm ${interests.includes(interest) ? "border-teal-600 bg-teal-50" : "border-gray-200 hover:border-gray-300"}`}>
                {interest}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div className="pt-4 border-t border-gray-200 flex gap-3">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="flex-1 border border-gray-300 text-gray-700 py-4 rounded-lg font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        )}
        <button type="submit" disabled={loading}
          className="flex-1 bg-teal-700 text-white py-4 rounded-lg font-medium hover:bg-teal-800 transition-colors disabled:opacity-60">
          {loading ? "Creating trip…" : "Start Planning"}
        </button>
      </div>
    </form>
  );
}

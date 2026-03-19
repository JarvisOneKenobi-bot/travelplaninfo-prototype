"use client";

import { useState } from "react";

const CATEGORIES = [
  { value: "hotel", label: "🏨 Hotel", color: "bg-blue-100 text-blue-700" },
  { value: "flight", label: "✈️ Flight", color: "bg-orange-100 text-orange-700" },
  { value: "car", label: "🚗 Car Rental", color: "bg-green-100 text-green-700" },
  { value: "activity", label: "🎯 Activity", color: "bg-purple-100 text-purple-700" },
  { value: "cruise", label: "🚢 Cruise", color: "bg-teal-100 text-teal-700" },
  { value: "restaurant", label: "🍽️ Restaurant", color: "bg-yellow-100 text-yellow-700" },
  { value: "note", label: "📝 Note", color: "bg-gray-100 text-gray-700" },
];

interface Item {
  id: number;
  trip_id: number;
  day_number: number;
  category: string;
  title: string;
  description: string | null;
  affiliate_url: string | null;
  affiliate_program: string | null;
  price_estimate: string | null;
  booked: number;
}

interface AddItemFormState {
  day: number;
  category: string;
  title: string;
  description: string;
  price_estimate: string;
}

export default function ItineraryBuilder({
  tripId,
  initialItems,
}: {
  tripId: number;
  initialItems: Item[];
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [form, setForm] = useState<AddItemFormState>({ day: 1, category: "hotel", title: "", description: "", price_estimate: "" });
  const [saving, setSaving] = useState(false);

  const days = Array.from(new Set([...items.map(i => i.day_number), 1])).sort((a, b) => a - b);
  const maxDay = Math.max(...days, 1);

  function getCategoryMeta(value: string) {
    return CATEGORIES.find(c => c.value === value) || CATEGORIES[CATEGORIES.length - 1];
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);

    const res = await fetch(`/api/trips/${tripId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        day_number: form.day,
        category: form.category,
        title: form.title.trim(),
        description: form.description.trim() || null,
        price_estimate: form.price_estimate.trim() || null,
      }),
    });

    if (res.ok) {
      const item = await res.json();
      setItems(prev => [...prev, item]);
      setForm(f => ({ ...f, title: "", description: "", price_estimate: "" }));
      setAddingDay(null);
    }
    setSaving(false);
  }

  async function toggleBooked(item: Item) {
    const newBooked = item.booked ? 0 : 1;
    const res = await fetch(`/api/trips/${tripId}/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booked: !!newBooked }),
    });
    if (res.ok) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, booked: newBooked } : i));
    }
  }

  async function deleteItem(itemId: number) {
    const res = await fetch(`/api/trips/${tripId}/items/${itemId}`, { method: "DELETE" });
    if (res.ok) setItems(prev => prev.filter(i => i.id !== itemId));
  }

  function startAddItem(day: number) {
    setAddingDay(day);
    setForm(f => ({ ...f, day, title: "", description: "", price_estimate: "" }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Itinerary</h2>
        <button
          onClick={() => startAddItem(maxDay + 1)}
          className="text-sm text-teal-700 hover:text-teal-800 font-medium border border-teal-300 px-3 py-1.5 rounded-lg hover:bg-teal-50 transition-colors"
        >
          + Add Day {maxDay + 1}
        </button>
      </div>

      {days.map(day => (
        <div key={day} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="font-bold text-gray-800">Day {day}</h3>
            <button
              onClick={() => startAddItem(day)}
              className="text-xs text-teal-700 hover:text-teal-800 font-medium"
            >
              + Add item
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {items.filter(i => i.day_number === day).map(item => {
              const cat = getCategoryMeta(item.category);
              return (
                <div key={item.id} className={`flex items-start gap-4 px-5 py-4 ${item.booked ? "opacity-60" : ""}`}>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 mt-0.5 ${cat.color}`}>
                    {cat.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-gray-900 text-sm ${item.booked ? "line-through" : ""}`}>{item.title}</p>
                    {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {item.price_estimate && <span className="text-xs text-gray-400">{item.price_estimate}</span>}
                      {item.affiliate_url && (
                        <a href={item.affiliate_url} target="_blank" rel="noopener noreferrer sponsored"
                          className="text-xs text-orange-600 hover:text-orange-700 font-medium">
                          Book Now →
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggleBooked(item)}
                      className={`text-xs px-2 py-1 rounded font-medium transition-colors ${item.booked ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                      {item.booked ? "✓ Booked" : "Mark booked"}
                    </button>
                    <button onClick={() => deleteItem(item.id)}
                      className="text-xs text-red-400 hover:text-red-600 px-1">✕</button>
                  </div>
                </div>
              );
            })}

            {items.filter(i => i.day_number === day).length === 0 && addingDay !== day && (
              <p className="text-sm text-gray-400 px-5 py-4 italic">No items for Day {day} yet.</p>
            )}

            {addingDay === day && (
              <form onSubmit={addItem} className="px-5 py-4 bg-teal-50 border-t border-teal-100 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <input value={form.price_estimate} onChange={e => setForm(f => ({ ...f, price_estimate: e.target.value }))}
                    placeholder="Price (optional)" className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Title *" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Notes (optional)" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                <div className="flex gap-2">
                  <button type="submit" disabled={saving}
                    className="flex-1 bg-teal-700 text-white py-2 rounded-lg text-sm font-medium hover:bg-teal-800 transition-colors disabled:opacity-60">
                    {saving ? "Adding…" : "Add Item"}
                  </button>
                  <button type="button" onClick={() => setAddingDay(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { PREF_ENUMS } from "@/lib/preferences";
import MapDrawer from "@/components/MapDrawer";
import BudgetBar from "@/components/BudgetBar";
import { useTranslations } from "next-intl";

/* ── Item categories (multi-layer dropdown per product spec) ── */
/* Labels are translation keys resolved via t(`category_${value}`) at render time */
const CATEGORIES = [
  { value: "flight", labelKey: "category_flight", icon: "\u2708\uFE0F", color: "bg-orange-100 text-orange-700" },
  { value: "hotel", labelKey: "category_hotel", icon: "\uD83C\uDFE8", color: "bg-blue-100 text-blue-700" },
  { value: "car_rental", labelKey: "category_car_rental", icon: "\uD83D\uDE97", color: "bg-teal-100 text-teal-700" },
  { value: "activity", labelKey: "category_activity", icon: "\uD83C\uDFAF", color: "bg-purple-100 text-purple-700" },
  { value: "restaurant", labelKey: "category_restaurant", icon: "\uD83C\uDF7D\uFE0F", color: "bg-yellow-100 text-yellow-700" },
  { value: "transportation", labelKey: "category_transportation", icon: "\uD83D\uDE95", color: "bg-cyan-100 text-cyan-700" },
  { value: "note", labelKey: "category_note", icon: "\uD83D\uDCDD", color: "bg-gray-100 text-gray-700" },
];

/* Human-readable labels for interest keys */
const INTEREST_LABELS: Record<string, string> = {
  beach: "Beaches",
  adventure: "Adventure",
  culture: "Culture & Museums",
  food: "Food & Dining",
  nightlife: "Nightlife",
  nature: "Nature & Hiking",
  wellness: "Wellness & Spa",
  family: "Family Activities",
  luxury: "Luxury Experiences",
  budget: "Budget Activities",
  cruise: "Cruises",
  city: "City Exploration",
};

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
  estimated_cost: number | null;
  booked: number;
  latitude?: number | null;
  longitude?: number | null;
  place_id?: string | null;
}

interface AddItemFormState {
  day: number;
  category: string;
  title: string;
  description: string;
  price_estimate: string;
}

interface Props {
  tripId: number;
  initialItems: Item[];
  tripDestination?: string;
  tripBudget?: string | null;
  tripInterests?: string[];
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  tripAdults?: number;
  initialBudgetOverride?: number | null;
}

export default function ItineraryBuilder({
  tripId,
  initialItems,
  tripDestination = "",
  tripBudget = null,
  tripInterests = [],
  tripStartDate = null,
  tripEndDate = null,
  tripAdults = 1,
  initialBudgetOverride = null,
}: Props) {
  const t = useTranslations("itineraryBuilder");
  const [items, setItems] = useState<Item[]>(initialItems);
  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [form, setForm] = useState<AddItemFormState>({ day: 1, category: "hotel", title: "", description: "", price_estimate: "" });
  const [saving, setSaving] = useState(false);
  const [dayCount, setDayCount] = useState(() => {
    const fromItems = Math.max(...initialItems.map(i => i.day_number), 0);
    // Calculate days from trip dates if available
    if (tripStartDate && tripEndDate) {
      const start = new Date(tripStartDate);
      const end = new Date(tripEndDate);
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) return Math.max(fromItems, diffDays);
    }
    return Math.max(fromItems, 1);
  });

  /* ── Budget override state ── */
  const [budgetOverride, setBudgetOverride] = useState<number | null>(initialBudgetOverride);

  /* ── Map drawer state ── */
  const [showMap, setShowMap] = useState(false);
  const [hoveredItemId, setHoveredItemId] = useState<number | null>(null);

  /* ── Collapsed/expanded day state — all days expanded by default ── */
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(new Set());

  function toggleDayCollapse(day: number) {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  /* ── Multi-layer dropdown state ── */
  const [dropdownDay, setDropdownDay] = useState<number | null>(null);
  const [showActivitySub, setShowActivitySub] = useState(false);

  /* ── Interests modal state (triggered when Activity selected but user has no interests) ── */
  const [showInterestsModal, setShowInterestsModal] = useState(false);
  const [modalInterests, setModalInterests] = useState<string[]>([]);
  const [userInterests, setUserInterests] = useState<string[]>(tripInterests);
  const [savingInterests, setSavingInterests] = useState(false);
  const [pendingActivityDay, setPendingActivityDay] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; description: string; price_estimate: string }>({ title: "", description: "", price_estimate: "" });

  /* ── Fetch user preferences interests on mount (trip interests may be stale/empty) ── */
  useEffect(() => {
    fetch("/api/user/preferences")
      .then(r => r.ok ? r.json() : null)
      .then(prefs => {
        if (prefs?.interests?.length > 0) {
          setUserInterests(prev => {
            const merged = new Set([...prev, ...prefs.interests]);
            return Array.from(merged);
          });
        }
      })
      .catch(() => {});
  }, []);

  /* ── Auto-populate on first load ── */
  const [autoPopulated, setAutoPopulated] = useState(false);

  const autoPopulate = useCallback(async () => {
    if (autoPopulated || initialItems.length > 0) return;
    setAutoPopulated(true);

    const placeholders: { category: string; title: string; description: string }[] = [];

    if (tripDestination) {
      placeholders.push({
        category: "flight",
        title: t("placeholderFlight", { destination: tripDestination }),
        description: t("placeholderFlightDesc"),
      });
      placeholders.push({
        category: "hotel",
        title: t("placeholderHotel", { destination: tripDestination }),
        description: tripBudget
          ? t("placeholderHotelDescBudget", { tier: tripBudget === "midrange" ? t("mid") : tripBudget === "luxury" ? t("luxury") : t("budget") })
          : t("placeholderHotelDesc"),
      });
      placeholders.push({
        category: "car_rental",
        title: t("placeholderCar", { destination: tripDestination }),
        description: t("placeholderCarDesc"),
      });
    }

    if (placeholders.length === 0) return;

    const created: Item[] = [];
    for (let i = 0; i < placeholders.length; i++) {
      try {
        const res = await fetch(`/api/trips/${tripId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            day_number: 1,
            category: placeholders[i].category,
            title: placeholders[i].title,
            description: placeholders[i].description,
            sort_order: i,
            is_placeholder: 1,
          }),
        });
        if (res.ok) {
          const item = await res.json();
          created.push(item);
        }
      } catch {
        // Silently continue if one fails
      }
    }

    if (created.length > 0) {
      setItems(prev => [...prev, ...created]);
    }
  }, [autoPopulated, initialItems.length, tripDestination, tripBudget, tripId]);

  useEffect(() => {
    autoPopulate();
  }, [autoPopulate]);

  /* ── Build day list ── */
  const days = Array.from(
    { length: dayCount },
    (_, i) => i + 1
  );

  function getCategoryMeta(value: string) {
    return CATEGORIES.find(c => c.value === value) || CATEGORIES[CATEGORIES.length - 1];
  }

  /* ── Add Day button handler ── */
  function addDay() {
    const newDay = dayCount + 1;
    setDayCount(newDay);
    // Ensure new day is expanded
    setCollapsedDays(prev => {
      const next = new Set(prev);
      next.delete(newDay);
      return next;
    });
    // Auto-open the add-item dropdown for the new day
    startAddItem(newDay);
  }

  /* ── Multi-layer dropdown handlers ── */
  function openDropdown(day: number) {
    setDropdownDay(day);
    setShowActivitySub(false);
  }

  function closeDropdown() {
    setDropdownDay(null);
    setShowActivitySub(false);
  }

  function selectCategory(day: number, categoryValue: string) {
    if (categoryValue === "activity") {
      // Check if user has interests
      if (userInterests.length === 0 || userInterests.every(i => i === "ai_assisted")) {
        // Open interests modal
        setPendingActivityDay(day);
        setModalInterests([]);
        setShowInterestsModal(true);
        closeDropdown();
        return;
      }
      // Show activity sub-menu
      setShowActivitySub(true);
      return;
    }

    // For all other categories, open the inline form
    closeDropdown();
    setAddingDay(day);
    setForm({ day, category: categoryValue, title: "", description: "", price_estimate: "" });
  }

  function selectActivityInterest(day: number, interest: string) {
    closeDropdown();
    const label = INTEREST_LABELS[interest] || interest;
    setAddingDay(day);
    setForm({
      day,
      category: "activity",
      title: "",
      description: `${label} activity`,
      price_estimate: "",
    });
  }

  /* ── Interests modal save ── */
  async function saveInterests() {
    if (modalInterests.length === 0) return;
    setSavingInterests(true);

    // Fetch current preferences first, then merge interests to avoid overwriting other fields
    try {
      const currentRes = await fetch("/api/user/preferences");
      const currentPrefs = currentRes.ok ? await currentRes.json() : {};
      await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...currentPrefs, interests: modalInterests }),
      });
    } catch {
      // Continue even if save fails
    }

    setUserInterests(modalInterests);
    setSavingInterests(false);
    setShowInterestsModal(false);

    // Resume activity flow with the day that triggered the modal
    if (pendingActivityDay !== null) {
      setDropdownDay(pendingActivityDay);
      setShowActivitySub(true);
      setPendingActivityDay(null);
    }
  }

  function toggleModalInterest(interest: string) {
    setModalInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  }

  /* ── CRUD operations ── */
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

  function startEdit(item: Item) {
    setEditingItem(item.id);
    setEditForm({ title: item.title, description: item.description || "", price_estimate: item.price_estimate || "" });
  }

  async function saveEdit(itemId: number) {
    setSaving(true);
    const res = await fetch(`/api/trips/${tripId}/items/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editForm.title.trim(),
        description: editForm.description.trim() || "",
        price_estimate: editForm.price_estimate.trim() || "",
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...updated } : i));
      setEditingItem(null);
    }
    setSaving(false);
  }

  function startAddItem(day: number) {
    openDropdown(day);
  }

  /* ── No-interests info prompt ── */
  const hasInterests = userInterests.length > 0 && !userInterests.every(i => i === "ai_assisted");

  return (
    <div className="space-y-6">
      {/* Unified sticky toolbar: Map + Add Day + Budget Bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm px-4 py-2.5 -mx-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Left: action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowMap(v => !v)}
              className={`text-sm font-medium border px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                showMap
                  ? "bg-orange-600 text-white border-orange-600 hover:bg-orange-700"
                  : "text-orange-700 border-orange-300 hover:bg-orange-50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              {showMap ? t("hideMap") : t("showMap")}
            </button>
            <button
              onClick={addDay}
              className="text-sm text-orange-700 hover:text-orange-800 font-medium border border-orange-300 px-3 py-1.5 rounded-lg hover:bg-orange-50 transition-colors"
            >
              {t("addDay")} {dayCount + 1}
            </button>
          </div>

          {/* Right: inline budget bar */}
          <BudgetBar
            items={items}
            budgetTier={tripBudget}
            budgetOverride={budgetOverride}
            totalDays={dayCount}
            adults={tripAdults}
            tripId={tripId}
            onBudgetOverrideChange={setBudgetOverride}
          />
        </div>
      </div>

      {/* Interests prompt (if no interests selected) */}
      {!hasInterests && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-4 flex items-start gap-3">
          <span className="text-orange-500 mt-0.5 shrink-0" title="Tip">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-medium text-orange-900">{t("selectInterestsTip")}</p>
            <button
              onClick={() => { setModalInterests([]); setShowInterestsModal(true); setPendingActivityDay(null); }}
              className="mt-2 text-xs font-medium text-orange-700 underline hover:text-orange-800"
            >
              {t("chooseInterestsNow")}
            </button>
          </div>
        </div>
      )}

      {/* Day cards */}
      {days.map(day => (
        <div key={day} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div
            className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer select-none"
            onClick={() => toggleDayCollapse(day)}
          >
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${collapsedDays.has(day) ? "" : "rotate-90"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {t("day")} {day}
              <span className="text-xs font-normal text-gray-400">({items.filter(i => i.day_number === day).length} items)</span>
            </h3>
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => dropdownDay === day ? closeDropdown() : startAddItem(day)}
                className="text-xs text-orange-700 hover:text-orange-800 font-medium"
              >
                {t("addItem")}
              </button>

              {/* Multi-layer category dropdown */}
              {dropdownDay === day && !showActivitySub && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.value}
                      onClick={() => selectCategory(day, cat.value)}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
                    >
                      <span>{cat.icon}</span>
                      <span>{t(cat.labelKey)}</span>
                      {cat.value === "activity" && (
                        <svg className="w-3.5 h-3.5 ml-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Activity sub-menu (Layer 2) */}
              {dropdownDay === day && showActivitySub && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
                  <button
                    onClick={() => setShowActivitySub(false)}
                    className="w-full text-left px-4 py-2 text-xs text-gray-500 hover:bg-gray-50 flex items-center gap-1.5 border-b border-gray-100"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t("backToCategories")}
                  </button>
                  <p className="px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">{t("yourInterests")}</p>
                  {userInterests.filter(i => i !== "ai_assisted").map(interest => (
                    <button
                      key={interest}
                      onClick={() => selectActivityInterest(day, interest)}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-purple-50 flex items-center gap-2.5 transition-colors"
                    >
                      <span className="text-purple-500">{CATEGORIES[3].icon}</span>
                      <span>{INTEREST_LABELS[interest] || interest}</span>
                    </button>
                  ))}
                  {/* Generic activity option */}
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      onClick={() => {
                        closeDropdown();
                        setAddingDay(day);
                        setForm({ day, category: "activity", title: "", description: "", price_estimate: "" });
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      {t("otherActivity")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={`divide-y divide-gray-100 ${collapsedDays.has(day) ? "hidden" : ""}`}>
            {items.filter(i => i.day_number === day).map(item => {
              const cat = getCategoryMeta(item.category);
              const isEditing = editingItem === item.id;

              if (isEditing) {
                return (
                  <div key={item.id} className="px-5 py-4 bg-orange-50 border-t border-orange-100 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${cat.color}`}>{cat.icon} {t(cat.labelKey)}</span>
                      <span className="text-xs text-gray-400">{t("editing")}</span>
                    </div>
                    <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder={t("titlePlaceholder")} />
                    <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder={t("notesPlaceholder")} />
                    <div className="flex gap-1">
                      {(["budget", "mid", "luxury"] as const).map(tier => (
                        <button key={tier} type="button"
                          onClick={() => setEditForm(f => ({ ...f, price_estimate: f.price_estimate === tier ? "" : tier }))}
                          className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                            editForm.price_estimate === tier
                              ? tier === "budget" ? "bg-green-100 text-green-700 ring-1 ring-green-400"
                                : tier === "mid" ? "bg-blue-100 text-blue-700 ring-1 ring-blue-400"
                                : "bg-purple-100 text-purple-700 ring-1 ring-purple-400"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}>
                          {tier === "budget" ? t("budget") : tier === "mid" ? t("mid") : t("luxury")}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(item.id)} disabled={saving || !editForm.title.trim()}
                        className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors disabled:opacity-60">
                        {saving ? t("saving") : t("save")}
                      </button>
                      <button onClick={() => setEditingItem(null)}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                        {t("cancel")}
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={item.id}
                  id={`item-${item.id}`}
                  className={`flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${item.booked ? "opacity-60" : ""} ${hoveredItemId === item.id ? "bg-orange-50" : ""}`}
                  onClick={() => startEdit(item)}
                  onMouseEnter={() => setHoveredItemId(item.id)}
                  onMouseLeave={() => setHoveredItemId(null)}
                >
                  <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 mt-0.5 ${cat.color}`}>
                    {cat.icon} {t(cat.labelKey)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-gray-900 text-sm ${item.booked ? "line-through" : ""}`}>{item.title}</p>
                    {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {item.price_estimate && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          item.price_estimate === "budget" ? "bg-green-100 text-green-700"
                            : item.price_estimate === "mid" ? "bg-blue-100 text-blue-700"
                            : item.price_estimate === "luxury" ? "bg-purple-100 text-purple-700"
                            : "text-gray-400"
                        }`}>
                          {item.price_estimate === "budget" ? t("budget")
                            : item.price_estimate === "mid" ? t("mid")
                            : item.price_estimate === "luxury" ? t("luxury")
                            : item.price_estimate}
                        </span>
                      )}
                      {item.affiliate_url && (
                        <a href={item.affiliate_url} target="_blank" rel="noopener noreferrer sponsored"
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-orange-600 hover:text-orange-700 font-medium">
                          {t("bookNow")} →
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => toggleBooked(item)}
                      className={`text-xs px-2 py-1 rounded font-medium transition-colors ${item.booked ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                      {item.booked ? t("booked") : t("markBooked")}
                    </button>
                    <button onClick={() => deleteItem(item.id)}
                      className="text-xs text-red-400 hover:text-red-600 px-1">&times;</button>
                  </div>
                </div>
              );
            })}

            {items.filter(i => i.day_number === day).length === 0 && addingDay !== day && (
              <p className="text-sm text-gray-400 px-5 py-4 italic">{t("noItemsForDay")}</p>
            )}

            {/* Inline add-item form */}
            {addingDay === day && (
              <form onSubmit={addItem} className="px-5 py-4 bg-orange-50 border-t border-orange-100 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {t(c.labelKey)}</option>)}
                  </select>
                  <div className="flex gap-1">
                    {(["budget", "mid", "luxury"] as const).map(tier => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, price_estimate: f.price_estimate === tier ? "" : tier }))}
                        className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                          form.price_estimate === tier
                            ? tier === "budget" ? "bg-green-100 text-green-700 ring-1 ring-green-400"
                              : tier === "mid" ? "bg-blue-100 text-blue-700 ring-1 ring-blue-400"
                              : "bg-purple-100 text-purple-700 ring-1 ring-purple-400"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {tier === "budget" ? t("budget") : tier === "mid" ? t("mid") : t("luxury")}
                      </button>
                    ))}
                  </div>
                </div>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder={t("titlePlaceholder")} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={t("notesPlaceholder")} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                <div className="flex gap-2">
                  <button type="submit" disabled={saving}
                    className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors disabled:opacity-60">
                    {saving ? t("adding") : t("addItemButton")}
                  </button>
                  <button type="button" onClick={() => setAddingDay(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                    {t("cancel")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ))}

      {/* Click-away overlay to close dropdown */}
      {dropdownDay !== null && (
        <div className="fixed inset-0 z-40" onClick={closeDropdown} />
      )}

      {/* ── Map Drawer ── */}
      <MapDrawer
        isOpen={showMap}
        onClose={() => setShowMap(false)}
        items={items.map(i => ({
          id: i.id,
          day_number: i.day_number,
          category: i.category,
          title: i.title,
          latitude: i.latitude ?? null,
          longitude: i.longitude ?? null,
        }))}
        destination={tripDestination}
        totalDays={dayCount}
        hoveredItemId={hoveredItemId}
        onPinClick={(itemId) => {
          setShowMap(false);
          setTimeout(() => {
            const el = document.getElementById(`item-${itemId}`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 150);
        }}
      />

      {/* ── Interests selection modal ── */}
      {showInterestsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowInterestsModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
            <button
              onClick={() => setShowInterestsModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900">{t("selectInterests")}</h2>
              <p className="text-sm text-gray-600 mt-1">
                {t("pickAtLeastOne")}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              {PREF_ENUMS.interests.filter(i => i !== "ai_assisted").map(interest => {
                const selected = modalInterests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleModalInterest(interest)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selected
                        ? "bg-orange-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {INTEREST_LABELS[interest] || interest}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowInterestsModal(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={saveInterests}
                disabled={modalInterests.length === 0 || savingInterests}
                className="flex-1 bg-orange-600 text-white py-2.5 rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingInterests ? t("saving") : t("saveContinue")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

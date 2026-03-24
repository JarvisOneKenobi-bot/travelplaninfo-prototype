"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { calculateBudgetLimit } from "@/lib/cost-utils";
import { useTranslations } from "next-intl";

interface ItemWithCost {
  id: number;
  day_number: number;
  category: string;
  estimated_cost: number | null;
}

interface Props {
  items: ItemWithCost[];
  budgetTier: string | null;
  budgetOverride: number | null;
  totalDays: number;
  adults: number;
  tripId: number;
  onBudgetOverrideChange: (value: number | null) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  flight: "Flights",
  hotel: "Hotel",
  car_rental: "Car Rental",
  activity: "Activities",
  restaurant: "Dining",
  transportation: "Transport",
  note: "Notes",
};

export default function BudgetBar({
  items,
  budgetTier,
  budgetOverride,
  totalDays,
  adults,
  tripId,
  onBudgetOverrideChange,
}: Props) {
  const t = useTranslations("budgetBar");
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const budgetLimit = useMemo(() => {
    if (budgetOverride != null && budgetOverride > 0) return budgetOverride;
    return calculateBudgetLimit(budgetTier, totalDays, adults);
  }, [budgetOverride, budgetTier, totalDays, adults]);

  const totalCost = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.estimated_cost ?? 0), 0);
  }, [items]);

  const byDay = useMemo(() => {
    const map: Record<number, number> = {};
    for (const item of items) {
      if (item.estimated_cost != null) {
        map[item.day_number] = (map[item.day_number] ?? 0) + item.estimated_cost;
      }
    }
    return map;
  }, [items]);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) {
      if (item.estimated_cost != null) {
        map[item.category] = (map[item.category] ?? 0) + item.estimated_cost;
      }
    }
    return map;
  }, [items]);

  const pct = budgetLimit > 0 ? Math.min((totalCost / budgetLimit) * 100, 100) : 0;
  const overBudget = totalCost > budgetLimit && budgetLimit > 0;

  const barColor =
    pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-400" : "bg-green-500";

  const textColor =
    pct >= 90 ? "text-red-600" : pct >= 70 ? "text-amber-600" : "text-green-600";

  function fmt(n: number) {
    return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  function startEditBudget() {
    setEditValue(budgetOverride != null && budgetOverride > 0 ? String(budgetOverride) : "");
    setEditingBudget(true);
  }

  async function saveBudget() {
    const parsed = parseFloat(editValue);
    const newVal = editValue.trim() === "" || isNaN(parsed) ? null : parsed;
    setSaving(true);
    try {
      await fetch(`/api/trips/${tripId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget_override: newVal ?? 0 }),
      });
      onBudgetOverrideChange(newVal);
    } catch {
      // Silently ignore — UI already updated optimistically
    }
    setSaving(false);
    setEditingBudget(false);
  }

  function handleBudgetKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") saveBudget();
    if (e.key === "Escape") setEditingBudget(false);
  }

  // Focus input when edit mode opens
  useEffect(() => {
    if (editingBudget) inputRef.current?.focus();
  }, [editingBudget]);

  // Close breakdown on click outside
  useEffect(() => {
    if (!showBreakdown) return;
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowBreakdown(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showBreakdown]);

  // Don't render if no items have costs and budget is auto
  if (totalCost === 0 && budgetOverride == null) return null;

  const dayKeys = Object.keys(byDay).map(Number).sort((a, b) => a - b);
  const catKeys = Object.keys(byCategory).sort((a, b) => byCategory[b] - byCategory[a]);

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm px-4 py-2.5">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Cost vs Budget label */}
        <div className="flex items-center gap-1 shrink-0">
          <span className={`font-semibold text-sm ${textColor}`}>{fmt(totalCost)}</span>
          <span className="text-xs text-gray-400">{t("of")}</span>
          {editingBudget ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">$</span>
              <input
                ref={inputRef}
                type="number"
                min="0"
                step="50"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={saveBudget}
                onKeyDown={handleBudgetKeyDown}
                disabled={saving}
                placeholder="amount"
                className="w-20 text-xs border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
          ) : (
            <button
              onClick={startEditBudget}
              title={t("clickToSetBudget")}
              className="text-sm font-semibold text-gray-700 hover:text-orange-600 hover:underline transition-colors"
            >
              {fmt(budgetLimit)}
            </button>
          )}
          <span className="text-xs text-gray-400">{t("budget")}</span>
          {overBudget && (
            <span className="ml-1 text-xs font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
              {t("overBudget")}
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex-1 min-w-[80px] h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Percent */}
        <span className={`text-xs font-medium shrink-0 ${textColor}`}>
          {Math.round(pct)}%
        </span>

        {/* By Day dropdown trigger */}
        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setShowBreakdown(v => !v)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1 rounded hover:bg-gray-100 transition-colors"
          >
            {t("breakdown")}
            <svg
              className={`w-3 h-3 transition-transform ${showBreakdown ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showBreakdown && (
            <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-xl shadow-lg border border-gray-200 z-50 p-4">
              <div className="grid grid-cols-2 gap-4">
                {/* By Day */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {t("byDay")}
                  </p>
                  {dayKeys.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">{t("noCostsYet")}</p>
                  ) : (
                    <ul className="space-y-1">
                      {dayKeys.map(day => (
                        <li key={day} className="flex justify-between text-xs">
                          <span className="text-gray-600">{t("day")} {day}</span>
                          <span className="font-medium text-gray-800">{fmt(byDay[day])}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* By Category */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {t("byCategory")}
                  </p>
                  {catKeys.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">{t("noCostsYet")}</p>
                  ) : (
                    <ul className="space-y-1">
                      {catKeys.map(cat => (
                        <li key={cat} className="flex justify-between text-xs">
                          <span className="text-gray-600">
                            {CATEGORY_LABELS[cat] ?? cat}
                          </span>
                          <span className="font-medium text-gray-800">{fmt(byCategory[cat])}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Total row */}
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs font-semibold">
                <span className="text-gray-700">{t("total")}</span>
                <span className={textColor}>{fmt(totalCost)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

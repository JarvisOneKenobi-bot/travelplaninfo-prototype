"use client";

import { useState, useEffect, useCallback } from "react";

interface Step {
  id: string;
  label: string;
  status: "pending" | "loading" | "done";
  count?: number;
}

interface GenerationProgressProps {
  destination: string;
  isGenerating: boolean;
  onComplete?: () => void;
}

export default function GenerationProgress({
  destination,
  isGenerating,
  onComplete,
}: GenerationProgressProps) {
  const [steps, setSteps] = useState<Step[]>([
    { id: "flights", label: `Searching flights to ${destination}`, status: "pending" },
    { id: "hotels", label: `Finding hotels in ${destination}`, status: "pending" },
    { id: "activities", label: "Discovering activities & restaurants", status: "pending" },
    { id: "schedule", label: "Building day-by-day schedule", status: "pending" },
    { id: "route", label: "Optimizing route between locations", status: "pending" },
  ]);
  const [collapsed, setCollapsed] = useState(false);

  const totalSteps = 5;
  const doneCount = steps.filter((s) => s.status === "done").length;
  const pct = Math.round((doneCount / totalSteps) * 100);
  const allDone = doneCount === totalSteps;
  const totalResults = steps.reduce((sum, s) => sum + (s.count ?? 0), 0);

  const handleProgressEvent = useCallback((e: Event) => {
    const { stepId, status, count } = (e as CustomEvent<{ stepId: string; status: "loading" | "done"; count?: number }>).detail;
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId
          ? { ...step, status, ...(count !== undefined ? { count } : {}) }
          : step
      )
    );
  }, []);

  useEffect(() => {
    window.addEventListener("atlas-progress", handleProgressEvent);
    return () => window.removeEventListener("atlas-progress", handleProgressEvent);
  }, [handleProgressEvent]);

  useEffect(() => {
    if (allDone) {
      const timer = setTimeout(() => {
        setCollapsed(true);
        onComplete?.();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [allDone, onComplete]);

  if (!isGenerating && !allDone) return null;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="w-full text-left bg-green-50 border border-green-200 rounded-xl p-4 text-green-800 font-medium hover:bg-green-100 transition-colors"
      >
        Atlas found {totalResults} results for your trip.{" "}
        <span className="underline">View details</span>
      </button>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 space-y-4">
      <p className="font-semibold text-blue-900 text-base">
        Atlas is building your itinerary...
      </p>

      <ul className="space-y-3">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {step.status === "done" && <span className="text-lg leading-none">✅</span>}
              {step.status === "loading" && (
                <span className="text-lg leading-none animate-spin inline-block">🔄</span>
              )}
              {step.status === "pending" && (
                <span className="text-lg leading-none text-gray-400">○</span>
              )}
              <span
                className={`text-sm truncate ${
                  step.status === "pending" ? "text-gray-400" : "text-gray-700"
                }`}
              >
                {step.label}
              </span>
            </div>
            <span className="text-sm shrink-0 text-gray-500">
              {step.status === "done" && step.count !== undefined
                ? `found ${step.count}`
                : step.status === "loading"
                ? "searching..."
                : null}
            </span>
          </li>
        ))}
      </ul>

      <div className="space-y-1">
        <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 text-right">{pct}%</p>
      </div>
    </div>
  );
}

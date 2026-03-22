"use client";

import { useState } from "react";
import { PREF_ENUMS } from "@/lib/preferences";

interface InterestsModalProps {
  onSave: (interests: string[]) => void;
  onClose: () => void;
  initialInterests: string[];
}

/**
 * Standalone interests selection modal — extracted from OnboardingModal step 3.
 * Triggered from the itinerary page when user clicks "Activity" without interests selected.
 * Same chip grid and TPI orange accent styling.
 */
export default function InterestsModal({ onSave, onClose, initialInterests }: InterestsModalProps) {
  const [selected, setSelected] = useState<string[]>(initialInterests);

  function toggle(interest: string) {
    setSelected((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  }

  function handleSave() {
    onSave(selected);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-xl font-bold text-gray-900 text-center">Select Your Interests</h2>
        <p className="text-sm text-gray-600 text-center">
          Choose interests so Atlas can suggest activities for your trip.
        </p>

        <div className="flex flex-wrap gap-2 justify-center">
          {/* AI Assisted chip */}
          <button
            type="button"
            onClick={() => toggle("ai_assisted")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
              selected.includes("ai_assisted")
                ? "bg-orange-500 text-white"
                : "bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100"
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a1 1 0 011 1v1.323l1.954.674a1 1 0 01.07 1.846L11 7.692V9h1.308l.849-2.024a1 1 0 011.846.07L14.329 9H16a1 1 0 110 2h-1.671l-.674 1.954a1 1 0 01-1.846.07L11 11.308V13a1 1 0 11-2 0v-1.692l-2.024.849a1 1 0 01-.07-1.846L9 9.308V8H7.692l-.849 2.024a1 1 0 01-1.846-.07L5.671 8H4a1 1 0 110-2h1.671l.674-1.954a1 1 0 011.846-.07L9 5.692V4a1 1 0 011-1z" />
            </svg>
            Let Atlas decide
          </button>
          {/* Regular interest chips */}
          {PREF_ENUMS.interests.filter((i) => i !== "ai_assisted").map((interest) => {
            const isSelected = selected.includes(interest);
            return (
              <button
                key={interest}
                type="button"
                onClick={() => toggle(interest)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  isSelected
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {interest}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={selected.length === 0}
            className="flex-1 bg-orange-600 text-white py-2.5 rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Interests
          </button>
        </div>
      </div>
    </div>
  );
}

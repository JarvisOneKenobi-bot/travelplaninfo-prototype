"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { PREF_ENUMS } from "@/lib/preferences";
import type { UserPreferences } from "@/lib/preferences";

const LS_KEY = "tpi_onboarding_complete";

/** Icons for budget tier cards (no dollar amounts — just labels + icons) */
const BUDGET_ICONS: Record<(typeof PREF_ENUMS.budget_tier)[number], { icon: string; label: string }> = {
  budget: { icon: "🎒", label: "Budget" },
  mid: { icon: "🏖️", label: "Mid-range" },
  luxury: { icon: "✨", label: "Luxury" },
};

export default function OnboardingModal() {
  const { data: session, status } = useSession();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(1);
  const [airport, setAirport] = useState("");
  const [budget, setBudget] = useState<(typeof PREF_ENUMS.budget_tier)[number]>("mid");
  const [interests, setInterests] = useState<(typeof PREF_ENUMS.interests)[number][]>([]);
  const [aiAssisted, setAiAssisted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) {
      setChecking(false);
      return;
    }

    // Step 1: sync check localStorage
    if (typeof window !== "undefined" && localStorage.getItem(LS_KEY)) {
      setChecking(false);
      return;
    }

    // Step 2: fetch prefs to see if already completed
    fetch("/api/user/preferences")
      .then((r) => r.json())
      .then((data: UserPreferences) => {
        if (data.home_airport && data.home_airport !== "") {
          // Already completed — set flag and hide
          localStorage.setItem(LS_KEY, "1");
          setChecking(false);
        } else {
          // Show modal
          setChecking(false);
          setVisible(true);
        }
      })
      .catch(() => {
        setChecking(false);
      });
  }, [status, session]);

  function dismiss() {
    localStorage.setItem(LS_KEY, "1");
    setVisible(false);
  }

  function toggleInterest(interest: (typeof PREF_ENUMS.interests)[number]) {
    if (interest === "ai_assisted") {
      setAiAssisted((prev) => !prev);
      return;
    }
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  }

  async function finish() {
    setSaving(true);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home_airport: airport.toUpperCase(),
          budget_tier: budget,
          interests,
          ai_assisted: aiAssisted,
        }),
      });
      if (res.ok) {
        localStorage.setItem(LS_KEY, "1");
        setVisible(false);
      }
    } catch {
      // Silently fail — user can complete from preferences page
    } finally {
      setSaving(false);
    }
  }

  if (checking || !visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-6">
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                s === step ? "bg-orange-500" : s < step ? "bg-orange-300" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Airport */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 text-center">Welcome to TravelPlanInfo!</h2>
            <p className="text-sm text-gray-600 text-center">
              Let&apos;s personalize your experience. Where do you fly from?
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Home Airport (IATA code)
              </label>
              <input
                type="text"
                maxLength={4}
                value={airport}
                onChange={(e) => setAirport(e.target.value.toUpperCase())}
                placeholder="e.g. MIA, JFK, LAX"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                autoFocus
              />
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={!airport.trim()}
              className="w-full bg-orange-600 text-white py-2.5 rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}

        {/* Step 2: Budget — icons only, no dollar amounts (thresholds live on full preferences page) */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 text-center">What&apos;s your budget style?</h2>
            <p className="text-sm text-gray-600 text-center">
              This helps us find the best deals for you.
            </p>
            <div className="flex gap-3">
              {PREF_ENUMS.budget_tier.map((tier) => {
                const meta = BUDGET_ICONS[tier];
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setBudget(tier)}
                    className={`flex-1 py-4 rounded-lg text-sm font-medium transition-colors border flex flex-col items-center gap-1 ${
                      budget === tier
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-white text-gray-700 border-gray-300 hover:border-orange-300"
                    }`}
                  >
                    <span className="text-xl">{meta.icon}</span>
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-orange-600 text-white py-2.5 rounded-lg font-medium hover:bg-orange-700 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Interests */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 text-center">Pick your interests</h2>
            <p className="text-sm text-gray-600 text-center">
              Select at least 3 to get personalized recommendations, or let Atlas decide.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {/* AI Assisted chip — special styling with sparkle icon */}
              <button
                type="button"
                onClick={() => toggleInterest("ai_assisted")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                  aiAssisted
                    ? "bg-orange-500 text-white"
                    : "bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100"
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a1 1 0 011 1v1.323l1.954.674a1 1 0 01.07 1.846L11 7.692V9h1.308l.849-2.024a1 1 0 011.846.07L14.329 9H16a1 1 0 110 2h-1.671l-.674 1.954a1 1 0 01-1.846.07L11 11.308V13a1 1 0 11-2 0v-1.692l-2.024.849a1 1 0 01-.07-1.846L9 9.308V8H7.692l-.849 2.024a1 1 0 01-1.846-.07L5.671 8H4a1 1 0 110-2h1.671l.674-1.954a1 1 0 011.846-.07L9 5.692V4a1 1 0 011-1z" />
                </svg>
                Let Atlas decide
              </button>
              {/* Regular interest chips (excluding ai_assisted — it's handled above) */}
              {PREF_ENUMS.interests.filter((i) => i !== "ai_assisted").map((interest) => {
                const selected = interests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selected
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
                onClick={() => setStep(2)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={finish}
                disabled={(!aiAssisted && interests.length < 3) || saving}
                className="flex-1 bg-orange-600 text-white py-2.5 rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Done"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

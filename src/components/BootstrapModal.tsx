"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export const GUEST_BOOTSTRAP_LS_KEY = "tpi_onboarding_bootstrap_complete";
export const GUEST_PREFS_LS_KEY = "tpi_guest_prefs";

export const GUEST_INTERESTS = ['beach', 'mountains', 'food', 'culture'] as const;
type GuestInterest = (typeof GUEST_INTERESTS)[number];

interface BootstrapModalProps {
  onClose: () => void;
}

export default function BootstrapModal({ onClose }: BootstrapModalProps) {
  const t = useTranslations("bootstrapModal");
  const [homeAirport, setHomeAirport] = useState("");
  const [interests, setInterests] = useState<GuestInterest[]>([]);

  function toggleInterest(interest: GuestInterest) {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  }

  function save() {
    if (!homeAirport || interests.length < 2) return;

    const prefs = { homeAirport: homeAirport.toUpperCase(), interests };
    if (typeof window !== "undefined") {
      localStorage.setItem(GUEST_BOOTSTRAP_LS_KEY, "1");
      localStorage.setItem(GUEST_PREFS_LS_KEY, JSON.stringify(prefs));
      window.dispatchEvent(
        new CustomEvent("atlas-onboarding-complete", { detail: prefs })
      );
    }
    onClose();
  }

  const canSave = Boolean(homeAirport) && interests.length >= 2;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      data-testid="onboarding-bootstrap"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold text-gray-900">{t("title")}</h2>
          <p className="text-sm text-gray-600">{t("subtitle")}</p>
        </div>

        {/* Home Airport */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {t("homeAirportLabel")}
          </label>
          <input
            type="text"
            maxLength={4}
            value={homeAirport}
            onChange={(e) => setHomeAirport(e.target.value.toUpperCase())}
            placeholder="e.g. MIA"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            data-testid="bootstrap-home-airport"
            autoFocus
          />
        </div>

        {/* Interests */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">{t("interestsLabel")}</p>
          <div className="flex flex-wrap gap-2">
            {GUEST_INTERESTS.map((interest) => {
              const selected = interests.includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  aria-pressed={selected}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selected
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {t(`interest.${interest}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          data-testid="bootstrap-save"
          className="w-full bg-orange-600 text-white py-2.5 rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t("save")}
        </button>
      </div>
    </div>
  );
}

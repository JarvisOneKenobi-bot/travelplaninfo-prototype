"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Header from "@/components/Header";
import HelpButton from "@/components/HelpButton";
import type { UserPreferences } from "@/lib/preferences";
import { PREF_ENUMS } from "@/lib/preferences";

export default function PreferencesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("preferences");
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/user/preferences")
        .then((r) => r.json())
        .then((data) => setPrefs(data))
        .catch(() => setToast({ type: "error", message: t("loadFailed") }));
    }
  }, [status]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!prefs) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error("Save failed");
      const updated = await res.json();
      setPrefs(updated);
      setToast({ type: "success", message: t("savedSuccess") });
    } catch {
      setToast({ type: "error", message: t("saveFailed") });
    } finally {
      setSaving(false);
    }
  }

  function toggleInterest(interest: (typeof PREF_ENUMS.interests)[number] | string) {
    if (!prefs) return;
    if (interest === "ai_assisted") {
      setPrefs({ ...prefs, ai_assisted: !prefs.ai_assisted });
      return;
    }
    const current = prefs.interests;
    const next = current.includes(interest)
      ? current.filter((i) => i !== interest)
      : [...current, interest];
    setPrefs({ ...prefs, interests: next });
  }

  function setBudgetMax(value: number) {
    if (!prefs) return;
    const clamped = Math.max(1, Math.floor(value));
    const midMax = Math.max(clamped + 1, prefs.budget_ranges.mid_max);
    setPrefs({ ...prefs, budget_ranges: { budget_max: clamped, mid_max: midMax } });
  }

  function setMidMax(value: number) {
    if (!prefs) return;
    const clamped = Math.max(prefs.budget_ranges.budget_max + 1, Math.floor(value));
    setPrefs({ ...prefs, budget_ranges: { ...prefs.budget_ranges, mid_max: clamped } });
  }

  if (status === "loading" || !prefs) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-gray-500">{t("loading")}</div>
        </main>
        <HelpButton pageId="preferences" />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50 py-10 px-4">
        <form onSubmit={handleSave} className="max-w-3xl mx-auto space-y-8">
          <h1 className="text-3xl font-bold text-gray-900">{t("title")}</h1>

          {/* Toast */}
          {toast && (
            <div
              className={`rounded-lg px-4 py-3 text-sm font-medium ${
                toast.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {toast.message}
            </div>
          )}

          {/* Travel Profile */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">{t("travelProfile")}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("homeAirportLabel")}</label>
                <input
                  type="text"
                  maxLength={4}
                  value={prefs.home_airport}
                  onChange={(e) => setPrefs({ ...prefs, home_airport: e.target.value.toUpperCase() })}
                  placeholder={t("homeAirportPlaceholder")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("homeCityLabel")}</label>
                <input
                  type="text"
                  maxLength={100}
                  value={prefs.home_city}
                  onChange={(e) => setPrefs({ ...prefs, home_city: e.target.value })}
                  placeholder={t("homeCityPlaceholder")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("budgetTierLabel")}</label>
              <div className="flex gap-3">
                {PREF_ENUMS.budget_tier.map((tier) => (
                  <label key={tier} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="budget_tier"
                      value={tier}
                      checked={prefs.budget_tier === tier}
                      onChange={() => setPrefs({ ...prefs, budget_tier: tier })}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">{tier}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom budget ranges */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("customBudgetRanges")}
              </label>
              <p className="text-xs text-gray-500 mb-3">
                {t("customBudgetRangesDesc")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <span className="block text-xs font-medium text-gray-500 mb-1">{t("budgetLabel")}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-600">{t("underDollar")}</span>
                    <input
                      type="number"
                      min={1}
                      value={prefs.budget_ranges.budget_max}
                      onChange={(e) => setBudgetMax(parseInt(e.target.value) || 1)}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <span className="text-sm text-gray-600">{t("perDay")}</span>
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <span className="block text-xs font-medium text-gray-500 mb-1">{t("midrangeLabel")}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-600">${prefs.budget_ranges.budget_max} to $</span>
                    <input
                      type="number"
                      min={prefs.budget_ranges.budget_max + 1}
                      value={prefs.budget_ranges.mid_max}
                      onChange={(e) => setMidMax(parseInt(e.target.value) || prefs.budget_ranges.budget_max + 1)}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <span className="text-sm text-gray-600">{t("perDay")}</span>
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <span className="block text-xs font-medium text-gray-500 mb-1">{t("luxuryLabel")}</span>
                  <div className="flex items-center gap-1 py-1">
                    <span className="text-sm text-gray-600">${prefs.budget_ranges.mid_max}+ {t("perDay")}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("currencyLabel")}</label>
              <select
                value={prefs.currency_pref}
                onChange={(e) =>
                  setPrefs({ ...prefs, currency_pref: e.target.value as typeof prefs.currency_pref })
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                {PREF_ENUMS.currency_pref.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Party */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">{t("travelParty")}</h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("adultsLabel")}</label>
                <input
                  type="number"
                  min={0}
                  value={prefs.party.adults}
                  onChange={(e) =>
                    setPrefs({ ...prefs, party: { ...prefs.party, adults: Math.max(0, parseInt(e.target.value) || 0) } })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("childrenLabel")}</label>
                <input
                  type="number"
                  min={0}
                  value={prefs.party.children}
                  onChange={(e) =>
                    setPrefs({ ...prefs, party: { ...prefs.party, children: Math.max(0, parseInt(e.target.value) || 0) } })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.party.has_pets}
                    onChange={(e) =>
                      setPrefs({ ...prefs, party: { ...prefs.party, has_pets: e.target.checked } })
                    }
                    className="rounded text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">{t("petsLabel")}</span>
                </label>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.party.accessibility_needs}
                    onChange={(e) =>
                      setPrefs({ ...prefs, party: { ...prefs.party, accessibility_needs: e.target.checked } })
                    }
                    className="rounded text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">{t("accessibilityLabel")}</span>
                </label>
              </div>
            </div>
          </section>

          {/* Interests */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">{t("interestsTitle")}</h2>
            <div className="flex flex-wrap gap-2">
              {/* AI Assisted chip */}
              <button
                type="button"
                onClick={() => toggleInterest("ai_assisted")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                  prefs.ai_assisted
                    ? "bg-orange-500 text-white"
                    : "bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100"
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a1 1 0 011 1v1.323l1.954.674a1 1 0 01.07 1.846L11 7.692V9h1.308l.849-2.024a1 1 0 011.846.07L14.329 9H16a1 1 0 110 2h-1.671l-.674 1.954a1 1 0 01-1.846.07L11 11.308V13a1 1 0 11-2 0v-1.692l-2.024.849a1 1 0 01-.07-1.846L9 9.308V8H7.692l-.849 2.024a1 1 0 01-1.846-.07L5.671 8H4a1 1 0 110-2h1.671l.674-1.954a1 1 0 011.846-.07L9 5.692V4a1 1 0 011-1z" />
                </svg>
                {t("letAtlasDecide")}
              </button>
              {PREF_ENUMS.interests.filter((i) => i !== "ai_assisted").map((interest) => {
                const selected = prefs.interests.includes(interest);
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
              {prefs.interests
                .filter((i) => !PREF_ENUMS.interests.includes(i as any) && i !== "ai_assisted")
                .map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className="px-4 py-2 rounded-full text-sm font-medium bg-orange-500 text-white border-2 border-dashed border-orange-300"
                  >
                    {interest} ×
                  </button>
                ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t("addCustomInterest")}
                maxLength={30}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const val = (e.target as HTMLInputElement).value.trim().toLowerCase();
                    if (val && !prefs.interests.includes(val)) {
                      setPrefs(p => p ? { ...p, interests: [...p.interests, val] } : p);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }
                }}
                id="custom-interest-input"
              />
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById("custom-interest-input") as HTMLInputElement;
                  const val = input?.value.trim().toLowerCase();
                  if (val && !prefs.interests.includes(val)) {
                    setPrefs(p => p ? { ...p, interests: [...p.interests, val] } : p);
                    input.value = "";
                  }
                }}
                className="px-4 py-2 text-sm font-medium bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
              >
                {t("addButton")}
              </button>
            </div>
          </section>

          {/* Trip Preferences */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">{t("tripPreferences")}</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("defaultSearchMode")}</label>
              <div className="flex flex-wrap gap-3">
                {PREF_ENUMS.default_search_mode.map((mode) => (
                  <label key={mode} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="default_search_mode"
                      value={mode}
                      checked={prefs.default_search_mode === mode}
                      onChange={() => setPrefs({ ...prefs, default_search_mode: mode })}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700">
                      {mode.replace(/_/g, " ")}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("tripLengthLabel")}</label>
              <div className="flex flex-wrap gap-3">
                {PREF_ENUMS.trip_length_pref.map((len) => (
                  <label key={len} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="trip_length_pref"
                      value={len}
                      checked={prefs.trip_length_pref === len}
                      onChange={() => setPrefs({ ...prefs, trip_length_pref: len })}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700">
                      {len.replace(/_/g, " ")}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("climatePref")}</label>
              <input
                type="text"
                maxLength={100}
                value={prefs.climate_pref}
                onChange={(e) => setPrefs({ ...prefs, climate_pref: e.target.value })}
                placeholder={t("climatePlaceholder")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </section>

          {/* Assistant Settings */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">{t("assistantSettings")}</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("responseStyle")}</label>
              <div className="flex gap-3">
                {PREF_ENUMS.assistant_style.map((style) => (
                  <label key={style} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="assistant_style"
                      value={style}
                      checked={prefs.assistant_style === style}
                      onChange={() => setPrefs({ ...prefs, assistant_style: style })}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">{style}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.voice_enabled}
                onChange={(e) => setPrefs({ ...prefs, voice_enabled: e.target.checked })}
                className="rounded text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">{t("voiceEnabled")}</span>
            </label>
          </section>

          {/* Deal Alerts */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">{t("dealAlerts")}</h2>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.deal_alerts}
                onChange={(e) => setPrefs({ ...prefs, deal_alerts: e.target.checked })}
                className="rounded text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">{t("enableDealAlerts")}</span>
            </label>

            {prefs.deal_alerts && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("alertThreshold")} {prefs.deal_alert_threshold_pct}{t("percentOff")}
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={prefs.deal_alert_threshold_pct}
                  onChange={(e) =>
                    setPrefs({ ...prefs, deal_alert_threshold_pct: parseInt(e.target.value) })
                  }
                  className="w-full accent-orange-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            )}
          </section>

          {/* Save button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-orange-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t("saving") : t("savePreferences")}
            </button>
          </div>
        </form>
      </main>
      <HelpButton pageId="preferences" />
    </>
  );
}

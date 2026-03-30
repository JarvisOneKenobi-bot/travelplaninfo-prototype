# Path B Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance Path B ("Surprise Me") with custom vibes, hybrid custom budget, auto-slide carousel, custom date inputs, and daily activities service pill.

**Architecture:** All 5 enhancements are isolated changes within the existing TripForm component and PackageDealsCarousel. DB migrations extend the trips table. API route adds new fields with backward compatibility (defaults).

**Tech Stack:** React 18 + Next.js, TypeScript, Tailwind CSS, SQLite (better-sqlite3), next-intl i18n

---

### Task 1: Custom Vibes — State + JSX

**Files:**
- Modify: `src/components/TripForm.tsx`

- [ ] **Step 1: Add customVibes state and handlers**

After line 94 (`vibes` state), add:

```typescript
const [customVibes, setCustomVibes] = useState<string[]>([]);
const [showCustomVibes, setShowCustomVibes] = useState(false);
const [customVibeInput, setCustomVibeInput] = useState("");
```

After the `removeCustomInterest` function (~line 217), add:

```typescript
function addCustomVibes(raw: string) {
  const items = raw.split(/[,\n]/).map(s => s.trim().toLowerCase()).filter(Boolean);
  const newOnes = items.filter(i => !customVibes.includes(i) && !VIBES.some(v => v.value === i));
  if (newOnes.length > 0) setCustomVibes(prev => [...prev, ...newOnes]);
  setCustomVibeInput("");
}

function removeCustomVibe(item: string) {
  setCustomVibes(prev => prev.filter(v => v !== item));
}
```

- [ ] **Step 2: Update vibes JSX in explore branch**

In the vibes section (explore branch, after the VIBES.map loop closing `</div>`), add custom vibe chips and the "Add" button:

```tsx
{customVibes.map(c => (
  <button key={c} type="button" onClick={() => removeCustomVibe(c)}
    className="px-3 py-1.5 rounded-full text-sm font-medium bg-pink-100 border border-pink-400 text-pink-800">
    {c} ✕
  </button>
))}
<button type="button" onClick={() => setShowCustomVibes(!showCustomVibes)}
  className="px-3 py-1.5 rounded-full text-sm font-medium border border-dashed border-gray-400 text-gray-500 hover:border-pink-400 hover:text-pink-600 transition-colors">
  + {t("add")}
</button>
```

After the vibes flex-wrap div, add the input row:

```tsx
{showCustomVibes && (
  <div className="flex gap-2 items-center">
    <input type="text" value={customVibeInput} onChange={e => setCustomVibeInput(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomVibes(customVibeInput); } }}
      placeholder={t("customVibesPlaceholder")}
      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm" />
    <button type="button" onClick={() => addCustomVibes(customVibeInput)}
      className="px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-medium hover:bg-pink-700 transition-colors">
      {t("add")}
    </button>
  </div>
)}
```

- [ ] **Step 3: Wire custom vibes into submit + context**

In `handleSubmit`, update the `finalInterests` for surpriseMe mode to include custom vibes:

```typescript
const finalInterests = surpriseMe
  ? [
      ...interests,
      ...customInterests.map(c => `custom:${c}`),
      ...vibes.map(v => `vibe:${v}`),
      ...customVibes.map(v => `vibe:custom:${v}`),
    ]
  : [...interests, ...customInterests.map(c => `custom:${c}`)];
```

In the `__atlasFormContext` effect, update the vibes field:

```typescript
vibes: surpriseMe ? [...vibes, ...customVibes.map(v => `custom:${v}`)] : [],
```

Add `customVibes` to the effect dependency array.

- [ ] **Step 4: Reset custom vibes in selectMode**

In `selectMode('flight')` branch, add:

```typescript
setCustomVibes([]);
```

- [ ] **Step 5: Verify dev server renders vibes with custom add**

Open http://localhost:3001/planner/, pick Path B, confirm "+ Add" button appears after vibe chips, type a custom vibe, press Enter, confirm it appears as a pink chip.

- [ ] **Step 6: Commit**

```bash
git add src/components/TripForm.tsx
git commit -m "feat(tripform): add custom vibes input for Path B explore mode"
```

---

### Task 2: Custom Budget — State + Panel UI

**Files:**
- Modify: `src/components/TripForm.tsx`

- [ ] **Step 1: Add budget state variables**

After the `budget` state (~line 91), add:

```typescript
const [budgetMode, setBudgetMode] = useState<'preset' | 'total' | 'per_day' | 'per_person'>('preset');
const [budgetAmount, setBudgetAmount] = useState<number | null>(null);
const [budgetCategories, setBudgetCategories] = useState<Record<string, number | undefined>>({});
const [showFineTune, setShowFineTune] = useState(false);
```

- [ ] **Step 2: Add budget mode helpers**

```typescript
function selectPresetBudget(value: string) {
  setBudget(value);
  setBudgetMode('preset');
  setBudgetAmount(null);
  setBudgetCategories({});
  setShowFineTune(false);
}

function selectCustomBudget(scope: 'total' | 'per_day' | 'per_person') {
  setBudget('');
  setBudgetMode(scope);
}

function updateBudgetCategory(key: string, value: string) {
  const num = value === '' ? undefined : Number(value);
  setBudgetCategories(prev => ({ ...prev, [key]: num }));
}
```

- [ ] **Step 3: Replace budget JSX in explore branch**

Replace the current budget section (3 preset pills) with:

```tsx
{/* Budget */}
<div className="space-y-3">
  <div className="flex items-center gap-3 flex-wrap">
    <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider shrink-0">{t("budgetLabel")}</span>
    {BUDGET_VALUES.map(b => (
      <button key={b.value} type="button" onClick={() => selectPresetBudget(b.value)}
        className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
          budgetMode === 'preset' && budget === b.value
            ? 'bg-orange-100 border-orange-400 text-orange-800'
            : 'bg-white border-gray-300 text-gray-600 hover:border-orange-300'
        }`}>
        {b.icon} {t(b.value)}
      </button>
    ))}
    <button type="button" onClick={() => selectCustomBudget('total')}
      className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
        budgetMode !== 'preset'
          ? 'bg-orange-100 border-orange-400 text-orange-800'
          : 'border-dashed border-gray-400 text-gray-500 hover:border-orange-400 hover:text-orange-600'
      }`}>
      + {t("addYourOwnBudget")}
    </button>
  </div>

  {/* Custom budget panel */}
  {budgetMode !== 'preset' && (
    <div className="space-y-3 p-4 bg-orange-50 rounded-xl border border-orange-200">
      {/* Scope pills */}
      <div className="flex gap-2">
        {(['total', 'per_day', 'per_person'] as const).map(scope => (
          <button key={scope} type="button" onClick={() => selectCustomBudget(scope)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              budgetMode === scope
                ? 'bg-orange-600 text-white border-orange-600'
                : 'bg-white border-gray-300 text-gray-600 hover:border-orange-300'
            }`}>
            {t(`budgetScope_${scope}`)}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-gray-500">$</span>
        <input type="number" min="1" value={budgetAmount ?? ''} onChange={e => setBudgetAmount(e.target.value ? Number(e.target.value) : null)}
          placeholder={t("budgetAmountPlaceholder")}
          className="flex-1 px-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
      </div>

      {/* Fine-tune toggle */}
      <button type="button" onClick={() => setShowFineTune(!showFineTune)}
        className="text-xs text-orange-600 hover:text-orange-800 font-medium transition-colors">
        {showFineTune ? '▾' : '▸'} {t("fineTuneCategories")}
      </button>

      {/* Fine-tune categories */}
      {showFineTune && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {/* Always visible */}
          {[
            { key: 'flights', label: t("catFlights") },
            { key: 'activities', label: t("catActivities") },
            { key: 'food', label: t("catFood") },
          ].map(cat => (
            <div key={cat.key}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{cat.label}</label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">$</span>
                <input type="number" min="0" value={budgetCategories[cat.key] ?? ''}
                  onChange={e => updateBudgetCategory(cat.key, e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
              </div>
            </div>
          ))}
          {/* Contextual */}
          {wantHotel && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("catAccommodation")}</label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">$</span>
                <input type="number" min="0" value={budgetCategories.accommodation ?? ''}
                  onChange={e => updateBudgetCategory('accommodation', e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
              </div>
            </div>
          )}
          {(wantCar || wantLimo) && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("catTransport")}</label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">$</span>
                <input type="number" min="0" value={budgetCategories.transport ?? ''}
                  onChange={e => updateBudgetCategory('transport', e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
              </div>
            </div>
          )}
          {interests.includes('cruise') && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("catCruise")}</label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">$</span>
                <input type="number" min="0" value={budgetCategories.cruise ?? ''}
                  onChange={e => updateBudgetCategory('cruise', e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )}
</div>
```

- [ ] **Step 4: Wire custom budget into submit + context**

In `handleSubmit`, add these fields to the POST body (after `want_limo`):

```typescript
budget_mode: budgetMode,
budget_amount: budgetMode !== 'preset' ? budgetAmount : null,
budget_categories: budgetMode !== 'preset' && showFineTune
  ? Object.fromEntries(Object.entries(budgetCategories).filter(([_, v]) => v != null))
  : null,
```

Add custom budget validation before the fetch:

```typescript
if (budgetMode !== 'preset' && (!budgetAmount || budgetAmount <= 0)) {
  setError(t("budgetAmountRequired"));
  return;
}
```

In `__atlasFormContext`, add after `budget`:

```typescript
budgetMode,
budgetAmount: budgetMode !== 'preset' ? budgetAmount : null,
budgetCategories: budgetMode !== 'preset' ? budgetCategories : null,
```

Add `budgetMode, budgetAmount, budgetCategories, showFineTune` to the effect deps.

- [ ] **Step 5: Reset budget in selectMode**

In `selectMode('flight')`, add:

```typescript
setBudgetMode('preset');
setBudgetAmount(null);
setBudgetCategories({});
setShowFineTune(false);
```

- [ ] **Step 6: Verify custom budget panel renders and toggles**

Open Path B, confirm 3 presets + "Add Your Own". Click "Add Your Own" — scope pills, dollar input, fine-tune toggle appear. Toggle fine-tune — category inputs appear. Check hotel on → Accommodation shows. Select cruise interest → Cruise shows.

- [ ] **Step 7: Commit**

```bash
git add src/components/TripForm.tsx
git commit -m "feat(tripform): add hybrid custom budget with fine-tune categories"
```

---

### Task 3: Auto-slide Carousel

**Files:**
- Modify: `src/components/PackageDealsCarousel.tsx`

- [ ] **Step 1: Rewrite carousel with auto-slide, arrows, and dots**

Replace the entire file content with:

```tsx
"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { DEALS, getAffiliateUrl, type AffiliateDeal } from "@/config/affiliates";
import { useTranslations } from "next-intl";

const CRUISE_DEAL_IDS = ["cruisedirect-caribbean", "cruisedirect-bahamas"];
const SLIDE_INTERVAL = 5000;
const TRANSITION_MS = 500;

interface Props {
  origin?: string;
  interests: string[];
  budget: string;
}

function scoreDeal(deal: AffiliateDeal, interests: string[], budget: string): number {
  let score = 0;
  if (interests.includes("cruise") && deal.program === "cruises") score += 10;
  if (budget === "budget" && deal.program === "cars") score += 3;
  if (budget === "luxury" && (deal.program === "hotels" || deal.program === "vrbo")) score += 3;
  if (interests.includes("beach") && deal.id.includes("miami")) score += 2;
  if (interests.includes("beach") && deal.id.includes("cancun")) score += 2;
  if (interests.includes("city") && deal.id.includes("nyc")) score += 2;
  if (interests.includes("romance") && deal.program === "cruises") score += 2;
  if (interests.includes("family") && deal.program === "cruises") score += 1;
  if (CRUISE_DEAL_IDS.includes(deal.id)) score += 1;
  return score;
}

const programColors: Record<string, string> = {
  hotels: "bg-red-50 text-red-700 border-red-200",
  vrbo: "bg-blue-50 text-blue-700 border-blue-200",
  cruises: "bg-teal-50 text-teal-700 border-teal-200",
  cars: "bg-amber-50 text-amber-700 border-amber-200",
};

const programLabels: Record<string, string> = {
  hotels: "Hotels.com",
  vrbo: "Vrbo",
  cruises: "CruiseDirect",
  cars: "EconomyBookings",
};

export default function PackageDealsCarousel({ origin, interests, budget }: Props) {
  const t = useTranslations("tripForm");
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sortedDeals = [...DEALS]
    .map(deal => ({ deal, score: scoreDeal(deal, interests, budget) }))
    .sort((a, b) => b.score - a.score)
    .map(d => d.deal);

  const count = sortedDeals.length;

  const goTo = useCallback((idx: number) => {
    setActiveIndex(((idx % count) + count) % count);
  }, [count]);

  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const prev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  // Auto-advance
  useEffect(() => {
    if (paused || count <= 1) return;
    intervalRef.current = setInterval(next, SLIDE_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [paused, next, count]);

  const deal = sortedDeals[activeIndex];
  if (!deal) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{t("packageDeals")}</h3>

      {/* Carousel */}
      <div className="relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}>

        {/* Arrow left */}
        <button type="button" onClick={prev}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/80 hover:bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:text-gray-900 shadow-sm transition-colors">
          ←
        </button>

        {/* Card */}
        <a href={getAffiliateUrl(deal)}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="block mx-10 rounded-xl border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all p-5 bg-white"
          style={{ transition: `opacity ${TRANSITION_MS}ms ease-in-out` }}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${programColors[deal.program] || ''}`}>
              {programLabels[deal.program]}
            </span>
            <span className="text-xs text-green-600 font-medium">{deal.savings}</span>
          </div>
          <h4 className="text-base font-semibold text-gray-900 leading-tight mb-1">{deal.title}</h4>
          <p className="text-sm text-gray-500 mb-3">{deal.subtitle}</p>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold text-orange-600">{deal.price}</span>
            <span className="text-sm font-medium text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg">
              {deal.cta} →
            </span>
          </div>
        </a>

        {/* Arrow right */}
        <button type="button" onClick={next}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/80 hover:bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:text-gray-900 shadow-sm transition-colors">
          →
        </button>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 pt-1">
        {sortedDeals.map((_, i) => (
          <button key={i} type="button" onClick={() => goTo(i)}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === activeIndex ? 'bg-orange-500' : 'bg-gray-300 hover:bg-gray-400'
            }`} />
        ))}
      </div>

      <p className="text-xs text-gray-400">{t("packageDealsDesc")}</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify carousel auto-advances, arrows work, dots navigate, pauses on hover**

- [ ] **Step 3: Commit**

```bash
git add src/components/PackageDealsCarousel.tsx
git commit -m "feat(carousel): replace scroll with auto-slide, arrows, dots, pause on hover"
```

---

### Task 4: Custom Date Inputs

**Files:**
- Modify: `src/components/TripForm.tsx`

- [ ] **Step 1: Add custom date state**

After `tripLength` state (~line 82):

```typescript
const [customWindowValue, setCustomWindowValue] = useState(1);
const [customWindowUnit, setCustomWindowUnit] = useState<'days' | 'weeks' | 'months'>('months');
const [customLengthValue, setCustomLengthValue] = useState(7);
const [customLengthUnit, setCustomLengthUnit] = useState<'days' | 'weeks' | 'months'>('days');
```

- [ ] **Step 2: Update explore branch date section**

Replace the "When are you thinking?" dropdown in the explore branch with:

```tsx
<div>
  <label className="block text-xs font-medium text-gray-500 mb-1">{t("whenAreYouThinking")}</label>
  {flexibleWindow !== 'custom' ? (
    <select value={flexibleWindow} onChange={e => setFlexibleWindow(e.target.value)}
      className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm">
      <option value="next_2_weeks">{t("next2Weeks")}</option>
      <option value="next_month">{t("nextMonth")}</option>
      <option value="2_3_months">{t("in2To3Months")}</option>
      <option value="6_months">{t("in6Months")}</option>
      <option value="this_year">{t("anytimeThisYear")}</option>
      <option value="custom">{t("customDateOption")}</option>
    </select>
  ) : (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600 shrink-0">{t("customDateIn")}</span>
      <input type="number" min="1" max="365" value={customWindowValue}
        onChange={e => setCustomWindowValue(Number(e.target.value))}
        className="w-16 px-2 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm text-center" />
      <select value={customWindowUnit} onChange={e => setCustomWindowUnit(e.target.value as 'days' | 'weeks' | 'months')}
        className="px-2 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm">
        <option value="days">{t("customDateDays")}</option>
        <option value="weeks">{t("customDateWeeks")}</option>
        <option value="months">{t("customDateMonths")}</option>
      </select>
      <button type="button" onClick={() => setFlexibleWindow('next_month')}
        className="text-xs text-gray-500 hover:text-orange-600 shrink-0">✕</button>
    </div>
  )}
</div>
```

Replace the "How long?" dropdown similarly:

```tsx
<div>
  <label className="block text-xs font-medium text-gray-500 mb-1">{t("howLong")}</label>
  {tripLength !== 'custom' ? (
    <select value={tripLength} onChange={e => setTripLength(e.target.value)}
      className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm">
      <option value="weekend">{t("weekend")}</option>
      <option value="week">{t("aboutAWeek")}</option>
      <option value="10_14_days">{t("10To14Days")}</option>
      <option value="2_plus_weeks">{t("2PlusWeeks")}</option>
      <option value="custom">{t("customDateOption")}</option>
    </select>
  ) : (
    <div className="flex items-center gap-2">
      <input type="number" min="1" max="365" value={customLengthValue}
        onChange={e => setCustomLengthValue(Number(e.target.value))}
        className="w-16 px-2 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm text-center" />
      <select value={customLengthUnit} onChange={e => setCustomLengthUnit(e.target.value as 'days' | 'weeks' | 'months')}
        className="px-2 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm">
        <option value="days">{t("customDateDays")}</option>
        <option value="weeks">{t("customDateWeeks")}</option>
        <option value="months">{t("customDateMonths")}</option>
      </select>
      <button type="button" onClick={() => setTripLength('week')}
        className="text-xs text-gray-500 hover:text-orange-600 shrink-0">✕</button>
    </div>
  )}
</div>
```

- [ ] **Step 3: Wire custom dates into submit**

In `handleSubmit`, update the `flexible_window` and `trip_length` fields:

```typescript
flexible_window: flexibleDates
  ? (atlasDecidesDates ? "any" : (flexibleWindow === 'custom' ? `custom:${customWindowValue}:${customWindowUnit}` : flexibleWindow))
  : null,
trip_length: flexibleDates
  ? (atlasDecidesDates ? "any" : (tripLength === 'custom' ? `custom:${customLengthValue}:${customLengthUnit}` : tripLength))
  : null,
```

Update `__atlasFormContext` similarly.

- [ ] **Step 4: Also add "Custom" option to the flight branch date dropdowns**

Add `<option value="custom">{t("customDateOption")}</option>` and the same inline input pattern to the flexible date selects in the flight branch (~lines 516-535).

- [ ] **Step 5: Verify custom date inputs in both paths**

- [ ] **Step 6: Commit**

```bash
git add src/components/TripForm.tsx
git commit -m "feat(tripform): add custom date inputs with days/weeks/months"
```

---

### Task 5: Daily Activities Service Pill + DB + API

**Files:**
- Modify: `src/components/TripForm.tsx`
- Modify: `src/app/api/trips/route.ts`
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Add wantActivities state**

After `wantLimo` state (~line 87):

```typescript
const [wantActivities, setWantActivities] = useState(false);
```

- [ ] **Step 2: Default ON for explore mode**

In `selectMode`, explore branch:

```typescript
setWantActivities(true);
```

Flight branch:

```typescript
setWantActivities(false);
```

- [ ] **Step 3: Add pill to servicePills**

After the Limo pill in the `servicePills` variable, add:

```tsx
<button type="button" onClick={() => setWantActivities(!wantActivities)}
  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
    wantActivities ? 'bg-orange-100 border-orange-400 text-orange-800' : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400'
  }`}>
  🎯 {t("dailyActivities")} {wantActivities && '✓'}
</button>
```

- [ ] **Step 4: Wire into submit + context**

In `handleSubmit` POST body, add: `want_activities: wantActivities`

In `__atlasFormContext`, add: `wantActivities`

Add `wantActivities` to effect deps.

- [ ] **Step 5: DB migration**

In `src/lib/db.ts`, add to the `budgetMigrations` array:

```typescript
"ALTER TABLE trips ADD COLUMN want_activities INTEGER NOT NULL DEFAULT 1",
```

- [ ] **Step 6: API route**

In `src/app/api/trips/route.ts`, add to destructuring:

```typescript
want_activities = true,
```

Add to INSERT column list and VALUES, with `want_activities ? 1 : 0`.

- [ ] **Step 7: Commit**

```bash
git add src/components/TripForm.tsx src/app/api/trips/route.ts src/lib/db.ts
git commit -m "feat: add daily activities service pill with DB + API support"
```

---

### Task 6: DB Migrations for Custom Budget

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/app/api/trips/route.ts`

- [ ] **Step 1: Add budget columns to migrations**

In `src/lib/db.ts`, add to the `budgetMigrations` array:

```typescript
"ALTER TABLE trips ADD COLUMN budget_mode TEXT DEFAULT 'preset'",
"ALTER TABLE trips ADD COLUMN budget_amount REAL",
"ALTER TABLE trips ADD COLUMN budget_categories TEXT",
```

- [ ] **Step 2: Update API route**

In `src/app/api/trips/route.ts`, add to destructuring:

```typescript
budget_mode = 'preset',
budget_amount = null,
budget_categories = null,
```

Validate budget_mode:

```typescript
if (!['preset', 'total', 'per_day', 'per_person'].includes(budget_mode)) {
  return NextResponse.json({ error: "Invalid budget_mode" }, { status: 400 });
}
```

Add to INSERT column list: `budget_mode, budget_amount, budget_categories`
Add to VALUES: `budget_mode, budget_amount || null, budget_categories ? JSON.stringify(budget_categories) : null`

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts src/app/api/trips/route.ts
git commit -m "feat: add budget_mode, budget_amount, budget_categories to trips schema + API"
```

---

### Task 7: i18n Keys — All 6 Locales

**Files:**
- Modify: `messages/{en,es,fr,de,it,pt}/common.json`

- [ ] **Step 1: Add English keys**

Add under `tripForm` in `messages/en/common.json`:

```json
"customVibesPlaceholder": "e.g., road trip, rooftop bars, island hopping",
"addYourOwnBudget": "Add Your Own",
"budgetScope_total": "Total Trip",
"budgetScope_per_day": "Per Day",
"budgetScope_per_person": "Per Person",
"budgetAmountPlaceholder": "Enter amount",
"budgetAmountRequired": "Please enter a budget amount.",
"fineTuneCategories": "Fine-tune by category",
"catFlights": "Flights",
"catActivities": "Activities & Tours",
"catFood": "Food & Dining",
"catAccommodation": "Accommodation",
"catTransport": "Ground Transport",
"catCruise": "Cruise",
"customDateOption": "Custom...",
"customDateIn": "In",
"customDateDays": "days",
"customDateWeeks": "weeks",
"customDateMonths": "months",
"dailyActivities": "Daily Activities"
```

- [ ] **Step 2: Add translated keys to es, fr, de, it, pt**

Same 19 keys translated for each locale.

- [ ] **Step 3: Commit**

```bash
git add messages/
git commit -m "feat(i18n): add 19 keys for custom vibes, budget, dates, activities across 6 locales"
```

---

### Task 8: Build Verification + Code Review

- [ ] **Step 1: Kill dev server, wipe .next, run build**

```bash
pkill -f "next dev"; rm -rf .next; npx next build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Restart dev server and test all 5 enhancements**

```bash
rm -rf .next && nohup npm run dev -- --port 3001 > /tmp/tpi-dev.log 2>&1 &
```

Test checklist:
- Path B → custom vibes: add, remove, submit
- Path B → custom budget: preset/custom toggle, scope pills, fine-tune categories
- Path B → carousel: auto-advances at 5s, pauses on hover, arrows work, dots navigate, loops
- Path B → custom dates: "Custom..." option, number + unit input, "x" reverts
- Path B → daily activities pill: default ON, toggleable
- Path A → confirm no regressions (services optional, compact layout, 50/50 row)
- Submit both paths → trip created, redirect to planner

- [ ] **Step 3: Dispatch code reviewer**

- [ ] **Step 4: Fix reviewer issues**

- [ ] **Step 5: Final commit**

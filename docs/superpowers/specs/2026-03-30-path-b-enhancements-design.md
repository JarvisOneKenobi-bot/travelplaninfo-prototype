# Path B ("Surprise Me") Enhancements — Design Spec

**Date:** 2026-03-30
**Scope:** 5 enhancements to the TripForm explore mode (Path B)
**Files affected:** TripForm.tsx, PackageDealsCarousel.tsx, api/trips/route.ts, lib/db.ts, messages/*.json

---

## 1. Custom Vibes

**Problem:** The 7 preset vibes (Tropical, Mountains, Big City, Beach, Winter Escape, Cultural, Adventure) cannot cover every user's vision.

**Solution:** Add "Add your own" button at the end of the vibes row, matching the existing custom interests pattern.

**UX:**
- "+ Add" dashed-border button after the last vibe chip
- Click expands a text input below the vibes row (comma-separated or Enter)
- Custom vibes appear as pink chips with an "x" to remove
- Custom vibes stored as `vibe:custom:<value>` in the interests array (same prefix convention as existing `vibe:<preset>`)

**State:** Reuse existing `customInterests`-style pattern — new `customVibes: string[]` state variable.

**API:** Custom vibes are merged into the `interests` array payload as `vibe:custom:<value>`. No API schema change needed.

---

## 2. Custom Budget (Hybrid)

**Problem:** The 3 preset tiers (Budget / Mid-range / Luxury) are too coarse. Users — especially registered ones — want precise control over their trip spending.

**Solution:** Keep presets as quick-picks. Add "Add Your Own" that expands to a custom budget panel with optional per-category fine-tuning.

### 2a. Default View
- 3 preset pills: Budget / Mid-range / Luxury (existing)
- "+ Add Your Own" button (dashed border, same style as custom interests add button)
- Selecting a preset deselects custom mode. Selecting "Add Your Own" deselects presets. Mutually exclusive.

### 2b. Custom Budget Panel (expanded when "Add Your Own" clicked)
- **Budget scope pills:** Total Trip | Per Day (excl. flights) | Per Person
- **Amount input:** Dollar amount, number input with `$` prefix, required when custom mode active
- **"Fine-tune by category" expandable** (collapsed by default, click to toggle):

### 2c. Fine-tune Categories
Always visible (3):
- Flights
- Activities & Tours
- Food & Dining

Contextual (appear when relevant service/interest selected):
- Accommodation — visible when `wantHotel === true`
- Ground Transport — visible when `wantCar === true || wantLimo === true`
- Cruise — visible when `interests.includes("cruise")`

Each category: label + dollar input (optional). Unallocated budget is distributed by Atlas at planning time.

### 2d. Data Model

New state variables:
```ts
budgetMode: 'preset' | 'total' | 'per_day' | 'per_person'
budgetAmount: number | null
budgetCategories: {
  flights?: number
  activities?: number
  food?: number
  accommodation?: number
  transport?: number
  cruise?: number
} | null
showFineTune: boolean
```

API payload additions (alongside existing `budget` field):
```json
{
  "budget": "midrange",
  "budget_mode": "preset",
  "budget_amount": null,
  "budget_categories": null
}
```
Or for custom:
```json
{
  "budget": null,
  "budget_mode": "per_day",
  "budget_amount": 150,
  "budget_categories": { "flights": 500, "activities": 50, "food": 40 }
}
```

DB migration (lib/db.ts):
```sql
ALTER TABLE trips ADD COLUMN budget_mode TEXT DEFAULT 'preset';
ALTER TABLE trips ADD COLUMN budget_amount REAL;
ALTER TABLE trips ADD COLUMN budget_categories TEXT;
```
`budget_categories` stored as JSON string.

### 2e. Validation
- Custom mode requires `budget_amount > 0`
- Category amounts are optional — omitted means "Atlas decides"
- Sum of categories may exceed total (user sets ceilings per category, not a hard allocation)
- API validates: `budget_mode` must be one of `preset | total | per_day | per_person`

---

## 3. Carousel — Auto-slide with Arrows + Dots

**Problem:** Horizontal scroll carousel is a poor UX — users don't discover it, no visual indication of more content.

**Solution:** Replace with a standard auto-advancing carousel: one card visible at a time, arrows on edges, dots below.

### Behavior
- **Auto-advance:** 5-second interval
- **Pause on hover:** Timer pauses when mouse enters carousel, resumes on leave
- **Infinite loop:** Last card wraps to first, first wraps to last
- **Arrows:** `<` and `>` buttons on left/right edges, semi-transparent bg, darken on hover
- **Dots:** Centered below carousel, filled = active card, hollow = inactive, clickable to jump
- **Transition:** CSS `transform: translateX()` with `transition-duration: 500ms ease-in-out`
- **Touch support:** Swipe left/right on mobile (optional — can defer)

### Layout Change
- Container: fixed height, `overflow: hidden`, `position: relative`
- Cards: full container width, laid out horizontally, translated via `translateX(-${activeIndex * 100}%)`
- Arrows: `position: absolute`, vertically centered, `z-10`
- Dots: flex row centered below the card area

### Component Changes
- Remove `scrollRef`, horizontal scroll CSS, scroll buttons
- Add `activeIndex` state, `useEffect` for auto-advance timer, `useRef` for interval ID
- Add `pause`/`resume` via `onMouseEnter`/`onMouseLeave`

---

## 4. Custom Date Inputs

**Problem:** Preset date windows (Next 2 weeks, Next month, etc.) don't cover users who want specific timeframes like "In 45 days" or "For 18 days."

**Solution:** Add "Custom" as the last option in both dropdowns. Selecting it replaces the dropdown with an inline number + unit input.

### "When are you thinking?" — Custom Mode
- Dropdown adds option: `custom` → "Custom..."
- When selected, dropdown hides and inline input appears: `In [number] [days ▼ / weeks ▼ / months ▼]`
- A small "x" or "Back to presets" link to revert to dropdown
- State: `flexibleWindow` becomes `"custom"`, new state `customWindowValue: number`, `customWindowUnit: 'days' | 'weeks' | 'months'`
- API value: `flexible_window: "custom:14:days"` (parseable string)

### "How long?" — Custom Mode
- Same pattern: dropdown adds "Custom..." option
- Inline input: `[number] [days ▼ / weeks ▼ / months ▼]`
- State: `tripLength` becomes `"custom"`, new state `customLengthValue: number`, `customLengthUnit: 'days' | 'weeks' | 'months'`
- API value: `trip_length: "custom:18:days"`

### Validation
- Number must be > 0
- Days: 1-365, Weeks: 1-52, Months: 1-12

---

## 5. Daily Activities Service Pill

**Problem:** Path B explorers want Atlas to plan daily activities (the core value prop), but there's no explicit signal for this.

**Solution:** Add "Daily Activities" to the service toggle pills. Default ON for Path B explorers.

### UX
- New pill: `🎯 Daily Activities ✓` — appears in the services row alongside Hotel, Car Rental, Limo
- Default: checked (true) for Path B. User can uncheck if they only want travel logistics.

### Data
- New state: `wantActivities: boolean` (default `true` in explore mode, `false` in flight mode)
- API payload: `want_activities: boolean`
- DB migration: `ALTER TABLE trips ADD COLUMN want_activities INTEGER NOT NULL DEFAULT 1`
- API validation: boolean conversion same as other `want_*` fields

---

## i18n Keys Required (all 6 locales)

```
customVibesPlaceholder, addYourOwnBudget, budgetScopeTotal, budgetScopePerDay,
budgetScopePerPerson, budgetAmountPlaceholder, fineTuneCategories,
catFlights, catActivities, catFood, catAccommodation, catTransport, catCruise,
customDateIn, customDateFor, customDateDays, customDateWeeks, customDateMonths,
backToPresets, dailyActivities
```

~20 new keys across 6 locales = 120 translations.

---

## What This Spec Does NOT Cover
- Registered user budget bracket ranges (deferred — requires user preferences API extension)
- Touch/swipe for carousel (can add later)
- Atlas-side budget parsing logic (Atlas reads the trip context; this spec covers form + API + DB only)

# Itinerary Landing Page Redesign — A+C Hybrid

**Date:** 2026-04-02
**Status:** Approved (visual companion session)
**Scope:** V1 template → API wiring → Live data integration

---

## Problem

The current itinerary page (`/planner/[tripId]`) has critical UX failures:

1. **Generic placeholder items** — ItineraryBuilder auto-creates "Flight to Surprise Me", "Hotel in Surprise Me" as DB records on first load. Feels broken, not helpful.
2. **No trip context visibility** — User's origin, vibes, interests, budget tier aren't displayed. No confirmation that Atlas "heard" the intake form.
3. **Atlas is passive** — Recommendations only appear when user manually opens chat. The "Surprise Me" promise is broken — Atlas should lead, not wait.
4. **Budget doesn't carry over** — Mid-Range shows in header text but doesn't influence items or recommendations.
5. **Day planner is confusing** — Editable text inputs, "Mark booked" toggles, Budget/Mid/Luxury tier buttons feel like an admin tool.
6. **Origin ignored** — Atlas uses IP geolocation instead of the origin airport from the intake form.

## Approved Design: Atlas-First Hybrid (A+C)

### Layout (top to bottom)

**1. Context Strip** — Horizontal tag pills confirming what Atlas knows:
- Origin pill: `✈️ LGA (+ JFK, EWR)` (with nearby airports)
- Budget pill: `💰 Mid-Range`
- Vibe pills: `🌴 Tropical`, `🌊 Beach` (pink background)
- Interest pills: `🏖️ Beaches`, `🚢 Cruises` (orange background)
- Travelers pill: `👥 2 adults`
- Editable: clicking a pill opens inline edit (future enhancement, not V1)

**2. Atlas Hero Section** — The main event. Bordered card with Atlas branding:
- Header: "Atlas found 3 matches for you!" + subtitle summarizing vibes/origin/budget
- **3 destination cards** side by side:
  - Card 1: ⭐ TOP PICK badge, destination name, airline + price, hotel from price, "Tell Me More →" CTA
  - Card 2-3: Same layout, no TOP PICK badge
- Footer links: "🔄 Show me different options" | "💬 Chat with Atlas"
- V1: Cards use hardcoded representative data, clearly structured for API replacement
- Post-API: Cards populated by real Aviasales flight search + Hotels.com pricing

**3. Day Planner** (initially dimmed):
- Before destination selection: Dimmed placeholder — "Pick a destination above and your itinerary will appear here"
- After "Tell Me More →" click: Atlas chat opens with destination context, day planner activates
- After user confirms destination: Day planner populates with destination-specific items (flights, hotels, activities)
- Remove the current auto-populate of generic items entirely

**4. Affiliate Sidebar** — Stays, but recommendations update to match the selected destination (not "Surprise Me")

### Branching: Path A vs Path B

**Path A trips** (`trip.destination !== "Surprise Me"`):
- Skip Atlas Hero Section entirely
- Context strip still shows (origin, budget, travelers)
- Day planner is immediately active with existing items
- Affiliate sidebar shows recommendations for the actual destination

**Path B / Surprise Me trips** (`trip.destination === "Surprise Me"`):
- Full A+C hybrid flow below

### Interaction Flow (Surprise Me only)

```
Page loads → Context strip renders from trip DB data
           → Atlas hero shows 3 destination cards
           → Day planner is dimmed/placeholder

User clicks "Tell Me More →" on a card
           → Atlas chat opens with destination pitch
           → Day planner activates (still empty)
           → Affiliate sidebar updates to match destination

User confirms (via Atlas chat or explicit "Plan This Trip" button)
           → Trip destination updates in DB
           → Day planner populates with real items
           → Full itinerary editing enabled
```

### Data Notes

- **Vibes**: No separate DB column. Stored inside `interests` JSON array with `vibe:` prefix (e.g., `vibe:tropical`, `vibe:beach`). Context strip parses these out.
- **nearby_airports**: Stored as JSON string in DB. Server component pre-parses before passing to client components.
- **Interest labels**: Must use `t()` translation function, not hardcoded English map.
- **Inline pill editing**: Explicitly out of scope for V1. Component accepts no edit callbacks.

### What Gets Removed

- `autoPopulate()` function in ItineraryBuilder — no more "Flight to Surprise Me" items
- Generic placeholder item creation on first page load
- `is_placeholder` flag usage (dead code)

### What Gets Added (V1 Template)

- `TripContextStrip` component — reads trip data, renders tag pills
- `AtlasHeroSection` component — 3 destination cards with CTAs
- `DestinationCard` sub-component — reusable card with destination/price/CTA
- Conditional rendering in ItineraryBuilder: dimmed state vs active state based on destination selection
- Trip DB update when destination is confirmed (changes "Surprise Me" → actual destination)

### Sequential Implementation Plan

**Phase 1 (This session): V1 Template**
- Build the layout components with hardcoded data
- Remove auto-populate logic
- Wire context strip to real trip data
- Destination cards use representative data

**Phase 2 (Next sprint): API Wiring**
- Aviasales/Travelpayouts flight search API integration
- Hotels.com or similar hotel pricing API
- EconomyBookings car rental API
- Atlas tools updated to call real APIs instead of mocks

**Phase 3: Live Data Integration**
- Destination cards populated by real API responses
- "Tell Me More" triggers real Atlas tool calls with live pricing
- Day planner items created from real search results

---

## Files Affected

- `src/app/[locale]/planner/[tripId]/page.tsx` — new layout structure
- `src/components/ItineraryBuilder.tsx` — remove autoPopulate, add dimmed state
- `src/components/TripContextStrip.tsx` — NEW: tag pills component
- `src/components/AtlasHeroSection.tsx` — NEW: destination cards hero
- `src/components/DestinationCard.tsx` — NEW: individual destination card
- `src/components/AssistantChat.tsx` — auto-open with destination context on card click
- Translation files (6 locales) — new keys for context strip, hero section, CTAs

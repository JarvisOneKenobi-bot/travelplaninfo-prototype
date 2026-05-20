# TravelPlanInfo Prototype — Rebuild Spec

Rebuild this Next.js prototype to exactly match the approved design screenshot at:
`/home/jarvis/.openclaw/workspace/content-pipeline/travelplaninfo/images/vercel-approved.png`

Note: `vercel-approved.png` is a historical filename from the original prototype review flow. It is an image asset name only and should not be interpreted as current deployment guidance.

## Stack
- Next.js 15.5.12 (already installed, keep it)
- Tailwind CSS (install + configure)
- shadcn/ui (install via `npx shadcn@latest init --yes --base-color neutral`)
- Font: Inter via `next/font/google`
- NO custom CSS classes — use Tailwind utility classes only

## Design Spec (from screenshot analysis)

### Nav Bar
- Sticky, white bg, subtle bottom border
- Left: Logo — "TravelPlan" (dark #111827, bold) + "Info" (orange #D97706, bold), font-size ~20px
- Center: Home | Destinations | 🔥 Hot Deals (orange text) | Planner | Guides
- Right: Three circular pill buttons A | B | C (border, white bg) — design switcher via ?design= query param
- Height: h-16

### Hero Section
- Background: warm cream `bg-orange-50` or `bg-amber-50`
- Border-radius: rounded-3xl
- Padding: px-12 py-16
- Badge: "Travel Deals & Guides" — orange bg (`bg-orange-500`), white text, rounded-md, text-xs
- H1 line 1: "Plan your next trip," — dark `text-gray-900`, text-5xl font-bold
- H1 line 2: "one adventure at a time." — orange `text-amber-600`, text-5xl font-bold
- Subtitle: "Expert itineraries, hidden gems, and deals for every kind of traveler." — text-gray-500, text-lg
- Category chips (pill badges, white bg, border, rounded-full):
  🏖️ Beach | 🏙️ City Break | 🌲 Nature | 👨‍👩‍👧‍👦 Family | 🧗 Adventure | 🚢 Cruise | 🎒 Backpacking | 🚗 Road Trip
- CTA buttons row:
  - "Explore Destinations" — white bg, dark border, dark text, rounded-lg
  - "Start Planning" — dark bg (#111827), white text, rounded-lg

### Stats Row (3 cards)
- 3-column grid, gap-6
- Card bg: `bg-orange-50`, rounded-2xl, p-8, text-center
- Card 1: 🗓️ | **2** (text-3xl font-bold text-amber-600) | "Active Trips" (text-sm text-gray-500)
- Card 2: ⭐ | **8** | "Saved Destinations"
- Card 3: 📝 | **3** | "Draft Itineraries"

### Featured Destinations Section
- Section header: "Featured Destinations" (text-2xl font-bold) + "View all →" link (text-orange-600) on right
- 3 destination cards below (can be placeholder cards with gradient bg + destination name)

### Design B (?design=B)
- Same nav + hero
- Replace below-hero content with:
  - "Quick Bookables" grid — items with title, note, price pill (e.g. "FLL→Miami Beach Shuttle $39")
  - "Deal Alert" dark card (bg dark blue/charcoal, email input + "Notify me" button, "41,200 travelers" social proof)

### Design C (?design=C)
- Same nav + hero
- Replace below-hero content with:
  - "Plan Your Trip" tool card: destination input + date range + travelers selector + "Plan My Trip" button
  - 3 Itinerary cards below (e.g. "3 Days in Miami", "5 Days Caribbean Cruise", etc.)

## Implementation
1. `src/app/page.tsx` — server component, reads searchParams.design (A/B/C, default A)
2. `src/components/Header.tsx` — nav with A/B/C toggle
3. `src/components/DesignA.tsx`
4. `src/components/DesignB.tsx`  
5. `src/components/DesignC.tsx`
6. Keep existing `next.config.ts` and `tsconfig.json`

## After building
1. `npm run build` — must pass
2. `git add -A && git commit -m "rebuild: TPI 3-design prototype (A/B/C) matching approved screenshot"`
3. `openclaw system event --text "Done: TPI rebuilt, 3 designs A/B/C, build passing" --mode now`

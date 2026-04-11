# is_mock Cleanup — Retrospective Spec

**Date:** 2026-04-10
**Status:** Approved — ready for implementation
**Scope:** 2 files, dead-field removal only

---

## Background

Two changes shipped to git without the 7-step pipeline:

1. **TripForm restore** (`d6d74a0`) — restored section/gray-green-border design, dropped EntryTabs from planner page
2. **Live API wiring** (`bd2ede0`) — added TRAVELPAYOUTS_TOKEN to .env.local, removed `is_mock` scaffolding from frontend cards, types.ts, backend tp_client.py and routers/assistant.py

This spec documents the retrospective review of change #2 and the gap it left: incomplete `is_mock` removal that causes a TypeScript compile error.

---

## Problem

The `is_mock` field was removed from all 4 interfaces in `types.ts` (`FlightResult`, `HotelResult`, `ActivityResult`, `RestaurantResult`). However:

**AssistantChat.tsx** (frontend) still assigns `is_mock` in 4 object literals when parsing tool results:
- Line 188: `is_mock: f.is_mock === true` → pushed into `flights: FlightResult[]`
- Line 206: `is_mock: h.is_mock === true` → pushed into `hotels: HotelResult[]`
- Line 221: `is_mock: a.is_mock === true` → pushed into `activities: ActivityResult[]`
- Line 236: `is_mock: r.is_mock === true` → pushed into `restaurants: RestaurantResult[]`

TypeScript rejects these as "Object literal may only specify known properties" — **the build currently fails.**

**tp_client.py** (backend) still includes `"is_mock": False` in 3 returned dicts and has 3 stale docstrings referencing the flag:
- Line 94 (docstring): "Returns list of flight dicts with is_mock flag"
- Line 122 (dict field): `"is_mock": False` in real flight result
- Line 143 (docstring): "All results have is_mock=False"
- Line 165 (dict field): `hotel["is_mock"] = False` in LLM hotel loop
- Line 178 (dict field): `"is_mock": False` in hotel fallback
- Line 190 (docstring): "Returns list of deal dicts with is_mock flag"

---

## Approach

**Full cleanup (Approach A):** Remove all `is_mock` references from both files. No behavior changes — this is dead-field removal.

Alternatives considered:
- **Frontend-only fix:** Build passes but backend continues sending unused fields. Rejected — inconsistent.
- **Restore is_mock:** Regresses the intent of `bd2ede0`. Rejected.

---

## Changes

### AssistantChat.tsx
Remove the `is_mock` property from 4 push calls in the tool-result parsing block. No other changes.

### tp_client.py
1. Remove `"is_mock": False` from 3 dicts (lines 122, 165, 178)
2. Rewrite 3 docstrings to remove `is_mock` flag references (lines 94, 143, 190)

---

## Verification Gate

`npm run build` in the TPI repo must pass with zero TypeScript errors. This is the sole evidence of success.

---

## Out of Scope

- TripForm restore (change #1) — no gaps identified; section/sectionBorder design renders correctly
- Any other mock data patterns not in these 2 files
- New features or behavior changes

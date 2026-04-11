# is_mock Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all remaining `is_mock` dead-field references from AssistantChat.tsx and tp_client.py so the build passes clean.

**Architecture:** Pure dead-field removal across 2 files. No logic changes. `is_mock` was removed from all 4 interfaces in `types.ts` but 4 object literals in AssistantChat.tsx still assign it (TypeScript error), and tp_client.py still returns it in 3 dicts with 3 stale docstrings.

**Tech Stack:** Next.js 15 / TypeScript, Python (FastAPI), npm build

---

## Files

| File | Change |
|------|--------|
| `src/components/AssistantChat.tsx` | Remove 4 `is_mock` property assignments (lines 188, 206, 221, 236) |
| `../command-post/tp_client.py` | Remove 3 `"is_mock": False` dict fields (lines 122, 165, 178) + rewrite 3 docstrings (lines 94, 143, 190) |

Paths relative to `travelplaninfo-prototype/`.

---

## Task 1: Fix AssistantChat.tsx — remove 4 is_mock assignments

**Files:**
- Modify: `src/components/AssistantChat.tsx`

- [ ] **Step 1: Remove is_mock from flights push (line 188)**

  In `AssistantChat.tsx`, find this block (around line 185–189):
  ```tsx
          depart_date: f.depart_date ? String(f.depart_date) : undefined,
          return_date: f.return_date ? String(f.return_date) : undefined,
          book_url: String(f.book_url || ""),
          is_mock: f.is_mock === true,
        });
  ```
  Change to:
  ```tsx
          depart_date: f.depart_date ? String(f.depart_date) : undefined,
          return_date: f.return_date ? String(f.return_date) : undefined,
          book_url: String(f.book_url || ""),
        });
  ```

- [ ] **Step 2: Remove is_mock from hotels push (line 206)**

  Find this block (around line 203–207):
  ```tsx
          neighborhood: h.neighborhood ? String(h.neighborhood) : undefined,
          highlights: Array.isArray(h.highlights) ? (h.highlights as unknown[]).map(String) : undefined,
          is_mock: h.is_mock === true,
        });
  ```
  Change to:
  ```tsx
          neighborhood: h.neighborhood ? String(h.neighborhood) : undefined,
          highlights: Array.isArray(h.highlights) ? (h.highlights as unknown[]).map(String) : undefined,
        });
  ```

- [ ] **Step 3: Remove is_mock from activities push (line 221)**

  Find this block (around line 219–222):
  ```tsx
          duration: a.duration ? String(a.duration) : undefined,
          is_mock: a.is_mock === true,
        });
  ```
  Change to:
  ```tsx
          duration: a.duration ? String(a.duration) : undefined,
        });
  ```

- [ ] **Step 4: Remove is_mock from restaurants push (line 236)**

  Find this block (around line 234–237):
  ```tsx
          budget_tier: (["budget", "mid", "luxury"].includes(String(r.budget_tier)) ? String(r.budget_tier) : "mid") as BudgetTier,
          is_mock: r.is_mock === true,
        });
  ```
  Change to:
  ```tsx
          budget_tier: (["budget", "mid", "luxury"].includes(String(r.budget_tier)) ? String(r.budget_tier) : "mid") as BudgetTier,
        });
  ```

- [ ] **Step 5: Verify TypeScript accepts the file**

  Run from `travelplaninfo-prototype/`:
  ```bash
  npx tsc --noEmit 2>&1 | grep AssistantChat
  ```
  Expected: no output (no errors in AssistantChat.tsx)

---

## Task 2: Fix tp_client.py — remove is_mock fields and stale docstrings

**Files:**
- Modify: `../command-post/tp_client.py`

- [ ] **Step 1: Fix search_flights docstring (line 94)**

  Find:
  ```python
        """Search cheapest flights via Aviasales v3 prices_for_dates.

        Returns list of flight dicts with is_mock flag.
        """
  ```
  Change to:
  ```python
        """Search cheapest flights via Aviasales v3 prices_for_dates.

        Returns list of flight dicts. On API failure: returns empty list.
        """
  ```

- [ ] **Step 2: Remove is_mock from flight dict (line 122)**

  Find:
  ```python
              flights.append({
                  "price": item.get("price"),
                  "airline": item.get("airline"),
                  "flight_number": item.get("flight_number", ""),
                  "departure_at": item.get("departure_at", depart_date),
                  "return_at": item.get("return_at", return_date),
                  "transfers": item.get("transfers", 0),
                  "link": link,
                  "is_mock": False,
              })
  ```
  Change to:
  ```python
              flights.append({
                  "price": item.get("price"),
                  "airline": item.get("airline"),
                  "flight_number": item.get("flight_number", ""),
                  "departure_at": item.get("departure_at", depart_date),
                  "return_at": item.get("return_at", return_date),
                  "transfers": item.get("transfers", 0),
                  "link": link,
              })
  ```

- [ ] **Step 3: Fix search_hotels docstring (line 143)**

  Find:
  ```python
        """Generate hotel suggestions via LLM with CJ Hotels.com affiliate links.

        NO Hotellook API call — uses Anthropic + CJ links as designed.
        Returns (list of hotel dicts, cost dict).
        All results have is_mock=False (LLM generation is intended behavior).
        """
  ```
  Change to:
  ```python
        """Generate hotel suggestions via LLM with CJ Hotels.com affiliate links.

        NO Hotellook API call — uses Anthropic + CJ links as designed.
        Returns (list of hotel dicts, cost dict).
        On LLM failure: returns minimal fallback with affiliate link.
        """
  ```

- [ ] **Step 4: Remove is_mock from hotel LLM loop (line 165)**

  Find:
  ```python
          if hotels and isinstance(hotels, list):
              for hotel in hotels:
                  hotel["affiliate_url"] = affiliate_url
                  hotel["is_mock"] = False
              return hotels, cost
  ```
  Change to:
  ```python
          if hotels and isinstance(hotels, list):
              for hotel in hotels:
                  hotel["affiliate_url"] = affiliate_url
              return hotels, cost
  ```

- [ ] **Step 5: Remove is_mock from hotel fallback dict (line 178)**

  Find:
  ```python
          fallback = [
              {
                  "name": f"Hotels in {city}",
                  "stars": 4,
                  "price_range": "varies",
                  "neighborhood": city,
                  "highlights": ["Browse all options"],
                  "affiliate_url": affiliate_url,
                  "is_mock": False,
              }
          ]
  ```
  Change to:
  ```python
          fallback = [
              {
                  "name": f"Hotels in {city}",
                  "stars": 4,
                  "price_range": "varies",
                  "neighborhood": city,
                  "highlights": ["Browse all options"],
                  "affiliate_url": affiliate_url,
              }
          ]
  ```

- [ ] **Step 6: Fix get_deals docstring (line 190)**

  Find:
  ```python
        """Find cheapest flights in next 30 days.

        Returns list of deal dicts with is_mock flag.
        """
  ```
  Change to:
  ```python
        """Find cheapest flights in next 30 days.

        Returns list of deal dicts. On API failure: returns empty list.
        """
  ```

---

## Task 3: Verify build passes + commit

**Files:** none created; verifying changes from Tasks 1–2

- [ ] **Step 1: Confirm no remaining is_mock references in frontend**

  Run from `travelplaninfo-prototype/`:
  ```bash
  grep -rn "is_mock" src/
  ```
  Expected: no output

- [ ] **Step 2: Confirm no remaining is_mock references in tp_client.py**

  Run from `command-post/`:
  ```bash
  grep -n "is_mock" tp_client.py
  ```
  Expected: no output

- [ ] **Step 3: Run full TypeScript build**

  Run from `travelplaninfo-prototype/`:
  ```bash
  npm run build 2>&1 | tail -20
  ```
  Expected: `✓ Compiled successfully` with no TypeScript errors. Build may show route sizes — that's fine.

- [ ] **Step 4: Commit both files**

  Run from `travelplaninfo-prototype/`:
  ```bash
  cd ..
  git add travelplaninfo-prototype/src/components/AssistantChat.tsx command-post/tp_client.py
  git commit -m "fix: remove remaining is_mock dead fields from AssistantChat and tp_client

  Types.ts interfaces no longer carry is_mock — AssistantChat push calls were
  TypeScript errors. tp_client.py dict fields and stale docstrings cleaned up.

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  ```
  Expected: commit created, `main` branch advanced.

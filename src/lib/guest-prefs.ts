import { parseIata } from "@/lib/iata";

export const GUEST_PREFS_LS_KEY = "tpi_guest_prefs";
export const GUEST_INTERESTS = ["beach", "mountains", "food", "culture"] as const;
export type GuestInterest = (typeof GUEST_INTERESTS)[number];

export interface GuestPrefs {
  homeAirport: string;
  interests: GuestInterest[];
}

/** Filter untrusted input to the allowlist, deduped, capped at 4. */
export function sanitizeGuestInterests(raw: unknown): GuestInterest[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(GUEST_INTERESTS);
  const seen = new Set<GuestInterest>();
  for (const v of raw) {
    if (typeof v === "string" && allowed.has(v)) seen.add(v as GuestInterest);
    if (seen.size >= 4) break;
  }
  return Array.from(seen);
}

/** Strict parse: requires a valid IATA airport AND ≥1 allowlisted interest. */
export function parseGuestPrefs(raw: unknown): GuestPrefs | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const airport = typeof obj.homeAirport === "string" ? parseIata(obj.homeAirport) : null;
  const interests = sanitizeGuestInterests(obj.interests);
  if (!airport || interests.length === 0) return null;
  return { homeAirport: airport, interests };
}

export function readGuestPrefs(): GuestPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GUEST_PREFS_LS_KEY);
    if (!raw) return null;
    return parseGuestPrefs(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeGuestPrefs(p: GuestPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GUEST_PREFS_LS_KEY, JSON.stringify(p));
  } catch {
    /* storage full / disabled — non-fatal */
  }
}

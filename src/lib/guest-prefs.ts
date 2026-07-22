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

export interface OnboardingCompleteDetail {
  homeAirport?: string;
  interests?: string[];
  budget?: string;
  aiAssisted?: boolean;
}

export function dispatchOnboardingComplete(detail: OnboardingCompleteDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("atlas-onboarding-complete", { detail }));
}

/** Server-side: build a preferencesJson (snake_case) from untrusted guest_prefs, field-independent. */
export function buildGuestPreferencesJson(raw: unknown): string {
  const out: { home_airport?: string; interests?: GuestInterest[] } = {};
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const airport = typeof obj.homeAirport === "string" ? parseIata(obj.homeAirport) : null;
    if (airport) out.home_airport = airport;
    const interests = sanitizeGuestInterests(obj.interests);
    if (interests.length) out.interests = interests;
  }
  return JSON.stringify(out);
}

/** The chat route's preferencesJson decision, extracted pure so it needs no DB mocks to test. */
export function resolvePreferencesJson(opts: { isGuest: boolean; dbPrefs?: string; guestPrefs?: unknown }): string {
  if (opts.dbPrefs) return opts.dbPrefs; // authed, or a guest with a stored row → DB wins (matches the old `prefRow?.prefs || "{}"`)
  if (opts.isGuest && opts.guestPrefs !== undefined) {
    const built = buildGuestPreferencesJson(opts.guestPrefs);
    if (built !== "{}") return built;
  }
  return "{}";
}

export function buildOnboardingIntro(detail: unknown): string {
  const d = (detail ?? {}) as Record<string, unknown>;
  const aiAssisted = d.aiAssisted === true;
  const airport = typeof d.homeAirport === "string" && d.homeAirport.trim() ? d.homeAirport.trim() : "";
  const budget = typeof d.budget === "string" && d.budget.trim() ? d.budget.trim() : "";
  const interests = Array.isArray(d.interests)
    ? d.interests.filter((i): i is string => typeof i === "string" && i.trim().length > 0)
    : [];

  let originClause = "";
  if (airport && budget) originClause = `flying from ${airport} with a ${budget} budget`;
  else if (airport) originClause = `flying from ${airport}`;
  else if (budget) originClause = `with a ${budget} budget`;

  if (aiAssisted) {
    const see = originClause ? `I see you're ${originClause}. ` : "";
    return `Great! I'm Atlas, your AI travel companion. I'll pick the best interests and vibes for you based on your preferences. Let's find your next perfect trip! 🌍 ${see}What destination are you dreaming about?`;
  }

  const parts: string[] = [];
  if (interests.length) parts.push(`interested in ${interests.join(", ")}`);
  if (originClause) parts.push(originClause);
  const see = parts.length ? `I see you're ${parts.join(" and ")}. ` : "";
  return `Great! I'm Atlas, your AI travel companion. ${see}Let's find your next perfect trip! 🌍 What destination are you thinking about?`;
}

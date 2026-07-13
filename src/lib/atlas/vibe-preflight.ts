import { CANONICAL_VIBES, type CanonicalVibe } from "@/lib/trip-types";
import { DESTINATION_VIBES } from "./destination-vibes";

// Deterministic pre-flight intent check. Pure set math + string distance —
// NO model call, ever (Atlas runs under a hard monthly spend cap; this module
// is what keeps the empty-result path at $0). Runs BEFORE any TravelPayouts
// request and short-circuits it when no destination could possibly satisfy
// the ask, so the wasted wire call is saved too.

export type PreflightResult =
  | { status: "ok" }
  | { status: "unknown_vibes"; unknown: string[]; suggestions: CanonicalVibe[] }
  | { status: "no_match_possible"; wouldMatchIfAny: number };

const CANONICAL = new Set<string>(CANONICAL_VIBES);

// Curated synonym map: everyday travel words (users type these as free-text
// custom vibes) and one everyday word per vibe for each supported locale.
// Suggestions only — never auto-substituted. Keys must be lowercase.
const SYNONYMS: Record<string, CanonicalVibe[]> = {
  // singular/plural and near-canonical words
  mountain: ["mountains"],
  city: ["big_city"], urban: ["big_city"], shopping: ["big_city"],
  culture: ["cultural"], museum: ["cultural"], museums: ["cultural"], history: ["cultural"],
  historic: ["cultural"], art: ["cultural"], architecture: ["cultural"],
  food: ["foodie"], wine: ["foodie"], winery: ["foodie"], dining: ["foodie"],
  restaurants: ["foodie"], gastronomy: ["foodie"],
  nature: ["mountains", "adventure"], hiking: ["mountains", "adventure"], hike: ["mountains", "adventure"],
  trekking: ["mountains", "adventure"], camping: ["mountains", "adventure"],
  wildlife: ["adventure"], safari: ["adventure"],
  ski: ["winter", "mountains"], skiing: ["winter", "mountains"], snow: ["winter"],
  snowboarding: ["winter", "mountains"], christmas: ["winter"],
  wellness: ["beach", "romantic"], spa: ["beach", "romantic"], yoga: ["beach"],
  relax: ["beach"], relaxing: ["beach"], retreat: ["romantic"],
  island: ["tropical", "beach"], islands: ["tropical", "beach"], sun: ["tropical", "beach"],
  caribbean: ["tropical"],
  surfing: ["beach", "adventure"], surf: ["beach", "adventure"], diving: ["beach", "adventure"],
  scuba: ["beach", "adventure"], snorkeling: ["beach", "adventure"],
  party: ["nightlife"], clubs: ["nightlife"], clubbing: ["nightlife"], bars: ["nightlife"],
  music: ["nightlife"], concerts: ["nightlife"],
  kids: ["family"], children: ["family"], waterpark: ["family"], zoo: ["family"], aquarium: ["family"],
  honeymoon: ["romantic"], romance: ["romantic"], anniversary: ["romantic"], couples: ["romantic"],
  // es / pt / fr / de / it everyday words
  playa: ["beach"], praia: ["beach"], plage: ["beach"], strand: ["beach"], spiaggia: ["beach"],
  ciudad: ["big_city"], cidade: ["big_city"], ville: ["big_city"], stadt: ["big_city"], "città": ["big_city"],
  "montaña": ["mountains"], "montañas": ["mountains"], montanha: ["mountains"], montanhas: ["mountains"],
  montagne: ["mountains"], montagnes: ["mountains"], berge: ["mountains"], montagna: ["mountains"],
  invierno: ["winter"], inverno: ["winter"], hiver: ["winter"],
  aventura: ["adventure"], aventure: ["adventure"], abenteuer: ["adventure"], avventura: ["adventure"],
  comida: ["foodie"], "gastronomía": ["foodie"], gastronomia: ["foodie"], gastronomie: ["foodie"],
  essen: ["foodie"], cibo: ["foodie"],
  cultura: ["cultural"], kultur: ["cultural"],
  familia: ["family"], "família": ["family"], famille: ["family"], familie: ["family"], famiglia: ["family"],
  "romántico": ["romantic"], romantico: ["romantic"], romantique: ["romantic"], romantisch: ["romantic"],
  fiesta: ["nightlife"], festa: ["nightlife"],
};

function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j += 1) distances[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const substitution = a[i - 1] === b[j - 1] ? 0 : 1;
      distances[i][j] = Math.min(
        distances[i - 1][j] + 1,
        distances[i][j - 1] + 1,
        distances[i - 1][j - 1] + substitution
      );
    }
  }
  return distances[rows - 1][cols - 1];
}

export function suggestVibes(input: string): CanonicalVibe[] {
  const normalized = input.trim().toLowerCase();
  if (normalized.length === 0) return [];

  const found: CanonicalVibe[] = [];
  const push = (vibes: CanonicalVibe[]) => {
    for (const vibe of vibes) {
      if (!found.includes(vibe)) found.push(vibe);
    }
  };

  const tokens = [normalized, ...normalized.split(/\s+/)];
  for (const token of tokens) {
    if (CANONICAL.has(token)) push([token as CanonicalVibe]);
    if (SYNONYMS[token]) push(SYNONYMS[token]);
  }

  // typo tolerance against canonical names and synonym keys (tokens >= 4 chars)
  for (const token of tokens) {
    if (token.length < 4) continue;
    for (const vibe of CANONICAL_VIBES) {
      // Distance 2 is only safe for long words. Against short canonical names
      // (beach, winter, family, foodie) it produced user-visible nonsense —
      // "wine"/"water"/"filter" -> winter, "peace" -> beach. Suggestions are
      // shown to users, so a wrong one is worse than none.
      const tolerance = token.length >= 7 && vibe.length >= 7 ? 2 : 1;
      if (editDistance(token, vibe) <= tolerance) push([vibe]);
    }
    for (const [key, vibes] of Object.entries(SYNONYMS)) {
      if (key.length >= 4 && editDistance(token, key) <= 1) push(vibes);
    }
  }

  return found.slice(0, 3);
}

export function preflightVibes(
  vibes: string[],
  opts?: { matchMode?: "all" | "any" }
): PreflightResult {
  const normalized = vibes.map((vibe) => vibe.trim().toLowerCase()).filter((vibe) => vibe.length > 0);
  if (normalized.length === 0) return { status: "ok" };

  const unknown = normalized.filter((vibe) => !CANONICAL.has(vibe));
  if (unknown.length > 0) {
    const selected = new Set(normalized);
    const suggestions: CanonicalVibe[] = [];
    for (const word of unknown) {
      for (const vibe of suggestVibes(word)) {
        if (!selected.has(vibe) && !suggestions.includes(vibe)) suggestions.push(vibe);
      }
    }
    return { status: "unknown_vibes", unknown, suggestions: suggestions.slice(0, 3) };
  }

  const requested = new Set(normalized);
  // Deliberately mirrors src/lib/atlas/surprise.ts: match-all means "at least
  // 2 selected vibes" for 2+ selections, not every selected vibe. Tightening
  // pre-flight to all-of-3 would hide destinations the engine can return.
  const minOverlap = opts?.matchMode === "any" ? 1 : requested.size >= 2 ? 2 : 1;

  let wouldMatchIfAny = 0;
  let satisfiable = false;
  for (const tags of Object.values(DESTINATION_VIBES)) {
    let overlap = 0;
    for (const vibe of requested) {
      if ((tags as ReadonlySet<string>).has(vibe)) overlap += 1;
    }
    if (overlap >= 1) wouldMatchIfAny += 1;
    if (overlap >= minOverlap) satisfiable = true;
  }

  if (!satisfiable) return { status: "no_match_possible", wouldMatchIfAny };
  return { status: "ok" };
}

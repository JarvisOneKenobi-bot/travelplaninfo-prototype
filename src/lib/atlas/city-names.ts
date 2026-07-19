import "server-only";

import { IATA_TO_CITY } from "./travelpayouts-client";
import generatedNames from "./generated/city-names.json";

// Two-tier destination naming. Curated IATA_TO_CITY (~131 hand-written labels
// like "Nashville, Tennessee") is primary; the generated TravelPayouts-derived
// table (~9,400 entries, see scripts/generate-city-names.mjs for provenance)
// is second. null means "we cannot honestly name this code" — callers must
// DROP the destination. A raw code must never reach a user.
const GENERATED: Record<string, string> = generatedNames;

export function resolveCityName(code: string): string | null {
  const cleaned = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(cleaned)) return null;
  return IATA_TO_CITY[cleaned] ?? GENERATED[cleaned] ?? null;
}

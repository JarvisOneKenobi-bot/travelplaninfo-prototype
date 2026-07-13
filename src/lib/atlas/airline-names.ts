import "server-only";

import generatedAirlineNames from "./generated/airline-names.json";

// Generated from TravelPayouts airlines.json (see scripts/generate-city-names.mjs
// for the provenance/normalization recipe). null means "we cannot honestly name
// this airline" — callers must render nothing, never the raw code.
const AIRLINE_NAMES: Record<string, string> = generatedAirlineNames;

export function resolveAirlineName(code: string): string | null {
  const cleaned = code.trim().toUpperCase();
  return AIRLINE_NAMES[cleaned] ?? null;
}

export function airlineDisplayName(code: string | null | undefined): string {
  return resolveAirlineName(code ?? "") ?? "";
}

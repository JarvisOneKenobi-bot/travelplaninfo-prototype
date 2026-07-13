import "server-only";

import airportMetros from "./generated/airport-metros.json";

const AIRPORT_METROS: Record<string, string> = airportMetros;

export function resolveMetro(code: string): string {
  const cleaned = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(cleaned)) return cleaned;
  return AIRPORT_METROS[cleaned] ?? cleaned;
}

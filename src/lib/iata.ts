/** Canonical IATA airport-code validator. Trims + uppercases; returns the 3-letter code or null. */
export function parseIata(value: string): string | null {
  const cleaned = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(cleaned) ? cleaned : null;
}

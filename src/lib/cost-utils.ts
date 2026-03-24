/**
 * Extract numeric cost from price string.
 * Prefers $-prefixed numbers: "2 adults x $289" → 289
 * Known limits: ranges return lower bound, "$1.5k" returns 1.5
 */
export function parseCost(priceEstimate: string | null | undefined): number | null {
  if (!priceEstimate) return null;
  const cleaned = priceEstimate.replace(/,/g, '');
  const dollarMatch = cleaned.match(/\$\s*([\d.]+)/);
  if (dollarMatch) return parseFloat(dollarMatch[1]);
  const numMatch = cleaned.match(/[\d.]+/);
  return numMatch ? parseFloat(numMatch[0]) : null;
}

/**
 * Auto budget limit: Budget $100/day/person, Mid-range $250, Luxury $500
 */
export function calculateBudgetLimit(
  tier: string | null,
  days: number,
  adults: number
): number {
  const perDay = tier === 'luxury' ? 500 : tier === 'budget' ? 100 : 250;
  return perDay * Math.max(days, 1) * Math.max(adults, 1);
}

/**
 * Extract numeric cost from price string.
 * Prefers $-prefixed numbers: "2 adults x $289" → 289
 * Handles k/K suffix: "$1.5k" → 1500
 * Known limits: ranges return lower bound
 */
export function parseCost(priceEstimate: string | null | undefined): number | null {
  if (!priceEstimate) return null;
  const cleaned = priceEstimate.replace(/,/g, '');
  // Prefer $-prefixed numbers
  const dollarMatch = cleaned.match(/\$\s*([\d.]+)\s*(k)?/i);
  if (dollarMatch) {
    let val = parseFloat(dollarMatch[1]);
    if (dollarMatch[2]) val *= 1000;
    return val;
  }
  // Fallback: first numeric sequence with optional k suffix
  const numMatch = cleaned.match(/([\d.]+)\s*(k)?/i);
  if (!numMatch) return null;
  let val = parseFloat(numMatch[1]);
  if (numMatch[2]) val *= 1000;
  return val;
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

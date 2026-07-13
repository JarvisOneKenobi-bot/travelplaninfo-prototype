export const FLEXIBLE_VIBES_SENTINEL = "flexible";

export function normalizeVibes(vibesSummary: string | null | undefined): string[] {
  if (!vibesSummary) return [];

  return vibesSummary
    .split(/\s*(?:\+|,)\s*/)
    .map((vibe) => vibe.trim().toLowerCase())
    .filter((vibe) => vibe.length > 0 && vibe !== FLEXIBLE_VIBES_SENTINEL);
}

// Convert flexible_window value to a YYYY-MM departure month
export function deriveDepartMonth(
  flexibleWindow?: string | null,
  startDate?: string | null,
): string {
  // Specific start date takes priority
  if (startDate) return startDate.slice(0, 7); // "2026-05-15" → "2026-05"

  const now = new Date();
  switch (flexibleWindow) {
    case "next_2_weeks": {
      const d = new Date(now); d.setDate(d.getDate() + 14);
      return d.toISOString().slice(0, 7);
    }
    case "next_month": {
      const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return d.toISOString().slice(0, 7);
    }
    case "2_3_months": {
      const d = new Date(now.getFullYear(), now.getMonth() + 2, 1);
      return d.toISOString().slice(0, 7);
    }
    case "6_months": {
      const d = new Date(now.getFullYear(), now.getMonth() + 6, 1);
      return d.toISOString().slice(0, 7);
    }
    default: {
      // "anytime" or unknown → next month
      const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return d.toISOString().slice(0, 7);
    }
  }
}

export function buildSurpriseQuery(args: {
  originCode: string;
  vibesSummary?: string | null;
  flexibleWindow?: string | null;
  tripLength?: string | null;
  startDate?: string | null;
  matchAny?: boolean;
  departMonthOverride?: string | null;
}): URLSearchParams {
  const departMonth = args.departMonthOverride?.trim() || deriveDepartMonth(args.flexibleWindow, args.startDate);
  const params = new URLSearchParams({ origin: args.originCode, depart_month: departMonth });
  if (args.tripLength) params.set("trip_length", args.tripLength);

  const vibes = normalizeVibes(args.vibesSummary);
  if (vibes.length > 0) params.set("vibes", vibes.join(","));
  if (args.matchAny) params.set("match", "any");

  return params;
}

import type { TpFailure } from "./travelpayouts-client";

export type SurpriseDegradeCode =
  | TpFailure
  | "invalid_origin"
  | "no_routes"
  | "no_vibe_match"
  | "unknown_vibes"
  | "no_match_possible"
  | "internal_error";

export interface SurpriseDegraded {
  code: SurpriseDegradeCode;
  reason: string;
}

// code -> i18n key inside the existing `atlasHero` namespace
export const DEGRADE_CODE_TO_KEY: Record<SurpriseDegradeCode, string> = {
  invalid_origin: "degradedInvalidOriginBody",
  no_token: "degradedNoTokenBody",
  rate_limited: "degradedRateLimitedBody",
  http_error: "degradedHttpErrorBody",
  timeout: "degradedTimeoutBody",
  no_routes: "degradedNoRoutesBody",
  no_vibe_match: "degradedNoVibeMatchBody",
  unknown_vibes: "degradedUnknownVibesBody",
  no_match_possible: "degradedNoMatchPossibleBody",
  internal_error: "degradedInternalErrorBody",
};

/**
 * Pure, React-free. `t` is next-intl's translator (or any (key)=>string).
 * Known code -> localized string. Unknown/absent code -> fall back to the prose `reason`.
 * Nothing usable at all -> undefined (caller supplies its own default).
 */
export function resolveDegradedBody(
  t: (key: string) => string,
  degraded: { code?: string; reason?: string } | null | undefined
): string | undefined {
  const code = degraded?.code;
  if (code && Object.prototype.hasOwnProperty.call(DEGRADE_CODE_TO_KEY, code)) {
    return t(DEGRADE_CODE_TO_KEY[code as SurpriseDegradeCode]);
  }

  const reason = degraded?.reason;
  if (typeof reason === "string" && reason.trim().length > 0) {
    return reason;
  }

  return undefined;
}

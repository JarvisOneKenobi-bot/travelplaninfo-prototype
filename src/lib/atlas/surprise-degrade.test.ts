import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEGRADE_CODE_TO_KEY,
  resolveDegradedBody,
  type SurpriseDegradeCode,
} from "./surprise-degrade";

const EXPECTED_DEGRADE_CODES: SurpriseDegradeCode[] = [
  "invalid_origin",
  "no_token",
  "rate_limited",
  "http_error",
  "timeout",
  "no_routes",
  "no_vibe_match",
  "unknown_vibes",
  "no_match_possible",
  "internal_error",
];

const LOCALES = ["en", "es", "pt", "fr", "de", "it"] as const;

describe("resolveDegradedBody", () => {
  const t = (key: string) => key;

  it("maps every known degrade code to its whitelisted atlasHero key", () => {
    for (const code of EXPECTED_DEGRADE_CODES) {
      expect(resolveDegradedBody(t, { code, reason: "raw engine prose" })).toBe(
        DEGRADE_CODE_TO_KEY[code]
      );
    }
  });

  it("falls back to raw prose for an unknown code", () => {
    expect(resolveDegradedBody(t, { code: "banana", reason: "raw engine prose" })).toBe(
      "raw engine prose"
    );
  });

  it("falls back to raw prose for a missing code", () => {
    expect(resolveDegradedBody(t, { reason: "raw engine prose" })).toBe("raw engine prose");
  });

  it("returns undefined when degraded has nothing usable", () => {
    expect(resolveDegradedBody(t, undefined)).toBeUndefined();
    expect(resolveDegradedBody(t, null)).toBeUndefined();
    expect(resolveDegradedBody(t, {})).toBeUndefined();
    expect(resolveDegradedBody(t, { reason: "" })).toBeUndefined();
    expect(resolveDegradedBody(t, { reason: "   " })).toBeUndefined();
  });
});

describe("DEGRADE_CODE_TO_KEY", () => {
  it("has an entry for all supported degrade codes", () => {
    expect(Object.keys(DEGRADE_CODE_TO_KEY).sort()).toEqual([...EXPECTED_DEGRADE_CODES].sort());
  });
});

describe("degraded body locale messages", () => {
  it.each(LOCALES)("%s has every localized degraded body key", (locale) => {
    const common = JSON.parse(
      readFileSync(resolve(process.cwd(), "messages", locale, "common.json"), "utf-8")
    ) as { atlasHero?: Record<string, unknown> };

    for (const key of Object.values(DEGRADE_CODE_TO_KEY)) {
      expect(common.atlasHero?.[key], `${locale}.atlasHero.${key}`).toEqual(expect.any(String));
      expect((common.atlasHero?.[key] as string).length, `${locale}.atlasHero.${key}`).toBeGreaterThan(0);
    }
  });

  it("non-English invalid-origin and no-token messages are not pasted English", () => {
    const en = JSON.parse(
      readFileSync(resolve(process.cwd(), "messages", "en", "common.json"), "utf-8")
    ) as { atlasHero: Record<string, string> };

    for (const locale of LOCALES.filter((locale) => locale !== "en")) {
      const common = JSON.parse(
        readFileSync(resolve(process.cwd(), "messages", locale, "common.json"), "utf-8")
      ) as { atlasHero: Record<string, string> };

      expect(common.atlasHero.degradedInvalidOriginBody).not.toBe(
        en.atlasHero.degradedInvalidOriginBody
      );
      expect(common.atlasHero.degradedNoTokenBody).not.toBe(en.atlasHero.degradedNoTokenBody);
    }
  });
});

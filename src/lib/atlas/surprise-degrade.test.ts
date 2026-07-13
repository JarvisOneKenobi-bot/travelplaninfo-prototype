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

const CLARIFY_KEYS = [
  "clarifyUnknownTitle",
  "clarifyUnknownBody",
  "clarifySuggestionsLead",
  "clarifyUseKnown",
  "clarifyImpossibleTitle",
  "clarifyImpossibleBody",
  "clarifyMatchAny",
  "clarifyAskAtlas",
  "clarifyAtlasSeed",
  // no-origin variants: used when the origin cannot be named — the origin
  // phrase is omitted, never a bare code
  "clarifyAtlasSeedNoOrigin",
  "subtitleNoOrigin",
] as const;

const NOTICE_KEYS = ["noticeLivePricingTitle", "noticeLivePricingBody"] as const;

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

  it.each(LOCALES)("%s has every clarification-card key", (locale) => {
    const common = JSON.parse(
      readFileSync(resolve(process.cwd(), "messages", locale, "common.json"), "utf-8")
    ) as { atlasHero?: Record<string, string> };

    for (const key of CLARIFY_KEYS) {
      expect(common.atlasHero?.[key], `${locale}.atlasHero.${key}`).toEqual(expect.any(String));
    }
  });

  it.each(LOCALES)("%s has every live-pricing notice key", (locale) => {
    const common = JSON.parse(
      readFileSync(resolve(process.cwd(), "messages", locale, "common.json"), "utf-8")
    ) as { atlasHero?: Record<string, string> };

    for (const key of NOTICE_KEYS) {
      expect(common.atlasHero?.[key], `${locale}.atlasHero.${key}`).toEqual(expect.any(String));
      expect((common.atlasHero?.[key] as string).length, `${locale}.atlasHero.${key}`).toBeGreaterThan(0);
    }
  });

  it("non-English live-pricing notices are genuinely translated, not pasted English", () => {
    const en = JSON.parse(
      readFileSync(resolve(process.cwd(), "messages", "en", "common.json"), "utf-8")
    ) as { atlasHero: Record<string, string> };

    for (const locale of LOCALES.filter((l) => l !== "en")) {
      const common = JSON.parse(
        readFileSync(resolve(process.cwd(), "messages", locale, "common.json"), "utf-8")
      ) as { atlasHero: Record<string, string> };

      for (const key of NOTICE_KEYS) {
        expect(common.atlasHero[key], `${locale}.atlasHero.${key}`).not.toBe(en.atlasHero[key]);
      }
    }
  });

  it("non-English clarify messages preserve the same ICU placeholder sets as English", () => {
    const en = JSON.parse(
      readFileSync(resolve(process.cwd(), "messages", "en", "common.json"), "utf-8")
    ) as { atlasHero: Record<string, string> };
    const clarifyKeys = Object.keys(en.atlasHero).filter((key) => key.startsWith("clarify"));
    const placeholders = (message: string) =>
      Array.from(new Set(Array.from(message.matchAll(/\{(\w+)\}/g), (match) => match[1]))).sort();

    for (const locale of LOCALES.filter((l) => l !== "en")) {
      const common = JSON.parse(
        readFileSync(resolve(process.cwd(), "messages", locale, "common.json"), "utf-8")
      ) as { atlasHero: Record<string, string> };

      for (const key of clarifyKeys) {
        expect(placeholders(common.atlasHero[key]), `${locale}.atlasHero.${key}`).toEqual(
          placeholders(en.atlasHero[key])
        );
      }
    }
  });

  it("non-English clarification bodies are genuinely translated, not pasted English", () => {
    const en = JSON.parse(
      readFileSync(resolve(process.cwd(), "messages", "en", "common.json"), "utf-8")
    ) as {
      atlasHero: Record<string, string>;
    };

    for (const locale of LOCALES.filter((l) => l !== "en")) {
      const common = JSON.parse(
        readFileSync(resolve(process.cwd(), "messages", locale, "common.json"), "utf-8")
      ) as { atlasHero: Record<string, string> };

      expect(common.atlasHero.clarifyImpossibleBody).not.toBe(
        en.atlasHero.clarifyImpossibleBody
      );
      expect(common.atlasHero.clarifyAtlasSeed).not.toBe(en.atlasHero.clarifyAtlasSeed);
    }
  });
});

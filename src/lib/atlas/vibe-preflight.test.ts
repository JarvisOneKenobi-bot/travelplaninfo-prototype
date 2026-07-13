import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { DESTINATION_VIBES } from "./destination-vibes";
import { preflightVibes, suggestVibes } from "./vibe-preflight";

describe("preflightVibes", () => {
  it("returns ok for empty input and for canonical vibes that can match", () => {
    expect(preflightVibes([])).toEqual({ status: "ok" });
    expect(preflightVibes(["   ", "\t"])).toEqual({ status: "ok" });
    expect(preflightVibes(["beach"])).toEqual({ status: "ok" });
    expect(preflightVibes(["BEACH"])).toEqual({ status: "ok" });
    expect(preflightVibes(["  beach "])).toEqual({ status: "ok" });
    expect(preflightVibes(["beach", "beach"])).toEqual({ status: "ok" });
    expect(preflightVibes(["mountains", "cultural"])).toEqual({ status: "ok" });
    expect(preflightVibes(["winter", "cultural"])).toEqual({ status: "ok" });
  });

  it("flags free-text custom vibes as unknown with canonical suggestions", () => {
    const result = preflightVibes(["wine tasting", "beach"]);
    expect(result.status).toBe("unknown_vibes");
    if (result.status !== "unknown_vibes") throw new Error("unreachable");
    expect(result.unknown).toEqual(["wine tasting"]);
    expect(result.suggestions).toContain("foodie");
  });

  it("maps everyday English words that are not internal values to suggestions", () => {
    const city = preflightVibes(["city"]);
    expect(city.status).toBe("unknown_vibes");
    if (city.status !== "unknown_vibes") throw new Error("unreachable");
    expect(city.suggestions).toContain("big_city");

    const nature = preflightVibes(["nature"]);
    if (nature.status !== "unknown_vibes") throw new Error("unreachable");
    expect(nature.suggestions).toContain("mountains");
  });

  it("suggests via small-typo tolerance", () => {
    const result = preflightVibes(["cultral"]);
    expect(result.status).toBe("unknown_vibes");
    if (result.status !== "unknown_vibes") throw new Error("unreachable");
    expect(result.suggestions).toContain("cultural");
  });

  // Both genuinely impossible pairs must route here. beach+winter joined
  // tropical+winter when Vancouver lost its 'beach' tag (Jose, 2026-07-12).
  it.each([["tropical"], ["beach"]])(
    "detects the genuinely impossible combination (%s+winter) as no_match_possible",
    (other) => {
      expect(preflightVibes([other, "winter"]).status).toBe("no_match_possible");
    }
  );

  it("detects the genuinely impossible combination (tropical+winter) with an honest any-match count", () => {
    const result = preflightVibes(["tropical", "winter"]);
    expect(result.status).toBe("no_match_possible");
    if (result.status !== "no_match_possible") throw new Error("unreachable");
    // Honest count, derived from the same taxonomy — never hardcoded.
    const expected = Object.values(DESTINATION_VIBES).filter(
      (tags) => tags.has("tropical") || tags.has("winter")
    ).length;
    expect(result.wouldMatchIfAny).toBe(expected);
    expect(result.wouldMatchIfAny).toBeGreaterThanOrEqual(16); // two coverage floors
  });

  it("detects the genuinely impossible combination (beach+winter) with an honest any-match count", () => {
    const result = preflightVibes(["beach", "winter"]);
    expect(result.status).toBe("no_match_possible");
    if (result.status !== "no_match_possible") throw new Error("unreachable");
    // Honest count, derived from the same taxonomy — never hardcoded.
    const expected = Object.values(DESTINATION_VIBES).filter(
      (tags) => tags.has("beach") || tags.has("winter")
    ).length;
    expect(result.wouldMatchIfAny).toBe(expected);
  });

  it("match-all means 'at least 2 of the selected vibes', matching the engine's min_overlap — NOT every vibe", () => {
    // Deliberate: src/lib/atlas/surprise.ts uses the same threshold. If the
    // pre-flight demanded ALL of 3+ vibes it would short-circuit searches the
    // engine would have satisfied, hiding real destinations from users.
    expect(preflightVibes(["tropical", "winter", "cultural"])).toEqual({ status: "ok" });
  });

  it("matchMode any rescues combinations that are impossible under match-all", () => {
    expect(preflightVibes(["tropical", "winter"], { matchMode: "any" })).toEqual({ status: "ok" });
  });

  it("unknown vibes take precedence over impossibility and never suggest already-selected vibes", () => {
    const result = preflightVibes(["beach", "playa"]);
    expect(result.status).toBe("unknown_vibes");
    if (result.status !== "unknown_vibes") throw new Error("unreachable");
    expect(result.unknown).toEqual(["playa"]);
    expect(result.suggestions).not.toContain("beach");
  });

  it("returns identical results for identical input (determinism)", () => {
    const a = preflightVibes(["spa", "hiking"]);
    const b = preflightVibes(["spa", "hiking"]);
    expect(a).toEqual(b);
  });
});

describe("suggestVibes", () => {
  it.each([
    ["ski", "winter"],
    ["snow", "winter"],
    ["hiking", "mountains"],
    ["museums", "cultural"],
    ["culture", "cultural"],
    ["food", "foodie"],
    ["wine", "foodie"],
    ["city", "big_city"],
    ["kids", "family"],
    ["honeymoon", "romantic"],
    ["clubbing", "nightlife"],
    ["island", "tropical"],
    ["diving", "adventure"],
    ["playa", "beach"],
    ["famille", "family"],
    ["montaña", "mountains"],
    ["inverno", "winter"],
  ])("%s -> includes %s", (input, expected) => {
    expect(suggestVibes(input)).toContain(expected);
  });

  it("caps suggestions at 3 and returns [] when nothing is close", () => {
    expect(suggestVibes("xyzzyplugh")).toEqual([]);
    expect(suggestVibes("beach party spa").length).toBeLessThanOrEqual(3);
  });

  it("does not show short-word typo false positives to users", () => {
    expect(suggestVibes("wine")).toEqual(["foodie"]);
    expect(suggestVibes("winery")).toEqual(["foodie"]);
    expect(suggestVibes("water")).toEqual([]);
    expect(suggestVibes("peace")).toEqual([]);
  });
});

describe("zero-LLM guarantee (deterministic by construction — asserted by test)", () => {
  it("vibe-preflight.ts stays inside the approved pure import allowlist", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/atlas/vibe-preflight.ts"), "utf-8");
    // ALLOWLIST guard over the PRODUCT module only (anti-self-defeat: never this
    // test file). It fails on ANY new import, which is the point: an LLM call here
    // would silently burn the Atlas spend cap on a path that must cost $0.
    const importSpecifiers = new Set<string>();
    const importPattern = /\bimport\s+(?!\()(?:(?:type\s+)?[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;
    for (const match of source.matchAll(importPattern)) importSpecifiers.add(match[1]);

    expect([...importSpecifiers].sort()).toEqual(["./destination-vibes", "@/lib/trip-types"]);
    expect(source).not.toMatch(/\bimport\s*\(/);
    expect(source).not.toMatch(/\brequire\s*\(/);
    expect(source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket/);
    expect(source).not.toMatch(/Date\.now|Math\.random|new Date\b/);
  });
});

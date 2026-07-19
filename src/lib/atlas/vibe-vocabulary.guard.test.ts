import { describe, expect, it } from "vitest";

import { VIBE_OPTIONS } from "@/lib/trip-types";
import { DESTINATION_VIBES } from "./destination-vibes";

// THE regression guard (spec 3.2, the most important deliverable). The live
// bug - the Mountains chip dead on a one-letter mismatch, the winter chip
// (now "Winter Escapade") backed by zero data, and foodie/romantic/nightlife
// data no user could select - was a silent drift between the words users can
// click and the words the taxonomy carries. Because min_overlap=2 for 2+
// vibes, one dud chip zeroed 11 of 21 two-vibe combos (52%), and a fabricated
// fallback masked it for months. If any test in this file fails, the vibe
// filter is broken for real users: fix the data, never weaken this file.

const COVERAGE_FLOOR = 8;

// The canonical vocabulary this change ships. Sorted for comparison.
const CANONICAL_TARGET = [
  "adventure", "beach", "big_city", "cultural", "family", "foodie",
  "mountains", "nightlife", "romantic", "tropical", "winter",
];

const pickerValues = () => VIBE_OPTIONS.map((option) => option.value);

function taxonomyVocabulary(): Set<string> {
  const vocabulary = new Set<string>();
  for (const tags of Object.values(DESTINATION_VIBES)) {
    for (const tag of tags) vocabulary.add(tag);
  }
  return vocabulary;
}

describe("vibe vocabulary regression guard", () => {
  it("every vibe a user can click exists in the taxonomy (no dud chips)", () => {
    const vocabulary = taxonomyVocabulary();
    for (const value of pickerValues()) {
      expect(vocabulary.has(value), `picker vibe "${value}" matches nothing in DESTINATION_VIBES`).toBe(true);
    }
  });

  it("the taxonomy vocabulary EQUALS the picker vocabulary (no orphan tags)", () => {
    expect([...taxonomyVocabulary()].sort()).toEqual([...pickerValues()].sort());
  });

  it(`every pickable vibe is carried by at least ${COVERAGE_FLOOR} destinations (a chip that exists but matches nothing is the bug we shipped)`, () => {
    for (const value of pickerValues()) {
      const carriers = Object.values(DESTINATION_VIBES).filter((tags) =>
        (tags as ReadonlySet<string>).has(value)
      ).length;
      expect(carriers, `"${value}" is carried by only ${carriers} destinations`).toBeGreaterThanOrEqual(COVERAGE_FLOOR);
    }
  });

  it("the picker exposes exactly the 11 canonical vibes", () => {
    expect([...pickerValues()].sort()).toEqual(CANONICAL_TARGET);
  });

  it("every taxonomy destination resolves to a display name (unnameable = invisible to users)", async () => {
    const { resolveCityName } = await import("./city-names");
    for (const code of Object.keys(DESTINATION_VIBES)) {
      expect(resolveCityName(code), `taxonomy code ${code} has no display name`).not.toBeNull();
    }
  });
});

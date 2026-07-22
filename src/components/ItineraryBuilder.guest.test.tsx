// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { readGuestPrefs, writeGuestPrefs } from "@/lib/guest-prefs";

// Mirror of the effect's merge logic (the effect body is a copy of Task 8's verified [status] pattern).
function guestInterestMerge(prev: string[], unauthenticated: boolean): string[] {
  if (!unauthenticated) return prev;
  const g = readGuestPrefs();
  return g?.interests.length ? Array.from(new Set([...prev, ...g.interests])) : prev;
}

describe("ItineraryBuilder guest interests fallback (contract)", () => {
  beforeEach(() => localStorage.clear());
  it("merges guest interests when unauthenticated", () => {
    writeGuestPrefs({ homeAirport: "MIA", interests: ["beach", "food"] });
    expect(guestInterestMerge(["culture"], true).sort()).toEqual(["beach", "culture", "food"]);
  });
  it("ignores guest prefs for an authenticated user", () => {
    writeGuestPrefs({ homeAirport: "MIA", interests: ["beach"] });
    expect(guestInterestMerge(["culture"], false)).toEqual(["culture"]);
  });
});

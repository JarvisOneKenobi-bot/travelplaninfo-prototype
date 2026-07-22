import { describe, it, expect, beforeEach } from "vitest";
import { parseGuestPrefs, readGuestPrefs, writeGuestPrefs, GUEST_PREFS_LS_KEY } from "./guest-prefs";

describe("parseGuestPrefs", () => {
  it("accepts valid airport + allowlisted interests", () => {
    expect(parseGuestPrefs({ homeAirport: "mia", interests: ["beach", "mountains"] }))
      .toEqual({ homeAirport: "MIA", interests: ["beach", "mountains"] });
  });
  it("rejects a non-3-letter airport", () => {
    expect(parseGuestPrefs({ homeAirport: "M1A", interests: ["beach"] })).toBeNull();
    expect(parseGuestPrefs({ homeAirport: "KMIA", interests: ["beach"] })).toBeNull();
  });
  it("drops non-allowlisted interests and dedupes/caps", () => {
    expect(parseGuestPrefs({ homeAirport: "MIA", interests: ["beach", "hacking", "beach", "food", "culture", "mountains"] }))
      .toEqual({ homeAirport: "MIA", interests: ["beach", "food", "culture", "mountains"] });
  });
  it("returns null when no valid interest remains or input malformed", () => {
    expect(parseGuestPrefs({ homeAirport: "MIA", interests: ["hacking"] })).toBeNull();
    expect(parseGuestPrefs({ homeAirport: "MIA" })).toBeNull();
    expect(parseGuestPrefs(null)).toBeNull();
    expect(parseGuestPrefs("nonsense")).toBeNull();
  });
});

describe("readGuestPrefs / writeGuestPrefs", () => {
  beforeEach(() => localStorage.clear());
  it("round-trips valid prefs", () => {
    writeGuestPrefs({ homeAirport: "MIA", interests: ["beach", "food"] });
    expect(readGuestPrefs()).toEqual({ homeAirport: "MIA", interests: ["beach", "food"] });
  });
  it("returns null on missing or malformed storage", () => {
    expect(readGuestPrefs()).toBeNull();
    localStorage.setItem(GUEST_PREFS_LS_KEY, "{not json");
    expect(readGuestPrefs()).toBeNull();
    localStorage.setItem(GUEST_PREFS_LS_KEY, JSON.stringify({ homeAirport: "M1A", interests: ["beach"] }));
    expect(readGuestPrefs()).toBeNull();
  });
});

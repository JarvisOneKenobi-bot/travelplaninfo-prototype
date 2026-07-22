import { describe, it, expect } from "vitest";
import { buildGuestPreferencesJson, resolvePreferencesJson } from "./guest-prefs";

describe("buildGuestPreferencesJson", () => {
  it("includes both fields when valid", () => {
    expect(JSON.parse(buildGuestPreferencesJson({ homeAirport: "mia", interests: ["beach", "mountains"] })))
      .toEqual({ home_airport: "MIA", interests: ["beach", "mountains"] });
  });
  it("keeps valid interests even when the airport is invalid (field-independent)", () => {
    expect(JSON.parse(buildGuestPreferencesJson({ homeAirport: "M1A", interests: ["beach"] })))
      .toEqual({ interests: ["beach"] });
  });
  it("keeps the airport when interests are absent", () => {
    expect(JSON.parse(buildGuestPreferencesJson({ homeAirport: "MIA" })))
      .toEqual({ home_airport: "MIA" });
  });
  it("returns '{}' for garbage", () => {
    expect(buildGuestPreferencesJson(null)).toBe("{}");
    expect(buildGuestPreferencesJson({ homeAirport: "KMIA", interests: ["hacking"] })).toBe("{}");
  });
});

describe("resolvePreferencesJson", () => {
  it("authed or guest-with-row: DB prefs win", () => {
    expect(resolvePreferencesJson({ isGuest: false, dbPrefs: '{"home_airport":"LAX"}' })).toBe('{"home_airport":"LAX"}');
    expect(resolvePreferencesJson({ isGuest: true, dbPrefs: '{"home_airport":"LAX"}', guestPrefs: { homeAirport: "MIA", interests: ["beach"] } })).toBe('{"home_airport":"LAX"}');
  });
  it("guest + no row + valid guest_prefs → built profile", () => {
    expect(JSON.parse(resolvePreferencesJson({ isGuest: true, guestPrefs: { homeAirport: "MIA", interests: ["beach"] } })))
      .toEqual({ home_airport: "MIA", interests: ["beach"] });
  });
  it("returns '{}' when nothing usable", () => {
    expect(resolvePreferencesJson({ isGuest: true, guestPrefs: { homeAirport: "KMIA" } })).toBe("{}");
    expect(resolvePreferencesJson({ isGuest: false })).toBe("{}");
  });
});

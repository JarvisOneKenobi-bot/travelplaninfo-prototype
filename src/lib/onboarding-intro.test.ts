import { describe, it, expect } from "vitest";
import { buildOnboardingIntro } from "./guest-prefs";

describe("buildOnboardingIntro", () => {
  it("guest (homeAirport + interests, no budget) — never 'undefined'", () => {
    const out = buildOnboardingIntro({ homeAirport: "MIA", interests: ["beach", "mountains"] });
    expect(out).not.toContain("undefined");
    expect(out).toContain("flying from MIA");
    expect(out).toContain("interested in beach, mountains");
  });
  it("legacy `{ airport }` shape must still not emit 'undefined' (mutation guard)", () => {
    const out = buildOnboardingIntro({ airport: "JFK", budget: "mid", interests: ["food"] });
    expect(out).not.toContain("undefined");
  });
  it("authed non-AI (all fields) preserves the original copy verbatim", () => {
    expect(buildOnboardingIntro({ homeAirport: "MIA", budget: "mid", interests: ["beach", "food"], aiAssisted: false }))
      .toBe("Great! I'm Atlas, your AI travel companion. I see you're interested in beach, food and flying from MIA with a mid budget. Let's find your next perfect trip! 🌍 What destination are you thinking about?");
  });
  it("authed AI (airport + budget) preserves the original copy verbatim", () => {
    expect(buildOnboardingIntro({ homeAirport: "MIA", budget: "mid", aiAssisted: true }))
      .toBe("Great! I'm Atlas, your AI travel companion. I'll pick the best interests and vibes for you based on your preferences. Let's find your next perfect trip! 🌍 I see you're flying from MIA with a mid budget. What destination are you dreaming about?");
  });
});

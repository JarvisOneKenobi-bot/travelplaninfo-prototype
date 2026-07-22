// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { buildOnboardingIntro } from "@/lib/guest-prefs";

// Guard: the authed producer must emit the `homeAirport` key the listener reads.
describe("OnboardingModal event contract", () => {
  it("a detail using `homeAirport` renders with the airport (not undefined)", () => {
    const out = buildOnboardingIntro({ homeAirport: "MIA", budget: "mid", interests: ["beach"], aiAssisted: false });
    expect(out).toContain("flying from MIA");
    expect(out).not.toContain("undefined");
  });
});

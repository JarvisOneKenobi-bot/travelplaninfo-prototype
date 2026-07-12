import { describe, expect, it } from "vitest";

import { buildSurpriseQuery } from "./surprise-query";

describe("buildSurpriseQuery", () => {
  it.each([
    ["flexible"],
    ["Flexible"],
    ["  flexible  "],
    [""],
    [null],
    [undefined],
  ])("omits vibes for no-preference summary %s", (vibesSummary) => {
    const params = buildSurpriseQuery({
      originCode: "JFK",
      vibesSummary,
      startDate: "2026-05-15",
    });

    expect(params.has("vibes")).toBe(false);
    expect(params.toString()).not.toContain("vibes");
  });

  it("normalizes real vibes to a comma-separated query value", () => {
    const params = buildSurpriseQuery({
      originCode: "JFK",
      vibesSummary: "beach + romantic",
      startDate: "2026-05-15",
    });

    expect(params.get("vibes")).toBe("beach,romantic");
  });

  it("drops flexible from mixed summaries while preserving the real single vibe", () => {
    const params = buildSurpriseQuery({
      originCode: "JFK",
      vibesSummary: "beach + flexible",
      startDate: "2026-05-15",
    });

    expect(params.get("vibes")).toBe("beach");
  });

  it("sets origin, departure month, and trip length as before", () => {
    const params = buildSurpriseQuery({
      originCode: "JFK",
      vibesSummary: "beach + romantic",
      tripLength: "week",
      startDate: "2026-05-15",
    });

    expect(params.get("origin")).toBe("JFK");
    expect(params.get("depart_month")).toBe("2026-05");
    expect(params.get("trip_length")).toBe("week");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { getSurpriseDestinations } from "./surprise";

describe("getSurpriseDestinations HTTP budget", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("caps wire-level requests to one popular fetch plus three enrichments with date/month attempts", async () => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "test-token");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSurpriseDestinations({
      origin: "JFK",
      vibes: "tropical,beach",
      departMonth: "2026-08",
      tripLength: "week",
    });

    // F6 wire-level budget contract is <= 8; this pins the deterministic worst case at 7.
    expect(fetchMock.mock.calls.length).toBe(7);
    expect(result.destinations).toHaveLength(3);
    for (const destination of result.destinations) {
      expect(destination).toMatchObject({ flightPrice: "—", airline: "", nonstop: false, link: "" });
    }
  });
});

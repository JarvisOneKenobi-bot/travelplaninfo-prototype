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

describe("PRE-FLIGHT: impossible or unknown vibes short-circuit before any TravelPayouts call", () => {
  it("no_match_possible fires ZERO wire requests", async () => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "test-token");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await getSurpriseDestinations({
      origin: "JFK",
      vibes: "tropical,winter",
      departMonth: "2026-08",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.destinations).toEqual([]);
    expect(result.degraded?.code).toBe("no_match_possible");
    expect(result.preflight?.status).toBe("no_match_possible");
  });

  it("unknown custom vibes short-circuit with suggestions, zero wire requests, and a named origin", async () => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "test-token");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await getSurpriseDestinations({
      origin: "JFK",
      vibes: "wine tasting,beach",
      departMonth: "2026-08",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.degraded?.code).toBe("unknown_vibes");
    expect(result.preflight).toMatchObject({ status: "unknown_vibes", unknown: ["wine tasting"] });
    expect(result.originName).toBe("New York, New York");
  });
});

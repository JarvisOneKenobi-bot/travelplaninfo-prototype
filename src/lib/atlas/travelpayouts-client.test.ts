import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { searchFlights, buildAviasalesLink } from "./travelpayouts-client";

describe("travelpayouts-client", () => {
  beforeEach(() => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "fake-token");
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns real flight data when the API responds with prices", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [{ origin: "MIA", destination: "CUN", price: 210, departure_at: "2026-09-01T10:00:00Z" }],
      }),
    });
    const result = await searchFlights("MIA", "CUN", "2026-09-01");
    expect("no_data" in result).toBe(false);
    if (!("no_data" in result)) {
      expect(result.flights.length).toBeGreaterThan(0);
      expect(result.flights[0].price).toBe(210);
    }
  });

  it("returns honest no_data:true when the API returns nothing, never a fabricated price", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) });
    const result = await searchFlights("XXX", "YYY", "2026-09-01");
    expect(result).toMatchObject({ flights: [], no_data: true });
    expect((result as { reason: string }).reason).toBeTruthy();
  });

  it("builds an aviasales link with the correct marker", () => {
    const link = buildAviasalesLink("MIA", "CUN", "2026-09-01");
    expect(link).toContain("aviasales.com/search/");
    expect(link).toContain("marker=164743");
  });

  it("sanitizes IATA codes before use, rejecting non-letter characters", () => {
    const link = buildAviasalesLink("mi'a; drop table--", "CUN", "2026-09-01");
    expect(link).toContain("/search/MIA"); // truncated/sanitized to 3 letters
  });
});

describe("getPopularRoutes", () => {
  it("returns honest empty result when no popular routes are available, never a curated fallback list", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) });
    const { getPopularRoutes } = await import("./travelpayouts-client");
    const result = await getPopularRoutes("MIA");
    expect(result).toMatchObject({ routes: [], no_data: true });
  });
});

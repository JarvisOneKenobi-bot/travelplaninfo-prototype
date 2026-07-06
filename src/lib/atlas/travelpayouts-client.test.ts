import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { searchFlights, getDeals, buildAviasalesLink } from "./travelpayouts-client";

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
      expect(result.flights[0]).toMatchObject({
        route: "MIA → CUN",
        price: "$210 round-trip",
        duration: "",
        stops: "Nonstop",
        depart_date: "2026-09-01T10:00:00Z",
      });
      expect(result.flights[0].book_url).toContain("aviasales.com/search/");
    }
  });

  it("returns frontend-ready deal card data when the API responds with prices", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [{ origin: "MIA", destination: "SJU", price: 155, departure_at: "2026-08-12T09:00:00Z" }],
      }),
    });

    const result = await getDeals("MIA");
    expect("no_data" in result).toBe(false);
    if (!("no_data" in result)) {
      expect(result.deals[0]).toMatchObject({
        date: "2026-08-12",
        destination: "SJU",
        price: "$155",
        savings_pct: 0,
      });
      expect(result.deals[0].search_url).toContain("aviasales.com/search/");
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
    expect(result).toMatchObject({ suggestions: [], no_data: true });
  });
});

describe("failure-cause reporting", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
  });

  // NOTE: each test below uses a route no other test in this file touches —
  // tpGet's module-level 5-minute cache persists across tests, and reusing a
  // route another test has already cached would mask the failure path.
  it("reports 'not configured' — never 'no flights' — when the token is missing", async () => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", ""); // don't depend on the host env being unset
    const { searchFlights } = await import("./travelpayouts-client");
    const result = await searchFlights("BOS", "SEA", "2026-09-01");
    expect(result).toMatchObject({ flights: [], no_data: true });
    expect((result as { reason: string }).reason).toMatch(/not configured/i);
    expect((result as { reason: string }).reason).not.toMatch(/no flights for this route/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a temporary-unavailability reason on network failure, not an empty-route reason", async () => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "fake-token");
    fetchMock.mockRejectedValue(new Error("network down"));
    const { getDeals } = await import("./travelpayouts-client");
    const result = await getDeals("DEN");
    expect(result).toMatchObject({ deals: [], no_data: true });
    expect((result as { reason: string }).reason).toMatch(/timed out|unavailable/i);
  });

  it("keeps the honest empty-result reason when the API succeeds with no data", async () => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "fake-token");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) });
    const { searchFlights } = await import("./travelpayouts-client");
    const result = await searchFlights("PHX", "BNA", "2026-09-01");
    expect((result as { reason: string }).reason).toMatch(/no flights for this route/i);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

type TransfersFixture = "absent" | number | null;

function flightItem(destination: string, transfers: TransfersFixture): Record<string, unknown> {
  const item: Record<string, unknown> = {
    origin: "JFK",
    destination,
    price: 210,
    airline: "AA",
    departure_at: "2026-08-01",
  };
  if (transfers !== "absent") {
    item.transfers = transfers;
  }
  return item;
}

async function runEnrichmentWireTest(transfers: TransfersFixture, origin: string) {
  vi.resetModules();
  vi.stubEnv("TRAVELPAYOUTS_TOKEN", "test-token");

  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const destination = url.searchParams.get("destination");
    if (!destination) {
      return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, data: [flightItem(destination, transfers)] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);

  const { getSurpriseDestinations } = await import("./surprise");
  const result = await getSurpriseDestinations({
    origin,
    vibes: "tropical,beach",
    departMonth: "2026-08",
    tripLength: "week",
  });

  return { fetchMock, result };
}

describe("getSurpriseDestinations wire-level enrichment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("ENRICHMENT: absent transfers must NOT be claimed as nonstop", async () => {
    const { result } = await runEnrichmentWireTest("absent", "JFK");

    expect(result.destinations).toHaveLength(3);
    for (const destination of result.destinations) {
      expect(destination.flightPrice).toMatch(/^\$\d/);
      expect(destination.nonstop).toBe(false);
    }
  });

  it("ENRICHMENT: explicit transfers: 0 IS a measured nonstop (positive control)", async () => {
    const { result } = await runEnrichmentWireTest(0, "EWR");

    expect(result.destinations).toHaveLength(3);
    for (const destination of result.destinations) {
      expect(destination.flightPrice).toMatch(/^\$\d/);
      expect(destination.nonstop).toBe(true);
    }
  });

  it("ENRICHMENT: transfers: null is absence, not zero", async () => {
    const { result } = await runEnrichmentWireTest(null, "LGA");

    expect(result.destinations).toHaveLength(3);
    for (const destination of result.destinations) {
      expect(destination.flightPrice).toMatch(/^\$\d/);
      expect(destination.nonstop).toBe(false);
    }
  });

  it("ENRICHMENT: explicit transfers: 1 is not nonstop", async () => {
    const { result } = await runEnrichmentWireTest(1, "BOS");

    expect(result.destinations).toHaveLength(3);
    for (const destination of result.destinations) {
      expect(destination.flightPrice).toMatch(/^\$\d/);
      expect(destination.nonstop).toBe(false);
    }
  });
});

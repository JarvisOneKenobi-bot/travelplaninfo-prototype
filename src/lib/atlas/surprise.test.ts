import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  FAILURE_REASONS,
  INVALID_IATA_REASON,
  nextMonthUtc,
  rawSearchFlights,
  tpGet,
  type TpFlightItem,
} from "./travelpayouts-client";
import {
  getSurpriseDestinations,
  NO_ROUTES_REASON,
  NO_VIBE_MATCH_REASON,
} from "./surprise";

vi.mock("./travelpayouts-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./travelpayouts-client")>();
  return { ...actual, tpGet: vi.fn(), rawSearchFlights: vi.fn() };
});

function popular(items: TpFlightItem[]) {
  vi.mocked(tpGet).mockResolvedValue({ data: { success: true, data: items } });
}

function emptyPopular() {
  popular([]);
}

function item(destination: string, price: number | null, extras: Partial<TpFlightItem> = {}): TpFlightItem {
  return {
    destination,
    price,
    airline: "AA",
    transfers: 0,
    departure_at: "2026-08-01",
    ...extras,
  };
}

describe("getSurpriseDestinations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("LIVE MAPPING: maps popular routes into cards without vibes", async () => {
    popular([
      item("CUN", 120, { airline: "NK", transfers: 0 }),
      item("MBJ", 180, { airline: "B6", transfers: 1 }),
    ]);

    const result = await getSurpriseDestinations({ origin: "JFK", departMonth: "2026-08" });

    expect(result.destinations).toHaveLength(2);
    expect(result.destinations[0]).toMatchObject({
      name: "Cancún, Mexico",
      flightPrice: "$120",
      airline: "NK",
      nonstop: true,
    });
    expect(result.destinations[1]).toMatchObject({
      name: "Montego Bay, Jamaica",
      flightPrice: "$180",
      airline: "B6",
      nonstop: false,
    });
    expect(result.destinations.every((d) => d.link.includes("aviasales.com/search/"))).toBe(true);
    expect(result.degraded).toBeUndefined();
  });

  it("FLEXIBLE SENTINEL: behaves like absent vibes when popular routes exist", async () => {
    popular([item("CUN", 120), item("MBJ", 180), item("TPA", 90)]);

    const result = await getSurpriseDestinations({ origin: "JFK", vibes: "flexible", departMonth: "2026-08" });

    expect(result.destinations).toHaveLength(3);
    expect(result.destinations.map((destination) => destination.name)).toEqual([
      "Cancún, Mexico",
      "Montego Bay, Jamaica",
      "Tampa, Florida",
    ]);
    expect(result.degraded).toBeUndefined();
  });

  it("FLEXIBLE SENTINEL: mixed with a real vibe preserves the real vibe filter", async () => {
    popular([item("TPA", 90), item("LAS", 100), item("CUN", 120)]);
    const beachOnly = await getSurpriseDestinations({ origin: "JFK", vibes: "beach", departMonth: "2026-08" });

    vi.clearAllMocks();
    popular([item("TPA", 90), item("LAS", 100), item("CUN", 120)]);
    const mixed = await getSurpriseDestinations({ origin: "JFK", vibes: "beach,flexible", departMonth: "2026-08" });

    expect(mixed.destinations).toEqual(beachOnly.destinations);
    expect(mixed.degraded).toBeUndefined();
    expect(mixed.degraded).toBe(beachOnly.degraded);
  });

  it("FLEXIBLE SENTINEL: empty popular routes use the no-routes reason", async () => {
    emptyPopular();

    const result = await getSurpriseDestinations({ origin: "JFK", vibes: "flexible", departMonth: "2026-08" });

    expect(result.destinations).toEqual([]);
    expect(result.degraded?.reason).toBe(NO_ROUTES_REASON);
    expect(result.degraded?.reason).not.toBe(NO_VIBE_MATCH_REASON);
  });

  it("ROUND-TRIP SUFFIX: only valid YYYY-MM months with known trip lengths go round-trip", async () => {
    popular([item("CUN", 120)]);
    const week = await getSurpriseDestinations({ origin: "JFK", departMonth: "2026-08", tripLength: "week" });
    expect(vi.mocked(tpGet)).toHaveBeenLastCalledWith(
      "/aviasales/v3/prices_for_dates",
      expect.objectContaining({ return_at: "2026-08" })
    );
    expect(week.destinations[0].flightPrice).toBe("$120 rt");

    vi.clearAllMocks();
    popular([item("CUN", 120)]);
    const unknown = await getSurpriseDestinations({ origin: "JFK", departMonth: "2026-08", tripLength: "fortnight" });
    expect(vi.mocked(tpGet).mock.calls[0][1]).not.toHaveProperty("return_at");
    expect(unknown.destinations[0].flightPrice).toBe("$120");

    vi.clearAllMocks();
    popular([item("CUN", 120)]);
    const malformed = await getSurpriseDestinations({ origin: "JFK", departMonth: "2026-13", tripLength: "week" });
    expect(vi.mocked(tpGet).mock.calls[0][1]).not.toHaveProperty("return_at");
    expect(malformed.destinations[0].flightPrice).toBe("$120");

    vi.clearAllMocks();
    popular([item("CUN", 120)]);
    const fullDate = await getSurpriseDestinations({ origin: "JFK", departMonth: "2026-08-15", tripLength: "week" });
    expect(vi.mocked(tpGet).mock.calls[0][1]).not.toHaveProperty("return_at");
    expect(fullDate.destinations[0].flightPrice).toBe("$120");
  });

  it("POPULAR FETCH PARAMS: makes one TP popular call with the required query", async () => {
    emptyPopular();
    await getSurpriseDestinations({ origin: "JFK", departMonth: "2026-08" });
    expect(vi.mocked(tpGet)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(tpGet)).toHaveBeenCalledWith("/aviasales/v3/prices_for_dates", {
      origin: "JFK",
      departure_at: "2026-08",
      sorting: "price",
      currency: "usd",
      limit: 100,
    });

    vi.clearAllMocks();
    emptyPopular();
    await getSurpriseDestinations({ origin: "JFK" });
    expect(vi.mocked(tpGet).mock.calls[0][1]).toMatchObject({ departure_at: nextMonthUtc() });
  });

  it("SELF-ORIGIN DROPPED + DEDUPE KEEPS FIRST/CHEAPEST", async () => {
    popular([item("JFK", 50), item("CUN", 150), item("CUN", 300)]);

    const result = await getSurpriseDestinations({ origin: "JFK", departMonth: "2026-08" });

    expect(result.destinations).toHaveLength(1);
    expect(result.destinations[0]).toMatchObject({ name: "Cancún, Mexico", flightPrice: "$150" });
    expect(result.destinations.find((d) => d.name === "New York, New York")).toBeUndefined();
  });

  it("MIN_OVERLAP: one vibe keeps overlap-1; two vibes require overlap-2", async () => {
    popular([item("TPA", 90), item("CUN", 120)]);
    const oneVibe = await getSurpriseDestinations({ origin: "JFK", vibes: "beach", departMonth: "2026-08" });
    expect(oneVibe.destinations.map((d) => d.name)).toContain("Tampa, Florida");

    vi.clearAllMocks();
    popular([item("TPA", 90), item("LAS", 100), item("CUN", 120)]);
    const twoVibes = await getSurpriseDestinations({ origin: "JFK", vibes: "beach,nightlife", departMonth: "2026-08" });
    expect(twoVibes.destinations.map((d) => d.name)).not.toContain("Tampa, Florida");
    expect(twoVibes.destinations.map((d) => d.name)).not.toContain("Las Vegas, Nevada");
    expect(twoVibes.destinations[0]).toMatchObject({ name: "Cancún, Mexico", flightPrice: "$120" });
  });

  it("REAL VIBES: beach and romantic still filter out live routes without both tags", async () => {
    popular([item("TPA", 90), item("CUN", 120), item("MBJ", 180), item("PUJ", 200)]);

    const result = await getSurpriseDestinations({ origin: "JFK", vibes: "beach,romantic", departMonth: "2026-08" });

    expect(result.destinations.map((destination) => destination.name)).toEqual([
      "Cancún, Mexico",
      "Montego Bay, Jamaica",
      "Punta Cana, Dominican Republic",
    ]);
    expect(result.destinations.map((destination) => destination.name)).not.toContain("Tampa, Florida");
    expect(result.degraded).toBeUndefined();
  });

  it("STABLE SORT + OVERLAP-DESC: overlap outranks price and equal-overlap stays price-ascending", async () => {
    popular([item("FLL", 60), item("PUJ", 80), item("NAS", 95), item("CUN", 110)]);

    const result = await getSurpriseDestinations({
      origin: "JFK",
      vibes: "tropical,beach,romantic",
      departMonth: "2026-08",
    });

    expect(result.destinations.map((d) => `${d.name} ${d.flightPrice}`)).toEqual([
      "Punta Cana, Dominican Republic $80",
      "Nassau, Bahamas $95",
      "Cancún, Mexico $110",
    ]);
  });

  it("FILLER ENGAGES when live matches are fewer than 3 and vibes are present", async () => {
    popular([item("CUN", 120)]);
    vi.mocked(rawSearchFlights).mockImplementation(async (_origin, destination) => ({
      flights: [
        {
          origin: "JFK",
          destination,
          price: destination === "SJU" ? 210 : 220,
          airline: destination === "SJU" ? "B6" : "AA",
          departure_at: "2026-08-01",
          transfers: destination === "SJU" ? 0 : 1,
          link: `https://www.aviasales.com/search/JFK${destination}`,
        },
      ],
    }));

    const result = await getSurpriseDestinations({ origin: "JFK", vibes: "tropical,beach", departMonth: "2026-08" });

    expect(result.destinations).toHaveLength(3);
    expect(result.destinations[1]).toMatchObject({ flightPrice: "$210", airline: "B6", nonstop: true });
    expect(result.destinations[2].flightPrice).toBe("$220");
  });

  it("FILLER DOES NOT ENGAGE WITHOUT VIBES", async () => {
    popular([item("CUN", 120), item("MBJ", 180)]);

    const result = await getSurpriseDestinations({ origin: "JFK", departMonth: "2026-08" });

    expect(result.destinations).toHaveLength(2);
    expect(rawSearchFlights).not.toHaveBeenCalled();
  });

  it("ENRICHMENT CAP = 3, ENFORCED PRE-DISPATCH", async () => {
    emptyPopular();
    vi.mocked(rawSearchFlights).mockResolvedValue({ flights: [] });

    await getSurpriseDestinations({ origin: "JFK", vibes: "tropical,beach", departMonth: "2026-08" });

    expect(vi.mocked(rawSearchFlights)).toHaveBeenCalledTimes(3);
  });

  it("ENRICHMENT FAILURE -> DASH", async () => {
    emptyPopular();
    vi.mocked(rawSearchFlights).mockResolvedValue({ flights: [], failure: "timeout" });

    const result = await getSurpriseDestinations({ origin: "JFK", vibes: "tropical,beach", departMonth: "2026-08" });

    expect(result.destinations).toHaveLength(3);
    for (const destination of result.destinations) {
      expect(destination).toMatchObject({ airline: "", nonstop: false, link: "" });
      expect(destination.flightPrice).toMatch(/^—$/);
      expect(destination.flightPrice).not.toMatch(/\d/);
    }
  });

  it("TP FAILURE REASON SURVIVES", async () => {
    vi.mocked(tpGet).mockResolvedValue({ failure: "no_token" });

    const result = await getSurpriseDestinations({ origin: "JFK", departMonth: "2026-08" });

    expect(result.destinations).toEqual([]);
    expect(result.degraded?.reason).toBe(FAILURE_REASONS.no_token);
    expect(result.degraded?.reason).toContain("not configured");
    expect(result.degraded?.reason).not.toBe(NO_ROUTES_REASON);
  });

  it("EMPTY-SUCCESS REASON", async () => {
    emptyPopular();

    const result = await getSurpriseDestinations({ origin: "JFK", departMonth: "2026-08" });

    expect(result.destinations).toEqual([]);
    expect(result.degraded?.reason).toBe(NO_ROUTES_REASON);
  });

  it("INVALID ORIGIN: rejects city names and empty origins without substituting another airport", async () => {
    const cityName = await getSurpriseDestinations({ origin: "Cancun", departMonth: "2026-08" });
    expect(cityName).toMatchObject({
      origin: "CANCUN",
      destinations: [],
      degraded: { reason: INVALID_IATA_REASON },
    });
    expect(cityName.origin).not.toBe("MIA");

    const empty = await getSurpriseDestinations({ origin: "", departMonth: "2026-08" });
    expect(empty).toMatchObject({
      origin: "",
      destinations: [],
      degraded: { reason: INVALID_IATA_REASON },
    });
    expect(empty.origin).not.toBe("MIA");
    expect(tpGet).not.toHaveBeenCalled();
  });

  it("SINGLE-VIBE FILLER IS DEAD (faithful port)", async () => {
    emptyPopular();

    const result = await getSurpriseDestinations({ origin: "JFK", vibes: "beach", departMonth: "2026-08" });

    expect(result.destinations).toEqual([]);
    expect(result.degraded?.reason).toBe(NO_VIBE_MATCH_REASON);
    expect(result.degraded?.reason).not.toBe(NO_ROUTES_REASON);
    expect(rawSearchFlights).not.toHaveBeenCalled();
  });

  it("TP FAILURE + 2 VIBES STILL FILLS HONESTLY", async () => {
    vi.mocked(tpGet).mockResolvedValue({ failure: "no_token" });
    vi.mocked(rawSearchFlights).mockResolvedValue({ flights: [], failure: "no_token" });

    const result = await getSurpriseDestinations({ origin: "JFK", vibes: "tropical,beach", departMonth: "2026-08" });

    expect(result.destinations).toHaveLength(3);
    expect(result.destinations.every((d) => d.flightPrice === "—")).toBe(true);
    expect(result.degraded).toBeUndefined();
  });
});

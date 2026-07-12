import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";
import { getSurpriseDestinations } from "@/lib/atlas/surprise";

vi.mock("@/lib/atlas/surprise", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/atlas/surprise")>();
  return {
    ...actual,
    getSurpriseDestinations: vi.fn(),
  };
});

const mockedGetSurpriseDestinations = vi.mocked(getSurpriseDestinations);

function request(qs: string): NextRequest {
  return new Request(`http://localhost/api/surprise-me?${qs}`) as unknown as NextRequest;
}

async function json(res: Response): Promise<unknown> {
  return res.json();
}

describe("surprise-me API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("PASS-THROUGH: forwards clamped query params to the native engine", async () => {
    const engineResult = {
      origin: "JFK",
      destinations: [
        { name: "Cancún, Mexico", flightPrice: "$220", airline: "AA", nonstop: true, link: "https://example.com/jfk-cun" },
      ],
    };
    mockedGetSurpriseDestinations.mockResolvedValue(engineResult);

    const res = await GET(request("origin=JFK&vibes=beach,romantic&depart_month=2026-08&trip_length=week"));

    expect(mockedGetSurpriseDestinations).toHaveBeenCalledTimes(1);
    expect(mockedGetSurpriseDestinations).toHaveBeenCalledWith({
      origin: "JFK",
      vibes: "beach,romantic",
      departMonth: "2026-08",
      tripLength: "week",
    });
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual(engineResult);
  });

  it("NO ORIGIN MANGLING: forwards origin verbatim and uses an empty string when absent", async () => {
    mockedGetSurpriseDestinations
      .mockResolvedValueOnce({
        origin: "Cancun",
        destinations: [
          { name: "Cancún, Mexico", flightPrice: "$240", airline: "UA", nonstop: false, link: "https://example.com/cancun" },
        ],
      })
      .mockResolvedValueOnce({
        origin: "",
        destinations: [
          { name: "Los Angeles", flightPrice: "$180", airline: "DL", nonstop: true, link: "https://example.com/blank-origin" },
        ],
      });

    await GET(request("origin=Cancun"));
    await GET(request("vibes=no-origin-mangling"));

    expect(mockedGetSurpriseDestinations).toHaveBeenNthCalledWith(1, {
      origin: "Cancun",
      vibes: "",
      departMonth: "",
      tripLength: "",
    });
    expect(mockedGetSurpriseDestinations).toHaveBeenNthCalledWith(2, {
      origin: "",
      vibes: "no-origin-mangling",
      departMonth: "",
      tripLength: "",
    });
  });

  it("SUCCESS IS CACHED (1h): identical successful requests reuse the cached body", async () => {
    const engineResult = {
      origin: "LAX",
      destinations: [
        { name: "Honolulu, Hawaii", flightPrice: "$318", airline: "HA", nonstop: true, link: "https://example.com/lax-hnl" },
      ],
    };
    mockedGetSurpriseDestinations.mockResolvedValue(engineResult);

    const first = await GET(request("origin=LAX&vibes=surf-cache&depart_month=2026-09&trip_length=weekend"));
    const second = await GET(request("origin=LAX&vibes=surf-cache&depart_month=2026-09&trip_length=weekend"));

    expect(mockedGetSurpriseDestinations).toHaveBeenCalledTimes(1);
    expect(await json(first)).toEqual(engineResult);
    expect(await json(second)).toEqual(engineResult);
  });

  it("DEGRADED IS NOT CACHED: identical degraded requests call the engine every time", async () => {
    const engineResult = { origin: "ORD", destinations: [], degraded: { reason: "x" } };
    mockedGetSurpriseDestinations.mockResolvedValue(engineResult);

    await GET(request("origin=ORD&vibes=degraded-not-cached&depart_month=2026-10&trip_length=week"));
    await GET(request("origin=ORD&vibes=degraded-not-cached&depart_month=2026-10&trip_length=week"));

    expect(mockedGetSurpriseDestinations).toHaveBeenCalledTimes(2);
  });

  it("EMPTY-BUT-UNDEGRADED IS NOT CACHED (defensive): identical empty responses call the engine every time", async () => {
    const engineResult = { origin: "DEN", destinations: [] };
    mockedGetSurpriseDestinations.mockResolvedValue(engineResult);

    await GET(request("origin=DEN&vibes=empty-not-cached&depart_month=2026-11&trip_length=week"));
    await GET(request("origin=DEN&vibes=empty-not-cached&depart_month=2026-11&trip_length=week"));

    expect(mockedGetSurpriseDestinations).toHaveBeenCalledTimes(2);
  });

  it("ALL-DASH UNDEGRADED IS NOT CACHED: identical dash-only responses call the engine every time", async () => {
    const engineResult = {
      origin: "IAD",
      destinations: [
        { name: "Cancún, Mexico", flightPrice: "—", airline: "", nonstop: false, link: "" },
        { name: "San Juan, Puerto Rico", flightPrice: "—", airline: "", nonstop: false, link: "" },
        { name: "Punta Cana, Dominican Republic", flightPrice: "—", airline: "", nonstop: false, link: "" },
      ],
    };
    mockedGetSurpriseDestinations.mockResolvedValue(engineResult);

    await GET(request("origin=IAD&vibes=all-dash-not-cached-unique&depart_month=2027-03&trip_length=week"));
    await GET(request("origin=IAD&vibes=all-dash-not-cached-unique&depart_month=2027-03&trip_length=week"));

    expect(mockedGetSurpriseDestinations).toHaveBeenCalledTimes(2);
  });

  it("NO FASTAPI FETCH: does not call global fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    mockedGetSurpriseDestinations.mockResolvedValue({
      origin: "SEA",
      destinations: [
        { name: "Anchorage, Alaska", flightPrice: "$210", airline: "AS", nonstop: true, link: "https://example.com/sea-anc" },
      ],
    });

    await GET(request("origin=SEA&vibes=no-fastapi-fetch&depart_month=2026-12&trip_length=weekend"));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ALWAYS 200: degraded engine results are returned in the JSON body", async () => {
    mockedGetSurpriseDestinations.mockResolvedValue({
      origin: "BOS",
      destinations: [],
      degraded: { reason: "x" },
    });

    const res = await GET(request("origin=BOS&vibes=always-200&depart_month=2027-01&trip_length=week"));

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ origin: "BOS", destinations: [], degraded: { reason: "x" } });
  });

  it("ENGINE THROW DEGRADES IN-BODY, NEVER A 500: thrown runs are not cached", async () => {
    mockedGetSurpriseDestinations.mockRejectedValue(new Error("TravelPayouts temporary outage"));

    const first = await GET(request("origin=PHL&vibes=throw-not-cached&depart_month=2027-02&trip_length=week"));
    const second = await GET(request("origin=PHL&vibes=throw-not-cached&depart_month=2027-02&trip_length=week"));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const firstBody = (await json(first)) as { degraded: { reason: string } };
    const secondBody = (await json(second)) as { degraded: { reason: string } };
    expect(firstBody).toEqual({
      origin: "PHL",
      destinations: [],
      degraded: { reason: expect.any(String) },
    });
    expect(firstBody.degraded.reason.length).toBeGreaterThan(0);
    expect(secondBody).toEqual({
      origin: "PHL",
      destinations: [],
      degraded: { reason: expect.any(String) },
    });
    expect(secondBody.degraded.reason.length).toBeGreaterThan(0);
    expect(mockedGetSurpriseDestinations).toHaveBeenCalledTimes(2);
  });
});

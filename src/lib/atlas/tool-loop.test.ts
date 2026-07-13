import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));
vi.mock("./spend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./spend")>();
  return { ...actual, isSpendCapReached: vi.fn(() => false), recordAssistantSpend: vi.fn() };
});
vi.mock("./travelpayouts-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./travelpayouts-client")>();
  return {
    ...actual,
    searchFlights: vi.fn(async () => ({ flights: [], no_data: true, reason: "test" })),
    getDeals: vi.fn(async () => ({ deals: [], no_data: true, reason: "test" })),
  };
});
vi.mock("./surprise", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./surprise")>();
  return {
    ...actual,
    getSurpriseDestinations: vi.fn(async () => ({ destinations: [], degraded: { reason: "test" }, origin: "MIA" })),
  };
});
vi.mock("./tools/get-article", () => ({ getArticleTool: vi.fn(() => ({ articles: [] })) }));

import { runAtlasTurn } from "./tool-loop";
import { isSpendCapReached, recordAssistantSpend } from "./spend";
import { getDeals, INVALID_IATA_REASON, searchFlights } from "./travelpayouts-client";
import { getSurpriseDestinations } from "./surprise";

async function collect(gen: AsyncGenerator<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const frame of gen) out.push(frame);
  return out;
}

function parseToolFrame(frames: string[], toolName: string): Record<string, unknown> {
  const prefix = `data: [TOOL:${toolName}]`;
  const toolFrame = frames.find((f) => f.startsWith(prefix));
  expect(toolFrame).toBeDefined();
  return JSON.parse(toolFrame!.slice(prefix.length).trim()) as Record<string, unknown>;
}

function expectNoRawIataValues(values: unknown[]): void {
  for (const value of values) {
    expect(String(value)).not.toMatch(/^[A-Z]{3}$/);
  }
}

function expectNoRawAirlines(values: unknown[]): void {
  for (const value of values) {
    if (value === "") continue;
    expect(String(value)).not.toMatch(/^[A-Z0-9]{2}$/);
  }
}

describe("runAtlasTurn", () => {
  beforeEach(() => {
    createMock.mockReset();
    vi.mocked(isSpendCapReached).mockReturnValue(false);
    vi.mocked(recordAssistantSpend).mockReset();
    vi.mocked(getSurpriseDestinations).mockClear();
    vi.mocked(searchFlights).mockClear();
    vi.mocked(getDeals).mockClear();
  });

  it("yields a text response and [DONE] when the model answers directly", async () => {
    createMock.mockResolvedValueOnce({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Hello there" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const frames = await collect(runAtlasTurn({ message: "hi", history: [] }));
    expect(frames.some((f) => f.includes("Hello"))).toBe(true);
    expect(frames.at(-1)).toBe("data: [DONE]\n\n");
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-5",
        max_tokens: 4096,
        thinking: { type: "disabled" },
      })
    );
    expect(createMock.mock.calls[0][0]).not.toHaveProperty("temperature");
    expect(createMock.mock.calls[0][0]).not.toHaveProperty("top_p");
    expect(createMock.mock.calls[0][0]).not.toHaveProperty("top_k");
    expect(recordAssistantSpend).toHaveBeenCalledWith("claude-sonnet-5", { inputTokens: 10, outputTokens: 5 });
  });

  it("short-circuits with an honest cap-exceeded message when over the monthly spend cap", async () => {
    vi.mocked(isSpendCapReached).mockReturnValue(true);
    const frames = await collect(runAtlasTurn({ message: "hi", history: [] }));
    expect(frames[0]).toMatch(/monthly usage limit/i);
    expect(frames.at(-1)).toBe("data: [DONE]\n\n");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("emits a [TOOL:search_flights] frame with honest no_data when flights are empty", async () => {
    createMock
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "search_flights", input: { origin: "MIA", destination: "CUN", depart_date: "2026-09-01" } }],
        usage: { input_tokens: 10, output_tokens: 5 },
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "No flights found for that route." }],
        usage: { input_tokens: 20, output_tokens: 7 },
      });
    const frames = await collect(runAtlasTurn({ message: "flights to cancun", history: [] }));
    const toolFrame = frames.find((f) => f.startsWith("data: [TOOL:search_flights]"));
    expect(toolFrame).toBeDefined();
    expect(toolFrame).toContain('"no_data":true');
    expect(toolFrame).not.toMatch(/"price":\d/); // never a fabricated price
    expect(recordAssistantSpend).toHaveBeenCalledTimes(2);
    expect(recordAssistantSpend).toHaveBeenNthCalledWith(1, "claude-sonnet-5", { inputTokens: 10, outputTokens: 5 });
    expect(recordAssistantSpend).toHaveBeenNthCalledWith(2, "claude-sonnet-5", { inputTokens: 20, outputTokens: 7 });
  });

  it("dispatches surprise_me to the Surprise Me engine and emits rendered city-name suggestions", async () => {
    vi.mocked(getSurpriseDestinations).mockResolvedValueOnce({
      origin: "JFK",
      originName: "New York, New York",
      destinations: [
        { name: "Cancún, Mexico", flightPrice: "$120", airline: "jetBlue", nonstop: true, link: "https://example.com/jfk-cun" },
        { name: "San Juan, Puerto Rico", flightPrice: "$180", airline: "", nonstop: false, link: "https://example.com/jfk-sju" },
      ],
    });
    createMock
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "surprise_me", input: { origin: "JFK" } }],
        usage: { input_tokens: 11, output_tokens: 6 },
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Try these ideas." }],
        usage: { input_tokens: 21, output_tokens: 8 },
      });

    const frames = await collect(runAtlasTurn({ message: "surprise me", history: [] }));
    const payload = parseToolFrame(frames, "surprise_me");
    const suggestions = payload.suggestions as Array<Record<string, unknown>>;
    expect(suggestions).toEqual([
      { city: "Cancún, Mexico", tagline: "Nonstop on jetBlue", estimated_flight: "$120" },
      { city: "San Juan, Puerto Rico", tagline: "Popular route", estimated_flight: "$180" },
    ]);
    expectNoRawIataValues(suggestions.map((suggestion) => suggestion.city));
    expectNoRawAirlines(suggestions.map((suggestion) => suggestion.tagline));
    expect(suggestions.map((suggestion) => suggestion.city).join("|")).not.toMatch(/Newark|LaGuardia|New York/);
    expect(getSurpriseDestinations).toHaveBeenCalledWith({ origin: "JFK" });
  });

  it("surprise_me propagates live-pricing notices into the tool frame", async () => {
    vi.mocked(getSurpriseDestinations).mockResolvedValueOnce({
      origin: "JFK",
      destinations: [
        { name: "Cancún, Mexico", flightPrice: "—", airline: "", nonstop: false, link: "" },
      ],
      notice: { code: "no_token", reason: "Live flight search is not configured." },
    });
    createMock
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "surprise_me", input: { origin: "JFK" } }],
        usage: { input_tokens: 11, output_tokens: 6 },
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Try these ideas." }],
        usage: { input_tokens: 21, output_tokens: 8 },
      });

    const payload = parseToolFrame(await collect(runAtlasTurn({ message: "surprise me", history: [] })), "surprise_me");

    expect(payload.notice).toEqual({ code: "no_token", reason: "Live flight search is not configured." });
  });

  it("get_deals emits rendered city-name destinations, drops unnameable/raw codes, and excludes same-metro open deals", async () => {
    vi.mocked(getDeals).mockResolvedValueOnce({
      deals: [
        { date: "2026-08-01", destination: "EWR", price: "$80", savings_pct: 0, search_url: "https://example.com/jfk-ewr" },
        { date: "2026-08-01", destination: "SJU", price: "$140", savings_pct: 0, search_url: "https://example.com/jfk-sju" },
        { date: "2026-08-01", destination: "ZZZ", price: "$100", savings_pct: 0, search_url: "https://example.com/jfk-zzz" },
      ],
    });
    createMock
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "get_deals", input: { origin: "JFK" } }],
        usage: { input_tokens: 11, output_tokens: 6 },
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Here are deals." }],
        usage: { input_tokens: 21, output_tokens: 8 },
      });

    const payload = parseToolFrame(await collect(runAtlasTurn({ message: "deals", history: [] })), "get_deals");
    const deals = payload.deals as Array<Record<string, unknown>>;

    expect(deals.map((deal) => deal.destination)).toEqual(["San Juan, Puerto Rico"]);
    expectNoRawIataValues(deals.map((deal) => deal.destination));
    expect(deals.map((deal) => deal.destination).join("|")).not.toMatch(/Newark|LaGuardia|New York/);
  });

  it("get_deals keeps an explicitly requested same-metro route but still renders the city name", async () => {
    vi.mocked(getDeals).mockResolvedValueOnce({
      deals: [{ date: "2026-08-01", destination: "EWR", price: "$80", savings_pct: 0, search_url: "https://example.com/jfk-ewr" }],
    });
    createMock
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "get_deals", input: { origin: "JFK", destination: "EWR" } }],
        usage: { input_tokens: 11, output_tokens: 6 },
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Here are deals." }],
        usage: { input_tokens: 21, output_tokens: 8 },
      });

    const payload = parseToolFrame(await collect(runAtlasTurn({ message: "deals to Newark", history: [] })), "get_deals");
    const deals = payload.deals as Array<Record<string, unknown>>;
    expect(deals.map((deal) => deal.destination)).toEqual(["Newark, New Jersey"]);
    expectNoRawIataValues(deals.map((deal) => deal.destination));
  });

  it("get_deals reports same-metro-only drops honestly instead of claiming unnameable destinations", async () => {
    vi.mocked(getDeals).mockResolvedValueOnce({
      deals: [{ date: "2026-08-01", destination: "EWR", price: "$80", savings_pct: 0, search_url: "https://example.com/jfk-ewr" }],
    });
    createMock
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "get_deals", input: { origin: "JFK" } }],
        usage: { input_tokens: 11, output_tokens: 6 },
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "No useful destination deals." }],
        usage: { input_tokens: 21, output_tokens: 8 },
      });

    const payload = parseToolFrame(await collect(runAtlasTurn({ message: "deals", history: [] })), "get_deals");

    expect(payload).toMatchObject({ deals: [], no_data: true });
    expect(String(payload.reason)).toMatch(/same-metro airport hops/i);
    expect(String(payload.reason)).not.toMatch(/could not be named honestly/i);
  });

  it("get_deals tool frames render no-price labels without fabricated zero-dollar prices", async () => {
    vi.mocked(getDeals).mockResolvedValueOnce({
      deals: [{ date: "2026-08-01", destination: "SJU", price: "—", savings_pct: 0, search_url: "https://example.com/jfk-sju" }],
    });
    createMock
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "get_deals", input: { origin: "JFK" } }],
        usage: { input_tokens: 11, output_tokens: 6 },
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Here are deals." }],
        usage: { input_tokens: 21, output_tokens: 8 },
      });

    const payload = parseToolFrame(await collect(runAtlasTurn({ message: "deals", history: [] })), "get_deals");
    const deals = payload.deals as Array<Record<string, unknown>>;

    expect(deals[0].price).toBe("—");
    expect(JSON.stringify(payload)).not.toContain("$0");
  });

  it("search_flights emits rendered city-name routes and drops rows with unnameable endpoints", async () => {
    vi.mocked(searchFlights).mockResolvedValueOnce({
      flights: [
        { airline: "jetBlue", route: "MIA → CUN", price: "$220 round-trip", duration: "", stops: "Nonstop", depart_date: "2026-09-01", return_date: "2026-09-08", book_url: "https://example.com/mia-cun" },
        { airline: "", route: "JFK → ZZZ", price: "$100", duration: "", stops: "", depart_date: "2026-09-01", return_date: "", book_url: "https://example.com/jfk-zzz" },
      ],
      airports_searched: ["MIA"],
      destinations_searched: ["CUN"],
      origin: "MIA",
      destination: "CUN",
    });
    createMock
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "search_flights", input: { origin: "MIA", destination: "CUN", depart_date: "2026-09-01" } }],
        usage: { input_tokens: 11, output_tokens: 6 },
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Here are flights." }],
        usage: { input_tokens: 21, output_tokens: 8 },
      });

    const payload = parseToolFrame(await collect(runAtlasTurn({ message: "flights to cancun", history: [] })), "search_flights");
    const flights = payload.flights as Array<Record<string, unknown>>;

    expect(flights.map((flight) => flight.route)).toEqual(["Miami, Florida → Cancún, Mexico"]);
    expectNoRawAirlines(flights.map((flight) => flight.airline));
    for (const route of flights.map((flight) => String(flight.route))) {
      expect(route.split(" → ")).toHaveLength(2);
      expectNoRawIataValues(route.split(" → "));
    }
  });

  it("search_flights drops malformed three-part routes and non-IATA route parts", async () => {
    vi.mocked(searchFlights).mockResolvedValueOnce({
      flights: [
        { airline: "jetBlue", route: "MIA → CUN", price: "$220 round-trip", duration: "", stops: "Nonstop", depart_date: "2026-09-01", return_date: "2026-09-08", book_url: "https://example.com/mia-cun" },
        { airline: "jetBlue", route: "MIA → CUN → JFK", price: "$120", duration: "", stops: "", depart_date: "2026-09-01", return_date: "", book_url: "https://example.com/mia-cun-jfk" },
        { airline: "jetBlue", route: "MIAMI → CUN", price: "$130", duration: "", stops: "", depart_date: "2026-09-01", return_date: "", book_url: "https://example.com/miami-cun" },
      ],
      airports_searched: ["MIA"],
      destinations_searched: ["CUN"],
      origin: "MIA",
      destination: "CUN",
    });
    createMock
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "search_flights", input: { origin: "MIA", destination: "CUN", depart_date: "2026-09-01" } }],
        usage: { input_tokens: 11, output_tokens: 6 },
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Here are flights." }],
        usage: { input_tokens: 21, output_tokens: 8 },
      });

    const payload = parseToolFrame(await collect(runAtlasTurn({ message: "flights to cancun", history: [] })), "search_flights");
    const flights = payload.flights as Array<Record<string, unknown>>;

    expect(flights.map((flight) => flight.route)).toEqual(["Miami, Florida → Cancún, Mexico"]);
    expect(JSON.stringify(payload)).not.toContain("CUN → JFK");
    expect(JSON.stringify(payload)).not.toContain("MIAMI");
  });

  it("search_flights tool frames render no-price labels without fabricated zero-dollar prices", async () => {
    vi.mocked(searchFlights).mockResolvedValueOnce({
      flights: [
        { airline: "jetBlue", route: "MIA → CUN", price: "—", duration: "", stops: "", depart_date: "2026-09-01", return_date: "", book_url: "https://example.com/mia-cun" },
      ],
      airports_searched: ["MIA"],
      destinations_searched: ["CUN"],
      origin: "MIA",
      destination: "CUN",
    });
    createMock
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "search_flights", input: { origin: "MIA", destination: "CUN", depart_date: "2026-09-01" } }],
        usage: { input_tokens: 11, output_tokens: 6 },
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Here are flights." }],
        usage: { input_tokens: 21, output_tokens: 8 },
      });

    const payload = parseToolFrame(await collect(runAtlasTurn({ message: "flights to cancun", history: [] })), "search_flights");
    const flights = payload.flights as Array<Record<string, unknown>>;

    expect(flights[0].price).toBe("—");
    expect(JSON.stringify(payload)).not.toContain("$0");
  });

  it("rejects blank chat origins at the boundary before search_flights can default to Miami", async () => {
    createMock
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "search_flights", input: { origin: " ", destination: "CUN", depart_date: "2026-09-01" } }],
        usage: { input_tokens: 11, output_tokens: 6 },
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Which airport are you flying from?" }],
        usage: { input_tokens: 21, output_tokens: 8 },
      });

    const payload = parseToolFrame(await collect(runAtlasTurn({ message: "flights to cancun", history: [] })), "search_flights");

    expect(payload).toMatchObject({ flights: [], no_data: true, reason: INVALID_IATA_REASON });
    expect(searchFlights).not.toHaveBeenCalled();
  });

  it("rejects blank chat origins at the boundary before get_deals can default to Miami", async () => {
    createMock
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "get_deals", input: { origin: "" } }],
        usage: { input_tokens: 11, output_tokens: 6 },
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Which airport are you flying from?" }],
        usage: { input_tokens: 21, output_tokens: 8 },
      });

    const payload = parseToolFrame(await collect(runAtlasTurn({ message: "any deals?", history: [] })), "get_deals");

    expect(payload).toMatchObject({ deals: [], no_data: true, reason: INVALID_IATA_REASON });
    expect(getDeals).not.toHaveBeenCalled();
  });

  it("rejects blank chat origins at the boundary before surprise_me can run", async () => {
    createMock
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "surprise_me", input: { origin: "" } }],
        usage: { input_tokens: 11, output_tokens: 6 },
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Which airport are you flying from?" }],
        usage: { input_tokens: 21, output_tokens: 8 },
      });

    const payload = parseToolFrame(await collect(runAtlasTurn({ message: "surprise me", history: [] })), "surprise_me");

    expect(payload).toMatchObject({ suggestions: [], no_data: true, reason: INVALID_IATA_REASON });
    expect(getSurpriseDestinations).not.toHaveBeenCalled();
  });

  it("keeps tools available but disables tool choice on the final exhaustion call", async () => {
    for (let i = 0; i < 5; i += 1) {
      createMock.mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: `t${i}`, name: "surprise_me", input: { origin: "MIA" } }],
        usage: { input_tokens: 1, output_tokens: 1 },
      });
    }
    createMock.mockResolvedValueOnce({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "No more tools." }],
      usage: { input_tokens: 2, output_tokens: 2 },
    });

    await collect(runAtlasTurn({ message: "keep using tools", history: [] }));

    const finalCall = createMock.mock.calls[5][0];
    expect(finalCall.tools).toBeDefined();
    expect(finalCall.tool_choice).toEqual({ type: "none" });
  });

  it("carries newlines in model text losslessly via multi-line SSE events", async () => {
    createMock.mockResolvedValueOnce({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "First paragraph.\n\nSecond line" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const frames = await collect(runAtlasTurn({ message: "hi", history: [] }));
    // Every non-empty line of every frame must be `data: `-prefixed (valid SSE).
    for (const frame of frames) {
      for (const line of frame.split("\n")) {
        if (line !== "") expect(line.startsWith("data: ")).toBe(true);
      }
    }
    // Decoding and concatenating the token frames must reproduce the text exactly.
    const { decodeSseData } = await import("./sse");
    const text = frames
      .slice(0, -1) // drop [DONE]
      .map((f) => decodeSseData(f))
      .filter((d): d is string => d !== null)
      .join("");
    expect(text).toBe("First paragraph.\n\nSecond line");
  });

  it("emits an error frame instead of a blank reply on refusal", async () => {
    createMock.mockResolvedValueOnce({
      stop_reason: "refusal",
      content: [],
      usage: { input_tokens: 10, output_tokens: 0 },
    });
    const frames = await collect(runAtlasTurn({ message: "hi", history: [] }));
    expect(frames.some((f) => f.includes('"error"'))).toBe(true);
    expect(frames.at(-1)).toBe("data: [DONE]\n\n");
  });

  it("surfaces a cut-short error when max_tokens truncates a pending tool call", async () => {
    createMock.mockResolvedValueOnce({
      stop_reason: "max_tokens",
      content: [
        { type: "text", text: "Let me check" },
        { type: "tool_use", id: "t1", name: "search_flights", input: {} },
      ],
      usage: { input_tokens: 10, output_tokens: 4096 },
    });
    const frames = await collect(runAtlasTurn({ message: "hi", history: [] }));
    const joined = frames.join("");
    // Words stream one per frame, so assert a single word — the phrase
    // "Let me check" is never contiguous in the joined frame bytes.
    expect(joined).toContain("check");
    expect(joined).toContain("cut short");
    expect(frames.at(-1)).toBe("data: [DONE]\n\n");
  });

  it("streams preamble text that accompanies tool calls, before the tool frames", async () => {
    createMock
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [
          { type: "text", text: "Checking live prices now." },
          { type: "tool_use", id: "t1", name: "surprise_me", input: { origin: "MIA" } },
        ],
        usage: { input_tokens: 10, output_tokens: 20 },
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Done." }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
    const frames = await collect(runAtlasTurn({ message: "hi", history: [] }));
    const preambleIdx = frames.findIndex((f) => f.includes("Checking"));
    const toolIdx = frames.findIndex((f) => f.includes("[TOOL:surprise_me]"));
    expect(preambleIdx).toBeGreaterThanOrEqual(0);
    expect(toolIdx).toBeGreaterThan(preambleIdx);
  });

  it("contains a throwing tool as an is_error tool_result instead of killing the turn", async () => {
    const { getArticleTool } = await import("./tools/get-article");
    vi.mocked(getArticleTool).mockImplementationOnce(() => {
      throw new TypeError("boom");
    });
    createMock
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "get_article", input: { query: "miami" } }],
        usage: { input_tokens: 10, output_tokens: 20 },
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Sorry, the guide lookup hiccuped." }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
    const frames = await collect(runAtlasTurn({ message: "hi", history: [] }));
    const joined = frames.join("");
    expect(joined).toContain('"is_error":true');
    expect(joined).toContain("hiccuped"); // the turn survived and produced a final reply
    expect(joined).not.toContain("taking a nap"); // tool-loop's generic ERROR_FRAME never fired
  });
});

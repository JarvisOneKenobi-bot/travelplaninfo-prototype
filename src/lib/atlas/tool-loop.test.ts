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
vi.mock("./travelpayouts-client", () => ({
  searchFlights: vi.fn(async () => ({ flights: [], no_data: true, reason: "test" })),
  getDeals: vi.fn(async () => ({ deals: [], no_data: true, reason: "test" })),
  getPopularRoutes: vi.fn(async () => ({ suggestions: [], no_data: true, reason: "test" })),
}));
vi.mock("./tools/get-article", () => ({ getArticleTool: vi.fn(() => ({ articles: [] })) }));

import { runAtlasTurn } from "./tool-loop";
import { isSpendCapReached, recordAssistantSpend } from "./spend";
import { getPopularRoutes } from "./travelpayouts-client";

async function collect(gen: AsyncGenerator<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const frame of gen) out.push(frame);
  return out;
}

describe("runAtlasTurn", () => {
  beforeEach(() => {
    createMock.mockReset();
    vi.mocked(isSpendCapReached).mockReturnValue(false);
    vi.mocked(recordAssistantSpend).mockReset();
    vi.mocked(getPopularRoutes).mockClear();
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

  it("dispatches surprise_me to popular routes and emits a matching tool frame", async () => {
    createMock
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "t1", name: "surprise_me", input: { origin: "MIA" } }],
        usage: { input_tokens: 11, output_tokens: 6 },
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Try these ideas." }],
        usage: { input_tokens: 21, output_tokens: 8 },
      });

    const frames = await collect(runAtlasTurn({ message: "surprise me", history: [] }));
    const toolFrame = frames.find((f) => f.startsWith("data: [TOOL:surprise_me]"));
    expect(toolFrame).toBeDefined();
    expect(toolFrame).toContain('"suggestions":[]');
    expect(getPopularRoutes).toHaveBeenCalledWith("MIA");
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
});

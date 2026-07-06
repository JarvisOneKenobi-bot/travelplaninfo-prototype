import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlock, MessageParam, Tool, ToolResultBlockParam, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { getAnthropicApiKey } from "@/lib/server-config";
import { buildAtlasSystemPrompt } from "./system-prompt";
import { ASSISTANT_SPEND_CAP_USD, getAssistantMonthlySpendUsd, recordAssistantSpend } from "./spend";
import { encodeSseData } from "./sse";
import { getDeals, getPopularRoutes, searchFlights } from "./travelpayouts-client";
import { getArticleTool } from "./tools/get-article";

const MODEL = "claude-sonnet-5";
const MAX_TOOL_ITERATIONS = 5;
const MAX_TOKENS = 4096;
const ERROR_FRAME = 'data: {"error": "Atlas is taking a nap. Please try again in a moment."}\n\n';
const DONE_FRAME = "data: [DONE]\n\n";

export const TOOLS: Tool[] = [
  {
    name: "search_flights",
    description:
      "Search real flight prices for a route and date via Travelpayouts/Aviasales. Call this when the user asks about flight prices, availability, or booking options for a specific trip.",
    input_schema: {
      type: "object",
      properties: {
        origin: { type: "string", description: "Origin airport IATA code" },
        destination: { type: "string", description: "Destination airport IATA code" },
        depart_date: { type: "string", description: "YYYY-MM-DD" },
        return_date: { type: "string", description: "YYYY-MM-DD, omit for one-way" },
      },
      required: ["origin", "destination", "depart_date"],
    },
  },
  {
    name: "get_deals",
    description: "Get current cheap flight deals from an origin airport, optionally filtered to a destination.",
    input_schema: {
      type: "object",
      properties: {
        origin: { type: "string", description: "Origin airport IATA code" },
        destination: { type: "string", description: "Destination airport IATA code — include it when the user asks about deals to a specific place" },
      },
      required: ["origin"],
    },
  },
  {
    name: "get_article",
    description:
      "Find TravelPlanInfo guide articles relevant to a destination or topic. Only recommend TPI's own articles this way.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "surprise_me",
    description:
      "Get real popular flight routes/destinations from an origin airport, for a user who wants an open-ended destination suggestion rather than a specific one. Call this for 'surprise me' / 'where should I go' style requests.",
    input_schema: {
      type: "object",
      properties: { origin: { type: "string", description: "Origin airport IATA code" } },
      required: ["origin"],
    },
  },
];

type ToolInput = Record<string, unknown>;

export interface RunAtlasTurnParams {
  message: string;
  history: MessageParam[];
  pageContext?: string;
  preferencesJson?: string;
  memoryContext?: string;
}

function stringInput(input: ToolInput, key: string): string {
  const value = input[key];
  return typeof value === "string" ? value : "";
}

function isToolUseBlock(block: ContentBlock): block is ToolUseBlock {
  return block.type === "tool_use";
}

function hasErrorFlag(result: unknown): boolean {
  return Boolean(result && typeof result === "object" && "is_error" in result && (result as { is_error?: unknown }).is_error);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeTool(name: string, input: ToolInput): Promise<unknown> {
  switch (name) {
    case "search_flights":
      return searchFlights(
        stringInput(input, "origin"),
        stringInput(input, "destination"),
        stringInput(input, "depart_date"),
        stringInput(input, "return_date") || undefined
      );
    case "get_deals":
      return getDeals(stringInput(input, "origin"), stringInput(input, "destination") || undefined);
    case "get_article":
      return getArticleTool(stringInput(input, "query"));
    case "surprise_me":
      return getPopularRoutes(stringInput(input, "origin"));
    default:
      return { is_error: true, error: `Unknown tool: ${name}` };
  }
}

export async function* runAtlasTurn(params: RunAtlasTurnParams): AsyncGenerator<string> {
  try {
    // Check-then-act can race under concurrent requests; this mirrors the Python backend behavior at expected traffic volume.
    if (getAssistantMonthlySpendUsd() >= ASSISTANT_SPEND_CAP_USD) {
      yield 'data: {"error": "Atlas has reached its monthly usage limit. Please try again next month."}\n\n';
      yield DONE_FRAME;
      return;
    }

    const client = new Anthropic({ apiKey: getAnthropicApiKey() });
    const systemPrompt = buildAtlasSystemPrompt({
      pageContext: params.pageContext,
      preferencesJson: params.preferencesJson,
      memoryContext: params.memoryContext,
    });
    const currentMessages: MessageParam[] = [
      ...params.history,
      { role: "user", content: params.message },
    ];

    for (let iteration = 0; iteration <= MAX_TOOL_ITERATIONS; iteration += 1) {
      const useTools = iteration < MAX_TOOL_ITERATIONS;
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: "disabled" },
        system: useTools ? systemPrompt : `${systemPrompt}\n\nIMPORTANT: Respond with text only. Do not use any tools.`,
        messages: currentMessages,
        tools: TOOLS,
        ...(useTools ? {} : { tool_choice: { type: "none" as const } }),
      });

      recordAssistantSpend(MODEL, {
        inputTokens: response.usage.input_tokens ?? 0,
        outputTokens: response.usage.output_tokens ?? 0,
      });

      if (useTools && response.stop_reason === "tool_use") {
        const toolResults: ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (!isToolUseBlock(block)) continue;
          const result = await executeTool(block.name, block.input as ToolInput);
          yield `data: [TOOL:${block.name}]${JSON.stringify(result)}\n\n`;
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
            is_error: hasErrorFlag(result),
          });
        }

        currentMessages.push({ role: "assistant", content: response.content });
        currentMessages.push({ role: "user", content: toolResults });
        continue;
      }

      for (const block of response.content) {
        if (block.type !== "text" || !block.text) continue;
        const words = block.text.split(" ");
        for (let i = 0; i < words.length; i += 1) {
          const token = i === 0 ? words[i] : ` ${words[i]}`;
          yield encodeSseData(token);
          await sleep(10);
        }
      }

      yield DONE_FRAME;
      return;
    }

    yield DONE_FRAME;
  } catch (error) {
    console.error("Anthropic tool loop failed:", error);
    yield ERROR_FRAME;
    yield DONE_FRAME;
  }
}

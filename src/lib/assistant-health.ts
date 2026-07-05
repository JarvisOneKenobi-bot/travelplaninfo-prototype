import "server-only";
import { getAnthropicApiKey } from "@/lib/server-config";
import { ASSISTANT_SPEND_CAP_USD, getAssistantMonthlySpendUsd } from "@/lib/atlas/spend";

export interface AssistantHealth {
  anthropic: boolean;
  travelpayouts: boolean;
  spendCapOk: boolean;
  healthy: boolean;
}

const HEALTH_CACHE_TTL_MS = 45 * 1000;

let cachedResult: { value: AssistantHealth; expiresAt: number } | null = null;
let inFlight: Promise<AssistantHealth> | null = null;

async function computeHealth(): Promise<AssistantHealth> {
  const anthropic = Boolean(getAnthropicApiKey());
  const travelpayouts = Boolean(process.env.TRAVELPAYOUTS_TOKEN?.trim());
  const spendCapOk = getAssistantMonthlySpendUsd() < ASSISTANT_SPEND_CAP_USD;

  // `healthy` requires BOTH the Anthropic key and room under the monthly
  // spend cap. Travelpayouts absence only degrades flight search to an honest
  // no-data response, so it does not gate the whole assistant.
  return {
    anthropic,
    travelpayouts,
    spendCapOk,
    healthy: anthropic && spendCapOk,
  };
}

export async function getAssistantHealth(): Promise<AssistantHealth> {
  if (cachedResult && Date.now() < cachedResult.expiresAt) {
    return cachedResult.value;
  }
  if (inFlight) {
    return inFlight;
  }

  inFlight = computeHealth()
    .then((value) => {
      cachedResult = { value, expiresAt: Date.now() + HEALTH_CACHE_TTL_MS };
      inFlight = null;
      return value;
    })
    .catch((err) => {
      inFlight = null;
      throw err;
    });

  return inFlight;
}

export function __resetAssistantHealthCacheForTests(): void {
  cachedResult = null;
  inFlight = null;
}

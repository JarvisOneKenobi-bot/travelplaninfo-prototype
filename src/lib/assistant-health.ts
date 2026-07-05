import "server-only";
import { getAnthropicApiKey, getFastApiBaseUrl } from "@/lib/server-config";

export interface AssistantHealth {
  anthropic: boolean;
  travelpayouts: boolean;
  backendReachable: boolean;
  healthy: boolean;
}

const HEALTH_CACHE_TTL_MS = 45 * 1000;
const BACKEND_PROBE_TIMEOUT_MS = 1500;

let cachedResult: { value: AssistantHealth; expiresAt: number } | null = null;
let inFlight: Promise<AssistantHealth> | null = null;

async function probeBackendReachable(): Promise<boolean> {
  try {
    const url = new URL("/health", getFastApiBaseUrl());
    // Any HTTP response — even a non-2xx status — means the process is up
    // and answering; the FastAPI /health route's own "degraded" status
    // reflects unrelated summary-file freshness, not reachability.
    await fetch(url, { signal: AbortSignal.timeout(BACKEND_PROBE_TIMEOUT_MS), cache: "no-store" });
    return true;
  } catch {
    return false;
  }
}

async function computeHealth(): Promise<AssistantHealth> {
  const anthropic = Boolean(getAnthropicApiKey());
  const travelpayouts = Boolean(process.env.TRAVELPAYOUTS_TOKEN?.trim());
  const backendReachable = await probeBackendReachable();

  // `healthy` requires BOTH the Anthropic key and a reachable backend.
  // Today chat capability technically depends only on the FastAPI backend
  // (it holds its own keys) — requiring the Next-side Anthropic key too is
  // deliberate future-proofing for Phase 2, when the assistant brain moves
  // into this app and starts using this key directly.
  return {
    anthropic,
    travelpayouts,
    backendReachable,
    healthy: anthropic && backendReachable,
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

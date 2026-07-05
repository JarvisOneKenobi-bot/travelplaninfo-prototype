import { getAnthropicApiKey } from "@/lib/server-config";

export function checkAtlasEnvPreflight(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!getAnthropicApiKey()) missing.push("ANTHROPIC_API_KEY");
  if (!process.env.TRAVELPAYOUTS_TOKEN?.trim()) missing.push("TRAVELPAYOUTS_TOKEN");
  return { ok: missing.length === 0, missing };
}

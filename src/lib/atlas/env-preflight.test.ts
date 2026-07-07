import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/server-config", () => ({
  getAnthropicApiKey: vi.fn(),
}));

import { getAnthropicApiKey } from "@/lib/server-config";
import { checkAtlasEnvPreflight } from "./env-preflight";

describe("checkAtlasEnvPreflight", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(getAnthropicApiKey).mockReturnValue("");
  });

  it("reports ok:true when both anthropic key and travelpayouts token are present", () => {
    vi.mocked(getAnthropicApiKey).mockReturnValue("sk-ant-fake-key");
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "fake-token");
    const result = checkAtlasEnvPreflight();
    expect(result).toEqual({ ok: true, missing: [] });
  });

  it("lists ANTHROPIC_API_KEY as missing when getAnthropicApiKey returns empty", () => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "fake-token");
    const result = checkAtlasEnvPreflight();
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("ANTHROPIC_API_KEY");
  });

  it("lists TRAVELPAYOUTS_TOKEN as missing when unset", () => {
    vi.mocked(getAnthropicApiKey).mockReturnValue("sk-ant-fake-key");
    const result = checkAtlasEnvPreflight();
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("TRAVELPAYOUTS_TOKEN");
  });
});
